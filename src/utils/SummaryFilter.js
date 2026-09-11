/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * Narrowing a summary to the responses that gave one answer: everyone who chose
 * "Engineering", say, so each chart below describes that group alone.
 *
 * Only questions with a fixed set of answers can filter - a choice, a scale or a rating -
 * since those are the answers a group can be named by. A response is kept when it gave
 * the chosen answer to the chosen question; answers are compared as stored, which is an
 * option's text for a choice and the number for a scale or a rating.
 */

/** Choice types, whose stored answers are option texts. */
const CHOICE_TYPES = ['multiple', 'multiple_unique', 'dropdown']

/**
 * The answers a question can be filtered by.
 *
 * @param {object} question the question
 * @return {{id: string, label: string}[]} each answer, as stored and as shown
 */
export function filterAnswers(question) {
	const extra = question.extraSettings ?? {}
	if (CHOICE_TYPES.includes(question.type)) {
		const seen = new Set()
		return (question.options ?? [])
			.map((option) => String(option.text ?? ''))
			.filter(
				(text) => text.trim() !== '' && !seen.has(text) && seen.add(text),
			)
			.map((text) => ({ id: text, label: text }))
	}
	let low = null
	let high = null
	if (question.type === 'linearscale') {
		low = extra.optionsLowest ?? 1
		high = extra.optionsHighest ?? 5
	} else if (question.type === 'rating') {
		const max = extra.maxRating
		low = 1
		high = typeof max === 'number' && max >= 2 && max <= 10 ? max : 5
	}
	if (low === null || high < low) {
		return []
	}
	return Array.from({ length: high - low + 1 }, (_, i) => {
		const value = String(low + i)
		return { id: value, label: value }
	})
}

/**
 * The questions a summary can be filtered by, in form order.
 *
 * @param {object[]} questions the form's questions
 * @return {object[]} those with a fixed set of answers
 */
export function filterableQuestions(questions) {
	return questions.filter((question) => filterAnswers(question).length > 1)
}

/**
 * The responses that gave every chosen answer.
 *
 * Conditions narrow one another: asked for engineers, and for those who came in person,
 * a summary describes the engineers who came in person.
 *
 * @param {object[]} submissions every response
 * @param {?({questionId: number, value: string}[]|{questionId: number, value: string})} filter
 *   the chosen answers, one or several, or none
 * @return {object[]} the responses to summarise
 */
export function applySummaryFilter(submissions, filter) {
	const conditions = (Array.isArray(filter) ? filter : [filter]).filter(Boolean)
	if (!conditions.length) {
		return submissions
	}
	return submissions.filter((submission) =>
		conditions.every((condition) =>
			(submission.answers ?? []).some(
				(answer) =>
					answer.questionId === condition.questionId
					&& String(answer.text) === condition.value,
			),
		),
	)
}
