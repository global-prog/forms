/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import logger from './Logger.js'

/**
 * Remember which chart form a reader picked for a question.
 *
 * Deliberately kept in the browser rather than on the question. Reading results is a
 * separate permission from editing a form, so plenty of the people who open a summary
 * cannot write to the question at all -- storing the choice there would mean the picker
 * silently failed for exactly the audience that reads summaries most. It is also a
 * viewing preference rather than a property of the form: two people looking at the same
 * results are entitled to look at them differently.
 *
 * Question ids are unique across forms, so they are enough on their own to key by.
 *
 * Every access is guarded. Storage throws outright in a browser set to block site data,
 * and returns nothing at all in a private window, so a missing or unreadable preference
 * has to be as ordinary as a stored one.
 */

/** Namespaced so it is recognisable in a shared origin's storage. */
const KEY_PREFIX = 'forms:summaryChart:'

/**
 * The form this reader last chose for a question.
 *
 * @param {number|string} questionId the question
 * @param {string[]} allowed the forms that are truthful for this question
 * @return {?string} the stored form, or null if there is none that is still allowed
 */
export function readChartForm(questionId, allowed) {
	try {
		const stored = window.localStorage?.getItem(KEY_PREFIX + questionId)
		// A stored form is checked against the current list, not trusted: a question can
		// be edited into a different shape after the choice was made, and a ring left
		// over from when it was single choice would misstate it as checkboxes.
		return stored && allowed.includes(stored) ? stored : null
	} catch (error) {
		logger.debug('Could not read the stored chart form', { error })
		return null
	}
}

/**
 * Remember a reader's choice.
 *
 * @param {number|string} questionId the question
 * @param {string} form the chosen form
 */
export function writeChartForm(questionId, form) {
	try {
		window.localStorage?.setItem(KEY_PREFIX + questionId, form)
	} catch (error) {
		// Full, or blocked. The chart is already drawn; only the memory of it is lost.
		logger.debug('Could not store the chart form', { error })
	}
}
