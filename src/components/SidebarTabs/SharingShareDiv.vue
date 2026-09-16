<!--
  - SPDX-FileCopyrightText: 2021 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<li class="share-div">
		<NcAvatar
			:user="share.shareWith"
			disableMenu
			:displayName="displayName"
			:isNoUser="isNoUser" />
		<div class="share-div__desc">
			<!-- One string, so the type label keeps its space and translators can order it. -->
			<span>{{ displayNameWithType }}</span>
		</div>
		<NcActions class="share-div__actions" :disabled="!isCurrentUserOwner">
			<NcActionCaption :name="t('forms', 'Permissions')" />
			<NcActionCheckbox
				:modelValue="canEditForm"
				:disabled="locked || busy"
				@update:modelValue="updatePermissionEdit">
				{{ t('forms', 'Edit form') }}
			</NcActionCheckbox>
			<NcActionCheckbox
				:modelValue="canAccessResults"
				:disabled="locked || busy"
				@update:modelValue="updatePermissionResults">
				{{ t('forms', 'View responses') }}
			</NcActionCheckbox>
			<NcActionCheckbox
				:modelValue="canDeleteResults"
				:disabled="!canAccessResults || locked || busy"
				@update:modelValue="updatePermissionDeleteResults">
				{{ t('forms', 'Delete responses') }}
			</NcActionCheckbox>
			<NcActionSeparator />
			<!-- Closes first: it opens a confirmation, which the menu would otherwise cover. -->
			<NcActionButton
				closeAfterClick
				:disabled="locked || busy"
				@click="removeShare">
				<template #icon>
					<NcIconSvgWrapper :svg="IconClose" />
				</template>
				{{ t('forms', 'Remove access') }}
			</NcActionButton>
		</NcActions>
	</li>
</template>

<script>
import IconClose from '@material-symbols/svg-400/outlined/close.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcAvatar from '@nextcloud/vue/components/NcAvatar'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import PermissionTypes from '../../mixins/PermissionTypes.js'
import ShareTypes from '../../mixins/ShareTypes.js'

export default {
	components: {
		NcIconSvgWrapper,
		NcActions,
		NcActionButton,
		NcActionCaption,
		NcActionCheckbox,
		NcActionSeparator,
		NcAvatar,
	},

	mixins: [PermissionTypes, ShareTypes],

	props: {
		share: {
			type: Object,
			required: true,
		},

		locked: {
			type: Boolean,
			required: true,
		},

		isCurrentUserOwner: {
			type: Boolean,
			required: true,
		},

		/**
		 * A share request is still running. Each change is built from the share as it
		 * was last saved, so a second toggle sent before the first returns would undo it.
		 */
		busy: {
			type: Boolean,
			default: false,
		},
	},

	emits: ['removeShare', 'update:share'],

	setup() {
		return {
			IconClose,
		}
	},

	computed: {
		canAccessResults() {
			return this.share.permissions.includes(
				this.PERMISSION_TYPES.PERMISSION_RESULTS,
			)
		},

		canDeleteResults() {
			return this.share.permissions.includes(
				this.PERMISSION_TYPES.PERMISSION_RESULTS_DELETE,
			)
		},

		canEditForm() {
			return this.share.permissions.includes(
				this.PERMISSION_TYPES.PERMISSION_EDIT,
			)
		},

		isNoUser() {
			return this.share.shareType !== this.SHARE_TYPES.SHARE_TYPE_USER
		},

		displayName() {
			return !this.share.displayName
				? this.share.shareWith
				: this.share.displayName
		},

		typeLabel() {
			switch (this.share.shareType) {
				case this.SHARE_TYPES.SHARE_TYPE_GROUP:
					return t('forms', 'Group')
				case this.SHARE_TYPES.SHARE_TYPE_CIRCLE:
					return t('forms', 'Team')
				default:
					return ''
			}
		},

		displayNameWithType() {
			if (!this.typeLabel) {
				return this.displayName
			}
			// Rendered as text, so a name such as "R&D" must be neither escaped nor
			// sanitised: sanitising also turns "&" into "&amp;".
			// TRANSLATORS: A group or team name followed by what kind of recipient it is, e.g. "Staff (Group)"
			return t(
				'forms',
				'{name} ({type})',
				{ name: this.displayName, type: this.typeLabel },
				undefined,
				{ escape: false, sanitize: false },
			)
		},
	},

	methods: {
		removeShare() {
			this.$emit('removeShare', this.share)
		},

		/**
		 * @param {boolean} hasPermission If the results permission should be granted
		 */
		updatePermissionResults(hasPermission) {
			const results = this.PERMISSION_TYPES.PERMISSION_RESULTS
			const resultsDelete = this.PERMISSION_TYPES.PERMISSION_RESULTS_DELETE
			// Dropping results also drops deleting them, in one request: the server refuses
			// delete without view, and two requests would both start from the old permissions.
			const permissions = hasPermission
				? [...new Set([...this.share.permissions, results])]
				: this.share.permissions.filter(
						(perm) => perm !== results && perm !== resultsDelete,
					)
			this.$emit('update:share', { ...this.share, permissions })
		},

		/**
		 * @param {boolean} hasPermission If the results_delete permission should be granted
		 */
		updatePermissionDeleteResults(hasPermission) {
			return this.updatePermission(
				this.PERMISSION_TYPES.PERMISSION_RESULTS_DELETE,
				hasPermission,
			)
		},

		/**
		 * @param {boolean} hasPermission If the results_delete permission should be granted
		 */
		updatePermissionEdit(hasPermission) {
			return this.updatePermission(
				this.PERMISSION_TYPES.PERMISSION_EDIT,
				hasPermission,
			)
		},

		/**
		 * Grant or remove permission from share
		 *
		 * @param {string} permission The permission to grant or remove
		 * @param {boolean} hasPermission True if granted, False if removed
		 */
		updatePermission(permission, hasPermission) {
			const share = { ...this.share }
			if (hasPermission) {
				share.permissions = [...new Set([...share.permissions, permission])]
			} else {
				share.permissions = share.permissions.filter(
					(perm) => perm !== permission,
				)
			}
			this.$emit('update:share', share)
		},
	},
}
</script>

<style lang="scss" scoped>
.share-div {
	display: flex;
	// A minimum, not a fixed height: long group or team names wrap onto a second line.
	min-height: var(--default-clickable-area);
	align-items: center;

	&__desc {
		padding: 8px;
		flex-grow: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
}
</style>
