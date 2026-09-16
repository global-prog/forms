<!--
  - SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcDialog
		:name="t('forms', 'Add multiple options')"
		:open="open"
		:buttons="buttons"
		size="normal"
		@update:open="$emit('update:open', $event)">
		<!-- NcDialog teleports its content, so this wrapper is the nearest element that
		     carries this component's scope id; the styles below hang off it. -->
		<div class="options-body">
			<div class="options-text-area">
				<NcTextArea
					v-model="enteredOptions"
					:label="t('forms', 'Add multiple options (one per line)')"
					:placeholder="t('forms', 'Add multiple options (one per line)')"
					resize="vertical"
					rows="10" />
			</div>
			<NcSelect
				:inputLabel="t('forms', 'Options')"
				multiple
				disabled
				:modelValue="multipleOptions" />
		</div>
	</NcDialog>
</template>

<script>
import IconCheck from '@material-symbols/svg-400/outlined/check.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import { defineComponent } from 'vue'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import NcTextArea from '@nextcloud/vue/components/NcTextArea'

export default defineComponent({
	name: 'OptionInputDialog',

	components: {
		NcDialog,
		NcSelect,
		NcTextArea,
	},

	props: {
		open: {
			type: Boolean,
			required: true,
		},
	},

	emits: ['update:open', 'multipleAnswers'],

	data() {
		return {
			enteredOptions: '',
		}
	},

	computed: {
		buttons() {
			return [
				{
					label: t('forms', 'Cancel'),
					callback: () => {
						this.$emit('update:open', false)
					},
				},
				{
					label: t('forms', 'Add options'),
					// `type` is the HTML button type; the look comes from `variant`.
					variant: 'primary',
					icon: IconCheck,
					disabled: this.multipleOptions.length === 0,
					callback: () => this.onMultipleOptions(),
				},
			]
		},

		multipleOptions() {
			const allOptions = this.enteredOptions.split(/\r?\n/g)
			return allOptions.filter((answer) => {
				return answer.trim().length > 0
			})
		},
	},

	methods: {
		t,

		onMultipleOptions() {
			// The button is disabled while there is nothing to add. A single line is
			// simply one option: rejecting it only closed the dialog on an error.
			if (this.multipleOptions.length === 0) {
				return false
			}
			this.$emit('multipleAnswers', this.multipleOptions)
			this.enteredOptions = ''
			this.$emit('update:open', false)
		},
	},
})
</script>

<style scoped>
.options-body {
	padding-block: 0 12px;
	padding-inline: 8px 20px;
}

.options-body :deep(.v-select) {
	width: 100%;
	margin-block-start: 10px;
	display: flex;
	flex-direction: column;
	gap: 2px 0;
}

.options-text-area {
	height: 210px;
}
</style>
