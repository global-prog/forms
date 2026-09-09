<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  horizontal magnitude bars.

  Horizontal rather than vertical because option text is prose, and often long prose in a
  language the form author did not choose. Down the side it can wrap; along the bottom it
  would have to be rotated or truncated.

  Colour encodes nothing: bar length already carries magnitude, so colouring each bar
  differently would spend a second channel on a variable that is already shown. Every bar
  takes the same hue, and the leading answer is marked with weight on its label. The one
  exception is a row the caller marks `muted` -- "No response" -- which is grey because it
  is the absence of a choice rather than one of the choices.
-->
<template>
	<div class="chart-bars">
		<!-- eslint-disable vue/no-unused-refs -- the ref is read by EchartMixin -->
		<div
			v-show="ready"
			ref="chart"
			class="chart-bars__canvas"
			role="img"
			:style="{ blockSize: `${height}px` }" />
		<!-- eslint-enable vue/no-unused-refs -->

		<!-- Every value the chart would draw, as text. This is the fallback when the
		     library cannot load, and it is also what satisfies the requirement that no
		     number is carried by colour alone. -->
		<dl v-if="failed" class="chart-bars__fallback">
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
import { barOption, CHART_PADDING, ROW_HEIGHT } from './chartOptions.js'
import EchartMixin from './EchartMixin.js'

export default {
	name: 'ChartBars',

	mixins: [EchartMixin],

	props: {
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
		/** @return {number} height the plot needs to give every row a row of its own */
		height() {
			return this.items.length * ROW_HEIGHT + CHART_PADDING * 2
		},
	},

	methods: {
		/**
		 * @param {object} theme the resolved palette and chrome colours
		 * @param {number} width the plot's measured width
		 * @return {object} the ECharts option
		 */
		chartOption(theme, width) {
			return barOption({
				items: this.items,
				colours: this.seriesColours(theme),
				theme,
				max: this.max,
				hidePercentage: this.hidePercentage,
				width,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.chart-bars {
	&__canvas {
		inline-size: 100%;
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
	.chart-bars {
		break-inside: avoid;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
}
</style>
