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
			:text="lockedNotice" />
		<SharingSearchDiv
			:currentShares="form.shares"
			:showLoading="isLoading"
			:locked="locked"
			:isCurrentUserOwner="isCurrentUserOwner"
			@addShare="addShare" />

		<!-- Public Link -->
		<div
			v-if="!hasPublicLink && appConfig.allowPublicLink"
			class="share-div share-div--link">
			<div class="share-div__avatar">
				<NcIconSvgWrapper :svg="IconLinkVariant" />
			</div>
			<span class="share-div__desc">{{ t('forms', 'Share link') }}</span>
			<NcActions>
				<NcActionButton
					:disabled="locked || !isCurrentUserOwner || isLoading"
					@click="addPublicLink">
					<template #icon>
						<NcIconSvgWrapper :svg="IconPlus" />
					</template>
					{{ t('forms', 'Add link') }}
				</NcActionButton>
			</NcActions>
		</div>
		<TransitionGroup v-else tag="div">
			<div
				v-for="share in publicLinkShares"
				:key="'share-' + share.shareType + '-' + share.shareWith"
				:set="void (isEmbeddable = isEmbeddingAllowed(share))"
				class="share-div share-div--link"
				:class="{ 'share-div--embeddable': isEmbeddingAllowed(share) }">
				<div class="share-div__avatar">
					<NcIconSvgWrapper
						v-if="isEmbeddable"
						:svg="IconLinkBoxVariantOutline" />
					<NcIconSvgWrapper v-else :svg="IconLinkVariant" />
				</div>
				<span class="share-div__desc">{{
					isEmbeddable
						? t('forms', 'Embeddable link')
						: t('forms', 'Share link')
				}}</span>
				<NcActions :inline="1">
					<NcActionLink
						:href="getPublicShareLink(share)"
						@click.prevent="copyLink($event, getPublicShareLink(share))">
						<template #icon>
							<NcIconSvgWrapper :svg="IconCopyAll" />
						</template>
						{{ t('forms', 'Copy to clipboard') }}
					</NcActionLink>
					<NcActionButton @click="openQrDialog(share)">
						<template #icon>
							<NcIconSvgWrapper :svg="IconQr" />
						</template>
						{{ t('forms', 'Show QR code') }}
					</NcActionButton>
					<NcActionButton
						v-if="isEmbeddable"
						@click="copyEmbeddingCode($event, share)">
						<template #icon>
							<NcIconSvgWrapper :svg="IconCodeBrackets" />
						</template>
						{{ t('forms', 'Copy embedding code') }}
					</NcActionButton>
					<NcActionButton
						v-else
						:disabled="locked || !isCurrentUserOwner || isLoading"
						@click="makeEmbeddable(share)">
						<template #icon>
							<NcIconSvgWrapper :svg="IconLinkBoxVariantOutline" />
						</template>
						<!-- TRANSLATORS: This means the link can be embedded into external websites -->
						{{ t('forms', 'Convert to embeddable link') }}
					</NcActionButton>
					<NcActionButton
						closeAfterClick
						:disabled="locked || !isCurrentUserOwner || isLoading"
						@click="removeShare(share)">
						<template #icon>
							<NcIconSvgWrapper :svg="IconDelete" />
						</template>
						{{ t('forms', 'Remove link') }}
					</NcActionButton>
					<NcActionButton
						v-if="appConfig.allowPublicLink"
						closeAfterClick
						:disabled="locked || !isCurrentUserOwner || isLoading"
						@click="addPublicLink">
						<template #icon>
							<NcIconSvgWrapper :svg="IconPlus" />
						</template>
						{{ t('forms', 'Add link') }}
					</NcActionButton>
				</NcActions>
			</div>
		</TransitionGroup>

		<QRDialog
			:title="
				t(
					'forms',
					'Share {formTitle}',
					{ formTitle: form.title },
					{ escape: false, sanitize: false },
				)
			"
			:text="qrDialogText"
			:fileName="form.title"
			@closed="qrDialogText = ''" />

		<!-- Removing a link is not an edit, it is a withdrawal: every copy of it that has
		     been sent out stops working, and a replacement cannot carry the same address.
		     The same dialog confirms removing a person, group or team, worded for that. -->
		<NcDialog
			v-model:open="showConfirmRemoveShare"
			:name="
				isRemovingLink
					? t('forms', 'Remove link')
					: t('forms', 'Remove access')
			"
			:message="confirmRemoveShareMessage"
			:buttons="confirmRemoveShareButtons" />

		<!-- Internal link -->
		<div class="share-div">
			<div class="share-div__avatar">
				<NcIconSvgWrapper :svg="IconLinkVariant" />
			</div>
			<div class="share-div__desc share-div__desc--twoline">
				<span>{{ t('forms', 'Internal link') }}</span>
				<span>{{
					t(
						'forms',
						'Only works for logged in accounts with access rights',
					)
				}}</span>
			</div>
			<NcActions>
				<NcActionLink
					:href="getInternalShareLink(form.hash)"
					@click.prevent="
						copyLink($event, getInternalShareLink(form.hash))
					">
					<template #icon>
						<NcIconSvgWrapper :svg="IconCopyAll" />
					</template>
					{{ t('forms', 'Copy to clipboard') }}
				</NcActionLink>
			</NcActions>
		</div>
		<p class="share-hint">
			{{
				t(
					'forms',
					'To send a link with some answers already filled in, open the form with View, answer those questions and choose "Copy pre-filled link".',
				)
			}}
		</p>

		<!-- All users on Instance -->
		<div v-if="appConfig.allowPermitAll">
			<div class="share-div">
				<div class="share-div__avatar">
					<NcIconSvgWrapper :svg="IconAccountMultiple" />
				</div>
				<label for="share-switch__permit-all" class="share-div__desc">
					{{ t('forms', 'Permit access to all logged in accounts') }}
				</label>
				<NcCheckboxRadioSwitch
					id="share-switch__permit-all"
					:modelValue="form.access.permitAllUsers"
					:disabled="locked || !isCurrentUserOwner"
					type="switch"
					@update:modelValue="onPermitAllUsersChange" />
			</div>
			<div
				v-if="appConfig.allowShowToAll && form.access.permitAllUsers"
				class="share-div share-div--indent">
				<div class="share-div__avatar">
					<NcIconSvgWrapper :svg="FormsIcon" :size="16" />
				</div>
				<label for="share-switch__show-to-all" class="share-div__desc">
					{{ t('forms', 'Show to all accounts on sidebar') }}
				</label>
				<NcCheckboxRadioSwitch
					id="share-switch__show-to-all"
					:modelValue="form.access.showToAllUsers"
					:disabled="locked || !isCurrentUserOwner"
					type="switch"
					@update:modelValue="onShowToAllUsersChange" />
			</div>
		</div>

		<!-- Single shares -->
		<TransitionGroup tag="ul">
			<SharingShareDiv
				v-for="share in sortedShares"
				:key="'share-' + share.shareType + '-' + share.shareWith"
				:share="share"
				:locked="locked"
				:isCurrentUserOwner="isCurrentUserOwner"
				:busy="isLoading"
				@removeShare="removeShare"
				@update:share="updateShare" />
		</TransitionGroup>
	</div>
