/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Loads ECharts on demand, registering only the pieces the response summary uses.
 *
 * Deliberately a dynamic import. The full library is a large dependency, and the only
 * place in the app that needs it is the results summary, so bundling it into the main
 * entry would make every other page in Forms pay for it. Registering a hand-picked set
 * of charts and components rather than importing the barrel keeps the chunk to roughly a
 * third of the full build.
 *
 * The SVG renderer is chosen over canvas on purpose:
 *   it prints as vector rather than a rasterised bitmap, which the printable summary
 *     report depends on;
 *   its labels are real text nodes, so they can be found, selected and read out,
 *     instead of being pixels in an opaque element.
 */

let loading = null

/**
 * @return {Promise<object>} the configured ECharts core module
 */
export function loadEcharts() {
	if (!loading) {
		loading = (async () => {
			const [core, charts, components, renderers] = await Promise.all([
				import('echarts/core'),
				import('echarts/charts'),
				import('echarts/components'),
				import('echarts/renderers'),
			])
			core.use([
				charts.BarChart,
				// The stacked grid view is a bar series too, so it needs nothing
				// further; the line view does.
				charts.LineChart,
				charts.PieChart,
				components.GridComponent,
				components.TooltipComponent,
				// Draws the ring's centre total. Without it that number silently
				// does not render at all -- there is no error, just no number.
				components.TitleComponent,
				// Generates a screen-reader description of the chart from its own data.
				components.AriaComponent,
				renderers.SVGRenderer,
			])
			return core
		})().catch((error) => {
			// Let a later mount retry rather than caching the failure forever.
			loading = null
			throw error
		})
	}
	return loading
}

/**
 * Read the chart palette and chrome colours out of the DOM.
 *
 * The series hues are fixed and validated, but they are declared in CSS next to the
 * component that owns them, and the chrome colours belong to whatever theme the instance
 * is wearing. Resolving both through `getComputedStyle` means this file never holds a
 * second copy of the palette that could drift from the stylesheet.
 *
 * @param {HTMLElement} element any element inside the chart, used to resolve inherited vars
 * @return {object} the resolved tokens
 */
export function readChartTheme(element) {
	const styles = getComputedStyle(element)
	const read = (name, fallback) => styles.getPropertyValue(name).trim() || fallback

	const series = []
	for (let slot = 1; slot <= 7; slot++) {
		const colour = read(`--chart-series-${slot}`, '')
		if (colour) {
			series.push(colour)
		}
	}

	return {
		series,
		muted: read('--chart-muted', '#898781'),
		ink: read('--color-main-text', '#222222'),
		inkFaint: read('--color-text-maxcontrast', '#6b6b6b'),
		track: read('--color-background-dark', '#f0f0f0'),
		surface: read('--color-main-background', '#ffffff'),
		border: read('--color-border', '#ededed'),
		// Read from the document rather than guessed from the language: a form may be
		// authored in a different direction than the interface it is viewed in.
		rtl: styles.direction === 'rtl',
	}
}
