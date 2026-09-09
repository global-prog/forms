<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2017 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\Db;

use OCA\Forms\Constants;
use OCA\Forms\ResponseDefinitions;
use OCP\AppFramework\Db\Entity;

/**
 * @psalm-import-type FormsAccess from ResponseDefinitions
 * @method string getHash()
 * @method void setHash(string $value)
 * @method string getTitle()
 * @method void setTitle(string $value)
 * @method string getDescription()
 * @method void setDescription(string $value)
 * @method string getOwnerId()
 * @method void setOwnerId(string $value)
 * @method int|null getFileId()
 * @method void setFileId(int|null $value)
 * @method string|null getFileFormat()
 * @method void setFileFormat(string|null $value)
 * @method int getCreated()
 * @method void setCreated(int $value)
 * @method int getExpires()
 * @method void setExpires(int $value)
 * @method int getIsAnonymous()
 * @method void setIsAnonymous(bool $value)
 * @method int getSubmitMultiple()
 * @method void setSubmitMultiple(bool $value)
 * @method int getAllowEditSubmissions()
 * @method void setAllowEditSubmissions(bool $value)
 * @method int getShowExpiration()
 * @method void setShowExpiration(bool $value)
 * @method int getLastUpdated()
 * @method void setLastUpdated(int $value)
 * @method string|null getSubmissionMessage()
 * @method void setSubmissionMessage(string|null $value)
 * @method int getState()
 * @psalm-method 0|1|2 getState()
 * @method void setState(int|null $value)
 * @psalm-method void setState(0|1|2|null $value)
 * @method string getLockedBy()
 * @method void setLockedBy(string|null $value)
 * @method int getLockedUntil()
 * @method int|null getMaxSubmissions()
 * @method void setMaxSubmissions(int|null $value)
 * @method void setLockedUntil(int|null $value)
 * @method bool getConfirmationEmailEnabled()
 * @method void setConfirmationEmailEnabled(bool $value)
 * @method string|null getConfirmationEmailSubject()
 * @method void setConfirmationEmailSubject(string|null $value)
 * @method string|null getConfirmationEmailBody()
 * @method void setConfirmationEmailBody(string|null $value)
 * @method int|null getConfirmationEmailQuestionId()
 * @method void setConfirmationEmailQuestionId(int|null $value)
 * @method bool getAllowComments()
 * @method void setAllowComments(bool $value)
 */
class Form extends Entity {
	protected $hash;
	protected $title;
	protected $description;
	protected $ownerId;
	protected $fileId;
	protected $fileFormat;
	protected $accessEnum;
	protected $created;
	protected $expires;
	protected $isAnonymous;
	protected $submitMultiple;
	protected $allowEditSubmissions;
	protected $showExpiration;
	protected $submissionMessage;
	protected $lastUpdated;
	protected $state;
	protected $lockedBy;
	protected $lockedUntil;
	protected $maxSubmissions;
	protected $confirmationEmailEnabled;
	protected $confirmationEmailSubject;
	protected $confirmationEmailBody;
	protected $confirmationEmailQuestionId;
	protected $allowComments;

	/**
	 * Optional form-level settings, stored as JSON so new options need no schema change.
	 * See getSettings()/setSettings().
	 */
	protected $settingsJson;

	/**
	 * Form constructor.
	 */
	public function __construct() {
		$this->addType('created', 'integer');
		$this->addType('expires', 'integer');
		$this->addType('isAnonymous', 'boolean');
		$this->addType('submitMultiple', 'boolean');
		$this->addType('allowEditSubmissions', 'boolean');
		$this->addType('showExpiration', 'boolean');
		$this->addType('lastUpdated', 'integer');
		$this->addType('state', 'integer');
		$this->addType('lockedBy', 'string');
		$this->addType('lockedUntil', 'integer');
		$this->addType('maxSubmissions', 'integer');
		$this->addType('confirmationEmailEnabled', 'boolean');
		$this->addType('confirmationEmailQuestionId', 'integer');
		$this->addType('allowComments', 'boolean');
	}

	// JSON-Decoding of access-column.

	/**
	 * @return FormsAccess
	 */
	public function getAccess(): array {
		$accessEnum = $this->getAccessEnum();
		$access = [];

		switch ($accessEnum) {
			case Constants::FORM_ACCESS_NOPUBLICSHARE:
				$access['permitAllUsers'] = false;
				$access['showToAllUsers'] = false;
				break;
			case Constants::FORM_ACCESS_PERMITALLUSERS:
				$access['permitAllUsers'] = true;
				$access['showToAllUsers'] = false;
				break;
			case Constants::FORM_ACCESS_SHOWTOALLUSERS:
				$access['permitAllUsers'] = true;
				$access['showToAllUsers'] = true;
				break;
		}

		return $access;
	}

	// JSON-Encoding of access-column.

