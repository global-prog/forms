<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  horizontal magnitude bars.

  Deliberately HTML/CSS rather than SVG. Three reasons, all of which cost real code in SVG:
    * RTL comes free. CSS `direction` mirrors flex order and logical border radii, so bars
      grow from the correct edge on an Arabic form without a single mirroring calculation.
      SVG geometry does not inherit `direction`.
    * It prints. See the print rules at the bottom -- a `<meter>`, which is what this
      replaces, is a native widget that browsers routinely render blank on paper.
    * The label and the number are real selectable text, so the chart *is* its own
      table view rather than needing one alongside.

  Colour encodes nothing here: bar length already carries magnitude, and colouring each bar
  differently would double-encode one variable as two channels. Every bar therefore takes the
  same single hue, and the largest is marked with weight on its label, not a second colour.
-->
<template>
	<div class="chart-bars">
		<ol class="chart-bars__list">
			<li
				v-for="(item, index) in items"
				:key="item.key ?? index"
				class="chart-bars__row">
				<div class="chart-bars__head">
					<span
						class="chart-bars__label"
						:class="{ 'chart-bars__label--best': item.best }"
						dir="auto">
						{{ item.label }}
					</span>
					<span class="chart-bars__value">
						{{ item.value }}
						<span v-if="!hidePercentage" class="chart-bars__percentage">
							({{ item.percentage }}%)
						</span>
						<span v-if="item.note" class="chart-bars__percentage">
							{{ item.note }}
						</span>
					</span>
				</div>
				<!-- decorative: every number it depicts is already stated above in text -->
				<div class="chart-bars__track" aria-hidden="true">
					<div
						class="chart-bars__fill"
						:class="{ 'chart-bars__fill--muted': item.muted }"
						:style="{ inlineSize: widthOf(item) }" />
				</div>
			</li>
		</ol>
	</div>
</template>

<script>
export default {
	name: 'ChartBars',

	props: {
		/**
		 * Rows to draw, already aggregated and ordered by the caller.
		 * `{ key?, label, value, percentage, note?, best?, muted? }`
		 */
		items: {
			type: Array,
			required: true,
		},

		/** Value that should fill the whole track. Falls back to the largest value. */
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
		/** @return {number} the denominator for bar length, never zero */
		scale() {
			const largest = Math.max(
				this.max,
				...this.items.map((item) => Number(item.value) || 0),
			)
			return largest > 0 ? largest : 1
		},
	},

	methods: {
		/**
		 * @param {object} item the row being drawn
		 * @return {string} the CSS inline size for its fill
		 */
		widthOf(item) {
			const value = Number(item.value) || 0
			if (value <= 0) {
				return '0'
			}
			// Floor at 2px so a single response stays visible instead of rounding away.
			return `max(2px, ${(100 * value) / this.scale}%)`
		},
	},
}
</script>

<style lang="scss" scoped>
.chart-bars {
	&__list {
		display: flex;
		flex-direction: column;
		// 2px of surface between adjacent fills, per the mark spec.
		gap: 10px;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	&__head {
		display: flex;
		gap: 12px;
		justify-content: space-between;
		// Long option text must wrap rather than push the number off the row.
		align-items: baseline;
		margin-bottom: 2px;
	}

	&__label {
		min-width: 0;
		overflow-wrap: anywhere;

		// The leading answer is marked with weight rather than a second colour, so the
		// emphasis survives greyscale printing and colour-blind vision alike.
		&--best {
			font-weight: bold;
		}
	}

	&__value {
		color: var(--color-main-text);
		flex: 0 0 auto;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}

	&__percentage {
		color: var(--color-text-maxcontrast);
		font-weight: normal;
	}

	&__track {
		background-color: var(--color-background-dark);
		block-size: 8px;
		border-radius: 4px;
		overflow: hidden;
		inline-size: 100%;
	}

	&__fill {
		background-color: var(--chart-series-1);
		block-size: 100%;
		// Logical radii: rounds the growing end in both LTR and RTL without a mirror rule.
		border-start-end-radius: 4px;
		border-end-end-radius: 4px;

		&--muted {
			background-color: var(--chart-muted);
		}
	}
}

// Bars are the whole point of the summary, so force them onto paper. Without
// print-color-adjust every fill is dropped as a "background" and the report prints empty.
@media print {
	.chart-bars {
		&__track,
		&__fill {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}

		&__row {
			break-inside: avoid;
		}
	}
}
</style>
