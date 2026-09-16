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
		<template v-if="readOnly">
			<fieldset
				:name="name || undefined"
				:aria-labelledby="titleId"
				:aria-describedby="description ? descriptionId : undefined">
				<!-- A grid with several columns is wider than a phone. Only the table scrolls
				     sideways, not the whole form, and the row labels stay in view while it
				     does. Every cell holds a focusable control, so keyboard users can still
				     reach each column. -->
				<div class="answer-grid__scroll">
					<table class="answer-grid">
						<thead>
							<tr>
								<th class="first-column"></th>

								<th
									v-for="column in columns"
									:key="column.local ? 'option-local' : column.id"
									scope="col">
									{{ column.text }}
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="row in rows"
								:key="row.local ? 'option-local' : row.id">
								<th class="first-column" scope="row">
									{{ row.text }}
								</th>
								<td
									v-for="column in columns"
									:key="column.local ? 'option-local' : column.id">
									<template v-if="questionType === 'radio'">
										<NcCheckboxRadioSwitch
											:aria-errormessage="
												hasError ? errorId : undefined
											"
											:aria-invalid="
												hasError ? 'true' : undefined
											"
											:aria-label="cellLabel(row, column)"
											:modelValue="values[row.id]"
											:value="column.id.toString()"
											:name="`${row.id}-answer`"
											type="radio"
											@update:modelValue="
												onChangeCheckboxRadio(row.id, $event)
											" />
									</template>

									<template v-if="questionType === 'checkbox'">
										<NcCheckboxRadioSwitch
											:aria-errormessage="
												hasError ? errorId : undefined
											"
											:aria-invalid="
												hasError ? 'true' : undefined
											"
											:aria-label="cellLabel(row, column)"
											:modelValue="values[row.id] || []"
											:value="column.id.toString()"
											:name="`${row.id}-answer`"
											type="checkbox"
											@update:modelValue="
												onChangeCheckboxRadio(row.id, $event)
											" />
									</template>

									<template v-if="questionType === 'number'">
										<NcInputField
											type="number"
											:aria-label="cellLabel(row, column)"
											:modelValue="
												plainValues[row.id][column.id]
											"
											@update:modelValue="
												onChangeTextNumber(
													row.id,
													column.id,
													$event,
												)
											" />
									</template>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</fieldset>
		</template>

		<template v-else>
			<div v-if="isLoading">
				<NcLoadingIcon :size="64" />
			</div>

			<template v-else>
				<div>{{ t('forms', 'Columns') }}</div>
				<Draggable
					v-model="columns"
					class="question__content"
					:animation="sortAnimation()"
					direction="vertical"
					handle=".option__drag-handle"
					invertSwap
					target=".sort-target"
					@update="dirtyOptionsType = 'column'"
					@start="onDragStart"
					@end="onDragEnd">
					<!-- Column input edit -->
					<TransitionGroup
						tag="ul"
						:name="isDragging ? undefined : 'options-list-transition'"
						class="sort-target">
						<AnswerInput
							v-for="(answer, index) in columns"
							:key="answer.local ? 'option-local' : answer.id"
							ref="input"
							:answer="answer"
							:formId="formId"
							:index="index"
							:isUnique="isUnique"
							:maxIndex="columns.length - 2"
							:maxOptionLength="maxStringLengths.optionText"
							optionType="column"
							@createAnswer="onCreateAnswer"
							@update:answer="updateAnswer"
							@delete="deleteOption"
							@focusNext="focusNextInput"
							@moveUp="onOptionMoveUp(index, 'column')"
							@moveDown="onOptionMoveDown(index, 'column')"
							@tabbedOut="checkValidOption('column')" />
					</TransitionGroup>
				</Draggable>

				<div>{{ t('forms', 'Rows') }}</div>
				<Draggable
					v-model="rows"
					class="question__content"
					:animation="sortAnimation()"
					direction="vertical"
					handle=".option__drag-handle"
					invertSwap
					target=".sort-target"
					@update="dirtyOptionsType = 'row'"
					@start="onDragStart"
					@end="onDragEnd">
					<TransitionGroup
						tag="ul"
						:name="isDragging ? undefined : 'options-list-transition'"
						class="sort-target">
						<!-- Row input edit -->
						<AnswerInput
							v-for="(answer, index) in rows"
							:key="answer.local ? 'option-local' : answer.id"
							ref="input"
							:answer="answer"
							:formId="formId"
							:index="index"
							:isUnique="isUnique"
							:maxIndex="rows.length - 2"
							:maxOptionLength="maxStringLengths.optionText"
							optionType="row"
							@createAnswer="onCreateAnswer"
							@update:answer="updateAnswer"
							@delete="deleteOption"
							@focusNext="focusNextInput"
							@moveUp="onOptionMoveUp(index, 'row')"
							@moveDown="onOptionMoveDown(index, 'row')"
							@tabbedOut="checkValidOption('row')" />
					</TransitionGroup>
				</Draggable>
			</template>
		</template>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import { VueDraggable as Draggable } from 'vue-draggable-plus'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcInputField from '@nextcloud/vue/components/NcInputField'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import AnswerInput from './AnswerInput.vue'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import QuestionMultipleMixin from '../../mixins/QuestionMultipleMixin.ts'
