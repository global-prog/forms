<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  The "break down by" control, revealed rather than always present.

  It is offered on every question that can be broken down, which on a long form is every
  card. A select on each of forty cards is a lot of furniture around the answers, and
  vue-select is not a cheap component to mount forty times when thirty-nine of them will
  never be touched. A button costs almost nothing and says the same thing.

  Not a disclosure widget: the button is replaced by the select rather than sitting above
  it, so there is one control at a time and nothing to collapse again. Choosing the empty
  option in the select is what returns the card to a single figure for everyone.
-->
<template>
	<div class="breakdown-picker">
		<NcButton
			v-if="!revealed"
			variant="tertiary"
			:disabled="!options.length"
			@click="reveal">
			<template #icon>
				<NcIconSvgWrapper :svg="IconCompare" />
			</template>
			{{ t('forms', 'Break down by…') }}
		</NcButton>
		<NcSelect
			v-else
			ref="select"
			class="breakdown-picker__select"
			:inputLabel="t('forms', 'Break down by')"
			:placeholder="placeholder"
			:options="options"
			:modelValue="modelValue"
			label="label"
			trackBy="id"
			@update:modelValue="$emit('update:modelValue', $event)" />
	</div>
</template>

<script>
import IconCompare from '@material-symbols/svg-400/outlined/compare_arrows.svg?raw'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcSelect from '@nextcloud/vue/components/NcSelect'

export default {
	name: 'BreakdownPicker',

	components: {
		NcButton,
		NcIconSvgWrapper,
		NcSelect,
	},

	props: {
		/** `{ id, label }` per question that can group this one */
		options: {
			type: Array,
			required: true,
		},

		/** The chosen question, or null for no breakdown */
		modelValue: {
			type: Object,
			default: null,
		},

		/** What no breakdown is called, which differs between an average and a count */
		placeholder: {
			type: String,
			required: true,
		},
	},

	emits: ['update:modelValue'],

	setup() {
		return { IconCompare }
	},

	data() {
		return {
			// Revealed from the start when something is already chosen, so a card that is
			// re-rendered does not hide the breakdown it is showing.
			revealed: this.modelValue !== null,
		}
	},

	methods: {
		/**
		 * Show the select and put the cursor in it, so the click that asked for it does
		 * not then require a second click to use it.
		 */
		reveal() {
			this.revealed = true
			this.$nextTick(() => {
				// NcSelect wraps vue-select, which wraps the input; whichever of these
				// exists is the thing to focus.
				const select = this.$refs.select
				const input = select?.$el?.querySelector('input')
				input?.focus()
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.breakdown-picker {
	margin-block-start: 8px;

	&__select {
		inline-size: 100%;
		max-inline-size: 320px;
	}
}

@media print {
	// A control is not a finding.
	.breakdown-picker {
		display: none;
	}
}
</style>
