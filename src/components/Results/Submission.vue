<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="section submission" @copy="onCopy">
		<div class="submission-head">
			<h3 dir="auto">
				{{ submission.userDisplayName }}
			</h3>
			<NcActions class="submission-menu" forceMenu>
				<NcActionRouter
					v-if="canEditSubmission"
					:to="{
						name: 'submit',
						params: { hash: formHash, submissionId: submission.id },
					}">
					<template #icon>
						<NcIconSvgWrapper :svg="IconPencil" />
					</template>
					{{ t('forms', 'Edit this response') }}
				</NcActionRouter>
				<NcActionButton v-if="canDeleteSubmission" @click="onDelete">
					<template #icon>
						<NcIconSvgWrapper :svg="IconDelete" />
					</template>
					{{ t('forms', 'Delete this response') }}
				</NcActionButton>
			</NcActions>
		</div>
		<p class="submission-date">
			{{ submissionDateTime }}
		</p>
		<p v-if="quizScore" class="submission-score">
			{{
				t('forms', 'Scored {score} out of {max}', {
					score: quizScore.score,
					max: quizScore.max,
				})
			}}
			<span class="submission-score__percent">{{ quizScore.percent }}%</span>
		</p>

		<Answer
			v-for="question in answeredQuestions"
			:key="question.id"
			:question="question"
			:grade="quizGrades[question.id]"
			:highlight="highlight"
			:answerText="question.squashedAnswers"
			:answers="question.answers"
			:questionText="question.text"
			:gridCellType="question.gridCellType"
			:gridColumns="question.gridColumns"
			:gridRows="question.gridRows"
			:gridValue="question.gridValue"
			:questionType="question.type" />
	</div>
</template>

