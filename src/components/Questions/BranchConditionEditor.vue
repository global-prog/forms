<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="branch-condition-editor">
		<!-- Option-based conditions (radio, dropdown, checkbox) -->
		<template v-if="isOptionBasedTrigger">
			<div class="condition-label">
				{{ conditionLabel }}
			</div>
			<div class="condition-options">
				<!-- Single select for radio/dropdown -->
				<NcSelect
					v-if="isSingleSelect"
					:modelValue="selectedOptions"
					:options="optionsList"
					:placeholder="t('forms', 'Select an option')"
					:ariaLabelCombobox="conditionLabel"
					:multiple="false"
					label="text"
					@update:modelValue="onSingleOptionSelect" />

				<!-- Multi select for checkboxes -->
				<NcSelect
					v-else
					:modelValue="selectedOptions"
					:options="optionsList"
					:placeholder="t('forms', 'Select options combination')"
					:ariaLabelCombobox="conditionLabel"
					:multiple="true"
					label="text"
					@update:modelValue="onMultipleOptionsSelect" />
			</div>
			<!-- The select cannot show an answer that no longer exists, so it looks
			     empty while the stored rule still waits for that answer. -->
			<p v-if="hasMissingOption" class="condition-warning">
				{{
					t(
						'forms',
						'An answer this branch used has been deleted. Choose another answer.',
					)
				}}
			</p>
		</template>

		<!-- Text-based conditions (short, long) -->
		<template v-else-if="isTextBasedTrigger">
			<div class="condition-row">
				<NcSelect
					v-model="conditionType"
					:options="textConditionTypes"
					:placeholder="t('forms', 'Condition type')"
					:ariaLabelCombobox="t('forms', 'Condition type')"
					label="label"
					:reduce="(opt) => opt.value"
					class="condition-type-select" />
				<NcTextField
					v-model="conditionValue"
					:label="conditionValuePlaceholder"
					:placeholder="conditionValuePlaceholder"
					:error="isPatternInvalid || isValueMissing"
					:helperText="valueHelperText"
					class="condition-value-input" />
			</div>
		</template>

		<!-- Value-based conditions (linearscale, color) -->
		<template v-else-if="isValueBasedTrigger">
			<div class="condition-row">
				<template v-if="triggerType === 'linearscale'">
					<NcSelect
						v-model="conditionType"
						:options="valueConditionTypes"
						:placeholder="t('forms', 'Condition type')"
						:ariaLabelCombobox="t('forms', 'Condition type')"
						label="label"
						:reduce="(opt) => opt.value"
						class="condition-type-select" />
					<template
						v-if="
							conditionType === 'value_equals'
							|| conditionType === 'value_not_equals'
						">
						<NcTextField
							v-model.number="conditionValue"
							type="number"
							:label="t('forms', 'Value')"
							:placeholder="t('forms', 'Value')"
							class="condition-value-input" />
					</template>
					<template v-else-if="conditionType === 'value_range'">
						<NcTextField
							v-model.number="conditionMin"
							type="number"
							:label="t('forms', 'Min')"
							:placeholder="t('forms', 'Min')"
							class="condition-range-input" />
						<span class="condition-range-separator">-</span>
						<NcTextField
							v-model.number="conditionMax"
							type="number"
							:label="t('forms', 'Max')"
							:placeholder="t('forms', 'Max')"
							class="condition-range-input" />
					</template>
					<template v-else-if="conditionType === 'value_min'">
						<NcTextField
							v-model.number="conditionMin"
							type="number"
							:label="t('forms', 'Min')"
							:placeholder="t('forms', 'Min')"
							class="condition-value-input" />
					</template>
					<template v-else-if="conditionType === 'value_max'">
						<NcTextField
							v-model.number="conditionMax"
							type="number"
							:label="t('forms', 'Max')"
							:placeholder="t('forms', 'Max')"
							class="condition-value-input" />
					</template>
				</template>
				<template v-else-if="triggerType === 'color'">
					<NcColorPicker v-model="conditionValue">
						<NcButton>
							<template #icon>
								<div
									class="color-preview"
									:style="{
										backgroundColor: conditionValue || '#000000',
									}" />
							</template>
							{{ t('forms', 'Select color') }}
						</NcButton>
					</NcColorPicker>
				</template>
			</div>
		</template>

		<!-- Date/time-based conditions -->
		<template v-else-if="isDateBasedTrigger">
			<div class="condition-row">
				<NcDateTimePicker
					v-model="conditionDateMin"
					:type="datePickerType"
					:placeholder="t('forms', 'From')"
					:ariaLabel="t('forms', 'From')"
					class="condition-date-input" />
				<span class="condition-range-separator">-</span>
				<NcDateTimePicker
					v-model="conditionDateMax"
					:type="datePickerType"
					:placeholder="t('forms', 'To')"
					:ariaLabel="t('forms', 'To')"
					class="condition-date-input" />
			</div>
		</template>

		<!-- File-based conditions -->
		<template v-else-if="triggerType === 'file'">
			<!-- Two named choices rather than one switch: "off" read the same whether
			     the branch waits for no file or has no rule at all, and those two
			     behave oppositely. -->
			<div
				class="condition-row"
				role="radiogroup"
				:aria-label="t('forms', 'Show this branch')">
				<NcCheckboxRadioSwitch
					type="radio"
					:name="fileRadioName"
					value="uploaded"
					:modelValue="fileCondition"
					@update:modelValue="onFileConditionChange">
					{{ t('forms', 'When a file is uploaded') }}
				</NcCheckboxRadioSwitch>
				<NcCheckboxRadioSwitch
					type="radio"
					:name="fileRadioName"
					value="none"
					:modelValue="fileCondition"
					@update:modelValue="onFileConditionChange">
					{{ t('forms', 'When no file is uploaded') }}
				</NcCheckboxRadioSwitch>
			</div>
		</template>
	</div>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcColorPicker from '@nextcloud/vue/components/NcColorPicker'
