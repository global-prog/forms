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

/** How many categorical hues there are. An eighth would not be separable from the others. */
export const MAX_SERIES = 7

/**
 * Which chart forms tell the truth about a question, and which to show first.
 *
 * This is the whole point of the picker being a matrix rather than a free choice: several
 * perfectly ordinary charts misstate several perfectly ordinary questions, and the reader
 * of a summary has no way to know it happened.
 *
 *   a ring divides a whole, so it is offered ONLY for single choice. A checkbox question
 *   lets one respondent tick several boxes, so its shares sum past 100% and the whole it
 *   would divide does not exist. Ranking totals are Borda scores, not shares of anything.
 *
 *   a line joins neighbouring points and so asserts that the x axis has an order. That is
 *   true of a rating or a scale and false of a list of options, where the order is just
 *   however they were typed -- and sorting by count would make the line's shape an
 *   artefact of the sort.
 *
 * Keyed off what the summary actually renders rather than the raw answer type, because
 * several types share a branch (a preset such as NPS renders as its underlying scale).
 *
 * @param {object} shape what the summary is drawing
 * @param {string} shape.type the question's answer type
 * @param {boolean} shape.isNumeric true when it renders as an ordered numeric distribution
 * @param {boolean} shape.isPredefined true when it renders as counted options
 * @param {boolean} shape.isNumericGrid true when a grid holds averages rather than counts
 * @param {number} shape.columnCount how many columns a grid has
 * @return {{forms: string[], preferred: ?string}} the allowed forms, best first
 */
export function chartFormsFor({
	type,
	isNumeric = false,
	isPredefined = false,
	isNumericGrid = false,
	columnCount = 0,
}) {
	if (type === 'ranking') {
		return { forms: ['bars', 'columns'], preferred: 'bars' }
	}
	if (isNumeric) {
		// An ordered scale: a line is meaningful here and nowhere else.
		return { forms: ['columns', 'bars', 'line'], preferred: 'columns' }
	}
	// Note "likert" is not tested here and must not be: it is an entry in the add-question
	// menu rather than a stored type, and a question made from it is stored as a grid.
	if (type === 'grid') {
		// Stacking is adding up, so it needs cells that can be added up. A grid of
		// numbers holds an average per cell, and a stack of averages is not a quantity
		// anyone has -- so that grid keeps the heatmap and is offered nothing else.
		// A stack identifies its segments by colour, and past the categorical palette
		// there are no further colours that can be told apart -- so a wide grid keeps
		// the heatmap, which identifies a column by its heading instead and was built
		// to be scrolled sideways.
		if (isNumericGrid || columnCount > MAX_SERIES) {
			return { forms: ['heatmap'], preferred: 'heatmap' }
		}
		return { forms: ['heatmap', 'stacked'], preferred: 'heatmap' }
	}
	// A checkbox question, and a conditional one. The checkbox case is the plain one: a
	// respondent may tick several boxes. The conditional case is a question of evidence
	// rather than of shape -- what one records depends on its trigger -- and a ring is
	// only offered where the whole it divides is known to exist, so it is withheld until
	// that is established. Withholding a chart that would have been fine is the cheaper
	// mistake of the two by a wide margin.
	if (type === 'multiple' || type === 'conditional') {
		return { forms: ['bars', 'columns'], preferred: 'bars' }
	}
	if (isPredefined) {
		// Single choice: exactly one answer each, so the counts do form a whole.
		return { forms: ['bars', 'columns', 'ring'], preferred: 'bars' }
	}
	return { forms: [], preferred: null }
}

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

/** Height reserved for a horizontal category label under a column. */
const COLUMN_LABEL_BAND = 44

/** Above this many columns the labels are turned, when the width is not yet known. */
const COLUMN_ROTATE_ABOVE = 6

/** A column with less room than this for its label has to have it turned. */
const COLUMN_UPRIGHT_SLOT = 88

/**
 * Narrower than this per column and the chart stops being a chart.
 *
 * Turning the labels buys room down to about here; past it they overlap whatever angle
 * they are at, and the honest answer is a different arrangement rather than a cleverer
 * one. Horizontal bars have no such limit -- they grow downwards, and the page scrolls.
 */
