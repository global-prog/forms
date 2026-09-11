<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  One question's answers as magnitude: bars, columns, or a line.

  All three draw the same numbers and differ only in how they are arranged, so they share
  one component -- and, more to the point, one text fallback, so whichever form is on
  screen the values are also present as text.

  Bars are the default nearly everywhere. Option text is prose, and often long prose in a
  language the form author did not choose; down the side it can wrap, whereas along the
  bottom it has to be turned or cut. Columns are offered because they are what most people
  picture when they picture a chart, and a scale reads more naturally left to right than
  top to bottom. The line is offered only where the categories are steps on a scale.

  Colour encodes nothing in the bar and column forms: length already carries magnitude, so
  colouring each bar differently would spend a second channel on a variable that is already
  shown. The leading answer is marked with weight on its label instead. The one exception
  is a row the caller marks `muted` -- "No response" -- which is grey because it is the
  absence of a choice rather than one of the choices.
-->
<template>
	<div class="chart-figure">
		<!-- eslint-disable vue/no-unused-refs -- the ref is read by EchartMixin -->
		<div
			v-show="ready"
			ref="chart"
			class="chart-figure__canvas"
			role="img"
			:style="{ blockSize: `${height}px` }" />
		<!-- eslint-enable vue/no-unused-refs -->

		<!-- Every value the chart would draw, as text. This is the fallback when the
		     library cannot load, and it is also what satisfies the requirement that no
		     number is carried by colour alone. -->
		<dl v-if="failed" class="chart-figure__fallback">
			<template v-for="(item, index) in items" :key="item.key ?? index">
				<dt dir="auto">{{ item.label }}</dt>
				<dd>
					{{ item.value }}
					<span v-if="!hidePercentage">({{ item.percentage }}%)</span>
					<span v-if="item.note">{{ item.note }}</span>
				</dd>
			</template>
		</dl>
	</div>
</template>

<script>
import {
	barOption,
	columnOption,
	figureHeight,
	fitsAsColumns,
	lineOption,
} from './chartOptions.js'
import EchartMixin from './EchartMixin.js'

/** The forms this component knows how to draw. */
const FORMS = ['bars', 'columns', 'line']

export default {
	name: 'ChartFigure',

	mixins: [EchartMixin],

	props: {
		/** Which arrangement to draw. The summary decides which are offered at all. */
		form: {
			type: String,
			default: 'bars',
			validator: (value) => FORMS.includes(value),
		},

		/** Value that should fill the track. Falls back to the largest value present. */
		max: {
			type: Number,
			default: 0,
		},

		/** Ranking totals and value distributions are counts, not shares of a whole. */
		hidePercentage: {
			type: Boolean,
			default: false,
		},
	},

	computed: {
		/**
		 * The arrangement actually drawn.
		 *
		 * Upright columns need a certain width each before their labels can be read, and
		 * on a narrow screen a question with many options does not have it -- turning the
		 * labels buys some room, but past a point they overlap at any angle. Rows have no
		 * such limit, because they grow downwards and the page scrolls, so that is what a
		 * too-narrow column chart becomes.
		 *
		 * The picker still shows what the reader chose: this is about the room available,
		 * not about the choice, and it reverses the moment there is room again -- on a
		 * phone turned sideways, or a widened window.
		 *
		 * @return {string} the form to draw
		 */
		effectiveForm() {
			if (
				this.form === 'columns'
				&& !fitsAsColumns(this.plotWidth, this.items.length)
			) {
				return 'bars'
			}
			return this.form
		},

		/** @return {number} the height this arrangement needs */
		height() {
			return figureHeight(
				this.effectiveForm,
				this.items.length,
				this.plotWidth,
			)
		},
	},

	watch: {
		// Switching arrangement changes the height as well as the option, and the chart
		// has to be told the box it lives in has changed size.
		form() {
			this.paint()
			this.$nextTick(() => this.chart?.resize())
		},
	},

	methods: {
		/**
		 * One colour for every bar, grey for a muted one.
		 *
		 * Deliberately not the mixin's `seriesColours`, which gives each row its own
		 * categorical hue. That is right for a ring, where colour is how a slice is
		 * matched to its legend entry, and wrong here: a bar's length already says how
		 * big it is and its label says what it is, so a hue per bar spends a second
		 * channel on nothing and invites the reader to look for a meaning in it.
		 *
		 * @param {object} theme the resolved palette and chrome colours
		 * @return {string[]} a colour per row, aligned to items
		 */
		magnitudeColours(theme) {
			const hue = theme.series[0] ?? theme.ink
			return this.items.map((item) => (item.muted ? theme.muted : hue))
		},

		/**
		 * @param {object} theme the resolved palette and chrome colours
		 * @param {number} width the plot's measured width
		 * @return {object} the ECharts option
		 */
		chartOption(theme, width) {
			const shared = {
				items: this.items,
				theme,
				max: this.max,
				hidePercentage: this.hidePercentage,
			}
			if (this.effectiveForm === 'line') {
				return lineOption({
					...shared,
					// A line is one series, so it takes one colour rather than a colour
					// per point: a multicoloured line would imply the hue meant something.
					colour: theme.series[0],
				})
			}
			if (this.effectiveForm === 'columns') {
				return columnOption({
					...shared,
					colours: this.magnitudeColours(theme),
					width,
				})
			}
			return barOption({
				...shared,
				colours: this.magnitudeColours(theme),
				width,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.chart-figure {
	&__canvas {
		inline-size: 100%;

		// ECharts mirrors a right-to-left chart itself, from the direction this box
		// reports -- it inverts the axes and moves the labels across. The SVG it draws
		// must not ALSO inherit that direction: in SVG, `direction` changes what
		// text-anchor "start" means, so every label would then run away from its anchor,
		// into the bars instead of into its gutter, and be drawn over. The box keeps the
		// form's direction for the chart to read; only the drawing is held left to right.
		:deep(svg) {
			direction: ltr;
		}
	}

	&__fallback {
		display: grid;
		gap: 2px 12px;
		grid-template-columns: 1fr auto;
		margin: 0;

		dt {
			min-inline-size: 0;
			overflow-wrap: anywhere;
		}

		dd {
			font-variant-numeric: tabular-nums;
			font-weight: 600;
			margin: 0;
			white-space: nowrap;

			span {
				color: var(--color-text-maxcontrast);
				font-weight: normal;
			}
		}
	}
}

// The chart is the point of the summary, so force it onto paper: without this a browser
// treats the fills as decorative backgrounds and prints an empty frame.
@media print {
	.chart-figure {
		break-inside: avoid;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
}
</style>
