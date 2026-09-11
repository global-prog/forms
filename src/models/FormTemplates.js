/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { translate as t } from '@nextcloud/l10n'

/*
 * Ready-made forms, so a common form need not be built from an empty page.
 *
 * A template is plain data - a title, a description, some settings and a list of
 * questions - and is applied by creating an ordinary form and its questions through the
 * same API the editor uses, so nothing here can produce a form the editor could not.
 * Every word is translated, so the templates arrive in the language the author works in.
 *
 * Questions name real answer types, not the editor's presets: a phone or an email
 * question is short text with a validation rule, which is what a preset would have made.
 */

/**
 * @return {object[]} the templates, each `{ id, name, summary, form, questions }`
 */
export function formTemplates() {
	return [
		{
			id: 'course-evaluation',
			name: t('forms', 'Course evaluation'),
			summary: t('forms', 'How a course went, from those who took it'),
			form: {
				title: t('forms', 'Course evaluation'),
				description: t(
					'forms',
					'Your answers help improve the course. They take a minute.',
				),
			},
			questions: [
				{
					type: 'short',
					text: t('forms', 'Which course is this about?'),
					isRequired: true,
				},
				{
					type: 'linearscale',
					text: t('forms', 'How clear were the explanations?'),
					extraSettings: {
						optionsLowest: 1,
						optionsHighest: 5,
						optionsLabelLowest: t('forms', 'Not clear'),
						optionsLabelHighest: t('forms', 'Very clear'),
					},
				},
				{
					type: 'linearscale',
					text: t('forms', 'How useful were the materials?'),
					extraSettings: {
						optionsLowest: 1,
						optionsHighest: 5,
						optionsLabelLowest: t('forms', 'Not useful'),
						optionsLabelHighest: t('forms', 'Very useful'),
					},
				},
				{
					type: 'multiple_unique',
					text: t('forms', 'Would you recommend this course to others?'),
					options: [
						t('forms', 'Yes'),
						t('forms', 'Perhaps'),
						t('forms', 'No'),
					],
				},
				{
					type: 'long',
					text: t('forms', 'What would you change?'),
				},
			],
		},
		{
			id: 'event-feedback',
			name: t('forms', 'Event feedback'),
			summary: t('forms', 'What people thought of an event'),
			form: {
				title: t('forms', 'Event feedback'),
				description: t('forms', 'Thank you for coming. How was it?'),
			},
			questions: [
				{
					type: 'rating',
					text: t('forms', 'How would you rate the event?'),
					extraSettings: { maxRating: 5 },
				},
				{
					type: 'multiple',
					text: t('forms', 'Which parts did you attend?'),
					options: [
						t('forms', 'Opening'),
						t('forms', 'Talks'),
						t('forms', 'Workshops'),
						t('forms', 'Closing'),
					],
				},
				{
					type: 'multiple_unique',
					text: t('forms', 'Was the length about right?'),
					options: [
						t('forms', 'Too short'),
						t('forms', 'About right'),
						t('forms', 'Too long'),
					],
				},
				{
					type: 'long',
					text: t('forms', 'What should we do differently next time?'),
				},
			],
		},
		{
			id: 'registration',
			name: t('forms', 'Registration'),
			summary: t('forms', 'Sign people up, with their details'),
			form: {
				title: t('forms', 'Registration'),
				description: t('forms', 'Please register by filling in this form.'),
			},
			questions: [
				{
					type: 'short',
					text: t('forms', 'Full name'),
					isRequired: true,
				},
				{
					type: 'short',
					text: t('forms', 'Email address'),
					isRequired: true,
					extraSettings: { validationType: 'email' },
				},
				{
					type: 'short',
					text: t('forms', 'Phone number'),
					extraSettings: { validationType: 'phone' },
				},
				{
					type: 'dropdown',
					text: t('forms', 'Which session would you like to attend?'),
					isRequired: true,
					options: [
						t('forms', 'Morning'),
						t('forms', 'Afternoon'),
						t('forms', 'Evening'),
					],
				},
				{
					type: 'long',
					text: t('forms', 'Anything we should know?'),
				},
			],
		},
		{
			id: 'satisfaction',
			name: t('forms', 'Satisfaction survey'),
			summary: t(
				'forms',
				'How satisfied people are, and how likely to recommend',
			),
			form: {
				title: t('forms', 'Satisfaction survey'),
				description: t('forms', 'Tell us how we are doing.'),
			},
			questions: [
				{
					type: 'linearscale',
					text: t('forms', 'How likely are you to recommend us?'),
					extraSettings: {
						optionsLowest: 0,
						optionsHighest: 10,
						optionsLabelLowest: t('forms', 'Not at all likely'),
						optionsLabelHighest: t('forms', 'Extremely likely'),
					},
				},
				{
					type: 'rating',
					text: t('forms', 'How satisfied are you with the service?'),
					extraSettings: { maxRating: 5 },
				},
				{
					type: 'multiple_unique',
					text: t('forms', 'Did you get what you came for?'),
					options: [
						t('forms', 'Yes'),
						t('forms', 'Partly'),
						t('forms', 'No'),
					],
				},
				{
					type: 'long',
					text: t('forms', 'What would you like to tell us?'),
				},
			],
		},
		{
			id: 'quiz',
			name: t('forms', 'Quiz'),
			summary: t(
				'forms',
				'Questions with an answer key, graded as they arrive',
			),
			form: {
				title: t('forms', 'Quiz'),
				description: t(
					'forms',
					'Answer every question. Your score is shown when you submit.',
				),
				settings: { quizMode: true },
			},
			questions: [
				{
					type: 'multiple_unique',
					text: t('forms', 'Sample question: which of these is correct?'),
					options: [
						t('forms', 'The right answer'),
						t('forms', 'A wrong answer'),
						t('forms', 'Another wrong answer'),
					],
					// The key names options by position; the ids are known only once the
					// options exist, so it is filled in as the form is built.
					correctOptionIndexes: [0],
					extraSettings: {
						points: 1,
						feedbackCorrect: t('forms', 'Correct.'),
						feedbackIncorrect: t('forms', 'Not quite.'),
					},
				},
				{
					type: 'multiple',
					text: t(
						'forms',
						'Sample question: choose every correct answer.',
					),
					options: [
						t('forms', 'Correct'),
						t('forms', 'Also correct'),
						t('forms', 'Incorrect'),
					],
					correctOptionIndexes: [0, 1],
					extraSettings: { points: 2 },
				},
				{
					type: 'short',
					text: t('forms', 'Sample question: type the word "forms".'),
					extraSettings: { points: 1, correctAnswer: 'forms' },
				},
			],
		},
	]
}