const COLUMN_MIN_SLOT = 44

/**
 * Whether upright columns can be read at this width.
 *
 * @param {number} width the plot's width in pixels, 0 when not yet measured
 * @param {number} count how many categories there are
 * @return {boolean} false when the categories should be laid out as rows instead
 */
export function fitsAsColumns(width, count) {
	if (!width || !count) {
		// Nothing measured yet. Assume it fits rather than flashing the wrong
		// arrangement and then correcting it a frame later.
		return true
	}
	return width / count >= COLUMN_MIN_SLOT
}

/**
 * Whether the category labels have to be turned to fit under their columns.
 *
 * @param {number} width the plot's width in pixels, 0 when not yet measured
 * @param {number} count how many categories there are
 * @return {boolean} true when the labels should be angled
 */
function turnsLabels(width, count) {
	if (!width) {
		return count > COLUMN_ROTATE_ABOVE
	}
	return width / count < COLUMN_UPRIGHT_SLOT
}

/** Height reserved once the labels are turned. */
const COLUMN_LABEL_BAND_ROTATED = 92

/**
 * Vertical magnitude columns -- the same data as `barOption`, stood up.
 *
 * The one real difference is the category labels. Along the bottom they have only their
 * own column's width to live in, where a horizontal bar chart could give them a whole
 * gutter and wrap them freely. So past a handful of columns they are turned rather than
 * squeezed: a turned label stays complete and readable, whereas a squeezed one either
 * wraps to a stack of single words or is cut off with an ellipsis, and an option that has
 * been cut off can no longer be told apart from another option with the same opening
 * words. Anything long enough to still not fit is trimmed by ECharts, which is why the
 * tooltip repeats the name in full.
 *
 * @param {object} spec the chart inputs
 * @param {object[]} spec.items columns, ordered by the caller
 * @param {string[]} spec.colours one colour per column, aligned to items
 * @param {object} spec.theme resolved palette and chrome colours
 * @param {number} [spec.max] value that should fill the track
 * @param {boolean} [spec.hidePercentage] true for counts that are not shares of a whole
 * @param {number} [spec.width] the plot's width, which decides whether labels are turned
 * @return {object} the ECharts option
 */
export function columnOption({
	items,
	colours,
	theme,
	max = 0,
	hidePercentage = false,
	width = 0,
}) {
	const largest = Math.max(max, ...items.map((item) => Number(item.value) || 0))
	const rotate = turnsLabels(width, items.length)
	const band = rotate ? COLUMN_LABEL_BAND_ROTATED : COLUMN_LABEL_BAND
	// A turned label is aligned by its far end so it points at its own column, which is
	// the opposite end when the form reads right to left.
	let turnedAlign = 'center'
	if (rotate) {
		turnedAlign = theme.rtl ? 'left' : 'right'
	}

	return {
		aria: { enabled: true },
		animationDuration: 400,
		backgroundColor: 'transparent',
		grid: {
			// Room above for the value sitting on top of the tallest column.
			top: CHART_PADDING + 12,
			bottom: band,
			left: CHART_PADDING,
			right: CHART_PADDING,
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
			type: 'category',
			data: items.map((item) => item.label),
			// Reading order runs the other way in a right-to-left form.
			inverse: theme.rtl,
			axisLine: { lineStyle: { color: theme.track } },
			axisTick: { show: false },
			axisLabel: {
				color: theme.ink,
				// Every category is named; dropping some would leave unlabelled columns.
				interval: 0,
				rotate: rotate ? 35 : 0,
				align: turnedAlign,
				verticalAlign: rotate ? 'top' : 'middle',
				width: rotate ? COLUMN_LABEL_BAND_ROTATED : undefined,
				overflow: rotate ? 'truncate' : 'break',
				lineHeight: 16,
				formatter: (label, index) =>
					items[index]?.best ? `{best|${label}}` : label,
				rich: {
					best: {
						color: theme.ink,
						fontWeight: 'bold',
						lineHeight: 16,
					},
				},
			},
		},
		yAxis: {
			type: 'value',
			max: largest > 0 ? largest : 1,
			// Every column carries its own value on top.
			show: false,
		},
		series: [
			{
				type: 'bar',
				barMaxWidth: 48,
				data: items.map((item, index) => ({
					value: Number(item.value) || 0,
					itemStyle: {
						color: colours[index],
						borderRadius: [4, 4, 0, 0],
					},
				})),
				label: {
					show: true,
					position: 'top',
					color: theme.ink,
					fontWeight: 'bold',
					formatter: ({ dataIndex, value }) => {
						if (hidePercentage) {
							return String(value)
						}
						return `${value}  ${items[dataIndex]?.percentage}%`
					},
				},
				showBackground: true,
				backgroundStyle: {
					color: theme.track,
					borderRadius: [4, 4, 0, 0],
				},
			},
		],
	}
}

