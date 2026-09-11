<?php

declare(strict_types=1);
/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\Service;

use OCA\Forms\BackgroundJob\SendConfirmationMailJob;
use OCA\Forms\Db\AnswerMapper;
use OCA\Forms\Db\Form;
use OCA\Forms\Db\OptionMapper;
use OCA\Forms\Db\Question;
use OCA\Forms\Db\QuestionMapper;
use OCA\Forms\Db\Submission;
use OCP\AppFramework\Db\IMapperException;
use OCP\BackgroundJob\IJobList;
use OCP\ICache;
use OCP\ICacheFactory;
use OCP\IL10N;
use OCP\IMemcache;
use OCP\Mail\IEmailValidator;
use Psr\Log\LoggerInterface;

class ConfirmationEmailService {
	private const RATE_LIMIT_TTL = 86400; // 24 hours

	private readonly ICache $rateLimitCache;

	public function __construct(
		private readonly ConfigService $configService,
		private readonly AnswerMapper $answerMapper,
		private readonly QuestionMapper $questionMapper,
		private readonly IEmailValidator $emailValidator,
		private readonly IJobList $jobList,
		ICacheFactory $cacheFactory,
		private readonly IL10N $l10n,
		private readonly LoggerInterface $logger,
		private readonly QuizService $quizService,
		private readonly OptionMapper $optionMapper,
	) {
		$this->rateLimitCache = $cacheFactory->createDistributed('forms_confirmation_email');
	}

	public function send(Form $form, Submission $submission): void {
		if (!$form->getConfirmationEmailEnabled()) {
			return;
		}

		if (!$this->configService->getAllowConfirmationEmail()) {
			$this->logger->debug('Confirmation email feature is disabled by administrator', [
				'formId' => $form->getId(),
			]);
			return;
		}

		$questions = $this->loadQuestions($form->getId());
		$answerMap = $this->buildAnswerMap($submission);

		$recipientQuestion = $this->findRecipientQuestion($form, $questions);
		if ($recipientQuestion === null) {
			if ($form->getConfirmationEmailQuestionId() !== null) {
				$this->logger->debug('Configured confirmation email recipient question is not a valid email question', [
					'formId' => $form->getId(),
					'submissionId' => $submission->getId(),
					'configuredQuestionId' => $form->getConfirmationEmailQuestionId(),
				]);
			}
			return;
		}

		$recipientEmail = $answerMap[$recipientQuestion['id']][0] ?? null;
		if ($recipientEmail === null || !$this->emailValidator->isValid($recipientEmail)) {
			$this->logger->debug('No valid email address found in submission for confirmation email', [
				'formId' => $form->getId(),
				'submissionId' => $submission->getId(),
			]);
			return;
		}

		if (!$this->checkRateLimit($recipientEmail, $form->getId(), $submission->getId())) {
			return;
		}

		[$subject, $body] = $this->buildEmailContent($form, $questions, $answerMap);

		$this->jobList->add(SendConfirmationMailJob::class, [
			'recipient' => $recipientEmail,
			'subject' => $subject,
			'body' => $body,
			'formId' => $form->getId(),
			'submissionId' => $submission->getId(),
		]);
		$this->logger->debug('Confirmation email queued', [
			'formId' => $form->getId(),
			'submissionId' => $submission->getId(),
		]);
	}

	/**
	 * @throws \InvalidArgumentException
	 */
	public function validateRecipientQuestionId(Form $form, mixed $recipientId): void {
		if ($recipientId === null) {
			return;
		}

		if (!is_int($recipientId)) {
			throw new \InvalidArgumentException('Invalid confirmationEmailQuestionId');
		}

		try {
			$question = $this->questionMapper->findById($recipientId);
		} catch (IMapperException $e) {
			throw new \InvalidArgumentException('Invalid confirmationEmailQuestionId', previous: $e);
		}

		if ($question->getFormId() !== $form->getId()
			|| $question->getOrder() === 0
			|| !$question->isEmailType()) {
			throw new \InvalidArgumentException('Invalid confirmationEmailQuestionId');
		}
	}

	/**
	 * Load questions for a form. Skips options and file-type processing not needed for email.
	 *
	 * @return list<array<string, mixed>>
	 */
	private function loadQuestions(int $formId): array {
		$questions = [];
		try {
			foreach ($this->questionMapper->findByForm($formId) as $entity) {
				$questions[] = $entity->read();
			}
		} catch (\Exception $e) {
			$this->logger->debug('Failed to load questions for confirmation email placeholder substitution', [
				'formId' => $formId,
				'exception' => $e,
			]);
		}
		return $questions;
	}

	/**
	 * @return array<int, string[]>
	 */
	private function buildAnswerMap(Submission $submission): array {
		$map = [];
		foreach ($this->answerMapper->findBySubmission($submission->getId()) as $answer) {
			$map[$answer->getQuestionId()][] = $answer->getText();
		}
		return $map;
	}

