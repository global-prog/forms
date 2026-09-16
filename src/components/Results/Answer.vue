<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="answer">
		<h4
			class="answer__question-text"
			dir="auto"
			:style="{ textAlign: formTextAlign }">
			{{ questionText }}
		</h4>
		<p
			v-if="grade"
			class="answer__grade"
			:class="{ 'answer__grade--correct': grade.correct === true }">
			<NcIconSvgWrapper
				class="answer__grade-mark"
				:svg="grade.correct === true ? IconCheck : IconClose"
				:size="18"
				inline />
			{{
				grade.correct === true
					? t('forms', 'Correct')
					: t('forms', 'Incorrect')
			}}
			<span class="answer__grade-points">
				{{
					t('forms', '{earned} of {points}', {
						earned: tidy(grade.earned),
						points: tidy(grade.points),
					})
				}}
			</span>
		</p>
		<!-- Do not wrap the following line between tags! `white-space:pre-line` respects `\n` but would produce additional empty first line -->
		<!-- eslint-disable-next-line -->
		<template v-if="questionType === 'file' && answers.length">
			<p
				v-for="answer of answers"
				:key="answer.id"
				class="answer__text"
				dir="auto">
				<a :href="answer.url" target="_blank">
					<NcIconSvgWrapper :svg="IconFile" inline />
					<NcHighlight :text="answer.text" :search="highlight" />
				</a>
			</p>
		</template>
		<template v-else-if="questionType === 'color'">
			<div class="color__result">
				<div
					:style="{ 'background-color': answerText }"
					class="color__field" />
				<NcHighlight :text="answerText" :search="highlight" />
			</div>
		</template>
		<template v-else-if="questionType === 'grid'">
			<!-- A grid is wider than a phone; it scrolls on its own rather than pushing
			     the whole page sideways, and the row headings stay pinned while it does. -->
			<div class="answer-grid-scroll">
				<table class="answer-grid">
					<thead>
						<tr>
							<th class="first-column"></th>

							<th
								v-for="column of gridColumns"
								:key="column.id"
								scope="col">
								{{ column.text }}
							</th>
						</tr>
					</thead>
					<tbody>
						<tr v-for="row of gridRows" :key="row.id">
							<th class="first-column" scope="row">{{ row.text }}</th>
							<td v-for="column of gridColumns" :key="column.id">
								<template v-if="gridCellType === 'radio'">
									<NcCheckboxRadioSwitch
										:aria-label="`${row.text}: ${column.text}`"
										:modelValue="gridValue?.[row.id] ?? null"
										:name="`${row.id}-answer`"
										:value="column.id.toString()"
										disabled
										type="radio" />
								</template>

								<template v-if="gridCellType === 'checkbox'">
									<NcCheckboxRadioSwitch
										:aria-label="`${row.text}: ${column.text}`"
										:modelValue="gridValue?.[row.id] || []"
										:name="`${row.id}-answer`"
										:value="column.id.toString()"
										disabled
										type="checkbox" />
								</template>

								<template v-if="gridCellType === 'number'">
									<!-- A row added after this response was sent has no stored value. -->
									{{ gridValue?.[row.id]?.[column.id] ?? '' }}
								</template>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
		</template>
		<p v-else class="answer__text" dir="auto">
			<NcHighlight :text="answerText" :search="highlight" />
		</p>
		<template v-if="question.conditional && question.branchAnswers">
			<div
				v-for="(branchAnswers, branchAnswersKey) in question.branchAnswers"
				:key="branchAnswersKey"
				class="branch__subquestions">
				<div class="answer__subquestion">
					<Answer
						v-for="subquestion in branchAnswers"
						:key="subquestion.id"
						:question="subquestion"
						:highlight="highlight"
						:answerText="subquestion.squashedAnswers"
						:answers="subquestion.answers"
						:questionText="subquestion.text"
						:gridCellType="subquestion.gridCellType"
						:gridColumns="subquestion.gridColumns"
						:gridRows="subquestion.gridRows"
						:gridValue="subquestion.gridValue"
						:questionType="subquestion.type" />
				</div>
			</div>
		</template>
	</div>
</template>

