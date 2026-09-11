/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Typed answers grouped by what they say, most frequent first.
 *
 * Two hundred people who typed their department do not give two hundred answers but a
 * dozen, each many times over; listed one per line, the dozen cannot be seen. Answers are
 * the same when they differ only in letter case or spacing, and each group is shown as it
 * was first written. Groups of the same size keep the order they first appeared in.
 *
 * @param {{id: number|string, text: string}[]} answers the answers, in the order they came in
 * @return {{id: number|string, text: string, count: number}[]} one entry per distinct answer
 */
export function groupTextAnswers(answers) {
	const groups = new Map()
	answers.forEach((answer, order) => {
		const text = String(answer.text ?? '').trim()
		const key = text.replace(/\s+/g, ' ').toLocaleLowerCase()
		if (key === '') {
			return
		}
		const group = groups.get(key)
		if (group) {
			group.count++
		} else {
			groups.set(key, { id: answer.id, text, count: 1, order })
		}
	})
	return [...groups.values()]
		.sort((a, b) => b.count - a.count || a.order - b.order)
		.map(({ id, text, count }) => ({ id, text, count }))
}
