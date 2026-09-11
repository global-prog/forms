<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<Question
		v-bind="questionProps"
		:titlePlaceholder="answerType.titlePlaceholder"
		:warningInvalid="answerType.warningInvalid"
		:errorMessage="errorMessage"
		:isTriggerQuestion="isTriggerQuestion"
		v-on="commonListeners">
		<div class="question__content">
			<!-- A respondent's answer takes the direction of whatever they type. In the
			     editor the field is only a preview holding the interface's placeholder,
			     and it follows the form's direction instead: the input-type button sits on
			     the form's end edge, and a placeholder free to run the other way began
			     underneath it. -->
			<input
				ref="input"
				:aria-labelledby="titleId"
				:aria-describedby="description ? descriptionId : undefined"
				:aria-errormessage="hasError ? errorId : undefined"
				:aria-invalid="hasError ? 'true' : undefined"
				:placeholder="submissionInputPlaceholder"
				:disabled="!readOnly"
				:name="name || undefined"
				:required="isRequired"
				:value="values[0]"
				class="question__input"
				:dir="readOnly ? 'auto' : undefined"
				:maxlength="maxStringLengths.answerText"
				minlength="1"
				:type="validationObject.inputType"
				:min="isNumber ? numberMin : undefined"
				:max="isNumber ? numberMax : undefined"
				:step="isNumber ? (numberInteger ? 1 : 'any') : undefined"
				@invalid.prevent="validate"
				@input="onInput"
				@keydown.enter.exact.prevent="onKeydownEnter" />
			<NcActions
				v-if="!readOnly"
				:id="validationTypeMenuId"
				v-model:open="isValidationTypeMenuOpen"
				:aria-label="
					t('forms', 'Input types (currently: {type})', {
						type: validationObject.label,
					})
				"
				:container="`#${validationTypeMenuId}`"
				class="validation-type-menu__toggle"
				variant="tertiary-no-background">
				<template #icon>
					<NcIconSvgWrapper :svg="validationObject.icon" />
				</template>
				<NcActionRadio
					v-for="(
						validationTypeObject, validationTypeName
					) in validationTypes"
					:key="validationTypeName"
					:modelValue="validationType"
					:name="`${id}_validationMenu`"
					:value="validationTypeName"
					@update:modelValue="onChangeValidationType(validationTypeName)">
					{{ validationTypeObject.label }}
				</NcActionRadio>
				<NcActionInput
					v-if="validationType === 'regex'"
					ref="regexInput"
					:label="t('forms', 'Regular expression for input validation')"
					:modelValue="validationRegex"
					@input="onInputRegex"
					@submit="onSubmitRegex">
					<template #icon>
						<NcIconSvgWrapper :svg="IconRegex" />
					</template>
					/^[a-z]{3}$/i
					<!-- ^ Some example RegExp for the placeholder text -->
				</NcActionInput>
				<!-- numeric constraints, shown only for the number input type -->
				<NcActionInput
					v-if="isNumber"
					type="number"
					:label="t('forms', 'Minimum value')"
					:modelValue="numberMin ?? ''"
					@submit="onChangeNumberBound('numberMin', $event)"
					@input="onChangeNumberBound('numberMin', $event)">
					<template #icon>
						<NcIconSvgWrapper :svg="IconNumeric" />
					</template>
					{{ t('forms', 'No minimum') }}
				</NcActionInput>
				<NcActionInput
					v-if="isNumber"
					type="number"
					:label="t('forms', 'Maximum value')"
					:modelValue="numberMax ?? ''"
					@submit="onChangeNumberBound('numberMax', $event)"
					@input="onChangeNumberBound('numberMax', $event)">
					<template #icon>
						<NcIconSvgWrapper :svg="IconNumeric" />
					</template>
					{{ t('forms', 'No maximum') }}
				</NcActionInput>
				<NcActionCheckbox
					v-if="isNumber"
					:modelValue="numberInteger"
					@update:modelValue="onChangeNumberInteger">
					{{ t('forms', 'Whole numbers only') }}
				</NcActionCheckbox>
			</NcActions>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconNumeric from '@material-symbols/svg-400/outlined/123.svg?raw'
import IconRegex from '@material-symbols/svg-400/outlined/regular_expression.svg?raw'
import debounce from 'debounce'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActionRadio from '@nextcloud/vue/components/NcActionRadio'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import { INPUT_DEBOUNCE_MS } from '../../models/Constants.ts'
import validationTypes from '../../models/ValidationTypes.js'
import { splitRegex, validateExpression } from '../../utils/RegularExpression.js'

