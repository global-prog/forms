<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="section question-summary" :dir="questionDirection">
		<h3 dir="auto" :style="{ textAlign: formTextAlign }">
			{{ question.text }}
		</h3>
		<p class="question-summary__detail">
			{{ questionTypeLabel }}
		</p>

		<!-- Ranking questions: Borda count with average rank -->
		<div v-if="question.type === 'ranking'" class="question-summary__statistic">
			<p class="question-summary__ranking-description">
				{{
					t(
						'forms',
						'Ranked by Borda count: each 1st place receives {n} points, 2nd place {n1} points, and so on. Higher score means more preferred.',
						{
							n: question.options.length,
							n1: question.options.length - 1,
						},
					)
				}}
			</p>
			<ChartFormPicker
				v-if="chartForms.length > 1"
				:modelValue="chartForm"
				:forms="chartForms"
				:questionId="question.id"
				@update:modelValue="onChartFormChosen" />
			<ChartFigure
				:items="rankingBars"
				:form="chartForm"
				:max="maxBordaScore"
				hidePercentage />
		</div>

		<!-- Numeric summary. Number and rating questions previously showed no summary at
		     all, because the option-bar view only covers types with predefined options.

		     Chained to the branch above rather than starting afresh: ranking is a
		     predefined type, so an unchained test here let the option-count branch below
		     match a ranking question as well and draw it a second, meaningless chart. -->
		<div
			v-else-if="numericStats"
			class="question-summary__statistic numeric-summary">
			<dl class="numeric-summary__figures">
				<div>
					<dt>{{ t('forms', 'Average') }}</dt>
					<dd>{{ numericStats.mean }}</dd>
				</div>
				<div>
					<dt>{{ t('forms', 'Median') }}</dt>
					<dd>{{ numericStats.median }}</dd>
				</div>
				<div>
					<dt>{{ t('forms', 'Lowest') }}</dt>
					<dd>{{ numericStats.min }}</dd>
				</div>
				<div>
					<dt>{{ t('forms', 'Highest') }}</dt>
					<dd>{{ numericStats.max }}</dd>
				</div>
				<div>
					<dt>{{ t('forms', 'Responses') }}</dt>
					<dd>{{ numericStats.count }}</dd>
				</div>
				<div v-if="npsScore !== null">
					<dt>{{ t('forms', 'Net Promoter Score') }}</dt>
					<dd>{{ npsScore }}</dd>
				</div>
			</dl>

			<!-- The Net Promoter Score's three groups, as a single bar under the figures.
			     Each group is also named with its share in text, so the colours are never
			     the only way to tell them apart. -->
			<div v-if="npsBreakdown" class="nps-breakdown">
				<div class="nps-breakdown__bar" aria-hidden="true">
					<span
						v-for="group in npsGroups"
						:key="group.key"
						class="nps-breakdown__segment"
						:class="`nps-breakdown__segment--${group.key}`"
						:style="{ flexGrow: group.share }" />
				</div>
				<ul class="nps-breakdown__legend">
					<li
						v-for="group in npsGroups"
						:key="group.key"
						class="nps-breakdown__item">
						<span
							class="nps-breakdown__swatch"
							:class="`nps-breakdown__segment--${group.key}`"
							aria-hidden="true" />
						{{ group.label }}
					</li>
				</ul>
			</div>

			<template v-if="numericStats.buckets.length">
				<ChartFormPicker
					v-if="chartForms.length > 1"
					:modelValue="chartForm"
					:forms="chartForms"
					:questionId="question.id"
					@update:modelValue="onChartFormChosen" />
				<ChartFigure
					class="numeric-summary__bars"
					:items="bucketBars"
					:form="chartForm"
					:max="numericStats.busiest"
					hidePercentage />
			</template>
		</div>

		<!-- Answers with countable results for visualization. A single-choice question can
		     also be shown as a ring; a checkbox question cannot, because one respondent may
		     tick several boxes, so the shares sum past 100% and there is no whole to divide. -->
		<div
			v-else-if="answerTypes[question.type].predefined"
			class="question-summary__statistic">
			<ChartFormPicker
				v-if="chartForms.length > 1"
				:modelValue="chartForm"
				:forms="chartForms"
				:questionId="question.id"
				@update:modelValue="onChartFormChosen" />
			<ChartDonut v-if="chartForm === 'ring'" :items="optionBars" />
			<ChartFigure
				v-else
				:items="optionBars"
				:form="chartForm"
				:max="submissions.length" />
		</div>

		<div
			v-else-if="question.type === 'grid'"
			class="question-summary__statistic">
			<ChartFormPicker
				v-if="chartForms.length > 1"
				:modelValue="chartForm"
				:forms="chartForms"
				:questionId="question.id"
				@update:modelValue="onChartFormChosen" />
			<ChartStacked
				v-if="chartForm === 'stacked'"
				:items="gridStacked"
				:columns="gridHeatmap.columns" />
			<ChartHeatmap
				v-else
				:rows="gridHeatmap.rows"
				:columns="gridHeatmap.columns"
				:cells="gridHeatmap.cells" />
		</div>

		<!-- Text answers are simply listed for now, could be automatically grouped in the future -->
		<ul v-else class="question-summary__text">
			<!-- Do not wrap the following line between tags! `white-space:pre-line` respects `\n` but would produce additional empty first line -->
			<!-- eslint-disable-next-line -->
			<li v-for="(answer, index) in answers" :key="answer.id" dir="auto">
				<template v-if="answer.url">
					<a :href="answer.url" target="_blank">
						<NcIconSvgWrapper :svg="IconFile" inline />
						{{ answer.text }}
					</a>
				</template>
				<template v-else-if="question.type === 'color'">
					<div class="color__result">
						<div
							v-if="answer.id !== 0"
							:style="{ 'background-color': answer.text }"
							:class="
								index === 1
									? 'color__field color__field__first'
									: 'color__field'
							" />
						{{ answer.text }}
					</div>
				</template>
				<template v-else>
					{{ answer.text }}
				</template>
			</li>
		</ul>
	</div>