/**
 * The shape of an ordered distribution.
 *
 * Offered only where the categories are steps on a scale, because a line asserts that the
 * points either side of it are neighbours. On a list of options that is simply untrue, and
 * the slope drawn between two unrelated answers reads as a trend that does not exist.
 *
 * A step nobody picked is drawn as a zero rather than as a gap. On a rating or a scale the
 * buckets are known in advance and complete, so "nobody chose 3" is a real, measured zero
 * -- not a missing reading. Breaking the line there would suggest the value is unknown,
 * and joining straight over it would invent a value halfway between its neighbours; the
 * zero is the only one of the three that is true.
 *
 * @param {object} spec the chart inputs
 * @param {object[]} spec.items points in scale order
 * @param {object} spec.theme resolved palette and chrome colours
 * @param {string} spec.colour the single series colour
 * @param {number} [spec.max] value that should reach the top
 * @param {boolean} [spec.hidePercentage] true for counts that are not shares of a whole
 * @return {object} the ECharts option
 */
export function lineOption({
	items,
	theme,
	colour,
	max = 0,
	hidePercentage = false,
}) {
	const largest = Math.max(max, ...items.map((item) => Number(item.value) || 0))

	return {
		aria: { enabled: true },
		animationDuration: 400,
		backgroundColor: 'transparent',
		grid: {
			top: CHART_PADDING + 12,
			bottom: COLUMN_LABEL_BAND,
			left: CHART_PADDING + 24,
			right: CHART_PADDING + 12,
		},
		tooltip: {
			// The point of a line is comparing neighbours, so the pointer picks the
			// nearest step rather than demanding a hit on the marker itself.
			trigger: 'axis',
			confine: true,
			formatter: (params) => {
				const point = Array.isArray(params) ? params[0] : params
				const item = items[point.dataIndex] ?? {}
				const parts = [`<strong>${point.value}</strong>`]
				if (!hidePercentage) {
					parts.push(`(${item.percentage}%)`)
				}
				return `${point.name}<br>${parts.join(' ')}`
			},
		},
		xAxis: {
			type: 'category',
			data: items.map((item) => item.label),
			// A line has to touch both ends of the scale it describes.
			boundaryGap: false,
			inverse: theme.rtl,
			axisLine: { lineStyle: { color: theme.track } },
			axisTick: { show: false },
			axisLabel: { color: theme.ink },
		},
		yAxis: {
			type: 'value',
			max: largest > 0 ? largest : 1,
			// Counts are whole numbers; a tick at 2.5 responses is meaningless.
			minInterval: 1,
			position: theme.rtl ? 'right' : 'left',
			// The faint ink token, not the grey series colour: this is axis text.
			axisLabel: { color: theme.inkFaint },
			axisLine: { show: false },
			splitLine: { lineStyle: { color: theme.track } },
		},
		series: [
			{
				type: 'line',
				smooth: false,
				symbol: 'circle',
				symbolSize: 9,
				lineStyle: { width: 2, color: colour },
				itemStyle: { color: colour },
				areaStyle: {
					color: colour,
					opacity: 0.12,
				},
				data: items.map((item) => Number(item.value) || 0),
			},
		],
	}
}

