<!--
  - SPDX-FileCopyrightText: 2018 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcAppContent
		:pageHeading="
			form.title ? t('forms', 'Edit form') : t('forms', 'Create form')
		">
		<!-- Show results & sidebar button -->
		<TopBar
			:archived="isFormArchived"
			:locked="isFormLocked"
			:permissions="form?.permissions"
			:sidebarOpened="sidebarOpened"
			:submissionCount="form?.submissionCount"
			@shareForm="onShareForm" />

		<NcEmptyContent
			v-if="isLoadingForm"
			class="emtpycontent"
			:name="
				t('forms', 'Loading {title} …', { title: form.title }, undefined, {
					escape: false,
					sanitize: false,
				})
			">
			<template #icon>
				<NcLoadingIcon :size="64" />
			</template>
		</NcEmptyContent>

		<!-- Without a full form there is nothing to edit, and the editor would break on
		     the partial one the list provided. -->
		<NcEmptyContent
			v-else-if="loadFailed"
			class="emtpycontent"
			:name="t('forms', 'Could not load the form')">
			<template #action>
				<NcButton @click="fetchFullForm(form.id)">
					{{ t('forms', 'Retry') }}
				</NcButton>
			</template>
		</NcEmptyContent>

		<NcEmptyContent
			v-else-if="isFormArchived"
			class="emtpycontent"
			:name="t('forms', 'Form is archived')"
			:description="
				t(
					'forms',
					'Form \'{title}\' is archived and cannot be modified.',
					{ title: form.title },
					undefined,
					{ escape: false, sanitize: false },
				)
			">
			<template #icon>
				<NcIconSvgWrapper :svg="IconLock" :size="64" />
			</template>
			<!-- Archiving the open form leaves no edit view to switch from, so the view
			     switch disappears with it; the responses are still there to look at. -->
			<template v-if="canShowResults" #action>
				<NcButton @click="showResults">
					{{ t('forms', 'Show responses') }}
				</NcButton>
			</template>
		</NcEmptyContent>

		<NcEmptyContent
			v-else-if="isFormLocked"
			class="emtpycontent"
			:name="t('forms', 'Form is locked')"
			:description="lockNotice">
			<template #icon>
				<NcIconSvgWrapper :svg="IconLock" :size="64" />
			</template>
		</NcEmptyContent>

		<!-- The editor shows the form's own words, so it is laid out the form's way. The
		     title and description keep `dir="auto"` of their own: they are what an author
		     is typing, and the direction has to follow the keystrokes rather than wait for
		     the form to be saved. -->
		<template v-else>
			<!-- Forms title & description-->
			<header :dir="formDirection" :lang="formLanguage || undefined">
				<h2>
					<label class="hidden-visually" for="form-title">{{
						t('forms', 'Form title')
					}}</label>
					<textarea
						id="form-title"
						ref="title"
						v-model="form.title"
						class="form-title"
						rows="1"
						dir="auto"
						:style="{ textAlign: authorTextAlign }"
						:maxlength="maxStringLengths.formTitle"
						:placeholder="t('forms', 'Form title')"
						required
						autofocus
						@keydown.enter.prevent
						@input="onTitleChange" />
				</h2>
				<label class="hidden-visually" for="form-desc">
					{{ t('forms', 'Description') }}
				</label>
				<textarea
					id="form-desc"
					ref="description"
					class="form-desc"
					rows="1"
					dir="auto"
					:style="{ textAlign: authorTextAlign }"
					:value="form.description"
					:placeholder="
						t(
							'forms',
							'Description (formatting using Markdown is supported)',
						)
					"
					:maxlength="maxStringLengths.formDescription"
					@input="updateDescription" />
				<!-- Show expiration message-->
				<p v-if="form.expires && form.showExpiration" class="info-message">
					<bdi>{{ expirationMessage }}</bdi>
				</p>
				<!-- Generate form information message-->
				<p v-if="infoMessage" class="info-message">
					<bdi>{{ infoMessage }}</bdi>
				</p>
			</header>

			<!-- Autosave status: title and description save as they are typed, and
			     otherwise only a failure was ever reported. Outside the header, which is
			     laid out in the form's language; this line is in the reader's. Not a live
			     region: it changes at every pause in typing, and hearing that twice each
			     time is noise. Only a failure is announced, from the line below. -->
			<p class="save-status">
				{{ saveStatus }}
			</p>
			<p class="hidden-visually" role="status">
				{{ formSaveFailed ? t('forms', 'Not saved') : '' }}
			</p>

			<section :dir="formDirection" :lang="formLanguage || undefined">
				<!-- Questions list -->
				<QuestionList
					ref="questionList"
					v-model="form.questions"
					:getComponent="getQuestionComponent"
					:getAnswerType="getQuestionAnswerType"
					:maxStringLengths="maxStringLengths"
					:formId="form.id"
					:showInsert="true"
					:insertMenuName="t('forms', 'Insert question')"
					:answerTypesFilter="answerTypesFilter"
					:hasSubtypes="hasSubtypes"
					:isLoadingQuestions="isLoadingQuestions"
					:isMobile="isMobile"
					:insertMenuOpenedIndex="insertMenuOpenedIndex"
					@update:insertMenuOpenedIndex="insertMenuOpenedIndex = $event"
					@updateProperty="onUpdateProperty"
					@clone="cloneQuestion"
					@delete="(question) => deleteQuestion(question.id)"
					@moveDown="onMoveDown"
					@moveUp="onMoveUp"
					@dragStart="onQuestionDragStart"
					@orderChange="onQuestionOrderChange(orderBeforeDrag)"
					@addQuestion="addQuestion" />

				<!-- Add new questions menu -->
				<div class="question-menu">
					<AddQuestionMenu
						v-model:open="questionMenuOpened"
						:menuName="t('forms', 'Add a question')"
						:aria-label="t('forms', 'Add a question')"
						:isLoadingQuestions="isLoadingQuestions"
						:answerTypesFilter="answerTypesFilter"
						:hasSubtypes="hasSubtypes"
						primary
						@addQuestion="addQuestion" />
					<NcButton
						:disabled="isLoadingQuestions"
						variant="secondary"
						@click="showImportDialog = true">
						<template #icon>
							<NcIconSvgWrapper :svg="IconImport" />
						</template>
						{{ t('forms', 'Import questions') }}
					</NcButton>
				</div>
				<ImportQuestionsDialog
					v-if="showImportDialog"
					v-model:open="showImportDialog"
					:formId="form.id"
					@imported="onQuestionsImported" />
			</section>

			<!-- Deleting a question takes every answer given to it with it. While the form
			     is still being written there is nothing to lose and nothing to ask about;
			     once people have answered, there is. -->
			<NcDialog
				v-model:open="showConfirmDeleteQuestion"
				:name="t('forms', 'Delete question')"
				:message="confirmDeleteQuestionMessage"
				:buttons="confirmDeleteQuestionButtons" />
		</template>
	</NcAppContent>
