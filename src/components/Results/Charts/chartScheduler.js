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

/** @type {Map<Element, {start: () => void, observer: IntersectionObserver}>} charts waiting to come into view */
const waiting = new Map()

/** @type {Map<?Element, IntersectionObserver>} one observer per scrolling area */
const observers = new Map()

/** @type {Set<() => void>} charts to repaint when the theme changes */
const themed = new Set()

let themeWatched = false
let repaintQueued = false
let printWatched = false

/** Draw every chart still waiting, as printing needs them all. */
function startAll() {
	for (const [element, { start, observer }] of [...waiting]) {
		waiting.delete(element)
		observer.unobserve(element)
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
 * The nearest ancestor that scrolls, which is what brings a chart into view.
 *
 * Measured against the window instead, a chart inside a scrolling area is cut off at that
 * area's edge, so the look-ahead margin is lost and every chart would start only as it
 * appears - drawing in front of the reader rather than before they arrive.
 *
 * @param {Element} element the chart's container
 * @return {?Element} the scrolling area, or null for the window
 */
function scrollingArea(element) {
	for (
		let node = element.parentElement;
		node && node !== document.body;
		node = node.parentElement
	) {
		// A box scrolled only sideways computes its vertical overflow as auto too, so it
		// must also be taller inside than out to be what brings charts into view.
		const overflow = window.getComputedStyle?.(node)?.overflowY
		if (
			(overflow === 'auto' || overflow === 'scroll')
			&& node.scrollHeight > node.clientHeight
		) {
			return node
		}
	}
	return null
}

/**
 * @param {?Element} root the scrolling area to watch within, or null for the window
 * @return {IntersectionObserver} the observer for that area
 */
function observerFor(root) {
	let observer = observers.get(root)
	if (!observer) {
		observer = new window.IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue
					}
					const pending = waiting.get(entry.target)
					waiting.delete(entry.target)
					observer.unobserve(entry.target)
					pending?.start()
				}
			},
			{ root, rootMargin: LOOK_AHEAD },
		)
		observers.set(root, observer)
	}
	return observer
}

/**
 * Run `start` once `element` comes near the screen, or straight away where that cannot
 * be watched.
 *
 * @param {Element} element the chart's container
 * @param {() => void} start draws the chart
 */
export function whenNearView(element, start) {
	if (!window.IntersectionObserver) {
		start()
		return
	}
	watchPrinting()
	const observer = observerFor(scrollingArea(element))
	waiting.set(element, { start, observer })
	observer.observe(element)
}

/**
 * Stop waiting for a chart that is going away.
 *
 * @param {?Element} element the chart's container
 */
export function forget(element) {
	const pending = element && waiting.get(element)
	if (pending) {
		waiting.delete(element)
		pending.observer.unobserve(element)
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
 * @param {() => void} repaint repaints the chart
 * @return {() => void} stops repainting it
 */
export function onThemeChange(repaint) {
	watchTheme()
	themed.add(repaint)
	return () => themed.delete(repaint)
}
