<!--
  - SPDX-FileCopyrightText: 2018 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcContent appName="forms">
		<NcAppNavigation
			v-if="canCreateForms || hasForms"
			:aria-label="t('forms', 'Forms navigation')">
			<NcAppNavigationNew
				v-if="canCreateForms"
				:text="t('forms', 'New form')"
				:disabled="creatingForm"
				@click="onNewForm">
				<template #icon>
					<NcIconSvgWrapper :svg="IconPlus" />
				</template>
			</NcAppNavigationNew>
			<!-- Wrapped and padded the way NcAppNavigationNew pads its own button, so the
			     two stack as a matching pair instead of this one running edge to edge. -->
			<div v-if="canCreateForms" class="forms-navigation__template">
				<NcButton variant="tertiary" wide @click="showTemplates = true">
					<template #icon>
						<NcIconSvgWrapper :svg="IconTemplate" />
					</template>
					{{ t('forms', 'Start from a template') }}
				</NcButton>
			</div>

			<!-- Form-Owner-->
			<template v-if="ownedForms.length > 0">
				<NcAppNavigationCaption
					isHeading
					class="forms-navigation__list-heading"
					headingId="forms-navigation-your-forms"
					:name="t('forms', 'Your forms')" />
				<ul aria-labelledby="forms-navigation-your-forms">
					<AppNavigationForm
						v-for="form in ownedForms"
						:key="form.id"
						:form="form"
						:forceDisplayActions="isMobile"
						@openSharing="openSharing"
						@mobileCloseNavigation="mobileCloseNavigation"
						@clone="onCloneForm"
						@delete="onDeleteForm" />
				</ul>
			</template>

			<!-- Shared Forms-->
			<template v-if="sharedForms.length > 0">
				<NcAppNavigationCaption
					isHeading
					class="forms-navigation__list-heading"
					headingId="forms-navigation-shared-forms"
					:name="t('forms', 'Shared with you')" />
				<ul aria-labelledby="forms-navigation-shared-forms">
					<AppNavigationForm
						v-for="form in sharedForms"
						:key="form.id"
						:form="form"
						:forceDisplayActions="isMobile"
						readOnly
						@openSharing="openSharing"
						@clone="onCloneForm"
						@mobileCloseNavigation="mobileCloseNavigation" />
				</ul>
			</template>

			<template #footer>
				<div v-if="archivedForms.length > 0" class="forms-navigation-footer">
					<NcButton
						alignment="start"
						class="forms__archived-forms-toggle"
						variant="tertiary"
						wide
						@click="showArchivedForms = true">
						<template #icon>
							<NcIconSvgWrapper :svg="IconArchive" />
						</template>
						{{ t('forms', 'Archived forms') }}
					</NcButton>
				</div>
			</template>
		</NcAppNavigation>

		<!-- No forms & loading emptycontents -->
		<NcAppContent v-if="loading || !routeHash || !routeAllowed">
			<NcEmptyContent
				v-if="loading"
				class="forms-emptycontent"
				:name="t('forms', 'Loading forms …')">
				<template #icon>
					<NcLoadingIcon :size="64" />
				</template>
			</NcEmptyContent>

			<!-- A failed load leaves both lists empty, which is not the same as having no
			     forms: say so and offer a retry rather than inviting a first form. -->
			<NcEmptyContent
				v-else-if="loadError && !hasForms"
				class="forms-emptycontent"
				:name="t('forms', 'Could not load your forms')"
				:description="t('forms', 'Check your connection and try again.')">
				<template #icon>
					<NcIconSvgWrapper :svg="FormsIcon" :size="64" />
				</template>
				<template #action>
					<NcButton variant="primary" @click="loadForms">
						{{ t('forms', 'Try again') }}
					</NcButton>
				</template>
			</NcEmptyContent>

			<NcEmptyContent
				v-else-if="!hasForms"
				class="forms-emptycontent"
				:name="
					canCreateForms
						? t('forms', 'No forms created yet')
						: t('forms', 'No forms have been shared with you yet')
				">
				<template #icon>
					<NcIconSvgWrapper :svg="FormsIcon" :size="64" />
				</template>
				<template v-if="canCreateForms" #action>
					<div class="forms-emptycontent__actions">
						<NcButton
							variant="primary"
							wide
							:disabled="creatingForm"
							@click="onNewForm">
							{{ t('forms', 'Create a form') }}
						</NcButton>
						<NcButton
							variant="secondary"
							wide
							@click="showTemplates = true">
							{{ t('forms', 'Start from a template') }}
						</NcButton>
					</div>
				</template>
			</NcEmptyContent>

			<NcEmptyContent
				v-else
				class="forms-emptycontent"
				:name="
					canCreateForms
						? t('forms', 'Select a form or create a new one')
						: t('forms', 'Please select a form')
				">
				<template #icon>
					<NcIconSvgWrapper :svg="FormsIcon" :size="64" />
				</template>
				<template v-if="canCreateForms" #action>
					<div class="forms-emptycontent__actions">
						<NcButton
							variant="primary"
							wide
							:disabled="creatingForm"
							@click="onNewForm">
							{{ t('forms', 'Create new form') }}
						</NcButton>
						<NcButton
							variant="secondary"
							wide
							@click="showTemplates = true">
							{{ t('forms', 'Start from a template') }}
						</NcButton>
					</div>
				</template>
			</NcEmptyContent>
		</NcAppContent>

		<!-- No errors show router content -->
		<template v-else>
			<router-view
				:form="selectedForm"
				isLoggedIn
				:sidebarOpened="sidebarOpened"
				@update:form="updateSelectedForm"
				@update:sidebarOpened="sidebarOpened = $event"
				@openSharing="openSharing" />
			<Sidebar
				v-if="
					!selectedForm.partial
					&& (canEdit || (allowComments && selectedForm.allowComments))
				"
				:form="selectedForm"
				:sidebarOpened="sidebarOpened"
				:active="sidebarActive"
				@update:sidebarOpened="sidebarOpened = $event"
				@update:active="sidebarActive = $event" />
		</template>

		<!-- Archived forms modal -->
		<ArchivedFormsModal
			v-model:open="showArchivedForms"
			:forms="archivedForms"
			:ownedIds="ownedFormIds"
			@clone="onCloneForm"
			@delete="onDeleteForm" />
		<TemplatePicker
			v-if="canCreateForms"
			v-model:open="showTemplates"
			@created="onTemplateCreated" />
	</NcContent>
