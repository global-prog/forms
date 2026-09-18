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
		<template v-if="answerType.pickerType === 'date'" #actions>
			<NcActionCheckbox
				:modelValue="dateRange"
				@update:modelValue="onDateRangeChange">
				{{ t('forms', 'Use date range') }}
			</NcActionCheckbox>
			<NcActionInput
				type="date"
				isNativePicker
				:modelValue="dateMin"
				:label="t('forms', 'Earliest date')"
				hideLabel
				:formatter="extraSettingsFormatter"
				:max="dateMax"
				:showTrailingButton="false"
				@update:modelValue="onDateMinChange">
				<template #icon>
					<NcIconSvgWrapper
						:svg="svgTodayIcon"
						:name="t('forms', 'Earliest date')" />
				</template>
			</NcActionInput>
			<NcActionInput
				type="date"
				isNativePicker
				:modelValue="dateMax"
				:label="t('forms', 'Latest date')"
				hideLabel
				:formatter="extraSettingsFormatter"
				:min="dateMin"
				:showTrailingButton="false"
				@update:modelValue="onDateMaxChange">
				<template #icon>
					<NcIconSvgWrapper
						:svg="svgEventIcon"
						:name="t('forms', 'Latest date')" />
				</template>
			</NcActionInput>
		</template>
		<template v-else-if="answerType.pickerType === 'time'" #actions>
			<NcActionCheckbox
				:modelValue="timeRange"
				@update:modelValue="onTimeRangeChange">
				{{ t('forms', 'Use time range') }}
			</NcActionCheckbox>
			<NcActionInput
				type="time"
				isNativePicker
				:modelValue="timeMin"
				:label="t('forms', 'Earliest time')"
				hideLabel
				:max="timeMax"
				:showTrailingButton="false"
				@update:modelValue="onTimeMinChange">
				<template #icon>
					<NcIconSvgWrapper
						:svg="svgClockLoader20"
						:name="t('forms', 'Earliest time')" />
				</template>
			</NcActionInput>
			<NcActionInput
				type="time"
				isNativePicker
				:modelValue="timeMax"
				:label="t('forms', 'Latest time')"
				hideLabel
				:min="timeMin"
				:showTrailingButton="false"
				@update:modelValue="onTimeMaxChange">
				<template #icon>
					<NcIconSvgWrapper
						:svg="svgClockLoader80"
						:name="t('forms', 'Latest time')" />
				</template>
			</NcActionInput>
		</template>
		<div
			class="question__content"
			role="group"
			:aria-labelledby="titleId"
			:aria-describedby="description ? descriptionId : undefined">
			<!-- The picker has no disabled state, so the editor's preview is made inert. -->
			<div ref="picker" :inert="!readOnly || undefined">
				<NcDateTimePicker
					:modelValue="time"
					:format="stringify"
					:placeholder="datetimePickerPlaceholder"
					:ariaLabel="text || datetimePickerPlaceholder"
					:type="dateTimePickerType"
					:min="pickerMin"
					:max="pickerMax"
					clearable
					@update:modelValue="onValueChange" />
			</div>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcDateTimePicker from '@nextcloud/vue/components/NcDateTimePicker'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Question from './Question.vue'
import svgClockLoader20 from '../../../img/clock_loader_20.svg?raw'
import svgClockLoader80 from '../../../img/clock_loader_80.svg?raw'
import svgEventIcon from '../../../img/event.svg?raw'
import svgTodayIcon from '../../../img/today.svg?raw'
import QuestionMixin from '../../mixins/QuestionMixin.js'

