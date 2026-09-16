<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<Question
		v-bind="questionProps"
		:titlePlaceholder="answerType.titlePlaceholder"
		:warningInvalid="answerType.warningInvalid"
		:contentValid="contentValid"
		:shiftDragHandle="shiftDragHandle"
		:errorMessage="errorMessage"
		:isTriggerQuestion="isTriggerQuestion"
		v-on="commonListeners">
		<template #actions>
			<NcActionCheckbox
				:modelValue="extraSettings?.shuffleOptions"
				@update:modelValue="onShuffleOptionsChange">
				{{ t('forms', 'Shuffle options') }}
			</NcActionCheckbox>
			<NcActionButton closeAfterClick @click="isOptionDialogShown = true">
				<template #icon>
					<NcIconSvgWrapper :svg="IconContentPaste" />
				</template>
				{{ t('forms', 'Add multiple options') }}
			</NcActionButton>
		</template>
		<div
			v-if="readOnly"
			class="question__content"
			role="group"
			:aria-labelledby="titleId"
			:aria-describedby="description ? descriptionId : undefined">
			<NcSelect
				ref="select"
				:modelValue="selectedOption"
				:name="name || undefined"
				:placeholder="selectOptionPlaceholder"
				:multiple="isMultiple"
				:required="isRequired"
				:options="choices"
				:searchable="false"
				label="text"
				:aria-label-combobox="text || selectOptionPlaceholder"
				@invalid.prevent="validate"
				@update:modelValue="onInput" />
		</div>
		<template v-else>
			<div v-if="isLoading">
				<NcLoadingIcon :size="64" />
			</div>
			<Draggable
				v-else
				v-model="choices"
				class="question__content"
				:animation="sortAnimation()"
				direction="vertical"
				handle=".option__drag-handle"
				invertSwap
				target=".sort-target"
				@update="dirtyOptionsType = 'choice'"
				@start="onDragStart"
				@end="onDragEnd">
				<TransitionGroup
					tag="ul"
					:name="isDragging ? undefined : 'options-list-transition'"
					class="sort-target">
					<AnswerInput
						v-for="(answer, index) in choices"
						:key="answer.local ? 'option-local' : answer.id"
						ref="input"
						:answer="answer"
						:formId="formId"
						isDropdown
						:index="index"
						:isUnique="!isMultiple"
						:maxIndex="options.length - 1"
						:maxOptionLength="maxStringLengths.optionText"
						optionType="choice"
						@createAnswer="onCreateAnswer"
						@update:answer="updateAnswer"
						@delete="deleteOption"
						@focusNext="focusNextInput"
						@moveUp="onOptionMoveUp(index, OptionType.Choice)"
						@moveDown="onOptionMoveDown(index, OptionType.Choice)"
						@tabbedOut="checkValidOption" />
				</TransitionGroup>
			</Draggable>
		</template>

		<!-- Add multiple options modal -->
		<OptionInputDialog
			v-model:open="isOptionDialogShown"
			@multipleAnswers="handleMultipleOptions" />
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconContentPaste from '@material-symbols/svg-400/outlined/content_paste.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import { VueDraggable as Draggable } from 'vue-draggable-plus'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import OptionInputDialog from '../OptionInputDialog.vue'
import AnswerInput from './AnswerInput.vue'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import QuestionMultipleMixin from '../../mixins/QuestionMultipleMixin.ts'
import { OptionType } from '../../models/Constants.ts'

export default {
	name: 'QuestionDropdown',

	components: {
		AnswerInput,
		Draggable,
		NcIconSvgWrapper,
		NcActionButton,
		NcActionCheckbox,
		NcLoadingIcon,
		NcSelect,
		OptionInputDialog,
		Question,
	},

	mixins: [QuestionMixin, QuestionMultipleMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconContentPaste,
		}
	},

	data() {
		return {
			isDragging: false,
			isLoading: false,
			isOptionDialogShown: false,
			OptionType,
		}
	},

	computed: {
		selectOptionPlaceholder() {
			if (this.readOnly) {
				return this.answerType.submitPlaceholder
			}
			return this.answerType.createPlaceholder
		},

		isMultiple() {
			// This can be extended if we want to include support for <select multiple>
			return false
		},

		shiftDragHandle() {
			return !this.readOnly && this.options.length !== 0 && !this.isLastEmpty
		},

		selectedOption() {
			if (!this.values) {
				return null
			}

			const selected = this.values.map((id) =>
				this.options.find((option) => option.id === parseInt(id)),
			)

			return this.isMultiple ? selected : selected[0]
		},

		choices: {
			get() {
				return this.sortOptionsOfType(this.options, OptionType.Choice)
			},

			set(value) {
				this.updateOptionsOrder(value, OptionType.Choice)
			},
		},
	},

	watch: {
		hasError: { handler: 'syncInputState', flush: 'post' },
	},

	mounted() {
		this.syncInputState()
	},

	methods: {
		async validate() {
			if (this.isRequired && this.areNoneChecked) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			this.errorMessage = null
			return true
		},

		onDragStart() {
			this.isDragging = true
		},

		onDragEnd() {
			this.$nextTick(() => {
				this.isDragging = false
			})
		},

		onInput(option) {
			if (Array.isArray(option)) {
				this.$emit('update:values', [
					...new Set(option.map((opt) => opt.id)),
				])
			} else {
				// Simple select
				this.$emit('update:values', option ? [option.id] : [])
			}
			this.revalidateIfInvalid()
		},

		/**
		 * NcSelect keeps unknown attributes on its outer wrapper, which has no role, so
		 * a screen reader never hears that the question is invalid. Put the state on the
		 * combobox input itself instead.
		 */
		syncInputState() {
			const input = this.$refs.select?.$el?.querySelector?.('input.vs__search')
			if (!input) {
				return
			}
			if (this.hasError) {
				input.setAttribute('aria-invalid', 'true')
				input.setAttribute('aria-errormessage', this.errorId)
			} else {
				input.removeAttribute('aria-invalid')
				input.removeAttribute('aria-errormessage')
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.question__content {
	display: flex;
	flex-direction: column;
	gap: var(--default-grid-baseline);
}

.question__item {
	position: relative;
	display: inline-flex;
	min-height: var(--default-clickable-area);

	.question__input {
		width: calc(100% - var(--default-clickable-area));
		position: relative;
		inset-inline-start: -12px;
		margin-inline-end: 32px !important;
	}
}

// Only opacity and transform actually change between the states below, and naming
// them is not pedantry: `all` also animates whatever else moves when an item is
// pulled out of the flow to be reordered, which is where the squashing on a
// reordering list comes from. These two are also the pair a compositor can animate
// without laying the page out again.
.options-list-transition-move,
.options-list-transition-enter-active,
.options-list-transition-leave-active {
	transition:
		opacity var(--animation-slow) ease,
		transform var(--animation-slow) ease;
}

.options-list-transition-enter-from,
.options-list-transition-leave-to {
	opacity: 0;
	transform: translateX(var(--default-clickable-area));

	// Items slide in from the end side, which is the left in a right-to-left form.
	[dir='rtl'] & {
		transform: translateX(calc(-1 * var(--default-clickable-area)));
	}
}

/* ensure leaving items are taken out of layout flow so that moving
   animations can be calculated correctly. */
.options-list-transition-leave-active {
	position: absolute;
}
</style>
