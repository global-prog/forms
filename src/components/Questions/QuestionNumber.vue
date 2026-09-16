<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  a first-class Number question.

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
				@input="onInput"
				@change="validate"
				@keydown.enter.exact.prevent="onKeydownEnter" />
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
import { translate as t } from '@nextcloud/l10n'
import debounce from 'debounce'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import { INPUT_DEBOUNCE_MS } from '../../models/Constants.ts'

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

	data() {
		return {
			/** per-instance debounced validate, created in created() */
			debounceValidate: null,
		}
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
			// Bounds are isolated as left-to-right runs, so a negative bound keeps its
			// minus sign in front of the digits inside a right-to-left sentence.
			const isolate = (value) => '\u2066' + value + '\u2069'
			const min =
				this.numberMin === undefined ? undefined : isolate(this.numberMin)
			const max =
				this.numberMax === undefined ? undefined : isolate(this.numberMax)
			// Whole sentences per case rather than two joined ones: a translation of the
			// first half need not end in a way the second half can follow.
			if (this.numberInteger) {
				if (min !== undefined && max !== undefined) {
					return t(
						'forms',
						'Enter a whole number between {min} and {max}',
						{ min, max },
					)
				}
				if (min !== undefined) {
					return t('forms', 'Enter a whole number of at least {min}', {
						min,
					})
				}
				if (max !== undefined) {
					return t('forms', 'Enter a whole number of at most {max}', {
						max,
					})
				}
				return t('forms', 'Enter a whole number')
			}
			if (min !== undefined && max !== undefined) {
				return t('forms', 'Enter a number between {min} and {max}', {
					min,
					max,
				})
			}
			if (min !== undefined) {
				return t('forms', 'Enter a number of at least {min}', { min })
			}
			if (max !== undefined) {
				return t('forms', 'Enter a number of at most {max}', { max })
			}
			return t('forms', 'Enter a number')
		},
	},

	created() {
		// Built per instance: a debounced function shared through `methods` keeps one
		// timer and one `this` for every question on the page.
		this.debounceValidate = debounce(() => this.validate(), INPUT_DEBOUNCE_MS)
	},

	beforeUnmount() {
		// validate() reads the input element, which is gone once the question has left
		// the page (a page change or a deleted question) before the timer ran.
		this.debounceValidate.clear()
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
			// A partly typed number is often out of range ("1" on the way to "15"), so
			// wait for a pause before complaining. An error already shown is re-checked
			// at once, so it disappears as soon as the value is fixed.
			if (this.errorMessage) {
				this.validate()
			} else {
				this.debounceValidate()
			}
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

<style lang="scss" scoped>
.question__input {
	// Comfortable pointer target, and stops a number field rendering tiny on mobile Safari.
	min-height: 44px;
	width: 100%;

	// The editor shows a preview of the field; keep it looking like the long-answer
	// preview instead of the browser's greyed-out disabled style.
	&:disabled {
		background-color: var(--color-main-background);
		color: var(--color-main-text);
		opacity: 1;
	}
}
</style>