export default {
	name: 'QuestionShort',

	components: {
		NcIconSvgWrapper,
		NcActions,
		NcActionCheckbox,
		NcActionInput,
		NcActionRadio,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconRegex,
			IconNumeric,
		}
	},

	data() {
		return {
			validationTypes,
			isValidationTypeMenuOpen: false,
		}
	},

	computed: {
		submissionInputPlaceholder() {
			if (!this.readOnly) {
				return (
					this.validationObject.createPlaceholder
					|| this.answerType.createPlaceholder
				)
			}
			return (
				this.validationObject.submitPlaceholder
				|| this.answerType.submitPlaceholder
			)
		},

		/**
		 * Current user input validation type
		 */
		validationObject() {
			return validationTypes[this.validationType]
		},

		/**
		 * Name of the current validation type, fallsback to 'text'
		 */
		validationType() {
			return this.extraSettings?.validationType || 'text'
		},

		/**
		 * Id of the validation type menu
		 */
		validationTypeMenuId() {
			return 'q' + this.index + '__validation_menu'
		},

		/**
		 * The regular expression
		 */
		validationRegex() {
			return this.extraSettings?.validationRegex || ''
		},

		/** numeric-constraint helpers (only meaningful for the number input type) */
		isNumber() {
			return this.validationType === 'number'
		},

		numberMin() {
			const v = this.extraSettings?.numberMin
			return typeof v === 'number' ? v : undefined
		},

		numberMax() {
			const v = this.extraSettings?.numberMax
			return typeof v === 'number' ? v : undefined
		},

		numberInteger() {
			return this.extraSettings?.numberInteger === true
		},

		/**
		 * A message that states the actual constraint, rather than just
		 * "the input is not a valid number".
		 */
		numberErrorMessage() {
			const min = this.numberMin
			const max = this.numberMax
			let msg
			if (min !== undefined && max !== undefined) {
				msg = t('forms', 'Enter a number between {min} and {max}', {
					min,
					max,
				})
			} else if (min !== undefined) {
				msg = t('forms', 'Enter a number of at least {min}', { min })
			} else if (max !== undefined) {
				msg = t('forms', 'Enter a number of at most {max}', { max })
			} else {
				msg = this.validationObject.errorMessage
			}
			if (this.numberInteger) {
				msg += ' ' + t('forms', 'Whole numbers only.')
			}
			return msg
		},
	},

	methods: {
		/**
		 * store a numeric bound, or clear it when the field is emptied.
		 *
		 * @param {string} key either 'numberMin' or 'numberMax'
		 * @param {Event} event the input/submit event
		 */
		onChangeNumberBound(key, event) {
			const raw = event?.target?.value ?? ''
			const value =
				raw === '' || isNaN(parseFloat(raw)) ? undefined : parseFloat(raw)
			this.onExtraSettingsChange({ [key]: value })
		},

		/**
		 * toggle whole-numbers-only.
		 *
		 * @param {boolean} checked new state
		 */
		onChangeNumberInteger(checked) {
			this.onExtraSettingsChange({
				numberInteger: checked === true ? true : undefined,
			})
		},

		async validate() {
			/** @type {HTMLInputElement} */
			const input = this.$refs.input
			const value = input.value

			// Clear the previous custom error before checking native validity.
			input.setCustomValidity('')

			if (this.isRequired && input.validity.valueMissing) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			const isCustomValid =
				!value
				|| this.validationObject.validate(
					value,
					splitRegex(this.validationRegex),
				)

			if (!input.validity.valid || !isCustomValid) {
				// for numbers, say what the allowed range actually is. The browser
				// already enforces min/max/step via the native attributes, so an out-of-range
				// value lands here with validity.valid === false.
				const message = this.isNumber
					? this.numberErrorMessage
					: this.validationObject.errorMessage
				input.setCustomValidity(message)
				this.errorMessage = message
				return false
			}

			this.errorMessage = null
			return true
		},

		debounceValidate: debounce(async function () {
			this.validate()
		}, INPUT_DEBOUNCE_MS),

		onInput() {
			/** @type {HTMLInputElement} */
			const input = this.$refs.input
			const value = input.value
			this.$emit('update:values', [value])
			this.debounceValidate()
		},

		/**
		 * Change input type
		 *
		 * @param {string} validationType new input type
		 */
		onChangeValidationType(validationType) {
			if (validationType === 'regex') {
				// Make sure to also submit a regex (even if empty)
				this.onExtraSettingsChange({
					validationType,
					validationRegex: this.validationRegex,
				})
			} else {
				// For all other types except regex we close the menu (for regex we keep it open to allow entering a regex)
				this.isValidationTypeMenuOpen = false
				this.onExtraSettingsChange({
					validationType:
						validationType === 'text' ? undefined : validationType,
				})
			}
		},

		/**
		 * Validate and save regex if valid
		 *
		 * Ensures the regex is enclosed with delimters, as required for PCRE,
		 * and regex is only using modifiers supported by JS *and* PHP
		 *
		 * @param {InputEvent|SubmitEvent} event input event
		 * @return {boolean} true if the regex is valid
		 */
		onInputRegex(event) {
			if (event?.isComposing) {
				return false
			}

			const input = this.$refs.regexInput.$el.querySelector('input')
			const validationRegex = input.value

			// remove potential previous validity
			input.setCustomValidity('')

			if (!validateExpression(validationRegex)) {
				input.setCustomValidity(t('forms', 'Invalid regular expression'))
				return false
			}

			this.onExtraSettingsChange({ validationRegex })
			return true
		},

		/**
		 * Same as `onInputRegex` but for convinience also closes the menu
		 *
		 * @param {SubmitEvent} event regex submit event
		 */
		onSubmitRegex(event) {
			if (this.onInputRegex(event)) {
				this.isValidationTypeMenuOpen = false
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.question__input {
	width: 100%;
	min-height: var(--default-clickable-area);

	&:disabled {
		width: calc(100% - var(--default-clickable-area)) !important;
		margin-inline-start: -12px;
	}
}

.validation-type-menu__toggle {
	position: relative;
	inset-inline-end: calc(4px + var(--default-clickable-area));
	inset-block-start: 4px;
}

:deep(input:invalid) {
	// nextcloud/server#36548
	border-color: var(--color-error) !important;
}
</style>