	/**
	 * @param FormsAccess $access
	 */
	public function setAccess(array $access): void {
		// No further permissions -> 0
		// Permit all users, but don't show in navigation -> 1
		// Permit all users and show in navigation -> 2
		if (!$access['permitAllUsers']) {
			// no permit means no public share
			$value = Constants::FORM_ACCESS_NOPUBLICSHARE;
		} elseif ($access['showToAllUsers']) {
			// permit all + show to all
			$value = Constants::FORM_ACCESS_SHOWTOALLUSERS;
		} else {
			// only permit all but not shown to all
			$value = Constants::FORM_ACCESS_PERMITALLUSERS;
		}

		$this->setAccessEnum($value);
	}

	/**
	 * @return array{
	 *   id: int,
	 *   hash: string,
	 *   title: string,
	 *   description: string,
	 *   ownerId: string,
	 *   fileId: ?int,
	 *   fileFormat: ?string,
	 *   created: int,
	 *   access: FormsAccess,
	 *   expires: int,
	 *   isAnonymous: bool,
	 *   submitMultiple: bool,
	 *   allowEditSubmissions: bool,
	 *   showExpiration: bool,
	 *   lastUpdated: int,
	 *   submissionMessage: ?string,
	 *   state: 0|1|2,
	 *   lockedBy: ?string,
	 *   lockedUntil: ?int,
	 *   maxSubmissions: ?int,
	 *   confirmationEmailEnabled: bool,
	 *   confirmationEmailSubject: ?string,
	 *   confirmationEmailBody: ?string,
	 *   confirmationEmailQuestionId: ?int,
	 *   allowComments: bool,
	 *  }
	 */
	/**
	 * Decoded form-level settings. Always an array, even when the column is NULL.
	 *
	 * Recognised keys:
	 *   notifyOwner       bool   email the owner on every new submission
	 *   notifyEmails      string extra recipients, comma separated
	 *   language          string pin the form to a language, or '' to follow the reader
	 *
	 * Malformed JSON returns no settings rather than throwing. This is read on every
	 * form load, including the public submit page, so a single bad row must not make a
	 * form unopenable -- the worst case is that its optional settings are ignored.
	 *
	 * @return array the decoded settings
	 */
	public function getSettings(): array {
		try {
			$settings = json_decode($this->getSettingsJson() ?: '{}', true, 512, JSON_THROW_ON_ERROR);
		} catch (\JsonException $e) {
			return [];
		}
		return is_array($settings) ? $settings : [];
	}

	/**
	 * The language this form is pinned to, or '' to follow whoever is reading it.
	 *
	 * An unrecognised value reads as the default rather than being passed through, so a
	 * stored value that is no longer supported degrades to following the reader.
	 *
	 * @return string a supported language code, or ''
	 */
	public function getLanguage(): string {
		$language = $this->getSettings()['language'] ?? Constants::FORM_LANGUAGE_DEFAULT;
		return is_string($language) && in_array($language, Constants::FORM_LANGUAGES, true)
			? $language
			: Constants::FORM_LANGUAGE_DEFAULT;
	}

	/**
	 * @param array $settings the settings to store
	 */
	public function setSettings(array $settings): void {
		// Drop empty values so the column stays small and an unset option reads as absent
		// rather than as an explicit false.
		foreach ($settings as $key => $value) {
			if ($value === null || $value === '' || $value === false) {
				unset($settings[$key]);
			}
		}
		$this->setSettingsJson(json_encode($settings, JSON_THROW_ON_ERROR | JSON_FORCE_OBJECT));
	}

	public function read() {
		return [
			'id' => $this->getId(),
			'hash' => $this->getHash(),
			'title' => (string)$this->getTitle(),
			'description' => (string)$this->getDescription(),
			'ownerId' => $this->getOwnerId(),
			'fileId' => $this->getFileId(),
			'fileFormat' => $this->getFileFormat(),
			'created' => $this->getCreated(),
			'access' => $this->getAccess(),
			'expires' => (int)$this->getExpires(),
			'isAnonymous' => (bool)$this->getIsAnonymous(),
			'submitMultiple' => (bool)$this->getSubmitMultiple(),
			'allowEditSubmissions' => (bool)$this->getAllowEditSubmissions(),
			'showExpiration' => (bool)$this->getShowExpiration(),
			'lastUpdated' => (int)$this->getLastUpdated(),
			'submissionMessage' => $this->getSubmissionMessage(),
			'state' => $this->getState(),
			'lockedBy' => $this->getLockedBy(),
			'lockedUntil' => $this->getLockedUntil(),
			'maxSubmissions' => $this->getMaxSubmissions(),
			'confirmationEmailEnabled' => (bool)$this->getConfirmationEmailEnabled(),
			'confirmationEmailSubject' => $this->getConfirmationEmailSubject(),
			'confirmationEmailBody' => $this->getConfirmationEmailBody(),
			'confirmationEmailQuestionId' => $this->getConfirmationEmailQuestionId(),
			'allowComments' => (bool)$this->getAllowComments(),
			'settings' => $this->getSettings(),
		];
	}
}