</template>

<script>
import IconFile from '@material-symbols/svg-400/outlined/draft.svg?raw'
import { generateUrl } from '@nextcloud/router'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import ChartDonut from './Charts/ChartDonut.vue'
import ChartFigure from './Charts/ChartFigure.vue'
import ChartFormPicker from './Charts/ChartFormPicker.vue'
import ChartHeatmap from './Charts/ChartHeatmap.vue'
import ChartStacked from './Charts/ChartStacked.vue'
import answerTypes from '../../models/AnswerTypes.js'
import { GridCellType, OptionType } from '../../models/Constants.ts'
import { readChartForm, writeChartForm } from '../../utils/ChartPreferences.js'
import { resolveDirection } from '../../utils/TextDirection.js'
import { bucketsFor, chartFormsFor } from './Charts/chartOptions.js'

export default {
	name: 'ResultsSummary',

	components: {
		ChartDonut,
		ChartFigure,
		ChartFormPicker,
		ChartHeatmap,
		ChartStacked,
		NcIconSvgWrapper,
	},

	// How to align the author's words; see ViewsMixin authorTextAlign.
	inject: {
		formTextAlign: { from: 'formTextAlign', default: undefined },
	},

	props: {
		submissions: {
			type: Array,
			required: true,
		},

		question: {
			type: Object,
			required: true,
		},

		/** The form's declared language, or '' when it follows the reader. */
		formLanguage: {
			type: String,
			default: '',
		},
	},

	setup() {
		return {
			IconFile,
		}
	},

	data() {
		return {
			answerTypes,
			// Replaced in created(), once the computed properties exist to say which
			// forms this particular question may honestly be drawn as.
			chartForm: 'bars',
		}
	},

	computed: {
		/**
		 * Which way this one question should be laid out.
		 *
		 * The form's declared language wins where there is one, exactly as in the editor
		 * and the form itself: an author who has said "this form is Arabic" has settled
		 * it for every question. Otherwise it is taken from this question's own words,
		 * which is what lets a form written in two languages lay each question out its
		 * own way. The option texts are consulted too, since they are what the chart
		 * labels are made of, and a question whose title is a bare number would
		 * otherwise decide nothing.
		 *
		 * Undefined when none of it has a direction, in which case the question inherits
		 * the direction the results view has already set from the form.
		 *
		 * @return {?string} 'rtl', 'ltr', or undefined to inherit
		 */
		questionDirection() {
			return resolveDirection(
				// A declared language decides for every question, as it does in the editor
				// and the form itself; the words only decide when nothing was declared.
				this.formLanguage,
				this.question.text,
				...(this.question.options ?? []).map((option) => option.text),
			)
		},

		/**
		 * The chart forms this question may honestly be drawn as.
		 *
		 * @return {string[]} the allowed forms, best first
		 */
		chartForms() {
			return chartFormsFor(this.chartShape).forms
		},

		/**
		 * What the summary is drawing, in the terms the matrix is written in.
		 *
		 * @return {object} the question's shape
		 */
		chartShape() {
			return {
				type: this.question.type,
				isNumeric: this.numericStats !== null,
				isPredefined: this.answerTypes[this.question.type].predefined,
				isNumericGrid:
					this.question.extraSettings?.questionType
					=== GridCellType.Number,

				// Only asked of a grid. Every other type reaches this through a computed
				// that assumes the question has options, which a text question has not.
				columnCount:
					this.question.type === 'grid' ? this.gridColumns.length : 0,
			}
		},

		/**
		 * The grid arranged as one stack per row.
		 *
		 * @return {object[]} a row per grid row, its counts in column order
		 */
		gridStacked() {
			return this.gridRows.map((row) => ({
				key: row.id,
				label: row.text,
				values: this.gridColumns.map(
					(column) =>
						this.gridValue[row.id]?.[column.id]?.answersCount ?? 0,
				),
			}))
		},

		/**
		 * Every numeric answer given to this question.
		 *
		 * @return {number[]} the parsed values, unanswered and non-numeric entries dropped
		 */
		numericValues() {
			if (!['number', 'rating', 'linearscale'].includes(this.question.type)) {
				return []
			}
			const values = []
			for (const submission of this.submissions) {
				for (const answer of submission.answers ?? []) {
					if (answer.questionId !== this.question.id) {
						continue
					}
					const value = parseFloat(answer.text)
					if (!isNaN(value)) {
						values.push(value)
					}
				}
			}
			return values
		},

		/**
		 * The steps of a question answered on a fixed scale.
		 *
		 * @return {?{low: number, high: number}} the scale's ends, or null for a free number
		 */
		scaleRange() {
			const settings = this.question.extraSettings ?? {}
			if (this.question.type === 'linearscale') {
				return {
					low: settings.optionsLowest ?? 1,
					high: settings.optionsHighest ?? 5,
				}
			}
			if (this.question.type === 'rating') {
				return { low: 1, high: settings.maxRating ?? 5 }
			}
			return null
		},

		/**
		 * Summary statistics for a numeric question.
		 *
		 * Median is reported alongside the average because a single extreme answer drags an
		 * average badly on the small response counts these forms usually see.
		 *
		 * @return {?object} the statistics, or null when there is nothing to summarise
		 */
		numericStats() {
			const values = this.numericValues
			if (values.length === 0) {
				return null
			}
			const sorted = [...values].sort((a, b) => a - b)
			const middle = Math.floor(sorted.length / 2)
			const median =
				sorted.length % 2
					? sorted[middle]
					: (sorted[middle - 1] + sorted[middle]) / 2
			const round = (n) => Math.round(n * 100) / 100

			// Every step of a scale, including the ones nobody chose; see bucketsFor.
			const buckets = bucketsFor(values, this.scaleRange)

			return {
				count: values.length,
				mean: round(values.reduce((a, b) => a + b, 0) / values.length),
				median: round(median),
				min: round(sorted[0]),
				max: round(sorted[sorted.length - 1]),
				buckets,
				busiest: buckets.reduce((m, b) => Math.max(m, b.count), 1),
			}
		},

		/**
		 * Promoter and detractor shares, for a question shaped like a Net Promoter Score
		 * question: a 0-10 scale.
		 *
		 * @return {?object} the percentage breakdown, or null when not applicable
		 */
		npsBreakdown() {
			if (this.question.type !== 'linearscale') {
				return null
			}
			const low = this.question.extraSettings?.optionsLowest
			const high = this.question.extraSettings?.optionsHighest
			if (low !== 0 || high !== 10) {
				return null
			}
			const values = this.numericValues
			if (values.length === 0) {
				return null
			}
			const share = (n) => Math.round((n / values.length) * 100)
			return {
				promoters: share(values.filter((v) => v >= 9).length),
				passives: share(values.filter((v) => v >= 7 && v <= 8).length),
				detractors: share(values.filter((v) => v <= 6).length),
			}
		},

		/**
		 * The three Net Promoter groups in the order the scale runs, for the bar and its
		 * legend. Groups with nobody in them are kept, so the legend always names all
		 * three and a missing colour never has to be inferred.
		 *
		 * @return {object[]} key, share and label per group
		 */
		npsGroups() {
			const breakdown = this.npsBreakdown
			if (!breakdown) {
				return []
			}
			return [
				{
					key: 'detractors',
					share: breakdown.detractors,
					label: t('forms', '{percent}% detractors (0 to 6)', {
						percent: breakdown.detractors,
					}),
				},
				{
					key: 'passives',
					share: breakdown.passives,
					label: t('forms', '{percent}% passives (7 or 8)', {
						percent: breakdown.passives,
					}),
				},
				{
					key: 'promoters',
					share: breakdown.promoters,
					label: t('forms', '{percent}% promoters (9 or 10)', {
						percent: breakdown.promoters,
					}),
				},
			]
		},

		/**
		 * The Net Promoter Score itself: promoters minus detractors, as whole percentages.
		 *
		 * @return {?number} the score from -100 to 100, or null when not applicable
		 */
		npsScore() {
			const breakdown = this.npsBreakdown
			return breakdown ? breakdown.promoters - breakdown.detractors : null
		},

		questionTypeLabel() {
			const label = this.answerTypes[this.question.type].label

			if (this.question.type === 'grid') {
				if (
					this.question.extraSettings.questionType
					=== GridCellType.Checkbox
				) {
					return label + ' (' + t('forms', 'Checkbox') + ')'
				}
				if (
					this.question.extraSettings.questionType === GridCellType.Number
				) {
					return label + ' (' + t('forms', 'Number') + ')'
				}
				if (
					this.question.extraSettings.questionType === GridCellType.Radio
				) {
					return label + ' (' + t('forms', 'Radio') + ')'
				}
			}

			if (this.question.type === 'linearscale') {
				const labelLowest =
					this.question.extraSettings?.optionsLabelLowest
					?? t('forms', 'Strongly disagree')
				const labelHighest =
					this.question.extraSettings?.optionsLabelHighest
					?? t('forms', 'Strongly agree')
				const optionsLowest =
					this.question.extraSettings?.optionsLowest?.toString() ?? '1'
				const optionsHighest =
					this.question.extraSettings?.optionsHighest?.toString() ?? '5'

				const descriptionParts = []
				if (labelLowest !== '') {
					descriptionParts.push(`${optionsLowest}: ${labelLowest}`)
				}
				if (labelHighest !== '') {
					descriptionParts.push(`${optionsHighest}: ${labelHighest}`)
				}
				const description = ` (${descriptionParts.join(', ')})`
				return label + description
			}

			return label
		},

		// For countable questions like multiple choice and checkboxes
		questionOptions() {
			// Build list of question options
			let questionOptionsStats
			if (this.question.type !== 'linearscale') {
				questionOptionsStats = this.question.options.map((option) => ({
					...option,
					count: 0,
					percentage: 0,
				}))
			} else {
				questionOptionsStats = Array.from(
					{
						length:
							(this.question.extraSettings?.optionsHighest ?? 5)
							- (this.question.extraSettings?.optionsLowest ?? 1)
							+ 1,
					},
					(_, i) => ({
						text: (
							i + (this.question.extraSettings?.optionsLowest ?? 1)
						).toString(),
						count: 0,
						percentage: 0,
					}),
				)
			}

			// Also record 'Other'
			if (this.question.extraSettings?.allowOtherAnswer) {
				questionOptionsStats.unshift({
					text: t('forms', 'Other'),
					count: 0,
					percentage: 0,
					isOther: true,
				})
			}

			// Also record 'No response'
			questionOptionsStats.unshift({
				// TRANSLATORS Counts on Results-Summary, how many users did not respond to this question.
				text: t('forms', 'No response'),
				count: 0,
				percentage: 0,
				// Flagged at the point it is created rather than recognised later by its
				// translated text, which would break in every language but English.
				isNoResponse: true,
			})

			// Go through submissions to check which options have how many responses
			this.submissions.forEach((submission) => {
				const answers = submission.answers.filter(
					(answer) => answer.questionId === this.question.id,
				)
				if (!answers.length) {
					// Record 'No response'
					questionOptionsStats[0].count++
				}

				// Check question options to find which needs to be increased
				answers.forEach((answer) => {
					const optionsStatIndex = questionOptionsStats.findIndex(
						(option) => option.text === answer.text,
					)
					if (optionsStatIndex < 0) {
						if (this.question.extraSettings?.allowOtherAnswer) {
							questionOptionsStats[1].count++
						} else {
							questionOptionsStats.push({
								text: answer.text,
								count: 1,
								percentage: 0,
							})
						}
					} else {
						questionOptionsStats[optionsStatIndex].count++
					}
				})
			})

			// Sort options by response count
			if (this.question.type !== 'linearscale') {
				questionOptionsStats.sort((object1, object2) => {
					return object2.count - object1.count
				})
			} else {
				// for linear scale questions move the "No response" element to the end
				questionOptionsStats.push(questionOptionsStats.shift())
			}

			questionOptionsStats.forEach((questionOptionsStat) => {
				// Fill percentage values
				questionOptionsStat.percentage = Math.round(
					(100 * questionOptionsStat.count) / this.submissions.length,
				)
				// Mark all best results
				const maxCount = Math.max(
					...questionOptionsStats.map((option) => option.count),
				)
				questionOptionsStat.best = questionOptionsStat.count === maxCount
			})

			return questionOptionsStats
		},

		/**
		 * Borda count ranking statistics
		 */
		/**
		 * Ranking options as magnitude bars.
		 *
		 * @return {object[]} one bar per option, its Borda total as the value
		 */
		rankingBars() {
			return this.rankingStats.map((option) => ({
				key: option.id,
				label: option.text,
				value: option.bordaTotal,
				best: option.best,
				note: t('forms', 'avg. rank {average}', {
					average: option.avgRank,
				}),
			}))
		},

		/**
		 * The distribution of a numeric question as bars.
		 *
		 * @return {object[]} one bar per step of a scale, or per distinct free value
		 */
		bucketBars() {
			return (this.numericStats?.buckets ?? []).map((bucket) => ({
				key: bucket.value,
				label: bucket.value,
				value: bucket.count,
			}))
		},

		/**
		 * Option counts as chart rows.
		 *
		 * 'No response' is drawn grey: it is the absence of a choice rather than one of
		 * the choices, and giving it a choice's colour would overstate it.
		 *
		 * @return {object[]} one row per option
		 */
		optionBars() {
			return this.questionOptions.map((option, index) => ({
				key: option.id ?? `synthetic-${index}`,
				label: option.text,
				value: option.count,
				percentage: option.percentage,
				best: option.best,
				muted: option.isNoResponse === true,
			}))
		},

		/**
		 * The grid matrix arranged for the heatmap.
		 *
		 * @return {object} rows, columns and cells, in the shape ChartHeatmap expects
		 */
		gridHeatmap() {
			const isNumber =
				this.question.extraSettings?.questionType === GridCellType.Number
			const cells = this.gridRows.map((row) =>
				this.gridColumns.map((column) => {
					const cell = this.gridValue[row.id]?.[column.id] ?? {}
					if (isNumber) {
						const average = cell.averageValue ?? 0
						return { value: average, display: average }
					}
					const count = cell.answersCount ?? 0
					return {
						value: count,
						display: `${count} (${cell.percentage ?? 0}%)`,
					}
				}),
			)
			return {
				rows: this.gridRows.map((row) => ({
					key: row.id,
					label: row.text,
				})),

				columns: this.gridColumns.map((column) => ({
					key: column.id,
					label: column.text,
				})),

				cells,
			}
		},

		rankingStats() {
			const n = this.question.options.length
			const stats = {}

			for (const opt of this.question.options) {
				stats[opt.id] = {
					id: opt.id,
					text: opt.text,
					bordaTotal: 0,
					rankSum: 0,
					count: 0,
				}
			}

			for (const submission of this.submissions) {
				const answer = submission.answers.find(
					(a) => a.questionId === this.question.id,
				)
				if (!answer) continue
				const ranked = JSON.parse(answer.text)
				ranked.forEach((optionId, index) => {
					if (stats[optionId]) {
						stats[optionId].bordaTotal += n - index
						stats[optionId].rankSum += index + 1
						stats[optionId].count++
					}
				})
			}

			const result = Object.values(stats)
				.map((s) => ({
					...s,
					avgRank: s.count > 0 ? (s.rankSum / s.count).toFixed(1) : '-',
				}))
				.sort((a, b) => b.bordaTotal - a.bordaTotal)

			// Mark best (highest Borda score)
			if (result.length > 0 && result[0].bordaTotal > 0) {
				const best = result[0].bordaTotal
				result.forEach((o) => {
					o.best = o.bordaTotal === best
				})
			}

			return result
		},

		maxBordaScore() {
			const n = this.question.options.length
			return n * this.submissions.length
		},

		gridColumns() {
			return this.question.options.filter(
				(option) => option.optionType === OptionType.Column,
			)
		},

		gridRows() {
			return this.question.options.filter(
				(option) => option.optionType === OptionType.Row,
			)
		},

		gridValue() {
			const matrix = {}
			for (const row of this.gridRows) {
				for (const column of this.gridColumns) {
					matrix[row.id] = matrix[row.id] || {}
					matrix[row.id][column.id] = {
						answersCount: 0,
						percentage: 0,
						totalValue: 0,
						averageValue: 0,
					}
				}
			}

			const answers = []
			this.submissions.forEach((submission) => {
				submission.answers.forEach((answer) => {
					if (answer.questionId === this.question.id) {
						answers.push(answer)
					}
				})
			})

			answers.forEach((answer) => {
				const answerJson = JSON.parse(answer.text)

				if (
					this.question.extraSettings.questionType === GridCellType.Radio
				) {
					for (const rowId of Object.keys(answerJson)) {
						const columnId = answerJson[rowId]

						if (matrix[rowId]?.[columnId]) {
							matrix[rowId][columnId].answersCount++
						}
					}
				} else if (
					this.question.extraSettings.questionType
					=== GridCellType.Checkbox
				) {
					for (const rowId of Object.keys(answerJson)) {
						if (!Array.isArray(answerJson[rowId])) {
							continue
						}
						for (const columnId of answerJson[rowId]) {
							if (matrix[rowId]?.[columnId]) {
								matrix[rowId][columnId].answersCount++
							}
						}
					}
				} else if (
					this.question.extraSettings.questionType === GridCellType.Number
				) {
					for (const rowId of Object.keys(answerJson)) {
						if (!matrix[rowId]) {
							continue
						}
						for (const columnId of Object.keys(answerJson[rowId])) {
							if ('' === answerJson[rowId][columnId]) {
								continue
							}

							if (matrix[rowId][columnId]) {
								matrix[rowId][columnId].totalValue += parseFloat(
									answerJson[rowId][columnId],
								)
								matrix[rowId][columnId].answersCount++
							}
						}
					}
				}
			})

			for (const rowId of Object.keys(matrix)) {
				for (const columnId of Object.keys(matrix[rowId])) {
					let totalAnswersCount = this.submissions.length
					if (
						this.question.extraSettings.questionType
						=== GridCellType.Checkbox
					) {
						totalAnswersCount = Object.entries(matrix[rowId])
							.map(([, cell]) => cell.answersCount)
							.reduce((a, b) => a + b, 0)
					}
					if (totalAnswersCount === 0) {
						totalAnswersCount = 1
					}

					if (!matrix[rowId][columnId].answersCount) {
						matrix[rowId][columnId].answersCount = 0
					}

					matrix[rowId][columnId].percentage = Math.round(
						(100 * matrix[rowId][columnId].answersCount)
							/ totalAnswersCount,
					)

					if (
						this.question.extraSettings.questionType
							=== GridCellType.Number
						&& matrix[rowId][columnId].answersCount > 0
					) {
						matrix[rowId][columnId].averageValue =
							matrix[rowId][columnId].totalValue
							/ matrix[rowId][columnId].answersCount
					}
				}
			}

			return matrix
		},

		// For text answers like short answer and long text
		answers() {
			const answersModels = []

			// Also record 'No response'
			let noResponseCount = 0

			// Go through submissions to check which options have how many responses
			this.submissions.forEach((submission) => {
				const answers = submission.answers.filter(
					(answer) => answer.questionId === this.question.id,
				)
				if (!answers.length) {
					// Record 'No response'
					noResponseCount++
				}

				// Add text answers
				if (
					['date', 'time'].includes(this.question.type)
					&& answers.length === 2
				) {
					// Combine the first two answers in order for date range questions
					answersModels.push({
						id: `${answers[0].id}-${answers[1].id}`,
						text: `${answers[0].text} - ${answers[1].text}`,
					})
				} else {
					answers.forEach((answer) => {
						if (answer.fileId) {
							answersModels.push({
								id: answer.id,
								text: answer.text,
								url: generateUrl('/f/{fileId}', {
									fileId: answer.fileId,
								}),
							})
						} else {
							answersModels.push({
								id: answer.id,
								text: answer.text,
							})
						}
					})
				}
			})

			// Calculate no response percentage
			const noResponsePercentage = Math.round(
				(100 * noResponseCount) / this.submissions.length,
			)
			answersModels.unshift({
				id: 0,
				text:
					noResponseCount
					+ ' ('
					+ noResponsePercentage
					+ '%): '
					+ t('forms', 'No response'),
			})

			return answersModels
		},
	},

	watch: {
		// The list of honest forms is not fixed for the life of the component. It is
		// derived from the answers, and answers can be deleted while the summary is on
		// screen -- deleting the last numeric answer to a scale question turns it from
		// an ordered distribution into a plain list of options, and a line drawn across
		// a list of options is the very thing the matrix exists to refuse. So the
		// current choice is re-checked whenever the list changes, not only when made.
		chartForms(forms) {
			if (!forms.includes(this.chartForm)) {
				this.chartForm = chartFormsFor(this.chartShape).preferred ?? 'bars'
			}
		},

		// A summary is a list of questions and Vue may reuse this instance for a
		// different one, which would otherwise keep the previous question's choice --
		// and that choice can easily be one this question must not be drawn as.
		'question.id': function () {
			this.chartForm = this.initialChartForm()
		},
	},

	created() {
		this.chartForm = this.initialChartForm()
	},

	methods: {
		/**
		 * Which form to open this question in.
		 *
		 * Whatever this reader last chose for it, provided that form is still one the
		 * question may be drawn as -- a question can be edited into a different shape
		 * after the choice was made -- and otherwise the form that suits its data best.
		 *
		 * @return {string} the chart form to start with
		 */
		initialChartForm() {
			const { forms, preferred } = chartFormsFor(this.chartShape)
			return readChartForm(this.question.id, forms) ?? preferred ?? 'bars'
		},

		/**
		 * Draw and remember a form the reader actually asked for.
		 *
		 * Only a choice made here is stored. Deliberately not a watcher on the value:
		 * the value is also set when the component is created and when the honest forms
		 * change under it, and storing those would record a default as a preference --
		 * on every question, on every visit -- which would then outrank any later
		 * improvement to what a question opens as.
		 *
		 * @param {string} form the form the reader picked
		 */
		onChartFormChosen(form) {
			// Only ever one of the forms this question may be drawn as. Anything else is
			// ignored rather than stored, so a malformed value cannot outlive the page.
			if (!this.chartForms.includes(form)) {
				return
			}
			this.chartForm = form
			writeChartForm(this.question.id, form)
		},
	},
}
</script>

