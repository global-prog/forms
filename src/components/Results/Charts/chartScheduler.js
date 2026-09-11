/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * When the summary charts draw, shared by all of them.
 *
 * A summary has a chart per question, and a long form has dozens. Drawing them all as the
 * page opens spends the first seconds on charts nobody has scrolled to, so each chart
 * starts once it comes near the screen. Printing is the exception: a printed summary must
 * have every chart, so anything still waiting is drawn the moment printing begins.
 *
 * The theme is watched once for the whole page too. Each chart used to watch the document
 * itself, so one change repainted every chart separately, as many times as there were
 * charts watching; now a change repaints each once, together, in the next frame.
 */

/** How far ahead of the screen a chart starts, so it is ready by the time it is seen. */
const LOOK_AHEAD = '400px 0px'

/** @type {Map<Element, Function>} charts waiting to come into view */
const waiting = new Map()

/** @type {?IntersectionObserver} */
let visibility = null

/** @type {Set<Function>} charts to repaint when the theme changes */
const themed = new Set()

let themeWatched = false
let repaintQueued = false
let printWatched = false

/** Draw every chart still waiting, as printing needs them all. */
function startAll() {
	for (const [element, start] of [...waiting]) {
		waiting.delete(element)
		visibility?.unobserve(element)
		start()
	}
}

/** Start whatever is waiting as soon as printing begins, however it was begun. */
function watchPrinting() {
	if (printWatched) {
		return
	}
	printWatched = true
	window.addEventListener('beforeprint', startAll)
	// Some browsers announce printing only through the print media query.
	window.matchMedia?.('print')?.addEventListener?.('change', (event) => {
		if (event.matches) {
			startAll()
		}
	})
}

/**
 * Run `start` once `element` comes near the screen, or straight away where that cannot
 * be watched.
 *
 * @param {Element} element the chart's container
 * @param {Function} start draws the chart
 */
export function whenNearView(element, start) {
	if (!window.IntersectionObserver) {
		start()
		return
	}
	watchPrinting()
	if (!visibility) {
		visibility = new window.IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue
					}
					const run = waiting.get(entry.target)
					waiting.delete(entry.target)
					visibility.unobserve(entry.target)
					run?.()
				}
			},
			{ rootMargin: LOOK_AHEAD },
		)
	}
	waiting.set(element, start)
	visibility.observe(element)
}

/**
 * Stop waiting for a chart that is going away.
 *
 * @param {?Element} element the chart's container
 */
export function forget(element) {
	if (element && waiting.delete(element)) {
		visibility?.unobserve(element)
	}
}

/** Repaint every themed chart once, in the next frame. */
function queueRepaint() {
	if (repaintQueued) {
		return
	}
	repaintQueued = true
	const run = () => {
		repaintQueued = false
		for (const repaint of [...themed]) {
			repaint()
		}
	}
	if (window.requestAnimationFrame) {
		window.requestAnimationFrame(run)
	} else {
		setTimeout(run, 0)
	}
}

/** Watch the page for a change of theme, once for all charts. */
function watchTheme() {
	if (themeWatched) {
		return
	}
	themeWatched = true
	// Nextcloud applies a theme by stamping an attribute on the document, so the attribute
	// list is what to watch rather than any event.
	const observer = new MutationObserver(queueRepaint)
	for (const node of [document.documentElement, document.body]) {
		observer.observe(node, {
			attributes: true,
			attributeFilter: [
				'class',
				'style',
				'data-theme-dark',
				'data-theme-default',
			],
		})
	}
	// The default theme defers to the operating system, which the attributes above never
	// change.
	window
		.matchMedia?.('(prefers-color-scheme: dark)')
		?.addEventListener?.('change', queueRepaint)
}

/**
 * Repaint a chart whenever the theme changes.
 *
 * @param {Function} repaint repaints the chart
 * @return {Function} stops repainting it
 */
export function onThemeChange(repaint) {
	watchTheme()
	themed.add(repaint)
	return () => themed.delete(repaint)
}
