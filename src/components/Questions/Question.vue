<!--
  - SPDX-FileCopyrightText: 2020 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<li
		class="question"
		:class="{
			'question--editable': !readOnly,
		}"
		:aria-label="
			displayOnly
				? undefined
				: t('forms', 'Question number {index}', { index: questionNumber })
		">
		<!-- Drag handle -->
		<!-- TODO: implement arrow key mapping to reorder question -->
		<div
			v-if="!readOnly && !isTriggerQuestion"
			class="question__drag-handle"
			:class="{
				'question__drag-handle--shiftup': shiftDragHandle,
			}">
			<NcButton
				ref="buttonUp"
				:aria-label="t('forms', 'Move question up')"
				:disabled="!canMoveUp"
				class="question__drag-handle-button"
				variant="tertiary-no-background"
				@click.stop="onMoveUp">
				<template #icon>
					<NcIconSvgWrapper :svg="IconArrowUp" />
				</template>
			</NcButton>
			<NcIconSvgWrapper :svg="IconDragIndicator" />
			<NcButton
				ref="buttonDown"
				:aria-label="t('forms', 'Move question down')"
				:disabled="!canMoveDown"
				class="question__drag-handle-button"
				variant="tertiary-no-background"
				@click.stop="onMoveDown">
				<template #icon>
					<NcIconSvgWrapper :svg="IconArrowDown" />
				</template>
			</NcButton>
		</div>

		<!-- Header -->
		<div v-if="!isTriggerQuestion || !readOnly" class="question__header">
			<div class="question__header__title">
				<input
					v-if="!isTriggerQuestion && !readOnly"
					:placeholder="titlePlaceholder"
					:aria-label="
						t('forms', 'Title of question number {index}', {
							index,
						})
					"
					:aria-describedby="questionValid ? undefined : warningId"
					:value="text"
					class="question__header__title__text question__header__title__text__input"
					type="text"
					dir="auto"
					:style="{ textAlign: formTextAlign }"
					minlength="1"
					:maxlength="maxStringLengths.questionText"
					required
					@input="onTitleChange" />
				<!-- tabindex -1: moving to another page focuses the first heading, and a
				     heading only takes focus from script when it has one. -->
				<component
					:is="headingTag"
					v-else-if="readOnly"
					:id="titleId"
					class="question__header__title__text"
					dir="auto"
					tabindex="-1"
					:style="{ textAlign: formTextAlign }">
					{{ text
					}}<span
						v-if="isRequired"
						class="question__header__title__required"
						aria-hidden="true"
						>&nbsp;*</span
					>
				</component>
				<span
					v-if="quizPoints !== null"
					class="question__header__title__points">
					{{ n('forms', '%n point', '%n points', quizPoints) }}
				</span>
				<!-- Decorative: the reason is written out below the title, where touch
				     users can read it too and the title field refers to it. -->
				<div
					v-if="!readOnly && !questionValid"
					:title="warningInvalid"
					class="question__header__title__warning"
					aria-hidden="true">
					<NcIconSvgWrapper :svg="IconAlertCircleOutline" />
				</div>
				<!-- The asterisk on the menu icon is drawn only; say it in the name too. -->
				<NcActions
					v-if="!readOnly"
					:id="actionsId"
					:ariaLabel="
						isRequired
							? t('forms', 'Question actions (required question)')
							: t('forms', 'Question actions')
					"
					forceMenu
					placement="bottom-end"
					class="question__header__title__menu">
					<template v-if="isRequired" #icon>
						<IconOverlay>
							<template #overlay>
								<NcIconSvgWrapper :svg="IconAsterisk" inline />
							</template>
							<NcIconSvgWrapper :svg="IconDotsHorizontal" />
						</IconOverlay>
					</template>
					<NcActionCheckbox
						v-if="!hideRequired"
						:modelValue="isRequired"
						@update:modelValue="onRequiredChange">
						<!-- TRANSLATORS Making this question necessary to be answered when submitting to a form -->
						{{ t('forms', 'Required') }}
					</NcActionCheckbox>
					<!-- cross-question conditions and go-to-section branching -->
					<NcActionButton
						v-if="!readOnly"
						closeAfterClick
						@click="showLogicDialog = true">
						<template #icon>
							<NcIconSvgWrapper :svg="IconSourceBranch" />
						</template>
						{{ t('forms', 'Logic') }}
					</NcActionButton>
					<slot name="actions" />
					<NcActionInput
						:label="t('forms', 'Technical name of the question')"
						:labelOutside="false"
						:showTrailingButton="false"
						:modelValue="name"
						@update:modelValue="onNameChange">
						<template #icon>
							<NcIconSvgWrapper :svg="IconIdentifier" />
						</template>
						{{ t('forms', 'Technical name') }}
					</NcActionInput>
					<NcActionButton
						v-if="!isTriggerQuestion"
						closeAfterClick
						@click="onClone">
						<template #icon>
							<NcIconSvgWrapper :svg="IconContentCopy" />
						</template>
						{{ t('forms', 'Copy question') }}
					</NcActionButton>
					<!-- closeAfterClick: on a form with answers this opens a confirmation
					     instead of deleting at once, and the menu would sit over it. -->
					<NcActionButton closeAfterClick @click="onDelete">
						<template #icon>
							<NcIconSvgWrapper :svg="IconDelete" />
						</template>
						{{ t('forms', 'Delete question') }}
					</NcActionButton>
				</NcActions>
			</div>
			<p
				v-if="!readOnly && !questionValid"
				:id="warningId"
				class="question__header__warning-text">
				<bdi>{{ warningInvalid }}</bdi>
			</p>
			<div
				v-if="!isTriggerQuestion && (hasDescription || !readOnly)"
				class="question__header__description">
				<textarea
					v-if="!readOnly"
					ref="description"
					dir="auto"
					:style="{ textAlign: formTextAlign }"
					:value="description"
					:placeholder="
						t(
							'forms',
							'Description (formatting using Markdown is supported)',
						)
					"
					:aria-label="
						t('forms', 'Description of question number {index}', {
							index,
						})
					"
					:maxlength="maxStringLengths.questionDescription"
					class="question__header__description__input"
					@input="onDescriptionChange" />
				<!-- eslint-disable vue/no-v-html -->
				<div
					v-else
					:id="descriptionId"
					class="question__header__description__output"
					v-html="computedDescription" />
				<!-- eslint-enable vue/no-v-html -->
			</div>
			<!-- The interface's sentences, inside a question laid out the form's way:
			     <bdi> keeps their punctuation at their own end. -->
			<NcNoteCard v-if="hasInfo" :id="infoId" type="info">
				<bdi>{{ infoMessage }}</bdi>
			</NcNoteCard>
			<!-- Short-answer and number questions validate as they are typed in, so an
			     error can appear without focus moving and without anything being said.
			     Polite rather than assertive: submitting can raise several of these at
			     once, and the respondent is already being taken to the first of them. -->
			<NcNoteCard
				v-if="hasError"
				:id="errorId"
				type="error"
				aria-live="polite">
				<bdi>{{ errorMessage }}</bdi>
			</NcNoteCard>
		</div>

		<!-- Question content -->
		<slot />
		<!-- Insert question menu -->
		<slot name="insert" />

		<QuestionLogicDialog
			v-if="!readOnly && showLogicDialog"
			v-model:open="showLogicDialog"
			:questionId="id"
			:extraSettings="extraSettings"
			:options="options"
			@update:extraSettings="$emit('update:extraSettings', $event)" />
	</li>
