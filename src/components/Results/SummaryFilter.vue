<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  Narrow the summary to the responses that gave certain answers, so every chart below it
  describes that group alone: how the engineers rated the service, what the first-year
  students who came in person chose. Each answer added narrows the one before it; for a
  question answered only once, a second answer replaces the first. The rules live in
  utils/SummaryFilter.js.
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
				:modelValue="null"
				:clearable="false"
				label="label"
				trackBy="id"
				@update:modelValue="onAnswer" />
		</div>
		<ul v-if="conditions.length" ref="chips" class="summary-filter__chips">
			<li v-for="(condition, index) in conditions" :key="index">
				<NcChip
					:text="conditionLabel(condition)"
					:ariaLabelClose="
						t('forms', 'Stop filtering by {condition}', {
							condition: conditionLabel(condition),
						})
					"
					@close="removeCondition(index)" />
			</li>
		</ul>
		<p v-if="conditions.length" class="summary-filter__printed">
			<bdi dir="auto"
				>{{ t('forms', 'Only responses that gave these answers:') }}
				{{ printedConditions }}</bdi
			>
		</p>
		<!-- Always in the page: a screen reader announces changes to a live region it
		     already knows, so one created along with its text usually goes unsaid. -->
		<p
			class="summary-filter__count"
			:class="{ 'summary-filter__count--idle': !conditions.length }"
			role="status">
			<template v-if="conditions.length">
				{{
					n(
						'forms',
						'Showing %n of {total} response',
						'Showing %n of {total} responses',
						shown,
						{ total },
					)
				}}
			</template>
		</p>
	</div>
</template>

<script>
import NcChip from '@nextcloud/vue/components/NcChip'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import {
	filterableQuestions,
	filterAnswers,
	holdsOneAnswer,
} from '../../utils/SummaryFilter.js'

export default {
	name: 'SummaryFilter',

	components: {
		NcChip,
		NcSelect,
	},

	props: {
		/** The form's questions. */
		questions: {
			type: Array,
			required: true,
		},

		/** The chosen answers, each `{ questionId, value }`; empty for every response. */
		modelValue: {
			type: Array,
			default: () => [],
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

		/** @return {object[]} the conditions applied so far */
		conditions() {
			return this.modelValue ?? []
		},

		/** @return {?number} the question being answered in the picker */
		questionId() {
			return this.pendingQuestionId
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

		/** @return {string} every condition in words, for a printed summary */
		printedConditions() {
			return this.conditions
				.map((condition) => this.conditionLabel(condition))
				.join(' · ')
		},
	},

	methods: {
		/**
		 * @param {?{id: number}} option the question chosen, or null when cleared
		 */
		onQuestion(option) {
			this.pendingQuestionId = option?.id ?? null
		},

		/**
		 * @param {?{id: string}} option the answer chosen, which adds a condition
		 */
		onAnswer(option) {
			if (!option || this.questionId === null) {
				return
			}
			const added = { questionId: this.questionId, value: option.id }
			const already = this.conditions.some(
				(condition) =>
					condition.questionId === added.questionId
					&& condition.value === added.value,
			)
			if (!already) {
				// A response gives one answer to a single choice, a scale or a rating, so
				// "Engineering" and "Science" together would match nobody. The new answer
				// replaces the old one instead of emptying the summary.
				const question = this.questions.find(
					(candidate) => candidate.id === added.questionId,
				)
				const kept = holdsOneAnswer(question)
					? this.conditions.filter(
							(condition) => condition.questionId !== added.questionId,
						)
					: this.conditions
				this.$emit('update:modelValue', [...kept, added])
			}
			// Ready for the next condition rather than sitting on the one just added.
			this.pendingQuestionId = null
			// That removes the answer picker, which had focus; the question picker is
			// always there and is where the next condition starts.
			this.focusQuestionPicker()
		},

		/**
		 * @param {number} index the condition to drop
		 */
		removeCondition(index) {
			// Closing a chip removes its button along with the focus it held.
			const hadFocus =
				this.$refs.chips?.contains(document.activeElement) ?? false
			this.$emit(
				'update:modelValue',
				this.conditions.filter((condition, at) => at !== index),
			)
			if (hadFocus) {
				this.focusQuestionPicker()
			}
		},

		focusQuestionPicker() {
			this.$nextTick(() => {
				this.$el?.querySelector?.('.summary-filter__select input')?.focus()
			})
		},

		/**
		 * @param {{questionId: number, value: string}} condition one condition
		 * @return {string} it in words, as "question: answer"
		 */
		conditionLabel(condition) {
			const question = this.questions.find(
				(candidate) => candidate.id === condition.questionId,
			)
			return `${question?.text ?? ''}: ${condition.value}`
		},
	},
}
</script>

<style lang="scss" scoped>
.summary-filter {
	margin-block-end: 16px;
	padding-block-end: 8px;
	padding-inline: 20px;

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

	&__chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		list-style: none;
		margin-block: 8px 0;
		padding: 0;
	}

	&__count {
		color: var(--color-text-maxcontrast);
		margin-block: 8px 0;

		// Empty and taking no room until there is a filter to count.
		&--idle {
			margin-block: 0;
		}
	}

	&__printed {
		display: none;
	}
}

// A printed summary names the group it describes in words; the fields are for the screen.
@media print {
	.summary-filter__fields,
	.summary-filter__chips {
		display: none;
	}

	// Level with the title and the cards, which lose their inset on paper.
	.summary-filter {
		padding-inline: 0;
	}

	.summary-filter__printed {
		display: block;
		font-weight: bold;
	}
}
</style>
