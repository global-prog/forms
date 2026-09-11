<!--
  - SPDX-FileCopyrightText: 2020-2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcAppContent
		:class="{ 'app-content--public': publicView }"
		:style="accentColor ? { '--form-accent': accentColor } : undefined"
		:pageHeading="t('forms', 'Submit form')">
		<TopBar
			v-if="!publicView"
			:archived="isArchived"
			:locked="isFormLocked"
			:permissions="form?.permissions"
			:sidebarOpened="sidebarOpened"
			:submissionCount="form?.submissionCount"
			@shareForm="onShareForm" />

		<!-- Form is loading -->
		<NcEmptyContent
			v-if="isLoadingForm"
			class="forms-emptycontent"
			:name="t('forms', 'Loading {title} …', { title: form.title })">
			<template #icon>
				<NcLoadingIcon :size="64" />
			</template>
		</NcEmptyContent>

		<template v-else>
			<!-- Forms title & description. dir/lang come from the form's own language
			     setting, because a form shared by link is usually opened by someone who
			     is not signed in -- the server cannot know their language, so without
			     this an Arabic form renders left to right. -->
			<!-- eslint-disable-next-line vue/no-unused-refs -->
			<header :dir="formDirection" :lang="formLanguage || undefined">
				<!-- Optional per-form banner. Decorative, so it carries an empty alt and is
				     hidden from screen readers; the form title conveys the meaning. -->
				<img
					v-if="headerImage"
					:src="headerImage"
					class="form-header-image"
					alt=""
					aria-hidden="true"
					referrerpolicy="no-referrer"
					loading="lazy" />
				<!-- Accent is applied to a band rather than to Nextcloud's primary colour:
				     overriding that would restyle every button and can silently break
				     contrast against text. -->
				<div
					v-if="accentColor"
					class="form-accent"
					:style="{ backgroundColor: accentColor }" />
				<!-- eslint-disable vue/no-unused-refs -- the ref is read by ViewsMixin -->
				<h2
					ref="title"
					class="form-title"
					dir="auto"
					:style="{ textAlign: authorTextAlign }">
					{{ formTitle }}
				</h2>
				<!-- eslint-enable vue/no-unused-refs -->
				<!-- eslint-disable vue/no-v-html -->
				<div
					v-if="!loading && !success && !!formDescription"
					class="form-desc"
					dir="auto"
					:style="{ textAlign: authorTextAlign }"
					v-html="formDescription" />
				<!-- Show expiration message-->
				<p v-if="form.expires && form.showExpiration" class="info-message">
					<bdi>{{ expirationMessage }}</bdi>
				</p>
				<p v-if="isWaitingToOpen && canEditForm" class="info-message">
					<bdi>{{
						t(
							'forms',
							'Opens on {date}. Until then only people who can edit the form can answer it.',
							{ date: openingDate },
						)
					}}</bdi>
				</p>
				<!-- Generate form information message-->
				<p v-if="infoMessage" class="info-message">
					<bdi>{{ infoMessage }}</bdi>
				</p>
			</header>

			<!-- Screen-reader-only live region for submission success announcement -->
			<div class="hidden-visually" aria-live="polite">
				{{ successAnnouncement }}
			</div>

			<NcEmptyContent
				v-if="loading"
				class="forms-emptycontent"
				:name="t('forms', 'Submitting form …')">
				<template #icon>
					<NcLoadingIcon :size="64" />
				</template>
			</NcEmptyContent>
			<NcEmptyContent
				v-else-if="
					success
					|| (!form.canSubmit && !isMaxSubmissionsReached && !submissionId)
				"
				:dir="formDirection"
				:lang="formLanguage || undefined"
				class="forms-emptycontent"
				:name="
					form.submissionMessage
						? ''
						: t('forms', 'Thank you for completing the form!')
				"
				:description="form.submissionMessage">
				<template #icon>
					<NcIconSvgWrapper :svg="IconCheckSvg" :size="64" />
				</template>
				<template v-if="submissionMessageHTML" #description>
					<!-- eslint-disable-next-line vue/no-v-html -->
					<p class="submission-message" v-html="submissionMessageHTML" />
				</template>
				<!-- Quiz result. Graded server-side, so the answer key is never sent to the
				     browser and cannot be read off the page before submitting. -->
				<template v-if="quizScore || canSubmitAnother" #action>
					<div
						v-if="quizScore"
						class="quiz-result"
						role="status"
						aria-live="polite">
						<p class="quiz-result__score">
							{{
								t('forms', 'You scored {score} out of {max}', {
									score: quizScore.score,
									max: quizScore.max,
								})
							}}
						</p>
						<p class="quiz-result__percent">{{ quizScore.percent }}%</p>
						<!-- How each question went, with the author's feedback. The author can
						     write feedback for a right and a wrong answer, and the server
						     sends it back with the grade; without this list it was never
						     shown to anyone. Only the respondent's own result is revealed,
						     never the answer key, which stays on the server. -->
						<ol
							v-if="quizBreakdown.length"
							class="quiz-result__questions">
							<li
								v-for="item in quizBreakdown"
								:key="item.id"
								class="quiz-result__question"
								:class="{
									'quiz-result__question--correct': item.correct,
								}">
								<NcIconSvgWrapper
									class="quiz-result__mark"
									:svg="item.correct ? IconCheckSvg : IconCloseSvg"
									:size="20" />
								<span class="hidden-visually">
									{{
										item.correct
											? t('forms', 'Correct')
											: t('forms', 'Incorrect')
									}}
								</span>
								<span
									class="quiz-result__text"
									dir="auto"
									:style="{ textAlign: authorTextAlign }"
									>{{ item.text }}</span
								>
								<span class="quiz-result__points">
									{{
										t('forms', '{earned} of {points}', {
											earned: item.earned,
											points: item.points,
										})
									}}
								</span>
								<p
									v-if="!item.correct && item.correctAnswer"
									class="quiz-result__feedback">
									{{ t('forms', 'Correct answer:') }}
									<bdi dir="auto" class="quiz-result__answer">{{
										item.correctAnswer
									}}</bdi>
								</p>
								<p
									v-if="item.feedback"
									class="quiz-result__feedback"
									dir="auto"
									:style="{ textAlign: authorTextAlign }">
									{{ item.feedback }}
								</p>
							</li>
						</ol>
					</div>
					<!-- A form that takes several responses per person offers the next
					     straight away, rather than leaving the respondent to reload. -->
					<NcButton
						v-if="canSubmitAnother"
						class="submit-another"
						variant="secondary"
						@click="onSubmitAnother">
						<template #icon>
							<NcIconSvgWrapper :svg="IconRefreshSvg" />
						</template>
						{{ t('forms', 'Submit another response') }}
					</NcButton>
				</template>
			</NcEmptyContent>
			<NcEmptyContent
				v-else-if="isMaxSubmissionsReached && !submissionId"
				class="forms-emptycontent"
				:name="t('forms', 'Limit reached')"
				:description="
					t(
						'forms',
						'This form has reached the maximum number of responses',
					)
				">
				<template #icon>
					<NcIconSvgWrapper :svg="IconCheckSvg" size="64" />
				</template>
			</NcEmptyContent>
			<NcEmptyContent
				v-else-if="isExpired"
				class="forms-emptycontent"
				:name="t('forms', 'Form expired')"
				:description="
					t(
						'forms',
						'This form has expired and is no longer taking responses',
					)
				">
				<template #icon>
					<NcIconSvgWrapper :svg="IconCheckSvg" size="64" />
				</template>
			</NcEmptyContent>
			<!-- Scheduled to open later. The server refuses answers until then too; whoever
			     can edit the form gets the form, with a note, so they can try it out. -->
			<NcEmptyContent
				v-else-if="isWaitingToOpen && !canEditForm"
				class="forms-emptycontent"
				:name="t('forms', 'Not open yet')"
				:description="
					t('forms', 'This form opens on {date}.', { date: openingDate })
				">
				<template #icon>
					<NcIconSvgWrapper :svg="IconScheduleSvg" size="64" />
				</template>
			</NcEmptyContent>
			<NcEmptyContent
				v-else-if="isClosed || isArchived"
				class="forms-emptycontent"
				:name="t('forms', 'Form closed')"
				:description="
					t(
						'forms',
						'This form was closed and is no longer taking responses',
					)
				">
				<template #icon>
					<NcIconSvgWrapper :svg="IconCheckSvg" size="64" />
				</template>
			</NcEmptyContent>

			<!-- Questions list -->
			<form
				v-else
				ref="form"
				:dir="formDirection"
				:lang="formLanguage || undefined"
				@submit.prevent="onSubmit">
				<ul>
					<component
						:is="answerTypes[question.type].component"
						v-for="(question, index) in orderedQuestions"
						v-show="
							questionPages[question.id] === currentPage
							&& visibleQuestions[question.id]
						"
						ref="questions"
						:key="question.id"
						v-bind="question"
						readOnly
						:answerType="answerTypes[question.type]"
						:index="index + 1"
						:maxStringLengths="maxStringLengths"
						:values="answers[question.id]"
						@keydown.enter="onKeydownEnter"
						@keydown.ctrl.enter="onKeydownCtrlEnter"
						@update:values="(values) => onUpdate(question, values)" />
				</ul>
				<div v-if="pageCount > 1" class="form-pagination">
					<!-- role=status so moving between pages is announced, not silent -->
					<span
						class="form-pagination__label"
						role="status"
						aria-live="polite">
						{{
							t('forms', 'Page {page} of {total}', {
								page: currentPage + 1,
								total: pageCount,
							})
						}}
					</span>
					<!-- Decorative: the status line above already states the page in
					     words, which is what a screen reader announces. A native
					     <progress> was replaced because its fill direction under
					     right-to-left is browser-dependent, whereas a logical inline
					     size grows from the reading start edge in both directions. -->
					<div class="form-pagination__track" aria-hidden="true">
						<div
							class="form-pagination__fill"
							:class="{ 'form-pagination__fill--accent': accentColor }"
							:style="{ inlineSize: `${progressPercent}%` }" />
					</div>
				</div>
				<div class="form-buttons">
					<NcButton
						v-if="pageCount > 1 && currentPage > 0"
						alignment="center-reverse"
						class="submit-button"
						variant="secondary"
						@click.prevent="goToPreviousPage">
						{{ t('forms', 'Back') }}
					</NcButton>
					<NcButton
						v-if="pageCount > 1 && currentPage < pageCount - 1"
						alignment="center-reverse"
						class="submit-button"
						variant="primary"
						@click.prevent="goToNextPage">
						{{ t('forms', 'Next') }}
					</NcButton>
					<NcButton
						alignment="center-reverse"
						class="submit-button"
						:disabled="!hasAnswers"
						type="reset"
						variant="tertiary-no-background"
						@click.prevent="showClearFormDialog = true">
						<template #icon>
							<NcIconSvgWrapper :svg="IconRefreshSvg" />
						</template>
						{{ t('forms', 'Clear form') }}
					</NcButton>
					<!-- For the author: turn the answers given here into a link that opens
					     the form with them already filled in. -->
					<NcButton
						v-if="canCopyPrefilledLink"
						alignment="center-reverse"
						class="submit-button"
						variant="tertiary-no-background"
						@click.prevent="copyPrefilledLink">
						<template #icon>
							<NcIconSvgWrapper :svg="IconLinkSvg" />
						</template>
						{{ t('forms', 'Copy pre-filled link') }}
					</NcButton>
					<NcButton
						v-if="currentPage >= pageCount - 1"
						alignment="center-reverse"
						class="submit-button"
						:disabled="loading"
						type="submit"
						variant="primary">
						<template #icon>
							<NcIconSvgWrapper :svg="IconSendSvg" />
						</template>
						{{ t('forms', 'Submit') }}
					</NcButton>
				</div>
			</form>

			<!-- Confirmation dialog if form is empty submitted -->
			<NcDialog
				v-model:open="showConfirmEmptyModal"
				:name="t('forms', 'Confirm submit')"
				:message="
					t('forms', 'Are you sure you want to submit an empty form?')
				"
				:buttons="confirmEmptyModalButtons" />
			<!-- Confirmation dialog if form is left unsubmitted -->
			<NcDialog
				v-model:open="showConfirmLeaveDialog"
				:name="t('forms', 'Leave form')"
				:message="
					t(
						'forms',
						'You have unsaved changes! Do you still want to leave?',
					)
				"
				:buttons="confirmLeaveFormButtons"
				noClose
				:closeOnClickOutside="false" />
			<!-- Confirmation dialog for clear form -->
			<NcDialog
				v-model:open="showClearFormDialog"
				:name="t('forms', 'Clear form')"
				:message="t('forms', 'Do you want to clear all answers?')"
				:buttons="confirmClearFormButtons"
				noClose
				:closeOnClickOutside="false" />
			<!-- Confirmation dialog if form was changed -->
			<NcDialog
				v-model:open="showClearFormDueToChangeDialog"
				:name="t('forms', 'Clear form')"
				:message="
					t(
						'forms',
						'The form has changed since your last visit. Do you want to clear all answers?',
					)
				"
				:buttons="confirmClearFormButtons"
				noClose
				:closeOnClickOutside="false" />
		</template>
	</NcAppContent>
