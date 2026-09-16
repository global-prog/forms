/**
 * SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { translate as t } from '@nextcloud/l10n'

/**
 * Set the Window-Title to current FormTitle including suffix.
 *
 * @param {string} formTitle Title of current form to set on window.
 */
function SetWindowTitle(formTitle) {
	if (formTitle === '') {
		window.document.title = t('forms', 'Forms') + ' - ' + OC.theme.title
	} else {
		// One translatable pattern rather than pieces glued together, so a language can
		// put the form's name where it reads naturally. The tab title is plain text, so
		// the name must not be HTML-escaped.
		const formsTitle = t(
			'forms',
			'{formTitle} - Forms',
			{ formTitle },
			undefined,
			{
				escape: false,
			},
		)
		window.document.title = formsTitle + ' - ' + OC.theme.title
	}
}

export default SetWindowTitle
