<!--
  - SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcDialog
		contentClasses="archived-forms"
		:name="t('forms', 'Archived forms')"
		:open="open"
		size="normal"
		@update:open="$emit('update:open', $event)">
		<!-- Restoring or deleting the last one leaves the dialog open, so say so. -->
		<NcEmptyContent
			v-if="shownForms.length === 0"
			:name="t('forms', 'No archived forms')"
			:description="
				t('forms', 'Forms you archive are kept here, out of the way.')
			">
			<template #icon>
				<NcIconSvgWrapper :svg="IconArchive" :size="64" />
			</template>
		</NcEmptyContent>
		<ul v-else :aria-label="t('forms', 'Archived forms')">
			<!-- Keyed by id: rows leave this list, and an index key would hand a removed
			     form's open menu or pending state to the one that slides into its place. -->
			<AppNavigationForm
				v-for="form in shownForms"
				:key="form.id"
				:form="form"
				:readOnly="!ownedIds.has(form.id)"
				forceDisplayActions
				@clone="onCloneForm(form.id)"
				@delete="onDelete(form)"
				@mobileCloseNavigation="onMobileCloseNavigation" />
		</ul>
	</NcDialog>
</template>

<script>
import IconArchive from '@material-symbols/svg-400/outlined/archive.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import { defineComponent } from 'vue'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import AppNavigationForm from './AppNavigationForm.vue'

export default defineComponent({
	name: 'ArchivedFormsModal',

	components: {
		AppNavigationForm,
		NcDialog,
		NcEmptyContent,
		NcIconSvgWrapper,
	},

	props: {
		open: {
			type: Boolean,
			required: true,
		},

		forms: {
			type: Array,
			required: true,
		},

		// Ids of the forms the user owns. The list also holds archived forms shared with
		// the user, which must not offer the owner-only Unarchive and Delete.
		ownedIds: {
			type: Set,
			default: () => new Set(),
		},
	},

	emits: ['update:open', 'clone', 'delete', 'mobileCloseNavigation'],

	setup() {
		return { IconArchive }
	},

	data() {
		return {
			shownForms: [],
		}
	},

	watch: {
		forms: {
			immediate: true,
			handler() {
				this.shownForms = [...this.forms]
			},
		},
	},

	methods: {
		t,

		onCloneForm(formId) {
			this.$emit('clone', formId)
			this.$emit('update:open', false)
		},

		/**
		 * A row was followed to its form. On a phone the dialog was opened from the
		 * navigation drawer, which would otherwise stay over the form just opened.
		 */
		onMobileCloseNavigation() {
			this.$emit('update:open', false)
			this.$emit('mobileCloseNavigation')
		},

		onDelete(form) {
			this.shownForms = this.shownForms.filter(({ id }) => id !== form.id)
			// The parent holds the real list: without this the form stays in app state
			// and reappears the next time the list is rebuilt.
			this.$emit('delete', form.id)
		},
	},
})
</script>

<style scoped>
:deep(.archived-forms) {
	min-height: 50vh !important;
	padding-block-end: 22px;
}
</style>
