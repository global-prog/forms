<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  Display-only image and video blocks, modelled like section breaks: ordinary question rows
  that carry no answer, so they need no schema change and add no column to an export.

  PRIVACY: an externally hosted image or video makes the respondent's browser contact that
  third party, disclosing their IP address and often setting cookies. Video is therefore NOT
  auto-embedded in an iframe - it is shown as a link the respondent chooses to follow, which
  keeps an anonymous form actually anonymous. Images are rendered inline, with
  referrerpolicy="no-referrer" so at least the form's address is not leaked, and the editor
  warns when the URL is off-instance.
-->
<template>
	<Question
		v-bind="questionProps"
		hideRequired
		:titlePlaceholder="answerType.titlePlaceholder"
		:warningInvalid="answerType.warningInvalid"
		v-on="commonListeners">
		<div class="question__content question-media">
			<img
				v-if="isImage && url"
				:src="url"
				:alt="alt"
				class="question-media__image"
				referrerpolicy="no-referrer"
				loading="lazy" />

			<a
				v-else-if="!isImage && url"
				:href="url"
				class="question-media__link"
				target="_blank"
				rel="noopener noreferrer external">
				{{ alt || url }}
			</a>

			<p v-else class="question-media__empty">
				{{
					isImage
						? t('forms', 'No image address set yet.')
						: t('forms', 'No video address set yet.')
				}}
			</p>

			<template v-if="!readOnly">
				<NcTextField
					:label="t('forms', 'Address')"
					placeholder="https://"
					:modelValue="url"
					@update:modelValue="onChangeUrl" />
				<NcTextField
					:label="
						isImage
							? t('forms', 'Description for screen readers')
							: t('forms', 'Link text')
					"
					:modelValue="alt"
					@update:modelValue="onChangeAlt" />
				<NcNoteCard v-if="isExternal" type="warning">
					{{
						t(
							'forms',
							'This address is on another site. Loading it tells that site the IP address of everyone who opens the form.',
						)
					}}
				</NcNoteCard>
			</template>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'

export default {
	name: 'QuestionMedia',

	components: {
		NcNoteCard,
		NcTextField,
		Question,
	},

	mixins: [QuestionMixin],

	computed: {
		/** @return {boolean} true for an image block, false for video */
		isImage() {
			return this.answerType?.mediaKind !== 'video'
		},

		/** @return {string} the configured address */
		url() {
			return this.extraSettings?.url || ''
		},

		/** @return {string} alt text, or the link label for video */
		alt() {
			return this.extraSettings?.alt || ''
		},

		/**
		 * Whether the address points somewhere other than this instance.
		 *
		 * @return {boolean} true when the address is off-instance
		 */
		isExternal() {
			if (!this.url) {
				return false
			}
			try {
				return (
					new URL(this.url, window.location.origin).origin
					!== window.location.origin
				)
			} catch {
				// An address we cannot parse is not yet worth warning about.
				return false
			}
		},
	},

	methods: {
		/**
		 * @param {string} value the new address
		 */
		onChangeUrl(value) {
			this.onExtraSettingsChange({ url: value || undefined })
		},

		/**
		 * @param {string} value the new description or link text
		 */
		onChangeAlt(value) {
			this.onExtraSettingsChange({ alt: value || undefined })
		},
	},
}
</script>

<style lang="scss" scoped>
.question-media {
	display: flex;
	flex-direction: column;
	gap: 8px;

	&__image {
		border-radius: var(--border-radius);
		max-height: 400px;
		max-width: 100%;
		object-fit: contain;
	}

	&__empty {
		color: var(--color-text-maxcontrast);
	}
}
</style>
