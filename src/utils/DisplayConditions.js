/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * client-side mirror of SubmissionService::evaluateBranchConditions() and
 * ::isQuestionVisible(), used to show and hide questions live as answers change.
 *
 * The SERVER remains authoritative -- it re-evaluates the same rules when validating a
 * submission, so a disagreement here can never be used to skip a required question. It
 * can still hurt: a question hidden here but visible there is required without ever having
 * been shown, and the whole submission is refused. Keep the two in exact sync.
 */

/** Measures answers in bytes, as the server's length limit does */
const utf8 = new TextEncoder()

/**
 * Storage format of each date-like answer, as fixed-width strings. Answers and bounds share
 * the format, so comparing them as strings orders them correctly. Mirrors
 * Constants::ANSWER_PHPDATETIME_FORMAT on the server.
 */
export const DATE_STORAGE_FORMATS = {
	date: { moment: 'YYYY-MM-DD', pattern: /^\d{4}-\d{2}-\d{2}$/ },
	datetime: {
		moment: 'YYYY-MM-DD HH:mm',
		pattern: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
	},
	time: { moment: 'HH:mm', pattern: /^\d{2}:\d{2}$/ },
}

/**
 * Turn a stored pattern into a RegExp the same way the server reads it: a pattern written
 * as /body/flags keeps its flags (only i, m and s, which both engines treat alike), anything
 * else is taken as the body alone.
 *
 * The server always matches in UTF-8 mode, so the body is compiled with u first; a body that
 * u mode rejects but the server accepts (such as \- outside a class) is read without it.
 * Some dialect gaps remain: PCRE's \p{Arabic} is written \p{Script=Arabic} here, and
 * neither engine reads the other's spelling.
 *
 * @param {string} pattern the stored pattern
 * @return {RegExp|null} the expression, or null when the pattern is empty or not valid
 */
export function compilePattern(pattern) {
	if (typeof pattern !== 'string' || pattern === '') {
		return null
	}
	const delimited = pattern.match(/^\/(.*)\/([ims]*)$/s)
	const body = delimited ? delimited[1] : pattern
	const flags = delimited ? [...new Set(delimited[2])].join('') : ''
	try {
		// Without u, \p{..} and \u{..} are read as literal text and an astral character
		// as two halves, where the server sees one character.
		return new RegExp(body, flags + 'u')
	} catch {
		try {
			return new RegExp(body, flags)
		} catch {
			return null
		}
	}
}

/**
 * Read a condition's number the way PHP's (float) cast does: leading digits count, and
 * anything without them, a missing value included, is 0.
 *
 * @param {number|string|boolean|null|undefined} value the stored value
 * @return {number} the number
 */
function toFloat(value) {
	if (typeof value === 'number') {
		return isNaN(value) ? 0 : value
	}
	if (typeof value === 'boolean') {
		return value ? 1 : 0
	}
	const parsed = parseFloat(value)
	return isNaN(parsed) ? 0 : parsed
}

/**
 * Read a range bound the way the server does: only a real number limits the range, and
 * anything else, a cleared field stored as '' included, leaves that side open.
 *
 * @param {number|string|null|undefined} value the stored bound
 * @param {number} open the value that stands for no limit
 * @return {number} the bound
 */
function toBound(value, open) {
	if (typeof value === 'number') {
		return isFinite(value) ? value : open
	}
	if (
		typeof value === 'string'
		&& /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(value)
	) {
		return parseFloat(value)
	}
	return open
}

/**
 * Evaluate one rule's conditions against the answer to its source question.
 *
 * @param {string} sourceType answer type of the question being tested
 * @param {Array} answer the submitted values for that question
 * @param {Array} conditions the conditions to evaluate
 * @return {boolean} true when the conditions match
 */