<style lang="scss" scoped>
// The chart palette lives in css/forms.css, so every chart in the results -- these and the
// quiz overview -- draws from the one validated set.

.question-summary {
	padding-inline: var(--default-clickable-area) 16px;

	h3 {
		font-weight: bold;
	}

	&__detail {
		color: var(--color-text-lighter);
		margin-block-start: -8px;
	}

	&__text,
	&__statistic {
		margin-block-start: 8px;
	}

	// The following three were nested inside a `li` that the charts no longer render --
	// and in the numeric summary's case never had one, so they had silently stopped
	// matching anything. Lifted out so they apply again.
	&__ranking-description {
		color: var(--color-text-maxcontrast);
		font-style: italic;
		margin-block-end: 8px;
	}

	&__statistic-percentage {
		color: var(--color-text-maxcontrast);
	}

	&__text {
		list-style-type: initial;

		li {
			padding-block: 4px;
			padding-inline: 0;
			white-space: pre-line;

			&:first-child {
				font-weight: bold;
			}
		}
	}

	&__statistic {
		display: flex;
		flex-direction: column;
		gap: 8px;
		list-style-type: none;
	}

	.color__field {
		width: 100px;
		height: var(--default-clickable-area);
		border-radius: var(--border-radius-element);
		position: relative;
		inset-block-start: 12px;

		&__first {
			margin-block-start: -12px;
		}
	}

	.color__result {
		align-items: baseline;
		display: flex;
		gap: calc(var(--clickable-area-small) / 2);
	}
}