</template>

<script>
import IconSourceBranch from '@material-symbols/svg-400/outlined/account_tree.svg?raw'
import IconAsterisk from '@material-symbols/svg-400/outlined/asterisk.svg?raw'
import IconIdentifier from '@material-symbols/svg-400/outlined/badge.svg?raw'
import IconContentCopy from '@material-symbols/svg-400/outlined/content_copy.svg?raw'
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconDragIndicator from '@material-symbols/svg-400/outlined/drag_indicator.svg?raw'
import IconAlertCircleOutline from '@material-symbols/svg-400/outlined/error.svg?raw'
import IconArrowDown from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?raw'
import IconArrowUp from '@material-symbols/svg-400/outlined/keyboard_arrow_up.svg?raw'
import IconDotsHorizontal from '@material-symbols/svg-400/outlined/more_horiz.svg?raw'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import IconOverlay from '../Icons/IconOverlay.vue'
import QuestionLogicDialog from './QuestionLogicDialog.vue'

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Question',

	components: {
		NcIconSvgWrapper,
		IconOverlay,
		NcActions,
		NcActionButton,
		NcActionCheckbox,
		QuestionLogicDialog,
		NcActionInput,
		NcButton,
		NcNoteCard,
	},

	inject: {
		$markdownit: { from: '$markdownit' },
		// How to align the author's words; see ViewsMixin authorTextAlign.
		formTextAlign: { from: 'formTextAlign', default: undefined },
		formSettings: { from: 'formSettings', default: () => () => ({}) },
	},

	props: {
		index: {
			type: Number,
			required: true,
		},

		// The number a respondent hears for this question. Defaults to `index`, which
		// also builds the element ids and so has to stay unique; a parent that skips
		// display-only blocks when counting passes its own number here.
		displayNumber: {
			type: Number,
			default: null,
		},

		// Section breaks, images and videos are not questions, so they are not named
		// "Question number N".
		displayOnly: {
			type: Boolean,
			default: false,
		},

		// Heading level of the respondent's title: a parent puts questions that
		// follow a section one level below the section's own title.
		headingLevel: {
			type: Number,
			default: 3,
			validator: (value) =>
				Number.isInteger(value) && value >= 2 && value <= 6,
		},

		text: {
			type: String,
			required: true,
		},

		titlePlaceholder: {
			type: String,
			required: true,
		},

		description: {
			type: String,
			required: true,
		},

		// needed by the Logic dialog. Declared here so QuestionMixin's questionProps
		// forwards them automatically -- it filters $props down to Question.props, so no
		// concrete question component needs changing.
		id: {
			type: Number,
			default: null,
		},

		extraSettings: {
			type: Object,
			default: () => ({}),
		},

		options: {
			type: Array,
			default: () => [],
		},

		// display-only question types (sections) cannot be answered, so offering a
		// "Required" toggle on them would be meaningless. Phrased negatively so the default
		// stays false, per the project's vue/no-boolean-default rule.
		hideRequired: {
			type: Boolean,
			default: false,
		},

		isRequired: {
			type: Boolean,
			required: true,
		},

		shiftDragHandle: {
			type: Boolean,
			default: false,
		},

		readOnly: {
			type: Boolean,
			default: false,
		},

		maxStringLengths: {
			type: Object,
			required: true,
		},

		name: {
			type: String,
			default: '',
		},

		contentValid: {
			type: Boolean,
			default: true,
		},

		warningInvalid: {
			type: String,
			default: t('forms', 'This question needs a title!'),
		},

		canMoveDown: {
			type: Boolean,
			default: false,
		},

		canMoveUp: {
			type: Boolean,
			default: false,
		},

		errorMessage: {
			type: String,
			default: null,
		},

		infoMessage: {
			type: String,
			default: null,
		},

		isTriggerQuestion: {
			type: Boolean,
			default: false,
		},
	},

	emits: [
		'update:extraSettings',
		'update:text',
		'update:description',
		'update:name',
		'update:isRequired',
		'moveDown',
		'moveUp',
		'delete',
		'clone',
	],

	setup() {
		return {
			IconAsterisk,
			IconAlertCircleOutline,
			IconArrowDown,
			IconArrowUp,
			IconContentCopy,
			IconDelete,
			IconDotsHorizontal,
			IconDragIndicator,
			IconIdentifier,
			IconSourceBranch,
		}
	},

	data() {
		return {
			/** whether the Logic dialog is open */
			showLogicDialog: false,
		}
	},

	computed: {
		/**
		 * What this question is worth, shown to respondents of a quiz as a quiz form
		 * usually does. A respondent's copy of the question carries no answer key, so the
		 * server marks the scored ones; the author's copy has the key itself.
		 *
		 * @return {?number} the points, or null when not shown
		 */
		quizPoints() {
			if (!this.readOnly || this.formSettings()?.quizMode !== true) {
				return null
			}
			const extra = this.extraSettings ?? {}
			const keyed =
				Object.values(extra.correctOptions ?? {}).length > 0
				|| (extra.correctAnswer ?? '') !== ''
			if (!keyed && extra.scored !== true) {
				return null
			}
			const points = typeof extra.points === 'number' ? extra.points : 1
			return points > 0 ? points : null
		},

		computedDescription() {
			return this.$markdownit.render(this.description)
		},

		/**
		 * Question valid, if text not empty and content valid
		 *
		 * @return {boolean} true if question valid
		 */
		questionValid() {
			return this.text && this.contentValid
		},

		questionNumber() {
			return this.displayNumber ?? this.index
		},

		headingTag() {
			return 'h' + this.headingLevel
		},

		warningId() {
			return 'q' + this.index + '_warning'
		},

		actionsId() {
			return 'q' + this.index + '_actions'
		},

		titleId() {
			return 'q' + this.index + '_title'
		},

		descriptionId() {
			return 'q' + this.index + '_desc'
		},

		hasDescription() {
			return this.description !== ''
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
	},

	// Ensure description is sized correctly on initial render
	mounted() {
		this.$nextTick(() => this.resizeDescription())
	},

	methods: {
		onTitleChange({ target }) {
			this.$emit('update:text', target.value)
		},

		onDescriptionChange({ target }) {
			this.resizeDescription()
			this.$emit('update:description', target.value)
		},

		onNameChange(name) {
			this.$emit('update:name', name)
		},

		onRequiredChange(isRequired) {
			this.$emit('update:isRequired', isRequired)
		},

		resizeDescription() {
			// next tick ensures that the textarea is attached to DOM
			this.$nextTick(() => {
				const textarea = this.$refs.description
				if (textarea) {
					textarea.style.cssText = 'height: 0'
					// include 2px border
					textarea.style.cssText = `height: ${textarea.scrollHeight + 4}px`
				}
			})
		},

		/**
		 * Reorder question but keep focus on a move button. At the first or last
		 * position the pressed button becomes disabled and cannot hold focus, so
		 * focus moves to the other one.
		 */
		onMoveDown() {
			this.$emit('moveDown')
			this.$nextTick(() => {
				this.$refs[this.canMoveDown ? 'buttonDown' : 'buttonUp']?.$el.focus()
			})
		},

		onMoveUp() {
			this.$emit('moveUp')
			this.$nextTick(() => {
				this.$refs[this.canMoveUp ? 'buttonUp' : 'buttonDown']?.$el.focus()
			})
		},

		/**
		 * Delete this question
		 */
		onDelete() {
			this.$emit('delete')
		},

		/**
		 * Clone this question
		 */
		onClone() {
			this.$emit('clone')
		},
	},
}
</script>