<script>
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconPencil from '@material-symbols/svg-400/outlined/edit.svg?raw'
import moment from '@nextcloud/moment'
import { generateUrl } from '@nextcloud/router'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionRouter from '@nextcloud/vue/components/NcActionRouter'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Answer from './Answer.vue'
import { OptionType } from '../../models/Constants.ts'

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Submission',

	components: {
		Answer,
		NcIconSvgWrapper,
		NcActions,
		NcActionButton,
		NcActionRouter,
	},

	props: {
		formHash: {
			type: String,
			required: true,
		},

		submission: {
			type: Object,
			required: true,
		},

		questions: {
			type: Array,
			required: true,
		},

		canDeleteSubmission: {
			type: Boolean,
			required: true,
		},

		canEditSubmission: {
			type: Boolean,
			required: true,
		},

		highlight: {
			type: String,
			default: null,
		},
	},

	emits: ['delete'],

	setup() {
		return {
			IconDelete,
			IconPencil,
		}
	},

	computed: {
		// Format submission-timestamp to DateTime
		submissionDateTime() {
			return moment(this.submission.timestamp, 'X').format('LLLL')
		},

		/**
		 * Join answered Questions with corresponding answers.
		 * Multiple answers to a question are squashed into one string.
		 *
		 * @return {Array}
		 */
		answeredQuestions() {
			return this.parseQuestions(this.questions)
		},

		/**
		 * This response's quiz score, when the form is a quiz. The server grades every
		 * stored response, so the score here is the one the respondent was shown.
		 *
		 * @return {?object} score, max and percentage
		 */
		quizScore() {
			const quiz = this.submission.quiz
			const max = Number(quiz?.max)
			if (!(max > 0)) {
				return null
			}
			const score = Number(quiz.score) || 0
			return {
				score: Math.round(score * 100) / 100,
				max: Math.round(max * 100) / 100,
				percent: Math.round((score / max) * 100),
			}
		},

		/** @return {object} each graded question's result, keyed by question id */
		quizGrades() {
			const graded = this.submission.quiz?.questions
			return graded && typeof graded === 'object' ? graded : {}
		},
	},

	methods: {
		parseQuestions(questions) {
			const answeredQuestionsArray = []

			questions.forEach((question) => {
				const answers = this.submission.answers.filter(
					(answer) => answer.questionId === question.id,
				)
				if (!answers.length) {
					return // no answers, go to next question
				}

				if (question.type === 'file') {
					answeredQuestionsArray.push({
						id: question.id,
						text: question.text,
						type: question.type,
						answers: answers.map((answer) => {
							return {
								id: answer.id,
								text: answer.text,
								url: generateUrl('/f/{fileId}', {
									fileId: answer.fileId,
								}),
							}
						}),
					})
				} else if (question.type === 'grid') {
					const optionsPerId = {}
					question.options.forEach((option) => {
						optionsPerId[option.id] = option
					})
					let squashedAnswers = ''

					const gridValue = answers[0].text
						? JSON.parse(answers[0].text)
						: null
					// fixme: rename `questionType` to `gridCellType` everywhere in BE and FE
					if (
						gridValue
						&& question.extraSettings.questionType === 'radio'
					) {
						squashedAnswers = Object.keys(gridValue)
							.filter(
								(key) =>
									optionsPerId[key]
									&& optionsPerId[gridValue[key]],
							)
							.map((key) => {
								return (
									optionsPerId[key].text
									+ ': '
									+ optionsPerId[gridValue[key]].text
								)
							})
							.join('\n')
					} else if (
						gridValue
						&& question.extraSettings.questionType === 'checkbox'
					) {
						squashedAnswers = Object.keys(gridValue)
							.filter(
								(key) =>
									optionsPerId[key]
									&& Array.isArray(gridValue[key]),
							)
							.map((key) => {
								return (
									optionsPerId[key].text
									+ ': '
									+ gridValue[key]
										.filter((optionId) => optionsPerId[optionId])
										.map(
											(optionId) =>
												optionsPerId[optionId].text,
										)
										.join(', ')
								)
							})
							.join('\n')
					}

					answeredQuestionsArray.push({
						id: question.id,
						text: question.text,
						type: question.type,
						gridValue,
						squashedAnswers,
						gridCellType: question.extraSettings.questionType,
						gridRows: question.options.filter(
							(option) => option.optionType === OptionType.Row,
						),
						gridColumns: question.options.filter(
							(option) => option.optionType === OptionType.Column,
						),
					})
				} else if (question.type === 'conditional') {
					const branches = question.extraSettings?.branches ?? []
					if (branches.length === 0) return
					const subQuestions = branches.map((branch) =>
						branch.subQuestions
							.map((sub) => ({
								...sub,
								answer: this.submission.answers.find(
									(answer) => answer.questionId === sub.id,
								),
							}))
							.filter((sub) => sub.answer),
					)
					answeredQuestionsArray.push({
						id: question.id,
						text: question.text,
						type: question.extraSettings.triggerType,
						conditional: true,
						extraSettings: question.extraSettings,
						squashedAnswers: answers[0].text,
						answers: subQuestions.map((sub) => this.parseQuestions(sub)),
					})
				} else if (['date', 'time'].includes(question.type)) {
					const squashedAnswers = answers
						.map((answer) => answer.text)
						.join(' - ')

					answeredQuestionsArray.push({
						id: question.id,
						text: question.text,
						type: question.type,
						squashedAnswers,
					})
				} else if (question.type === 'ranking') {
					const optionsPerId = {}
					question.options.forEach((option) => {
						optionsPerId[option.id] = option
					})
					const rankedIds = answers[0]?.text
						? JSON.parse(answers[0].text)
						: []
					const squashedAnswers = rankedIds
						.map((id, index) => {
							const option = optionsPerId[id]
							return option
								? `${index + 1}. ${option.text}`
								: `${index + 1}. ?`
						})
						.join('\n')

					answeredQuestionsArray.push({
						id: question.id,
						text: question.text,
						type: question.type,
						squashedAnswers,
					})
				} else {
					const squashedAnswers = answers
						.map((answer) => answer.text)
						.join('; ')

					answeredQuestionsArray.push({
						id: question.id,
						text: question.text,
						type: question.type,
						squashedAnswers,
					})
				}
			})
			return answeredQuestionsArray
		},

		onDelete() {
			this.$emit('delete')
		},

		onCopy(event) {
			if (!event.clipboardData) return

			const selection = window.getSelection()
			if (!selection || selection.isCollapsed) return

			const fragment = selection.getRangeAt(0).cloneContents()
			const text = this.serializeNode(fragment).trim()

			if (!text) return

			event.clipboardData.setData('text/plain', text)
			event.preventDefault()
		},

		serializeNode(node) {
			if (node.nodeType === Node.TEXT_NODE) {
				return node.textContent
			}

			if (
				node.nodeType !== Node.ELEMENT_NODE
				&& node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE
			) {
				return ''
			}

			const tag = node.tagName?.toLowerCase()

			if (tag && ['svg', 'script', 'style'].includes(tag)) return ''
			if (tag === 'br') return '\n'

			const children = Array.from(node.childNodes)
				.map((child) => this.serializeNode(child))
				.join('')

			// Answer blocks get a blank line before them as visual separator
			if (tag === 'div' && node.classList?.contains('answer')) {
				const trimmed = children.replace(/\s+$/, '')
				return trimmed ? '\n' + trimmed + '\n' : ''
			}

			const isBlock =
				tag
				&& [
					'div',
					'p',
					'h1',
					'h2',
					'h3',
					'h4',
					'h5',
					'h6',
					'li',
					'td',
					'tr',
					'th',
					'dt',
					'dd',
				].includes(tag)
			if (isBlock) {
				const trimmed = children.replace(/\s+$/, '')
				return trimmed ? trimmed + '\n' : ''
			}

			return children
		},
	},
}
</script>

<style lang="scss" scoped>
// One response to a card, so where one ends and the next begins is plain.
.submission {
	background-color: var(--color-main-background);
	border: 2px solid var(--color-border);
	border-radius: var(--border-radius-large);
	break-inside: avoid;
	margin-block-end: 16px;
	padding-block: 16px;
	padding-inline: 20px;

	&-head {
		display: flex;
		align-items: flex-end;

		h3 {
			font-weight: bold;
		}
	}

	&-menu {
		margin: 0 0 12px var(--default-grid-baseline);
		display: inline-block;
	}

	&-date {
		color: var(--color-text-lighter);
		margin-block-start: -8px;
	}

	&-score {
		font-weight: bold;
		margin-block-start: 4px;

		&__percent {
			color: var(--color-text-maxcontrast);
			font-variant-numeric: tabular-nums;
			font-weight: normal;
			margin-inline-start: 8px;
		}
	}
}
</style>