</template>

<script>
import IconCancel from '@material-symbols/svg-400/outlined/block.svg?raw'
import IconCheck from '@material-symbols/svg-400/outlined/check.svg?raw'
import IconClose from '@material-symbols/svg-400/outlined/close.svg?raw'
import IconLink from '@material-symbols/svg-400/outlined/link.svg?raw'
import IconRefresh from '@material-symbols/svg-400/outlined/refresh.svg?raw'
import IconSchedule from '@material-symbols/svg-400/outlined/schedule.svg?raw'
import IconSend from '@material-symbols/svg-400/outlined/send.svg?raw'
import axios from '@nextcloud/axios'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { loadState } from '@nextcloud/initial-state'
import moment from '@nextcloud/moment'
import { generateOcsUrl, generateUrl } from '@nextcloud/router'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import Question from '../components/Questions/Question.vue'
import QuestionLong from '../components/Questions/QuestionLong.vue'
import QuestionMultiple from '../components/Questions/QuestionMultiple.vue'
import QuestionShort from '../components/Questions/QuestionShort.vue'
import TopBar from '../components/TopBar.vue'
import ViewsMixin from '../mixins/ViewsMixin.js'
import answerTypes from '../models/AnswerTypes.js'
import {
	FormState,
	QUESTION_EXTRASETTINGS_OTHER_PREFIX,
} from '../models/Constants.ts'
import { isQuestionVisible, resolveBranching } from '../utils/DisplayConditions.js'
import logger from '../utils/Logger.js'
import OcsResponse2Data from '../utils/OcsResponse2Data.js'
import { answersFromQuery, queryFromAnswers } from '../utils/PrefillLink.js'
import SetWindowTitle from '../utils/SetWindowTitle.js'

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Submit',

	components: {
		NcAppContent,
		NcButton,
		NcDialog,
		NcEmptyContent,
		NcLoadingIcon,
		NcIconSvgWrapper,
		NcNoteCard,
		Question,
		QuestionLong,
		QuestionShort,
		QuestionMultiple,
		TopBar,
	},

	mixins: [ViewsMixin],

	// Questions read the form's settings, to show what each is worth in a quiz.
	provide() {
		return {
			formSettings: () => this.form.settings ?? {},
		}
	},

	/*
	 * This is used to confirm that the user wants to leave the page
	 * if the form is unsubmitted.
	 */
	async beforeRouteUpdate(to, from, next) {
		// This navigation guard is called when the route parameters changed (e.g. form hash)
		// continue with the navigation if there are no changes or the user confirms to leave the form
		if (await this.confirmLeaveForm()) {
			next()
		} else {
			// Otherwise cancel the navigation
			next(false)
		}
	},

	async beforeRouteLeave(to, from, next) {
		// This navigation guard is called when the route changed and a new view should be shown
		// continue with the navigation if there are no changes or the user confirms to leave the form
		if (await this.confirmLeaveForm()) {
			next()
		} else {
			// Otherwise cancel the navigation
			next(false)
		}
	},

	props: {
		isLoggedIn: {
			type: Boolean,
			required: false,
			default: false,
		},

		shareHash: {
			type: String,
			default: '',
		},
	},

	setup() {
		// Non reactive properties
		return {
			IconCheckSvg: IconCheck,
			IconCloseSvg: IconClose,
			IconLinkSvg: IconLink,
			IconRefreshSvg: IconRefresh,
			IconScheduleSvg: IconSchedule,
			IconSendSvg: IconSend,

			maxStringLengths: loadState('forms', 'maxStringLengths'),
		}
	},

	data() {
		return {
			answerTypes,
			/** index of the page currently shown, when the form has section breaks */
			currentPage: 0,
			/** pages actually visited, so Back retraces jumps rather than assuming -1 */
			pageHistory: [],
			/** the graded result of a quiz, returned by the server on submit */
			quizResult: null,
			/** the answers as the page opened with them, from a saved draft or a link */
			answersAtOpen: null,
			/** fixed for this page load, so the order does not change while answering */
			shuffleSeed: Math.floor(Math.random() * 0x7fffffff) || 1,
			/**
			 * Mapping of questionId => answers
			 *
			 * @type {Record<number, string[]>}
			 */
			answers: {},
			loading: false,
			success: false,
			successAnnouncement: '',
			/** Submit state of the form, true if changes are currently submitted */
			submitForm: false,
			showConfirmEmptyModal: false,
			showConfirmLeaveDialog: false,
			showClearFormDialog: false,
			showClearFormDueToChangeDialog: false,
		}
	},

	computed: {
		/**
		 * How far through the pages the respondent is.
		 *
		 * @return {number} a percentage, 0 to 100
		 */
		progressPercent() {
			if (this.pageCount <= 1) {
				return 100
			}
			return Math.round((100 * (this.currentPage + 1)) / this.pageCount)
		},

		/**
		 * the answers actually submitted.
		 *
		 * Drops answers belonging to questions that are currently hidden or were skipped by a
		 * jump. Without this, answering a question and then changing an earlier answer so it
		 * hides would still store the stale answer -- a data-quality problem, and arguably a
		 * privacy one, since it records a reply the respondent could no longer see or retract.
		 *
		 * @return {Record<number, Array>} answers keyed by question id
		 */
		submittedAnswers() {
			const shown = new Set(
				this.validQuestions
					.filter(
						(question) =>
							this.visibleQuestions[question.id]
							&& this.reachablePages.has(
								this.questionPages[question.id],
							),
					)
					.map((question) => question.id),
			)
			return Object.fromEntries(
				Object.entries(this.answers).filter(([id]) => shown.has(Number(id))),
			)
		},

		/**
		 * pages the respondent actually visited, including the one they are on.
		 *
		 * @return {Set<number>} visited page indexes
		 */
		reachablePages() {
			return new Set([...this.pageHistory, this.currentPage])
		},

		/**
		 * The quiz result to show, or null when this was not a quiz.
		 *
		 * Numbers are tidied for display: whole scores should not read as "3.0 out of 5".
		 *
		 * @return {?object} score, max and percentage
		 */
		quizScore() {
			const result = this.quizResult
			if (!result || typeof result.max !== 'number' || result.max <= 0) {
				return null
			}
			const tidy = (value) => Math.round(value * 100) / 100
			return {
				score: tidy(result.score),
				max: tidy(result.max),
				percent: Math.round((result.score / result.max) * 100),
			}
		},

		/**
		 * Each graded question's result, in the order the form asks them.
		 *
		 * @return {object[]} id, text, whether it was right, points earned and available,
		 *                    and the author's feedback for that outcome
		 */
		quizBreakdown() {
			const graded = this.quizResult?.questions
			if (!this.quizScore || !graded || typeof graded !== 'object') {
				return []
			}
			const tidy = (value) => Math.round((Number(value) || 0) * 100) / 100
			return this.form.questions
				.filter((question) => graded[question.id])
				.map((question) => ({
					id: question.id,
					text: question.text,
					correct: graded[question.id].correct === true,
					earned: tidy(graded[question.id].earned),
					points: tidy(graded[question.id].points),
					feedback: graded[question.id].feedback || '',
					// Sent only when the author chose to show the right answers.
					correctAnswer: graded[question.id].correctAnswer || '',
				}))
		},

		/** @return {string} optional banner image address for this form */
		headerImage() {
			return this.form.settings?.headerImage || ''
		},

		/**
		 * Optional accent colour, accepted only as a hex value so a stylesheet cannot be
		 * injected through the style binding.
		 *
		 * @return {string} a validated colour, or empty
		 */
		accentColor() {
			const colour = this.form.settings?.accentColor || ''
			return /^#[0-9a-f]{3,8}$/i.test(colour) ? colour : ''
		},

		/**
		 * Questions in the order they should be shown.
		 *
		 * When the form asks for shuffling, questions are randomised WITHIN each page, so a
		 * section break still anchors its own page. Two kinds of question are deliberately
		 * left where the author put them:
		 *   - sections and media blocks, which define the page structure;
		 *   - anything involved in a display condition, either as the source or the
		 *     dependent, since showing a follow-up before the question it depends on would
		 *     be nonsense.
		 * The order is computed once per page load, so answering a question does not
		 * reshuffle the form under the respondent.
		 *
		 * @return {Array} questions in display order
		 */
		orderedQuestions() {
			if (!this.form.settings?.shuffleQuestions || !this.shuffleSeed) {
				return this.validQuestions
			}

			const anchored = new Set()
			for (const question of this.validQuestions) {
				if (['section', 'image', 'video'].includes(question.type)) {
					anchored.add(question.id)
				}
				const rules = question.extraSettings?.displayCondition?.rules ?? []
				if (rules.length) {
					anchored.add(question.id)
					for (const rule of rules) {
						anchored.add(rule.questionId)
					}
				}
			}

			// Shuffle the movable questions, then drop them back into the non-anchored slots.
			const movable = this.validQuestions.filter((q) => !anchored.has(q.id))
			const shuffled = [...movable]
			let seed = this.shuffleSeed
			for (let i = shuffled.length - 1; i > 0; i--) {
				// Small deterministic PRNG: the order must stay stable for this page load.
				seed = (seed * 1103515245 + 12345) & 0x7fffffff
				const j = seed % (i + 1)
				;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
			}

			let next = 0
			return this.validQuestions.map((question) =>
				anchored.has(question.id) ? question : shuffled[next++],
			)
		},

		/**
		 * questions keyed by id, for resolving displayCondition references.
		 *
		 * @return {Record<number, object>} question id => question
		 */
		questionsById() {
			return Object.fromEntries(
				this.validQuestions.map((question) => [question.id, question]),
			)
		},

		/**
		 * which questions are currently shown, per their cross-question conditions.
		 *
		 * Recomputes as answers change, so a question appears or disappears live. The server
		 * re-evaluates the same rules when validating, so this is presentation only.
		 *
		 * @return {Record<number, boolean>} question id => visible
		 */
		visibleQuestions() {
			const visible = {}
			for (const question of this.validQuestions) {
				visible[question.id] = isQuestionVisible(
					question,
					this.questionsById,
					this.answers,
				)
			}
			return visible
		},

		/**
		 * map of questionId => page index, split at section breaks.
		 *
		 * A form with no sections yields page 0 for everything, so pageCount is 1 and the
		 * view behaves exactly as it did before sections existed.
		 *
		 * @return {Record<number, number>} page index per question id
		 */
		questionPages() {
			const pages = {}
			let page = 0
			let placedOnPage = 0
			for (const question of this.orderedQuestions) {
				const isBreak =
					question.type === 'section'
					&& question.extraSettings?.pageBreak !== false
				// Only break if something is already on this page, otherwise a section as the
				// very first question would leave an empty page in front of it.
				if (isBreak && placedOnPage > 0) {
					page += 1
					placedOnPage = 0
				}
				pages[question.id] = page
				placedOnPage += 1
			}
			return pages
		},

		/**
		 * @return {number} how many pages the form has (1 when there are no section breaks)
		 */
		pageCount() {
			const pages = Object.values(this.questionPages)
			return pages.length ? Math.max(...pages) + 1 : 1
		},

		validQuestions() {
			return this.form.questions.filter((question) => {
				// All questions must have a valid title
				if (question.text?.trim() === '') {
					return false
				}

				// If specific conditions provided, test against them
				if ('validate' in answerTypes[question.type]) {
					return answerTypes[question.type].validate(question)
				}
				return true
			})
		},

		validQuestionsIds() {
			return new Set(this.validQuestions.map((question) => question.id))
		},

		isRequiredUsed() {
			return this.form.questions.reduce(
				(isUsed, question) => isUsed || question.isRequired,
				false,
			)
		},

		/**
		 * Check if form is expired
		 */
		isExpired() {
			return this.form.expires && moment().unix() > this.form.expires
		},

		isArchived() {
			return this.form.state === FormState.FormArchived
		},

		/** @return {number} when the form opens, or 0 when it has no opening time */
		opensAt() {
			const value = Number(this.form.settings?.opensAt)
			return Number.isInteger(value) && value > 0 ? value : 0
		},

		/** @return {boolean} whether the form has an opening time still to come */
		isWaitingToOpen() {
			return this.opensAt > moment().unix()
		},

		/** @return {string} the opening time, written out in the reader's locale */
		openingDate() {
			return moment(this.opensAt, 'X')
				.locale(window.OC.getLanguage())
				.format('LLL')
		},

		/** @return {boolean} whether the reader can edit this form */
		canEditForm() {
			return this.form.permissions?.includes('edit') === true
		},

		isClosed() {
			return this.form.state === FormState.FormClosed
		},

		isMaxSubmissionsReached() {
			return this.form.isMaxSubmissionsReached === true
		},

		/**
		 * Checks if the current state is active.
		 *
		 * @return {boolean} - Returns true if active, otherwise false.
		 */
		isActive() {
			return !this.isArchived && !this.isClosed && !this.isExpired
		},

		infoMessage() {
			let message = ''
			if (this.form.isAnonymous) {
				message += t('forms', 'Responses are anonymous.')
			}
			if (!this.form.isAnonymous && this.isLoggedIn) {
				message += t('forms', 'Responses are connected to your account.')
			}
			if (this.isRequiredUsed) {
				message +=
					' '
					+ t('forms', 'An asterisk (*) indicates mandatory questions.')
			}

			return message
		},

		/**
		 * Rendered HTML of the custom submission message
		 */
		submissionMessageHTML() {
			if (
				this.form.submissionMessage
				&& (this.success || !this.form.canSubmit)
			) {
				return this.markdownit.render(this.form.submissionMessage)
			}
			return ''
		},

		expirationMessage() {
			const relativeDate = moment(this.form.expires, 'X')
				.locale(window.OC.getLanguage())
				.fromNow()
			if (this.isExpired) {
				return t('forms', 'Expired {relativeDate}.', { relativeDate })
			}
			return t('forms', 'Expires {relativeDate}.', { relativeDate })
		},

		/**
		 * Buttons for the "confirm submit empty form" dialog
		 */
		confirmEmptyModalButtons() {
			return [
				{
					label: t('forms', 'Abort'),
					icon: IconCancel,
					callback: () => {},
				},
				{
					label: t('forms', 'Submit'),
					icon: IconCheck,
					variant: 'primary',
					callback: () => this.onConfirmedSubmit(),
				},
			]
		},

		/**
		 * Buttons for the "confirm leave unsubmitted form" dialog
		 */
		confirmLeaveFormButtons() {
			return [
				{
					label: t('forms', 'Abort'),
					icon: IconCancel,
					callback: () => this.confirmButtonCallback(false),
				},
				{
					label: t('forms', 'Leave'),
					icon: IconCheck,
					variant: 'primary',
					callback: () => this.confirmButtonCallback(true),
				},
			]
		},

		/**
		 * Buttons for the "confirm clear form" dialog
		 */
		confirmClearFormButtons() {
			return [
				{
					label: t('forms', 'Abort'),
					icon: IconCancel,
					callback: () => {},
				},
				{
					label: t('forms', 'Clear'),
					icon: IconCheck,
					variant: 'primary',
					callback: () => this.onResetSubmission(),
				},
			]
		},

		hasAnswers() {
			return Object.keys(this.answers).length > 0
		},

		/**
		 * Has anything been answered since the page opened? Answers it opened with, from
		 * a pre-filled link or the respondent's saved draft, are not lost by leaving, so
		 * leaving is not questioned over them.
		 *
		 * @return {boolean} true when leaving would lose answers
		 */
		hasChangesSinceOpen() {
			return (
				Object.keys(this.answers).length !== 0
				&& JSON.stringify(this.answers) !== this.answersAtOpen
			)
		},

		/** @return {boolean} whether to offer another response once one is in */
		canSubmitAnother() {
			return (
				this.success
				&& !this.submissionId
				&& this.form.submitMultiple === true
				&& !this.isMaxSubmissionsReached
				&& this.isActive
			)
		},

		/** @return {string} the answers given so far, as a pre-filled link's query */
		prefilledQuery() {
			return queryFromAnswers(this.validQuestions, this.answers)
		},

		/** @return {boolean} whether to offer the author a pre-filled link */
		canCopyPrefilledLink() {
			return (
				this.form.permissions?.includes('edit') === true
				&& !this.submissionId
				&& this.prefilledQuery !== ''
			)
		},

		submissionId() {
			const id =
				this.$route?.params.submissionId
				|| loadState(appName, 'submissionId', null)
			return id ? parseInt(id) : null
		},
	},

	watch: {
		success(newVal) {
			if (newVal) {
				// Delay populating the live region to avoid the announcement being
				// swallowed by the simultaneous large DOM change (form replaced by
				// success view). Screen readers need a moment to process the new DOM
				// before a polite live region update registers.
				setTimeout(() => {
					this.successAnnouncement =
						this.form.submissionMessage
						|| t('forms', 'Thank you for completing the form!')
				}, 100)
			} else {
				this.successAnnouncement = ''
			}
		},

		hash() {
			// If public view, abort. Should normally not occur.
			if (this.publicView) {
				logger.error('Hash changed on public view. Aborting.')
				return
			}
			this.resetData()
			// Fetch full form on change
			this.fetchFullForm(this.form.id)
			this.initFromLocalStorage()
			this.applyPrefilledAnswers()
			SetWindowTitle(this.formTitle)
		},
	},

	beforeUnmount() {
		window.removeEventListener('beforeunload', this.beforeWindowUnload)
	},

	created() {
		window.addEventListener('beforeunload', this.beforeWindowUnload)
	},

	async beforeMount() {
		// Public Views get their form by initial-state from parent. No fetch necessary.
		if (this.publicView) {
			this.isLoadingForm = false
		} else {
			await this.fetchFullForm(this.form.id)
		}

		if (this.isLoggedIn) {
			if (this.submissionId && this.form.allowEditSubmissions) {
				this.fetchSubmission()
			} else {
				this.initFromLocalStorage()
			}
		}
		this.applyPrefilledAnswers()

		SetWindowTitle(this.formTitle)
	},

	methods: {
		/**
		 * Move to the top of the newly shown page and put focus there.
		 *
		 * Scrolling alone is not enough: a keyboard or screen-reader user would still be
		 * positioned at the bottom of the page they just left, and would have to tab back
		 * through everything to reach the new content.
		 */
		focusPageStart() {
			window.scrollTo({ top: 0, behavior: 'smooth' })
			this.$nextTick(() => {
				const first = (this.$refs.questions ?? []).find(
					(component) =>
						this.questionPages[component.id] === this.currentPage
						&& this.visibleQuestions[component.id],
				)
				first?.$el
					?.querySelector?.('h2, h3, input, textarea, select, button')
					?.focus?.()
			})
		},

		/**
		 * validate only the questions on the page being left, so a respondent is not
		 * told about problems on pages they have not reached yet.
		 *
		 * Matches by the component's own id rather than by array position, so it does not
		 * depend on $refs ordering.
		 *
		 * @return {Promise<boolean>} true when every question on this page is valid
		 */
		async validateCurrentPage() {
			const onThisPage = (this.$refs.questions ?? []).filter(
				(component) => this.questionPages[component.id] === this.currentPage,
			)
			const results = await Promise.all(
				onThisPage.map(async (component) =>
					typeof component.validate === 'function'
						? await component.validate()
						: true,
				),
			)
			return results.every(Boolean)
		},

		/**
		 * advance a page, but only if the current one validates.
		 */
		async goToNextPage() {
			if (!(await this.validateCurrentPage())) {
				return
			}

			// honour any "go to section" / "submit" rule on this page's answers.
			const onThisPage = this.validQuestions.filter(
				(question) =>
					this.questionPages[question.id] === this.currentPage
					&& this.visibleQuestions[question.id],
			)
			const jump = resolveBranching(onThisPage, this.answers)

			let target = this.currentPage + 1
			if (jump?.target === 'submit') {
				// "Submit form" on this answer: go straight to the last page, which is where
				// the submit button lives.
				target = this.pageCount - 1
			} else if (jump?.target === 'section' && jump.questionId !== undefined) {
				const jumpTo = this.questionPages[jump.questionId]
				// Never jump backwards -- that is how an infinite loop gets built.
				if (jumpTo !== undefined && jumpTo > this.currentPage) {
					target = jumpTo
				}
			}

			this.pageHistory.push(this.currentPage)
			this.currentPage = Math.min(target, this.pageCount - 1)
			this.focusPageStart()
		},

		/**
		 * go back a page. Never validates -- going back must always be possible.
		 */
		goToPreviousPage() {
			// retrace the path actually taken. With jumps, currentPage - 1 could land on
			// a page the respondent skipped and never saw.
			const previous = this.pageHistory.pop()
			this.currentPage =
				previous !== undefined ? previous : Math.max(this.currentPage - 1, 0)
			this.focusPageStart()
		},

		/**
		 * Load saved values for current form from LocalStorage
		 *
		 * @return {Record<string,any>}
		 */
		getFormValuesFromLocalStorage() {
			const fromLocalStorage = localStorage.getItem(
				`nextcloud_forms_${this.publicView ? this.shareHash : this.hash}`,
			)
			if (fromLocalStorage) {
				return JSON.parse(fromLocalStorage)
			}
			return null
		},

		/**
		 * Fill in the answers a pre-filled link carries. A respondent's own saved answers
		 * win, so reopening the link does not undo what they had changed; editing a
		 * response takes nothing from the link.
		 */
		applyPrefilledAnswers() {
			if (this.submissionId) {
				return
			}
			const prefilled = answersFromQuery(
				this.validQuestions,
				window.location.search,
			)
			const answers = { ...this.answers }
			for (const [questionId, values] of Object.entries(prefilled)) {
				const current = answers[questionId]
				if (Array.isArray(current) ? current.length > 0 : current) {
					continue
				}
				answers[questionId] = values
			}
			this.answers = answers
			this.answersAtOpen = JSON.stringify(answers)
		},

		/**
		 * Copy a link to this form with the answers given here filled in. The form's
		 * public link is used when it has one, since that is the link people are sent.
		 */
		async copyPrefilledLink() {
			const linkShare = (this.form.shares ?? []).find(
				(share) => share.shareType === OC.Share.SHARE_TYPE_LINK,
			)
			const path = linkShare
				? generateUrl('/apps/forms/s/{hash}', { hash: linkShare.shareWith })
				: generateUrl('/apps/forms/{hash}', { hash: this.form.hash })
			const url = new URL(path, window.location.href)
			url.search = this.prefilledQuery
			try {
				await navigator.clipboard.writeText(url.href)
				showSuccess(t('forms', 'Pre-filled link copied'))
			} catch (error) {
				showError(t('forms', 'Cannot copy, please copy the link manually'))
				logger.error('Copy pre-filled link failed', { error })
			}
		},

		/**
		 * Initialize answers from saved state in LocalStorage
		 */
		initFromLocalStorage() {
			const savedState = this.getFormValuesFromLocalStorage()
			if (!savedState) {
				return
			}

			const answers = {}
			for (const [questionId, answer] of Object.entries(savedState)) {
				// Clean up answers for questions that do not exist anymore
				if (!this.validQuestionsIds.has(parseInt(questionId))) {
					this.showClearFormDueToChangeDialog = true
					logger.debug('Question does not exist anymore', {
						questionId,
					})
					continue
				}

				if (['QuestionMultiple', 'QuestionRanking'].includes(answer.type)) {
					answers[questionId] = answer.value.map(String)
				} else if (answer.type === 'QuestionConditional') {
					// Restore conditional answer structure with proper type conversions
					answers[questionId] = {
						trigger: Array.isArray(answer.value?.trigger)
							? answer.value.trigger.map(String)
							: [],

						subQuestions: answer.value?.subQuestions || {},
					}
				} else {
					answers[questionId] = answer.value
				}
			}
			this.answers = answers
		},

		/**
		 * Save updated answers for question to LocalStorage in case of browser crash / closes / etc
		 *
		 * @param {*} question Question to update
		 */
		addFormFieldToLocalStorage(question) {
			if (!this.isLoggedIn) {
				return
			}
			// We make sure the values are updated by the `values.sync` handler
			const state = {
				...(this.getFormValuesFromLocalStorage() ?? {}),
				[`${question.id}`]: {
					value: this.answers[question.id],
					type: answerTypes[question.type].component.name,
				},
			}
			const stringified = JSON.stringify(state)
			localStorage.setItem(
				`nextcloud_forms_${this.publicView ? this.shareHash : this.hash}`,
				stringified,
			)
		},

		deleteFormFieldFromLocalStorage() {
			if (!this.isLoggedIn) {
				return
			}
			localStorage.removeItem(
				`nextcloud_forms_${this.publicView ? this.shareHash : this.hash}`,
			)
		},

		async fetchSubmission() {
			logger.debug(`Loading response ${this.submissionId}`)

			try {
				const response = await axios.get(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/submissions/{submissionId}',
						{
							id: this.form.id,
							submissionId: this.submissionId,
						},
					),
				)

				const answers = {}
				const loadedAnswers = OcsResponse2Data(response).answers

				// Build a map of subquestion ID → parent conditional question ID
				const subQuestionToParent = new Map()
				for (const question of this.form.questions) {
					if (question.type === 'conditional') {
						const branches = question.extraSettings?.branches || []
						for (const branch of branches) {
							for (const subQuestion of branch.subQuestions || []) {
								subQuestionToParent.set(subQuestion.id, question.id)
							}
						}
					}
				}

				for (const answer of loadedAnswers) {
					const questionId = answer.questionId
					const text = answer.text

					logger.debug(`questionId: ${questionId}, answerId: ${answer.id}`)

					// Check if this answer belongs to a subquestion of a conditional
					const parentConditionalId = subQuestionToParent.get(questionId)
					if (parentConditionalId !== undefined) {
						// Initialize conditional answer structure if needed
						if (!answers[parentConditionalId]) {
							answers[parentConditionalId] = {
								trigger: [],
								subQuestions: {},
							}
						}
						// Add subquestion answer
						if (!answers[parentConditionalId].subQuestions[questionId]) {
							answers[parentConditionalId].subQuestions[questionId] =
								[]
						}
						answers[parentConditionalId].subQuestions[questionId].push(
							text,
						)
						continue
					}

					// Initialize answer array if not already done
					if (!answers[questionId]) {
						answers[questionId] = []
					}

					// Clean up answers for questions that do not exist anymore
					if (!this.validQuestionsIds.has(parseInt(questionId))) {
						this.showClearFormDueToChangeDialog = true
						logger.debug('Question does not exist anymore', {
							questionId,
						})
						continue
					}

					const question = this.form.questions.find(
						(question) => question.id === questionId,
					)
					if (question.type === 'ranking') {
						try {
							answers[questionId].push(...JSON.parse(text).map(String))
						} catch (error) {
							logger.debug(
								`Could not parse ranking answer ${text} for question ${questionId}`,
								{ error },
							)
						}
					} else if (question.type === 'conditional') {
						// Handle conditional trigger answer
						if (!answers[questionId].trigger) {
							answers[questionId] = {
								trigger: [],
								subQuestions: answers[questionId].subQuestions || {},
							}
						}
						// Map trigger answer to option ID for option-based trigger types
						const triggerType = question.extraSettings?.triggerType
						if (
							['multiple', 'multiple_unique', 'dropdown'].includes(
								triggerType,
							)
						) {
							const option = question.options.find(
								(opt) => opt.text === text,
							)
							if (option) {
								answers[questionId].trigger.push(String(option.id))
							} else {
								logger.debug(
									`Trigger option ${text} could not be mapped for conditional question ${questionId}`,
								)
							}
						} else {
							answers[questionId].trigger.push(text)
						}
					} else if (
						['multiple', 'multiple_unique', 'dropdown'].includes(
							question.type,
						)
					) {
						const option = question.options.filter(
							(option) => option.text === text,
						)
						if (option.length > 0) {
							answers[questionId].push(String(option[0].id))
						} else if (
							question.extraSettings.allowOtherAnswer
							&& !answers[questionId].some((answer) =>
								answer.startsWith(
									QUESTION_EXTRASETTINGS_OTHER_PREFIX,
								),
							)
						) {
							answers[questionId].push(
								QUESTION_EXTRASETTINGS_OTHER_PREFIX + text,
							)
						} else {
							// error handling
							logger.debug(
								`option ${text} could not be mapped to an option for question ${questionId}`,
							)
						}
					} else if (question.type === 'file') {
						// File answers cannot be restored when editing a submission —
						// the uploaded file has already been moved to permanent storage
						// and the temporary uploadedFileId no longer exists.
						// The user must re-upload files if needed.
						logger.debug(
							`Skipping file answer for question ${questionId} — cannot restore uploaded files`,
						)
					} else {
						answers[questionId].push(text)
					}
				}

				this.answers = answers
			} catch (error) {
				logger.error('Error while loading response', { error })
				showError(
					t('forms', 'There was an error while loading the response'),
				)
			}
		},

		/**
		 * Update answers of a give value
		 *
		 * @param {{id: number}} question The question to answer
		 * @param {unknown[]} values The new values
		 */
		onUpdate(question, values) {
			this.answers = { ...this.answers, [question.id]: values }
			this.addFormFieldToLocalStorage(question)
		},

		/**
		 * On Enter, focus next form-element
		 * Last form element is the submit button, the form submits on enter then
		 *
		 * @param {object} event The fired event.
		 */
		onKeydownEnter(event) {
			const formInputs = Array.from(this.$refs.form)
			const sourceInputIndex = formInputs.findIndex(
				(input) => input === event.originalTarget,
			)

			// Focus next form element
			formInputs[sourceInputIndex + 1].focus()
		},

		/**
		 * Ctrl+Enter typically fires submit on forms.
		 * Some inputs do automatically, while some need explicit handling
		 */
		onKeydownCtrlEnter() {
			this.$refs.form.requestSubmit()
		},

		/*
		 * Methods for catching unwanted unload events
		 */
		beforeWindowUnload(e) {
			if (this.isActive && !this.submitForm && this.hasChangesSinceOpen) {
				// Cancel the window unload event
				e.preventDefault()
				e.returnValue = ''
			}
		},

		/**
		 * Checks if the user is attempting to leave the form under certain conditions
		 * and shows a confirmation dialog if necessary.
		 *
		 * Conditions to show the confirmation dialog:
		 * - The form is active.
		 * - The form is not currently submitted.
		 * - Something has been answered since the page opened.
		 *
		 * If the conditions are met, a confirmation dialog is shown and a promise is returned.
		 * The promise resolves with the value passed to the confirm button callback.
		 *
		 * @return {Promise<boolean>|boolean} - Returns a promise that resolves with the value
		 * passed to the confirm button callback if the dialog is shown, otherwise returns true.
		 */
		confirmLeaveForm() {
			if (this.isActive && !this.submitForm && this.hasChangesSinceOpen) {
				this.showConfirmLeaveDialog = true
				return new Promise((resolve) => {
					this.confirmButtonCallback = (val) => {
						this.showConfirmLeaveDialog = false
						resolve(val)
					}
				})
			}

			return true
		},

		/**
		 * Submit the form after the browser validated it 🚀 or show confirmation modal if empty
		 */
		async onSubmit() {
			const validation = (this.$refs.questions ?? []).map(
				async (question) => await question.validate(),
			)

			try {
				// wait for all to be validated
				const result = await Promise.all(validation)
				if (result.some((v) => !v)) {
					throw new Error('One question did not validate sucessfully')
				}

				// in case no answer is set or all are empty show the confirmation dialog
				if (
					Object.keys(this.answers).length === 0
					|| Object.values(this.answers).every(
						(answers) => answers.length === 0,
					)
				) {
					this.showConfirmEmptyModal = true
				} else {
					// otherwise do the real submit
					this.onConfirmedSubmit()
				}
			} catch (error) {
				logger.debug('One question is not valid', { error })
				showError(t('forms', 'Some answers are not valid'))
			}
		},

		/**
		 * Handle the real submit of the form, this is only called if the form is not empty or user confirmed to submit
		 */
		async onConfirmedSubmit() {
			this.showConfirmEmptyModal = false
			this.loading = true

			try {
				if (this.submissionId) {
					await axios.put(
						generateOcsUrl(
							'apps/forms/api/v3/forms/{id}/submissions/{submissionId}',
							{
								id: this.form.id,
								submissionId: this.submissionId,
							},
						),
						{
							answers: this.submittedAnswers,
						},
					)
				} else {
					const submitResponse = await axios.post(
						generateOcsUrl('apps/forms/api/v3/forms/{id}/submissions', {
							id: this.form.id,
						}),
						{
							answers: this.submittedAnswers,
							shareHash: this.shareHash,
						},
					)
					// A quiz grades server-side and returns the result; the answer key never
					// reaches the browser, so a respondent cannot read the answers off the page.
					this.quizResult = submitResponse?.data?.ocs?.data ?? null
				}
				this.submitForm = true
				this.success = true
				this.deleteFormFieldFromLocalStorage()
				emit('forms:last-updated:set', this.form.id)
			} catch (error) {
				const errorMessage = error.response?.data?.ocs?.meta?.message
				logger.error('Error while submitting the form', { error })
				if (errorMessage) {
					showError(
						t(
							'forms',
							'There was an error submitting the form: {message}',
							{
								message: errorMessage,
							},
						),
					)
				} else {
					showError(t('forms', 'There was an error submitting the form'))
				}
			} finally {
				this.loading = false
				if (!this.publicView) {
					this.fetchFullForm(this.form.id)
				}
			}
		},

		onResetSubmission() {
			this.deleteFormFieldFromLocalStorage()
			this.resetData()
		},

		/**
		 * Start a fresh response after one has been sent, from the top of the form, with
		 * whatever a pre-filled link carried filled in again.
		 */
		onSubmitAnother() {
			this.resetData()
			this.quizResult = null
			this.applyPrefilledAnswers()
			this.$nextTick(() => {
				this.$el?.scrollIntoView?.({ block: 'start' })
			})
		},

		/**
		 * Reset View-Data
		 */
		resetData() {
			this.answers = {}
			// Back to the first page. Clearing the answers left the respondent on whatever
			// page they had reached, with the earlier pages now empty behind them; and
			// opening another form kept the page number, landing part-way through it or
			// past its end.
			this.currentPage = 0
			this.pageHistory = []
			this.loading = false
			this.showConfirmLeaveDialog = false
			this.showClearFormDialog = false
			this.showClearFormDueToChangeDialog = false
			this.success = false
			this.submitForm = false
		},
	},
}
</script>

