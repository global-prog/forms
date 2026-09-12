<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  grid question heatmap.

  Still a real <table> -- the grid already was one, and a table mirrors in RTL, prints, and is
  navigable by screen reader without any of it being re-implemented. The only addition is that
  each cell is tinted by magnitude, so the busy corner of a 39-row matrix is findable at a
  glance instead of by reading every number.

  Sequential, one hue, because a grid's columns are arbitrary text: `extraSettings.questionType`
  may be radio, checkbox or number, and nothing guarantees the columns are ordered or
  symmetric. A diverging scale would assert a polarity ("good" one end, "bad" the other) that
  the data has not earned. Where the columns really are an ordered scale, magnitude still reads
  correctly -- it simply does not claim a midpoint.

  The tint is capped below full strength so the number printed on top keeps its contrast; the
  value is always present as text, which is what carries the data.
-->
<template>
	<div class="chart-heatmap" :class="{ 'chart-heatmap--wrap-labels': wrapLabels }">
		<table class="chart-heatmap__table">
			<caption v-if="caption" class="chart-heatmap__caption" dir="auto">
				{{
					caption
				}}
			</caption>
			<thead>
				<tr>
					<th class="chart-heatmap__corner" scope="col"></th>
					<th
						v-for="column in columns"
						:key="column.key"
						class="chart-heatmap__column-head"
						scope="col"
						dir="auto">
						{{ column.label }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(row, rowIndex) in rows" :key="row.key">
					<th class="chart-heatmap__row-head" scope="row" dir="auto">
						{{ row.label }}
					</th>
					<td
						v-for="(cell, columnIndex) in cells[rowIndex]"
						:key="columns[columnIndex].key"
						class="chart-heatmap__cell"
						:style="{ '--cell-intensity': intensityOf(cell) }">
						{{ cell.display }}
					</td>
				</tr>
			</tbody>
		</table>
	</div>
</template>

<script>
/**
 * Strongest tint applied to the busiest cell. Held well below 1 so the value stays legible
 * on top of it in both themes -- the shading is a wayfinding aid, not the data.
 */
const MAX_TINT = 0.55

export default {
	name: 'ChartHeatmap',

	props: {
		/** `{ key, label }` per row */
		rows: {
			type: Array,
			required: true,
		},

		/** `{ key, label }` per column */
		columns: {
			type: Array,
			required: true,
		},

		/** rows x columns of `{ value, display }`, aligned to the arrays above */
		cells: {
			type: Array,
			required: true,
		},

		/** What the table shows, read out before it; omitted when the heading says so */
		caption: {
			type: String,
			required: false,
			default: '',
		},

		/** Whether the labels are long enough to need wrapping, as a cross-tab's are */
		wrapLabels: {
			type: Boolean,
			default: false,
		},
	},

	computed: {
		/** @return {number} the busiest cell, and never zero */
		peak() {
			let peak = 0
			for (const row of this.cells) {
				for (const cell of row) {
					peak = Math.max(peak, Number(cell.value) || 0)
				}
			}
			return peak > 0 ? peak : 1
		},
	},

	methods: {
		/**
		 * @param {object} cell the cell being drawn
		 * @return {number} its tint strength, 0 to MAX_TINT
		 */
		intensityOf(cell) {
			const value = Number(cell.value) || 0
			if (value <= 0) {
				return 0
			}
			return ((value / this.peak) * MAX_TINT).toFixed(3)
		},
	},
}
</script>

<style lang="scss" scoped>
.chart-heatmap {
	// A 39-row grid is wider than any phone; scroll the table, never the page.
	overflow-x: auto;

	&__caption {
		color: var(--color-text-maxcontrast);
		margin-block-end: 8px;
		text-align: start;
	}

	&__table {
		border-collapse: separate;
		// 2px of surface between adjacent fills, so tints read as cells not as a wash.
		border-spacing: 2px;
	}

	&__column-head,
	&__row-head {
		color: var(--color-text-maxcontrast);
		font-weight: normal;
		padding: 4px 8px;
		text-align: start;
	}

	// A cross-tab's labels are whole question options, which can be sentences. They wrap
	// within a sane width rather than stretching the table off the screen. A grid's
	// headers are short by nature and are left at the width they have always had.
	&--wrap-labels &__column-head,
	&--wrap-labels &__row-head {
		max-inline-size: 22ch;
		overflow-wrap: break-word;
	}

	&__row-head {
		// Keep the row label readable while the matrix scrolls under it.
		background-color: var(--color-main-background);
		inset-inline-start: 0;
		position: sticky;
	}

	&--wrap-labels &__row-head {
		// Wide enough to read, narrow enough to leave room for the matrix on a phone.
		min-inline-size: 8rem;
	}

	&__cell {
		border-radius: var(--border-radius, 4px);
		font-variant-numeric: tabular-nums;
		min-inline-size: 64px;
		padding: 6px 8px;
		text-align: center;
		// Declared first as the fallback: without color-mix the table simply shows no
		// tint, which loses the wayfinding aid but never the numbers.
		background-color: transparent;
		background-color: color-mix(
			in srgb,
			var(--chart-series-1) calc(var(--cell-intensity, 0) * 100%),
			transparent
		);
	}
}

@media print {
	.chart-heatmap {
		overflow-x: visible;
		break-inside: avoid;

		&__cell {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
	}
}
</style>
