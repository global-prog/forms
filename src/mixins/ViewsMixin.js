/**
 * SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getCurrentUser } from '@nextcloud/auth'
import axios, { isCancel } from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import { generateOcsUrl } from '@nextcloud/router'
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'
import CancelableRequest from '../utils/CancelableRequest.js'
import logger from '../utils/Logger.js'
import OcsResponse2Data from '../utils/OcsResponse2Data.js'
import { resolveDirection } from '../utils/TextDirection.js'

export default {
	provide() {
		return {
			$markdownit: this.markdownit,
			// Components below the view that show the author's words read this, so a
			// declared language aligns every one of them the same way.
			formTextAlign: computed(() => this.authorTextAlign),
		}
	},

	props: {
		hash: {
			type: String,
			default: '',
		},
		form: {
			type: Object,
			required: true,
		},
		publicView: {
			type: Boolean,
			default: false,
		},
		sidebarOpened: {
			type: Boolean,
			required: true,
		},
	},

	// Declared so a listener the parent binds for them is not also passed down as an
	// attribute. Merged with any list a view declares itself.
	emits: ['update:form', 'openSharing'],

	data() {
		return {
			// State-Variable
			isLoadingForm: true,

			// storage for axios cancel function
			cancelFetchFullForm: () => {},

			// Autosave of the form's own properties: how many saves are still running,
			// whether the last one failed, and whether any has finished at all, so a view
			// can say "saving" or "saved" rather than only ever reporting failures.
			formSavingCount: 0,
			formSaveFailed: false,
			formSavedOnce: false,

			// markdown renderer for descriptions
			markdownit: new MarkdownIt({ breaks: true }),
		}
	},

	computed: {
		/**
		 * The language the form itself is written in.
		 *
		 * '' means the form has not said, which is the default and, on any instance that
		 * had forms before the setting existed, the usual case.
		 *
		 * @return {string} a language code, or '' to work it out from the content
		 */
		formLanguage() {
			return this.form?.settings?.language || ''
		},

		/**
		 * Which way the form's own content should be laid out.
		 *
		 * Shared by every view that shows a form's words -- filling it in, editing it,
		 * and reading its responses -- because they are the same words either way. It is
		 * NOT applied to the surrounding application chrome, which belongs to the reader
		 * and stays in the reader's own language.
		 *
		 * @return {?string} 'rtl', 'ltr', or undefined to inherit
		 */
		formDirection() {
			return resolveDirection(
				this.formLanguage,
				this.form?.title,
				this.form?.description,
			)
		},

		/**
		 * How to align text the form's author wrote: its title, description, questions
		 * and feedback.
		 *
		 * Each of those keeps dir="auto", so its own words decide their order and a full
		 * stop stays at the end of an English sentence. But on its own that also aligned
		 * them by their words, so a declared-Arabic form set every English line flush left
		 * inside a right-to-left layout, and the setting changed almost nothing a respondent
		 * sees. When a language is declared it now decides the alignment of all of them;
		 * without one, each keeps aligning by its own words. What respondents type is never
		 * subject to this.
		 *
		 * @return {string|undefined} 'right', 'left', or undefined to leave it alone
		 */
		authorTextAlign() {
			if (!this.formLanguage) {
				return undefined
			}
			return this.formDirection === 'rtl' ? 'right' : 'left'
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

		formDescription() {
			// Remember the old renderer if overridden, or proxy to the default renderer.
			const defaultRender =
				this.markdownit.renderer.rules.link_open
				|| function (tokens, idx, options, env, self) {
					return self.renderToken(tokens, idx, options)
				}

			this.markdownit.renderer.rules.link_open = function (
				tokens,
				idx,
				options,
				env,
				self,
			) {
				// Add a new `target` attribute, or replace the value of the existing one.
				tokens[idx].attrSet('target', '_blank')

				// Pass the token to the default renderer.
				return defaultRender(tokens, idx, options, env, self)
			}

			return (
				this.markdownit.render(this.form.description)
				|| this.form.description
			)
		},

		isFormLocked() {
			return (
				this.form.lockedUntil === 0
				|| (this.form.lockedUntil > moment().unix()
					&& this.form.lockedBy !== getCurrentUser().uid)
			)
		},
	},

	methods: {
		onShareForm() {
			this.$emit('openSharing', this.form.hash)
		},

		/**
		 * Focus title after form load
		 */
		focusTitle() {
			this.$nextTick(() => {
				this.$refs.title?.focus()
			})
		},

		/**
		 * Fetch the full form data and update parent
		 *
		 * @param {number} id the unique form hash
		 * @param {object} [options] request options
		 * @param {boolean} [options.silent] refresh in place, without swapping the view for
		 *   the loading screen; for reloads after the page has already been shown, where
		 *   unmounting it would drop what is on it (a confirmation, focus, a live region)
		 */
		async fetchFullForm(id, { silent = false } = {}) {
			if (!silent) {
				this.isLoadingForm = true
			}

			// Cancel previous request
			this.cancelFetchFullForm('New request pending.')

			// Output after cancelling previous request for logical order.
			logger.debug(`Loading form ${id}`)

			// Create new cancelable get request
			const { request, cancel } = CancelableRequest(
				async function (url, requestOptions) {
					return axios.get(url, requestOptions)
				},
			)
			// Store cancel-function
			this.cancelFetchFullForm = cancel

			try {
				const response = await request(
					generateOcsUrl('apps/forms/api/v3/forms/{id}', { id }),
				)
				this.$emit('update:form', OcsResponse2Data(response))
				this.isLoadingForm = false
			} catch (error) {
				if (isCancel(error)) {
					logger.debug(`The request for form ${id} has been canceled`, {
						error,
					})
				} else {
					logger.error(`Unexpected error fetching form ${id}`, {
						error,
					})
					this.isLoadingForm = false
				}
			} finally {
				// A quiet reload happens after the page is shown; moving focus then
				// interrupts what a screen reader is reading.
				if (!silent) {
					this.focusTitle()
				}
			}
		},

		async saveFormProperty(key) {
			this.formSavingCount++
			try {
				await axios.patch(
					generateOcsUrl('apps/forms/api/v3/forms/{id}', {
						id: this.form.id,
					}),
					{
						keyValuePairs: {
							[key]: this.form[key],
						},
					},
				)
				emit('forms:last-updated:set', this.form.id)
				this.formSaveFailed = false
				this.formSavedOnce = true
			} catch (error) {
				logger.error('Error saving form property', { error })
				this.formSaveFailed = true
				showError(t('forms', 'Error while saving form'))
			} finally {
				this.formSavingCount--
			}
		},
	},
}
