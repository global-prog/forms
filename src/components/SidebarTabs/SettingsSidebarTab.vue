<!--
  - SPDX-FileCopyrightText: 2021 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="sidebar-tabs__content">
		<NcNoteCard
			v-if="locked"
			type="info"
			:heading="t('forms', 'Form is locked')"
			:text="lockNotice" />
		<NcButton
			v-if="locked && isCurrentUserOwner"
			wide
			@click="onFormLockChange(false)">
			<template #icon>
				<NcIconSvgWrapper :svg="svgLockOpen" />
			</template>
			<!-- TRANSLATORS text for the action triggered by the button -->
			{{ t('forms', 'Unlock form') }}
		</NcButton>
		<h4 class="settings-group">{{ t('forms', 'Responses') }}</h4>
		<NcCheckboxRadioSwitch
			:modelValue="form.isAnonymous"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onAnonChange">
			<!-- TRANSLATORS Checkbox to select whether responses will be stored anonymously or not -->
			{{ t('forms', 'Store responses anonymously') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch
			:description="disableSubmitMultipleExplanation || undefined"
			:modelValue="submitMultiple"
			:disabled="disableSubmitMultiple || formArchived || locked"
			type="switch"
			@update:modelValue="onSubmitMultipleChange">
			{{ t('forms', 'Allow multiple responses per person') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch
			:modelValue="form.allowEditSubmissions"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onAllowEditSubmissionsChange">
			{{ t('forms', 'Allow editing own responses') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch
			v-if="appConfig.allowComments"
			:modelValue="form.allowComments"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onAllowCommentsChange">
			{{ t('forms', 'Allow comments') }}
		</NcCheckboxRadioSwitch>
		<h4 class="settings-group">{{ t('forms', 'Quiz') }}</h4>
		<NcCheckboxRadioSwitch
			:modelValue="quizMode"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onQuizModeChange">
			{{ t('forms', 'Quiz mode') }}
		</NcCheckboxRadioSwitch>
		<p v-show="quizMode" class="settings-hint">
			{{
				t(
					'forms',
					'Set an answer key on each question from its Logic menu. Questions without a key are not scored.',
				)
			}}
		</p>
		<NcCheckboxRadioSwitch
			v-show="quizMode"
			:modelValue="quizShowAnswers"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onQuizShowAnswersChange">
			{{ t('forms', 'Show correct answers after submitting') }}
		</NcCheckboxRadioSwitch>
		<p v-show="quizMode && quizShowAnswers" class="settings-hint">
			{{
				t(
					'forms',
					'Anyone who submits can pass the answers on. Allow one response per person if that matters.',
				)
			}}
		</p>
		<h4 class="settings-group">{{ t('forms', 'Presentation') }}</h4>
		<NcCheckboxRadioSwitch
			:modelValue="shuffleQuestions"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onShuffleQuestionsChange">
			{{ t('forms', 'Shuffle question order') }}
		</NcCheckboxRadioSwitch>
		<p v-show="shuffleQuestions" class="settings-hint">
			{{
				t(
					'forms',
					'Section breaks, media and any question used in a condition stay where you put them.',
				)
			}}
		</p>
		<NcTextField
			v-model="headerImageDraft"
			:label="t('forms', 'Header image address')"
			placeholder="https://"
			type="url"
			:maxlength="settingsMaxLength"
			:disabled="formArchived || locked"
			:error="headerImageError !== ''"
			:helperText="headerImageError"
			:aria-describedby="
				headerImageBroken ? 'forms-settings__header-image-error' : undefined
			"
			@update:modelValue="headerImageError = ''"
			@change="onHeaderImageChange" />
		<!-- An address typed into a box tells the author nothing about whether it is the
		     right picture, or a picture at all. Shown here, a typo is obvious at once
		     instead of on the form itself. Only the saved address is previewed, so the
		     browser is not asked for every half-typed one along the way. -->
		<div v-if="isHttpUrl(headerImage)" class="settings-header-image">
			<img
				:key="headerImage"
				:src="headerImage"
				:alt="t('forms', 'Preview of the header image')"
				class="settings-header-image__preview"
				@load="headerImageBroken = false"
				@error="headerImageBroken = true" />
			<!-- The load fails after the author has moved on, so it is announced. -->
			<p
				v-if="headerImageBroken"
				id="forms-settings__header-image-error"
				role="alert"
				class="settings-hint settings-header-image__error">
				{{ t('forms', 'That address did not load a picture.') }}
			</p>
		</div>
		<!-- clearable adds a "no colour" choice, the only way back to the theme colour
		     once one has been picked. The button is as wide as the address field above,
		     so the two controls share both edges. -->
		<NcColorPicker
			class="settings-colour"
			clearable
			:modelValue="accentColor || undefined"
			@update:modelValue="onAccentColorChange">
			<NcButton
				:ariaLabel="accentColorLabel"
				:disabled="formArchived || locked"
				variant="secondary"
				wide>
				<!-- The colour itself, so the author sees what is set without opening the
				     picker. The label says it in words. -->
				<template v-if="accentColor" #icon>
					<span
						class="settings-colour__swatch"
						:style="{ backgroundColor: accentColor }"
						aria-hidden="true" />
				</template>
				{{
					accentColor
						? t('forms', 'Change accent colour')
						: t('forms', 'Set an accent colour')
				}}
			</NcButton>
		</NcColorPicker>
		<!-- The select does not pass aria-describedby on to its input, so the hint is tied
		     to a group around both instead. -->
		<div
			role="group"
			aria-labelledby="forms-settings__language-label"
			aria-describedby="forms-settings__language-hint">
			<div class="settings-language">
				<label
					id="forms-settings__language-label"
					for="forms-settings__language"
					class="settings-language__label">
					{{ t('forms', 'Form language') }}
				</label>
				<NcSelect
					inputId="forms-settings__language"
					class="settings-language__select"
					:clearable="false"
					:disabled="formArchived || locked"
					label="label"
					labelOutside
					:modelValue="selectedLanguageOption"
					:options="languageOptions"
					:searchable="false"
					trackBy="id"
					@update:modelValue="onLanguageChange" />
			</div>
			<p id="forms-settings__language-hint" class="settings-hint">
				{{
					t(
						'forms',
						'Visitors who are not signed in see the site default language. Choose a language to set the language and reading direction for everyone.',
					)
				}}
			</p>
		</div>
		<h4 class="settings-group">{{ t('forms', 'Notifications') }}</h4>
		<NcCheckboxRadioSwitch
			:modelValue="notifyOwner"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onNotifyOwnerChange">
			{{ t('forms', 'Email me on every response') }}
		</NcCheckboxRadioSwitch>
		<div v-show="notifyOwner && !formArchived" class="settings-div--indent">
			<NcTextField
				v-model="notifyEmailsDraft"
				:label="t('forms', 'Also notify these addresses')"
				:placeholder="t('forms', 'name@example.com, other@example.com')"
				:disabled="formArchived || locked"
				:maxlength="settingsMaxLength"
				inputmode="email"
				dir="ltr"
				:error="notifyEmailsTooLong || invalidNotifyEmails.length > 0"
				:helperText="notifyEmailsHelperText"
				@update:modelValue="notifyEmailsTooLong = false"
				@change="onNotifyEmailsChange" />
		</div>
		<h4 class="settings-group">{{ t('forms', 'Availability') }}</h4>
		<NcCheckboxRadioSwitch
			:modelValue="formExpires"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onFormExpiresChange">
			{{ t('forms', 'Set expiration date') }}
		</NcCheckboxRadioSwitch>
		<div v-show="formExpires && !formArchived" class="settings-div--indent">
			<!-- The picker has no disabled state of its own, so a locked form shows the
			     date as text instead. -->
			<NcDateTimePicker
				v-if="!locked"
				id="expiresDatetimePicker"
				:ariaLabel="t('forms', 'Expiration date')"
				:clearable="false"
				:format="stringifyDate"
				:min="expirationMinDate"
				:minuteStep="5"
				:modelValue="expirationDate"
				type="datetime"
				@update:modelValue="onExpirationDateChange" />
			<p v-else class="settings-hint">
				{{ stringifyDate(expirationDate) }}
			</p>
			<NcCheckboxRadioSwitch
				:modelValue="form.showExpiration"
				:disabled="locked"
				type="switch"
				@update:modelValue="onShowExpirationChange">
				{{ t('forms', 'Show expiration date on form') }}
			</NcCheckboxRadioSwitch>
		</div>
		<NcCheckboxRadioSwitch
			:modelValue="opensLater"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onOpensLaterChange">
			{{ t('forms', 'Open at a set time') }}
		</NcCheckboxRadioSwitch>
		<div v-show="opensLater && !formArchived" class="settings-div--indent">
			<NcDateTimePicker
				v-if="!locked"
				id="opensAtDatetimePicker"
				:ariaLabel="t('forms', 'Opening time')"
				:clearable="false"
				:format="stringifyOpeningDate"
				:min="minDate"
				:max="formExpires && !isExpired ? expirationDate : undefined"
				:minuteStep="5"
				:modelValue="openingDate"
				type="datetime"
				@update:modelValue="onOpeningDateChange" />
			<p v-else class="settings-hint">
				{{ stringifyOpeningDate(openingDate) }}
			</p>
			<!-- Appears once a date is picked, away from where focus is, so it is announced. -->
			<p
				v-if="closesBeforeOpening"
				role="alert"
				class="settings-hint settings-hint--warning">
				{{ t('forms', 'The form expires before it opens.') }}
			</p>
		</div>
		<NcCheckboxRadioSwitch
			:modelValue="hasMaxSubmissions"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onMaxSubmissionsChange">
			{{ t('forms', 'Limit number of responses') }}
		</NcCheckboxRadioSwitch>
		<div
			v-show="hasMaxSubmissions && !formArchived"
			class="settings-div--indent">
			<NcInputField
				v-model="maxSubmissionsDraft"
				type="number"
				:min="1"
				:step="1"
				inputmode="numeric"
				:disabled="locked"
				:label="t('forms', 'Maximum number of responses')"
				:error="maxSubmissionsError"
				:helperText="
					maxSubmissionsError
						? t('forms', 'Enter a whole number of 1 or more')
						: ''
				"
				@change="onMaxSubmissionsValueChange" />
			<p class="settings-hint">
				{{
					t(
						'forms',
						'Form will be closed automatically when the limit is reached.',
					)
				}}
			</p>
		</div>
		<NcCheckboxRadioSwitch
			:modelValue="formClosed"
			:disabled="formArchived || locked"
			aria-describedby="forms-settings__close-form"
			type="switch"
			@update:modelValue="onFormClosedChange">
			{{ t('forms', 'Close form') }}
		</NcCheckboxRadioSwitch>
		<p id="forms-settings__close-form" class="settings-hint">
			{{ t('forms', 'Closed forms do not accept new responses.') }}
		</p>
		<NcCheckboxRadioSwitch
			:modelValue="isFormLockedPermanently"
			:disabled="
				formArchived
				|| (locked && form.lockedUntil !== 0)
				|| !isCurrentUserOwner
			"
			aria-describedby="forms-settings__lock-form"
			type="switch"
			@update:modelValue="onFormLockChange">
			{{ t('forms', 'Lock form permanently') }}
		</NcCheckboxRadioSwitch>
		<p id="forms-settings__lock-form" class="settings-hint">
			{{
				t(
					'forms',
					'The form and its settings cannot be changed until the owner unlocks it. Responses are still accepted.',
				)
			}}
		</p>
		<NcCheckboxRadioSwitch
			:modelValue="formArchived"
			aria-describedby="forms-settings__archive-form"
			:disabled="locked || !isCurrentUserOwner"
			type="switch"
			@update:modelValue="onFormArchivedChange">
			{{ t('forms', 'Archive form') }}
		</NcCheckboxRadioSwitch>
		<p id="forms-settings__archive-form" class="settings-hint">
			{{
				t(
					'forms',
					'Archived forms do not accept new responses and cannot be modified.',
				)
			}}
		</p>
		<h4 class="settings-group">{{ t('forms', 'After submitting') }}</h4>
		<NcCheckboxRadioSwitch
			:modelValue="hasCustomSubmissionMessage"
			:disabled="formArchived || locked"
			type="switch"
			@update:modelValue="onUpdateHasCustomSubmissionMessage">
			{{ t('forms', 'Custom submission message') }}
		</NcCheckboxRadioSwitch>
		<div
			v-show="hasCustomSubmissionMessage"
			class="settings-div--indent submission-message">
			<textarea
				v-if="!formArchived && (editMessage || !form.submissionMessage)"
				ref="submissionMessageInput"
				v-click-outside="
					() => {
						editMessage = false
					}
				"
				aria-describedby="forms-submission-message-description"
				:aria-label="t('forms', 'Custom submission message')"
				:value="form.submissionMessage"
				:disabled="locked"
				:maxlength="maxStringLengths.submissionMessage"
				:placeholder="
					t(
						'forms',
						'Message to show after a user submitted the form (formatting using Markdown is supported)',
					)
				"
				class="submission-message__input"
				@blur="editMessage = false"
				@change="onSubmissionMessageChange" />
			<!-- The rendered message may hold links, so it stays plain content; a click on it
			     still opens the editor, and the button beside it is the way in for keyboards
			     and screen readers. Opening from a click does not trip the textarea's
			     click-outside, whose listener is only added once the textarea has mounted,
			     after that click is over. -->
			<template v-else>
				<!-- eslint-disable vue/no-v-html -->
				<div
					class="submission-message__output"
					:class="{
						'submission-message__output--editable': canEditMessage,
					}"
					@click="startEditMessage"
					v-html="submissionMessageHTML" />
				<!-- eslint-enable vue/no-v-html -->
				<NcButton
					v-if="canEditMessage"
					variant="tertiary"
					@click="startEditMessage">
					{{ t('forms', 'Edit submission message') }}
				</NcButton>
			</template>
			<div
				id="forms-submission-message-description"
				class="submission-message__description">
				{{
					t(
						'forms',
						'Message to show after a user submitted the form. Please note that the message will not be translated!',
					)
				}}
			</div>
		</div>

		<template v-if="appConfig.allowConfirmationEmail">
			<NcCheckboxRadioSwitch
				:modelValue="form.confirmationEmailEnabled"
				:disabled="formArchived || locked"
				type="switch"
				@update:modelValue="onConfirmationEmailEnabledChange">
				{{ t('forms', 'Send confirmation email to respondents') }}
			</NcCheckboxRadioSwitch>
			<div
				v-show="form.confirmationEmailEnabled && !formArchived"
				class="settings-div--indent confirmation-email">
				<NcNoteCard
					v-if="confirmationEmailErrorText"
					:type="confirmationEmailNoteCardType"
					:text="confirmationEmailErrorText" />
				<div
					v-if="emailQuestionCount > 0"
					class="confirmation-email__recipient">
					<label
						for="confirmation-email-recipient"
						class="confirmation-email__label">
						{{ t('forms', 'Recipient field') }}
					</label>
					<NcSelect
						inputId="confirmation-email-recipient"
						:modelValue="selectedConfirmationEmailQuestionOption"
						:disabled="locked || emailQuestionCount === 1"
						:options="confirmationEmailQuestionOptions"
						:placeholder="t('forms', 'Select an email field')"
						class="confirmation-email__select"
						label="label"
						:searchable="false"
						:clearable="false"
						trackBy="id"
						@update:modelValue="
							onConfirmationEmailQuestionIdSelectionChange
						" />
				</div>
				<!-- Each placeholder is its own left-to-right chip, so the list reads the same
				     in a right-to-left sidebar and no separator has to be translated. -->
				<div class="confirmation-email__placeholder-hint">
					<p>{{ t('forms', 'Available placeholders:') }}</p>
					<ul class="confirmation-email__placeholders">
						<li v-for="token in emailPlaceholderTokens" :key="token">
							<code dir="ltr">{{ token }}</code>
						</li>
					</ul>
					<!-- The server keys an answer by the question's technical name, or else its
					     title, reduced to lower-case Latin letters and digits. A title in any
					     other script reduces to nothing, hence the pointer to the technical name. -->
					<p>
						{{
							t(
								'forms',
								'Answers can be inserted too, using the technical name of the question in lower-case Latin letters and digits, for example {example}.',
								{ example: '{email}' },
							)
						}}
					</p>
				</div>
				<NcInputField
					v-model="confirmationEmailSubject"
					:disabled="locked || isConfirmationEmailConfigurationBlocked"
					:maxlength="255"
					:placeholder="
						t('forms', 'Thank you for your {formTitle} submission')
					"
					:label="t('forms', 'Email subject')"
					class="confirmation-email__input"
					@blur="onConfirmationEmailSubjectChange" />
				<NcTextArea
					v-model="confirmationEmailBody"
					:disabled="locked || isConfirmationEmailConfigurationBlocked"
					:placeholder="emailBodyPlaceholder"
					:label="t('forms', 'Email body')"
					:maxlength="8192"
					class="confirmation-email__textarea"
					@blur="onConfirmationEmailBodyChange" />
			</div>
		</template>

		<TransferOwnership
			:locked="locked"
			:isOwner="isCurrentUserOwner"
			:form="form" />
	</div>
</template>

<script>
import { getCurrentUser } from '@nextcloud/auth'
import { loadState } from '@nextcloud/initial-state'
import { translatePlural as n, translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import { vOnClickOutside as ClickOutside } from '@vueuse/components'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcColorPicker from '@nextcloud/vue/components/NcColorPicker'
import NcDateTimePicker from '@nextcloud/vue/components/NcDateTimePicker'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcInputField from '@nextcloud/vue/components/NcInputField'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import NcTextArea from '@nextcloud/vue/components/NcTextArea'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import TransferOwnership from './TransferOwnership.vue'
import svgLockOpen from '../../../img/lock_open.svg?raw'
import ShareTypes from '../../mixins/ShareTypes.js'
import { FormState } from '../../models/Constants.ts'

export default {
	components: {
		NcButton,
		NcCheckboxRadioSwitch,
		NcDateTimePicker,
		NcIconSvgWrapper,
		NcInputField,
		NcNoteCard,
		NcSelect,
		NcTextArea,
		NcColorPicker,
		NcTextField,
		TransferOwnership,
	},

	directives: {
		ClickOutside,
	},

	mixins: [ShareTypes],

	inject: ['$markdownit'],

	props: {
		form: {
			type: Object,
			required: true,
		},

		locked: {
			type: Boolean,
			required: true,
		},

		lockedUntil: {
			type: String,
			default: '',
		},
	},

	emits: ['update:formProp'],

	data() {
		return {
			formatter: {
				stringify: this.stringifyDate,
				parse: this.parseTimestampToDate,
			},

			appConfig: loadState('forms', 'appConfig'),
			maxStringLengths: loadState('forms', 'maxStringLengths'),
			/** If custom submission message is shown as input or rendered markdown */
			editMessage: false,
			svgLockOpen,
			confirmationEmailSubject: this.form?.confirmationEmailSubject || '',
			confirmationEmailBody: this.form?.confirmationEmailBody || '',
			/** Set by the preview's own load and error events, not guessed from the text */
			headerImageBroken: false,
			/** Why the typed header image address was not saved, or '' */
			headerImageError: '',
			/** Whether the typed list of extra addresses was too long to save */
			notifyEmailsTooLong: false,
			/**
			 * The custom submission message as it was when the switch turned it off, so
			 * turning the switch back on brings the text back instead of an empty box.
			 */
			stashedSubmissionMessage: '',
			/** The server refuses the whole settings object if any text in it is longer */
			settingsMaxLength: 2048,
			/*
			 * Text fields edit a local copy and save when the author leaves the field or
			 * presses Enter. Saving per keystroke sent a request for every letter, and
			 * replies arriving out of order could leave a half-typed value stored.
			 */
			headerImageDraft: this.form?.settings?.headerImage || '',
			notifyEmailsDraft: this.form?.settings?.notifyEmails || '',
			maxSubmissionsDraft: this.form?.maxSubmissions ?? 1,
			maxSubmissionsError: false,
			/** Earliest time the date pickers offer; the past is never a useful choice */
			minDate: new Date(),
		}
	},

	computed: {
		/**
		 * Form-level settings, stored as one JSON column so new options need no schema change.
		 *
		 * @return {object} the form's settings, never null
		 */
		formSettings() {
			return this.form.settings || {}
		},

		/**
		 * The languages a form may be pinned to.
		 *
		 * Named in their own script, so a respondent recognises their language in the
		 * list without having to read it in another one.
		 *
		 * @return {object[]} the options
		 */
		languageOptions() {
			return [
				{
					id: '',
					label: t('forms', 'Follow the language of whoever opens it'),
				},
				{ id: 'ar', label: 'العربية' },
				{ id: 'en', label: 'English' },
			]
		},

		/** @return {string} the language this form is pinned to, or '' to follow the reader */
		formLanguage() {
			return this.formSettings.language || ''
		},

		/** @return {object} the option matching the stored language */
		selectedLanguageOption() {
			return (
				this.languageOptions.find(
					(option) => option.id === this.formLanguage,
				) ?? this.languageOptions[0]
			)
		},

		/** @return {boolean} whether responses are graded against an answer key */
		quizMode() {
			return this.formSettings.quizMode === true
		},

		/** @return {boolean} whether a respondent is shown the right answers once they submit */
		quizShowAnswers() {
			return this.formSettings.quizShowAnswers === true
		},

		/** @return {boolean} whether questions are shown in a random order */
		shuffleQuestions() {
			return this.formSettings.shuffleQuestions === true
		},

		/** @return {string} optional banner image address */
		headerImage() {
			return this.formSettings.headerImage || ''
		},

		/** @return {string} optional accent colour */
		accentColor() {
			return this.formSettings.accentColor || ''
		},

		/** @return {string|undefined} the colour button's label, naming the colour once one is set */
		accentColorLabel() {
			if (!this.accentColor) {
				return undefined
			}
			return t(
				'forms',
				'Change accent colour, current colour {colour}',
				{ colour: this.accentColor },
				undefined,
				{ escape: false, sanitize: false },
			)
		},

		/** @return {boolean} whether the owner wants an email per response */
		notifyOwner() {
			return this.formSettings.notifyOwner === true
		},

		/** @return {string} additional recipients, comma separated */
		notifyEmails() {
			return this.formSettings.notifyEmails || ''
		},

		isCurrentUserOwner() {
			return getCurrentUser().uid === this.form.ownerId
		},

		/**
		 * Who holds the lock and for how long, as one sentence per case so translators
		 * never have to fit a separately translated "never" into it. The same sentences
		 * as the sharing tab, so the two notices read alike and share one translation.
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
			if (this.lockedUntil === '') {
				return t('forms', 'Locked by {lockedBy}', { lockedBy }, undefined, {
					escape: false,
					sanitize: false,
				})
			}
			return t(
				'forms',
				'Locked by {lockedBy} until {lockedUntil}',
				{ lockedBy, lockedUntil: this.lockedUntil },
				undefined,
				{ escape: false, sanitize: false },
			)
		},

		/** @return {boolean} whether the custom submission message can be opened for editing */
		canEditMessage() {
			return !this.formArchived && !this.locked
		},

		/**
		 * The addresses the server would skip. It drops anything that is not an address
		 * without saying so, so the author is told here.
		 *
		 * @return {string[]} the saved entries that do not look like an email address
		 */
		invalidNotifyEmails() {
			return this.splitEmails(this.notifyEmails).filter(
				(entry) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(entry),
			)
		},

		/** @return {string} the hint under the extra addresses field */
		notifyEmailsHelperText() {
			if (this.notifyEmailsTooLong) {
				return t('forms', 'This list of addresses is too long.')
			}
			if (this.invalidNotifyEmails.length > 0) {
				// The separator is translated so an Arabic sentence gets its own comma, and
				// the Latin addresses are isolated so they do not reorder the sentence
				// around them in a right-to-left sidebar.
				return n(
					'forms',
					'Not a valid address: {list}',
					'Not valid addresses: {list}',
					this.invalidNotifyEmails.length,
					{
						list:
							'\u2068'
							+ this.invalidNotifyEmails.join(t('forms', ', '))
							+ '\u2069',
					},
					{ escape: false, sanitize: false },
				)
			}
			return t('forms', 'Separate addresses with commas.')
		},

		/** @return {string[]} the placeholders a confirmation email can use */
		emailPlaceholderTokens() {
			const tokens = ['{formTitle}', '{formDescription}']
			if (this.quizMode) {
				tokens.push('{score}', '{maxScore}')
			}
			return tokens
		},

		isFormLockedPermanently() {
			return this.locked && this.form.lockedUntil === 0
		},

		/**
		 * If the form has a custom submission message or the user wants to add one (settings switch)
		 */
		hasCustomSubmissionMessage() {
			return (
				this.form?.submissionMessage !== undefined
				&& this.form?.submissionMessage !== null
			)
		},

		/**
		 * Submit Multiple is disabled, if it cannot be controlled.
		 */
		disableSubmitMultiple() {
			return this.hasPublicLink || this.form.isAnonymous
		},

		disableSubmitMultipleExplanation() {
			if (this.disableSubmitMultiple) {
				return t(
					'forms',
					'This can not be controlled, if the form has a public link or stores responses anonymously.',
				)
			}
			return ''
		},

		hasPublicLink() {
			return (
				this.form.shares.filter(
					(share) => share.shareType === this.SHARE_TYPES.SHARE_TYPE_LINK,
				).length !== 0
			)
		},

		// If disabled, submitMultiple will be casted to true
		submitMultiple() {
			return this.disableSubmitMultiple || this.form.submitMultiple
		},

		formExpires() {
			return this.form.expires !== 0
		},

		/** @return {number} when the form opens, or 0 when it opens straight away */
		opensAt() {
			const value = this.formSettings.opensAt
			return Number.isInteger(value) && value > 0 ? value : 0
		},

		/** @return {boolean} whether the form waits for a set time to open */
		opensLater() {
			return this.opensAt > 0
		},

		/** @return {Date} the opening time, for the picker */
		openingDate() {
			return moment(this.opensAt, 'X').toDate()
		},

		/** @return {Date} the earliest expiry to offer: not before the form opens */
		expirationMinDate() {
			return this.opensLater && this.openingDate > this.minDate
				? this.openingDate
				: this.minDate
		},

		/** @return {boolean} whether the expiry date comes first, so it never opens */
		closesBeforeOpening() {
			return (
				this.opensLater
				&& this.formExpires
				&& this.form.expires <= this.opensAt
			)
		},

		formArchived() {
			return this.form.state === FormState.FormArchived
		},

		formClosed() {
			return this.form.state !== FormState.FormActive
		},

		hasMaxSubmissions() {
			return (
				this.form.maxSubmissions !== null
				&& this.form.maxSubmissions !== undefined
			)
		},

		isExpired() {
			return this.form.expires && moment().unix() > this.form.expires
		},

		expirationDate() {
			return moment(this.form.expires, 'X').toDate()
		},

		/**
		 * The submission message rendered as HTML
		 */
		submissionMessageHTML() {
			return this.$markdownit.render(this.form.submissionMessage || '')
		},

		emailBodyPlaceholder() {
			return t(
				'forms',
				'Hello,\n\nThank you for submitting the form "{formTitle}".\n\nBest regards',
			)
		},

		emailQuestionCount() {
			return this.confirmationEmailQuestions.length
		},

		confirmationEmailQuestions() {
			const questions = this.form?.questions || []
			return questions.filter(
				(question) =>
					question.type === 'short'
					&& question.extraSettings?.validationType === 'email',
			)
		},

		selectedConfirmationEmailQuestion() {
			const selectedQuestion = this.confirmationEmailQuestions.find(
				(question) => question.id === this.form.confirmationEmailQuestionId,
			)
			if (selectedQuestion) {
				return selectedQuestion
			}

			if (
				this.form.confirmationEmailQuestionId === null
				&& this.emailQuestionCount === 1
			) {
				return this.confirmationEmailQuestions[0]
			}

			return null
		},

		selectedConfirmationEmailQuestionId() {
			return (
				this.form.confirmationEmailQuestionId
				?? this.selectedConfirmationEmailQuestion?.id
				?? ''
			)
		},

		confirmationEmailQuestionOptions() {
			return this.confirmationEmailQuestions.map((question) => ({
				id: question.id,
				label: this.confirmationEmailQuestionLabel(question),
			}))
		},

		selectedConfirmationEmailQuestionOption() {
			return (
				this.confirmationEmailQuestionOptions.find(
					(question) =>
						question.id === this.selectedConfirmationEmailQuestionId,
				) || null
			)
		},

		confirmationEmailErrorText() {
			if (this.emailQuestionCount === 0) {
				return t(
					'forms',
					'Add at least one email field before confirmation emails can be used.',
				)
			}

			if (this.requiresConfirmationEmailQuestionIdSelection) {
				return t(
					'forms',
					'Select which email field should receive confirmation emails before finishing this setup.',
				)
			}

			return ''
		},

		confirmationEmailNoteCardType() {
			if (this.requiresConfirmationEmailQuestionIdSelection) {
				return 'warning'
			}
			return 'info'
		},

		requiresConfirmationEmailQuestionIdSelection() {
			return (
				this.emailQuestionCount > 1
				&& !this.selectedConfirmationEmailQuestion
			)
		},

		isConfirmationEmailConfigurationBlocked() {
			return (
				this.form.confirmationEmailEnabled
				&& (this.emailQuestionCount === 0
					|| this.requiresConfirmationEmailQuestionIdSelection)
			)
		},
	},

	watch: {
		/*
		 * The sidebar stays mounted when another form is opened, so nothing typed or
		 * kept for the previous form may carry over to this one.
		 */
		'form.id': function () {
			this.headerImageDraft = this.headerImage
			this.headerImageError = ''
			this.notifyEmailsDraft = this.notifyEmails
			this.notifyEmailsTooLong = false
			this.stashedSubmissionMessage = ''
		},

		'form.confirmationEmailSubject': function (val) {
			this.confirmationEmailSubject = val || ''
		},

		'form.confirmationEmailBody': function (val) {
			this.confirmationEmailBody = val || ''
		},

		headerImage(val) {
			this.headerImageDraft = val
		},

		notifyEmails(val) {
			this.notifyEmailsDraft = val
		},

		'form.maxSubmissions': function (val) {
			this.maxSubmissionsDraft = val ?? 1
			this.maxSubmissionsError = false
		},

		confirmationEmailQuestions: {
			handler() {
				const selectedRecipientId = this.form.confirmationEmailQuestionId
				const hasValidSelectedRecipient =
					selectedRecipientId !== null
					&& this.confirmationEmailQuestions.some(
						(question) => question.id === selectedRecipientId,
					)

				if (selectedRecipientId !== null && !hasValidSelectedRecipient) {
					if (this.emailQuestionCount === 1) {
						this.saveConfirmationEmailQuestionId(
							this.confirmationEmailQuestions[0].id,
						)
					} else {
						this.saveConfirmationEmailQuestionId(null)
					}
					return
				}

				if (
					this.form.confirmationEmailEnabled
					&& this.emailQuestionCount === 1
					&& this.form.confirmationEmailQuestionId === null
				) {
					this.saveConfirmationEmailQuestionId(
						this.confirmationEmailQuestions[0].id,
					)
				}
			},

			deep: true,
		},
	},

	methods: {
		confirmationEmailQuestionLabel(question) {
			return question.text || t('forms', 'Untitled question')
		},

		/**
		 * Save Form-Properties
		 *
		 * @param {boolean} checked New Checkbox/Switch Value to use
		 */
		onAnonChange(checked) {
			this.$emit('update:formProp', 'isAnonymous', checked)
		},

		onSubmitMultipleChange(checked) {
			this.$emit('update:formProp', 'submitMultiple', checked)
		},

		onAllowEditSubmissionsChange(checked) {
			this.$emit('update:formProp', 'allowEditSubmissions', checked)
		},

		/**
		 * Settings are one JSON object, so every write merges rather than replaces -
		 * otherwise toggling one option would silently clear the others.
		 *
		 * @param {object} patch the keys to change
		 */
		updateSettings(patch) {
			this.$emit('update:formProp', 'settings', {
				...this.formSettings,
				...patch,
			})
		},

		/**
		 * @param {?object} option the chosen language, or null to follow the reader
		 */
		onLanguageChange(option) {
			// null rather than '': setSettings() drops empty values, so clearing the pin
			// removes the key instead of storing a blank one.
			this.updateSettings({ language: option?.id || null })
		},

		/**
		 * @param {boolean} checked grade responses against an answer key
		 */
		onQuizModeChange(checked) {
			this.updateSettings({ quizMode: checked })
		},

		/**
		 * @param {boolean} checked show the right answers with a submitted quiz's result
		 */
		onQuizShowAnswersChange(checked) {
			this.updateSettings({ quizShowAnswers: checked })
		},

		/**
		 * @param {boolean} checked randomise question order
		 */
		onShuffleQuestionsChange(checked) {
			this.updateSettings({ shuffleQuestions: checked })
		},

		/**
		 * @param {string} value any text
		 * @return {boolean} whether it is a complete web address worth previewing
		 */
		isHttpUrl(value) {
			if (!value) {
				return false
			}
			try {
				const url = new URL(value)
				return url.protocol === 'https:' || url.protocol === 'http:'
			} catch {
				return false
			}
		},

		/**
		 * @param {string} value any text
		 * @return {boolean} whether the server would refuse it as a settings value
		 */
		isTooLongForSettings(value) {
			// The server counts bytes, and an Arabic letter takes two of them.
			return new TextEncoder().encode(value).length > this.settingsMaxLength
		},

		/**
		 * Saves the banner address once the author leaves the field.
		 */
		onHeaderImageChange() {
			let value = this.headerImageDraft.trim()
			this.headerImageError = ''
			// "example.com/logo.png" would be stored as it is and then load as a path on
			// this server, a broken picture on the form. An address with no scheme at all
			// most likely means https.
			if (
				value !== ''
				&& !this.isHttpUrl(value)
				&& !/^[a-z][a-z\d+.-]*:/i.test(value)
				&& this.isHttpUrl('https://' + value)
			) {
				value = 'https://' + value
				this.headerImageDraft = value
			}
			if (value !== '' && !this.isHttpUrl(value)) {
				this.headerImageError = t(
					'forms',
					'Enter a full address starting with https://',
				)
				return
			}
			// Saving it would fail, and every later settings change with it.
			if (this.isTooLongForSettings(value)) {
				this.headerImageError = t('forms', 'This address is too long.')
				return
			}
			if (value === this.headerImage) {
				return
			}
			// A new address gets a fresh chance: the warning comes back only if the browser
			// cannot load it. The :key on the image makes it re-request rather than keep
			// the last result.
			this.headerImageBroken = false
			// null rather than '': setSettings() drops empty values, removing the key.
			this.updateSettings({ headerImage: value || null })
		},

		/**
		 * @param {string|undefined} value the chosen colour, or undefined for "no colour"
		 */
		onAccentColorChange(value) {
			// The picker's trigger button is disabled on a read-only form, but the popover
			// is not the button, so the guard lives here as well.
			if (this.formArchived || this.locked) {
				return
			}
			this.updateSettings({ accentColor: value || null })
		},

		/**
		 * @param {boolean} checked email the owner on each response
		 */
		onNotifyOwnerChange(checked) {
			// The extra addresses stay stored while the switch is off: the server mails
			// nobody then, and turning it back on should not mean typing them all again.
			this.updateSettings({ notifyOwner: checked })
		},

		/**
		 * @param {string} value the field's text
		 * @return {string[]} the entries, split on any separator people commonly type
		 */
		splitEmails(value) {
			// The server splits on commas only; semicolons and the Arabic comma and
			// semicolon are just as natural to type.
			return (value || '')
				.split(/[,;\u060C\u061B\s]+/)
				.filter((entry) => entry !== '')
		},

		/**
		 * Saves the extra recipients once the author leaves the field, normalised to the
		 * comma-separated list the server expects.
		 */
		onNotifyEmailsChange() {
			const value = this.splitEmails(this.notifyEmailsDraft).join(', ')
			// Show the tidied list even when it matches what is stored already.
			this.notifyEmailsDraft = value
			// Saving it would fail, and every later settings change with it.
			this.notifyEmailsTooLong = this.isTooLongForSettings(value)
			if (this.notifyEmailsTooLong || value === this.notifyEmails) {
				return
			}
			this.updateSettings({ notifyEmails: value || null })
		},

		onAllowCommentsChange(checked) {
			this.$emit('update:formProp', 'allowComments', checked)
		},

		onFormExpiresChange(checked) {
			if (checked) {
				// In an hour, unless the form only opens later: then a week after it opens,
				// so the default never closes the form before it has opened.
				// A form that opened long ago still gets the hour, not a date already past.
				const expires = moment.max(
					moment().add(1, 'hour'),
					this.opensLater
						? moment(this.opensAt, 'X').add(7, 'days')
						: moment(),
				)
				this.$emit('update:formProp', 'expires', expires.unix())
			} else {
				this.$emit('update:formProp', 'expires', 0)
			}
		},

		/**
		 * @param {boolean} checked wait for a set time before taking responses
		 */
		onOpensLaterChange(checked) {
			if (!checked) {
				this.updateSettings({ opensAt: null })
				return
			}
			// Tomorrow on the hour is a likelier start than this very minute, but not when
			// the form expires before then: an hour before the expiry instead, and never in
			// the past.
			let opens = moment().add(1, 'day').startOf('hour')
			if (
				this.formExpires
				&& !this.isExpired
				&& opens.unix() >= this.form.expires
			) {
				opens = moment.max(
					moment().add(5, 'minutes'),
					moment(this.form.expires, 'X').subtract(1, 'hour'),
				)
			}
			this.updateSettings({ opensAt: opens.unix() })
		},

		/**
		 * @param {Date} datetime the chosen opening time
		 */
		onOpeningDateChange(datetime) {
			this.updateSettings({ opensAt: parseInt(moment(datetime).format('X')) })
		},

		/**
		 * @param {Date} datetime the picker's date
		 * @return {string} the opening time as the picker shows it
		 */
		stringifyOpeningDate(datetime) {
			return t('forms', 'Opens on {date}', {
				date: moment(datetime).format('LLL'),
			})
		},

		onShowExpirationChange(checked) {
			this.$emit('update:formProp', 'showExpiration', checked)
		},

		/**
		 * On date picker change
		 *
		 * @param {Date} datetime the expiration Date
		 */
		onExpirationDateChange(datetime) {
			this.$emit(
				'update:formProp',
				'expires',
				parseInt(moment(datetime).format('X')),
			)
		},

		onMaxSubmissionsChange(checked) {
			this.$emit('update:formProp', 'maxSubmissions', checked ? 1 : null)
		},

		/**
		 * Saves the response limit once the author leaves the field. An empty, zero or
		 * fractional value is refused rather than sent: the server stores it as given,
		 * and an empty one would silently remove the limit.
		 */
		onMaxSubmissionsValueChange() {
			const value = Number(this.maxSubmissionsDraft)
			if (!Number.isInteger(value) || value < 1) {
				this.maxSubmissionsError = true
				return
			}
			this.maxSubmissionsError = false
			if (value !== this.form.maxSubmissions) {
				this.$emit('update:formProp', 'maxSubmissions', value)
			}
		},

		onFormClosedChange(isClosed) {
			this.$emit(
				'update:formProp',
				'state',
				isClosed ? FormState.FormClosed : FormState.FormActive,
			)
		},

		onFormLockChange(locked) {
			this.$emit('update:formProp', 'lockedUntil', locked ? 0 : null)
		},

		onFormArchivedChange(isArchived) {
			this.$emit(
				'update:formProp',
				'state',
				isArchived ? FormState.FormArchived : FormState.FormClosed,
			)
		},

		/**
		 * Swaps the rendered message for the textarea and moves focus into it, so neither
		 * a keyboard nor a mouse user has to find the field a second time.
		 *
		 * @param {MouseEvent} [event] the click that asked for it
		 */
		startEditMessage(event) {
			// A link inside the message should just be followed, not open the editor too.
			if (!this.canEditMessage || event?.target?.closest?.('a')) {
				return
			}
			this.editMessage = true
			this.$nextTick(() => this.$refs.submissionMessageInput?.focus())
		},

		onSubmissionMessageChange({ target }) {
			this.$emit('update:formProp', 'submissionMessage', target.value)
		},

		/**
		 * Enable or disable the whole custom submission message
		 * Disabled means the value is set to null.
		 */
		onUpdateHasCustomSubmissionMessage() {
			if (this.hasCustomSubmissionMessage) {
				// Kept for this visit, so an accidental switch-off does not lose the text.
				this.stashedSubmissionMessage = this.form.submissionMessage || ''
				this.$emit('update:formProp', 'submissionMessage', null)
			} else {
				this.$emit(
					'update:formProp',
					'submissionMessage',
					this.stashedSubmissionMessage,
				)
			}
		},

		onConfirmationEmailEnabledChange(checked) {
			if (
				checked
				&& this.form.confirmationEmailQuestionId === null
				&& this.emailQuestionCount === 1
			) {
				this.saveConfirmationEmailQuestionId(
					this.confirmationEmailQuestions[0].id,
				)
			}

			this.$emit('update:formProp', 'confirmationEmailEnabled', checked)
		},

		onConfirmationEmailSubjectChange() {
			this.$emit(
				'update:formProp',
				'confirmationEmailSubject',
				this.confirmationEmailSubject,
			)
		},

		onConfirmationEmailBodyChange() {
			this.$emit(
				'update:formProp',
				'confirmationEmailBody',
				this.confirmationEmailBody,
			)
		},

		onConfirmationEmailQuestionIdSelectionChange(option) {
			const questionId = option?.id ?? null
			if (questionId === null) {
				return
			}

			this.saveConfirmationEmailQuestionId(questionId)
		},

		saveConfirmationEmailQuestionId(selectedQuestionId) {
			if (this.form.confirmationEmailQuestionId === selectedQuestionId) {
				return
			}

			this.$emit(
				'update:formProp',
				'confirmationEmailQuestionId',
				selectedQuestionId,
			)
		},

		/**
		 * Datepicker timestamp to string
		 *
		 * @param {Date} datetime the datepicker Date
		 * @return {string}
		 */
		stringifyDate(datetime) {
			const date = moment(datetime).format('LLL')

			if (this.isExpired) {
				return t('forms', 'Expired on {date}', { date })
			}
			return t('forms', 'Expires on {date}', { date })
		},

		/**
		 * Form expires timestamp to Date of the datepicker
		 *
		 * @param {number} value the expires timestamp
		 * @return {Date}
		 */
		parseTimestampToDate(value) {
			return moment(value, 'X').toDate()
		},
	},
}
</script>

<style lang="scss" scoped>
@use '../../scssmixins/markdownOutput' as *;

/*
 * The settings tab had grown into one flat column of twenty-odd switches, several of
 * them added by this fork, with nothing to say which belonged together. The headings
 * group what was already there - nothing has moved - so an author scanning for "when
 * does this close" is reading a short list rather than the whole tab.
 */
.settings-group {
	color: var(--color-text-maxcontrast);
	font-size: 15px;
	font-weight: bold;
	margin-block: 20px 4px;

	// The first one heads the tab, so it does not need to be pushed away from anything.
	&:first-of-type {
		margin-block-start: 4px;
	}
}

#expiresDatetimePicker,
#opensAtDatetimePicker {
	width: calc(100% - var(--default-clickable-area));
}

.settings-div--indent {
	margin-inline-start: 40px;
}

.settings-colour {
	margin-block: 8px 4px;

	&__swatch {
		block-size: 16px;
		border-radius: 50%;
		box-shadow: 0 0 0 1px var(--color-border-dark);
		display: block;
		inline-size: 16px;
	}
}

.settings-header-image {
	margin-block: 8px 4px;

	&__preview {
		// The same ground and the same fit as the form's own header card, so a picture
		// with transparency is judged against what will actually be behind it. This one
		// showed at once that the default banner is black artwork on a dark theme.
		background-color: var(--color-main-background);
		block-size: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-large);
		display: block;
		inline-size: 100%;
		max-block-size: 110px;
		object-fit: cover;
	}

	&__error {
		color: var(--color-error-text, var(--color-element-error));
		margin-block-start: 4px;
	}
}

.settings-hint {
	color: var(--color-text-maxcontrast);
	padding-inline-start: 16px;
}

// A setting that defeats itself: said in the body colour, in bold, rather than greyed out.
.settings-hint--warning {
	color: var(--color-main-text);
	font-weight: bold;
}

// The picker lines up with the fields and switches around it; its hint keeps the indent
// every other hint has.
.settings-language {
	display: flex;
	flex-direction: column;
	gap: 4px;
	margin-block: 8px;

	&__label {
		color: var(--color-text-maxcontrast);
	}

	&__select {
		// The endonyms are short, but the "follow the reader" option is a sentence.
		min-inline-size: 0;
		width: 100%;
	}
}

.sidebar-tabs__content {
	display: flex;
	flex-direction: column;
}

.submission-message {
	&__description {
		color: var(--color-text-maxcontrast);
		font-size: 13px;
	}

	&__input,
	&__output {
		width: 100%;
		min-height: 100px;
		line-height: 24px;
	}

	&__output {
		@include markdown-output;
		padding: 12px;
		margin-block: 3px;
		border: 2px solid var(--color-border-maxcontrast);
		border-radius: var(--border-radius-large);

		&--editable {
			cursor: text;

			&:hover {
				border-color: var(--color-primary-element);
			}
		}
	}
}

.confirmation-email {
	&__recipient {
		margin-bottom: calc(var(--default-grid-baseline) * 3);
	}

	&__label {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-bottom: var(--default-grid-baseline);
		font-weight: 600;
		color: var(--color-text-maxcontrast);
	}

	&__placeholder-hint {
		color: var(--color-text-maxcontrast);
		font-size: var(--font-size-small);
		margin-top: calc(var(--default-grid-baseline) * 2);
	}

	&__placeholders {
		display: flex;
		flex-wrap: wrap;
		gap: var(--default-grid-baseline);
		list-style: none;
		margin-block: var(--default-grid-baseline);
		padding: 0;
	}

	&__select {
		width: 100%;

		// NcSelect sets min-width: 260px with two-class specificity; double
		// our class to win the cascade without !important.
		&#{&} {
			min-width: 0;
		}
	}

	&__input,
	&__textarea {
		width: 100%;
		margin-top: calc(var(--default-grid-baseline) * 3);
	}
}
</style>