<script>
import IconCheck from '@material-symbols/svg-400/outlined/check.svg?raw'
import IconClose from '@material-symbols/svg-400/outlined/close.svg?raw'
import IconFile from '@material-symbols/svg-400/outlined/draft.svg?raw'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcHighlight from '@nextcloud/vue/components/NcHighlight'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Answer',
	components: {
		NcCheckboxRadioSwitch,
		NcIconSvgWrapper,
		NcHighlight,
	},

	// How to align the author's words; see ViewsMixin authorTextAlign.
	inject: {
		formTextAlign: { from: 'formTextAlign', default: undefined },
	},

	props: {
		question: {
			type: Object,
			required: true,
		},

		answers: {
			type: Array,
			required: false,
			default: () => [],
		},

		answerText: {
			type: String,
			required: false,
			default: '',
		},

		questionText: {
			type: String,
			required: true,
		},

		questionType: {
			type: String,
			required: true,
		},

		gridCellType: {
			type: String,
			required: false,
			default: null,
		},

		gridColumns: {
			type: Array,
			required: false,
			default: () => [],
		},

		gridRows: {
			type: Array,
			required: false,
			default: () => [],
		},

		gridValue: {
			type: Object,
			required: false,
			default: () => null,
		},

		highlight: {
			type: String,
			required: false,
			default: '',
		},

		/** How this answer was graded, when the form is a quiz and the question is scored. */
		grade: {
			type: Object,
			required: false,
			default: null,
		},
	},

	setup() {
		return {
			IconCheck,
			IconClose,
			IconFile,
			tidy: (value) => Math.round((Number(value) || 0) * 100) / 100,
		}
	},
}
</script>

<style lang="scss" scoped>
.answer {
	margin-block-start: 16px;
	width: 100%;

	// The question is the label here and the answer is the content, but the heading was
	// 21px bold against a 15px answer - so reading a response, the eye landed on the
	// questions, which are identical in every one of them, rather than on the answers,
	// which are the only thing that differs. Muted and set at body size it reads as a
	// label, the answer below it carries the contrast, and a card is a quarter shorter.
	&__question-text {
		color: var(--color-text-maxcontrast);
		font-size: 1em;
		font-weight: 600;
		line-height: 1.3;
		margin-block: 0 2px;
	}

	&__grade {
		align-items: center;
		display: flex;
		gap: 4px;
	}

	// Only the mark carries the colour: the status tones are too light for body text.
	&__grade-mark {
		color: var(--color-element-error);
	}

	&__grade--correct &__grade-mark {
		color: var(--color-element-success);
	}

	&__grade-points {
		color: var(--color-text-maxcontrast);
		font-variant-numeric: tabular-nums;
		margin-inline-start: 8px;
	}

	&__text {
		white-space: pre-line;
	}

	.color__field {
		width: 100px;
		height: var(--default-clickable-area);
		border-radius: var(--border-radius-element);
		position: relative;
		inset-block-start: 12px;
		margin-block-start: -12px;
	}

	.color__result {
		align-items: baseline;
		display: flex;
		gap: calc(var(--clickable-area-small) / 2);
	}

	.answer-grid-scroll {
		max-inline-size: 100%;
		overflow-x: auto;
	}

	.answer-grid {
		border-collapse: collapse;
		width: 100%;

		thead tr {
			border-bottom: 2px solid var(--color-border);
		}

		td {
			min-height: 34px;
			min-width: 64px;
			text-align: center;
			padding: 8px 4px;

			.checkbox-radio-switch {
				display: flex;
				justify-content: center;
			}
		}

		th {
			min-height: 44px;
			padding: 8px 4px;
			text-align: center;
		}

		.first-column {
			// A heading for the row, so the table can be read out; still plain to look at.
			font-weight: normal;
			// Never more than a good share of a phone screen, so the answers stay in view.
			min-width: min(200px, 40vw);
			text-align: start;
			position: sticky;
			inset-inline-start: 0;
			// Opaque and above the cells, which scroll underneath it.
			background-color: var(--color-main-background);
			z-index: 1;
		}
	}

	&__subquestion {
		margin-top: 16px;
		padding-inline-start: 16px;
		border-inline-start: 3px solid var(--color-primary-element);
	}
}
</style>