</template>

<script>
import IconCancel from '@material-symbols/svg-400/outlined/block.svg?raw'
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconImport from '@material-symbols/svg-400/outlined/library_add.svg?raw'
import IconLock from '@material-symbols/svg-400/outlined/lock.svg?raw'
import { getCurrentUser } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { loadState } from '@nextcloud/initial-state'
import { translatePlural as n, translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import { generateOcsUrl } from '@nextcloud/router'
import { useIsMobile } from '@nextcloud/vue'
import debounce from 'debounce'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import AddQuestionMenu from '../components/AddQuestionMenu.vue'
import ImportQuestionsDialog from '../components/ImportQuestionsDialog.vue'
import QuestionList from '../components/Questions/QuestionList.vue'
import TopBar from '../components/TopBar.vue'
import ViewsMixin from '../mixins/ViewsMixin.js'
import answerTypes from '../models/AnswerTypes.js'
import { FormState, INPUT_DEBOUNCE_MS } from '../models/Constants.ts'
import logger from '../utils/Logger.js'
import OcsResponse2Data from '../utils/OcsResponse2Data.js'
import SetWindowTitle from '../utils/SetWindowTitle.js'

window.axios = axios

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Create',

	components: {
		ImportQuestionsDialog,
		NcButton,
		NcDialog,
		NcIconSvgWrapper,
		AddQuestionMenu,
		NcAppContent,
		NcEmptyContent,
		NcLoadingIcon,
		QuestionList,
		TopBar,
	},

	mixins: [ViewsMixin],

	// the Logic dialog needs every question of the form, to offer condition sources and
	// jump targets. Provided as a getter rather than threaded through QuestionList as props;
	// calling it inside the child's computed keeps it reactive.
	provide() {
		return {
			formQuestions: () => this.form.questions,
			// The Logic dialog only offers answer-key fields when the form is a quiz.
			formSettings: () => this.form.settings ?? {},
		}
	},

	setup() {
		return {
			IconLock,
			IconImport,
			isMobile: useIsMobile(),
		}
	},

	data() {
		return {
			answerTypes,

			// Various states
			isLoadingQuestions: false,
			showImportDialog: false,

			maxStringLengths: loadState('forms', 'maxStringLengths'),
			questionMenuOpened: false,
			activeQuestionType: null,

			// Title and description edits still inside the autosave's debounce wait, so
			// the status does not claim everything is saved while it is not yet sent.
			formEditsPending: {
				title: false,
				description: false,
			},

			// when set to a number, the next created question will be inserted at this index
			insertMenuOpenedIndex: null,

			// Question order saves: a counter to recognise the newest, a queue that sends
			// them one at a time, the ids to restore if the newest fails, and the ids a
			// drag started from.
			orderSaveSeq: 0,
			orderSaveChain: Promise.resolve(),
			orderRollback: null,
			orderBeforeDrag: null,

			/** The question the delete dialog is asking about, or null when it is closed */
			questionPendingDelete: null,
			showConfirmDeleteQuestion: false,

			confirmDeleteQuestionButtons: [
				{
					label: t('forms', 'Cancel'),
					icon: IconCancel,
					variant: 'tertiary',
					callback: () => {
						this.questionPendingDelete = null
					},
				},
				{
					label: t('forms', 'Delete question'),
					icon: IconDelete,
					variant: 'error',
					callback: () => {
						this.deleteQuestionConfirmed()
					},
				},
			],
		}
	},

	computed: {
		/**
		 * What deleting this question will cost. The form's own response count is the
		 * honest figure to quote: the editor is not told how many of those answered this
		 * particular question, and inventing a number would be worse than not giving one.
		 *
		 * @return {string} the question to put before deleting it
		 */
		confirmDeleteQuestionMessage() {
			const question = (this.form?.questions ?? []).find(
				(candidate) => candidate.id === this.questionPendingDelete,
			)
			const title = question?.text?.trim()
			const responses = this.form?.submissionCount ?? 0
			// n() rather than t(): the count has to choose the plural form, and Arabic has six.
			return title
				? n(
						'forms',
						'"{question}" and any answers given to it in the %n response already received will be deleted. It cannot be undone.',
						'"{question}" and any answers given to it in the %n responses already received will be deleted. It cannot be undone.',
						responses,
						{ question: title },
						// The dialog shows the message as text; escaping or sanitising would
						// put entities such as &amp; on screen.
						{ escape: false, sanitize: false },
					)
				: n(
						'forms',
						'This question and any answers given to it in the %n response already received will be deleted. It cannot be undone.',
						'This question and any answers given to it in the %n responses already received will be deleted. It cannot be undone.',
						responses,
					)
		},

		/** @return {string} what the title and description autosave is doing */
		saveStatus() {
			if (
				this.formSavingCount > 0
				|| this.formEditsPending.title
				|| this.formEditsPending.description
			) {
				return t('forms', 'Saving …')
			}
			if (this.formSaveFailed) {
				return t('forms', 'Not saved')
			}
			// Only the title and description are tracked here; questions save on their own,
			// so this must not claim that everything is saved.
			return this.formSavedOnce
				? t('forms', 'Title and description saved')
				: ''
		},

		hasQuestions() {
			return this.form.questions && this.form.questions.length === 0
		},

		isRequiredUsed() {
			return (this.form.questions ?? []).reduce(
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

		/**
		 * Check if the form was archived
		 */
		isFormArchived() {
			return this.form.state === FormState.FormArchived
		},

		infoMessage() {
			let message = ''
			if (this.form.isAnonymous) {
				message += t('forms', 'Responses are anonymous.')
			}

			// On Submit, this is dependent on `isLoggedIn`. Create-view is always logged in and the variable isLoggedIn does not exist.
			if (!this.form.isAnonymous && true) {
				message += t('forms', 'Responses are connected to your account.')
			}

			if (this.isRequiredUsed) {
				message +=
					' '
					+ t('forms', 'An asterisk (*) indicates mandatory questions.')
			}

			return message
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

		// Remove properties from answerTypes for create button
		answerTypesFilter() {
			// Remove 'datetime' from answerTypes for create button
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { datetime, ...filteredAnswerTypes } = answerTypes
			return filteredAnswerTypes
		},

		hasSubtypes() {
			return (answer) =>
				answer && answer.subtypes && Object.keys(answer.subtypes).length > 0
		},

		getQuestionComponent() {
			return (question) => answerTypes[question.type]?.component
		},

		getQuestionAnswerType() {
			return (question) => answerTypes[question.type]
		},

		/**
		 * When the lock ends, as a date and time: a relative "in 2 hours" would go stale
		 * while the page stays open.
		 *
		 * @return {string} the formatted end, or '' for a permanent lock
		 */
		lockedUntilFormatted() {
			if (this.form.lockedUntil === 0 || this.form.lockedUntil === null) {
				return ''
			}
			return moment(this.form.lockedUntil, 'X')
				.locale(window.OC.getLanguage())
				.format('LLL')
		},

		/**
		 * Who holds the lock and for how long, in the same whole sentences as the
		 * sidebar, so translators never have to fit a separately translated "never"
		 * into one and both places describe the lock alike.
		 *
		 * @return {string} the notice text
		 */
		lockNotice() {
			const lockHolder = this.form.lockedBy || this.form.ownerId
			const currentUser = getCurrentUser()
			// Only the account id is known for anyone else; for oneself the display name is.
			const lockedBy =
				currentUser && lockHolder === currentUser.uid
					? currentUser.displayName || lockHolder
					: lockHolder
			// Shown as plain text, so the values need no HTML escaping or sanitising.
			if (this.lockedUntilFormatted === '') {
				return t('forms', 'Locked by {lockedBy}', { lockedBy }, undefined, {
					escape: false,
					sanitize: false,
				})
			}
			return t(
				'forms',
				'Locked by {lockedBy} until {lockedUntil}',
				{ lockedBy, lockedUntil: this.lockedUntilFormatted },
				undefined,
				{ escape: false, sanitize: false },
			)
		},

		/**
		 * The same test the view switch uses: people who answered a form may see their
		 * own responses even without the results permission.
		 *
		 * @return {boolean} whether this user may open the form's responses
		 */
		canShowResults() {
			return (
				(this.form.permissions ?? []).includes('results')
				|| this.form.submissionCount > 0
			)
		},
	},

	watch: {
		// Fetch full form on change
		hash() {
			this.fetchFullForm(this.form.id)
		},

		// Update Window-Title on title change
		'form.title': function () {
			SetWindowTitle(this.formTitle)
		},

		// resize description if form is loaded
		isLoadingForm(value) {
			if (!value) {
				this.resizeTitle()
				this.resizeDescription()
			}
		},
	},

	mounted() {
		this.fetchFullForm(this.form.id)
		SetWindowTitle(this.formTitle)
	},

	methods: {
		/** Open the responses of this form. */
		showResults() {
			this.$router
				.push({ name: 'results', params: { hash: this.form.hash } })
				.catch((error) => {
					logger.debug('Navigation cancelled', { error })
				})
		},

		onUpdateProperty(index, property, value) {
			this.form.questions[index][property] = value
		},

		onMoveUp(index) {
			if (index > 0) {
				const previous = this.form.questions.map((question) => question.id)
				;[this.form.questions[index - 1], this.form.questions[index]] = [
					this.form.questions[index],
					this.form.questions[index - 1],
				]
				this.onQuestionOrderChange(previous)
			}
		},

		onMoveDown(index) {
			// only if not the last one
			if (index < this.form.questions.length - 1) {
				this.onMoveUp(index + 1)
			}
		},

		onTitleChange() {
			this.resizeTitle()
			this.formEditsPending.title = true
			this.saveTitle()
		},

		/**
		 * Auto adjust the title height based its scroll height
		 */
		resizeTitle() {
			this.$nextTick(() => {
				const textarea = this.$refs.title
				// Not there when the form failed to load.
				if (!textarea) {
					return
				}
				// Only the height: replacing the whole inline style would also drop the
				// alignment the form's declared language sets.
				textarea.style.height = '0'
				// include 2px border
				textarea.style.height = `${textarea.scrollHeight + 4}px`
			})
		},

		/**
		 * Auto adjust the description height based on its scroll height
		 */
		resizeDescription() {
			// nextTick to ensure textarea is attached to DOM
			this.$nextTick(() => {
				const textarea = this.$refs.description
				// Not there when the form failed to load.
				if (!textarea) {
					return
				}
				// Only the height: replacing the whole inline style would also drop the
				// alignment the form's declared language sets.
				textarea.style.height = '0'
				// include 2px border
				textarea.style.height = `${textarea.scrollHeight + 4}px`
			})
		},

		/**
		 * Update the description
		 *
		 * @param {InputEvent} ev The input event of the textarea
		 */
		updateDescription({ target }) {
			this.form.description = target.value
			this.resizeDescription()
			this.formEditsPending.description = true
			this.saveDescription()
		},

		/**
		 * Title & description save methods
		 */
		saveTitle: debounce(async function () {
			// saveFormProperty counts itself as running before its first await, so the
			// status never flickers to "saved" in between.
			this.formEditsPending.title = false
			this.saveFormProperty('title')
		}, INPUT_DEBOUNCE_MS),

		saveDescription: debounce(async function () {
			this.formEditsPending.description = false
			this.saveFormProperty('description')
		}, INPUT_DEBOUNCE_MS),

		/**
		 * Add a new question to the current form
		 *
		 * @param {string} type the question type, see AnswerTypes
		 * @param {string|null} subtype the question subtype, see AnswerTypes.subtypes
		 * @param {number|null} position where the new question should be added
		 */
		/**
		 * Append questions copied from another form.
		 *
		 * The server has already created them, so this only reflects them in the open editor
		 * rather than re-fetching the whole form.
		 *
		 * @param {Array} created the questions the server returned
		 */
		onQuestionsImported(created) {
			for (const question of created) {
				this.form.questions.push({ ...question, answers: [] })
			}
			if (created.length === 0) {
				return
			}
			emit('forms:last-updated:set', this.form.id)
			// The copies land at the end of what may be a long form, out of sight once the
			// dialog closes, so say that it worked and take the editor to the first of them.
			showSuccess(
				n(
					'forms',
					'%n question imported',
					'%n questions imported',
					created.length,
				),
			)
			// The dialog closes in the same update, and its focus trap hands focus back to
			// the button that opened it one macrotask after unmounting; move on after that.
			this.$nextTick(() => {
				setTimeout(() => {
					this.$refs.questionList?.focusQuestion(created[0].id)
				}, 0)
			})
		},

		async addQuestion(type, subtype = null, position = null) {
			this.activeQuestionType = null
			const text = ''
			this.isLoadingQuestions = true

			try {
				// A preset is a normal question type created with settings already filled in
				// (Net Promoter Score is a 0-10 linear scale with the standard labels). Doing
				// it client-side means presets need no new backend type, and therefore cannot
				// collide with anything upstream later introduces.
				const preset = answerTypes[type]?.preset
				const body = {
					type: preset?.type ?? type,
					text,
					subtype: preset?.subtype ?? subtype,
				}
				if (position !== null) {
					// position: current question position + 2 (0-based index: +1, next position: +1)
					body.position = position + 2
				}

				const response = await axios.post(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/questions', {
						id: this.form.id,
					}),
					body,
				)
				const question = OcsResponse2Data(response)

				// Seed the preset's options (a Likert scale's columns, and a starter row),
				// then its settings. Options are created in one call per type rather than
				// one per option.
				if (preset?.options) {
					for (const [optionType, optionTexts] of Object.entries(
						preset.options,
					)) {
						try {
							const optionResponse = await axios.post(
								generateOcsUrl(
									'apps/forms/api/v3/forms/{id}/questions/{questionId}/options',
									{ id: this.form.id, questionId: question.id },
								),
								{ optionTexts, optionType },
							)
							question.options = [
								...(question.options ?? []),
								...OcsResponse2Data(optionResponse),
							]
						} catch (error) {
							// The question exists and can be filled in by hand; only the
							// preconfiguration failed.
							logger.error('Could not apply question preset options', {
								error,
							})
						}
					}
				}

				// Seed the preset's settings, then carry them into the local copy so the
				// question renders configured straight away rather than after a reload.
				if (preset?.extraSettings) {
					try {
						await axios.patch(
							generateOcsUrl(
								'apps/forms/api/v3/forms/{id}/questions/{questionId}',
								{ id: this.form.id, questionId: question.id },
							),
							{
								keyValuePairs: {
									extraSettings: preset.extraSettings,
								},
							},
						)
						question.extraSettings = {
							...(question.extraSettings ?? {}),
							...preset.extraSettings,
						}
					} catch (error) {
						// The question exists and is usable; only the preconfiguration failed.
						logger.error('Could not apply question preset', { error })
					}
				}

				// Delegate insertion & focus handling to helper
				this.insertQuestion(question, { text, type, answers: [] }, position)
			} catch (error) {
				logger.error('Error while adding new question', { error })
				showError(
					t('forms', 'There was an error while adding the new question'),
				)
			} finally {
				this.isLoadingQuestions = false
			}
		},

		/**
		 * Delete a question
		 *
		 * @param {number} questionId the question id to delete
		 */
		/**
		 * Delete a question - after asking, once the form has answers to lose.
		 *
		 * Writing a form means adding and removing questions constantly, and a
		 * confirmation on every one of those would be noise. The moment somebody has
		 * answered, the same click also deletes what they wrote, and that is worth a
		 * question.
		 *
		 * @param {number} questionId the question to delete
		 */
		deleteQuestion(questionId) {
			if (!(this.form.submissionCount > 0)) {
				this.questionPendingDelete = questionId
				this.deleteQuestionConfirmed()
				return
			}
			this.questionPendingDelete = questionId
			this.showConfirmDeleteQuestion = true
		},

		/** Delete the question the dialog named, once it has been agreed to. */
		async deleteQuestionConfirmed() {
			const questionId = this.questionPendingDelete
			this.questionPendingDelete = null
			this.showConfirmDeleteQuestion = false
			if (questionId === null) {
				return
			}
			this.isLoadingQuestions = true
			const formId = this.form.id

			try {
				await axios.delete(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/questions/{questionId}',
						{
							id: formId,
							questionId,
						},
					),
				)
				emit('forms:last-updated:set', formId)
				// Another form may be open by now, or the list may have changed; only remove
				// the question from the form it belonged to, and only if it is still there.
				if (this.form.id !== formId) {
					return
				}
				const index = (this.form.questions ?? []).findIndex(
					(search) => search.id === questionId,
				)
				if (index === -1) {
					return
				}
				// The menu the delete came from goes with the card, and focus would fall to
				// the page body; move it to the question now in its place instead.
				const neighbour =
					this.form.questions[index + 1] ?? this.form.questions[index - 1]
				this.form.questions.splice(index, 1)
				this.$nextTick(() => {
					if (neighbour) {
						this.$refs.questionList?.focusQuestion(neighbour.id)
					} else {
						this.$el.querySelector?.('.question-menu button')?.focus()
					}
				})
			} catch (error) {
				logger.error(`Error while removing question ${questionId}`, {
					error,
				})
				showError(
					t('forms', 'There was an error while removing the question'),
				)
			} finally {
				this.isLoadingQuestions = false
			}
		},

		insertQuestion(questionData, defaultFields = {}, position = null) {
			const newQuestionObj = {
				...defaultFields,
				...questionData,
			}

			let insertAt = null
			if (
				questionData
				&& questionData.order !== undefined
				&& questionData.order !== null
			) {
				insertAt = Number(questionData.order) - 1
			} else if (position !== null) {
				insertAt = position
			}

			if (insertAt !== null && insertAt <= this.form.questions.length) {
				this.form.questions.splice(insertAt, 0, newQuestionObj)
				this.$nextTick(() => {
					this.$refs.questionList?.focusQuestion(newQuestionObj.id)
				})
			} else {
				this.form.questions.push(newQuestionObj)
				this.$nextTick(() => {
					this.$refs.questionList?.focusQuestion(newQuestionObj.id)
				})
			}

			emit('forms:last-updated:set', this.form.id)
		},

		/**
		 * Clone a question
		 *
		 * @param {number} id the question id to clone in the current form
		 * @param {number} position where the cloned question should be added
		 */
		async cloneQuestion({ id }, position) {
			this.isLoadingQuestions = true

			try {
				const url = generateOcsUrl(
					'apps/forms/api/v3/forms/{id}/questions?fromId={questionId}',
					{
						id: this.form.id,
						questionId: id,
					},
				)

				const body = {}
				if (position !== null) {
					// position: current question position + 2 (0-based index: +1, next position: +1)
					body.position = position + 2
				}

				const response = await axios.post(url, body)
				const question = OcsResponse2Data(response)

				// Delegate insertion & focus handling to helper
				this.insertQuestion(question, { answers: [] })
			} catch (error) {
				logger.error(`Error while duplicating question ${id}`, {
					error,
				})
				showError(
					t('forms', 'There was an error while duplicating the question'),
				)
			} finally {
				this.isLoadingQuestions = false
			}
		},

		/** Remember the order a drag starts from; the list has already moved by the time it reports. */
		onQuestionDragStart() {
			this.orderBeforeDrag = this.form.questions.map((question) => question.id)
		},

		/**
		 * Save the order the editor now shows.
		 *
		 * The list moves before the request is sent, so a failed save would leave the editor
		 * showing an order respondents never get. Saves also go out one after another: each
		 * carries the whole order, and two overlapping ones could finish the wrong way round
		 * and leave the server with the older of the two.
		 *
		 * @param {Array<number>|null} previous question ids in the order before this change
		 * @return {Promise} settles once this save is done
		 */
		onQuestionOrderChange(previous = null) {
			const seq = ++this.orderSaveSeq
			const newOrder = this.form.questions.map((question) => question.id)
			// The order to go back to is the last one the server is known to hold: the one
			// before the first change that is still waiting to be saved.
			if (this.orderRollback === null) {
				this.orderRollback = previous
			}
			this.isLoadingQuestions = true

			this.orderSaveChain = this.orderSaveChain.then(async () => {
				try {
					await axios.patch(
						generateOcsUrl('apps/forms/api/v3/forms/{id}/questions', {
							id: this.form.id,
						}),
						{
							newOrder,
						},
					)
					emit('forms:last-updated:set', this.form.id)
					this.orderRollback = seq === this.orderSaveSeq ? null : newOrder
				} catch (error) {
					logger.error('Error while saving question order', { error })
					// A later save still in the queue sends a complete order of its own, so
					// only the newest failure has anything to undo.
					if (seq === this.orderSaveSeq) {
						this.restoreQuestionOrder(this.orderRollback)
						this.orderRollback = null
						showError(
							t('forms', 'The new question order could not be saved'),
						)
					}
				} finally {
					if (seq === this.orderSaveSeq) {
						this.isLoadingQuestions = false
					}
				}
			})
			return this.orderSaveChain
		},

		/**
		 * Put the questions back into a saved order. Questions that order does not know
		 * about go to the end.
		 *
		 * @param {Array<number>|null} order question ids
		 */
		restoreQuestionOrder(order) {
			if (!order) {
				return
			}
			const rank = new Map(order.map((id, position) => [id, position]))
			const last = order.length
			this.form.questions = [...this.form.questions].sort(
				(a, b) => (rank.get(a.id) ?? last) - (rank.get(b.id) ?? last),
			)
		},
	},
}
</script>

