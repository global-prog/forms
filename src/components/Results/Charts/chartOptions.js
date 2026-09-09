/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * The chart descriptions, as pure functions of their data.
 *
 * Kept out of the components on purpose. A chart option is the part most likely to be
 * quietly wrong -- a formatter that throws, a rich-text tag with no matching style, an
 * axis inverted the wrong way for right-to-left -- and none of that shows up in a linter
 * or a template compile. As plain functions they can be rendered head-first in a test and
 * the resulting SVG inspected, which is the only way to check them without a browser.
 */

/** Row pitch. Comfortable for a pointer, and enough for a wrapped second line. */
export const ROW_HEIGHT = 38

/** Breathing room above and below the plot. */
export const CHART_PADDING = 16

/** Widest the category labels may get before they wrap. */
const LABEL_WIDTH_MAX = 220

/** Narrowest they may be squeezed to on a small screen. */
const LABEL_WIDTH_MIN = 96

/** Share of the plot the labels may claim. */
const LABEL_WIDTH_SHARE = 0.42

/** Room at the growing end of the bars for the value label. */
const VALUE_GUTTER = 68

/**
 * How much width to give the category labels.
 *
 * `grid.containLabel`, which used to work this out automatically, is deprecated in
 * ECharts 6 and now needs a compatibility shim. Since the labels are given an explicit
 * wrap width anyway, the space they need is already known -- so the gutter is computed
 * here rather than measured, which is both deterministic and free of the shim.
 *
 * @param {number} width the plot's own width in pixels
 * @return {number} the label column width
 */
function labelWidthFor(width) {
	if (!width) {
		return LABEL_WIDTH_MAX
	}
	return Math.round(
		Math.min(
			LABEL_WIDTH_MAX,
			Math.max(LABEL_WIDTH_MIN, width * LABEL_WIDTH_SHARE),
		),
	)
}

/**
 * Horizontal magnitude bars.
 *
 * Colour encodes nothing here: bar length already carries magnitude, so giving each bar
 * its own hue would spend a second channel on a variable already shown. The leading
 * answer is marked with weight on its label instead, which survives greyscale printing
 * and colour-blind vision alike.
 *
 * @param {object} spec the chart inputs
 * @param {object[]} spec.items rows, ordered by the caller
 * @param {string[]} spec.colours one colour per row, aligned to items
 * @param {object} spec.theme resolved palette and chrome colours
 * @param {number} [spec.max] value that should fill the track
 * @param {boolean} [spec.hidePercentage] true for counts that are not shares of a whole
 * @param {number} [spec.width] the plot's width, used to size the label column
 * @return {object} the ECharts option
 */
export function barOption({
	items,
	colours,
	theme,
	max = 0,
	hidePercentage = false,
	width = 0,
}) {
	const largest = Math.max(max, ...items.map((item) => Number(item.value) || 0))
	const labelWidth = labelWidthFor(width)
	// The labels sit on whichever side the categories are drawn, so the wide gutter
	// swaps ends with the reading direction.
	const labelGutter = labelWidth + 12

	return {
		// ECharts writes its own screen-reader description from the data.
		aria: { enabled: true },
		animationDuration: 400,
		backgroundColor: 'transparent',
		grid: {
			top: CHART_PADDING,
			bottom: CHART_PADDING,
			left: theme.rtl ? VALUE_GUTTER : labelGutter,
			right: theme.rtl ? labelGutter : VALUE_GUTTER,
		},
		tooltip: {
			trigger: 'item',
			confine: true,
			formatter: (params) => {
				const item = items[params.dataIndex] ?? {}
				const parts = [`<strong>${params.value}</strong>`]
				if (!hidePercentage) {
					parts.push(`(${item.percentage}%)`)
				}
				if (item.note) {
					parts.push(item.note)
				}
				return `${params.name}<br>${parts.join(' ')}`
			},
		},
		xAxis: {
			type: 'value',
			max: largest > 0 ? largest : 1,
			// Redundant when every bar carries its own value label.
			show: false,
			inverse: theme.rtl,
		},
		yAxis: {
			type: 'category',
			data: items.map((item) => item.label),
			// Categories run bottom-up by default; the caller's order is meaningful.
			inverse: true,
			position: theme.rtl ? 'right' : 'left',
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: {
				color: theme.ink,
				// Wrap rather than truncate: an option is identified by its words.
				width: labelWidth,
				overflow: 'break',
				lineHeight: 16,
				// The rich tag below must have a matching entry in `rich`, or ECharts
				// renders the literal markup.
				formatter: (label, index) =>
					items[index]?.best ? `{best|${label}}` : label,
				rich: {
					best: {
						color: theme.ink,
						fontWeight: 'bold',
						lineHeight: 16,
						width: labelWidth,
						overflow: 'break',
					},
				},
			},
		},
		series: [
			{
				type: 'bar',
				barMaxWidth: 14,
				data: items.map((item, index) => ({
					value: Number(item.value) || 0,
					itemStyle: {
						color: colours[index],
						// Round only the growing end, and swap which end that is when
						// the form reads right to left.
						borderRadius: theme.rtl ? [4, 0, 0, 4] : [0, 4, 4, 0],
					},
				})),
				label: {
					show: true,
					position: theme.rtl ? 'left' : 'right',
					color: theme.ink,
					fontWeight: 'bold',
					formatter: ({ dataIndex, value }) => {
						if (hidePercentage) {
							return String(value)
						}
						return `${value}  ${items[dataIndex]?.percentage}%`
					},
				},
				// The unfilled remainder of each row, so a short bar still reads as a
				// share of something rather than floating on the surface.
				showBackground: true,
				backgroundStyle: {
					color: theme.track,
					borderRadius: 4,
				},
			},
		],
	}
}

/**
 * Part-to-whole ring, for single-choice questions only.
 *
 * Slice labels are deliberately off: the component renders the legend as HTML beside the
 * ring, which wraps and mirrors with the rest of the page and keeps every count readable
 * when a slice is too thin to label.
 *
 * @param {object} spec the chart inputs
 * @param {object[]} spec.slices slices to draw, tail already folded by the caller
 * @param {string[]} spec.colours one colour per slice, aligned to slices
 * @param {number} spec.total every response the ring accounts for
 * @param {object} spec.theme resolved palette and chrome colours
 * @return {object} the ECharts option
 */
export function donutOption({ slices, colours, total, theme }) {
	return {
		aria: { enabled: true },
		animationDuration: 400,
		backgroundColor: 'transparent',
		title: {
			text: String(total),
			left: 'center',
			top: 'center',
			textStyle: {
				color: theme.ink,
				fontSize: 22,
				fontWeight: 'bold',
			},
		},
		tooltip: {
			trigger: 'item',
			confine: true,
			formatter: ({ name, value, percent }) =>
				`${name}<br><strong>${value}</strong> (${Math.round(percent)}%)`,
		},
		series: [
			{
				type: 'pie',
				radius: ['58%', '84%'],
				center: ['50%', '50%'],
				avoidLabelOverlap: false,
				label: { show: false },
				labelLine: { show: false },
				data: slices.map((slice, index) => ({
					name: slice.label,
					value: Number(slice.value) || 0,
					itemStyle: {
						color: colours[index],
						// A ring in the surface colour reads as a gap between slices
						// without introducing another hue.
						borderColor: theme.surface,
						borderWidth: 2,
					},
				})),
				emphasis: { scaleSize: 4 },
			},
		],
	}
}
