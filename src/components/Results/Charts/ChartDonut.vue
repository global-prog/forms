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
		<p v-if="failed" class="chart-donut__note">
			{{
				t(
					'forms',
					'The chart could not be loaded. The figures are listed below.',
				)
			}}
		</p>
		<!-- eslint-disable vue/no-unused-refs -- the ref is read by EchartMixin -->
		<div
			v-show="!failed"
			ref="chart"
			class="chart-donut__ring"
			aria-hidden="true">
			<!-- Shown until the library arrives. ECharts adds its drawing alongside
			     whatever the box holds, and this is gone by the time it does. -->
			<NcLoadingIcon
				v-if="!ready && !failed"
				class="chart-donut__loading"
				:size="32" />
		</div>
		<!-- eslint-enable vue/no-unused-refs -->

		<ol class="chart-donut__legend">
			<!-- The options folded into one grey slice are still named, each under
			     the folded row, so no answer disappears from this view. They are rows
			     of the same list rather than a nested one, so they keep the legend's
			     columns, and the downloaded key picks them up as well. -->
			<template v-for="segment in segments" :key="segment.key">
				<li class="chart-donut__legend-item">
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
				<li
					v-for="child in segment.children"
					:key="`${segment.key}-${child.key}`"
					class="chart-donut__legend-item chart-donut__legend-item--sub">
					<span class="chart-donut__swatch" aria-hidden="true" />
					<span class="chart-donut__legend-label" dir="auto">
						{{ child.label }}
					</span>
					<span class="chart-donut__legend-value">
						{{ child.value }}
						<span class="chart-donut__legend-percentage">
							({{ child.percentage }}%)
						</span>
					</span>
				</li>
			</template>
		</ol>
	</div>
</template>

<script>
import { translatePlural as n } from '@nextcloud/l10n'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import { donutOption } from './chartOptions.js'
import EchartMixin from './EchartMixin.js'

/** Slices past this fold into a single grey "Other". Beyond ~7 hues stop being separable. */
const MAX_SLICES = 7

export default {
	name: 'ChartDonut',

	components: {
		NcLoadingIcon,
	},

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
					// Not called "Other": a question that takes free answers already
					// has a row by that name, and it means something else.
					label: n(
						'forms',
						'%n more option',
						'%n more options',
						tail.length,
					),

					value: tail.reduce(
						(sum, item) => sum + (Number(item.value) || 0),
						0,
					),

					muted: true,
					children: tail,
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
		 * @return {object[]} label, count, share and swatch colour per slice, with the
		 *   options a folded slice stands for
		 */
		segments() {
			const total = this.total || 1
			const share = (value) => Math.round((100 * (Number(value) || 0)) / total)
			return this.slices.map((slice, index) => {
				const slot = this.slotAssignment[index]
				return {
					key: slice.key ?? index,
					label: slice.label,
					value: slice.value,
					percentage: share(slice.value),
					children: (slice.children ?? []).map((child, childIndex) => ({
						key: child.key ?? childIndex,
						label: child.label,
						value: child.value,
						percentage: share(child.value),
					})),
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
		 * The key as the page shows it, for the downloaded image.
		 *
		 * Read back out of the rendered legend rather than rebuilt from the data, so the
		 * picture cannot disagree with the page about which colour meant what.
		 *
		 * @return {{colour: string, label: string}[]} one row per series
		 */
		legendRows() {
			return [...this.$el.querySelectorAll('.chart-donut__legend-item')].map(
				(item) => ({
					// A folded option's row has an empty swatch, which reads back as
					// transparent and so draws nothing: the row is set in under its fold.
					colour: getComputedStyle(
						item.querySelector('.chart-donut__swatch'),
					).backgroundColor,
					// Joined per span: textContent runs the label straight into the value,
					// so the key came out reading "Yes6 (55%)".
					label: [...item.children]
						.filter(
							(child) =>
								!child.classList.contains('chart-donut__swatch'),
						)
						.map((child) =>
							child.textContent.replace(/\s+/g, ' ').trim(),
						)
						.filter(Boolean)
						.join(' '),
				}),
			)
		},

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

	&__note {
		color: var(--color-text-maxcontrast);
		flex: 1 0 100%;
		margin: 0;
	}

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
		// Three columns - swatch, label, count - shared by every row, so the counts
		// line up under one another and each one still sits beside the label it
		// belongs to. It used to be a row per line with the count pushed to the far
		// end, which on a wide card left "Yes" against one edge and "6 (55%)" against
		// the other with half a screen of nothing between them.
		column-gap: 16px;
		display: grid;
		flex: 0 1 auto;
		grid-template-columns: auto minmax(0, max-content) max-content;
		list-style: none;
		margin: 0;
		max-inline-size: 360px;
		min-inline-size: 0;
		padding: 0;
		row-gap: 6px;
	}

	&__legend-item {
		align-items: baseline;
		display: grid;
		gap: 0 8px;
		// Falls back to a row of its own where subgrid is not understood: the columns
		// stop agreeing between rows, which is the layout it had before.
		grid-column: 1 / -1;
		grid-template-columns: auto minmax(0, max-content) max-content;
		grid-template-columns: subgrid;
	}

	&__loading {
		block-size: 100%;
		inline-size: 100%;
	}

	// A folded option, listed under its fold: quieter, so the fold still reads as
	// the one slice the ring draws.
	&__legend-item--sub {
		color: var(--color-text-maxcontrast);
		font-size: var(--font-size-small, 13px);
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
		white-space: nowrap;
	}

	&__legend-percentage {
		color: var(--color-text-maxcontrast);
		font-weight: normal;
	}
}

@media (prefers-reduced-motion: reduce) {
	.chart-donut__loading.loading-icon :deep(svg) {
		animation: none;
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
