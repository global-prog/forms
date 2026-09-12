<?php

declare(strict_types=1);
/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\Service;

use OCA\Forms\Db\Form;
use OCP\IConfig;
use Psr\Log\LoggerInterface;

/**
 * An unfinished response, kept until it is sent.
 *
 * The browser already remembers what was typed, but only that browser: a long form begun
 * on a phone was begun again from nothing on a desktop. A draft is therefore kept for the
 * respondent, on the server, and cleared the moment the response is sent.
 *
 * It lives in the respondent's own preferences rather than a table of its own, so it needs
 * no schema change, is removed with the account, and is readable by nobody else - not even
 * the form's owner, who sees a response only once it is submitted.
 *
 * A form that stores its responses anonymously keeps no draft at all: a draft is stored
 * under the respondent's name, and holding their unsent answers under it would undo the
 * promise the form makes.
 */
class DraftService {
	/** Longer than any reasonable set of answers, and small enough not to abuse the column. */
	private const MAX_LENGTH = 64000;

	public function __construct(
		private readonly IConfig $config,
		private readonly LoggerInterface $logger,
	) {
	}

	/**
	 * May this form keep drafts for this respondent?
	 *
	 * @param Form $form the form
	 * @param ?string $userId who is answering, or null when nobody is signed in
	 * @return bool true when a draft may be kept
	 */
	public function isAllowed(Form $form, ?string $userId): bool {
		return $userId !== null && $userId !== '' && !$form->getIsAnonymous();
	}

	/**
	 * The answers kept for this respondent, if any.
	 *
	 * @param string $userId whose draft
	 * @param int $formId which form
	 * @return array the answers, keyed by question id; empty when there is no draft
	 */
	public function read(string $userId, int $formId): array {
		$stored = $this->config->getUserValue($userId, 'forms', $this->key($formId), '');
		if ($stored === '') {
			return [];
		}
		try {
			$answers = json_decode($stored, true, 32, JSON_THROW_ON_ERROR);
		} catch (\JsonException $e) {
			$this->logger->debug('Unreadable draft, ignoring it', [
				'formId' => $formId,
				'exception' => $e,
			]);
			return [];
		}
		return is_array($answers) ? $answers : [];
	}

	/**
	 * Keep these answers until the response is sent.
	 *
	 * @param string $userId whose draft
	 * @param int $formId which form
	 * @param array $answers the answers so far, keyed by question id
	 * @return bool true when it was kept; false when it was too large to keep
	 */
	public function write(string $userId, int $formId, array $answers): bool {
		if ($answers === []) {
			$this->clear($userId, $formId);
			return true;
		}
		$encoded = json_encode($answers);
		if ($encoded === false || strlen($encoded) > self::MAX_LENGTH) {
			return false;
		}
		$this->config->setUserValue($userId, 'forms', $this->key($formId), $encoded);
		return true;
	}

	/**
	 * Forget the draft, as the response has been sent or the form cleared.
	 *
	 * @param string $userId whose draft
	 * @param int $formId which form
	 */
	public function clear(string $userId, int $formId): void {
		$this->config->deleteUserValue($userId, 'forms', $this->key($formId));
	}

	/**
	 * @param int $formId which form
	 * @return string where the draft is kept
	 */
	private function key(int $formId): string {
		return 'draft.' . $formId;
	}
}