</template>

<script>
import IconPlus from '@material-symbols/svg-400/outlined/add.svg?raw'
import IconCancel from '@material-symbols/svg-400/outlined/block.svg?raw'
import IconCodeBrackets from '@material-symbols/svg-400/outlined/code.svg?raw'
import IconCopyAll from '@material-symbols/svg-400/outlined/copy_all.svg?raw'
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconAccountMultiple from '@material-symbols/svg-400/outlined/group.svg?raw'
import IconLinkBoxVariantOutline from '@material-symbols/svg-400/outlined/iframe.svg?raw'
import IconLinkVariant from '@material-symbols/svg-400/outlined/link_2.svg?raw'
import IconQr from '@material-symbols/svg-400/outlined/qr_code.svg?raw'
import { getCurrentUser } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { loadState } from '@nextcloud/initial-state'
import { translate as t } from '@nextcloud/l10n'
import { generateOcsUrl } from '@nextcloud/router'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionLink from '@nextcloud/vue/components/NcActionLink'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import QRDialog from '../QRDialog.vue'
import SharingSearchDiv from './SharingSearchDiv.vue'
import SharingShareDiv from './SharingShareDiv.vue'
import FormsIcon from '../../../img/forms-dark.svg?raw'
import PermissionTypes from '../../mixins/PermissionTypes.js'
import ShareLinkMixin from '../../mixins/ShareLinkMixin.js'
import ShareTypes from '../../mixins/ShareTypes.js'
import logger from '../../utils/Logger.js'
import OcsResponse2Data from '../../utils/OcsResponse2Data.js'