.nps-breakdown {
	margin-block: 12px 4px;
	max-inline-size: 520px;

	&__bar {
		block-size: 10px;
		border-radius: var(--border-radius);
		display: flex;
		gap: 2px;
		overflow: hidden;
	}

	&__segment {
		// A group with nobody in it takes no room, but the legend still names it.
		flex-basis: 0;

		// The element variants, which Nextcloud tunes for coloured marks on the page in
		// both themes. The plain status colours are background tones that nearly vanish
		// on a dark page, and the -text ones are too pale to tell apart from the grey.
		&--detractors {
			background-color: var(--color-element-error);
		}

		&--passives {
			background-color: var(--color-text-maxcontrast);
		}

		&--promoters {
			background-color: var(--color-element-success);
		}
	}

	&__legend {
		color: var(--color-text-maxcontrast);
		display: flex;
		flex-wrap: wrap;
		font-size: 0.9em;
		gap: 4px 16px;
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
	}

	&__item {
		align-items: center;
		display: flex;
		gap: 6px;
	}

	&__swatch {
		block-size: 10px;
		border-radius: 2px;
		flex: 0 0 auto;
		inline-size: 10px;
	}
}

.numeric-summary {
	display: flex;
	flex-direction: column;
	gap: 12px;

	&__figures {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 28px;
		margin: 0;

		// One tile per figure: the number large on top, what it is beneath. The label
		// stays first in the markup, so a screen reader still says what a number is
		// before saying the number.
		div {
			display: flex;
			flex-direction: column-reverse;
			min-inline-size: 64px;
		}

		// Nextcloud's own stylesheet gives every dt a fixed 130px inline box, end-aligned
		// and padded, which set each label beside its value and pushed the fifth figure
		// onto a line of its own.
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
}
</style>
