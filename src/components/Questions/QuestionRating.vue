<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  star rating question (upstream issue #356).

  linearscale already covers 1..N, but as a row of radio buttons. This is the compact star
  widget people expect from Google Forms. The stored answer is just the number, so results
  and CSV exports need no special handling.

  Implemented as real radio inputs rather than clickable icons, so it is keyboard-navigable
  and announced correctly by screen readers.
-->
<template>
	<Question
		v-bind="questionProps"
		:titlePlaceholder="answerType.titlePlaceholder"
		:warningInvalid="answerType.warningInvalid"
		:errorMessage="errorMessage"
		:isTriggerQuestion="isTriggerQuestion"
		v-on="commonListeners">
		<!-- In the question's own menu, as every other type does. A separate button after
		     the stars wrapped onto a line of its own and, drawn with the same empty star,
		     looked like one more star to pick. -->
		<template #actions>
			<NcActionInput
				type="number"
				min="2"
				max="10"
				:label="t('forms', 'Number of stars')"
				:modelValue="String(maxRating)"
				@submit="onChangeMax"
				@input="onChangeMax" />
			<NcActionRadio
				v-for="option in ['star', 'heart', 'thumb']"
				:key="option"
				:modelValue="ratingIcon"
				:name="`ratingIcon_${id}`"
				:value="option"
				@update:modelValue="onChangeIcon(option)">
				{{ iconLabel(option) }}
			</NcActionRadio>
		</template>
		<div class="question__content">
			<fieldset class="rating" :disabled="!readOnly">
				<legend class="hidden-visually">
					{{ text || t('forms', 'Rating') }}
				</legend>
				<label
					v-for="star in maxRating"
					:key="star"
					class="rating__star"
					:class="{ 'rating__star--on': star <= currentValue }"
					:title="n('forms', '%n star', '%n stars', star)">
					<input
						class="hidden-visually"
						type="radio"
						:name="`rating_${id}`"
						:aria-label="
							n('forms', '%n out of {max}', '%n out of {max}', star, {
								max: maxRating,
							})
						"
						:value="star"
						:checked="star === currentValue"
						:required="isRequired && !currentValue"
						@change="onPick(star)" />
					<NcIconSvgWrapper
						:svg="star <= currentValue ? iconFull : iconEmpty" />
				</label>
				<NcButton
					v-if="readOnly && currentValue"
					variant="tertiary"
					@click="onPick(0)">
					{{ t('forms', 'Clear') }}
				</NcButton>
			</fieldset>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconHeartFilled from '@material-symbols/svg-400/outlined/favorite-fill.svg?raw'
import IconHeart from '@material-symbols/svg-400/outlined/favorite.svg?raw'
import IconStarFilled from '@material-symbols/svg-400/outlined/star-fill.svg?raw'
import IconStar from '@material-symbols/svg-400/outlined/star.svg?raw'
import IconThumbFilled from '@material-symbols/svg-400/outlined/thumb_up-fill.svg?raw'
import IconThumb from '@material-symbols/svg-400/outlined/thumb_up.svg?raw'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActionRadio from '@nextcloud/vue/components/NcActionRadio'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'

/** Google Forms' default, and what most surveys use */
const DEFAULT_MAX_RATING = 5

export default {
	name: 'QuestionRating',

	components: {
		NcActionInput,
		NcActionRadio,
		NcButton,
		NcIconSvgWrapper,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconStar,
			IconStarFilled,
			IconHeart,
			IconHeartFilled,
			IconThumb,
			IconThumbFilled,
		}
	},

	computed: {
		/** @return {number} how many stars to offer */
		maxRating() {
			const configured = this.extraSettings?.maxRating
			return typeof configured === 'number'
				&& configured >= 2
				&& configured <= 10
				? configured
				: DEFAULT_MAX_RATING
		},

		/** @return {string} which icon set to draw */
		ratingIcon() {
			const icon = this.extraSettings?.ratingIcon
			return ['star', 'heart', 'thumb'].includes(icon) ? icon : 'star'
		},

		/** @return {string} the outline icon for the chosen set */
		iconEmpty() {
			return {
				star: this.IconStar,
				heart: this.IconHeart,
				thumb: this.IconThumb,
			}[this.ratingIcon]
		},

		/** @return {string} the filled icon for the chosen set */
		iconFull() {
			return {
				star: this.IconStarFilled,
				heart: this.IconHeartFilled,
				thumb: this.IconThumbFilled,
			}[this.ratingIcon]
		},

		/** @return {number} the currently selected star count, 0 when unanswered */
		currentValue() {
			return parseInt(this.values?.[0]) || 0
		},
	},

	methods: {
		/**
		 * @param {number} star the chosen star count, or 0 to clear
		 */
		onPick(star) {
			this.$emit('update:values', star ? [String(star)] : [])
			this.errorMessage = null
		},

		/**
		 * @param {Event} event the input/submit event
		 */
		onChangeMax(event) {
			const value = parseInt(event?.target?.value)
			if (!isNaN(value) && value >= 2 && value <= 10) {
				this.onExtraSettingsChange({ maxRating: value })
			}
		},

		/**
		 * @param {string} option 'star', 'heart' or 'thumb'
		 * @return {string} the human label for that icon
		 */
		iconLabel(option) {
			return {
				star: t('forms', 'Stars'),
				heart: t('forms', 'Hearts'),
				thumb: t('forms', 'Thumbs up'),
			}[option]
		},

		/**
		 * @param {string} option the chosen icon set
		 */
		onChangeIcon(option) {
			this.onExtraSettingsChange({
				ratingIcon: option === 'star' ? undefined : option,
			})
		},

		async validate() {
			if (this.isRequired && !this.currentValue) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}
			this.errorMessage = null
			return true
		},
	},
}
</script>

<style lang="scss" scoped>
.rating {
	align-items: center;
	border: none;
	display: flex;
	// Ten stars plus a Clear button will not fit one line on a phone.
	flex-wrap: wrap;
	gap: 2px;
	margin: 0;
	padding: 0;

	&__star {
		align-items: center;
		border-radius: var(--border-radius);
		color: var(--color-text-maxcontrast);
		cursor: pointer;
		display: inline-flex;
		justify-content: center;
		// Comfortable pointer target. The icon itself stays small; the hit area does not.
		min-height: 44px;
		min-width: 44px;
		transition:
			color 0.1s ease-in-out,
			transform 0.1s ease-in-out;

		&:hover {
			transform: scale(1.1);
		}

		@media (prefers-reduced-motion: reduce) {
			transition: none;

			&:hover {
				transform: none;
			}
		}

		&--on {
			color: var(--color-favorite, var(--color-warning));
		}

		&:focus-within {
			outline: 2px solid var(--color-primary-element);
			outline-offset: -2px;
		}
	}

	&:disabled &__star {
		cursor: default;
	}
}
</style>
