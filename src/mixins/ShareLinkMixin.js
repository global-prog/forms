import { showError, showSuccess } from '@nextcloud/dialogs'
/**
 * SPDX-FileCopyrightText: 2021 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { translate as t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import logger from '../utils/Logger.js'

/**
 * Make text safe to place inside a double-quoted HTML attribute.
 *
 * @param {string} text Text to escape
 * @return {string} escaped text
 */
function escapeAttribute(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

export default {
	methods: {
		/**
		 * Get the internal link for sharing the form
		 *
		 * @param {string} formHash Internal form hash
		 * @return {string} link
		 */
		getInternalShareLink(formHash) {
			return (
				window.location.protocol
				+ '//'
				+ window.location.host
				+ generateUrl(`/apps/forms/${formHash}`)
			)
		},

		/**
		 * Get the publish share link for a given share
		 *
		 * @param {object} share The share
		 * @return {string} link
		 */
		getPublicShareLink(share) {
			let url
			if (this.isEmbeddingAllowed(share)) {
				url = generateUrl(`/apps/forms/embed/${share.shareWith}`)
			} else {
				url = generateUrl(`/apps/forms/s/${share.shareWith}`)
			}
			return new URL(url, window.location).href
		},

		/**
		 * Check if a share can be used for embedding
		 *
		 * @param {{ shareType: number, permissions: string[] }} share The share to check
		 */
		isEmbeddingAllowed(share) {
			return (
				share.shareType === this.SHARE_TYPES.SHARE_TYPE_LINK
				&& share.permissions?.includes(
					this.PERMISSION_TYPES.PERMISSION_EMBED,
				)
			)
		},

		/**
		 * Copy link to clipboard.
		 *
		 * @param {object} event Origin event of function call.
		 * @param {string} link Link to copy
		 */
		async copyLink(event, link) {
			// currentTarget is only set while the event is dispatched, so keep it before awaiting
			const target = event?.currentTarget
			// Copy link, boolean return indicates success or fail.
			try {
				await navigator.clipboard.writeText(link)
				showSuccess(t('forms', 'Form link copied'))
			} catch (error) {
				showError(t('forms', 'Cannot copy, please copy the link manually'))
				logger.error('Copy link failed', { error })
			}
			// Set back focus as clipboard removes focus
			target?.focus?.()
		},

		/**
		 * Copy code to embed public share inside external websites
		 *
		 * @param {object} event Origin event of function call.
		 * @param {object} share Public link-share
		 */
		async copyEmbeddingCode(event, share) {
			const target = event?.currentTarget
			// The title names the frame for screen readers on the host page. The width and
			// height attributes stay as a fallback, while the style lets the frame shrink
			// to a phone screen instead of overflowing it.
			const code = `<iframe src="${escapeAttribute(this.getPublicShareLink(share))}" title="${escapeAttribute(this.form?.title || t('forms', 'Form'))}" width="750" height="900" style="width:100%;max-width:750px;border:0" loading="lazy"></iframe>`
			try {
				await navigator.clipboard.writeText(code)
				showSuccess(t('forms', 'Embedding code copied'))
			} catch (error) {
				showError(t('forms', 'Cannot copy the code'))
				logger.error('Copy embedding code failed', { error })
			}
			// Set back focus as clipboard removes focus
			target?.focus?.()
		},
	},
}