</template>

<script>
import IconPlus from '@material-symbols/svg-400/outlined/add.svg?raw'
import IconArchive from '@material-symbols/svg-400/outlined/archive.svg?raw'
import IconTemplate from '@material-symbols/svg-400/outlined/dashboard_customize.svg?raw'
import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { emit, subscribe, unsubscribe } from '@nextcloud/event-bus'
import { loadState } from '@nextcloud/initial-state'
import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import { generateOcsUrl } from '@nextcloud/router'
import { useIsMobile } from '@nextcloud/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcAppNavigation from '@nextcloud/vue/components/NcAppNavigation'
import NcAppNavigationCaption from '@nextcloud/vue/components/NcAppNavigationCaption'
import NcAppNavigationNew from '@nextcloud/vue/components/NcAppNavigationNew'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcContent from '@nextcloud/vue/components/NcContent'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import AppNavigationForm from './components/AppNavigationForm.vue'
import ArchivedFormsModal from './components/ArchivedFormsModal.vue'
import TemplatePicker from './components/TemplatePicker.vue'
import Sidebar from './views/Sidebar.vue'
import FormsIcon from '../img/forms-dark.svg?raw'
import PermissionTypes from './mixins/PermissionTypes.js'
import { FormState } from './models/Constants.ts'
import logger from './utils/Logger.js'
import OcsResponse2Data from './utils/OcsResponse2Data.js'
import SetWindowTitle from './utils/SetWindowTitle.js'

