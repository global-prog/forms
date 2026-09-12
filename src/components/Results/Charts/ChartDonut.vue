<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  part-to-whole ring, for single-choice questions only.

  Only single choice. A checkbox question must never be drawn as a ring: a respondent may
  tick several boxes, so the shares sum past 100% and the ring would depict a whole that
  does not exist. Those questions get ChartFigure instead, and the caller enforces it.

  The legend is HTML rather than the chart library's own, on purpose. It is then ordinary
  selectable text that wraps and mirrors with the rest of the page, it keeps every count
  and share readable when a slice is too thin to label, and it means identity is never
  carried by colour alone -- which is what lets the ring itself stay free of leader lines
  that would collide with long option text.
-->
<template>
	<div class="chart-donut">
		<!-- The legend beside it names every segment with its share, so the ring itself
		     carries nothing a screen reader needs. -->
		<!-- eslint-disable vue/no-unused-refs -- the ref is read by EchartMixin -->
		<div
			v-show="ready"
			ref="chart"
			class="chart-donut__ring"
			aria-hidden="true" />
		<!-- eslint-enable vue/no-unused-refs -->

		<ol class="chart-donut__legend">
			<li
				v-for="segment in segments"
				:key="segment.key"
				class="chart-donut__legend-item">
				<span
					class="chart-donut__swatch"
					:style="{ backgroundColor: segment.colour }"
					aria-hidden="true" />
				<span class="chart-donut__legend-label" dir="auto">
					{{ segment.label }}
				</span>
				<span class="chart-donut__legend-value">
					{{ segment.value }}
					<span class="chart-donut__legend-percentage">
						({{ segment.percentage }}%)
					</span>
				</span>
			</li>
		</ol>
	</div>
</template>

<script>
import { donutOption } from './chartOptions.js'
import EchartMixin from './EchartMixin.js'

/** Slices past this fold into a single grey "Other". Beyond ~7 hues stop being separable. */
const MAX_SLICES = 7

export default {
	name: 'ChartDonut',

	mixins: [EchartMixin],

	computed: {
		/** @return {number} every response the ring accounts for */
		total() {
			return this.slices.reduce(
				(sum, slice) => sum + (Number(slice.value) || 0),
				0,
			)
		},

		/**
		 * The rows actually drawn: empty options dropped, and any tail folded into one
		 * grey entry rather than given hues that cannot be told apart.
		 *
		 * @return {object[]} the slices
		 */
		slices() {
			const kept = this.items.filter((item) => (Number(item.value) || 0) > 0)
			if (kept.length <= MAX_SLICES) {
				return kept
			}
			const head = kept.slice(0, MAX_SLICES - 1)
			const tail = kept.slice(MAX_SLICES - 1)
			return [
				...head,
				{
					key: '__other__',
					label: t('forms', 'Other ({count} options)', {
						count: tail.length,
					}),

					value: tail.reduce(
						(sum, item) => sum + (Number(item.value) || 0),
						0,
					),

					muted: true,
				},
			]
		},

		/**
		 * Which categorical slot each slice takes, or null for a grey one.
		 *
		 * Computed once and read by both the legend and the ring, so the two can never
		 * disagree about which colour belongs to which slice. A grey slice -- a folded
		 * tail, or an unanswered question -- takes no slot, so it does not shift every
		 * real choice's hue along by one.
		 *
		 * @return {Array<?number>} a zero-based slot per slice, null where grey
		 */
		slotAssignment() {
			let slot = 0
			return this.slices.map((slice) => (slice.muted ? null : slot++))
		},

		/**
		 * The legend rows.
		 *
		 * Swatches are given the CSS custom property rather than a resolved colour, so
		 * they follow the theme by themselves and are correct on first paint instead of
		 * waiting for the chart to report back.
		 *
		 * @return {object[]} label, count, share and swatch colour per slice
		 */
		segments() {
			const total = this.total || 1
			return this.slices.map((slice, index) => {
				const slot = this.slotAssignment[index]
				return {
					key: slice.key ?? index,
					label: slice.label,
					value: slice.value,
					percentage: Math.round((100 * slice.value) / total),
					colour:
						slot === null
							? 'var(--chart-muted)'
							: `var(--chart-series-${(slot % 7) + 1})`,
				}
			})
		},
	},

	methods: {
		/**
		 * @param {object} theme the resolved palette and chrome colours
		 * @return {object} the ECharts option
		 */
		chartOption(theme) {
			const slots = theme.series.length || 1
			return donutOption({
				slices: this.slices,
				// The library needs resolved colours; the legend uses the same slots as
				// CSS custom properties. Both read slotAssignment, so they cannot disagree.
				colours: this.slotAssignment.map((slot) =>
					slot === null ? theme.muted : theme.series[slot % slots],
				),
				total: this.total,
				theme,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.chart-donut {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: 24px;

	&__ring {
		block-size: 190px;
		flex: 0 0 auto;
		inline-size: 190px;

		// See ChartFigure: the chart mirrors itself, the drawing must not mirror again.
		:deep(svg) {
			direction: ltr;
		}
	}

	&__legend {
		display: flex;
		flex: 1 1 240px;
		flex-direction: column;
		gap: 6px;
		list-style: none;
		margin: 0;
		min-inline-size: 0;
		padding: 0;
	}

	&__legend-item {
		align-items: baseline;
		display: flex;
		gap: 8px;
	}

	&__swatch {
		block-size: 10px;
		border-radius: 2px;
		flex: 0 0 auto;
		inline-size: 10px;
		// Sit on the text baseline rather than above it.
		transform: translateY(1px);
	}

	&__legend-label {
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	&__legend-value {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
		margin-inline-start: auto;
		white-space: nowrap;
	}

	&__legend-percentage {
		color: var(--color-text-maxcontrast);
		font-weight: normal;
	}
}

@media print {
	.chart-donut {
		break-inside: avoid;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;

		&__swatch {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
	}
}
</style>
