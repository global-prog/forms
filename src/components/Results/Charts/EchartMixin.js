/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import logger from '../../../utils/Logger.js'
import { forget, onThemeChange, whenNearView } from './chartScheduler.js'
import { loadEcharts, readChartTheme } from './echartsLoader.js'

/**
 * Shared lifecycle for the ECharts-backed summary charts.
 *
 * A component using this supplies `chartOption(theme)` and renders one element with
 * `ref="chart"`. Everything else -- loading the library, first paint, re-paint on new
 * data, resizing, following the instance theme, and tearing down -- happens here, so the
 * chart components stay a description of what to draw.
 *
 * Three things this exists to get right, each of which is a silent bug when missed:
 *
 *   The chart instance is held on a plain property, NOT in `data()`. Vue would wrap it
 *     in a reactive proxy, and ECharts keeps internal state that misbehaves when every
 *     property access is intercepted.
 *   The theme is re-read and the chart repainted when the instance theme changes. The
 *     series hues come from CSS, so a chart painted under the light theme keeps light
 *     colours on a dark ground until something tells it to look again.
 *   A chart mounted into a zero-height container draws nothing and never recovers on
 *     its own, so size is observed rather than measured once.
 *
 * A chart starts drawing only as it comes near the screen, or when the page is printed;
 * see chartScheduler.js. Its box keeps its height meanwhile, so nothing moves when it
 * draws.
 */
export default {
	props: {
		/** `{ key?, label, value, percentage, note?, best?, muted? }`, ordered by the caller */
		items: {
			type: Array,
			required: true,
		},
	},

	data() {
		return {
			// Set once the library has loaded, purely so the template can show a
			// placeholder instead of an empty box on a slow connection.
			ready: false,
			failed: false,
			// The plot's measured width. Kept here rather than read on demand because
			// an arrangement that does not fit at this width is a different arrangement,
			// and the height it needs is a computed property.
			plotWidth: 0,
		}
	},

	watch: {
		items: {
			deep: true,
			handler() {
				this.paint()
			},
		},
	},

	async mounted() {
		try {
			this.echarts = await loadEcharts()
		} catch (error) {
			// A chart that cannot load must not take the summary down with it: every
			// value it would have drawn is also present as text.
			this.failed = true
			logger.error('Could not load the chart library', { error })
			return
		}
		if (!this.$refs.chart) {
			// Unmounted while the import was in flight.
			return
		}
		this.ready = true
		// Shown now; measure it, so the arrangement and the height it needs are settled
		// before the chart draws rather than changing when it does.
		await this.$nextTick()
		if (!this.$refs.chart) {
			return
		}
		this.plotWidth = this.$refs.chart.clientWidth
		whenNearView(this.$refs.chart, () => this.start())
	},

	beforeUnmount() {
		forget(this.$refs.chart)
		this.resizeObserver?.disconnect()
		this.stopThemeWatch?.()
		this.chart?.dispose()
		this.chart = null
	},

	methods: {
		/** Draw the chart for the first time and keep it current from then on. */
		start() {
			if (this.chart || !this.$refs.chart || !this.echarts) {
				return
			}
			this.chart = this.echarts.init(this.$refs.chart, null, {
				renderer: 'svg',
			})
			this.paint()
			this.observe()
		},

		/** Rebuild the option from the current data and the current theme. */
		paint() {
			if (!this.chart || !this.$refs.chart) {
				return
			}
			const theme = readChartTheme(this.$refs.chart)
			const width = this.$refs.chart.clientWidth
			if (width !== this.plotWidth) {
				this.plotWidth = width
			}
			// `notMerge` so a series that has gone away is removed rather than lingering
			// underneath the new one.
			this.chart.setOption(this.chartOption(theme, width), { notMerge: true })
		},

		/** Watch for the two things that invalidate a painted chart: size and theme. */
		observe() {
			if (window.ResizeObserver) {
				this.resizeObserver = new ResizeObserver(() => {
					// Repaint rather than only resize: on a narrow screen the width
					// decides which arrangement is legible, not just how big it is.
					this.paint()
					this.chart?.resize()
				})
				this.resizeObserver.observe(this.$refs.chart)
			}

			// The theme is watched once for the page, and every chart repainted together.
			this.stopThemeWatch = onThemeChange(() => this.paint())
		},

		/**
		 * One colour per row, aligned to `items`.
		 *
		 * A row the caller marks `muted` -- "No response", or a folded tail -- takes no
		 * categorical slot, so it does not shift every real choice's hue along by one.
		 *
		 * @param {object} theme the resolved tokens
		 * @return {string[]} a colour per row
		 */
		seriesColours(theme) {
			const slots = theme.series.length || 1
			let slot = 0
			return this.items.map((item) =>
				item.muted ? theme.muted : theme.series[slot++ % slots],
			)
		},
	},
}
