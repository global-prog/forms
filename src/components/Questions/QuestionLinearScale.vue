<!--
  - SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
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
		<template #actions>
			<NcActionInput
				:modelValue="optionsLowest"
				type="multiselect"
				:clearable="false"
				:label="t('forms', 'Lowest value')"
				labelOutside
				:options="[0, 1]"
				required
				@update:modelValue="onOptionsLowestChange">
				<template #icon>
					<NcIconSvgWrapper :svg="IconPencil" />
				</template>
			</NcActionInput>
			<NcActionInput
				:modelValue="optionsHighest"
				type="multiselect"
				:clearable="false"
				:label="t('forms', 'Highest value')"
				labelOutside
				:options="[2, 3, 4, 5, 6, 7, 8, 9, 10]"
				required
				@update:modelValue="onOptionsHighestChange">
				<template #icon>
					<NcIconSvgWrapper :svg="IconPencil" />
				</template>
			</NcActionInput>
		</template>

		<div
			class="question__content question-linear-scale"
			:class="{
				question__content__edit: !readOnly,
			}">
			<NcTextArea
				v-if="!readOnly"
				ref="lowest"
				:modelValue="optionsLabelLowest"
				class="question-linear-scale__label-input"
				:label="t('forms', 'Label for lowest value')"
				:placeholder="t('forms', 'Label (optional)')"
				resize="none"
				@input="resizeLabel('lowest')"
				@blur="onBlur('lowest')"
				@update:modelValue="onOptionsLabelLowestChange" />
			<div
				v-else-if="optionsLabelLowest !== ''"
				:id="labelId"
				class="question-linear-scale__label question-linear-scale__label-lowest">
				{{ optionsLabelLowest }}
			</div>
			<!-- The group is named by the question title. Each end label describes the
			     radio at its own end instead of a legend, which the title would override. -->
			<fieldset
				class="question-linear-scale__options"
				:aria-labelledby="titleId"
				:aria-describedby="description ? descriptionId : undefined">
				<div
					v-for="(option, index) in scaleOptions"
					:key="option"
					class="question-linear-scale__option">
					<label :for="`linear-scale-${id}-${option}`">{{ option }}</label>
					<NcCheckboxRadioSwitch
						:id="`linear-scale-${id}-${option}`"
						:aria-describedby="optionDescribedBy(index)"
						:aria-errormessage="hasError ? errorId : undefined"
						:aria-invalid="hasError ? 'true' : undefined"
						:disabled="!readOnly"
						:modelValue="questionValues"
						:value="option.toString()"
						:name="`${id}-answer`"
						type="radio"
						:required="isRequired"
						@invalid.prevent="validate"
						@update:modelValue="onChange"
						@keydown.enter.exact.prevent="onKeydownEnter" />
				</div>
			</fieldset>
			<NcTextArea
				v-if="!readOnly"
				ref="highest"
				:modelValue="optionsLabelHighest"
				class="question-linear-scale__label-input"
				:label="t('forms', 'Label for highest value')"
				:placeholder="t('forms', 'Label (optional)')"
				resize="none"
				@input="resizeLabel('highest')"
				@blur="onBlur('highest')"
				@update:modelValue="onOptionsLabelHighestChange" />
			<div
				v-else-if="optionsLabelHighest !== ''"
				:id="labelIdHighest"
				class="question-linear-scale__label question-linear-scale__label-highest">
				{{ optionsLabelHighest }}
			</div>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconPencil from '@material-symbols/svg-400/outlined/edit.svg?raw'
import { t } from '@nextcloud/l10n'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcTextArea from '@nextcloud/vue/components/NcTextArea'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'

