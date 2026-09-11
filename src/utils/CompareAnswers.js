/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * One question's numbers, broken down by another question's answer: the average rating
 * given by each department, how each year group scored a scale question. A summary
 * otherwise gives one average for everyone, which hides exactly the differences a survey
 * is run to find, and a spreadsheet is the usual way to get them.
 *
 * Only questions with a fixed set of answers can group, since a group has to be named,
 * and only whole numbers - a scale, a rating, a number question - can be averaged.
 */

/** Types whose answers are stored as the option's text. */
const CHOICE_TYPES = ['multiple', 'multiple_unique', 'dropdown']

/** Types answered with a number. */
const NUMERIC_TYPES = ['number', 'rating', 'linearscale']

/**
 * Can this question's answers be averaged?
 *
 * @param {object} question the question
 * @return {boolean} true for a number, a rating or a scale
 */
export function isNumericQuestion(question) {
	return NUMERIC_TYPES.includes(question?.type)
}

/**
 * The questions a breakdown can group by: those with a fixed, nameable set of answers.
 *
 * @param {object[]} questions the form's questions
 * @param {object} exclude the question being broken down, which cannot group itself
 * @return {object[]} the questions that can group, in form order
 */
export function groupingQuestions(questions, exclude) {
	return questions.filter(
		(question) =>
			question.id !== exclude?.id
			&& CHOICE_TYPES.includes(question.type)
			&& (question.options ?? []).length > 1,
	)
}

/**
 * Average one question's answers within each answer of another.
 *
 * A response counts towards every group it chose, so a checkbox question with two boxes
 * ticked counts in both - which is what "the people who chose this" means.
 *
 * @param {object[]} submissions the responses to describe
 * @param {object} groupQuestion the question whose answers name the groups
 * @param {object} valueQuestion the question being averaged
 * @return {{key: string, label: string, mean: number, count: number}[]} one row per group
 *   that anyone answered, largest average first
 */
export function compareByAnswer(submissions, groupQuestion, valueQuestion) {
	if (!groupQuestion || !isNumericQuestion(valueQuestion)) {
		return []
	}
	const totals = new Map()
	for (const option of groupQuestion.options ?? []) {
		totals.set(String(option.text), { sum: 0, count: 0 })
	}

	for (const submission of submissions) {
		const answers = submission.answers ?? []
		const values = answers
			.filter((answer) => answer.questionId === valueQuestion.id)
			.map((answer) => parseFloat(answer.text))
			.filter((value) => !isNaN(value))
		if (!values.length) {
			continue
		}
		const mean = values.reduce((a, b) => a + b, 0) / values.length
		for (const answer of answers) {
			if (answer.questionId !== groupQuestion.id) {
				continue
			}
			const group = totals.get(String(answer.text))
			if (group) {
				group.sum += mean
				group.count++
			}
		}
	}

	return [...totals.entries()]
		.filter(([, group]) => group.count > 0)
		.map(([label, group]) => ({
			key: label,
			label,
			mean: Math.round((group.sum / group.count) * 100) / 100,
			count: group.count,
		}))
		.sort((a, b) => b.mean - a.mean)
}
