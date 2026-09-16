<!--
  - SPDX-FileCopyrightText: 2022 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div>
		<NcButton
			class="transfer-button"
			alignment="start"
			variant="tertiary"
			wide
			:disabled="locked || !isOwner"
			@click="openModal">
			<span class="transfer-button__text">{{
				t('forms', 'Transfer ownership')
			}}</span>
		</NcButton>

		<NcDialog
			v-model:open="showModal"
			contentClasses="transfer-ownership__content"
			:name="t('forms', 'Transfer ownership')"
			outTransition
			@close="closeModal">
			<template #default>
				<!-- eslint-disable vue/no-v-html -->
				<p
					v-html="
						t(
							'forms',
							'You\'re going to transfer the ownership of {name} to another account. Please select the account to which you want to transfer ownership.',
							{
								name: `<strong>${escapedString(form.title)}</strong>`,
							},
							undefined,
							{ escape: false },
						)
					" />
				<!-- eslint-enable vue/no-v-html -->
				<NcSelectUsers
					v-model="selected"
					class="transfer-ownership__select"
					:inputLabel="t('forms', 'New owner')"
					:loading="loading"
					:options="options"
					:placeholder="t('forms', 'Search for a user')"
					@search="
						(query) => asyncSearch(query, [SHARE_TYPES.SHARE_TYPE_USER])
					" />

				<!-- eslint-disable vue/no-v-html -->
				<p
					:id="confirmationHintId"
					v-html="
						t(
							'forms',
							'Type {text} to confirm.',
							{
								text: `<strong>${escapedString(confirmationString)}</strong>`,
							},
							undefined,
							{ escape: false },
						)
					" />
				<!-- eslint-enable vue/no-v-html -->
				<NcTextField
					v-model="confirmationInput"
					:label="t('forms', 'Confirmation text')"
					:aria-describedby="confirmationHintId"
					:success="confirmationMatches" />

				<p>
					<strong>{{ t('forms', 'This can not be undone.') }}</strong>
				</p>
			</template>
			<template #actions>
				<NcButton
					:disabled="!canTransfer"
					variant="error"
					@click="onOwnershipTransfer">
					{{ t('forms', 'I understand, transfer this form') }}
				</NcButton>
			</template>
		</NcDialog>
	</div>
</template>

<script>
import axios from '@nextcloud/axios'
import { showError, showSuccess } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { translate as t } from '@nextcloud/l10n'
import { generateOcsUrl } from '@nextcloud/router'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcSelectUsers from '@nextcloud/vue/components/NcSelectUsers'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import UserSearchMixin from '../../mixins/UserSearchMixin.js'
import logger from '../../utils/Logger.js'

export default {
	components: {
		NcButton,
		NcDialog,
		NcTextField,
		NcSelectUsers,
	},

	mixins: [UserSearchMixin],

	props: {
		form: {
			type: Object,
			required: true,
		},

		isOwner: {
			type: Boolean,
			required: true,
		},

		locked: {
			type: Boolean,
			required: true,
		},
	},

	data() {
		return {
			selected: null,
			showModal: false,
			confirmationInput: '',
			loading: false,
		}
	},

	computed: {
		canTransfer() {
			return this.confirmationMatches && !!this.selected
		},

		/**
		 * The prompt is shown as HTML, which collapses runs of whitespace, so both sides
		 * are compared with runs collapsed - otherwise a title with a double space could
		 * never be typed to match what is on screen.
		 */
		confirmationString() {
			return `${this.form.ownerId}/${this.form.title.replace(/\s+/g, ' ').trim()}`
		},

		confirmationMatches() {
			return (
				this.confirmationInput.replace(/\s+/g, ' ').trim()
				=== this.confirmationString
			)
		},

		/** Lets a screen reader announce what to type when the field is focused */
		confirmationHintId() {
			return `transfer-ownership-hint-${this.form.id}`
		},

		options() {
			if (this.isValidQuery) {
				return this.suggestions
			}
			// Recommendations can include groups and teams; a form can only go to an account.
			return this.recommendations.filter(
				(item) => item.shareType === this.SHARE_TYPES.SHARE_TYPE_USER,
			)
		},
	},

	methods: {
		closeModal() {
			this.showModal = false
		},

		escapedString(textToEscape) {
			return String(textToEscape)
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
		},

		openModal() {
			// Start clean each time, so a reopened dialog never arrives already confirmed.
			this.selected = null
			this.confirmationInput = ''
			this.showModal = true
			if (this.recommendations.length === 0) {
				this.getRecommendations()
			}
		},

		async onOwnershipTransfer() {
			this.showModal = false
			if (this.form.id && this.selected.shareWith) {
				try {
					emit('forms:last-updated:set', this.form.id)
					await axios.patch(
						generateOcsUrl('apps/forms/api/v3/forms/{id}', {
							id: this.form.id,
						}),
						{
							keyValuePairs: {
								ownerId: this.selected.shareWith,
							},
						},
					)
					showSuccess(
						t(
							'forms',
							'This form is now owned by {user}',
							{ user: this.selected.displayName },
							undefined,
							// Toasts show plain text, so neither escape nor sanitise ("&" would become "&amp;")
							{ escape: false, sanitize: false },
						),
					)
					emit('forms:ownership-transfered', this.form.id)
				} catch (error) {
					logger.error('Error while transfering form ownership', {
						error,
					})
					showError(
						t('forms', 'An error occurred while transfering ownership'),
					)
				}
			} else {
				logger.error('Null parameters while transfering form ownership', {
					selectedUser: this.selected,
				})
				showError(
					t('forms', 'An error occurred while transfering ownership'),
				)
			}
		},
	},
}
</script>

<!-- Not scoped: the dialog is teleported to the end of the page, outside this
     component, so a scoped rule could never reach its content. The dialog's own
     class is repeated so this outranks its scoped padding. -->
<style lang="scss">
.dialog__content.transfer-ownership__content {
	padding-inline: 18px;

	display: flex;
	flex-direction: column;
	gap: 8px;
}
</style>

<style lang="scss" scoped>
.transfer-button__text {
	color: var(--color-error-text);
}
</style>
