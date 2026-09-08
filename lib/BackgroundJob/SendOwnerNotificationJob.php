<?php

declare(strict_types=1);
/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\BackgroundJob;

use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\QueuedJob;
use OCP\Defaults;
use OCP\Mail\IMailer;
use OCP\Util;
use Psr\Log\LoggerInterface;

/**
 * Email a form's owner that a new response has arrived.
 *
 * Queued rather than sent inline: submitting a form must not wait on, or fail because of, an
 * SMTP round trip. Failures are logged and swallowed for the same reason - a response is
 * already safely stored by the time this runs, so a mail problem must never surface to the
 * respondent as a failed submission.
 */
class SendOwnerNotificationJob extends QueuedJob {
	public function __construct(
		ITimeFactory $time,
		private readonly IMailer $mailer,
		private readonly LoggerInterface $logger,
		private readonly Defaults $defaults,
	) {
		parent::__construct($time);
	}

	/**
	 * @param array{recipients: list<string>, subject: string, body: string, link: string, formId: int} $argument
	 */
	public function run($argument): void {
		$recipients = $argument['recipients'] ?? [];
		$formId = $argument['formId'] ?? 0;

		foreach ($recipients as $recipient) {
			try {
				$template = $this->mailer->createEMailTemplate('forms.OwnerNotification');
				$template->setSubject($argument['subject']);
				$template->addHeader();
				$template->addHeading($argument['subject']);
				$template->addBodyText(
					htmlspecialchars($argument['body']),
					$argument['body'],
				);
				if (!empty($argument['link'])) {
					$template->addBodyButton(
						$this->l10nSafeButtonText(),
						$argument['link'],
					);
				}
				$template->addFooter();

				$message = $this->mailer->createMessage();
				$message->setFrom([
					Util::getDefaultEmailAddress('noreply') => $this->defaults->getName(),
				]);
				$message->setTo([$recipient]);
				$message->useTemplate($template);
				$this->mailer->send($message);
			} catch (\Exception $e) {
				// One bad recipient must not stop the others.
				$this->logger->warning('Could not send response notification', [
					'exception' => $e,
					'formId' => $formId,
				]);
			}
		}
	}

	/**
	 * The mail template's button label.
	 *
	 * Kept as a method so the string is resolved when the job runs, not when it is queued -
	 * a queued job can be executed in a different locale context than the request that
	 * created it.
	 *
	 * @return string the button label
	 */
	private function l10nSafeButtonText(): string {
		return 'View responses';
	}
}
