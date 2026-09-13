<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  When the responses arrived: the first thing an author wants to know while a form is open,
  and something a summary of answers cannot say. The counting lives in
  utils/ResponseTimeline.js; this only draws it.
-->
<template>
	<section
		v-if="bars.length > 1"
		class="response-timeline"
		:aria-label="t('forms', 'When responses arrived')">
		<h3 class="response-timeline__title">
			{{ t('forms', 'When responses arrived') }}
		</h3>

		<dl class="response-timeline__figures">
			<div v-for="figure in figures" :key="figure.key">
				<dt>{{ figure.label }}</dt>
				<dd>{{ figure.value }}</dd>
			</div>
		</dl>

		<ChartFigure
			class="response-timeline__chart"
			form="columns"
			:items="bars"
			:max="busiest"
			hidePercentage />
	</section>
</template>

<script>
import moment from '@nextcloud/moment'
import ChartFigure from './Charts/ChartFigure.vue'
import { responseTimeline } from '../../utils/ResponseTimeline.js'

export default {
	name: 'ResponseTimeline',

	components: {
		ChartFigure,
	},

	props: {
		/** Every response being described. */
		submissions: {
			type: Array,
			required: true,
		},
	},

	computed: {
		/** @return {number[]} when each response arrived, in seconds */
		timestamps() {
			return this.submissions
				.map((submission) => Number(submission.timestamp))
				.filter((value) => Number.isFinite(value) && value > 0)
		},

		/** @return {object} the counts and the step they were counted by */
		timeline() {
			return responseTimeline(this.timestamps)
		},

		/** @return {object[]} chart rows, one per step */
		bars() {
			return this.timeline.buckets.map((bucket) => ({
				key: bucket.at.getTime(),
				label: this.stepLabel(bucket.at),
				value: bucket.count,
				percentage: 0,
			}))
		},

		/** @return {number} the busiest step, so the tallest column fills the chart */
		busiest() {
			return this.timeline.buckets.reduce(
				(most, bucket) => Math.max(most, bucket.count),
				1,
			)
		},

		/** @return {string} what the busiest figure is counting */
		busiestLabel() {
			if (this.timeline.step === 'month') {
				return t('forms', 'Busiest month')
			}
			if (this.timeline.step === 'day') {
				return t('forms', 'Busiest day')
			}
			return t('forms', 'Busiest hour')
		},

		/** @return {object[]} the first and last response, and the busiest step */
		figures() {
			const times = [...this.timestamps].sort((a, b) => a - b)
			const busiest = this.timeline.buckets.reduce(
				(best, bucket) =>
					bucket.count > (best?.count ?? 0) ? bucket : best,
				null,
			)
			return [
				{
					key: 'first',
					label: t('forms', 'First response'),
					value: this.moment(times[0]),
				},
				{
					key: 'last',
					label: t('forms', 'Latest response'),
					value: this.moment(times[times.length - 1]),
				},
				{
					key: 'busiest',
					// Which unit is busiest depends on how far apart the responses
					// are, and the reader cannot tell from the moment alone whether
					// "10" arrived in that hour, that day or that month.
					label: this.busiestLabel,
					value: busiest
						? `${this.figureMoment(busiest.at)} (${busiest.count})`
						: '',
				},
			]
		},
	},

	methods: {
		/**
		 * @param {number} timestamp seconds
		 * @return {string} the moment, written out for the reader
		 */
		moment(timestamp) {
			return moment(timestamp, 'X')
				.locale(window.OC.getLanguage())
				.format('lll')
		},

		/**
		 * A step written out for the figures rather than for the chart.
		 *
		 * The axis needs its labels short - a dozen of them share one line - so it uses
		 * its own compact form. The figures sit beside the first and last response, and
		 * a row reading "Sep 11, 2026 7:07 PM" next to "11 Sep, 19:00" is two date
		 * styles and two clocks in three words. These follow the locale, like the rest.
		 *
		 * @param {Date} at the start of a step
		 * @return {string} the step, in the same style as the other two figures
		 */
		figureMoment(at) {
			const when = moment(at).locale(window.OC.getLanguage())
			if (this.timeline.step === 'month') {
				return when.format('MMMM YYYY')
			}
			if (this.timeline.step === 'day') {
				return when.format('ll')
			}
			return when.format('lll')
		},

		/**
		 * @param {Date} at the start of a step
		 * @return {string} how that step is labelled on the chart
		 */
		stepLabel(at) {
			const when = moment(at).locale(window.OC.getLanguage())
			if (this.timeline.step === 'month') {
				return when.format('MMM YYYY')
			}
			if (this.timeline.step === 'day') {
				return when.format('D MMM')
			}
			return when.format('D MMM, HH:mm')
		},
	},
}
</script>

<style lang="scss" scoped>
.response-timeline {
	background-color: var(--color-main-background);
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large);
	break-inside: avoid;
	margin-block-end: 16px;
	padding-block: 16px;
	padding-inline: 20px;

	&__title {
		font-weight: bold;
		margin-block-end: 12px;
	}

	&__figures {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 28px;
		margin: 0 0 16px;

		div {
			display: flex;
			flex-direction: column-reverse;
			min-inline-size: 64px;
		}

		// Nextcloud's own stylesheet gives every dt a fixed, end-aligned, padded box.
		dt,
		dd {
			display: block;
			inline-size: auto;
			padding: 0;
			text-align: start;
		}

		dt {
			color: var(--color-text-maxcontrast);
			font-size: 0.9em;
		}

		dd {
			font-size: 1.1em;
			font-weight: bold;
			line-height: 1.2;
			margin: 0;
		}
	}
}
</style>
