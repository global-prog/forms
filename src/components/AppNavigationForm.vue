<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcListItem
		:active="isActive"
		:actions-aria-label="actionsAriaLabel"
		:counterNumber="form.submissionCount"
		compact
		forceMenu
		:forceDisplayActions="forceDisplayActions"
		:linkAriaLabel="accessibleName"
		:name="formTitle"
		:to="{
			name: routerTarget,
			params: { hash: form.hash },
		}"
		@click="mobileCloseNavigation">
		<template #icon>
			<NcLoadingIcon v-if="loading" :size="16" />
			<!-- One mark for "not taking responses", however it got there. A form closed
			     by hand carried no mark while an expired one carried a tick, so the
			     deliberate state was the invisible one and the other looked like praise. -->
			<NcIconSvgWrapper
				v-else-if="isExpired || isClosed"
				:svg="IconClosed"
				:size="16" />
			<NcIconSvgWrapper v-else :svg="FormsIcon" :size="16" />
		</template>
		<template v-if="hasSubtitle" #subname>
			{{ formSubtitle }}
		</template>
		<template
			v-if="!loading && (!readOnly || canEdit || canSeeResults)"
			#actions>
			<NcActionRouter
				v-if="!isArchived && canEdit"
				closeAfterClick
				:disabled="isFormLocked"
				:to="{ name: 'edit', params: { hash: form.hash } }"
				@click="mobileCloseNavigation">
				<template #icon>
					<NcIconSvgWrapper :svg="IconPencil" />
				</template>
				{{ t('forms', 'Edit form') }}
			</NcActionRouter>
			<NcActionButton
				v-if="!isArchived && !readOnly"
				closeAfterClick
				@click="onShareForm">
				<template #icon>
					<NcIconSvgWrapper :svg="IconShareVariant" />
				</template>
				{{ t('forms', 'Share form') }}
			</NcActionButton>
			<NcActionRouter
				v-if="canSeeResults"
				closeAfterClick
				:to="{ name: 'results', params: { hash: form.hash } }"
				@click="mobileCloseNavigation">
				<template #icon>
					<NcIconSvgWrapper :svg="IconPoll" />
				</template>
				{{ t('forms', 'Responses') }}
			</NcActionRouter>
			<NcActionButton v-if="canEdit" closeAfterClick @click="onCloneForm">
				<template #icon>
					<NcIconSvgWrapper :svg="IconContentCopy" />
				</template>
				{{ t('forms', 'Copy form') }}
			</NcActionButton>
			<NcActionSeparator v-if="canEdit && !readOnly" />
			<NcActionButton
				v-if="canEdit && !readOnly"
				closeAfterClick
				:disabled="isFormLocked"
				@click="onToggleArchive">
				<template #icon>
					<NcIconSvgWrapper
						v-if="isArchived"
						:svg="IconArchiveOff"
						:size="20" />
					<NcIconSvgWrapper v-else :svg="IconArchive" :size="20" />
				</template>
				{{
					isArchived
						? t('forms', 'Unarchive form')
						: t('forms', 'Archive form')
				}}
			</NcActionButton>
			<NcActionButton
				v-if="canEdit && !readOnly"
				closeAfterClick
				:disabled="isFormLocked"
				@click="onConfirmDelete">
				<template #icon>
					<NcIconSvgWrapper :svg="IconDelete" />
				</template>
				{{ t('forms', 'Delete form') }}
			</NcActionButton>
		</template>
	</NcListItem>
</template>

