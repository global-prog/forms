<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  Choose how one question's answers are drawn.

  The list of forms is decided by the summary, not here, and it is not the same list for
  every question: a chart can state something the data does not say. A ring divides a
  whole, so it is offered for single choice and withheld from checkboxes, where one
  respondent may tick several boxes and the shares sum past 100%. A line asserts that
  neighbouring points are neighbours, so it is offered on a rating or a scale and withheld
  from a list of options, whose order is only the order someone typed them in.

  A radio group drawn as buttons -- `type="radio"` with `buttonVariant` -- and not
  `type="button"`, which despite the name is a set of independent toggles: it treats the
  value as a list and appends to it, so choosing a second form turned "bars" into
  ["b", "a", "r", "s", "columns"], the chart silently fell back to bars, and the ring was
  never reachable at all.

  Each choice carries an icon and its name. The icon alone would be quicker to scan but
  leaves the control unreadable to a screen reader and ambiguous to anyone who has not met
  the icon before; the name is what makes it a control rather than a puzzle.
-->
<template>
	<div
		class="chart-form-picker"
		role="group"
		:aria-label="t('forms', 'Chart type')">
		<NcCheckboxRadioSwitch
			v-for="form in forms"
			:key="form"
			:modelValue="modelValue"
			:value="form"
			:name="`chartForm_${questionId}`"
			type="radio"
			buttonVariant
			@update:modelValue="$emit('update:modelValue', $event)">
			<NcIconSvgWrapper
				class="chart-form-picker__icon"
				:svg="icons[form]"
				inline />
			{{ labels[form] }}
		</NcCheckboxRadioSwitch>
	</div>
</template>

<script>
import IconBars from '@material-symbols/svg-400/outlined/align_horizontal_left.svg?raw'
import IconColumns from '@material-symbols/svg-400/outlined/bar_chart.svg?raw'
import IconRing from '@material-symbols/svg-400/outlined/donut_small.svg?raw'
import IconHeatmap from '@material-symbols/svg-400/outlined/grid_on.svg?raw'
import IconLine from '@material-symbols/svg-400/outlined/show_chart.svg?raw'
import IconStacked from '@material-symbols/svg-400/outlined/stacked_bar_chart.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'

export default {
	name: 'ChartFormPicker',

	components: {
		NcCheckboxRadioSwitch,
		NcIconSvgWrapper,
	},

	props: {
		/** The form currently drawn. */
		modelValue: {
			type: String,
			required: true,
		},

		/** The forms that are truthful for this question, best first. */
		forms: {
			type: Array,
			required: true,
		},

		/** Only used to keep the radio groups of separate questions apart. */
		questionId: {
			type: [Number, String],
			required: true,
		},
	},

	emits: ['update:modelValue'],

	setup() {
		return {
			icons: {
				bars: IconBars,
				columns: IconColumns,
				line: IconLine,
				ring: IconRing,
				heatmap: IconHeatmap,
				stacked: IconStacked,
			},

			// Named by orientation rather than as "bars" and "columns". Those two words
			// are the same word in several languages, including one this form may be
			// written in, which would leave two buttons reading identically; and
			// "Columns" is already the word for a grid's columns, so a translator
			// gets the one string for both meanings.
			labels: {
				bars: t('forms', 'Horizontal bars'),
				columns: t('forms', 'Vertical bars'),
				line: t('forms', 'Line'),
				ring: t('forms', 'Ring'),
				heatmap: t('forms', 'Heatmap'),
				stacked: t('forms', 'Stacked'),
			},
		}
	},
}
</script>

<style lang="scss" scoped>
.chart-form-picker {
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
	margin-block-end: 8px;

	&__icon {
		margin-inline-end: 4px;
	}
}

// The picker is a control, and a printed page has nothing to control. What it chose is on
// the paper; the buttons offering the other choices are noise.
@media print {
	.chart-form-picker {
		display: none;
	}
}
</style>