export function evaluateConditions(sourceType, answer, conditions) {
	const values = Array.isArray(answer) ? answer : []
	if (!Array.isArray(conditions) || conditions.length === 0) {
		return false
	}
	// Option answers may arrive as numbers or strings; the server compares strings.
	const selected = values.map((value) => String(value))

	switch (sourceType) {
		case 'multiple_unique':
		case 'dropdown':
			// Single select: any listed option being selected is a match.
			return conditions.some((condition) => {
				// A single-option list is the same rule, stored as a checkbox question stores it.
				const optionId =
					condition.optionId
					?? (Array.isArray(condition.optionIds)
					&& condition.optionIds.length === 1
						? condition.optionIds[0]
						: undefined)
				return (
					optionId !== undefined
					&& optionId !== null
					&& selected.includes(String(optionId))
				)
			})

		case 'multiple':
			// Multi select: every option of a condition must be selected.
			return conditions.some((condition) => {
				// Rules saved by older editors named a single option in optionId.
				const noList =
					!condition.optionIds
					|| (Array.isArray(condition.optionIds)
						&& condition.optionIds.length === 0)
				const optionIds =
					noList
					&& condition.optionId !== undefined
					&& condition.optionId !== null
						? [condition.optionId]
						: (condition.optionIds ?? [])
				return (
					Array.isArray(optionIds)
					&& optionIds.length > 0
					&& optionIds.every((id) => selected.includes(String(id)))
				)
			})

		case 'short':
		case 'long': {
			const text = String(values[0] ?? '')
			return conditions.some((condition) => {
				const expected = String(condition.value ?? '')
				// A rule still waiting for its text matches nothing. Every text contains
				// the empty string, so it would otherwise open before anything is typed.
				if (expected === '') {
					return false
				}
				switch (condition.type ?? 'string_contains') {
					case 'string_equals':
						return text === expected
					case 'regex':
						// The server's limit counts bytes, and an Arabic letter takes two.
						return (
							utf8.encode(text).length <= 10000
							&& !!compilePattern(expected)?.test(text)
						)
					case 'string_contains':
						return text.includes(expected)
					default:
						return false
				}
			})
		}

		case 'linearscale': {
			// An unanswered scale matches nothing, as on the server.
			const number = parseFloat(values[0])
			if (isNaN(number)) {
				return false
			}
			// Missing bounds are open, and value_min/value_max fall back to `value` for
			// rules saved before the bound moved to min/max. The server reads both the same.
			const bound = toBound
			return conditions.some((condition) => {
				switch (condition.type ?? 'value_equals') {
					case 'value_not_equals':
						return number !== toFloat(condition.value)
					case 'value_range':
						return (
							number >= bound(condition.min, -Infinity)
							&& number <= bound(condition.max, Infinity)
						)
					case 'value_min':
						return (
							number
							>= bound(condition.min ?? condition.value, -Infinity)
						)
					case 'value_max':
						return (
							number
							<= bound(condition.max ?? condition.value, Infinity)
						)
					case 'value_equals':
						return number === toFloat(condition.value)
					default:
						return false
				}
			})
		}

		case 'date':
		case 'datetime':
		case 'time':
			return matchesDateRange(sourceType, values[0], conditions)

		case 'color':
			return conditions.some(
				(condition) =>
					String(values[0] ?? '').toLowerCase()
					=== String(condition.value ?? '').toLowerCase(),
			)

		case 'file': {
			// "a file was uploaded", or with fileUploaded: false, "no file was uploaded"
			const hasFile = values.length > 0 && !!values[0]
			return conditions.some(
				(condition) => (condition.fileUploaded ?? true) === hasFile,
			)
		}

		default:
			return false
	}
}

/**
 * Whether a date, date-time or time answer lies inside any condition's bounds. A bound
 * that is not in the storage format is ignored, as the server ignores it.
 *
 * @param {string} type date, datetime or time
 * @param {string} answer the stored answer
 * @param {Array} conditions the conditions, each with optional min and max
 * @return {boolean} true when the answer is inside one condition's range
 */
export function matchesDateRange(type, answer, conditions) {
	const format = DATE_STORAGE_FORMATS[type]
	if (!format || typeof answer !== 'string' || !format.pattern.test(answer)) {
		return false
	}
	const usable = (bound) => typeof bound === 'string' && format.pattern.test(bound)
	return conditions.some((condition) => {
		if (usable(condition.min) && answer < condition.min) {
			return false
		}
		if (usable(condition.max) && answer > condition.max) {
			return false
		}
		return true
	})
}

/**
 * Decide whether a question should be shown, given the answers so far.
 *
 * Mirrors SubmissionService::isQuestionVisible().
 *
 * @param {object} question the question being tested
 * @param {Record<number, object>} questionsById every question, keyed by id
 * @param {Record<number, Array>} answers answers keyed by question id
 * @return {boolean} true when the question should be shown
 */
export function isQuestionVisible(question, questionsById, answers) {
	const displayCondition = question?.extraSettings?.displayCondition
	if (!displayCondition || !Array.isArray(displayCondition.rules)) {
		return true
	}
	const rules = displayCondition.rules
	if (rules.length === 0) {
		return true
	}

	const results = rules.map((rule) => {
		const source = questionsById[rule.questionId]
		if (!source) {
			// Referenced question was deleted; treat the rule as unmet rather than
			// silently revealing the question.
			return false
		}
		return evaluateConditions(
			source.type,
			answers[rule.questionId] ?? [],
			rule.conditions ?? [],
		)
	})

	return displayCondition.match === 'any'
		? results.includes(true)
		: !results.includes(false)
}

/**
 * Where should the respondent go after this page?
 *
 * Mirrors the jump handling in SubmissionService::getReachableQuestions().
 *
 * @param {Array} questionsOnPage questions shown on the page being left
 * @param {Record<number, Array>} answers answers keyed by question id
 * @return {{target: string, questionId?: number}|null} the jump, or null for "just go next"
 */
export function resolveBranching(questionsOnPage, answers) {
	for (const question of questionsOnPage) {
		const byOption = question?.extraSettings?.branching?.byOption
		if (!byOption) {
			continue
		}
		for (const value of answers[question.id] ?? []) {
			const rule = byOption[String(value)]
			if (rule?.target) {
				return rule
			}
		}
	}
	return null
}