<style lang="scss" scoped>
@use '../../scssmixins/markdownOutput' as *;

.question {
	position: relative;
	display: flex;
	align-items: stretch;
	flex-direction: column;
	justify-content: stretch;
	margin-block-end: 64px;
	padding-inline-start: var(--default-clickable-area);
	background-color: var(--color-main-background);

	&--editable {
		padding-inline-start: 56px; // add 12px for the title input box
		// Only while editing, where the card is dragged around; a respondent should
		// be able to select and copy the question text.
		user-select: none;

		// The same card as the form itself, so what is being written looks like what will
		// be answered. The border is always drawn and only changes colour, so nothing
		// shifts as the pointer moves down the list.
		border: 2px solid transparent;
		border-radius: var(--border-radius-large);
		margin-block-end: 24px;
		padding-block: 8px;
		padding-inline-end: 8px;
		transition: border-color 0.1s ease-in-out;

		&:hover {
			border-color: var(--color-border);
		}

		&:focus-within {
			border-color: var(--color-primary-element);
		}

		> * {
			cursor: pointer;
		}
	}

	&__drag-handle {
		position: absolute;
		display: flex;
		inset-inline-start: var(--default-grid-baseline);
		flex-direction: column;
		justify-content: center;
		gap: 12px;
		width: var(--default-clickable-area);
		height: 100%;
		color: var(--color-text-maxcontrast);
		cursor: grab;

		&-button {
			position: absolute;
			inset-block-start: -9999px;
		}

		// Avoid moving drag-handle due to newAnswer-input on multiple-Questions
		&--shiftup {
			height: calc(100% - var(--default-clickable-area));
		}

		&:hover,
		&:focus,
		&:focus-within {
			color: var(--color-main-text);

			.question__drag-handle-button {
				position: initial;
				inset-block-start: initial;
			}
		}

		&:active {
			cursor: grabbing;
		}

		> * {
			cursor: grab;
		}
	}

	&__title,
	&__content {
		flex: 1 1 100%;
		max-width: 100%;
		padding: 0;
	}

	&__header {
		display: block;
		padding-block-end: 8px;
		align-items: center;
		flex: 1 1 100%;
		justify-content: space-between;
		width: auto;

		&__title {
			// The asterisk is the only thing marking a question as required, so it is
			// given a colour of its own rather than reading as punctuation in the title.
			// It carries no meaning for a screen reader - the field's own `required`
			// says it in words - so it is hidden from one and explained once, in the
			// legend under the form title.
			&__required {
				color: var(--color-error-text, var(--color-element-error));
				font-weight: normal;
			}

			display: flex;
			min-height: 44px;

			&__points {
				align-self: center;
				color: var(--color-text-maxcontrast);
				flex: 0 0 auto;
				font-variant-numeric: tabular-nums;
				margin-inline-start: 12px;
				white-space: nowrap;
			}

			&__text {
				flex: 1 1 100%;
				font-size: 16px !important;
				padding-block: 10px;
				padding-inline: 0px;
				font-weight: bold;
				margin: auto !important;

				&__input {
					position: relative;
					inset-inline-start: -12px;
					margin-inline-end: -12px !important;
					padding-inline-start: 10px !important;
				}
			}

			&__warning {
				margin-block: auto;
				margin-inline: 8px;
				color: var(--color-error);
			}

			&__menu {
				margin-block: auto;
				margin-inline-end: 12px;
			}
		}

		&__warning-text {
			margin-block: 0 4px;
			color: var(--color-error-text, var(--color-error));
			font-size: var(--font-size-small, 13px);
		}

		&__description {
			display: flex;

			&__input {
				margin: 0px;
				min-height: 1.5em;
				border-width: 2px;
				position: relative;
				inset-inline-start: -12px;
				padding-block: 4px;
				padding-inline: 10px;
				resize: none;
			}

			&__input,
			&__output {
				color: var(--color-text-maxcontrast) !important;
				line-height: 1.5em;
				z-index: inherit;
				overflow-wrap: break-word;
				// match with other inputs
				width: calc(100% - var(--default-clickable-area));
			}
			&__output {
				//compensate border
				padding-block: 6px;
				padding-inline: 0;
				// Styling for rendered Output
				@include markdown-output;
			}
		}
	}
}
</style>
