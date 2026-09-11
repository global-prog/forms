<?php

declare(strict_types=1);
/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\Service;

use OCA\Forms\Constants;
use OCA\Forms\Db\Form;

/**
 * Grade a response against the answer key held on each question.
 *
 * The key lives in each question's extra settings rather than in tables of its own, so quiz
 * mode needs no schema change. Scores are therefore computed on demand instead of stored -
 * at realistic form sizes that costs nothing, and it means editing an answer key corrects
 * every past response rather than leaving stale scores behind.
 *
 * Grading is deliberately generous about shape and strict about correctness: a question with
 * no key is worth nothing and is skipped, so enabling quiz mode on an existing form cannot
 * suddenly mark every response as zero out of many.
 */
class QuizService {
	/** Types whose answers name options, which are stored by their text. */
	private const CHOICE_TYPES = [
		Constants::ANSWER_TYPE_DROPDOWN,
		Constants::ANSWER_TYPE_MULTIPLE,
		Constants::ANSWER_TYPE_MULTIPLEUNIQUE,
	];

	/**
	 * Is this form a quiz?
	 *
	 * @param Form $form the form to test
	 * @return bool true when quiz mode is on
	 */
	public function isQuiz(Form $form): bool {
		try {
			return !empty($form->getSettings()['quizMode']);
		} catch (\Throwable) {
			return false;
		}
	}

	/**
	 * Grade a set of answers.
	 *
	 * @param list<array> $questions the form's questions, as arrays
	 * @param array $answers answers keyed by question id
	 * @return array{score: float, max: float, questions: array<int, array{correct: bool, points: float, earned: float, feedback: string}>}
	 */
	public function grade(array $questions, array $answers): array {
		$score = 0.0;
		$max = 0.0;
		$perQuestion = [];

		foreach ($questions as $question) {
			$extra = $question['extraSettings'] ?? [];
			if (!$this->hasAnswerKey($extra)) {
				// No key set: not part of the quiz at all.
				continue;
			}

			$points = (float)($extra['points'] ?? 1);
			$max += $points;

			$correct = $this->isCorrect($question, $answers[$question['id']] ?? []);
			$earned = $correct ? $points : 0.0;
			$score += $earned;

			$perQuestion[$question['id']] = [
				'correct' => $correct,
				'points' => $points,
				'earned' => $earned,
				'feedback' => (string)($correct
					? ($extra['feedbackCorrect'] ?? '')
					: ($extra['feedbackIncorrect'] ?? '')),
			];
		}

		return ['score' => $score, 'max' => $max, 'questions' => $perQuestion];
	}

	/**
	 * Grade a response as it was stored.
	 *
	 * A response arrives naming the options chosen by id, but is stored naming them by their
	 * text, while the key names them by id. So each stored choice is turned back into the id
	 * of the option carrying that text before grading. A choice that no longer matches an
	 * option, because it was an "other" answer or the option has since been reworded, gets
	 * back the prefix an "other" answer arrives with, so it can never pass for an option id
	 * even when someone typed one. A grid or a ranking is stored as what arrived, encoded, so
	 * it is decoded back; everything else is stored as it arrived.
	 *
	 * @param list<array> $questions the form's questions, as arrays
	 * @param array $stored the stored answer texts, keyed by question id
	 * @return array the grade, shaped as grade() returns it
	 */
	public function gradeStored(array $questions, array $stored): array {
		$answers = [];
		foreach ($questions as $question) {
			$texts = $stored[$question['id']] ?? [];
			if ($texts === []) {
				continue;
			}
			$type = $question['type'] ?? '';
			if ($type === Constants::ANSWER_TYPE_GRID || $type === Constants::ANSWER_TYPE_RANKING) {
				$decoded = json_decode((string)$texts[0], true);
				$answers[$question['id']] = is_array($decoded) ? $decoded : [];
				continue;
			}
			if (!in_array($this->choiceType($question), self::CHOICE_TYPES, true)) {
				$answers[$question['id']] = $texts;
				continue;
			}

			// Two options with the same text cannot be told apart once stored; the first wins.
			$idsByText = [];
			foreach ($question['options'] ?? [] as $option) {
				$idsByText[(string)$option['text']] ??= (string)$option['id'];
			}
			$answers[$question['id']] = array_map(
				static fn ($text) => $idsByText[(string)$text]
					?? Constants::QUESTION_EXTRASETTINGS_OTHER_PREFIX . $text,
				$texts,
			);
		}
		return $this->grade($questions, $answers);
	}

	/**
	 * The type a question is answered as: a conditional question is answered as its trigger.
	 *
	 * @param array $question the question
	 * @return string the answer type
	 */
	private function choiceType(array $question): string {
		$type = (string)($question['type'] ?? '');
		if ($type === Constants::ANSWER_TYPE_CONDITIONAL) {
			return (string)($question['extraSettings']['triggerType'] ?? '');
		}
		return $type;
	}

	/**
	 * Does this question carry an answer key?
	 *
	 * @param array $extra the question's extra settings
	 * @return bool true when a key is present
	 */
	private function hasAnswerKey(array $extra): bool {
		return !empty($extra['correctOptions']) || ($extra['correctAnswer'] ?? '') !== '';
	}

	/**
	 * Was this question answered correctly?
	 *
	 * @param array $question the question
	 * @param array $answer the submitted values
	 * @return bool true when the answer matches the key
	 */
	private function isCorrect(array $question, array $answer): bool {
		$extra = $question['extraSettings'] ?? [];
		$type = $this->choiceType($question);

		// A conditional question arrives as its trigger's answer alongside the answers inside
		// it; only the trigger is graded.
		if (array_key_exists('trigger', $answer)) {
			$answer = (array)$answer['trigger'];
		}
		// Anything nested, such as a grid's rows, cannot match a key of plain values.
		foreach ($answer as $value) {
			if (!is_scalar($value)) {
				return false;
			}
		}

		if (!empty($extra['correctOptions'])) {
			$expected = array_map('strval', (array)$extra['correctOptions']);
			$given = array_map('strval', $answer);
			sort($expected);
			sort($given);

			// Single-answer types are correct if the chosen option is in the key; multi-answer
			// types must match the key exactly, otherwise ticking every box would score.
			if (in_array($type, [
				Constants::ANSWER_TYPE_MULTIPLEUNIQUE,
				Constants::ANSWER_TYPE_DROPDOWN,
			], true)) {
				return count($given) === 1 && in_array($given[0], $expected, true);
			}
			return $given === $expected;
		}

		$expected = (string)($extra['correctAnswer'] ?? '');
		$given = (string)($answer[0] ?? '');

		if ($type === Constants::ANSWER_TYPE_NUMBER
			|| $type === Constants::ANSWER_TYPE_LINEARSCALE
			|| $type === Constants::ANSWER_TYPE_RATING) {
			// Compare numerically so "3" and "3.0" agree.
			return is_numeric($given) && is_numeric($expected)
				&& abs((float)$given - (float)$expected) < 0.000001;
		}

		if (!empty($extra['caseSensitive'])) {
			return trim($given) === trim($expected);
		}
		return mb_strtolower(trim($given)) === mb_strtolower(trim($expected));
	}
}
