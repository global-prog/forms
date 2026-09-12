/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * When the responses arrived.
 *
 * A summary says what people answered but not when they answered it, which is the first
 * thing an author wants to know while a form is open: whether the reminder worked,
 * whether anybody is still coming, which day carried the response rate. The timestamps
 * are already there; only the counting was missing.
 *
 * The step is chosen from the span so the chart stays readable: hours for a form answered
 * within a couple of days, days for a few months, months beyond that. Steps nobody
 * answered in are kept, since a gap is exactly what the chart is read for.
 */

/** Seconds in the units the steps are chosen from. */
const HOUR = 3600
const DAY = 24 * HOUR

/** Past this many steps a chart is a smear, so the next larger step is used. */
const MAX_STEPS = 60

/** A day and a half of responses reads by the hour; longer than that it does not. */
const HOURLY_SPAN = 36 * HOUR

/** Two months reads by the day; longer than that it becomes months. */
const DAILY_SPAN = 60 * DAY

/**
 * @param {number[]} timestamps when each response arrived, in seconds
 * @return {'hour'|'day'|'month'} the step to count by
 */
export function timelineStep(timestamps) {
	if (timestamps.length === 0) {
		return 'day'
	}
	const span = Math.max(...timestamps) - Math.min(...timestamps)
	if (span <= HOURLY_SPAN) {
		return 'hour'
	}
	if (span <= DAILY_SPAN) {
		return 'day'
	}
	return 'month'
}

/**
 * The start of the step a moment belongs to, as a Date.
 *
 * @param {number} timestamp seconds
 * @param {'hour'|'day'|'month'} step the step
 * @return {Date} the start of that step, in the reader's own time
 */
export function stepStart(timestamp, step) {
	const date = new Date(timestamp * 1000)
	if (step === 'month') {
		return new Date(date.getFullYear(), date.getMonth(), 1)
	}
	if (step === 'day') {
		return new Date(date.getFullYear(), date.getMonth(), date.getDate())
	}
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate(),
		date.getHours(),
	)
}

/**
 * @param {Date} date the start of a step
 * @param {'hour'|'day'|'month'} step the step
 * @return {Date} the start of the next one
 */
function nextStep(date, step) {
	const next = new Date(date)
	if (step === 'month') {
		next.setMonth(next.getMonth() + 1)
	} else if (step === 'day') {
		next.setDate(next.getDate() + 1)
	} else {
		next.setHours(next.getHours() + 1)
	}
	return next
}

/**
 * How many responses arrived in each step, first to last.
 *
 * @param {number[]} timestamps when each response arrived, in seconds
 * @return {{step: 'hour'|'day'|'month', buckets: {at: Date, count: number}[]}} the counts
 */
export function responseTimeline(timestamps) {
	const times = timestamps
		.map((value) => Number(value))
		.filter((value) => Number.isFinite(value) && value > 0)
		.sort((a, b) => a - b)
	if (times.length === 0) {
		return { step: 'day', buckets: [] }
	}

	const step = timelineStep(times)
	const counts = new Map()
	for (const time of times) {
		const key = stepStart(time, step).getTime()
		counts.set(key, (counts.get(key) ?? 0) + 1)
	}

	// Every step between the first and the last, so a quiet week shows as a quiet week.
	const buckets = []
	const last = stepStart(times[times.length - 1], step).getTime()
	for (
		let at = stepStart(times[0], step);
		at.getTime() <= last && buckets.length <= MAX_STEPS * 2;
		at = nextStep(at, step)
	) {
		buckets.push({ at: new Date(at), count: counts.get(at.getTime()) ?? 0 })
	}
	return { step, buckets }
}