<style lang="scss" scoped>
.emptycontent {
	display: flex;
	height: 100%;
}

.app-content {
	display: flex;
	align-items: center;
	flex-direction: column;

	header,
	section {
		width: 100%;
		max-width: 750px;
	}

	// Title & description header
	header {
		display: flex;
		flex-direction: column;
		margin: 0;
		margin-block-end: 24px;
		padding-inline-start: 32px;
		margin-inline-end: -24px;
		// The parent centres its children by their margin box, so with the full width
		// that negative margin pushed the header 12px past the edge on a narrow screen --
		// a sideways scroll in a left-to-right form, and clipped content in a right-to-left
		// one, where that edge cannot be scrolled to. Wide screens still get 750px.
		width: calc(100% - 24px);

		.form-title {
			font-size: 28px;
			font-weight: bold;
			line-height: 34px;
			color: var(--color-main-text);
			min-height: 36px;
			// padding and margin should be aligned with the submit view (but keep the 2px border in mind)
			padding-block: 4px;
			padding-inline: 10px;
			margin-block: 22px 14px;
			margin-inline: 0;
			width: calc(
				100% - 58px
			); // margin of header, needed if screen is < 806px (max-width + margin-left)
			overflow: hidden;
			text-overflow: ellipsis;
			resize: none;

			&::placeholder {
				font-size: 28px;
			}
		}

		.form-desc,
		.info-message {
			font-size: 100%;
			min-height: unset;
			padding-block: 0px 20px;
			padding-inline: 12px;
			width: calc(100% - 58px);
		}

		.form-desc {
			color: var(--color-main-text);
			line-height: 22px;
			min-height: 47px; // one line (25px padding + 22px text height)
			padding-block-start: 5px; // spacing border<>text
			margin: 0px;
			padding-block: 3px 18px; // 2px smaller because of border
			padding-inline: 10px;
			resize: none;
		}

		.info-message {
			margin-block-start: 4px;
			resize: none;
			color: var(--color-text-maxcontrast);
		}
	}

	// Sits in the gap under the header, lined up with the description text
	// (the header's 32px start padding plus the textarea's own 12px).
	.save-status {
		color: var(--color-text-maxcontrast);
		font-size: var(--font-size-small, 13px);
		line-height: 20px;
		// Reserve the line so the questions do not jump when the status appears.
		min-height: 20px;
		margin-block: -24px 4px;
		padding-inline: 44px 12px;
		width: 100%;
		max-width: 750px;
	}

	// Questions container
	section {
		position: relative;
		display: flex;
		flex-direction: column;
		margin-block-end: 250px;

		// A section break is a boundary in the form, and while editing it looked like
		// one more question: the same card, the same 16px title, the same everything.
		// The only thing distinguishing it was a line of body text two rows down, so
		// scanning a long form told the author nothing about its structure. It gets the
		// rule that divides the form - drawn across the card, above the title, where the
		// break actually falls - and a title a step larger than the questions it heads.
		// Respondents already saw this: there a section is 24px and heads its own page.
		//
		// :deep, and it has to be. Submit.vue reaches `.question` with a plain selector
		// because it renders the questions itself, so its scope id lands on the card.
		// Here they sit inside the sortable list's own `ul`, several components down,
		// and the card carries three scope ids - none of them this file's.
		:deep(.question:has(.question-section)) {
			&::before {
				border-block-start: 2px solid
					var(--color-border-dark, var(--color-border));
				content: '';
				display: block;
				// Out to the card's own edges, past the padding that leaves room for the
				// drag handles. Both literals mirror Question.vue's own
				// `padding-inline: 56px 8px` - deriving the start from
				// --default-clickable-area looked tidier and was wrong: that token is
				// 34px here, not the 44px the 56 was built from, so the rule stopped
				// 10px short of the edge. Logical sides, like that padding: in a
				// right-to-left form the handle gutter is on the right.
				margin-block: 0 20px;
				margin-inline: -56px -8px;
			}

			.question__header__title__text {
				font-size: 20px !important;
			}

			// The rule the section drew under its own title is what respondents see;
			// here the one above the card says it better, and two would be noise.
			.question-section__rule {
				display: none;
			}
		}

		.question-menu {
			position: sticky;
			inset-block-end: 16px;
			// It floats over whatever is beneath it, so it carries its own ground rather
			// than letting a question's words run under the buttons. A patch of the page
			// colour alone read as a hole punched in the form: an outline and a shadow
			// say the bar is in front of the questions rather than cut out of them.
			background-color: var(--color-main-background);
			border: 1px solid var(--color-border);
			border-radius: var(--border-radius-large);
			box-shadow: 0 2px 12px rgba(var(--color-box-shadow-rgb, 0, 0, 0), 0.25);
			padding: 6px;
			// Above other menus
			z-index: 55;
			display: flex;
			align-items: center;
			align-self: flex-start;
			// Two labelled buttons plus the start margin are wider than a small phone,
			// so let the second one drop to its own row rather than overflow.
			flex-wrap: wrap;
			gap: 4px;
			margin-block-end: 16px;
			max-width: calc(100% - var(--default-clickable-area));

			// To align with text
			margin-inline-start: var(--default-clickable-area);

			@media (max-width: 400px) {
				max-width: 100%;
				margin-inline-start: 0;
			}
		}
	}
}
</style>
