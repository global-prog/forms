<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  UOS: a first-class Number question.

  The numeric constraints already existed, but only as a validation mode buried in the
  short-text input-type menu, so nobody could pick "Number" when adding a question. The
  server validates it with the same code path as short-text numbers, so there is one
  implementation of "is this a number, and is it in range".
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
			<input
				ref="input"
				:aria-labelledby="titleId"
				:aria-describedby="description ? descriptionId : undefined"
				:aria-errormessage="hasError ? errorId : undefined"
				:aria-invalid="hasError ? 'true' : undefined"
				class="question__input"
				type="number"
				:min="numberMin"
				:max="numberMax"
				:step="numberInteger ? 1 : 'any'"
				:disabled="!readOnly"
				:name="name || undefined"
				:placeholder="placeholder"
				:required="isRequired"
				:value="values[0]"
				@invalid.prevent="validate"
				@input="onInput" />
			<NcActions
				v-if="!readOnly"
				:aria-label="t('forms', 'Number settings')"
				variant="tertiary-no-background">
				<template #icon>
					<NcIconSvgWrapper :svg="IconNumeric" />
				</template>
				<NcActionInput
					type="number"
					:label="t('forms', 'Minimum value')"
					:modelValue="numberMin ?? ''"
					@submit="onChangeBound('numberMin', $event)"
					@input="onChangeBound('numberMin', $event)">
					<template #icon>
						<NcIconSvgWrapper :svg="IconNumeric" />
					</template>
					{{ t('forms', 'No minimum') }}
				</NcActionInput>
				<NcActionInput
					type="number"
					:label="t('forms', 'Maximum value')"
					:modelValue="numberMax ?? ''"
					@submit="onChangeBound('numberMax', $event)"
					@input="onChangeBound('numberMax', $event)">
					<template #icon>
						<NcIconSvgWrapper :svg="IconNumeric" />
					</template>
					{{ t('forms', 'No maximum') }}
				</NcActionInput>
				<NcActionCheckbox
					:modelValue="numberInteger"
					@update:modelValue="onChangeInteger">
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
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'

export default {
	name: 'QuestionNumber',

	components: {
		NcActionCheckbox,
		NcActionInput,
		NcActions,
		NcIconSvgWrapper,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	setup() {
		return { IconNumeric }
	},

	computed: {
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

		placeholder() {
			return this.readOnly
				? this.answerType.submitPlaceholder
				: this.answerType.createPlaceholder
		},

		/**
		 * State the actual constraint rather than a generic "invalid" message.
		 *
		 * @return {string} the message shown when the value is out of range
		 */
		constraintMessage() {
			const min = this.numberMin
			const max = this.numberMax
			let message
			if (min !== undefined && max !== undefined) {
				message = t('forms', 'Enter a number between {min} and {max}', {
					min,
					max,
				})
			} else if (min !== undefined) {
				message = t('forms', 'Enter a number of at least {min}', { min })
			} else if (max !== undefined) {
				message = t('forms', 'Enter a number of at most {max}', { max })
			} else {
				message = t('forms', 'Enter a number')
			}
			return this.numberInteger
				? message + ' ' + t('forms', 'Whole numbers only.')
				: message
		},
	},

	methods: {
		async validate() {
			const input = this.$refs.input
			input.setCustomValidity('')

			if (this.isRequired && input.validity.valueMissing) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			// The browser enforces min/max/step from the native attributes; the server
			// re-checks them, because a submission can be crafted to bypass the browser.
			if (!input.validity.valid) {
				input.setCustomValidity(this.constraintMessage)
				this.errorMessage = this.constraintMessage
				return false
			}

			this.errorMessage = null
			return true
		},

		onInput() {
			this.$emit('update:values', [this.$refs.input.value])
			this.validate()
		},

		/**
		 * @param {string} key either 'numberMin' or 'numberMax'
		 * @param {Event} event the input/submit event
		 */
		onChangeBound(key, event) {
			const raw = event?.target?.value ?? ''
			const value =
				raw === '' || isNaN(parseFloat(raw)) ? undefined : parseFloat(raw)
			this.onExtraSettingsChange({ [key]: value })
		},

		/**
		 * @param {boolean} checked whole numbers only
		 */
		onChangeInteger(checked) {
			this.onExtraSettingsChange({
				numberInteger: checked === true ? true : undefined,
			})
		},
	},
}
</script>
