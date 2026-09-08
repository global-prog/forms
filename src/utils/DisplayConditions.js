/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * UOS: client-side mirror of SubmissionService::evaluateBranchConditions() and
 * ::isQuestionVisible(), used to show and hide questions live as answers change.
 *
 * The SERVER remains authoritative -- it re-evaluates the same rules when validating a
 * submission, so a disagreement here can only produce a cosmetic oddity, never a bad
 * validation outcome or a way to skip a required question. Keep the two in sync anyway.
 */

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

	switch (sourceType) {
		case 'multiple_unique':
		case 'dropdown':
			// Single select: any listed option being selected is a match.
			return conditions.some(
				(condition) =>
					condition.optionId !== undefined
					&& values.includes(String(condition.optionId)),
			)

		case 'multiple':
			// Multi select: every option of a condition must be selected.
			return conditions.some((condition) => {
				const optionIds = condition.optionIds ?? []
				return (
					Array.isArray(optionIds)
					&& optionIds.length > 0
					&& optionIds.every((id) => values.includes(String(id)))
				)
			})

		case 'short':
		case 'long': {
			const text = String(values[0] ?? '')
			return conditions.some((condition) => {
				const expected = String(condition.value ?? '')
				switch (condition.type) {
					case 'string_equals':
						return text === expected
					case 'regex':
						try {
							return new RegExp(expected).test(text)
						} catch {
							return false
						}
					case 'string_contains':
					default:
						return text.includes(expected)
				}
			})
		}

		case 'linearscale':
		case 'time': {
			const number = parseFloat(values[0])
			if (isNaN(number)) {
				return false
			}
			return conditions.some((condition) => {
				switch (condition.type) {
					case 'value_not_equals':
						return number !== parseFloat(condition.value)
					case 'value_range':
						return (
							number >= parseFloat(condition.min)
							&& number <= parseFloat(condition.max)
						)
					case 'value_min':
						return number >= parseFloat(condition.min ?? condition.value)
					case 'value_max':
						return number <= parseFloat(condition.max ?? condition.value)
					case 'value_equals':
					default:
						return number === parseFloat(condition.value)
				}
			})
		}

		case 'date':
		case 'datetime': {
			const when = Date.parse(values[0])
			if (isNaN(when)) {
				return false
			}
			return conditions.some((condition) => {
				const from = condition.min ? Date.parse(condition.min) : -Infinity
				const to = condition.max ? Date.parse(condition.max) : Infinity
				return when >= from && when <= to
			})
		}

		case 'color':
			return conditions.some(
				(condition) =>
					String(values[0] ?? '').toLowerCase()
					=== String(condition.value ?? '').toLowerCase(),
			)

		case 'file':
			// "a file was uploaded"
			return values.length > 0 && !!values[0]

		default:
			return false
	}
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
