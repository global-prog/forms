/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * Pre-filled links: a form link carrying answers, so whoever opens it finds them already
 * filled in - a class or a department chosen for them, say. Each answer is a query
 * parameter named after its question, `q<question id>`, repeated for each choice ticked.
 *
 * Choices are named by their text rather than their id, so a link can be read and written
 * by hand; an id is accepted too. Only answers a respondent could have given are taken:
 * an unknown option, a value off the scale, or a question of a type that cannot be filled
 * this way is ignored, and whatever is taken is still checked by the server on submit.
 */

/** Types whose answers name options. */
const CHOICE_TYPES = ['multiple', 'multiple_unique', 'dropdown']

/** Types that take a single choice. */
const SINGLE_CHOICE_TYPES = ['multiple_unique', 'dropdown']

/** Types answered with typed text. */
const TEXT_TYPES = ['short', 'long', 'number', 'email', 'phone', 'link']

/** Answers a link may carry, so a link cannot stuff a form. */
const MAX_VALUE_LENGTH = 1000

/** Prefix of a choice that is an "other" answer; kept in sync with lib/Constants.php. */
const OTHER_PREFIX = 'system-other-answer:'

/**
 * @param {object} question the question
 * @return {string} its query parameter
 */
export function prefillKey(question) {
	return `q${question.id}`
}

/**
 * The whole numbers a scale or rating question offers.
 *
 * @param {object} question the question
 * @return {?{low: number, high: number}} the range, or null for other types
 */
function scaleRange(question) {
	const extra = question.extraSettings ?? {}
	if (question.type === 'linearscale') {
		return { low: extra.optionsLowest ?? 1, high: extra.optionsHighest ?? 5 }
	}
	if (question.type === 'rating') {
		const max = extra.maxRating
		return {
			low: 1,
			high: typeof max === 'number' && max >= 2 && max <= 10 ? max : 5,
		}
	}
	return null
}

/**
 * Read the answers a link carries.
 *
 * @param {object[]} questions the form's questions
 * @param {string} search the link's query string, as in `location.search`
 * @return {Record<number, string[]>} answers keyed by question id, shaped as the form holds them
 */
export function answersFromQuery(questions, search) {
	const params = new URLSearchParams(search)
	const answers = {}
	for (const question of questions) {
		const given = params
			.getAll(prefillKey(question))
			.map((value) => value.trim())
			.filter((value) => value !== '' && value.length <= MAX_VALUE_LENGTH)
		if (!given.length) {
			continue
		}

		if (CHOICE_TYPES.includes(question.type)) {
			const options = question.options ?? []
			const chosen = []
			for (const value of given) {
				const option =
					options.find((candidate) => candidate.text === value)
					?? options.find((candidate) => String(candidate.id) === value)
				if (option && !chosen.includes(String(option.id))) {
					chosen.push(String(option.id))
				}
			}
			if (chosen.length) {
				answers[question.id] = SINGLE_CHOICE_TYPES.includes(question.type)
					? chosen.slice(0, 1)
					: chosen
			}
			continue
		}

		const range = scaleRange(question)
		if (range) {
			const value = Number(given[0])
			if (
				Number.isInteger(value)
				&& value >= range.low
				&& value <= range.high
			) {
				answers[question.id] = [String(value)]
			}
			continue
		}

		if (TEXT_TYPES.includes(question.type)) {
			answers[question.id] = [given[0]]
		}
	}
	return answers
}

/**
 * Write the answers given so far as a query string, for a pre-filled link.
 *
 * @param {object[]} questions the form's questions
 * @param {Record<number, unknown>} answers the answers, keyed by question id
 * @return {string} the query string, without its leading `?`; empty when nothing can be carried
 */
export function queryFromAnswers(questions, answers) {
	const params = new URLSearchParams()
	for (const question of questions) {
		const values = answers[question.id]
		if (!Array.isArray(values) || !values.length) {
			continue
		}
		const key = prefillKey(question)

		if (CHOICE_TYPES.includes(question.type)) {
			for (const value of values) {
				if (String(value).startsWith(OTHER_PREFIX)) {
					continue
				}
				const option = (question.options ?? []).find(
					(candidate) => String(candidate.id) === String(value),
				)
				if (option) {
					params.append(key, option.text)
				}
			}
			continue
		}

		if (scaleRange(question) || TEXT_TYPES.includes(question.type)) {
			const value = String(values[0] ?? '').trim()
			if (value !== '' && value.length <= MAX_VALUE_LENGTH) {
				params.append(key, value)
			}
		}
	}
	return params.toString()
}
