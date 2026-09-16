<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->
<template>
	<!-- No toolbar role: it promises one tab stop with arrow keys between the controls,
	     which this bar does not have. The view switch labels its own radio group. -->
	<div
		ref="bar"
		class="top-bar"
		:class="{
			'top-bar--has-sidebar': sidebarOpened,
		}">
		<PillMenu
			v-if="!canOnlySubmit && currentView"
			:active="currentView"
			:options="availableViews"
			:groupLabel="t('forms', 'View mode')"
			@update:active="onChangeView" />
		<!-- Printing a web app is something people forget is possible, and the form and
		     the report are both things that get handed round on paper. Ctrl+P still does
		     the same thing; this only says so. Not offered on the editor, where what would
		     print is the editing furniture. -->
		<NcButton
			v-if="canPrint"
			:aria-label="printLabel"
			variant="tertiary"
			@click="onPrint">
			<template #icon>
				<NcIconSvgWrapper :svg="IconPrint" />
			</template>
			<template v-if="!isMobile" #default>
				{{ t('forms', 'Print') }}
			</template>
		</NcButton>
		<NcButton
			v-if="canShare && !sidebarOpened"
			:aria-label="isMobile ? t('forms', 'Share form') : null"
			variant="tertiary"
			@click="onShareForm">
			<template #icon>
				<NcIconSvgWrapper :svg="IconShareVariant" />
			</template>
			<template v-if="!isMobile" #default>
				{{ t('forms', 'Share') }}
			</template>
		</NcButton>
	</div>
</template>

<script>
import IconBarChart from '@material-symbols/svg-400/outlined/bar_chart.svg?raw'
import IconEdit from '@material-symbols/svg-400/outlined/edit.svg?raw'
import IconPrint from '@material-symbols/svg-400/outlined/print.svg?raw'
import IconShareVariant from '@material-symbols/svg-400/outlined/share.svg?raw'
import IconVisibility from '@material-symbols/svg-400/outlined/visibility.svg?raw'
import { t } from '@nextcloud/l10n'
import { useIsMobile } from '@nextcloud/vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import PillMenu from './PillMenu.vue'
import PermissionTypes from '../mixins/PermissionTypes.js'
import logger from '../utils/Logger.js'

const submitView = {
	ariaLabel: t('forms', 'View form'),
	icon: IconVisibility,
	title: t('forms', 'View'),
	id: 'submit',
}
const editView = {
	ariaLabel: t('forms', 'Edit form'),
	icon: IconEdit,
	title: t('forms', 'Edit'),
	id: 'edit',
	disabled: false,
}
const resultsView = {
	ariaLabel: t('forms', 'Show responses'),
	icon: IconBarChart,
	title: t('forms', 'Responses'),
	id: 'results',
}

export default {
	name: 'TopBar',

	components: {
		NcIconSvgWrapper,
		NcButton,
		PillMenu,
	},

	mixins: [PermissionTypes],

	props: {
		archived: {
			type: Boolean,
			default: false,
		},

		locked: {
			type: Boolean,
			required: true,
		},

		sidebarOpened: {
			type: Boolean,
			default: false,
		},

		permissions: {
			type: Array,
			default: () => [],
		},

		submissionCount: {
			type: Number,
			default: 0,
		},
	},

	emits: ['shareForm'],

	setup() {
		return {
			t,

			isMobile: useIsMobile(),
			IconPrint,
			IconShareVariant,
		}
	},

	computed: {
		currentView() {
			return this.availableViews.filter((v) => v.id === this.$route.name)[0]
		},

		availableViews() {
			const views = []
			if (this.canSubmit) {
				views.push(submitView)
			}
			if (this.canEdit) {
				views.push({
					...editView,
					disabled: this.locked,
				})
			}
			if (this.canSeeResults) {
				views.push(resultsView)
			}
			return views
		},

		canSubmit() {
			return this.permissions.includes(this.PERMISSION_TYPES.PERMISSION_SUBMIT)
		},

		canEdit() {
			return (
				this.permissions.includes(this.PERMISSION_TYPES.PERMISSION_EDIT)
				&& !this.archived
			)
		},

		canSeeResults() {
			return (
				this.permissions.includes(this.PERMISSION_TYPES.PERMISSION_RESULTS)
				|| this.submissionCount > 0
			)
		},

		/**
		 * @return {boolean} whether printing this view would produce something useful.
		 *   currentView is the view definition, not its id.
		 */
		canPrint() {
			return ['submit', 'results'].includes(this.currentView?.id)
		},

		/** @return {string} what the button will print, for a screen reader */
		printLabel() {
			return this.currentView?.id === 'results'
				? t('forms', 'Print responses')
				: t('forms', 'Print form')
		},

		canShare() {
			// This probably can get a permission of itself
			return this.canEdit
		},

		canOnlySubmit() {
			return (
				this.permissions.length === 1
				&& this.permissions.includes(this.PERMISSION_TYPES.PERMISSION_SUBMIT)
				&& this.submissionCount === 0
			)
		},
	},

	mounted() {
		// The bar sticks to the top of the scrolling content, so anything scrolled to the
		// top edge - a question jumped to, a new question receiving focus - would land
		// underneath it. Keep the scroller's padding equal to the bar's height, which
		// grows when the bar wraps to two rows on a phone.
		// A ref rather than $el: the template's leading comment can make $el a text node.
		const bar = this.$refs.bar
		const scroller = bar?.parentElement?.closest('.app-content')
		if (!scroller || !window.ResizeObserver) {
			return
		}
		this.scroller = scroller
		this.resizeObserver = new ResizeObserver(() => {
			scroller.style.scrollPaddingBlockStart = `${bar.offsetHeight}px`
		})
		this.resizeObserver.observe(bar)
	},

	beforeUnmount() {
		this.resizeObserver?.disconnect()
		if (this.scroller) {
			this.scroller.style.scrollPaddingBlockStart = ''
		}
	},

	methods: {
		/** Hand the page to the browser's own print dialog. */
		onPrint() {
			window.print()
		},

		/**
		 * Router methods
		 *
		 * @param {object} option The selected pill menu option
		 */
		async onChangeView(option) {
			if (this.$route.name === option.id) {
				return
			}

			try {
				await this.$router.push({
					name: option.id,
					params: {
						hash: this.$route.params.hash,
					},
				})
			} catch (error) {
				logger.debug('Navigation cancelled', { error })
			}
		},

		onShareForm() {
			this.$emit('shareForm')
		},
	},
}
</script>

<style lang="scss" scoped>
.top-bar {
	display: flex;
	align-items: center;
	// The full width of the content column, with the controls kept at the end. Sized to
	// its controls, the bar's ground covered only them, and questions scrolled past in
	// plain sight beside the view switch.
	align-self: stretch;
	// allow to wrap on small screens
	flex-wrap: wrap;
	justify-content: flex-end;

	// Clear of the navigation and sidebar toggles. Padding rather than margin, so the
	// ground reaches the column's edges; both toggles are stacked above the content and
	// stay on top of it.
	padding-block: var(--app-navigation-padding);
	padding-inline: calc(
		var(--app-navigation-padding) + var(--default-clickable-area)
	);

	position: sticky;
	top: 0;
	z-index: 100;
	// Content scrolls under the sticky bar, and the tertiary Print and Share buttons
	// are transparent, so the bar needs its own ground.
	background-color: var(--color-main-background);

	&--has-sidebar {
		// The sidebar toggle does not exist while the sidebar is open
		padding-inline-end: var(--app-navigation-padding);
	}
}
</style>