<style lang="scss" scoped>
@use '../scssmixins/markdownOutput' as *;

.forms-emptycontent {
	height: 100%;
}

.submit-another {
	margin-block-start: 16px;
	margin-inline: auto;
}

.app-content {
	display: flex;
	align-items: center;
	flex-direction: column;

	&--public:not(.app-forms-embedded *) {
		// Compensate top-padding for missing topbar
		padding-block-start: 50px;
	}

	header,
	form {
		width: 100%;
		max-width: 750px;
		display: flex;
		flex-direction: column;
	}

	// Title & description header, the first card of the form: the form's colour caps it,
	// as a form usually announces itself before it starts asking.
	header {
		background-color: var(--color-main-background);
		border: 2px solid var(--color-border);
		border-radius: var(--border-radius-large);
		margin-block-end: 16px;
		margin-inline-start: var(--default-clickable-area);
		// So the accent band's corners follow the card's.
		overflow: hidden;
		// The contents below are narrowed for small screens, but the header itself was
		// still the full width plus that margin, so a phone scrolled sideways by it.
		width: calc(100% - var(--default-clickable-area));

		.form-title,
		.form-desc,
		.info-message {
			width: calc(
				100% - 58px
			); // margin of header, needed if screen is < 806px (max-width + margin-left)
			font-size: 100%;
			padding-block: 0;
			padding-inline: 18px;
			border: none;
		}
		.form-title {
			font-size: 28px;
			font-weight: bold;
			color: var(--color-main-text);
			line-height: 34px;
			min-height: 36px;
			margin-block: 24px;
			margin-inline: 0;
			padding-block-end: 4px;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.form-desc {
			line-height: 22px;
			padding-block-end: 20px;
			resize: none;
			min-height: 42px;
			color: var(--color-main-text);

			@include markdown-output;
		}

		.info-message {
			padding-block-end: 20px;
			margin-block-start: 4px;
			resize: none;
			color: var(--color-text-maxcontrast);
		}
	}

	.submission-message {
		@include markdown-output;
		& {
			text-align: center;
		}
	}

	form {
		.question {
			// Less padding needed as submit view does not have drag handles
			padding-inline: var(--default-clickable-area);
		}

		// Each question answered on its own surface, the way a paper form gives each its
		// own box: it tells a respondent where one question ends and the next begins,
		// which a long form on a phone otherwise leaves to guesswork. Sections, images
		// and videos are not answered and stay flat, so they read as what they are --
		// dividers between the cards rather than cards themselves.
		// A card is the question itself; a section, an image or a video is not answered
		// and stays flat, so it reads as a divider between cards rather than a card. The
		// class cannot come from the loop above: it would have to fall through two
		// components to reach this element, so the contents say which is which.
		.question:not(:has(.question-section)):not(:has(.question-media)) {
			background-color: var(--color-main-background);
			border: 2px solid var(--color-border);
			border-radius: var(--border-radius-large);
			margin-block-end: 16px;
			padding-block: 16px;
			// The wide inline padding above is room for the editor's drag handles, which
			// a respondent never sees.
			padding-inline: 20px;
			transition: border-color 0.1s ease-in-out;

			:deep(.question__header__title__text) {
				font-size: 17px !important;
			}

			// The question being answered stands out, in the form's own colour when it
			// has one.
			&:focus-within {
				border-color: var(--form-accent, var(--color-primary-element));
			}
		}

		.form-buttons {
			display: flex;
			// Paginated forms add Back and Next, so there can now be four buttons here.
			// Without wrapping they overflow the viewport on a phone.
			flex-wrap: wrap;
			gap: 4px;
			justify-content: flex-end;
		}

		.submit-button {
			margin: 5px;
			margin-block-end: 160px;
			padding-inline-start: 20px;
		}
	}
}

/* page indicator, shown only when the form has section breaks */
.quiz-result {
	text-align: center;

	&__score {
		font-size: 1.1em;
		font-weight: bold;
	}

	&__questions {
		display: flex;
		flex-direction: column;
		gap: 10px;
		list-style: none;
		margin-block: 16px 0;
		margin-inline: auto;
		max-inline-size: 560px;
		padding: 0;
		text-align: start;
	}

	&__question {
		align-items: baseline;
		display: grid;
		gap: 2px 8px;
		grid-template-columns: auto 1fr auto;
	}

	&__mark {
		align-self: center;
		color: var(--color-element-error);
	}

	&__question--correct &__mark {
		color: var(--color-element-success);
	}

	&__points {
		color: var(--color-text-maxcontrast);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	&__feedback {
		color: var(--color-text-maxcontrast);
		grid-column: 2 / -1;
		margin: 0;
	}

	&__answer {
		color: var(--color-main-text);
		font-weight: bold;
	}

	&__percent {
		color: var(--color-text-maxcontrast);
		font-size: 2em;
	}
}

.form-header-image {
	// Inside the header card its corners are the card's, so it is square-cut itself.
	border-radius: 0;
	max-height: 220px;
	object-fit: cover;
	width: 100%;
}

.form-accent {
	// A band across the top of the form, as a form's own colour is usually shown. It was
	// a 72px underline, easy to miss, which made the setting look like it did nothing.
	// It sits on the header card, so only its own top corners are rounded.
	border-start-start-radius: var(--border-radius-large);
	border-start-end-radius: var(--border-radius-large);
	height: 10px;
	margin-block: 0;
	width: 100%;
}

.form-pagination {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
	margin-block: 8px 4px;

	&__track {
		background-color: var(--color-background-dark);
		block-size: 6px;
		border-radius: 3px;
		flex: 1 1 120px;
		overflow: hidden;
	}

	&__fill {
		background-color: var(--color-primary-element);

		// The form's own colour, where it has one. A progress bar carries no text, so
		// unlike the buttons it can take any colour without harming contrast.
		&--accent {
			background-color: var(--form-accent);
		}
		block-size: 100%;
		// Logical, so the bar grows from the reading start edge in both directions.
		border-end-end-radius: 3px;
		border-start-end-radius: 3px;
		transition: inline-size 0.2s ease-in-out;

		@media (prefers-reduced-motion: reduce) {
			transition: none;
		}
	}
}

.form-pagination__label {
	color: var(--color-text-maxcontrast);
	white-space: nowrap;
}

.form-pagination__progress {
	flex: 1 1 auto;
	height: 4px;
}
</style>
