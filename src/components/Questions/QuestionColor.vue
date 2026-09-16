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
		<div
			class="question__content"
			role="group"
			:aria-labelledby="titleId"
			:aria-describedby="description ? descriptionId : undefined">
			<!-- The state goes on the trigger button: attributes bound on the picker
			     itself end up on its popover wrapper, where nothing announces them. -->
			<NcColorPicker
				:modelValue="pickedColor"
				advancedFields
				@update:modelValue="onUpdatePickedColor">
				<NcButton
					:disabled="!readOnly"
					:aria-invalid="hasError ? 'true' : undefined"
					:aria-errormessage="hasError ? errorId : undefined"
					:aria-describedby="buttonDescribedBy">
					{{ colorPickerPlaceholder }}
				</NcButton>
			</NcColorPicker>
			<div :style="{ 'background-color': pickedColor }" class="color__field">
				<NcButton
					v-if="pickedColor !== '' && !isRequired"
					class="color__field__button"
					:aria-label="t('forms', 'Clear selected color')"
					variant="tertiary"
					@click="onUpdatePickedColor('')">
					<template #icon>
						<NcIconSvgWrapper :svg="IconClose" />
					</template>
				</NcButton>
			</div>
			<!-- The chosen value in words as well, so the answer is not given by colour
			     alone and a pick close to the background stays readable. -->
			<bdi v-if="pickedColor" :id="valueId" dir="ltr" class="color__value">
				{{ pickedColor }}
			</bdi>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconClose from '@material-symbols/svg-400/outlined/close.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcColorPicker from '@nextcloud/vue/components/NcColorPicker'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'

export default {
	name: 'QuestionColor',

	components: {
		NcIconSvgWrapper,
		NcButton,
		NcColorPicker,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconClose,
		}
	},

	data() {
		return {
			isLoading: false,
		}
	},

	computed: {
		colorPickerPlaceholder() {
			return this.readOnly
				? this.answerType.submitPlaceholder
				: this.answerType.createPlaceholder
		},

		pickedColor() {
			return this.values[0] ?? ''
		},

		valueId() {
			return this.ownElementIdPrefix + '_color_value'
		},

		buttonDescribedBy() {
			const ids = []
			if (this.pickedColor) {
				ids.push(this.valueId)
			}
			if (this.hasError) {
				ids.push(this.errorId)
			}
			return ids.length > 0 ? ids.join(' ') : undefined
		},
	},

	methods: {
		async validate() {
			if (this.isRequired && this.pickedColor === '') {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			this.errorMessage = null
			return true
		},

		onUpdatePickedColor(color) {
			this.$emit('update:values', [color])
			// Clear an error left by a failed submit once a colour is picked. validate()
			// reads the `values` prop, which changes only after the parent has re-rendered.
			this.revalidateIfInvalid()
		},
	},
}
</script>

<style lang="scss" scoped>
.question__content {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--clickable-area-small);
}

.color__field {
	width: 100px;
	height: var(--default-clickable-area);
	border: 1px solid var(--color-border-maxcontrast);
	border-radius: var(--border-radius-element);

	&__button {
		position: relative;
		margin-inline-start: calc(100% - var(--default-clickable-area));
		// A tertiary button is see-through, and its icon would vanish on a picked
		// colour close to the text colour; give it a ground of its own.
		background-color: var(--color-main-background) !important;
		border-radius: 50% !important;
		box-shadow: 0 0 0 1px var(--color-border-maxcontrast);

		// The ground above would otherwise hide the button's own hover feedback.
		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover) !important;
		}
	}
}

.color__value {
	font-family: var(--font-face-monospace, monospace);
	text-transform: uppercase;
}
</style>
