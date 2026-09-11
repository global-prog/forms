<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  Narrow the summary to the responses that gave one answer, so every chart below it
  describes that group alone: how the engineers rated the service, what the first-year
  students chose. The rules live in utils/SummaryFilter.js.
-->
<template>
	<div v-if="questionOptions.length" class="summary-filter">
		<div class="summary-filter__fields">
			<NcSelect
				class="summary-filter__select"
				:inputLabel="t('forms', 'Show only responses where')"
				:placeholder="t('forms', 'Choose a question')"
				:options="questionOptions"
				:modelValue="selectedQuestion"
				label="label"
				trackBy="id"
				@update:modelValue="onQuestion" />
			<NcSelect
				v-if="selectedQuestion"
				class="summary-filter__select"
				:inputLabel="t('forms', 'answered')"
				:placeholder="t('forms', 'Choose an answer')"
				:options="answerOptions"
				:modelValue="selectedAnswer"
				:clearable="false"
				label="label"
				trackBy="id"
				@update:modelValue="onAnswer" />
		</div>
		<p
			v-if="modelValue && selectedQuestion && selectedAnswer"
			class="summary-filter__printed">
			{{
				t(
					'forms',
					'Only responses where "{question}" was answered "{answer}"',
					{
						question: selectedQuestion.label,
						answer: selectedAnswer.label,
					},
				)
			}}
		</p>
		<p v-if="modelValue" class="summary-filter__count" role="status">
			{{
				n(
					'forms',
					'Showing %n of {total} response',
					'Showing %n of {total} responses',
					shown,
					{ total },
				)
			}}
		</p>
	</div>
</template>

<script>
import NcSelect from '@nextcloud/vue/components/NcSelect'
import { filterableQuestions, filterAnswers } from '../../utils/SummaryFilter.js'

export default {
	name: 'SummaryFilter',

	components: {
		NcSelect,
	},

	props: {
		/** The form's questions. */
		questions: {
			type: Array,
			required: true,
		},

		/** The chosen answer, `{ questionId, value }`, or null for every response. */
		modelValue: {
			type: Object,
			default: null,
		},

		/** How many responses the filter keeps. */
		shown: {
			type: Number,
			required: true,
		},

		/** How many responses there are. */
		total: {
			type: Number,
			required: true,
		},
	},

	emits: ['update:modelValue'],

	data() {
		return {
			// The question picked but not yet given an answer; the filter applies only
			// once both are chosen.
			pendingQuestionId: null,
		}
	},

	computed: {
		/** @return {{id: number, label: string}[]} the questions that can filter */
		questionOptions() {
			return filterableQuestions(this.questions).map((question) => ({
				id: question.id,
				label: question.text,
			}))
		},

		/** @return {?number} the question chosen, applied or not */
		questionId() {
			return this.modelValue?.questionId ?? this.pendingQuestionId
		},

		/** @return {?object} the chosen question's option */
		selectedQuestion() {
			return (
				this.questionOptions.find((option) => option.id === this.questionId)
				?? null
			)
		},

		/** @return {{id: string, label: string}[]} that question's answers */
		answerOptions() {
			const question = this.questions.find(
				(candidate) => candidate.id === this.questionId,
			)
			return question ? filterAnswers(question) : []
		},

		/** @return {?object} the chosen answer's option */
		selectedAnswer() {
			return (
				this.answerOptions.find(
					(option) => option.id === this.modelValue?.value,
				) ?? null
			)
		},
	},

	methods: {
		/**
		 * @param {?{id: number}} option the question chosen, or null when cleared
		 */
		onQuestion(option) {
			this.pendingQuestionId = option?.id ?? null
			// A new question starts without an answer, so the summary goes back to
			// every response until one is chosen.
			this.$emit('update:modelValue', null)
		},

		/**
		 * @param {?{id: string}} option the answer chosen
		 */
		onAnswer(option) {
			if (!option || this.questionId === null) {
				return
			}
			this.$emit('update:modelValue', {
				questionId: this.questionId,
				value: option.id,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.summary-filter {
	border-block-end: 1px solid var(--color-border);
	margin-block-end: 24px;
	padding-block-end: 16px;
	padding-inline: var(--default-clickable-area) 16px;

	&__fields {
		align-items: flex-end;
		display: flex;
		flex-wrap: wrap;
		gap: 8px 16px;
	}

	&__select {
		flex: 1 1 240px;
		max-inline-size: 360px;
		min-inline-size: 0;
	}

	&__count {
		color: var(--color-text-maxcontrast);
		margin-block: 8px 0;
	}

	&__printed {
		display: none;
	}
}

// A printed summary names the group it describes in words; the fields are for the screen.
@media print {
	.summary-filter__fields {
		display: none;
	}

	.summary-filter__printed {
		display: block;
		font-weight: bold;
	}
}
</style>
