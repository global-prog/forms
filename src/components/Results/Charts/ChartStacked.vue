<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  A grid as one stacked bar per row.

  The companion to the heatmap, and it answers a different question. A heatmap is read a
  cell at a time -- where did this row and this column meet? -- while a stack is read a row
  at a time, so the shape of one row's answers can be compared with the next row's at a
  glance.

  Counts are stacked as they are rather than stretched to a common width, because the rows
  of a grid do not all attract the same number of answers. Rescaling every row to the same
  length would hide precisely that: a row two people answered would look as substantial as
  one that fifty answered.

  Here colour does carry identity -- each column is a different thing -- so it is the one
  chart form in the summary that needs a legend, and the legend is HTML for the same
  reasons as the ring's: it wraps, it mirrors, it is selectable, and it means the columns
  are named in text rather than only in colour.
-->
<template>
	<div class="chart-stacked">
		<!-- eslint-disable vue/no-unused-refs -- the ref is read by EchartMixin -->
		<div
			v-show="ready"
			ref="chart"
			class="chart-stacked__canvas"
			role="img"
			:style="{ blockSize: `${height}px` }" />
		<!-- eslint-enable vue/no-unused-refs -->

		<ol class="chart-stacked__legend">
			<li
				v-for="(column, index) in columns"
				:key="column.key ?? index"
				class="chart-stacked__legend-item">
				<span
					class="chart-stacked__swatch"
					:style="{ backgroundColor: swatch(index) }"
					aria-hidden="true" />
				<span dir="auto">{{ column.label }}</span>
			</li>
		</ol>

		<!-- The whole matrix as text, for when the library cannot load. -->
		<table v-if="failed" class="chart-stacked__fallback">
			<thead>
				<tr>
					<td />
					<th
						v-for="(column, index) in columns"
						:key="column.key ?? index">
						{{ column.label }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, rowIndex) in items" :key="row.key ?? rowIndex">
					<th scope="row" dir="auto">{{ row.label }}</th>
					<td v-for="(value, index) in row.values" :key="index">
						{{ value }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script>
import { CHART_PADDING, ROW_HEIGHT, stackedOption } from './chartOptions.js'
import EchartMixin from './EchartMixin.js'

export default {
	name: 'ChartStacked',

	mixins: [EchartMixin],

	props: {
		/** The stack segments, in order: `{ key, label }` per grid column. */
		columns: {
			type: Array,
			required: true,
		},
	},

	computed: {
		/** @return {number} height enough to give every grid row a row of its own */
		height() {
			return this.items.length * ROW_HEIGHT + CHART_PADDING * 2
		},
	},

	watch: {
		columns: {
			deep: true,
			handler() {
				this.paint()
			},
		},
	},

	methods: {
		/**
		 * The legend swatch for a column.
		 *
		 * Given as the CSS custom property rather than a resolved colour, so it follows
		 * the theme by itself and is right on first paint instead of waiting for the
		 * chart to report back.
		 *
		 * @param {number} index the column's position
		 * @return {string} a CSS colour value
		 */
		swatch(index) {
			return `var(--chart-series-${(index % 7) + 1})`
		},

		/**
		 * @param {object} theme the resolved palette and chrome colours
		 * @param {number} width the plot's measured width
		 * @return {object} the ECharts option
		 */
		chartOption(theme, width) {
			return stackedOption({
				rows: this.items,
				columns: this.columns,
				// One colour per column rather than per row, so the mixin's row-wise
				// helper is not what is wanted here.
				colours: this.columns.map((column, index) => {
					// readChartTheme returns an empty palette if the custom properties
					// do not resolve, and a remainder by zero is NaN, not a colour.
					const slots = theme.series.length || 1
					return theme.series[index % slots]
				}),

				theme,
				width,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.chart-stacked {
	&__canvas {
		inline-size: 100%;

		// See ChartFigure: the chart mirrors itself, the drawing must not mirror again.
		:deep(svg) {
			direction: ltr;
		}
	}

	&__legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 16px;
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}

	&__legend-item {
		align-items: center;
		display: flex;
		gap: 6px;
		min-inline-size: 0;
	}

	&__swatch {
		block-size: 12px;
		border-radius: 3px;
		flex: 0 0 auto;
		inline-size: 12px;
	}

	&__fallback {
		border-collapse: collapse;
		margin-block-start: 8px;

		th,
		td {
			padding: 2px 8px;
			text-align: start;
		}

		td {
			font-variant-numeric: tabular-nums;
		}
	}
}

@media print {
	.chart-stacked {
		break-inside: avoid;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
}
</style>
