import axios from '@nextcloud/axios'
/**
 * SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { showError } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { generateOcsUrl } from '@nextcloud/router'
import debounce from 'debounce'
import Question from '../components/Questions/Question.vue'
import { INPUT_DEBOUNCE_MS, OptionType } from '../models/Constants.ts'
import logger from '../utils/Logger.js'
import OcsResponse2Data from '../utils/OcsResponse2Data.js'

/**
 * Debounce a handler so it can be called both as `this.handler()` and as a bare
 * event listener. The debounce library remembers the `this` of the first call and
 * throws when a later call in the same wait brings a different one, which a mix
 * of method calls and listener calls would do.
 *
 * @param {(...args: unknown[]) => void} handler the function to debounce, not relying on `this`
 * @return {(...args: unknown[]) => void} the debounced function, with `clear` and `flush`
 */
function debounceUnbound(handler) {
	const debounced = debounce(handler, INPUT_DEBOUNCE_MS)
	const unbound = (...args) => debounced(...args)
	unbound.clear = debounced.clear
	unbound.flush = debounced.flush
	return unbound
}

export default {
	inheritAttrs: false,

	emits: [
		'update:text',
		'update:description',
		'update:isRequired',
		'update:extraSettings',
		'update:name',
		'update:values',
		'delete',
		'clone',
		'keydown',
		'moveDown',
		'moveUp',
	],

	props: {
		/**
		 * Question-Id
		 */
		id: {
			type: Number,
			required: true,
		},

		/**
		 * ID of the form
		 */
		formId: {
			type: Number,
			default: null,
		},

		/**
		 * The question title
		 */
		text: {
			type: String,
			required: true,
		},

		/**
		 * Question Description
		 */
		description: {
			type: String,
			required: true,
		},

		/**
		 * Whether this question is a trigger for a conditional
		 */
		isTriggerQuestion: {
			type: Boolean,
			required: false,
		},

		/**
		 * Required-Setting
		 */
		isRequired: {
			type: Boolean,
			required: true,
		},

		/**
		 * The index of the question
		 */
		index: {
			type: Number,
			required: true,
		},

		/**
		 * The number announced for the question, when it differs from `index`
		 * (for example when display-only blocks are not counted). Forwarded to
		 * Question through questionProps.
		 */
		displayNumber: {
			type: Number,
			default: null,
		},

		/**
		 * Heading level of the respondent's title, forwarded to Question
		 */
		headingLevel: {
			type: Number,
			default: 3,
		},

		/**
		 * Technical name
		 */
		name: {
			type: String,
			default: '',
		},

		/**
		 * The user answers
		 */
		values: {
			type: [Array, Object],
			default() {
				return []
			},
		},

		/**
		 * The question list of answers
		 */
		options: {
			type: Array,
			required: true,
		},

		/**
		 * Order of the question
		 */
		order: {
			type: Number,
			default: -1,
		},

		/**
		 * Question type
		 */
		type: {
			type: String,
			default: null,
		},

		/**
		 * Answer type model object
		 */
		answerType: {
			type: Object,
			required: true,
		},

		/**
		 * Submission or Edit-Mode
		 */
		readOnly: {
			type: Boolean,
			default: false,
		},

		/**
		 * Database-Restrictions
		 */
		maxStringLengths: {
			type: Object,
			required: true,
		},

		/**
		 * Extra settings
		 */
		extraSettings: {
			default: () => {
				return {}
			},
		},

		/**
		 * Mime-Types and file extensions that are allowed to be uploaded
		 */
		accept: {
			type: Array,
			default() {
				return []
			},
		},

		/**
		 * Can question be moved up in order?
		 */
		canMoveUp: {
			type: Boolean,
			default: false,
		},

		/**
		 * Can question be moved down in order?
		 */
		canMoveDown: {
			type: Boolean,
			default: false,
		},

		/**
		 * Whether this question is a trigger for a conditional
		 */
		isTrigger: {
			type: Boolean,
			default: false,
		},
	},

	components: {
		Question,
	},

	data() {
		return {
			/**
			 * The shown error message
			 */
			errorMessage: null,

			// The debounced save handlers below are built per instance in created().
			// Defined once in `methods`, a debounced function is shared by every
			// question: one timer and one remembered `this`, and the debounce library
			// throws when a second question calls it before the first one's timer ran,
			// so that question's change was never saved.

			/** Forward the title change to the parent and store to db */
			onTitleChange: null,
			/** Forward the description change to the parent and store to db */
			onDescriptionChange: null,
			/** Forward the required change to the parent and store to db */
			onRequiredChange: null,
			/**
			 * Forward changed extra settings to the parent and store to db; takes an
			 * object containing only the *changed* settings.
			 */
			onExtraSettingsChange: null,
			/** Forward the technical-name change to the parent and store to db */
			onNameChange: null,
		}
	},

	created() {
		this.onTitleChange = debounceUnbound((text) => {
			this.$emit('update:text', text)
			this.saveQuestionProperty('text', text)
		})

		this.onDescriptionChange = debounceUnbound((description) => {
			this.$emit('update:description', description)
			this.saveQuestionProperty('description', description)
		})

		this.onRequiredChange = debounceUnbound((isRequiredValue) => {
			this.$emit('update:isRequired', isRequiredValue)
			this.saveQuestionProperty('isRequired', isRequiredValue)
		})

		this.onExtraSettingsChange = debounceUnbound((newSettings) => {
			const newExtraSettings = { ...this.extraSettings, ...newSettings }
			this.$emit('update:extraSettings', newExtraSettings)
			if (!this.isTriggerQuestion) {
				this.saveQuestionProperty('extraSettings', newExtraSettings)
			}
		})

		this.onNameChange = debounceUnbound((name) => {
			this.$emit('update:name', name)
			this.saveQuestionProperty('name', name)
		})
	},

	computed: {
		questionProps() {
			const props = { ...this.$props }
			const allowedKeys = Object.keys(Question.props)
			Object.keys(props).forEach((key) => {
				if (!allowedKeys.includes(key)) {
					delete props[key]
				}
			})
			return props
		},

		titleId() {
			return 'q' + this.index + '_title'
		},

		descriptionId() {
			return 'q' + this.index + '_desc'
		},

		hasError() {
			return !!this.errorMessage
		},

		hasInfo() {
			return !!this.infoMessage
		},

		errorId() {
			return `q${this.index}_error`
		},

		infoId() {
			return `q${this.index}_info`
		},

		/**
		 * Listeners for all questions to forward
		 */
		commonListeners() {
			return {
				clone: this.onClone,
				delete: this.onDelete,
				'update:text': this.onTitleChange,
				'update:description': this.onDescriptionChange,
				'update:isRequired': this.onRequiredChange,
				// the Logic dialog lives in Question.vue, which has no save path of its
				// own; route its changes through the mixin's normal extraSettings save.
				'update:extraSettings': this.onExtraSettingsChange,
				'update:name': this.onNameChange,
				moveDown: (...args) => this.$emit('moveDown', ...args),
				moveUp: (...args) => this.$emit('moveUp', ...args),
			}
		},
	},

	methods: {
		/**
		 * Override to allow custom validation
		 */
		async validate() {
			return true
		},

		/**
		 * Forward the required change to the parent and store to db
		 *
		 * @param {boolean} shuffle Should options be shuffled
		 */
		onShuffleOptionsChange(shuffle) {
			return this.onExtraSettingsChange({ shuffleOptions: shuffle })
		},

		/**
		 * Forward the answer(s) change to the parent
		 *
		 * @param {Array} values the array of answers
		 */
		onValuesChange(values) {
			this.$emit('update:values', values)
		},

		/**
		 * Delete this question
		 */
		onDelete() {
			this.$emit('delete')
		},

		/**
		 * Clone this question.
		 */
		onClone() {
			this.$emit('clone')
		},

		/**
		 * Don't automatically submit form on Enter, parent will handle that
		 * To be called with prevent: @keydown.enter.prevent="onKeydownEnter"
		 *
		 * @param {object} event The fired event
		 */
		onKeydownEnter(event) {
			this.$emit('keydown', event)
		},

		/**
		 * Focus the first focusable element
		 */
		focus() {
			this.$el.scrollIntoView({ behavior: 'smooth' })
			this.$nextTick(() => {
				const title = this.$el.querySelector(
					'.question__header__title__text__input',
				)
				if (title) {
					title.focus()
				}
			})
		},

		/**
		 * Shuffle an array using Fisher-Yates
		 *
		 * @param {Array} input Input array to shuffle
		 * @return {Array} Shuffled input array
		 */
		shuffleArray(input) {
			const shuffled = [...input]
			let idx = shuffled.length
			while (--idx > 0) {
				const rndIdx = Math.floor(Math.random() * (idx + 1))
				;[shuffled[rndIdx], shuffled[idx]] = [
					shuffled[idx],
					shuffled[rndIdx],
				]
			}
			return shuffled
		},

		async saveQuestionProperty(key, value) {
			try {
				// TODO: add loading status feedback ?
				await axios.patch(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/questions/{questionId}',
						{
							id: this.formId,
							questionId: this.id,
						},
					),
					{
						keyValuePairs: {
							[key]: value,
						},
					},
				)
				emit('forms:last-updated:set', this.formId)
			} catch (error) {
				logger.error('Error while saving question', { error })
				showError(t('forms', 'Error while saving question'))
			}
		},

		/**
		 * Handles multiple options for a question.
		 *
		 * @param {Array<string>} answers - The array of answers for the question.
		 */
		async handleMultipleOptions(answers) {
			this.isLoading = true
			try {
				const response = await axios.post(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/questions/{questionId}/options',
						{
							id: this.formId,
							questionId: this.id,
						},
					),
					{
						optionTexts: answers,
						optionType: OptionType.Choice,
					},
				)
				const newServerOptions = OcsResponse2Data(response) // Assuming this function can handle arrays
				const options = this.options.slice()
				newServerOptions.forEach((option) => {
					options.push({
						id: option.id, // Use the ID from the server
						questionId: this.id,
						text: option.text,
						optionType: option.optionType,
						local: false,
					})
				})
				this.updateOptions(options)
				this.$nextTick(() => {
					this.focusIndex(options.length - 1)
				})
			} catch (error) {
				logger.error('Error while saving question options', { error })
				showError(t('forms', 'Error while saving question options'))
			}
			this.isLoading = false
		},
	},
}
