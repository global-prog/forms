<?php

declare(strict_types=1);
/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\Service;

use OCA\Forms\BackgroundJob\SendOwnerNotificationJob;
use OCA\Forms\Db\Form;
use OCA\Forms\Db\Submission;
use OCP\BackgroundJob\IJobList;
use OCP\IL10N;
use OCP\IURLGenerator;
use OCP\IUserManager;
use OCP\Mail\IMailer;
use Psr\Log\LoggerInterface;

/**
 * Notify a form's owner by email when a new response arrives.
 *
 * Opt-in per form, stored in the form's settings JSON so it needed no column of its own:
 *   notifyOwner  bool    send to the form owner's account email address
 *   notifyEmails string  additional recipients, comma separated
 *
 * Nothing here is allowed to break submitting. The response is already stored by the time
 * this runs, so every failure path logs and returns rather than throwing.
 */
class OwnerNotificationService {
	public function __construct(
		private readonly IJobList $jobList,
		private readonly IUserManager $userManager,
		private readonly IURLGenerator $urlGenerator,
		private readonly IMailer $mailer,
		private readonly IL10N $l10n,
		private readonly LoggerInterface $logger,
	) {
	}

	/**
	 * Queue a notification for a newly received response, if the form asks for one.
	 *
	 * @param Form $form the form that was submitted
	 * @param Submission $submission the stored response
	 */
	public function send(Form $form, Submission $submission): void {
		try {
			$settings = $form->getSettings();
		} catch (\Exception $e) {
			$this->logger->warning('Could not read form settings for notification', [
				'exception' => $e,
				'formId' => $form->getId(),
			]);
			return;
		}

		if (empty($settings['notifyOwner']) && empty($settings['notifyEmails'])) {
			return;
		}

		$recipients = $this->resolveRecipients($form, $settings);
		if ($recipients === []) {
			$this->logger->debug('Response notification requested but no valid recipient', [
				'formId' => $form->getId(),
			]);
			return;
		}

		$title = $form->getTitle() ?: $this->l10n->t('Untitled form');
		$who = $submission->getUserId()
			? $submission->getUserId()
			: $this->l10n->t('an anonymous respondent');

		// Everything from here is wrapped: this runs inside the submission request, and URL
		// generation or the job list must never be able to turn a stored response into a
		// failed submission for the respondent.
		try {
			$this->queue($form, $recipients, $title, $who);
		} catch (\Throwable $e) {
			$this->logger->warning('Could not queue response notification', [
				'exception' => $e,
				'formId' => $form->getId(),
			]);
		}
	}

	/**
	 * @param Form $form the submitted form
	 * @param list<string> $recipients who to notify
	 * @param string $title the form title
	 * @param string $who who submitted
	 */
	private function queue(Form $form, array $recipients, string $title, string $who): void {
		$this->jobList->add(SendOwnerNotificationJob::class, [
			'recipients' => $recipients,
			'formId' => $form->getId(),
			'subject' => $this->l10n->t('New response to "%s"', [$title]),
			'body' => $this->l10n->t(
				'A new response to "%1$s" was submitted by %2$s.',
				[$title, $who],
			),
			'link' => $this->urlGenerator->getAbsoluteURL(
				$this->urlGenerator->linkToRoute('forms.page.views', [
					'hash' => $form->getHash(),
					'view' => 'results',
				]),
			),
		]);
	}

	/**
	 * Work out who should receive the notification.
	 *
	 * Invalid addresses are dropped rather than failing the whole notification, and the list
	 * is deduplicated so an owner who also lists their own address is not mailed twice.
	 *
	 * @param Form $form the submitted form
	 * @param array $settings the form's decoded settings
	 * @return list<string> valid, unique recipient addresses
	 */
	private function resolveRecipients(Form $form, array $settings): array {
		$recipients = [];

		if (!empty($settings['notifyOwner'])) {
			$owner = $this->userManager->get($form->getOwnerId());
			$ownerEmail = $owner?->getEMailAddress();
			if ($ownerEmail) {
				$recipients[] = $ownerEmail;
			} else {
				$this->logger->debug('Form owner has no email address set', [
					'formId' => $form->getId(),
				]);
			}
		}

		if (!empty($settings['notifyEmails']) && is_string($settings['notifyEmails'])) {
			foreach (explode(',', $settings['notifyEmails']) as $candidate) {
				$candidate = trim($candidate);
				if ($candidate !== '' && $this->mailer->validateMailAddress($candidate)) {
					$recipients[] = $candidate;
				}
			}
		}

		return array_values(array_unique($recipients));
	}
}
