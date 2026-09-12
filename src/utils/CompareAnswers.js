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
 * Only questions with a fixed set of answers can group, since a group has to be named.
 * What is broken down can be either a number - a scale, a rating, a number question, which
 * gives an average per group - or another set of fixed answers, which gives a cross-tab:
 * the table every survey report opens with, and the one thing people still leave for the
 * spreadsheet.
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

/** The key of the row holding answers that match no option. */
export const OTHER_ROW = 'other'

/** The key of the row holding people who answered the grouping question and not this one. */
export const NO_ANSWER_ROW = 'none'

/**
 * Can this question's answers name a row of a cross-tab?
 *
 * @param {object} question the question
 * @return {boolean} true for a checkbox, radio or dropdown question with options
 */
export function isChoiceQuestion(question) {
	return (
		CHOICE_TYPES.includes(question?.type) && (question?.options ?? []).length > 0
	)
}

/**
 * One choice question crossed with another: how each group answered.
 *
 * Percentages are of the people in that column, not of the table, because the question a
 * cross-tab is read to answer is "of the people who said this, how many said that". The
 * denominator is people, counted once each, and not the sum of the column: either question
 * may be a checkbox question, so one person can appear in several rows and several columns
 * at once and the column will happily total more than 100%. Counting submissions rather
 * than answers at least keeps the denominator honest.
 *
 * Every option keeps its row even when nobody chose it - an empty row is a finding - but a
 * column nobody chose is dropped, since it would only be a blank stripe.
 *
 * Answers are stored as the option's text, not its id, so two options worded identically
 * are one row and one column here, holding the sum of both. Nothing can separate them
 * after the fact; the stored answer does not say which was clicked.
 *
 * @param {object[]} submissions the responses to describe
 * @param {object} groupQuestion the question whose answers head the columns
 * @param {object} valueQuestion the question whose answers name the rows
 * @param {object} labels names for the two rows that are not options
 * @param {string} labels.other what to call answers matching no option
 * @param {string} labels.noAnswer what to call people who skipped this question
 * @return {{rows: object[], columns: object[], cells: object[][]}} in ChartHeatmap's shape
 */
export function crossTabByAnswer(
	submissions,
	groupQuestion,
	valueQuestion,
	labels = {},
) {
	const empty = { rows: [], columns: [], cells: [] }
	if (
		!isChoiceQuestion(groupQuestion)
		|| !isChoiceQuestion(valueQuestion)
		|| groupQuestion.id === valueQuestion.id
	) {
		return empty
	}

	const optionTexts = new Set(
		valueQuestion.options.map((option) => String(option.text)),
	)
	const tally = new Map(
		groupQuestion.options.map((option) => [
			String(option.text),
			{ label: String(option.text), respondents: 0, counts: new Map() },
		]),
	)
	let sawOther = false
	let sawNoAnswer = false

	for (const submission of submissions) {
		const answers = submission.answers ?? []

		// Which columns this one person belongs to; a set, so ticking the same box twice
		// cannot count them twice.
		const groups = new Set()
		for (const answer of answers) {
			if (answer.questionId !== groupQuestion.id) {
				continue
			}
			const text = String(answer.text)
			if (tally.has(text)) {
				groups.add(text)
			}
		}
		if (groups.size === 0) {
			continue
		}

		const picks = new Set()
		for (const answer of answers) {
			if (answer.questionId !== valueQuestion.id) {
				continue
			}
			const text = String(answer.text)
			if (optionTexts.has(text)) {
				picks.add(text)
			} else {
				picks.add(OTHER_ROW)
				sawOther = true
			}
		}
		if (picks.size === 0) {
			picks.add(NO_ANSWER_ROW)
			sawNoAnswer = true
		}

		for (const key of groups) {
			const column = tally.get(key)
			column.respondents++
			for (const pick of picks) {
				column.counts.set(pick, (column.counts.get(pick) ?? 0) + 1)
			}
		}
	}

	const columns = [...tally.entries()]
		.filter(([, column]) => column.respondents > 0)
		.map(([key, column]) => ({
			key,
			label: column.label,
			respondents: column.respondents,
		}))
	if (columns.length === 0) {
		return empty
	}

	const rows = valueQuestion.options.map((option) => ({
		key: String(option.text),
		label: String(option.text),
	}))
	if (sawOther) {
		rows.push({ key: OTHER_ROW, label: labels.other ?? OTHER_ROW })
	}
	if (sawNoAnswer) {
		rows.push({ key: NO_ANSWER_ROW, label: labels.noAnswer ?? NO_ANSWER_ROW })
	}

	// Rectangular by construction: one cell per column of `columns`, for every row.
	const cells = rows.map((row) =>
		columns.map((column) => {
			const count = tally.get(column.key).counts.get(row.key) ?? 0
			const share = Math.round((count / column.respondents) * 100)
			return { value: share, display: `${count} (${share}%)` }
		}),
	)

	return { rows, columns, cells }
}