export default {
	name: 'QuestionLinearScale',

	components: {
		NcIconSvgWrapper,
		NcActionInput,
		NcCheckboxRadioSwitch,
		NcTextArea,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconPencil,
		}
	},

	data() {
		return {
			isLoading: false,
		}
	},

	computed: {
		scaleOptions() {
			return Array.from(
				{ length: this.optionsHighest - this.optionsLowest + 1 },
				(_, i) => i + this.optionsLowest,
			)
		},

		isUnique() {
			return this.answerType.unique === true
		},

		questionValues() {
			return this.values
		},

		/**
		 * ID for the label for the lowest option
		 */
		labelId() {
			return 'q' + this.index + '__label_lowest'
		},

		/**
		 * ID for the label for the highest option
		 */
		labelIdHighest() {
			return 'q' + this.index + '__label_highest'
		},

		optionsLowest() {
			return this.extraSettings?.optionsLowest ?? 1
		},

		optionsHighest() {
			return this.extraSettings?.optionsHighest ?? 5
		},

		optionsLabelLowest() {
			return (
				this.extraSettings?.optionsLabelLowest
				?? t('forms', 'Strongly disagree')
			)
		},

		optionsLabelHighest() {
			return (
				this.extraSettings?.optionsLabelHighest
				?? t('forms', 'Strongly agree')
			)
		},
	},

	mounted() {
		if (!this.readOnly) {
			this.resizeLabel('lowest')
			this.resizeLabel('highest')
		}
	},

	methods: {
		async validate() {
			if (this.isRequired && this.values.length === 0) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			this.errorMessage = null
			return true
		},

		onChange(option) {
			this.$emit('update:values', [option])
		},

		/**
		 * @param {number} index position of the option on the scale
		 * @return {string|undefined} id of the end label that describes this option
		 */
		optionDescribedBy(index) {
			// The labels are only rendered for respondents, and only when not empty.
			if (!this.readOnly) {
				return undefined
			}
			if (index === 0 && this.optionsLabelLowest !== '') {
				return this.labelId
			}
			if (
				index === this.scaleOptions.length - 1
				&& this.optionsLabelHighest !== ''
			) {
				return this.labelIdHighest
			}
			return undefined
		},

		onOptionsLowestChange(value) {
			this.onExtraSettingsChange({ optionsLowest: value === 1 ? null : value })
		},

		onOptionsHighestChange(value) {
			this.onExtraSettingsChange({
				optionsHighest: value === 5 ? null : value,
			})
		},

		onOptionsLabelLowestChange(value) {
			this.onExtraSettingsChange({
				optionsLabelLowest:
					value === t('forms', 'Strongly disagree') ? null : value,
			})
		},

		onOptionsLabelHighestChange(value) {
			this.onExtraSettingsChange({
				optionsLabelHighest:
					value === t('forms', 'Strongly agree') ? null : value,
			})
		},

		/**
		 * Resizes the given label to fit within the specified constraints.
		 *
		 * @param {string} label - The label identifier, either 'lowest' or 'highest', indicating which label to resize.
		 */
		resizeLabel(label) {
			let textarea
			if (label === 'lowest') {
				textarea = this.$refs.lowest.$refs.input
			} else if (label === 'highest') {
				textarea = this.$refs.highest.$refs.input
			}
			// next tick ensures that the textarea is attached to DOM
			this.$nextTick(() => {
				if (textarea) {
					textarea.style.cssText = 'height: 0'
					// include 2px border
					textarea.style.cssText = `height: ${textarea.scrollHeight + 4}px; resize: none;`
				}
			})
		},

		/**
		 * Handles the blur event for a label input.
		 *
		 * @param {string} label - The label that is being blurred.
		 *                         It can be either 'lowest' or 'highest' indicating
		 *                         which label input (lowest value or highest value) triggered the blur event.
		 */
		onBlur(label) {
			// The computed labels follow the extraSettings prop, which only updates once the
			// debounced save fires, so tidy what is in the textarea right now. Otherwise a
			// quick blur tidies the previous text and that save replaces the pending one.
			// The tidied text goes through the same handlers as typing, and only when it
			// actually changed.
			const textarea = this.$refs[label]?.$refs?.input
			if (textarea) {
				const typed = textarea.value
				const cleaned = typed.replace(/[\r\n]+/g, ' ').trim()
				if (cleaned !== typed) {
					if (label === 'lowest') {
						this.onOptionsLabelLowestChange(cleaned)
					} else if (label === 'highest') {
						this.onOptionsLabelHighestChange(cleaned)
					}
				}
			}
			this.resizeLabel(label)
		},
	},
}
</script>

<style lang="scss" scoped>
.question__content {
	display: flex;

	@media (max-width: 768px) {
		flex-wrap: wrap; // Allow wrapping for smaller screens
	}

	&__edit {
		margin-inline-start: -12px;

		@media (max-width: 768px) {
			margin-inline-end: calc(var(--clickable-area-large) - 2px);
		}
	}

	.question-linear-scale {
		&__label {
			width: 120px;
			align-self: center;
			flex-shrink: 0;

			&-lowest {
				text-align: start;
			}

			&-highest {
				text-align: end;

				@media (max-width: 768px) {
					text-align: start;
				}
			}

			@media (max-width: 768px) {
				width: 100%; // Full width on smaller screens
				padding-block: var(--default-grid-baseline);
			}
		}

		&__label-input {
			width: 120px;
			align-self: center;
			min-height: fit-content;
			flex-shrink: 0;

			@media (max-width: 768px) {
				width: 100%; // Full width on smaller screens
				padding-block: var(--default-grid-baseline);
			}
		}

		&__options {
			width: 100%;
			display: flex;
			flex-direction: row;
			align-items: center;
			justify-content: space-evenly;
			flex-grow: 1;

			@media (max-width: 768px) {
				flex-direction: column; // Stack options vertically on smaller screens
				align-items: flex-start; // Align items to the left
			}
		}

		&__option {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;

			// The number is a label for its own radio, so it selects when clicked - but
			// it was only as wide as the digit, leaving a dead gutter between one option
			// and the next. Stretched across the column, the whole thing is live and the
			// target clears the 24px minimum in both directions.
			label {
				align-self: stretch;
				text-align: center;
			}

			@media (max-width: 768px) {
				flex-direction: row-reverse;
			}
		}
	}
}
</style>