const appName = 'forms'

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Forms',

	components: {
		AppNavigationForm,
		TemplatePicker,
		ArchivedFormsModal,
		NcIconSvgWrapper,
		NcAppContent,
		NcAppNavigation,
		NcAppNavigationCaption,
		NcAppNavigationNew,
		NcButton,
		NcContent,
		NcEmptyContent,
		NcLoadingIcon,
		Sidebar,
	},

	setup() {
		const route = useRoute()
		const router = useRouter()
		const isMobile = useIsMobile()

		const loading = ref(true)
		const sidebarOpened = ref(false)
		const sidebarActive = ref('forms-sharing')
		const forms = ref([])
		const allSharedForms = ref([])
		const showArchivedForms = ref(false)
		const canCreateForms = ref(loadState(appName, 'appConfig').canCreateForms)
		const allowComments = ref(loadState(appName, 'appConfig').allowComments)
		const deletedFormHash = ref(null)
		const loadError = ref(false)
		const creatingForm = ref(false)
		// Hashes already looked up on the server, so a failed lookup is not retried on
		// every re-render.
		const triedHashes = new Set()

		const PERMISSION_TYPES = PermissionTypes.data().PERMISSION_TYPES

		const routeHash = computed(() => route.params.hash)

		const routeAllowed = computed(() => {
			if (loading.value && loadState(appName, 'formId', null) === 'invalid') {
				return false
			}

			if (!routeHash.value) {
				return false
			}

			// Don't try to fetch if this form was just deleted
			if (deletedFormHash.value === routeHash.value) {
				return false
			}

			const form = [...forms.value, ...allSharedForms.value].find(
				(form) => form.hash === routeHash.value,
			)

			// A form in neither list is looked up by the watcher further down. A computed
			// must not start requests: this one re-evaluates whenever loading flips, so a
			// failed lookup used to start the next one straight away, without end.
			if (form === undefined) {
				return false
			}

			if (route.name === 'results') {
				return (
					form.permissions.includes(route.name) || form.submissionCount > 0
				)
			}

			return form?.permissions.includes(route.name)
		})

		const selectedForm = computed(() => {
			if (routeAllowed.value) {
				return (
					[...forms.value, ...allSharedForms.value].find(
						(form) => form.hash === routeHash.value,
					) || {}
				)
			}
			return {}
		})

		const updateSelectedForm = (form) => {
			sidebarOpened.value = false

			const index = forms.value.findIndex((f) => f.hash === form.hash)
			if (index > -1) {
				forms.value[index] = form
				return
			}

			const sharedIndex = allSharedForms.value.findIndex(
				(f) => f.hash === form.hash,
			)
			if (sharedIndex > -1) {
				allSharedForms.value[sharedIndex] = form
			}
		}

		const canEdit = computed(() => {
			return selectedForm.value.permissions?.includes(
				PERMISSION_TYPES.PERMISSION_EDIT,
			)
		})

		const hasForms = computed(() => {
			return allSharedForms.value.length > 0 || forms.value.length > 0
		})

		const ownedForms = computed(() => {
			return forms.value.filter(
				(form) => form.state !== FormState.FormArchived,
			)
		})

		const sharedForms = computed(() => {
			return allSharedForms.value.filter(
				(form) => form.state !== FormState.FormArchived,
			)
		})

		// Archived forms mix owned and shared ones; only the owner may unarchive or delete.
		const ownedFormIds = computed(
			() => new Set(forms.value.map((form) => form.id)),
		)

		const archivedForms = computed(() => {
			return [...forms.value, ...allSharedForms.value].filter(
				(form) => form.state === FormState.FormArchived,
			)
		})

		const mobileCloseNavigation = () => {
			if (isMobile.value) {
				emit('toggle-navigation', { open: false })
			}
		}

		const openSharing = (hash) => {
			if (hash !== routeHash.value) {
				router.push({ name: 'edit', params: { hash } })
			}

			sidebarActive.value = 'forms-sharing'
			sidebarOpened.value = true
		}

		const loadForms = async () => {
			loading.value = true
			loadError.value = false
			// A retry is a fresh start for a form that could not be looked up either.
			triedHashes.clear()

			try {
				const response = await axios.get(
					generateOcsUrl('apps/forms/api/v3/forms'),
				)
				forms.value = OcsResponse2Data(response)
			} catch (error) {
				logger.error('Error while loading owned forms list', { error })
				loadError.value = true
				showError(
					t('forms', 'An error occurred while loading the forms list'),
				)
			}

			// Load shared forms
			try {
				const response = await axios.get(
					generateOcsUrl('apps/forms/api/v3/forms?type=shared'),
				)
				allSharedForms.value = OcsResponse2Data(response)
			} catch (error) {
				logger.error('Error while loading shared forms list', {
					error,
				})
				loadError.value = true
				showError(
					t('forms', 'An error occurred while loading the forms list'),
				)
			}

			loading.value = false
		}

		/**
		 * Fetch a partial form by its hash after initial load completes.
		 *
		 * @param {string} hash The hash of the form to fetch.
		 */
		async function fetchPartialForm(hash) {
			await new Promise((resolve) => {
				const wait = () => {
					if (loading.value) {
						window.setTimeout(wait, 250)
					} else {
						resolve()
					}
				}
				wait()
			})

			const notFound = () => {
				showError(t('forms', 'Form not found'))
				if (route.name !== 'root') {
					router.push({ name: 'root' })
				}
			}

			// The page only knows the id of the form it was opened on. With no id, or one
			// the server could not match, there is nothing to ask for.
			const formId = loadState(appName, 'formId', 'invalid')

			loading.value = true
			if (
				[...forms.value, ...allSharedForms.value].find(
					(form) => form.hash === hash,
				) === undefined
			) {
				if (formId === 'invalid') {
					notFound()
					loading.value = false
					return
				}
				try {
					const response = await axios.get(
						generateOcsUrl('apps/forms/api/v3/forms/{id}', {
							id: formId,
						}),
					)
					const form = OcsResponse2Data(response)

					// The id belongs to the page's first form; after moving to another
					// unknown hash it names a different form, which must not be listed.
					if (
						form.hash === hash
						&& form.permissions.includes(
							PERMISSION_TYPES.PERMISSION_SUBMIT,
						)
					) {
						allSharedForms.value.push(form)
					} else {
						notFound()
					}
				} catch (error) {
					logger.error(`Form ${hash} not found`, { error })

					if ([400, 403, 404].includes(error.response?.status)) {
						notFound()
					} else {
						// The form may well exist; it is the request that failed.
						showError(
							t(
								'forms',
								'Could not load the form. Check your connection and try again.',
							),
						)
					}
				}
			}

			loading.value = false
		}

		// Look up a form that is in neither list once loading is done, and only once per
		// hash, so a failed lookup settles instead of repeating.
		watch(
			[routeHash, loading],
			([hash, isLoading]) => {
				if (
					isLoading
					|| !hash
					|| deletedFormHash.value === hash
					|| triedHashes.has(hash)
				) {
					return
				}
				const known = [...forms.value, ...allSharedForms.value].some(
					(form) => form.hash === hash,
				)
				if (!known) {
					triedHashes.add(hash)
					fetchPartialForm(hash)
				}
			},
			{ immediate: true },
		)

		// Whether the template picker is open.
		const showTemplates = ref(false)

		/**
		 * A template has built a form: list it and open it for editing, as a new form does.
		 *
		 * @param {object} form the form that was created
		 */
		const onTemplateCreated = (form) => {
			forms.value.unshift(form)
			router.push({ name: 'edit', params: { hash: form.hash } })
			mobileCloseNavigation()
		}

		const onNewForm = async () => {
			// A second tap on a slow connection would create a second empty form.
			if (creatingForm.value) {
				return
			}
			creatingForm.value = true
			try {
				const response = await axios.post(
					generateOcsUrl('apps/forms/api/v3/forms'),
				)
				const newForm = OcsResponse2Data(response)
				forms.value.unshift(newForm)
				router.push({
					name: 'edit',
					params: { hash: newForm.hash },
				})
				mobileCloseNavigation()
			} catch (error) {
				logger.error('Unable to create new form', { error })
				showError(t('forms', 'Unable to create a new form'))
			} finally {
				creatingForm.value = false
			}
		}

		const onCloneForm = async (id) => {
			try {
				const response = await axios.post(
					generateOcsUrl('apps/forms/api/v3/forms?fromId={id}', {
						id,
					}),
				)
				const newForm = OcsResponse2Data(response)
				forms.value.unshift(newForm)
				router.push({
					name: 'edit',
					params: { hash: newForm.hash },
				})
				mobileCloseNavigation()
			} catch (error) {
				logger.error(`Unable to copy form ${id}`, { error })
				showError(t('forms', 'Unable to copy form'))
			}
		}

		const onDeleteForm = async (id) => {
			const formIndex = forms.value.findIndex((form) => form.id === id)
			if (formIndex === -1) {
				return
			}
			const deletedHash = forms.value[formIndex].hash

			forms.value.splice(formIndex, 1)
			deletedFormHash.value = deletedHash

			if (deletedHash === routeHash.value && route.name !== 'root') {
				// Navigate to root without triggering route guards
				router.replace({ name: 'root' })
			}
		}

		// Reset deletedFormHash when navigating away from the deleted form
		watch(
			() => route.name,
			(newRouteName) => {
				if (newRouteName === 'root') {
					deletedFormHash.value = null
					// Only the form views set the tab title, so leaving them has to reset it.
					SetWindowTitle('')
				}
			},
		)

		const onLastUpdatedByEventBus = (id) => {
			const formIndex = forms.value.findIndex((form) => form.id === id)
			if (formIndex !== -1) {
				forms.value[formIndex].lastUpdated = moment().unix()
				forms.value.sort((b, a) => a.lastUpdated - b.lastUpdated)
			} else {
				const sharedFormIndex = allSharedForms.value.findIndex(
					(form) => form.id === id,
				)
				allSharedForms.value[sharedFormIndex].lastUpdated = moment().unix()
				allSharedForms.value.sort((b, a) => a.lastUpdated - b.lastUpdated)
			}
		}

		onMounted(() => {
			loadForms()
			subscribe('forms:last-updated:set', onLastUpdatedByEventBus)
			subscribe('forms:ownership-transfered', onDeleteForm)
		})

		onUnmounted(() => {
			unsubscribe('forms:last-updated:set', onLastUpdatedByEventBus)
			unsubscribe('forms:ownership-transfered', onDeleteForm)
		})

		return {
			loading,
			sidebarOpened,
			sidebarActive,
			forms,
			allSharedForms,
			showArchivedForms,
			canCreateForms,
			allowComments,
			isMobile,
			loadError,
			creatingForm,
			selectedForm,
			updateSelectedForm,
			canEdit,
			hasForms,
			ownedForms,
			sharedForms,
			archivedForms,
			ownedFormIds,
			routeHash,
			routeAllowed,
			mobileCloseNavigation,
			openSharing,
			loadForms,
			fetchPartialForm,
			onNewForm,
			showTemplates,
			onTemplateCreated,
			IconTemplate,
			onCloneForm,
			onDeleteForm,
			onLastUpdatedByEventBus,
			IconPlus,
			IconArchive,
			FormsIcon,
		}
	},
}
</script>

<style scoped lang="scss">
.forms-navigation-footer {
	display: flex;
	flex-direction: column;
	padding: var(--app-navigation-padding);
}

// Fix the margin of the lists
.forms-navigation__list-heading {
	margin-block: calc(var(--default-grid-baseline) * 2) 0 !important;

	:deep(h2) {
		// Make the list more condensed
		margin-block: 0;
	}
}

// Matches the padding NcAppNavigationNew gives the button above it; the top is
// already covered by that component's own bottom padding.
.forms-navigation__template {
	padding-inline: calc(var(--default-grid-baseline) * 2);
	padding-block-end: calc(var(--default-grid-baseline) * 2);
}

.forms-emptycontent {
	height: 100%;
}

// The action slot is a plain block, so the two buttons stacked at their own text widths.
// One grid track per button, sized 1fr, gives both the width of the wider one; side by
// side where they fit, one above the other on a phone, equal either way.
.forms-emptycontent__actions {
	display: inline-grid;
	grid-auto-flow: column;
	grid-auto-columns: 1fr;
	gap: calc(var(--default-grid-baseline) * 2);

	@media (max-width: 480px) {
		grid-auto-flow: row;
	}
}
</style>