	/**
	 * @param list<array<string, mixed>> $questions
	 * @param array<int, string[]> $answerMap
	 * @return array{string, string}
	 */
	private function buildEmailContent(Form $form, array $questions, array $answerMap): array {
		$subject = $form->getConfirmationEmailSubject();
		$body = $form->getConfirmationEmailBody();

		if (empty($subject)) {
			$subject = $this->l10n->t('Thank you for your submission');
		}
		// A quiz's email can carry the respondent's score, as {score} and {maxScore}; the
		// default text gives it without being asked.
		$grade = $this->gradeFor($form, $questions, $answerMap);

		if (empty($body)) {
			$body = $this->l10n->t('Thank you for submitting the form "%s".', [$form->getTitle()]);
			if ($grade !== null) {
				$body .= "\n\n" . $this->l10n->t('Your score: %1$s out of %2$s', [
					$this->formatScore($grade['score']),
					$this->formatScore($grade['max']),
				]);
			}
		}

		$replacements = [
			'{formTitle}' => $form->getTitle(),
			'{formDescription}' => $form->getDescription() ?? '',
		];
		if ($grade !== null) {
			$replacements['{score}'] = $this->formatScore($grade['score']);
			$replacements['{maxScore}'] = $this->formatScore($grade['max']);
		}

		foreach ($questions as $question) {
			$fieldKey = !empty($question['name'] ?? '') ? $question['name'] : ($question['text'] ?? '');
			$fieldKey = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $fieldKey));
			if ($fieldKey === '' || empty($answerMap[$question['id']])) {
				continue;
			}
			$placeholder = '{' . $fieldKey . '}';
			if (isset($replacements[$placeholder])) {
				$this->logger->warning('Confirmation email placeholder key collision, skipping duplicate', [
					'formId' => $form->getId(),
					'key' => $fieldKey,
				]);
				continue;
			}
			$replacements[$placeholder] = implode('; ', $answerMap[$question['id']]);
		}

		return [
			str_replace(array_keys($replacements), array_values($replacements), $subject),
			str_replace(array_keys($replacements), array_values($replacements), $body),
		];
	}

	/**
	 * The response's quiz grade, when the form is a quiz with an answer key.
	 *
	 * Graded from the stored answers exactly as the results grade them, so the email,
	 * the results and what the respondent was shown on submitting all agree.
	 *
	 * @param list<array<string, mixed>> $questions the form's questions, without options
	 * @param array<int, string[]> $answerMap the stored answers, keyed by question id
	 * @return ?array{score: float, max: float} the grade, or null when there is none
	 */
	private function gradeFor(Form $form, array $questions, array $answerMap): ?array {
		if (!$this->quizService->isQuiz($form)) {
			return null;
		}
		try {
			$withOptions = array_map(function (array $question): array {
				$question['options'] = array_map(
					static fn ($option) => $option->read(),
					$this->optionMapper->findByQuestion($question['id']),
				);
				return $question;
			}, $questions);
			$grade = $this->quizService->gradeStored($withOptions, $answerMap);
		} catch (\Throwable $e) {
			// The email still goes; only the score is left out.
			$this->logger->warning('Could not grade response for confirmation email', [
				'formId' => $form->getId(),
				'exception' => $e,
			]);
			return null;
		}
		return $grade['max'] > 0 ? $grade : null;
	}

	/**
	 * @param float $value a score
	 * @return string the score without trailing zeros, so 4.0 reads as 4
	 */
	private function formatScore(float $value): string {
		return (string)round($value, 2);
	}

	/**
	 * @param list<array<string, mixed>> $questions
	 * @return array<string, mixed>|null
	 */
	private function findRecipientQuestion(Form $form, array $questions): ?array {
		$recipientQuestionId = $form->getConfirmationEmailQuestionId();
		if ($recipientQuestionId === null) {
			return null;
		}

		foreach ($questions as $questionData) {
			if (($questionData['id'] ?? null) !== $recipientQuestionId) {
				continue;
			}

			if (Question::checkEmailType(
				$questionData['type'] ?? '',
				(array)($questionData['extraSettings'] ?? [])
			)) {
				return $questionData;
			}

			return null;
		}

		return null;
	}

	private function checkRateLimit(string $email, int $formId, int $submissionId): bool {
		$cacheKey = 'email_rl_' . hash('sha256', $formId . ':' . strtolower($email));

		if (!$this->rateLimitCache instanceof IMemcache) {
			// Atomic increment requires IMemcache; without it we cannot safely count.
			$this->logger->debug('Distributed cache unavailable, skipping confirmation email rate limit', [
				'formId' => $formId,
			]);
			return true;
		}

		$rateLimit = $this->configService->getConfirmationEmailRateLimit();

		if ($this->rateLimitCache->add($cacheKey, 1, self::RATE_LIMIT_TTL)) {
			$count = 1;
		} else {
			$count = $this->rateLimitCache->inc($cacheKey);
			if (!is_int($count)) {
				$this->logger->warning('Failed to increment confirmation email rate limit counter', [
					'formId' => $formId,
					'submissionId' => $submissionId,
				]);
				return false;
			}
		}

		if ($count > $rateLimit) {
			$this->logger->warning('Per-recipient confirmation email rate limit reached', [
				'formId' => $formId,
				'submissionId' => $submissionId,
			]);
			return false;
		}

		return true;
	}
}
