<!--
  - SPDX-FileCopyrightText: 2021 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcContent appName="forms" :class="{ 'app-forms-embedded': isEmbedded }">
		<Submit
			:form="form"
			publicView
			:shareHash="shareHash"
			:isLoggedIn="isLoggedIn"
			:sidebarOpened="false" />
	</NcContent>
</template>

<script>
import { subscribe, unsubscribe } from '@nextcloud/event-bus'
import { loadState } from '@nextcloud/initial-state'
import NcContent from '@nextcloud/vue/components/NcContent'
import Submit from './views/Submit.vue'

export default {
	name: 'FormsSubmit',

	components: {
		NcContent,
		Submit,
	},

	data() {
		return {
			form: loadState('forms', 'form'),
			isLoggedIn: loadState('forms', 'isLoggedIn'),
			isEmbedded: loadState('forms', 'isEmbedded', false),
			shareHash: loadState('forms', 'shareHash'),
		}
	},

	unmounted() {
		unsubscribe('forms:last-updated:set', this.emitSubmitMessage)
		this.resizeObserver?.disconnect()
		this.mutationObserver?.disconnect()
	},

	mounted() {
		if (this.isEmbedded) {
			subscribe('forms:last-updated:set', this.emitSubmitMessage)

			// Communicate window size to parent window in iframes
			this.$nextTick(() => this.observeSize())
		}
	},

	methods: {
		emitSubmitMessage(id) {
			window.parent?.postMessage(
				{
					type: 'form-saved',
					payload: {
						id,
					},
				},
				'*',
			)
		},

		/**
		 * Report the content's size whenever it changes.
		 *
		 * The page's main element always exists, whatever the form shows: the questions,
		 * a thank-you screen, or a closed, expired or full notice. It is sized to the
		 * frame, though, so it is its children that grow and shrink. They are replaced
		 * as the view changes state, so the set being watched is renewed each time.
		 * Watching the form alone failed when there was no form, and lost track of it
		 * once it was rebuilt.
		 */
		observeSize() {
			const main = document.querySelector('.app-forms-embedded main')
			if (!main) {
				return
			}
			this.resizeObserver = new ResizeObserver(() => {
				this.emitResizeMessage(main)
			})
			const watchChildren = () => {
				this.resizeObserver.disconnect()
				for (const child of main.children) {
					this.resizeObserver.observe(child)
				}
				this.emitResizeMessage(main)
			}
			watchChildren()
			this.mutationObserver = new MutationObserver(watchChildren)
			this.mutationObserver.observe(main, { childList: true })
		},

		/**
		 * @param {HTMLElement} main Element whose content size should be communicated
		 */
		emitResizeMessage(main) {
			// The bottom edge of the lowest child, measured from the top of the document,
			// so the frame can shrink again as well as grow.
			const offset = window.scrollY + main.scrollTop
			let height = 0
			let width = 0
			for (const child of main.children) {
				const rect = child.getBoundingClientRect()
				const marginEnd =
					parseFloat(getComputedStyle(child).marginBlockEnd) || 0
				height = Math.max(height, rect.bottom + offset + marginEnd)
				width = Math.max(width, child.scrollWidth)
			}

			window.parent?.postMessage(
				{
					type: 'resize-iframe',
					payload: {
						width: Math.ceil(width),
						height: Math.ceil(height),
					},
				},
				'*',
			)
		},
	},
}
</script>
