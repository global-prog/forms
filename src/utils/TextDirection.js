/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { isRTL } from '@nextcloud/l10n'

/**
 * Which way a form's own content should be laid out.
 *
 * A form is written in the language its author wrote it in, which has nothing to do with
 * the language of whoever opens it later. An Arabic form read by someone whose interface
 * is in English must still read right to left -- its questions, its answers, and the
 * charts drawn from them -- or the words are correct and everything around them is
 * backwards.
 *
 * The form's language setting answers this when it is set. It usually is not: it is a
 * recent addition and defaults to "follow the reader", so every form written before it
 * existed has nothing recorded. Rather than falling back to the reader's interface, which
 * is the thing that is wrong, the direction is then taken from the form's own text.
 *
 * This is the rule `dir="auto"` applies, implemented here rather than delegated to the
 * attribute for two reasons: it can be unit-tested without a browser, and the result is
 * needed as a value, not only as a layout -- the charts are drawn by a library that has
 * to be told which way round to put its axes, and it reads a resolved direction.
 */

/** Ranges whose letters are written right to left. */
const RTL_RANGES = [
	[0x0590, 0x05ff], // Hebrew
	[0x0600, 0x06ff], // Arabic
	[0x0700, 0x074f], // Syriac
	[0x0750, 0x077f], // Arabic Supplement
	[0x0780, 0x07bf], // Thaana
	[0x07c0, 0x07ff], // NKo
	[0x0800, 0x083f], // Samaritan
	[0x0840, 0x085f], // Mandaic
	[0x0860, 0x08ff], // Syriac Supplement, Arabic Extended-A and -B
	[0xfb1d, 0xfb4f], // Hebrew presentation forms
	[0xfb50, 0xfdff], // Arabic presentation forms-A
	[0xfe70, 0xfeff], // Arabic presentation forms-B
]

/** Ranges whose letters are written left to right. Enough of them to decide, not all. */
const LTR_RANGES = [
	[0x0041, 0x005a], // A-Z
	[0x0061, 0x007a], // a-z
	[0x00c0, 0x024f], // Latin supplements and extensions
	[0x0370, 0x058f], // Greek, Cyrillic, Armenian
	[0x0900, 0x109f], // Indic and South-East Asian scripts
	[0x1e00, 0x1fff], // Latin and Greek extended additional
	[0x2c00, 0x2dff], // Glagolitic, Coptic, Tifinagh
	[0x2e80, 0xa4cf], // CJK, kana, Yi
	[0xac00, 0xd7af], // Hangul
]

/**
 * @param {number} code a code point
 * @param {number[][]} ranges the ranges to test against
 * @return {boolean} true when the code point falls in one of them
 */
function inRanges(code, ranges) {
	return ranges.some(([from, to]) => code >= from && code <= to)
}

/**
 * The direction a piece of text is written in.
 *
 * Decided by the first letter that has a direction of its own, so a question numbered
 * "12." in Western digits and then written in Arabic still reads as Arabic -- digits and
 * punctuation carry no direction and are skipped, which is what makes this usable on real
 * form titles.
 *
 * @param {string} text the text to examine
 * @return {?string} 'rtl', 'ltr', or null when nothing in it has a direction
 */
export function directionOfText(text) {
	if (typeof text !== 'string' || text === '') {
		return null
	}
	for (const character of text) {
		const code = character.codePointAt(0)
		if (inRanges(code, RTL_RANGES)) {
			return 'rtl'
		}
		if (inRanges(code, LTR_RANGES)) {
			return 'ltr'
		}
	}
	return null
}

/**
 * The direction to lay content out in.
 *
 * The declared language wins where there is one, because an author who has said "this
 * form is Arabic" has said something the text cannot contradict -- a mostly-English
 * Arabic form is still an Arabic form. Otherwise the first of the given texts that has a
 * direction decides, and if none of them do the caller gets nothing back and should leave
 * the direction to whatever it inherits.
 *
 * @param {string} language the form's declared language, '' when it follows the reader
 * @param {...string} texts the form's own text, most representative first
 * @return {?string} 'rtl', 'ltr', or undefined to inherit
 */
export function resolveDirection(language, ...texts) {
	if (language) {
		return isRTL(language) ? 'rtl' : 'ltr'
	}
	for (const text of texts) {
		const direction = directionOfText(text)
		if (direction) {
			return direction
		}
	}
	return undefined
}