/**
 * A grid as one stacked bar per row.
 *
 * The companion to the heatmap, answering the other question people ask of a grid. A
 * heatmap is read a cell at a time -- where did this row and this column meet? -- while a
 * stack is read a row at a time, and makes the shape of one row's answers comparable with
 * the next row's at a glance.
 *
 * Counts are stacked as they are rather than stretched to a common width. Rows of a grid
 * do not all attract the same number of answers, and rescaling every row to the same
 * length would hide exactly that: a row two people answered would look as substantial as
 * one that fifty answered.
 *
 * @param {object} spec the chart inputs
 * @param {object[]} spec.rows `{ label, values }`, one value per column
 * @param {object[]} spec.columns `{ label }`, the stack segments in order
 * @param {string[]} spec.colours one colour per column, aligned to columns
 * @param {object} spec.theme resolved palette and chrome colours
 * @param {number} [spec.width] the plot's width, used to size the label column
 * @return {object} the ECharts option
 */
export function stackedOption({ rows, columns, colours, theme, width = 0 }) {
	const labelWidth = labelWidthFor(width)
	const labelGutter = labelWidth + 12
	const totals = rows.map((row) =>
		(row.values ?? []).reduce((sum, value) => sum + (Number(value) || 0), 0),
	)

	return {
		aria: { enabled: true },
		animationDuration: 400,
		backgroundColor: 'transparent',
		grid: {
			top: CHART_PADDING,
			bottom: CHART_PADDING,
			left: theme.rtl ? CHART_PADDING : labelGutter,
			right: theme.rtl ? labelGutter : CHART_PADDING,
		},
		tooltip: {
			trigger: 'item',
			confine: true,
			formatter: (params) => {
				const total = totals[params.dataIndex] || 0
				const share = total ? Math.round((params.value / total) * 100) : 0
				return `${params.name}<br>${params.seriesName}: <strong>${params.value}</strong> (${share}%)`
			},
		},
		xAxis: {
			type: 'value',
			show: false,
			inverse: theme.rtl,
		},
		yAxis: {
			type: 'category',
			data: rows.map((row) => row.label),
			inverse: true,
			position: theme.rtl ? 'right' : 'left',
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: {
				color: theme.ink,
				width: labelWidth,
				overflow: 'break',
				lineHeight: 16,
			},
		},
		series: columns.map((column, columnIndex) => ({
			type: 'bar',
			name: column.label,
			stack: 'grid',
			barMaxWidth: 22,
			itemStyle: {
				color: colours[columnIndex],
				// A hairline in the surface colour separates neighbouring segments
				// without introducing another hue.
				borderColor: theme.surface,
				borderWidth: 1,
			},
			// No number printed on the segment. Text sitting on a filled segment takes
			// its contrast from whichever series colour happens to be underneath it, and
			// a segment narrow enough to be interesting is too narrow to hold a number
			// anyway. This form is for the shape of a row; the heatmap, which is what a
			// grid shows by default, is where the counts are read.
			label: { show: false },
			data: rows.map((row) => Number(row.values?.[columnIndex]) || 0),
		})),
	}
}

/** Plot height for the forms whose categories run along the bottom. */
export const PLOT_HEIGHT = 240

/**
 * How tall a magnitude figure needs to be.
 *
 * A horizontal bar chart grows with its data, because each row needs a row. The upright
 * forms do not: their categories share the width, so the height is the plot plus whatever
 * the labels underneath it need.
 *
 * @param {string} form one of bars, columns, line
 * @param {number} count how many categories there are
 * @param {number} [width] the plot's width, which decides whether labels are turned
 * @return {number} the height in pixels
 */
export function figureHeight(form, count, width = 0) {
	if (form === 'bars') {
		return count * ROW_HEIGHT + CHART_PADDING * 2
	}
	if (form === 'line') {
		return PLOT_HEIGHT + COLUMN_LABEL_BAND
	}
	return (
		PLOT_HEIGHT
		+ (turnsLabels(width, count) ? COLUMN_LABEL_BAND_ROTATED : COLUMN_LABEL_BAND)
	)
}