export default {
	name: 'QuestionDate',

	components: {
		NcActionCheckbox,
		NcActionInput,
		NcDateTimePicker,
		NcIconSvgWrapper,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	data() {
		return {
			extraSettingsFormatter: {
				stringify: this.stringifyDate,
				parse: this.parseTimestampToDate,
			},

			svgClockLoader80,
			svgClockLoader20,
			svgEventIcon,
			svgTodayIcon,
		}
	},

	computed: {
		isRangeQuestion() {
			return this.extraSettings?.dateRange || this.extraSettings?.timeRange
				? true
				: false
		},

		datetimePickerPlaceholder() {
			if (this.readOnly) {
				return this.isRangeQuestion
					? this.answerType.submitPlaceholderRange
					: this.answerType.submitPlaceholder
			}
			return this.isRangeQuestion
				? this.answerType.createPlaceholderRange
				: this.answerType.createPlaceholder
		},

		dateTimePickerType() {
			return this.isRangeQuestion
				? this.answerType.pickerType + '-range'
				: this.answerType.pickerType
		},

		time() {
			if (this.isRangeQuestion) {
				return this.values?.[0]
					? [this.parse(this.values[0]), this.parse(this.values[1])]
					: null
			}
			return this.values?.[0] ? this.parse(this.values[0]) : null
		},

		/**
		 * The maximum allowable date for the date input field
		 */
		dateMax() {
			return this.extraSettings?.dateMax
				? moment(this.extraSettings.dateMax, 'X').toDate()
				: null
		},

		/**
		 * The minimum allowable date for the date input field
		 */
		dateMin() {
			return this.extraSettings?.dateMin
				? moment(this.extraSettings.dateMin, 'X').toDate()
				: null
		},

		dateRange() {
			return this.extraSettings?.dateRange ?? false
		},

		/**
		 * The maximum allowable time for the time input field
		 */
		timeMax() {
			return this.extraSettings?.timeMax
				? moment(
						this.extraSettings.timeMax,
						this.answerType.storageFormat,
					).toDate()
				: new Date(new Date().setHours(24, 0, 0, 0))
		},

		/**
		 * The minimum allowable time for the time input field
		 */
		timeMin() {
			return this.extraSettings?.timeMin
				? moment(
						this.extraSettings.timeMin,
						this.answerType.storageFormat,
					).toDate()
				: new Date(new Date().setHours(0, 0, 0, 0))
		},

		timeRange() {
			return this.extraSettings?.timeRange ?? false
		},

		/**
		 * Earliest value the respondent may pick. Only limits the editor actually set are
		 * passed: the timeMin/timeMax fallbacks span a whole day, and a midnight upper
		 * bound would forbid every time.
		 */
		pickerMin() {
			if (this.answerType.pickerType === 'time') {
				return this.extraSettings?.timeMin ? this.timeMin : undefined
			}
			return this.dateMin ?? undefined
		},

		/**
		 * Latest value the respondent may pick
		 */
		pickerMax() {
			if (this.answerType.pickerType === 'time') {
				return this.extraSettings?.timeMax ? this.timeMax : undefined
			}
			return this.dateMax ?? undefined
		},
	},

	// After the DOM update: switching to a range picker renders a new input.
	watch: {
		isRequired: { handler: 'syncInputState', flush: 'post' },
		hasError: { handler: 'syncInputState', flush: 'post' },
		dateTimePickerType: { handler: 'syncInputState', flush: 'post' },
	},

	mounted() {
		this.syncInputState()
	},

	methods: {
		async validate() {
			if (this.isRequired && this.time === null) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			this.errorMessage = null
			return true
		},

		/**
		 * DateTimepicker show text in picker
		 * Format depends on component-type date/datetime
		 *
		 * @param {Date|Date[]} date the selected datepicker Date
		 * @return {string}
		 */
		stringify(date) {
			if (this.isRangeQuestion && Array.isArray(date)) {
				return `${moment(date[0]).format(this.answerType.momentFormat)} - ${moment(date[1]).format(this.answerType.momentFormat)}`
			}
			return moment(date).format(this.answerType.momentFormat)
		},

		/**
		 * Reinterpret a stored date
		 *
		 * @param {string} dateString Stringified date
		 * @return {Date}
		 */
		parse(dateString) {
			return moment(dateString, [
				this.answerType.momentFormat,
				this.answerType.storageFormat,
			]).toDate()
		},

		/**
		 * Handles the change event for the maximum date input.
		 * Updates the maximum allowable date based on the provided value.
		 *
		 * @param {string | Date} value - The new maximum date value. Can be a string or a Date object.
		 */
		onDateMaxChange(value) {
			this.onExtraSettingsChange({
				dateMax: parseInt(moment(value).format('X')),
			})
		},

		/**
		 * Handles the change event for the minimum date input.
		 * Updates the minimum allowable date based on the provided value.
		 *
		 * @param {string | Date} value - The new minimum date value. Can be a string or a Date object.
		 */
		onDateMinChange(value) {
			this.onExtraSettingsChange({
				dateMin: parseInt(moment(value).format('X')),
			})
		},

		/**
		 * Handles the change event for the date range selection.
		 * Updates the extra settings with the new date range value.
		 *
		 * @param {boolean} value - The new value of the date range selection.
		 *                          If true, the date range is enabled; otherwise, null.
		 */
		onDateRangeChange(value) {
			this.onExtraSettingsChange({ dateRange: value === true ? true : null })
		},

		/**
		 * Handles the change event for the maximum time input.
		 * Updates the maximum allowable date based on the provided value.
		 *
		 * @param {string | Date} value - The new maximum date value. Can be a string or a Date object.
		 */
		onTimeMaxChange(value) {
			this.onExtraSettingsChange({
				timeMax:
					value === null
					|| (value
						&& value.getTime
						&& value.getTime()
							=== new Date(new Date().setHours(24, 0, 0, 0)).getTime())
						? null
						: moment(value).format(this.answerType.storageFormat),
			})
		},

		/**
		 * Handles the change event for the minimum date input.
		 * Updates the minimum allowable date based on the provided value.
		 *
		 * @param {string | Date} value - The new minimum date value. Can be a string or a Date object.
		 */
		onTimeMinChange(value) {
			this.onExtraSettingsChange({
				timeMin:
					value === null
					|| (value
						&& value.getTime
						&& value.getTime()
							=== new Date(new Date().setHours(0, 0, 0, 0)).getTime())
						? null
						: moment(value).format(this.answerType.storageFormat),
			})
		},

		/**
		 * Handles the change event for the date range selection.
		 * Updates the extra settings with the new date range value.
		 *
		 * @param {boolean} value - The new value of the date range selection.
		 *                          If true, the date range is enabled; otherwise, null.
		 */
		onTimeRangeChange(value) {
			this.onExtraSettingsChange({ timeRange: value === true ? true : null })
		},

		/**
		 * Store Value
		 *
		 * @param {Date|Array<Date>|null} date The date or date range to store
		 */
		onValueChange(date) {
			if (!date) {
				this.$emit('update:values', [])
			} else if (this.isRangeQuestion) {
				this.$emit('update:values', [
					moment(date[0]).format(this.answerType.storageFormat),
					moment(date[1]).format(this.answerType.storageFormat),
				])
			} else {
				this.$emit('update:values', [
					moment(date).format(this.answerType.storageFormat),
				])
			}
			this.revalidateIfInvalid()
		},

		/**
		 * The picker does not pass ARIA attributes on to its text input, so the required
		 * and invalid states are set on that input directly.
		 */
		syncInputState() {
			const input = this.$refs.picker?.querySelector('input')
			if (!input) {
				return
			}
			const attributes = {
				'aria-required': this.isRequired ? 'true' : null,
				'aria-invalid': this.hasError ? 'true' : null,
				'aria-errormessage': this.hasError ? this.errorId : null,
			}
			for (const [name, value] of Object.entries(attributes)) {
				if (value === null) {
					input.removeAttribute(name)
				} else {
					input.setAttribute(name, value)
				}
			}
		},

		/**
		 * Datepicker timestamp to string
		 *
		 * @param {Date} datetime the datepicker Date
		 * @return {string}
		 */
		stringifyDate(datetime) {
			return moment(datetime).format('L')
		},

		/**
		 * Form expires timestamp to Date of the datepicker
		 *
		 * @param {number} value the expires timestamp
		 * @return {Date}
		 */
		parseTimestampToDate(value) {
			return moment(value, 'X').toDate()
		},
	},
}
</script>

<style lang="scss" scoped>
.question__content :deep(.vue-date-time-picker__wrapper) {
	inline-size: 100%;
	max-inline-size: 300px;
}
</style>