export default {
	components: {
		NcIconSvgWrapper,
		NcActions,
		NcActionButton,
		NcActionLink,
		NcCheckboxRadioSwitch,
		NcDialog,
		NcNoteCard,
		QRDialog,
		SharingSearchDiv,
		SharingShareDiv,
	},

	mixins: [ShareTypes, ShareLinkMixin, PermissionTypes],

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

	emits: ['addShare', 'updateShare', 'removeShare', 'update:formProp'],

	setup() {
		return {
			FormsIcon,
			IconCopyAll,
			IconPlus,
			IconCodeBrackets,
			IconDelete,
			IconLinkVariant,
			IconLinkBoxVariantOutline,
			IconAccountMultiple,
			IconQr,
		}
	},

	data() {
		return {
			isLoading: false,
			appConfig: loadState(appName, 'appConfig'),
			qrDialogText: '',

			/** The link the removal dialog is asking about, or null when it is closed */
			sharePendingRemove: null,
			showConfirmRemoveShare: false,
			/**
			 * Kept apart from sharePendingRemove, which is cleared on confirm, so the dialog
			 * does not change its wording while it is closing.
			 */
			pendingRemoveIsLink: true,
			pendingRemoveName: '',
			pendingRemoveLink: '',
		}
	},

	computed: {
		lockedNotice() {
			const lockedBy = this.form.lockedBy
				? this.form.lockedBy
				: this.form.ownerId
			if (this.lockedUntil === '') {
				return t('forms', 'Locked by {lockedBy}', { lockedBy }, undefined, {
					escape: false,
					sanitize: false,
				})
			}
			// Shown as plain text, so the values need no HTML escaping or sanitising.
			return t(
				'forms',
				'Locked by {lockedBy} until {lockedUntil}',
				{ lockedBy, lockedUntil: this.lockedUntil },
				undefined,
				{ escape: false, sanitize: false },
			)
		},

		/** Whether the removal dialog is about a public link rather than a person, group or team */
		isRemovingLink() {
			return this.pendingRemoveIsLink
		},

		confirmRemoveShareButtons() {
			return [
				{
					label: t('forms', 'Cancel'),
					icon: IconCancel,
					variant: 'tertiary',
					callback: () => {
						this.sharePendingRemove = null
					},
				},
				{
					label: this.isRemovingLink
						? t('forms', 'Remove link')
						: t('forms', 'Remove access'),

					icon: IconDelete,
					variant: 'error',
					callback: () => {
						this.removeShareConfirmed()
					},
				},
			]
		},

		/**
		 * What removing this link costs, which is not obvious from a menu item reading
		 * "Remove link". Every copy already sent out stops working at once, and a new
		 * link is a new address - it cannot be made to match the old one.
		 *
		 * @return {string} the question to put before withdrawing it
		 */
		confirmRemoveShareMessage() {
			if (!this.isRemovingLink) {
				return t(
					'forms',
					'{name} will no longer be able to open or manage this form.',
					{ name: this.pendingRemoveName },
					undefined,
					{ escape: false, sanitize: false },
				)
			}
			if (!this.pendingRemoveLink) {
				return t(
					'forms',
					'Anyone holding this link will no longer be able to open the form, and a new link cannot repeat this address.',
				)
			}
			return t(
				'forms',
				'{link} will stop working. Anyone holding it will no longer be able to open the form, and a new link cannot repeat this address.',
				{ link: this.pendingRemoveLink },
			)
		},

		isCurrentUserOwner() {
			return getCurrentUser().uid === this.form.ownerId
		},

		sortedShares() {
			// Remove Link-Shares, which are handled separately, then sort
			return this.form.shares
				.filter(
					(share) => share.shareType !== this.SHARE_TYPES.SHARE_TYPE_LINK,
				)
				.sort(this.sortByTypeAndDisplayname)
		},

		hasPublicLink() {
			return this.publicLinkShares.length !== 0
		},

		publicLinkShares() {
			const shares = this.form.shares.filter(
				(share) => share.shareType === this.SHARE_TYPES.SHARE_TYPE_LINK,
			)
			shares.sort((a, b) =>
				this.isEmbeddingAllowed(a) ? 1 : this.isEmbeddingAllowed(b) ? -1 : 0,
			)
			return shares
		},
	},

	methods: {
		/**
		 * Add share
		 *
		 * @param {object} newShare the share object
		 */
		async addShare(newShare) {
			this.isLoading = true

			try {
				const response = await axios.post(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/shares', {
						id: this.form.id,
					}),
					{
						shareType: newShare.shareType,
						shareWith: newShare.shareWith,
					},
				)
				const share = OcsResponse2Data(response)

				// Add new share
				this.$emit('addShare', share)
			} catch (error) {
				logger.error('Error while adding new share', {
					error,
					share: newShare,
				})
				showError(t('forms', 'There was an error while adding the share'))
			} finally {
				this.isLoading = false
			}
		},

		async addPublicLink() {
			// A second tap before the first request returns would create a duplicate link.
			if (this.isLoading) {
				return
			}
			this.isLoading = true

			try {
				const response = await axios.post(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/shares', {
						id: this.form.id,
					}),
					{
						shareType: this.SHARE_TYPES.SHARE_TYPE_LINK,
					},
				)
				const share = OcsResponse2Data(response)

				// Add new share
				this.$emit('addShare', share)
			} catch (error) {
				logger.error('Error adding public link', { error })
				showError(t('forms', 'There was an error while adding the link'))
			} finally {
				this.isLoading = false
			}
		},

		/**
		 * Make a share embeddable into websites (sets the internal permission)
		 *
		 * @param {{ permissions: string[] }} share The public link share to make embeddable
		 */
		makeEmbeddable(share) {
			this.updateShare({
				...share,
				permissions: [
					...share.permissions,
					this.PERMISSION_TYPES.PERMISSION_EMBED,
				],
			})
		},

		/**
		 * Update share
		 *
		 * @param {object} updatedShare the updated object
		 */
		async updateShare(updatedShare) {
			// Every update carries the whole permission list; overlapping ones would undo each other.
			if (this.isLoading) {
				return
			}
			this.isLoading = true

			try {
				const response = await axios.patch(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/shares/{shareId}', {
						id: this.form.id,
						shareId: updatedShare.id,
					}),
					{
						keyValuePairs: {
							permissions: updatedShare.permissions,
						},
					},
				)
				const share = Object.assign(updatedShare, {
					id: OcsResponse2Data(response),
				})

				// Add new share
				this.$emit('updateShare', share)
			} catch (error) {
				logger.error('Error while updating share', {
					error,
					share: updatedShare,
				})
				showError(t('forms', 'There was an error while updating the share'))
			} finally {
				this.isLoading = false
			}
		},

		/**
		 * Withdraw a share, after asking.
		 *
		 * @param {object} share the link, person, group or team to remove
		 */
		removeShare(share) {
			this.sharePendingRemove = share
			this.pendingRemoveIsLink =
				share.shareType === this.SHARE_TYPES.SHARE_TYPE_LINK
			this.pendingRemoveName = share.displayName || share.shareWith
			this.pendingRemoveLink = this.pendingRemoveIsLink
				? this.getPublicShareLink(share)
				: ''
			this.showConfirmRemoveShare = true
		},

		/** Withdraw the share the dialog named, once it has been agreed to. */
		async removeShareConfirmed() {
			const share = this.sharePendingRemove
			this.sharePendingRemove = null
			this.showConfirmRemoveShare = false
			// No isLoading check here: the remove buttons are already disabled while a
			// request runs, and dropping a removal the user has just confirmed would be silent.
			if (!share) {
				return
			}
			this.isLoading = true

			try {
				await axios.delete(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/shares/{shareId}', {
						id: this.form.id,
						shareId: share.id,
					}),
				)
				this.$emit('removeShare', share)
			} catch (error) {
				logger.error('Error while removing share', { error, share })
				showError(t('forms', 'There was an error while removing the share'))
			} finally {
				this.isLoading = false
			}
		},

		/**
		 * Sort by shareType and DisplayName
		 *
		 * @param {object} a first share for comparison
		 * @param {object} b second share for comparison
		 */
		sortByTypeAndDisplayname(a, b) {
			// First return, if ShareType does not match
			if (a.shareType < b.shareType) {
				return -1
			}
			if (a.shareType > b.shareType) {
				return 1
			}

			// Otherwise sort by displayname
			if (a.displayName.toLowerCase() < b.displayName.toLowerCase()) {
				return -1
			}
			if (a.displayName.toLowerCase() > b.displayName.toLowerCase()) {
				return 1
			}
			return 0
		},

		onPermitAllUsersChange(newVal) {
			const newAccess = { ...this.form.access }
			newAccess.permitAllUsers = newVal
			this.$emit('update:formProp', 'access', newAccess)
		},

		onShowToAllUsersChange(newVal) {
			const newAccess = { ...this.form.access }
			newAccess.showToAllUsers = newVal
			this.$emit('update:formProp', 'access', newAccess)
		},

		openQrDialog(share) {
			this.qrDialogText = this.getPublicShareLink(share)
		},
	},
}
</script>

<style lang="scss" scoped>
.sidebar-tabs__content {
	display: flex;
	flex-direction: column;
}

.share-hint {
	color: var(--color-text-maxcontrast);
	margin-block: 4px 12px;
	// Under the link's words rather than its icon: the avatar is 32px plus its gap.
	padding-inline-start: 40px;
}

.share-div {
	display: flex;
	min-height: var(--default-clickable-area);
	align-items: center;

	&--link {
		.share-div__avatar {
			background-color: var(--color-primary-element);
			color: var(--color-primary-element-text);
		}
	}

	&--embeddable {
		.share-div__avatar {
			background-color: var(--color-primary-element-light);
			color: var(--color-primary-element-light-text);
		}
	}

	&--indent {
		margin-inline-start: 40px;
	}

	&__avatar {
		height: 32px;
		width: 32px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
		border-radius: 50%;
		background-color: var(--color-background-dark);

		.material-design-icon {
			margin: auto;
		}
	}

	&__desc {
		padding: 0px 8px;
		flex-grow: 1;

		&--twoline {
			span {
				display: block;
				min-height: 18px;
				line-height: 1.2em;
			}
			:last-child {
				color: var(--color-text-maxcontrast);
			}
		}
	}
}
</style>
