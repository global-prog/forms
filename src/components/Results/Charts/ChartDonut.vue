<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  part-to-whole donut, for single-choice questions only.

  Only single-choice. A checkbox question must never be drawn as a ring: a respondent may tick
  several boxes, so the shares sum past 100% and a ring would depict a whole that does not
  exist. Those questions get ChartBars instead, and the caller enforces that.

  The ring is built from one SVG circle per slice using stroke-dasharray, so there is no path
  arithmetic and no dependency -- the chosen radius makes the circumference exactly 100, which
  lets a slice's dash length be its percentage directly.

  Identity is carried by the legend, which always lists every slice with its label, count and
  share as real text. That is what lets the ring stay uncluttered: no leader lines to collide
  with long option text, and a reader who cannot separate two hues still has the numbers.
-->
<template>
	<div class="chart-donut">
		<svg
			class="chart-donut__ring"
			viewBox="0 0 36 36"
			role="img"
			:aria-label="summary">
			<!-- Track behind the slices, so a rounding shortfall reads as a gap not a hole -->
			<circle
				class="chart-donut__track"
				cx="18"
				cy="18"
				:r="RADIUS"
				fill="none" />
			<circle
				v-for="segment in segments"
				:key="segment.key"
				:cx="18"
				:cy="18"
				:r="RADIUS"
				fill="none"
				:stroke="segment.color"
				:stroke-dasharray="segment.dashArray"
				:stroke-dashoffset="segment.dashOffset" />
			<text
				class="chart-donut__total"
				x="18"
				y="18"
				text-anchor="middle"
				dominant-baseline="central">
				{{ total }}
			</text>
		</svg>

		<ol class="chart-donut__legend">
			<li
				v-for="segment in segments"
				:key="segment.key"
				class="chart-donut__legend-item">
				<span
					class="chart-donut__swatch"
					:style="{ backgroundColor: segment.color }"
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
/**
 * Chosen so the circumference is 100: 2 * PI * r = 100. A slice's dash length is then its
 * percentage with no conversion.
 */
const RADIUS = 15.9155

/** Slots past this fold into a single grey "Other". Beyond ~7 hues stop being separable. */
const MAX_SLICES = 7

/** Surface gap between adjacent slices, in circumference units. */
const SLICE_GAP = 0.7

export default {
	name: 'ChartDonut',

	props: {
		/**
		 * `{ key?, label, value, muted? }` -- one entry per choice, ordered by the caller.
		 * A muted entry is drawn grey and takes no categorical slot.
		 */
		items: {
			type: Array,
			required: true,
		},
	},

	setup() {
		return { RADIUS }
	},

	computed: {
		/** @return {number} every response the ring accounts for */
		total() {
			return this.items.reduce(
				(sum, item) => sum + (Number(item.value) || 0),
				0,
			)
		},

		/**
		 * Slices to draw, tail folded into "Other" and positioned around the ring.
		 *
		 * @return {object[]} the slices, each carrying its own dash geometry
		 */
		segments() {
			const kept = this.items.filter((item) => (Number(item.value) || 0) > 0)

			// Fold the tail rather than inventing more hues for it.
			let slices = kept
			if (kept.length > MAX_SLICES) {
				const head = kept.slice(0, MAX_SLICES - 1)
				const tail = kept.slice(MAX_SLICES - 1)
				slices = [
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

						folded: true,
					},
				]
			}

			const total = this.total || 1
			// Start at twelve o'clock: a quarter turn back along a circumference of 100.
			let cursor = 25
			// Counted separately from the loop index, so that a grey slice -- the folded
			// tail, or "No response", which is an absence rather than a choice -- does not
			// consume a categorical slot and shift every real choice's hue along one.
			let slot = 0

			return slices.map((slice, index) => {
				const value = Number(slice.value) || 0
				const share = (100 * value) / total
				// Only carve a gap out of a slice wide enough to survive losing it.
				const drawn = share > SLICE_GAP * 2 ? share - SLICE_GAP : share
				const grey = Boolean(slice.folded || slice.muted)
				if (!grey) {
					slot += 1
				}
				const segment = {
					key: slice.key ?? index,
					label: slice.label,
					value,
					percentage: Math.round(share),
					color: grey
						? 'var(--chart-muted)'
						: `var(--chart-series-${slot})`,
					dashArray: `${drawn} ${100 - drawn}`,
					dashOffset: cursor,
				}
				// Dash offset runs anticlockwise, so subtract to advance clockwise.
				cursor -= share
				return segment
			})
		},

		/** @return {string} the whole chart in one sentence, for screen readers */
		summary() {
			return this.segments
				.map((segment) =>
					t('forms', '{label}: {value} ({percentage}%)', {
						label: segment.label,
						value: segment.value,
						percentage: segment.percentage,
					}),
				)
				.join('. ')
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
		block-size: 160px;
		flex: 0 0 auto;
		inline-size: 160px;
		// The ring is a whole; mirroring it in RTL would say nothing extra.
		transform: rotate(0deg);
	}

	&__track {
		stroke: var(--color-background-dark);
		stroke-width: 4;
	}

	circle:not(&__track) {
		stroke-width: 4;
	}

	&__total {
		fill: var(--color-main-text);
		font-size: 6px;
		font-weight: 600;
	}

	&__legend {
		display: flex;
		flex: 1 1 220px;
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
		// Nudge down to sit on the text baseline rather than above it.
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