<script>
import IconArchive from '@material-symbols/svg-400/outlined/archive.svg?raw'
import IconPoll from '@material-symbols/svg-400/outlined/bar_chart.svg?raw'
import IconClosed from '@material-symbols/svg-400/outlined/block.svg?raw'
import IconContentCopy from '@material-symbols/svg-400/outlined/content_copy.svg?raw'
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconPencil from '@material-symbols/svg-400/outlined/edit.svg?raw'
import IconShareVariant from '@material-symbols/svg-400/outlined/share.svg?raw'
import IconArchiveOff from '@material-symbols/svg-400/outlined/unarchive.svg?raw'
import { getCurrentUser } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { showConfirmation, showError, showSuccess } from '@nextcloud/dialogs'
import { translatePlural as n, translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import { generateOcsUrl } from '@nextcloud/router'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionRouter from '@nextcloud/vue/components/NcActionRouter'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcListItem from '@nextcloud/vue/components/NcListItem'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import FormsIcon from '../../img/forms-dark.svg?raw'
import PermissionTypes from '../mixins/PermissionTypes.js'
import { FormState } from '../models/Constants.ts'
import logger from '../utils/Logger.js'

export default {
	name: 'AppNavigationForm',

	components: {
		NcActionButton,
		NcActionRouter,
		NcActionSeparator,
		NcIconSvgWrapper,
		NcListItem,
		NcLoadingIcon,
	},

	mixins: [PermissionTypes],

	props: {
		form: {
			type: Object,
			required: true,
		},

		forceDisplayActions: {
			type: Boolean,
			default: false,
			required: false,
		},

		readOnly: {
			type: Boolean,
			default: false,
		},
	},

	emits: ['mobileCloseNavigation', 'openSharing', 'clone', 'delete'],

	setup() {
		return {
			FormsIcon,
			IconArchive,
			IconArchiveOff,
			IconClosed,
			IconContentCopy,
			IconDelete,
			IconPencil,
			IconPoll,
			IconShareVariant,
		}
	},

	data() {
		return {
			loading: false,
		}
	},

	computed: {
		canEdit() {
			return this.form.permissions.includes(
				this.PERMISSION_TYPES.PERMISSION_EDIT,
			)
		},

		canSeeResults() {
			return (
				this.form.permissions.includes(
					this.PERMISSION_TYPES.PERMISSION_RESULTS,
				) || this.form.submissionCount > 0
			)
		},

		/**
		 * Check if form is current form and set active
		 */
		isActive() {
			return this.form.hash === this.$route.params.hash
		},

		/**
		 * Check if the form is archived
		 */
		isArchived() {
			return this.form.state === FormState.FormArchived
		},

		/**
		 * Check if the form was closed by hand, rather than by its own expiry date
		 */
		isClosed() {
			return this.form.state === FormState.FormClosed
		},

		/**
		 * Check if form is expired
		 */
		isExpired() {
			return this.form.expires && moment().unix() > this.form.expires
		},

		/**
		 * Check if form is locked
		 */
		isFormLocked() {
			return (
				this.form.lockedUntil === 0
				|| (this.form.lockedUntil > moment().unix()
					&& this.form.lockedBy !== getCurrentUser().uid)
			)
		},

		/**
		 * Return form title, or placeholder if not set
		 *
		 * @return {string}
		 */
		formTitle() {
			if (this.form.title) {
				return this.form.title
			}
			return t('forms', 'New form')
		},

		/**
		 * Return expiration details for subtitle
		 */
		formSubtitle() {
			if (this.isClosed) {
				// TRANSLATORS: The form was closed manually so it does not take new submissions
				return t('forms', 'Form closed')
			}
			if (this.form.expires) {
				const relativeDate = moment(this.form.expires, 'X')
					.locale(window.OC.getLanguage())
					.fromNow()
				if (this.isExpired) {
					return t('forms', 'Expired {relativeDate}', {
						relativeDate,
					})
				}
				return t('forms', 'Expires {relativeDate}', { relativeDate })
			}
			return ''
		},

		/**
		 * Name for the row link. The response count bubble on its own is a bare number to
		 * a screen reader, so the count is spelled out; the subtitle is repeated because an
		 * aria-label replaces the link's own text.
		 *
		 * @return {string}
		 */
		accessibleName() {
			// The server leaves the count out when there is nothing the user may see, and
			// the bubble is hidden then too, so the name does not claim "0 responses".
			const count = this.form.submissionCount ?? 0
			// Left raw: the result is an attribute value, which Vue escapes itself.
			const name =
				count > 0
					? n(
							'forms',
							'{title}, %n response',
							'{title}, %n responses',
							count,
							{ title: this.formTitle },
							{ escape: false, sanitize: false },
						)
					: this.formTitle
			// TRANSLATORS: Separator between the parts of a list, such as a form's name and its status
			return [name, this.formSubtitle].filter(Boolean).join(t('forms', ', '))
		},

		/**
		 * Name for the row's menu button. With every menu button shown at once, a fixed
		 * label left screen-reader users with a run of identical buttons.
		 *
		 * @return {string}
		 */
		actionsAriaLabel() {
			// Left raw: the result is an attribute value, which Vue escapes itself.
			return t(
				'forms',
				'Actions for {title}',
				{ title: this.formTitle },
				undefined,
				{ escape: false, sanitize: false },
			)
		},

		/**
		 * Return, if form has Subtitle
		 */
		hasSubtitle() {
			return this.formSubtitle !== ''
		},

		/**
		 * Route to use, depending on readOnly
		 *
		 * @return {string} Route to 'submit' or 'formRoot'
		 */
		routerTarget() {
			if (this.readOnly) {
				return 'submit'
			}

			return 'formRoot'
		},
	},

	methods: {
		/**
		 * Closes the App-Navigation on mobile-devices
		 */
		mobileCloseNavigation() {
			this.$emit('mobileCloseNavigation')
		},

		onShareForm() {
			this.$emit('openSharing', this.form.hash)
		},

		onCloneForm() {
			this.$emit('clone', this.form.id)
		},

		async onConfirmDelete() {
			// Closing the dialog without a button rejects, which is a cancel too.
			const shouldDelete = await showConfirmation({
				name: t('forms', 'Delete form'),
				// The dialog shows its text as text, so the name is neither escaped nor
				// sanitised; either would put entities such as &amp; on screen.
				text: t(
					'forms',
					'Are you sure you want to delete {title}?',
					{ title: this.formTitle },
					undefined,
					{ escape: false, sanitize: false },
				),
				labelConfirm: t('forms', 'Delete form'),
				labelReject: t('forms', 'Cancel'),
			}).catch(() => false)

			if (shouldDelete) {
				await this.onDeleteForm()
			}
		},

		async onToggleArchive() {
			const wasArchived = this.isArchived
			this.loading = true
			try {
				await axios.patch(
					generateOcsUrl('apps/forms/api/v3/forms/{id}', {
						id: this.form.id,
					}),
					{
						keyValuePairs: {
							state: this.isArchived
								? FormState.FormClosed
								: FormState.FormArchived,
						},
					},
				)
				// eslint-disable-next-line vue/no-mutating-props
				this.form.state = this.isArchived
					? FormState.FormClosed
					: FormState.FormArchived
				// The row leaves its list at once, so say where the form went.
				showSuccess(
					wasArchived
						? t(
								'forms',
								'Form restored. It is closed until you open it again in the form settings.',
							)
						: t(
								'forms',
								'Form archived. You can find it under Archived forms.',
							),
				)
			} catch (error) {
				logger.error('Error changing archived state of form', {
					error,
				})
				showError(t('forms', 'Error changing archived state of form'))
			} finally {
				this.loading = false
			}
		},

		async onDeleteForm() {
			this.loading = true
			try {
				await axios.delete(
					generateOcsUrl('apps/forms/api/v3/forms/{id}', {
						id: this.form.id,
					}),
				)
				this.$emit('delete', this.form.id)
			} catch (error) {
				logger.error(`Error while deleting ${this.formTitle}`, {
					error: error.response,
				})
				showError(
					t('forms', 'Error while deleting {title}', {
						title: this.formTitle,
					}),
				)
			} finally {
				this.loading = false
			}
		},
	},
}
</script>
