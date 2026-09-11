<?php

/**
 * SPDX-FileCopyrightText: 2021-2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms;

use OCP\Share\IShare;

class Constants {
	/**
	 * Used AppConfig Keys
	 */
	public const CONFIG_KEY_ALLOWPERMITALL = 'allowPermitAll';
	public const CONFIG_KEY_ALLOWPUBLICLINK = 'allowPublicLink';
	public const CONFIG_KEY_ALLOWSHOWTOALL = 'allowShowToAll';
	public const CONFIG_KEY_CREATIONALLOWEDGROUPS = 'creationAllowedGroups';
	public const CONFIG_KEY_RESTRICTCREATION = 'restrictCreation';
	public const CONFIG_KEY_ALLOWCONFIRMATIONEMAIL = 'allowConfirmationEmail';
	public const CONFIG_KEY_CONFIRMATIONEMAILRATELIMIT = 'confirmationEmailRateLimit';
	public const CONFIG_KEY_ALLOWCOMMENTS = 'allowComments';
	public const CONFIG_KEYS = [
		self::CONFIG_KEY_ALLOWPERMITALL,
		self::CONFIG_KEY_ALLOWPUBLICLINK,
		self::CONFIG_KEY_ALLOWSHOWTOALL,
		self::CONFIG_KEY_CREATIONALLOWEDGROUPS,
		self::CONFIG_KEY_RESTRICTCREATION,
		self::CONFIG_KEY_ALLOWCONFIRMATIONEMAIL,
		self::CONFIG_KEY_CONFIRMATIONEMAILRATELIMIT,
		self::CONFIG_KEY_ALLOWCOMMENTS,
	];
	public const CONFIG_KEY_TYPES = [
		self::CONFIG_KEY_ALLOWPERMITALL => 'bool',
		self::CONFIG_KEY_ALLOWPUBLICLINK => 'bool',
		self::CONFIG_KEY_ALLOWSHOWTOALL => 'bool',
		self::CONFIG_KEY_RESTRICTCREATION => 'bool',
		self::CONFIG_KEY_ALLOWCONFIRMATIONEMAIL => 'bool',
		self::CONFIG_KEY_CREATIONALLOWEDGROUPS => 'array',
		self::CONFIG_KEY_CONFIRMATIONEMAILRATELIMIT => 'int',
	];

	/**
	 * Maximum String lengths, the database is set to store.
	 */
	public const MAX_STRING_LENGTHS = [
		'formTitle' => 256,
		'formDescription' => 8192,
		'submissionMessage' => 2048,
		'confirmationEmailSubject' => 255,
		'confirmationEmailBody' => 8192,
		'questionText' => 2048,
		'questionDescription' => 4096,
		'optionText' => 1024,
		'answerText' => 4096,
	];

	/**
	 * State flags of a form
	 */
	public const FORM_STATE_ACTIVE = 0;
	public const FORM_STATE_CLOSED = 1;
	public const FORM_STATE_ARCHIVED = 2;

	/**
	 * Access flags of a form
	 */
	public const FORM_ACCESS_NOPUBLICSHARE = 0;
	public const FORM_ACCESS_PERMITALLUSERS = 1;
	public const FORM_ACCESS_SHOWTOALLUSERS = 2;
	/** @deprecated 5.0.0 still needed for Migrations */
	public const FORM_ACCESS_LEGACYLINK = 3;
	public const FORM_ACCESS_ARRAY_PERMIT = [
		self::FORM_ACCESS_PERMITALLUSERS,
	];
	public const FORM_ACCESS_ARRAY_SHOWN = [
		self::FORM_ACCESS_SHOWTOALLUSERS,
	];

	/**
	 * !! Keep in sync with src/models/AnswerTypes.js !!
	 */

	// Available AnswerTypes
	public const ANSWER_TYPE_COLOR = 'color';
	public const ANSWER_TYPE_CONDITIONAL = 'conditional';
	public const ANSWER_TYPE_DATE = 'date';
	public const ANSWER_TYPE_DATETIME = 'datetime';
	public const ANSWER_TYPE_DROPDOWN = 'dropdown';
	public const ANSWER_TYPE_FILE = 'file';
	public const ANSWER_TYPE_GRID = 'grid';
	public const ANSWER_TYPE_LINEARSCALE = 'linearscale';
	public const ANSWER_TYPE_LONG = 'long';
	public const ANSWER_TYPE_MULTIPLE = 'multiple';
	public const ANSWER_TYPE_MULTIPLEUNIQUE = 'multiple_unique';
	public const ANSWER_TYPE_RANKING = 'ranking';
	// a display-only "question" that groups the ones after it. Deliberately modelled as
	// an answer type rather than a new table: it lives in oc_forms_v2_questions using the
	// existing `order` column, so it needs NO migration and cannot collide with whatever
	// schema upstream eventually ships for issue #624.
	public const ANSWER_TYPE_SECTION = 'section';
	// a first-class Number question. The numeric constraints already existed, but only
	// as a validation mode hidden inside the short-text input-type menu, so nobody could pick
	// "Number" when adding a question.
	public const ANSWER_TYPE_NUMBER = 'number';
	// star rating (upstream issue #356). linearscale covers 1..N as radio buttons; this
	// is the compact star widget people expect from Google Forms.
	public const ANSWER_TYPE_RATING = 'rating';
	// Display-only media blocks, modelled like sections: ordinary question rows that carry
	// no answer, so they need no schema change and add no column to an export.
	public const ANSWER_TYPE_IMAGE = 'image';
	public const ANSWER_TYPE_VIDEO = 'video';
	public const ANSWER_TYPE_SHORT = 'short';
	public const ANSWER_TYPE_TIME = 'time';

	public const ANSWER_GRID_TYPE_CHECKBOX = 'checkbox';
	public const ANSWER_GRID_TYPE_NUMBER = 'number';
	public const ANSWER_GRID_TYPE_RADIO = 'radio';

	// All AnswerTypes
	public const ANSWER_TYPES = [
		self::ANSWER_TYPE_COLOR,
		self::ANSWER_TYPE_CONDITIONAL,
		self::ANSWER_TYPE_DATE,
		self::ANSWER_TYPE_DATETIME,
		self::ANSWER_TYPE_DROPDOWN,
		self::ANSWER_TYPE_FILE,
		self::ANSWER_TYPE_GRID,
		self::ANSWER_TYPE_LINEARSCALE,
		self::ANSWER_TYPE_LONG,
		self::ANSWER_TYPE_MULTIPLE,
		self::ANSWER_TYPE_MULTIPLEUNIQUE,
		self::ANSWER_TYPE_RANKING,
		self::ANSWER_TYPE_SECTION,
		self::ANSWER_TYPE_NUMBER,
		self::ANSWER_TYPE_RATING,
		self::ANSWER_TYPE_IMAGE,
		self::ANSWER_TYPE_VIDEO,
		self::ANSWER_TYPE_SHORT,
		self::ANSWER_TYPE_TIME,
	];

	// AnswerTypes, that need/have predefined Options
	public const ANSWER_TYPES_PREDEFINED = [
		self::ANSWER_TYPE_DROPDOWN,
		self::ANSWER_TYPE_LINEARSCALE,
		self::ANSWER_TYPE_GRID,
		self::ANSWER_TYPE_MULTIPLE,
		self::ANSWER_TYPE_MULTIPLEUNIQUE,
		self::ANSWER_TYPE_RANKING,
	];

	// AnswerTypes for date/time questions
	public const ANSWER_TYPES_DATETIME = [
		self::ANSWER_TYPE_DATE,
		self::ANSWER_TYPE_DATETIME,
		self::ANSWER_TYPE_TIME
	];

	// Formats for AnswerTypes date/datetime/time
	public const ANSWER_PHPDATETIME_FORMAT = [
		self::ANSWER_TYPE_DATE => 'Y-m-d',
		self::ANSWER_TYPE_DATETIME => 'Y-m-d H:i',
		self::ANSWER_TYPE_TIME => 'H:i'
	];

	/**
	 * !! Keep in sync with src/models/ValidationTypes.js !!
	 */

	// Allowed short input types
	public const SHORT_INPUT_TYPES = [
		'phone',
		'email',
		'regex',
		'number'
	];

	// This are allowed extra settings
	public const EXTRA_SETTINGS_DROPDOWN = [
		'allowOtherAnswer' => ['boolean'],
		'shuffleOptions' => ['boolean'],
	];

	public const EXTRA_SETTINGS_MULTIPLE = [
		'allowOtherAnswer' => ['boolean'],
		'optionsLimitMax' => ['integer'],
		'optionsLimitMin' => ['integer'],
		'shuffleOptions' => ['boolean'],
	];

	public const EXTRA_SETTINGS_SHORT = [
		'validationType' => ['string'],
		'validationRegex' => ['string'],
		// numeric constraints for validationType='number'. Upstream only checks
		// is_numeric(), so "a number between 1 and 10" or "a whole number" was not
		// expressible. JSON numbers decode as int or float, hence integer+double.
		'numberMin' => ['integer', 'double', 'NULL'],
		'numberMax' => ['integer', 'double', 'NULL'],
		'numberInteger' => ['boolean', 'NULL'],
	];

	public const EXTRA_SETTINGS_FILE = [
		'allowedFileTypes' => ['array'],
		'allowedFileExtensions' => ['array'],
		'maxAllowedFilesCount' => ['integer'],
		'maxFileSize' => ['integer'],
	];

	public const EXTRA_SETTINGS_DATE = [
		'dateMax' => ['integer', 'NULL'],
		'dateMin' => ['integer', 'NULL'],
		'dateRange' => ['boolean', 'NULL'],
	];

	public const EXTRA_SETTINGS_TIME = [
		'timeMax' => ['string', 'NULL'],
		'timeMin' => ['string', 'NULL'],
		'timeRange' => ['boolean', 'NULL'],
	];

	// should be in sync with FileTypes.js
	public const EXTRA_SETTINGS_ALLOWED_FILE_TYPES = [
		'image',
		'x-office/document',
		'x-office/presentation',
		'x-office/spreadsheet',
	];

	public const EXTRA_SETTINGS_LINEARSCALE = [
		'optionsLowest' => ['integer', 'NULL'],
		'optionsHighest' => ['integer', 'NULL'],
		'optionsLabelLowest' => ['string', 'NULL'],
		'optionsLabelHighest' => ['string', 'NULL'],
	];

	public const EXTRA_SETTINGS_GRID = [
		'columns' => ['array'],
		'questionType' => ['string'],
		'rows' => ['array'],
	];

	// a section can either just print a heading, or additionally start a new page in the
	// submit view. pageBreak defaults to true -- "section break" is what people ask for.
	/**
	 * extra settings permitted on EVERY question type, whatever its answer type.
	 *
	 * displayCondition -- show this question only when an earlier question matches:
	 *   { match: "all"|"any", rules: [ { questionId: int, conditions: [...] } ] }
	 *   The conditions reuse the exact shapes branches already use, so there is only one
	 *   condition engine (SubmissionService::evaluateBranchConditions).
	 *
	 * branching -- where each answer sends the respondent ("go to section" / "submit"):
	 *   { byOption: { "<optionId>": { target: "section", questionId: int }
	 *                              | { target: "submit" } } }
	 *
	 * Both live in extra_settings_json, so neither needs a schema change.
	 */
	public const EXTRA_SETTINGS_UNIVERSAL = [
		'displayCondition' => ['array', 'NULL'],
		'branching' => ['array', 'NULL'],
		// Quiz answer key. Kept per question rather than in a table of its own, so quiz
		// mode needs no schema change:
		//   points            how much a correct answer is worth (default 1)
		//   correctOptions    option ids that make a choice question correct
		//   correctAnswer     the expected value for text and number questions
		//   caseSensitive     whether a text answer must match case (default false)
		//   feedbackCorrect   shown to the respondent when they got it right
		//   feedbackIncorrect shown when they did not
		'points' => ['integer', 'double', 'NULL'],
		'correctOptions' => ['array', 'NULL'],
		'correctAnswer' => ['string', 'NULL'],
		'caseSensitive' => ['boolean', 'NULL'],
		'feedbackCorrect' => ['string', 'NULL'],
		'feedbackIncorrect' => ['string', 'NULL'],
	];

	/**
	 * The parts of a question's settings that give a quiz away: the answer key, and the
	 * feedback, which names the right answer as often as not. Only people who can edit the
	 * form are sent them; a respondent learns them from their graded result, if at all.
	 */
	public const QUIZ_KEY_SETTINGS = [
		'correctOptions',
		'correctAnswer',
		'feedbackCorrect',
		'feedbackIncorrect',
	];

	/**
	 * Media blocks reference a URL.
	 *
	 * Note for anyone extending this: an externally hosted image or video means the
	 * respondent's browser contacts that third party, disclosing their IP address. Prefer
	 * URLs on this instance.
	 */
	public const EXTRA_SETTINGS_MEDIA = [
		'url' => ['string', 'NULL'],
		'alt' => ['string', 'NULL'],
	];

	// how many stars a rating question offers (defaults to 5).
	public const EXTRA_SETTINGS_RATING = [
		'maxRating' => ['integer', 'NULL'],
		// 'star' (default), 'heart' or 'thumb'
		'ratingIcon' => ['string', 'NULL'],
	];

	// same constraints the short-text number validation uses.
	public const EXTRA_SETTINGS_NUMBER = [
		'numberMin' => ['integer', 'double', 'NULL'],
		'numberMax' => ['integer', 'double', 'NULL'],
		'numberInteger' => ['boolean', 'NULL'],
	];

	public const EXTRA_SETTINGS_SECTION = [
		'pageBreak' => ['boolean', 'NULL'],
	];

	public const EXTRA_SETTINGS_RANKING = [
		'shuffleOptions' => ['boolean'],
	];

	public const EXTRA_SETTINGS_GRID_QUESTION_TYPE = [
		self::ANSWER_GRID_TYPE_CHECKBOX,
		self::ANSWER_GRID_TYPE_NUMBER,
		self::ANSWER_GRID_TYPE_RADIO,
	];

	/**
	 * Extra settings for conditional questions
	 * - triggerType: The question type used for the trigger (e.g., 'multiple_unique', 'dropdown', 'short')
	 * - branches: Array of branch definitions, each containing:
	 *   - id: Unique branch identifier
	 *   - conditions: Array of condition objects defining when this branch is active
	 *     For predefined types: [{ optionId: number }]
	 *     For text types: [{ type: 'string_equals'|'string_contains'|'regex', value: string }]
	 *     For numeric/scale: [{ type: 'value_equals'|'value_range', value: number, min?: number, max?: number }]
	 */
	public const EXTRA_SETTINGS_CONDITIONAL = [
		'triggerType' => ['string'],
		'branches' => ['array'],
	];

	/**
	 * Condition types for conditional questions
	 */
	public const CONDITION_TYPE_OPTION_SELECTED = 'option_selected';
	public const CONDITION_TYPE_OPTIONS_COMBINATION = 'options_combination';
	public const CONDITION_TYPE_STRING_EQUALS = 'string_equals';
	public const CONDITION_TYPE_STRING_CONTAINS = 'string_contains';
	public const CONDITION_TYPE_REGEX = 'regex';
	public const CONDITION_TYPE_VALUE_EQUALS = 'value_equals';
	public const CONDITION_TYPE_VALUE_NOT_EQUALS = 'value_not_equals';
	public const CONDITION_TYPE_VALUE_RANGE = 'value_range';
	public const CONDITION_TYPE_VALUE_MIN = 'value_min';
	public const CONDITION_TYPE_VALUE_MAX = 'value_max';
	public const CONDITION_TYPE_DATE_RANGE = 'date_range';
	public const CONDITION_TYPE_FILE_UPLOADED = 'file_uploaded';

	public const CONDITION_TYPES = [
		self::CONDITION_TYPE_OPTION_SELECTED,
		self::CONDITION_TYPE_OPTIONS_COMBINATION,
		self::CONDITION_TYPE_STRING_EQUALS,
		self::CONDITION_TYPE_STRING_CONTAINS,
		self::CONDITION_TYPE_REGEX,
		self::CONDITION_TYPE_VALUE_EQUALS,
		self::CONDITION_TYPE_VALUE_NOT_EQUALS,
		self::CONDITION_TYPE_VALUE_RANGE,
		self::CONDITION_TYPE_VALUE_MIN,
		self::CONDITION_TYPE_VALUE_MAX,
		self::CONDITION_TYPE_DATE_RANGE,
		self::CONDITION_TYPE_FILE_UPLOADED,
	];

	/**
	 * Trigger types allowed for conditional questions
	 * Maps each trigger type to its supported condition types
	 */
	public const CONDITIONAL_TRIGGER_TYPES = [
		self::ANSWER_TYPE_MULTIPLEUNIQUE => [self::CONDITION_TYPE_OPTION_SELECTED],
		self::ANSWER_TYPE_DROPDOWN => [self::CONDITION_TYPE_OPTION_SELECTED],
		self::ANSWER_TYPE_MULTIPLE => [self::CONDITION_TYPE_OPTIONS_COMBINATION],
		self::ANSWER_TYPE_SHORT => [self::CONDITION_TYPE_STRING_EQUALS, self::CONDITION_TYPE_STRING_CONTAINS, self::CONDITION_TYPE_REGEX],
		self::ANSWER_TYPE_LONG => [self::CONDITION_TYPE_STRING_CONTAINS, self::CONDITION_TYPE_REGEX],
		self::ANSWER_TYPE_LINEARSCALE => [self::CONDITION_TYPE_VALUE_EQUALS, self::CONDITION_TYPE_VALUE_NOT_EQUALS, self::CONDITION_TYPE_VALUE_RANGE, self::CONDITION_TYPE_VALUE_MIN, self::CONDITION_TYPE_VALUE_MAX],
		self::ANSWER_TYPE_DATE => [self::CONDITION_TYPE_DATE_RANGE],
		self::ANSWER_TYPE_DATETIME => [self::CONDITION_TYPE_DATE_RANGE],
		self::ANSWER_TYPE_TIME => [self::CONDITION_TYPE_VALUE_RANGE],
		self::ANSWER_TYPE_COLOR => [self::CONDITION_TYPE_VALUE_EQUALS],
		self::ANSWER_TYPE_FILE => [self::CONDITION_TYPE_FILE_UPLOADED],
	];

	public const FILENAME_INVALID_CHARS = [
		"\n",
		'/',
		'\\',
		':',
		'*',
		'?',
		'"',
		'<',
		'>',
		'|',
	];

	/**
	 * !! Keep in sync with src/mixins/ShareTypes.js !!
	 */
	public const SHARE_TYPES_USED = [
		IShare::TYPE_CIRCLE,
		IShare::TYPE_GROUP,
		IShare::TYPE_LINK,
		IShare::TYPE_USER,
	];

	/**
	 * !! Keep in sync with src/mixins/PermissionTypes.js !!
	 * Permission values equal the route names, thus making it easy on frontend to evaluate.
	 */
	// Define Form Permissions
	public const PERMISSION_EDIT = 'edit';
	public const PERMISSION_RESULTS = 'results';
	public const PERMISSION_RESULTS_DELETE = 'results_delete';
	public const PERMISSION_SUBMIT = 'submit';
	/** Special internal permissions to allow embedding a form (share) into external websites */
	public const PERMISSION_EMBED = 'embed';

	public const PERMISSION_ALL = [
		self::PERMISSION_EDIT,
		self::PERMISSION_EMBED,
		self::PERMISSION_RESULTS,
		self::PERMISSION_RESULTS_DELETE,
		self::PERMISSION_SUBMIT,
	];

	/**
	 * !! Keep in sync with src/FormsEmptyContent.vue !!
	 * InitialStates for emptyContent to render as...
	 */
	public const EMPTY_EXPIRED = 'expired';
	public const EMPTY_NOTFOUND = 'notfound';

	/**
	 * Constants related to extra settings for questions
	 */
	public const QUESTION_EXTRASETTINGS_OTHER_PREFIX = 'system-other-answer:';

	/**
	 * Maximum number of submissions returned per paginated API request.
	 */
	public const SUBMISSIONS_LIMIT_MAX = 1000;

	public const SUPPORTED_EXPORT_FORMATS = [
		'csv' => 'text/csv',
		'ods' => 'application/vnd.oasis.opendocument.spreadsheet',
		'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	];

	public const DEFAULT_FILE_FORMAT = 'csv';

	public const UNSUBMITTED_FILES_FOLDER = self::FILES_FOLDER . '/unsubmitted';

	public const FILES_FOLDER = 'Forms';

	/**
	 * Languages a form may be pinned to.
	 *
	 * A form shared by public link is usually opened by people who are not logged in, so
	 * the server cannot know their language and falls back to the instance default. A form
	 * written in Arabic then renders left to right, which is the problem this solves.
	 *
	 * The empty value means "follow whoever is reading it", and stays the default: that is
	 * the right behaviour for a form shared inside the instance, where the reader's own
	 * language is known and is the one they want.
	 */
	public const FORM_LANGUAGE_DEFAULT = '';

	public const FORM_LANGUAGES = [
		self::FORM_LANGUAGE_DEFAULT,
		'ar',
		'en',
	];

	/**
	 * Every setting that may be stored in forms_v2_forms.settings_json, and its type.
	 *
	 * The column is free-form JSON, and the form update endpoint passes whatever it is
	 * given straight to a setter, so without this list any client able to edit a form
	 * could write arbitrary keys and unbounded values into it.
	 */
	public const FORM_SETTINGS = [
		'quizMode' => 'boolean',
		'shuffleQuestions' => 'boolean',
		'headerImage' => 'string',
		'accentColor' => 'string',
		'notifyOwner' => 'boolean',
		'notifyEmails' => 'string',
		'language' => 'string',
	];

	/**
	 * Cap on any single string held in settings_json. Generous for an address or a list
	 * of recipients, and small enough that the column cannot be used as storage.
	 */
	public const FORM_SETTINGS_MAX_STRING = 2048;
}
