/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import logger from '../../../utils/Logger.js'
import { colourKey, fileNameFor, PAPER, titleLines, wrapText } from './chartImage.js'
import { forget, onThemeChange, whenNearView } from './chartScheduler.js'
import { loadEcharts, readChartTheme } from './echartsLoader.js'

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
			// A reader who has asked for less motion gets the finished chart, not the
			// animation into it.
			const option = this.chartOption(theme, width)
			if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
				option.animation = false
			}
			// `notMerge` so a series that has gone away is removed rather than lingering
			// underneath the new one.
			this.chart.setOption(option, { notMerge: true })
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
		 * Save the chart as a PNG, titled, for a report or a slide.
		 *
		 * Drawn from the chart's own SVG at twice its size, on the page's background so
		 * its text keeps the contrast it has on screen, with the title written above it
		 * in the direction the question reads.
		 *
		 * Throws when there is nothing to draw from - the library did not load, or the
		 * drawing could not be turned into an image - so the caller can say so rather
		 * than the button silently doing nothing.
		 *
		 * @param {string} title the question, written above the chart and naming the file
		 * @param {string} direction 'rtl' or 'ltr', how the title reads
		 */
		async downloadImage(title, direction = 'ltr') {
			if (this.failed) {
				throw new Error('The chart library is not available')
			}
			if (!this.echarts) {
				// Still on its way on a slow connection: wait for it rather than
				// ignoring the click.
				this.echarts = await loadEcharts()
				this.ready = true
				await this.$nextTick()
			}
			this.start()
			if (!this.chart || !this.$refs.chart) {
				throw new Error('The chart has not been drawn')
			}
			const scale = 2
			const padding = 24
			const width = this.$refs.chart.clientWidth
			const height = this.$refs.chart.clientHeight
			// The picture is at least as wide as the whole figure, and never narrow. A
			// ring is a small fixed box, and sizing the picture to it squeezed the title
			// into a column a few words wide and ran the key off its edge. The drawing
			// keeps its own size and is centred.
			const exportWidth = Math.max(width, this.$el.clientWidth || 0, 480)
			const drawingX = padding + (exportWidth - width) / 2
			const style = window.getComputedStyle(this.$refs.chart)
			const family = style.fontFamily || 'sans-serif'
			// Paper, like the drawing above it and like the printed report.
			const background = PAPER.surface
			const ink = PAPER.ink

			const canvas = document.createElement('canvas')
			const context = canvas.getContext('2d')
			context.font = `bold 16px ${family}`
			const lines = titleLines(context, title, exportWidth)
			const titleHeight = lines.length ? lines.length * 22 + padding : 0
			// A ring and a stacked bar keep their key in the page rather than in the
			// drawing, so a picture of the drawing alone is unlabelled colour. A chart
			// that has one hands it over and it is drawn underneath.
			// The key is read off the screen, so its swatches carry the screen's series
			// colours while the drawing above is now in the paper ones - the same hues,
			// tuned for a different ground, but not the same values. Matched back by
			// position, and by colour rather than by spelling: the stylesheet says
			// `#3987e5` and the swatch reads back `rgb(57, 135, 229)`. Compared as text
			// those never matched, so every key went out in the screen colours under a
			// drawing already on paper - a picture disagreeing with its own key. The
			// grey a folded tail or an unanswered slice wears is mapped for the same
			// reason: the ring draws that in PAPER.muted.
			const screen = readChartTheme(this.$refs.chart)
			const paperFor = new Map(
				screen.series.map((colour, index) => [
					colourKey(colour),
					PAPER.series[index % PAPER.series.length],
				]),
			)
			paperFor.set(colourKey(screen.muted), PAPER.muted)
			// Anything that is not one of ours is left as it is.
			const toPaper = (colour) => paperFor.get(colourKey(colour)) ?? colour
			// Each entry is wrapped to the room beside its swatch, so a long option is
			// set on several lines instead of running off the edge of the picture. The
			// lines are counted now because the canvas has to be sized before anything
			// is drawn on it.
			const swatch = 12
			const legendFont = `14px ${family}`
			context.font = legendFont
			const legend = (this.legendRows?.() ?? []).map((row) => ({
				...row,
				colour: toPaper(row.colour),
				lines: wrapText(context, row.label, exportWidth - swatch - 8),
			}))
			const legendLine = 22
			const legendLineCount = legend.reduce(
				(sum, row) => sum + Math.max(row.lines.length, 1),
				0,
			)
			const legendHeight = legend.length
				? legendLineCount * legendLine + padding
				: 0
			// Sizing a canvas resets its context, so everything set on it is set after.
			canvas.width = (exportWidth + 2 * padding) * scale
			canvas.height =
				(height + titleHeight + legendHeight + 2 * padding) * scale
			context.scale(scale, scale)
			context.fillStyle = background
			context.fillRect(0, 0, canvas.width, canvas.height)

			context.font = `bold 16px ${family}`
			context.fillStyle = ink
			context.direction = direction === 'rtl' ? 'rtl' : 'ltr'
			context.textAlign = 'start'
			context.textBaseline = 'top'
			const x = direction === 'rtl' ? exportWidth + padding : padding
			lines.forEach((line, index) => {
				context.fillText(line, x, padding + index * 22)
			})

			// Rendered a second time, offscreen, in the paper palette: the picture is for
			// somewhere else, and re-theming the chart on the page would make it flash.
			// If anything about that fails the on-screen drawing is still a correct
			// picture, so it is used rather than losing the download.
			let svg
			try {
				const echarts = await loadEcharts()
				const offscreen = echarts.init(document.createElement('div'), null, {
					renderer: 'svg',
					ssr: true,
					width,
					height,
				})
				offscreen.setOption(
					{
						...this.chartOption(
							{ ...PAPER, rtl: direction === 'rtl' },
							width,
						),
						// renderToSVGString takes the frame as it stands, and frame one
						// of an animated pie is a ring of zero radius - the centre total
						// appeared in the picture and the ring did not.
						animation: false,
					},
					{ notMerge: true },
				)
				svg = offscreen.renderToSVGString()
				offscreen.dispose()
			} catch (error) {
				logger.debug('Could not redraw the chart for export', { error })
				svg = this.chart.renderToSVGString()
			}
			const url = URL.createObjectURL(
				new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
			)
			try {
				const image = new Image()
				await new Promise((resolve, reject) => {
					image.onload = resolve
					image.onerror = reject
					image.src = url
				})
				context.drawImage(
					image,
					drawingX,
					padding + titleHeight,
					width,
					height,
				)
			} finally {
				URL.revokeObjectURL(url)
			}

			// The key, under the drawing: a swatch in the series colour and the words the
			// page shows beside it.
			if (legend.length) {
				context.font = legendFont
				context.textBaseline = 'middle'
				const boxX =
					direction === 'rtl' ? exportWidth + padding - swatch : padding
				const textX =
					direction === 'rtl'
						? exportWidth + padding - swatch - 8
						: padding + swatch + 8
				let line = 0
				legend.forEach((row) => {
					const top = padding + titleHeight + height + padding / 2
					const y = top + line * legendLine + legendLine / 2
					// The swatch sits beside the first line of its entry.
					context.fillStyle = row.colour || ink
					context.fillRect(boxX, y - swatch / 2, swatch, swatch)
					context.fillStyle = ink
					row.lines.forEach((text, index) => {
						context.fillText(text, textX, y + index * legendLine)
					})
					line += Math.max(row.lines.length, 1)
				})
			}

			const blob = await new Promise((resolve) =>
				canvas.toBlob(resolve, 'image/png'),
			)
			if (!blob) {
				return
			}
			const link = document.createElement('a')
			link.href = URL.createObjectURL(blob)
			link.download = `${fileNameFor(title)}.png`
			document.body.appendChild(link)
			link.click()
			link.remove()
			setTimeout(() => URL.revokeObjectURL(link.href), 1000)
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
