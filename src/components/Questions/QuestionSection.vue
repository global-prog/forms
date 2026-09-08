<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  a display-only "question" that groups the questions after it.

  Modelled as an answer type rather than a new table on purpose: it is an ordinary row in
  oc_forms_v2_questions using the existing `order` column, so it needs no migration and cannot
  collide with whatever schema upstream eventually ships for issue #624 (sections, milestone 5.5).

  It never produces an answer -- SubmissionService skips it during validation and filters it out
  of exports, so it adds no column to a CSV.
-->
<template>
	<Question
		v-bind="questionProps"
		hideRequired
		:titlePlaceholder="answerType.titlePlaceholder"
		:warningInvalid="answerType.warningInvalid"
		v-on="commonListeners">
		<div class="question__content question-section">
			<hr class="question-section__rule" />
			<p v-if="!readOnly" class="question-section__hint">
				{{
					pageBreak
						? t('forms', 'Questions after this start a new page.')
						: t(
								'forms',
								'This is a heading only; it does not split the form.',
							)
				}}
			</p>
			<NcCheckboxRadioSwitch
				v-if="!readOnly"
				:modelValue="pageBreak"
				@update:modelValue="onChangePageBreak">
				{{ t('forms', 'Start a new page here') }}
			</NcCheckboxRadioSwitch>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'

export default {
	name: 'QuestionSection',

	components: {
		NcCheckboxRadioSwitch,
		Question,
	},

	mixins: [QuestionMixin],

	computed: {
		/**
		 * Whether this section starts a new page in the submit view.
		 * Defaults to true: "section break" is what people actually ask for.
		 *
		 * @return {boolean} true when the section splits the form
		 */
		pageBreak() {
			return this.extraSettings?.pageBreak !== false
		},
	},

	methods: {
		/**
		 * @param {boolean} value whether this section should split the form
		 */
		onChangePageBreak(value) {
			// Store only the non-default (false); true is the implicit default, which keeps
			// extra_settings_json empty for the common case.
			this.onExtraSettingsChange({ pageBreak: value ? undefined : false })
		},
	},
}
</script>

<style lang="scss" scoped>
.question-section {
	&__rule {
		border: none;
		border-top: 2px solid var(--color-border);
		margin: 4px 0 8px;
		width: 100%;
	}

	&__hint {
		color: var(--color-text-maxcontrast);
		margin-bottom: 4px;
	}
}
</style>
