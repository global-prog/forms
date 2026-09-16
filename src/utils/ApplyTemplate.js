/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import axios from '@nextcloud/axios'
import { generateOcsUrl } from '@nextcloud/router'
import OcsResponse2Data from './OcsResponse2Data.js'

/*
 * Building a form from a template, through the same API the editor uses: create the form,
 * name it, then add each question, its options, and whatever settings it carries. Nothing
 * here can make a form the editor could not, and the server checks every step as usual.
 *
 * A quiz template names its correct options by position, since an option has no id until
 * it exists; the ids come back as the options are created and the answer key is written
 * with them.
 */

/**
 * @param {object} template one of the templates from models/FormTemplates.js
 * @return {Promise<object>} the form that was created
 */
export async function createFormFromTemplate(template) {
	const form = OcsResponse2Data(
		await axios.post(generateOcsUrl('apps/forms/api/v3/forms')),
	)

	const keyValuePairs = {
		title: template.form.title,
		description: template.form.description ?? '',
	}
	if (template.form.settings) {
		keyValuePairs.settings = template.form.settings
	}

	// Every step after the first can fail on its own, and a failure there would leave an
	// untitled or half-built form in the list while the caller reports that nothing was
	// created. Remove it again so the error is true; if that removal fails as well, the
	// original error is still the one worth reporting.
	try {
		await axios.patch(
			generateOcsUrl('apps/forms/api/v3/forms/{id}', { id: form.id }),
			{ keyValuePairs },
		)

		for (const question of template.questions) {
			await addQuestion(form.id, question)
		}
	} catch (error) {
		await axios
			.delete(generateOcsUrl('apps/forms/api/v3/forms/{id}', { id: form.id }))
			.catch(() => {})
		throw error
	}

	// The form was created empty and named afterwards, so give back the named one: the
	// list of forms shows what it is called without waiting for a reload.
	return { ...form, ...keyValuePairs }
}

/**
 * @param {number} formId the form being built
 * @param {object} question one question of a template
 */
async function addQuestion(formId, question) {
	const created = OcsResponse2Data(
		await axios.post(
			generateOcsUrl('apps/forms/api/v3/forms/{id}/questions', { id: formId }),
			{ type: question.type, text: question.text },
		),
	)

	let options = []
	if (question.options?.length) {
		options = OcsResponse2Data(
			await axios.post(
				generateOcsUrl(
					'apps/forms/api/v3/forms/{id}/questions/{questionId}/options',
					{ id: formId, questionId: created.id },
				),
				{ optionTexts: question.options },
			),
		)
	}

	const extraSettings = { ...(question.extraSettings ?? {}) }
	if (question.correctOptionIndexes?.length && options.length) {
		const key = question.correctOptionIndexes
			.map((index) => options[index]?.id)
			.filter((id) => id !== undefined)
		if (key.length) {
			extraSettings.correctOptions = key
		}
	}

	const keyValuePairs = {}
	if (question.isRequired) {
		keyValuePairs.isRequired = true
	}
	if (Object.keys(extraSettings).length) {
		keyValuePairs.extraSettings = extraSettings
	}
	if (Object.keys(keyValuePairs).length) {
		await axios.patch(
			generateOcsUrl('apps/forms/api/v3/forms/{id}/questions/{questionId}', {
				id: formId,
				questionId: created.id,
			}),
			{ keyValuePairs },
		)
	}
}
