<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  Ready-made forms to start from, rather than an empty page. The templates themselves are
  plain data in models/FormTemplates.js, and are built through the ordinary API, so what
  arrives is a normal form that can be changed like any other.
-->
<template>
	<NcDialog
		:open="open"
		:name="t('forms', 'Start from a template')"
		size="normal"
		@update:open="$emit('update:open', $event)">
		<ul class="template-picker">
			<li v-for="template in templates" :key="template.id">
				<button
					class="template-picker__item"
					:disabled="building !== null"
					@click="choose(template)">
					<span class="template-picker__name">
						{{ template.name }}
						<NcLoadingIcon
							v-if="building === template.id"
							:size="20"
							class="template-picker__spinner" />
					</span>
					<span class="template-picker__summary">{{
						template.summary
					}}</span>
					<span class="template-picker__count">
						{{
							n(
								'forms',
								'%n question',
								'%n questions',
								template.questions.length,
							)
						}}
					</span>
				</button>
			</li>
		</ul>
	</NcDialog>
</template>

<script>
import { showError } from '@nextcloud/dialogs'
import { translate as t } from '@nextcloud/l10n'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import { formTemplates } from '../models/FormTemplates.js'
import { createFormFromTemplate } from '../utils/ApplyTemplate.js'
import logger from '../utils/Logger.js'

export default {
	name: 'TemplatePicker',

	components: {
		NcDialog,
		NcLoadingIcon,
	},

	props: {
		/** Whether the dialog is shown. */
		open: {
			type: Boolean,
			required: true,
		},
	},

	emits: ['update:open', 'created'],

	setup() {
		return { t }
	},

	data() {
		return {
			// The template being built, so the others cannot be started at the same time.
			building: null,
		}
	},

	computed: {
		/** @return {object[]} the templates on offer */
		templates() {
			return formTemplates()
		},
	},

	methods: {
		/**
		 * @param {object} template the template chosen
		 */
		async choose(template) {
			if (this.building !== null) {
				return
			}
			this.building = template.id
			try {
				const form = await createFormFromTemplate(template)
				this.$emit('created', form)
				this.$emit('update:open', false)
			} catch (error) {
				logger.error('Unable to create a form from a template', { error })
				showError(t('forms', 'Unable to create a form from this template'))
			} finally {
				this.building = null
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.template-picker {
	display: flex;
	flex-direction: column;
	gap: 8px;
	list-style: none;
	margin: 0;
	padding: 0 0 8px;

	&__item {
		background-color: var(--color-main-background);
		border: 2px solid var(--color-border);
		border-radius: var(--border-radius-large);
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 2px;
		inline-size: 100%;
		padding: 12px 16px;
		text-align: start;

		&:hover:not(:disabled),
		&:focus-visible {
			background-color: var(--color-background-hover);
			border-color: var(--color-primary-element);
		}

		&:disabled {
			cursor: progress;
		}
	}

	&__name {
		align-items: center;
		display: flex;
		font-weight: bold;
		gap: 8px;
	}

	&__summary {
		color: var(--color-text-maxcontrast);
	}

	&__count {
		color: var(--color-text-maxcontrast);
		font-size: 0.9em;
	}
}
</style>
