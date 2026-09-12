<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  How a quiz went, across everyone who took it.

  The per-question summaries below say what people answered; a teacher's first questions
  are different -- how did the class do, and which questions did they get wrong? So a quiz
  opens its results with the spread of scores and every graded question ranked by how often
  it was missed.

  Every grade here comes from the server, which grades each stored response with the same
  service that graded it as it arrived. Nothing is re-graded in the browser, so this can
  never disagree with the score a respondent was shown.
-->
<template>
	<section
		v-if="graded.length"
		class="quiz-insights"
		:aria-label="t('forms', 'Quiz results')">
		<h3 class="quiz-insights__title">
			{{ t('forms', 'Quiz results') }}
		</h3>
		<p class="quiz-insights__detail">
			{{ t('forms', 'Scores are out of {max}', { max: tidy(maxScore) }) }}
		</p>

		<dl class="quiz-insights__figures">
			<div v-for="figure in figures" :key="figure.key">
				<dt>{{ figure.label }}</dt>
				<dd>{{ figure.value }}</dd>
			</div>
		</dl>

		<ChartFigure
			v-if="distribution.length"
			class="quiz-insights__chart"
			form="columns"
			:items="distribution"
			:max="graded.length" />

		<h4 class="quiz-insights__subtitle">
			{{ t('forms', 'Questions, most often missed first') }}
		</h4>
		<ol class="quiz-insights__questions">
			<li
				v-for="item in byQuestion"
				:key="item.id"
				class="quiz-insights__question">
				<span
					class="quiz-insights__text"
					dir="auto"
					:style="{ textAlign: formTextAlign }"
					>{{ item.text }}</span
				>
				<span class="quiz-insights__rate">
					{{
						t('forms', '{correct} of {total} correct', {
							correct: item.correct,
							total: item.total,
						})
					}}
				</span>
				<span class="quiz-insights__track" aria-hidden="true">
					<span
						class="quiz-insights__fill"
						:style="{ inlineSize: `${item.percent}%` }" />
				</span>
			</li>
		</ol>
	</section>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import ChartFigure from './Charts/ChartFigure.vue'
import { bucketsFor } from './Charts/chartOptions.js'

/** Past this many possible scores a column per score stops being readable. */
const MAX_DISTRIBUTION_STEPS = 20

/**
 * @param {number} value a score
 * @return {number} rounded for display, so 3.0 reads as 3
 */
function tidy(value) {
	return Math.round((Number(value) || 0) * 100) / 100
}

export default {
	name: 'QuizInsights',

	components: {
		ChartFigure,
	},

	// How to align the author's words; see ViewsMixin authorTextAlign.
	inject: {
		formTextAlign: { from: 'formTextAlign', default: undefined },
	},

	props: {
		/** Every response, each carrying the `quiz` grade the server attached. */
		submissions: {
			type: Array,
			required: true,
		},

		/** The form's questions, for their wording and order. */
		questions: {
			type: Array,
			required: true,
		},
	},

	setup() {
		return { t, tidy }
	},

	computed: {
		/** @return {object[]} the grades of every response that was graded */
		graded() {
			return this.submissions
				.map((submission) => submission.quiz)
				.filter((quiz) => quiz && Number(quiz.max) > 0)
		},

		/** @return {number} the score a perfect response would get */
		maxScore() {
			return this.graded.reduce(
				(most, quiz) => Math.max(most, Number(quiz.max)),
				0,
			)
		},

		/** @return {number[]} every score, lowest first */
		scores() {
			return this.graded
				.map((quiz) => Number(quiz.score) || 0)
				.sort((a, b) => a - b)
		},

		/** @return {object[]} the headline figures */
		figures() {
			const scores = this.scores
			const middle = Math.floor(scores.length / 2)
			const median =
				scores.length % 2
					? scores[middle]
					: (scores[middle - 1] + scores[middle]) / 2
			const mean =
				scores.reduce((sum, score) => sum + score, 0) / scores.length
			const percent = this.maxScore
				? Math.round((mean / this.maxScore) * 100)
				: 0
			return [
				{
					key: 'mean',
					label: t('forms', 'Average'),
					value: `${tidy(mean)} (${percent}%)`,
				},
				{ key: 'median', label: t('forms', 'Median'), value: tidy(median) },
				{ key: 'min', label: t('forms', 'Lowest'), value: tidy(scores[0]) },
				{
					key: 'max',
					label: t('forms', 'Highest'),
					value: tidy(scores[scores.length - 1]),
				},
				{
					key: 'count',
					label: t('forms', 'Responses'),
					value: scores.length,
				},
			]
		},

		/**
		 * How many people got each possible score, when scores are whole numbers and
		 * there are few enough of them to give each its own column.
		 *
		 * @return {object[]} chart rows, or none
		 */
		distribution() {
			const whole =
				Number.isInteger(this.maxScore)
				&& this.scores.every((score) => Number.isInteger(score))
			if (!whole || this.maxScore > MAX_DISTRIBUTION_STEPS) {
				return []
			}
			const total = this.scores.length
			return bucketsFor(this.scores, { low: 0, high: this.maxScore }).map(
				(bucket) => ({
					key: bucket.value,
					label: String(bucket.value),
					value: bucket.count,
					percentage: total ? Math.round((bucket.count / total) * 100) : 0,
				}),
			)
		},

		/**
		 * Each graded question with how many got it right, most often missed first.
		 *
		 * @return {object[]} one row per graded question
		 */
		byQuestion() {
			const total = this.graded.length
			return this.questions
				.filter((question) =>
					this.graded.some((quiz) => quiz.questions?.[question.id]),
				)
				.map((question, order) => {
					const correct = this.graded.filter(
						(quiz) => quiz.questions?.[question.id]?.correct === true,
					).length
					return {
						id: question.id,
						order,
						text: question.text,
						correct,
						total,
						percent: total ? Math.round((correct / total) * 100) : 0,
					}
				})
				.sort((a, b) => a.percent - b.percent || a.order - b.order)
		},
	},
}
</script>

<style lang="scss" scoped>
.quiz-insights {
	background-color: var(--color-main-background);
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large);
	break-inside: avoid;
	margin-block-end: 16px;
	padding-block: 16px;
	padding-inline: 20px;

	&__title {
		font-weight: bold;
		margin-block-end: 0;
	}

	&__detail {
		color: var(--color-text-maxcontrast);
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
			font-size: 1.5em;
			font-variant-numeric: tabular-nums;
			font-weight: bold;
			line-height: 1.2;
			margin: 0;
		}
	}

	&__subtitle {
		font-weight: bold;
		margin-block: 20px 8px;
	}

	&__questions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		list-style: none;
		margin: 0;
		max-inline-size: 640px;
		padding: 0;
	}

	&__question {
		align-items: center;
		display: grid;
		gap: 4px 12px;
		grid-template-columns: 1fr auto;
	}

	&__text {
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	&__rate {
		color: var(--color-text-maxcontrast);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	&__track {
		background-color: var(--color-background-dark);
		block-size: 6px;
		border-radius: var(--border-radius);
		grid-column: 1 / -1;
		overflow: hidden;
	}

	&__fill {
		background-color: var(--chart-series-1);
		block-size: 100%;
		display: block;
	}
}

@media print {
	.quiz-insights {
		break-inside: avoid;
		print-color-adjust: exact;
		-webkit-print-color-adjust: exact;
	}
}
</style>