import NcDateTimePicker from '@nextcloud/vue/components/NcDateTimePicker'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import {
	compilePattern,
	DATE_STORAGE_FORMATS,
} from '../../utils/DisplayConditions.js'

export default {
	name: 'BranchConditionEditor',

	components: {
		NcButton,
		NcCheckboxRadioSwitch,
		NcColorPicker,
		NcDateTimePicker,
		NcSelect,
		NcTextField,
	},

	props: {
		/**
		 * The branch object containing conditions
		 */
		branch: {
			type: Object,
			required: true,
		},

		/**
		 * The trigger question type
		 */
		triggerType: {
			type: String,
			required: true,
		},

		/**
		 * Options for option-based triggers (radio, dropdown, checkbox)
		 */
		options: {
			type: Array,
			default: () => [],
		},
	},

	emits: ['update:branch'],

	computed: {
		/**
		 * Check if trigger is option-based (radio, dropdown, checkbox)
		 */
		isOptionBasedTrigger() {
			return ['multiple_unique', 'dropdown', 'multiple'].includes(
				this.triggerType,
			)
		},

		/**
		 * Check if trigger is single-select (radio, dropdown)
		 */
		isSingleSelect() {
			return ['multiple_unique', 'dropdown'].includes(this.triggerType)
		},

		/**
		 * Check if trigger is text-based (short, long)
		 */
		isTextBasedTrigger() {
			return ['short', 'long'].includes(this.triggerType)
		},

		/**
		 * Check if trigger is value-based (linearscale, color)
		 */
		isValueBasedTrigger() {
			return ['linearscale', 'color'].includes(this.triggerType)
		},

		/**
		 * Check if trigger is date-based (date, datetime, time)
		 */
		isDateBasedTrigger() {
			return ['date', 'datetime', 'time'].includes(this.triggerType)
		},

		/**
		 * Label for option-based conditions
		 */
		conditionLabel() {
			if (this.isSingleSelect) {
				return t('forms', 'Show when selected:')
			}
			return t('forms', 'Show when all selected:')
		},

		/**
		 * Options list for NcSelect
		 */
		optionsList() {
			// An untitled option is named by its place in the list, as the editor shows
			// it; its database id means nothing to anyone.
			return this.options.map((opt, index) => ({
				id: opt.id,
				text:
					opt.text || t('forms', 'Option {number}', { number: index + 1 }),
			}))
		},

		/**
		 * Whether the branch still names an answer option that has been deleted. The
		 * branch then never opens, while the select above looks merely empty.
		 */
		hasMissingOption() {
			const ids = (this.branch.conditions ?? []).flatMap((c) =>
				this.isSingleSelect ? [c.optionId] : (c.optionIds ?? []),
			)
			return ids.some(
				(id) =>
					id !== undefined
					&& id !== null
					&& !this.optionsList.some(
						(opt) => String(opt.id) === String(id),
					),
			)
		},

		/**
		 * Currently selected options based on branch conditions
		 */
		selectedOptions() {
			if (!this.branch.conditions || this.branch.conditions.length === 0) {
				return this.isSingleSelect ? null : []
			}

			let selectedIds
			if (this.isSingleSelect) {
				// Single select uses optionId in each condition
				selectedIds = this.branch.conditions.map((c) => c.optionId)
			} else {
				// Multi select uses optionIds array in first condition
				selectedIds = this.branch.conditions[0]?.optionIds || []
			}
			const selected = this.optionsList.filter((opt) =>
				selectedIds.includes(opt.id),
			)

			return this.isSingleSelect ? selected[0] || null : selected
		},

		/**
		 * Text condition type options
		 */
		textConditionTypes() {
			const types = [
				{ value: 'string_equals', label: t('forms', 'Is') },
				{ value: 'string_contains', label: t('forms', 'Contains') },
				{ value: 'regex', label: t('forms', 'Matches pattern') },
			]
			// Long text doesn't support string_equals
			if (this.triggerType === 'long') {
				return types.filter((t) => t.value !== 'string_equals')
			}
			return types
		},

		/**
		 * Value condition type options (for linear scale). Both engines compare
		 * inclusively, so the labels say "at least" / "at most".
		 */
		valueConditionTypes() {
			return [
				{ value: 'value_equals', label: t('forms', 'Is') },
				{ value: 'value_not_equals', label: t('forms', 'Is not') },
				{ value: 'value_range', label: t('forms', 'Between') },
				{ value: 'value_min', label: t('forms', 'At least') },
				{ value: 'value_max', label: t('forms', 'At most') },
			]
		},

		/**
		 * Current condition type from branch
		 */
		conditionType: {
			get() {
				return this.branch.conditions?.[0]?.type || this.defaultConditionType
			},

			set(value) {
				if (this.triggerType !== 'linearscale') {
					this.updateCondition({ type: value })
					return
				}
				// Each scale rule is read from its own keys, so a number typed for one
				// kind moves to where the new kind reads it. Left behind, it would still
				// limit the branch without being shown.
				const current = this.branch.conditions?.[0] ?? {}
				// The first of the keys that holds a number, so "at most" keeps the
				// upper bound of a range rather than its lower one.
				const pick = (...keys) =>
					keys
						.map((key) => current[key])
						.find((v) => v !== undefined && v !== null && v !== '')
				const next = { type: value }
				if (value === 'value_min') {
					next.min = pick('min', 'value', 'max')
				} else if (value === 'value_max') {
					next.max = pick('max', 'value', 'min')
				} else if (value === 'value_range') {
					next.min = pick('min', 'value')
					next.max = pick('max')
				} else {
					next.value = pick('value', 'min', 'max')
				}
				this.emitUpdate({ conditions: [next] })
			},
		},

		/**
		 * Default condition type based on trigger
		 */
		defaultConditionType() {
			if (this.isTextBasedTrigger) return 'string_contains'
			if (this.triggerType === 'linearscale') return 'value_equals'
			if (this.isDateBasedTrigger) return 'date_range'
			return null
		},

		/**
		 * Current condition value
		 */
		conditionValue: {
			get() {
				return this.branch.conditions?.[0]?.value ?? ''
			},

			set(value) {
				this.updateCondition({ value })
			},
		},

		/**
		 * Condition min value (for ranges)
		 */
		conditionMin: {
			get() {
				return this.branch.conditions?.[0]?.min ?? ''
			},

			set(value) {
				this.updateCondition({ min: value })
			},
		},

		/**
		 * Condition max value (for ranges)
		 */
		conditionMax: {
			get() {
				return this.branch.conditions?.[0]?.max ?? ''
			},

			set(value) {
				this.updateCondition({ max: value })
			},
		},

		/**
		 * Lower date/time bound, stored as a local string in the answer's own format so
		 * that both engines can compare it with the answer directly
		 */
		conditionDateMin: {
			get() {
				return this.parseDateBound(this.branch.conditions?.[0]?.min)
			},

			set(value) {
				this.updateCondition({ min: this.formatDateBound(value) })
			},
		},

		/**
		 * Upper date/time bound, stored like the lower one
		 */
		conditionDateMax: {
			get() {
				return this.parseDateBound(this.branch.conditions?.[0]?.max)
			},

			set(value) {
				this.updateCondition({ max: this.formatDateBound(value) })
			},
		},

		/**
		 * Storage format of the trigger's answers
		 */
		dateStorageFormat() {
			return (
				DATE_STORAGE_FORMATS[this.triggerType] ?? DATE_STORAGE_FORMATS.date
			)
		},

		/**
		 * The stored file condition. A branch without a condition matches nothing, so
		 * neither choice is shown picked; a condition without the flag means
		 * "uploaded", as both engines read it.
		 *
		 * @return {string} uploaded, none, or '' when there is no condition
		 */
		fileCondition() {
			const condition = this.branch.conditions?.[0]
			if (!condition) {
				return ''
			}
			return condition.fileUploaded === false ? 'none' : 'uploaded'
		},

		/** @return {string} the radio group name, one per branch */
		fileRadioName() {
			return `branch-${this.branch.id}-file`
		},

		/**
		 * Whether a text rule is still waiting for its text. Both engines ignore such a
		 * rule, so the branch never opens until something is entered. A new branch
		 * has no rule yet and matches nothing either, so it is flagged the same way.
		 */
		isValueMissing() {
			return this.isTextBasedTrigger && String(this.conditionValue) === ''
		},

		/** @return {string} what is wrong with the text value, or '' */
		valueHelperText() {
			if (this.isPatternInvalid) {
				return t('forms', 'This pattern is not valid')
			}
			if (this.isValueMissing) {
				return t('forms', 'Enter a value to finish this rule.')
			}
			return ''
		},

		/**
		 * Whether a pattern condition holds a pattern that cannot be used. Such a
		 * condition never matches, which would otherwise hide the branch without a word.
		 */
		isPatternInvalid() {
			return (
				this.conditionType === 'regex'
				&& this.conditionValue !== ''
				&& compilePattern(String(this.conditionValue)) === null
			)
		},

		/**
		 * Placeholder for condition value input
		 */
		conditionValuePlaceholder() {
			if (this.conditionType === 'regex') {
				return t('forms', 'Regular expression pattern')
			}
			if (this.conditionType === 'string_equals') {
				return t('forms', 'Exact text to match')
			}
			return t('forms', 'Text to search for')
		},

		/**
		 * Date picker type based on trigger type
		 */
		datePickerType() {
			if (this.triggerType === 'time') return 'time'
			if (this.triggerType === 'datetime') return 'datetime'
			return 'date'
		},
	},

	methods: {
		/**
		 * Handle single option selection (radio/dropdown)
		 *
		 * @param {object|null} option The selected option or null
		 */
		onSingleOptionSelect(option) {
			const conditions = option ? [{ optionId: option.id }] : []
			this.emitUpdate({ conditions })
		},

		/**
		 * Handle multiple option selection (checkbox)
		 *
		 * @param {Array} options The selected options array
		 */
		onMultipleOptionsSelect(options) {
			const optionIds = options.map((opt) => opt.id)
			const conditions = optionIds.length > 0 ? [{ optionIds }] : []
			this.emitUpdate({ conditions })
		},

		/**
		 * Handle file condition change
		 *
		 * @param {string} choice uploaded or none
		 */
		onFileConditionChange(choice) {
			const conditions = [{ fileUploaded: choice !== 'none' }]
			this.emitUpdate({ conditions })
		},

		/**
		 * @param {string|undefined} bound A stored bound
		 * @return {Date|null} The bound for the picker, or null when none is usable
		 */
		parseDateBound(bound) {
			// Bounds in any other format are ignored by both engines, so showing them
			// would suggest a limit that is not applied.
			if (
				typeof bound !== 'string'
				|| !this.dateStorageFormat.pattern.test(bound)
			) {
				return null
			}
			return moment(bound, this.dateStorageFormat.moment).toDate()
		},

		/**
		 * @param {Date|null} value The date the picker emitted
		 * @return {string|undefined} The bound to store, or undefined to remove it
		 */
		formatDateBound(value) {
			return value
				? moment(value).format(this.dateStorageFormat.moment)
				: undefined
		},

		/**
		 * Update a condition property
		 *
		 * @param {object} updates The condition properties to update
		 */
		updateCondition(updates) {
			const currentCondition = this.branch.conditions?.[0] || {}
			const newCondition = {
				...currentCondition,
				type: this.conditionType,
				...updates,
			}
			this.emitUpdate({ conditions: [newCondition] })
		},

		/**
		 * Emit branch update
		 *
		 * @param {object} updates The branch properties to update
		 */
		emitUpdate(updates) {
			this.$emit('update:branch', {
				...this.branch,
				...updates,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.branch-condition-editor {
	padding-block: 8px;
}

.condition-label {
	margin-block-end: 8px;
	font-weight: 500;
	color: var(--color-text-maxcontrast);
}

.condition-options {
	max-inline-size: 400px;
}

.condition-row {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

.condition-type-select {
	min-inline-size: min(150px, 100%);
}

.condition-value-input {
	flex: 1;
	// Capped so the field still fits a narrow phone screen instead of overflowing it.
	min-inline-size: min(200px, 100%);
}

.condition-range-input {
	inline-size: 100px;
}

.condition-warning {
	color: var(--color-error-text, var(--color-error));
	margin-block: 8px 0;
}

.condition-range-separator {
	color: var(--color-text-maxcontrast);
}

.condition-date-input {
	flex: 1;
}

.color-preview {
	inline-size: 24px;
	block-size: 24px;
	border-radius: var(--border-radius);
	border: 1px solid var(--color-border-dark);
}
</style>