import { GridCellType, OptionType } from '../../models/Constants.ts'

export default {
	name: 'QuestionGrid',

	components: {
		AnswerInput,
		Draggable,
		NcCheckboxRadioSwitch,
		NcInputField,
		NcLoadingIcon,
		Question,
	},

	mixins: [QuestionMixin, QuestionMultipleMixin],
	emits: ['update:values'],

	data() {
		return {
			isDragging: false,
			isLoading: false,
			questionTypes: [
				{ label: t('forms', 'Radio'), id: GridCellType.Radio },
				{ label: t('forms', 'Checkbox'), id: GridCellType.Checkbox },
				{ label: t('forms', 'Number'), id: GridCellType.Number },
				{ label: t('forms', 'Text'), id: GridCellType.Text },
			],
		}
	},

	computed: {
		isUnique() {
			return this.answerType.unique === true
		},

		shiftDragHandle() {
			return !this.readOnly && this.options.length !== 0 && !this.isLastEmpty
		},

		questionType() {
			return this.extraSettings?.questionType ?? GridCellType.Radio
		},

		columns: {
			get() {
				return this.sortOptionsOfType(this.options, OptionType.Column)
			},

			set(value) {
				this.updateOptionsOrder(value, OptionType.Column)
			},
		},

		rows: {
			get() {
				return this.sortOptionsOfType(this.options, OptionType.Row)
			},

			set(value) {
				this.updateOptionsOrder(value, OptionType.Row)
			},
		},

		plainValues() {
			const values = {}
			for (const row of this.rows) {
				for (const column of this.columns) {
					values[row.id] = values[row.id] || {}
					values[row.id][column.id] =
						this.values[row.id]?.[column.id] ?? ''
				}
			}

			return values
		},
	},

	methods: {
		async validate() {
			// Once the grid has been touched, values is an object keyed by row, not an
			// array, so its length says nothing. A cleared number cell ('') or an unticked
			// checkbox row ([]) still leaves a key behind; the server does not count those
			// as an answer, so neither may the form, or the respondent only learns about it
			// from a generic error when submitting.
			if (this.isRequired && !this.hasAnyAnswer()) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			this.errorMessage = null
			return true
		},

		/**
		 * Whether at least one cell of the grid holds an answer
		 *
		 * @return {boolean}
		 */
		hasAnyAnswer() {
			const isFilled = (value) =>
				value !== '' && value !== null && value !== undefined
			return Object.values(this.values ?? {}).some((rowValue) => {
				if (Array.isArray(rowValue)) {
					return rowValue.some(isFilled)
				}
				if (rowValue && typeof rowValue === 'object') {
					return Object.values(rowValue).some(isFilled)
				}
				return isFilled(rowValue)
			})
		},

		onDragStart() {
			this.isDragging = true
		},

		onDragEnd() {
			this.$nextTick(() => {
				this.isDragging = false
			})
		},

		/**
		 * What a cell of the grid is called, since the cell shows only a control: without
		 * this a screen reader announces "radio button" with no idea which row or column it
		 * belongs to.
		 *
		 * @param {object} row the row the cell is in
		 * @param {object} column the column the cell is in
		 * @return {string} the cell's name
		 */
		cellLabel(row, column) {
			return t('forms', '{row}: {column}', {
				row: row.text,
				column: column.text,
			})
		},

		onChangeCheckboxRadio(rowId, value) {
			const values = { ...this.values }
			values[rowId] = value

			this.$emit('update:values', values)
			this.revalidateIfInvalid()
		},

		onChangeTextNumber(rowId, columnId, value) {
			const values = { ...this.plainValues }
			values[rowId][columnId] = value

			this.$emit('update:values', values)
			this.revalidateIfInvalid()
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
		inset-inline-start: -34px;
		inset-block-start: 1px;
		margin-inline-end: 10px !important;
		padding-inline-start: 36px !important;
	}

	.question__label {
		flex: 1 1 100%;
		// Overwrite guest page core styles
		text-align: start !important;
		// Some rounding issues lead to this strange number, so label and answerInput show up a the same position, working on different browsers.
		padding-block: 6.5px 0;
		padding-inline: 30px 0;
		line-height: 22px;
		min-height: 34px;
		height: min-content;
		position: relative;

		&::before {
			box-sizing: border-box;
			// Adjust position manually for proper position to text
			position: absolute;
			inset-block-start: 10px;
			width: 16px;
			height: 16px;
			margin-inline: -30px 14px !important;
			margin-block-end: 0;
		}
	}
}

.question__other-answer {
	display: flex;
	gap: 4px 16px;
	flex-wrap: wrap;

	.question__label {
		flex-basis: content;
	}

	.question__input {
		flex: 1;
		min-width: 260px;
	}

	.input-field__input {
		min-height: var(--default-clickable-area);
	}
}

.question__other-answer:deep() .input-field__input {
	min-height: var(--default-clickable-area);
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

// A fieldset is as wide as its content by default, so without this the scroll
// container below would never be narrower than the table and never scroll.
fieldset {
	min-inline-size: 0;
}

.answer-grid__scroll {
	overflow-x: auto;
	max-inline-size: 100%;
}

.answer-grid {
	border-collapse: collapse;
	width: 100%;

	thead tr {
		border-bottom: 2px solid var(--color-border);
	}

	td {
		min-height: 34px;
		min-width: 64px;
		text-align: center;
		padding: 8px 4px;

		// A grid cell is a tap target, and a mis-tap here does not just miss - it puts
		// the answer on the wrong row. A finger needs more room than a pointer, so the
		// rows grow only where the pointer is coarse; on a desktop the grid keeps the
		// size it has always had.
		@media (pointer: coarse) {
			min-height: 44px;

			.checkbox-radio-switch {
				align-items: center;
				min-block-size: 44px;
			}
		}

		.checkbox-radio-switch {
			display: flex;
			justify-content: center;
		}
	}

	th {
		min-height: 44px;
		padding: 8px 4px;
		text-align: center;
	}

	.first-column {
		// A row's label is a heading now, so a screen reader can say which row a cell is
		// in; it should still read as the plain text it looked like before.
		font-weight: normal;
		// On a phone a fixed 200px label column would leave almost no room for the
		// answer columns; long labels wrap instead.
		min-width: min(200px, 40vw);
		overflow-wrap: anywhere;
		text-align: start;
		position: sticky;
		inset-inline-start: 0;
		// The cells scroll underneath the sticky label, so it needs a solid ground.
		background-color: var(--color-main-background);
		z-index: 1;
	}

	// The solid ground above would otherwise hide the row shade core paints on hover,
	// leaving the label - the cell that says which row this is - out of the highlight.
	// Swap in the same shade rather than going transparent, so the cells scrolled
	// underneath stay covered.
	// Core shades a row only on hover, which a keyboard never triggers; the whole row
	// takes the shade while one of its cells has focus too, not just its label.
	tbody tr:focus-within,
	tbody tr:hover > .first-column,
	tbody tr:focus-within > .first-column {
		background-color: var(--color-background-dark);
	}
}
</style>
