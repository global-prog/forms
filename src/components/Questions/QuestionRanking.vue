<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
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
		v-on="commonListeners">
		<template #actions>
			<NcActionCheckbox
				:modelValue="extraSettings?.shuffleOptions"
				@update:modelValue="onShuffleOptionsChange">
				{{ t('forms', 'Shuffle options') }}
			</NcActionCheckbox>
			<NcActionButton closeAfterClick @click="isOptionDialogShown = true">
				<template #icon>
					<NcIconSvgWrapper :svg="IconContentPaste" />
				</template>
				{{ t('forms', 'Add multiple options') }}
			</NcActionButton>
		</template>

		<!-- Submit mode -->
		<div
			v-if="readOnly"
			class="question__content"
			role="group"
			:aria-labelledby="titleId"
			:aria-describedby="description ? descriptionId : undefined"
			:aria-errormessage="hasError ? errorId : undefined"
			:aria-invalid="hasError ? 'true' : undefined">
			<!-- Unranked pool -->
			<div class="ranking-unranked">
				<Draggable
					v-if="unrankedOptions.length > 0"
					v-model="unrankedOptions"
					class="ranking-unranked__pool"
					:animation="sortAnimation()"
					:group="'ranking_' + id"
					target=".sort-target"
					direction="horizontal"
					@start="onRankingStart"
					@end="onRankingEnd">
					<TransitionGroup
						tag="ul"
						:name="isRanking ? undefined : 'options-list-transition'"
						class="sort-target"
						:aria-label="t('forms', 'Options to rank')">
						<li v-for="option in unrankedOptions" :key="option.id">
							<button
								type="button"
								class="ranking-unranked__item"
								:data-option-id="option.id"
								@click="rankOption(option)">
								{{ option.text }}
							</button>
						</li>
					</TransitionGroup>
				</Draggable>
				<p v-else class="ranking-unranked__empty">
					{{ t('forms', 'All options ranked') }}
				</p>
			</div>

			<!-- Ranked list -->
			<div class="ranking-ranked">
				<p :id="rankingLabelId" class="ranking-section__label">
					{{ t('forms', 'Your ranking') }}
				</p>
				<Draggable
					v-model="rankedOptions"
					class="ranking-ranked__list"
					:animation="sortAnimation()"
					:group="'ranking_' + id"
					target=".sort-target"
					direction="vertical"
					handle=".ranking-item__drag-handle"
					@start="onRankingStart"
					@end="onRankingEnd">
					<TransitionGroup
						tag="ul"
						:name="isRanking ? undefined : 'options-list-transition'"
						class="sort-target"
						:aria-labelledby="rankingLabelId">
						<li
							v-for="(option, index) in rankedOptions"
							:key="option.id"
							class="ranking-item"
							:data-option-id="option.id">
							<NcActions
								:id="`ranking-${option.id}-drag`"
								:container="`#ranking-${option.id}-drag`"
								:aria-label="t('forms', 'Move option actions')"
								class="ranking-item__drag-handle"
								variant="tertiary-no-background">
								<template #icon>
									<NcIconSvgWrapper :svg="IconDragIndicator" />
								</template>
								<NcActionButton
									:disabled="index === 0"
									@click="onMoveUp(index)">
									<template #icon>
										<NcIconSvgWrapper :svg="IconArrowUp" />
									</template>
									{{ t('forms', 'Move option up') }}
								</NcActionButton>
								<NcActionButton
									:disabled="index === rankedOptions.length - 1"
									@click="onMoveDown(index)">
									<template #icon>
										<NcIconSvgWrapper :svg="IconArrowDown" />
									</template>
									{{ t('forms', 'Move option down') }}
								</NcActionButton>
							</NcActions>
							<span class="ranking-item__position"
								>{{ index + 1 }}.</span
							>
							<span class="ranking-item__text">{{ option.text }}</span>
							<NcButton
								class="ranking-item__remove"
								variant="tertiary"
								:ariaLabel="t('forms', 'Remove from ranking')"
								@click="unrankOption(option)">
								<template #icon>
									<NcIconSvgWrapper :svg="IconClose" />
								</template>
							</NcButton>
						</li>
					</TransitionGroup>
				</Draggable>
				<p v-if="rankedOptions.length === 0" class="ranking-ranked__empty">
					{{ t('forms', 'Tap options above to rank them') }}
				</p>
			</div>
			<!-- Ranking or moving an option takes the pressed button away from under the
			     keyboard focus; this tells screen-reader users where the option went. -->
			<p class="hidden-visually" aria-live="polite">
				{{ liveMessage }}
			</p>
		</div>

		<!-- Edit mode: manage options -->
		<template v-else>
			<div v-if="isLoading">
				<NcLoadingIcon :size="64" />
			</div>
			<Draggable
				v-else
				v-model="choices"
				class="question__content"
				:animation="sortAnimation()"
				direction="vertical"
				handle=".option__drag-handle"
				invertSwap
				target=".sort-target"
				@update="dirtyOptionsType = 'choice'"
				@start="onDragStart"
				@end="onDragEnd">
				<TransitionGroup
					tag="ul"
					:name="isDragging ? undefined : 'options-list-transition'"
					class="sort-target">
					<AnswerInput
						v-for="(answer, index) in choices"
						:key="answer.local ? 'option-local' : answer.id"
						ref="input"
						:answer="answer"
						:formId="formId"
						:index="index"
						:isUnique="true"
						:maxIndex="options.length - 1"
						:maxOptionLength="maxStringLengths.optionText"
						:isRanking="true"
						optionType="choice"
						@createAnswer="onCreateAnswer"
						@update:answer="updateAnswer"
						@delete="deleteOption"
						@focusNext="focusNextInput"
						@moveUp="onOptionMoveUp(index, OptionType.Choice)"
						@moveDown="onOptionMoveDown(index, OptionType.Choice)"
						@tabbedOut="checkValidOption" />
				</TransitionGroup>
			</Draggable>
		</template>

		<!-- Add multiple options modal -->
		<OptionInputDialog
			v-model:open="isOptionDialogShown"
			@multipleAnswers="handleMultipleOptions" />
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconClose from '@material-symbols/svg-400/outlined/close.svg?raw'
import IconContentPaste from '@material-symbols/svg-400/outlined/content_paste.svg?raw'
import IconDragIndicator from '@material-symbols/svg-400/outlined/drag_indicator.svg?raw'
import IconArrowDown from '@material-symbols/svg-400/outlined/keyboard_arrow_down.svg?raw'
import IconArrowUp from '@material-symbols/svg-400/outlined/keyboard_arrow_up.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import { VueDraggable as Draggable } from 'vue-draggable-plus'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import OptionInputDialog from '../OptionInputDialog.vue'
import AnswerInput from './AnswerInput.vue'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import QuestionMultipleMixin from '../../mixins/QuestionMultipleMixin.ts'
import { OptionType } from '../../models/Constants.ts'

export default {
	name: 'QuestionRanking',

	components: {
		AnswerInput,
		Draggable,
		NcActionButton,
		NcActionCheckbox,
		NcActions,
		NcButton,
		NcIconSvgWrapper,
		NcLoadingIcon,
		OptionInputDialog,
		Question,
	},

	mixins: [QuestionMixin, QuestionMultipleMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconArrowDown,
			IconArrowUp,
			IconClose,
			IconContentPaste,
			IconDragIndicator,
		}
	},

	data() {
		return {
			errorMessage: null,
			isDragging: false,
			isRanking: false,
			isLoading: false,
			isOptionDialogShown: false,
			liveMessage: '',
			rankedOptions: [],
			// The shuffled order of the choices, kept for as long as the set of choices
			// stays the same (see choicesInOrder)
			shuffledChoiceIds: [],
			unrankedOptions: [],
			OptionType,
		}
	},

	computed: {
		rankingLabelId() {
			return `${this.titleId}-ranking`
		},

		shiftDragHandle() {
			return !this.readOnly && this.options.length !== 0 && !this.isLastEmpty
		},

		choices: {
			get() {
				return this.sortOptionsOfType(this.options, OptionType.Choice)
			},

			set(value) {
				this.updateOptionsOrder(value, OptionType.Choice)
			},
		},
	},

	watch: {
		options: {
			immediate: true,
			handler() {
				this.initRankedOptions()
			},
		},

		values: {
			immediate: true,
			handler() {
				this.initRankedOptions()
			},
		},
	},

	methods: {
		async validate() {
			const optionsCount = this.sortOptionsOfType(
				this.options,
				OptionType.Choice,
			).length

			if (
				(this.isRequired && this.rankedOptions.length === 0)
				|| (this.rankedOptions.length > 0
					&& this.rankedOptions.length !== optionsCount)
			) {
				this.errorMessage = t('forms', 'You must rank all options')
				return false
			}

			this.errorMessage = null
			return true
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
		 * Initialize ranked/unranked options from existing values or default order
		 */
		initRankedOptions() {
			const sorted = this.choicesInOrder()

			if (this.values && this.values.length > 0) {
				// Restore order from saved values (array of option IDs)
				const byId = Object.fromEntries(sorted.map((o) => [o.id, o]))
				this.rankedOptions = this.values
					.map((id) => byId[parseInt(id)])
					.filter(Boolean)
				this.unrankedOptions = sorted.filter(
					(o) => !this.rankedOptions.some((r) => r.id === o.id),
				)
			} else if (this.readOnly) {
				// Submit mode: start with all options unranked
				this.rankedOptions = []
				this.unrankedOptions = [...sorted]
			} else {
				// Edit mode: show all options in default order
				this.rankedOptions = [...sorted]
				this.unrankedOptions = []
			}
		},

		/**
		 * The choices in the order the respondent sees them.
		 *
		 * Every rank or unrank writes the answer back through the values watcher, which
		 * rebuilds both lists. With shuffling on, a fresh shuffle each time would make
		 * the options not yet ranked jump around after every tap, so the first shuffle is
		 * kept until the choices themselves change.
		 *
		 * @return {Array} the choices
		 */
		choicesInOrder() {
			const sorted = this.sortOptionsOfType(this.options, OptionType.Choice)
			if (!this.readOnly || !this.extraSettings?.shuffleOptions) {
				return sorted
			}

			const byId = new Map(sorted.map((option) => [option.id, option]))
			const kept = this.shuffledChoiceIds
			if (
				kept.length !== byId.size
				|| kept.some((optionId) => !byId.has(optionId))
			) {
				this.shuffledChoiceIds = sorted.map((option) => option.id)
				return sorted
			}
			return kept.map((optionId) => byId.get(optionId))
		},

		/**
		 * Move an option from the unranked pool to the ranked list
		 *
		 * @param {object} option The option to rank
		 */
		rankOption(option) {
			const poolIndex = this.unrankedOptions.findIndex(
				(o) => o.id === option.id,
			)
			this.unrankedOptions = this.unrankedOptions.filter(
				(o) => o.id !== option.id,
			)
			this.rankedOptions.push(option)
			this.emitValues()
			this.announceMove(option, this.rankedOptions.length)

			// The pressed button is gone: stay in the pool on its neighbour, or move to
			// the option just ranked once the pool is empty.
			this.$nextTick(() => {
				const pool = this.unrankedOptions
				if (pool.length > 0) {
					const next = pool[Math.min(poolIndex, pool.length - 1)]
					this.focusOption(next.id, '.ranking-unranked__item')
				} else {
					this.focusOption(option.id, '.ranking-item__remove')
				}
			})
		},

		/**
		 * Move an option from the ranked list back to the unranked pool
		 *
		 * @param {object} option The option to unrank
		 */
		unrankOption(option) {
			const rankIndex = this.rankedOptions.findIndex((o) => o.id === option.id)
			this.rankedOptions = this.rankedOptions.filter((o) => o.id !== option.id)
			this.unrankedOptions.push(option)
			this.emitValues()
			this.liveMessage = t(
				'forms',
				'{option} removed from ranking',
				{ option: option.text },
				undefined,
				{ escape: false },
			)

			// As above: move to the neighbouring ranked option, or back to the pool
			// once nothing is ranked any more.
			this.$nextTick(() => {
				const ranked = this.rankedOptions
				if (ranked.length > 0) {
					const next = ranked[Math.min(rankIndex, ranked.length - 1)]
					this.focusOption(next.id, '.ranking-item__remove')
				} else {
					this.focusOption(option.id, '.ranking-unranked__item')
				}
			})
		},

		/**
		 * Move the ranked option at index up by one position
		 *
		 * @param {number} index Current index
		 */
		onMoveUp(index) {
			if (index <= 0) return
			const items = [...this.rankedOptions]
			;[items[index - 1], items[index]] = [items[index], items[index - 1]]
			this.rankedOptions = items
			this.emitValues()
			this.afterMove(items[index - 1], index - 1, 'up')
		},

		/**
		 * Move the ranked option at index down by one position
		 *
		 * @param {number} index Current index
		 */
		onMoveDown(index) {
			if (index >= this.rankedOptions.length - 1) return
			const items = [...this.rankedOptions]
			;[items[index], items[index + 1]] = [items[index + 1], items[index]]
			this.rankedOptions = items
			this.emitValues()
			this.afterMove(items[index + 1], index + 1, 'down')
		},

		/**
		 * Keep the keyboard on a moved option: its row is moved in the page, which
		 * drops the focus, so put it back and say where the option went.
		 *
		 * The move menu stays open after a move, so the respondent can press the same
		 * entry again; focus returns to that entry, or to the other one once the option
		 * has reached the top or bottom and the entry is disabled. With the menu closed,
		 * focus goes to the menu's trigger.
		 *
		 * @param {object} option The option that moved
		 * @param {number} newIndex Its new index in the ranking
		 * @param {string} direction 'up' or 'down'
		 */
		afterMove(option, newIndex, direction) {
			this.announceMove(option, newIndex + 1)
			this.$nextTick(() => {
				const menu = document.getElementById(`ranking-${option.id}-drag`)
				const [up, down] = menu?.querySelectorAll('.action-button') ?? []
				const preferred = direction === 'up' ? [up, down] : [down, up]
				const entry = preferred.find((button) => button && !button.disabled)
				entry?.focus()
				if (!entry || document.activeElement !== entry) {
					this.focusOption(option.id, '.action-item__menutoggle')
				}
			})
		},

		/**
		 * Tell screen-reader users the position an option now has
		 *
		 * @param {object} option The option
		 * @param {number} position Its position in the ranking, starting at 1
		 */
		announceMove(option, position) {
			this.liveMessage = t(
				'forms',
				'{option} moved to position {position}',
				{ option: option.text, position },
				undefined,
				{ escape: false },
			)
		},

		/**
		 * Focus a control that belongs to an option. The option lists are rebuilt on
		 * every change, so the element is looked up by option rather than kept.
		 *
		 * @param {number} optionId The option's id
		 * @param {string} selector The control to focus, on or inside the option's element
		 */
		focusOption(optionId, selector) {
			// An element that is still sliding out carries the same option id, so take
			// the first one that actually holds the control.
			const elements =
				this.$el?.querySelectorAll?.(`[data-option-id="${optionId}"]`) ?? []
			for (const element of elements) {
				const target = element.matches(selector)
					? element
					: element.querySelector(selector)
				if (target) {
					target.focus()
					return
				}
			}
		},

		onRankingStart() {
			this.isRanking = true
		},

		/**
		 * Emit the current ranking after a drag reorder
		 */
		onRankingEnd() {
			this.$nextTick(() => {
				this.isRanking = false
			})
			this.emitValues()
		},

		/**
		 * Emit the current values based on ranking state
		 */
		emitValues() {
			if (this.rankedOptions.length === 0) {
				// Nothing ranked — emit empty to signal unanswered
				this.$emit('update:values', [])
			} else {
				this.$emit(
					'update:values',
					this.rankedOptions.map((o) => o.id),
				)
			}
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

.ranking-section__label {
	color: var(--color-text-maxcontrast);
	margin-block-end: var(--default-grid-baseline);
	font-size: small;
}

.ranking-unranked {
	margin-block-end: calc(2 * var(--default-grid-baseline));

	&__pool {
		display: flex;
		flex-wrap: wrap;
		gap: var(--default-grid-baseline);
	}

	&__item {
		display: inline-block;
		padding: var(--default-grid-baseline) calc(2 * var(--default-grid-baseline));
		background-color: var(--color-background-dark);
		border: 1px solid var(--color-border);
		border-radius: var(--border-radius-large);
		cursor: pointer;
		font-size: inherit;
		color: var(--color-main-text);
		transition: background-color var(--animation-quick);

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
			border-color: var(--color-primary-element);
		}
	}

	&__empty {
		color: var(--color-text-maxcontrast);
		font-style: italic;
		padding: var(--default-grid-baseline) 0;
	}

	li {
		display: inline-block;
	}
}

.ranking-ranked {
	&__list {
		display: flex;
		flex-direction: column;
		gap: var(--default-grid-baseline);
	}

	&__empty {
		color: var(--color-text-maxcontrast);
		font-style: italic;
		padding: var(--default-grid-baseline) 0;
	}
}

.ranking-item {
	display: flex;
	align-items: center;
	min-height: var(--default-clickable-area);
	border-radius: var(--border-radius-large);
	user-select: none;
	transition-property: background-color;
	transition-duration: 0.1s;
	transition-timing-function: linear;

	&:hover,
	&:focus-within {
		background-color: var(--color-background-hover);
	}

	&__position {
		font-weight: bold;
		min-width: 1.5em;
		text-align: end;
		margin-inline-end: calc(3 * var(--default-grid-baseline));
		color: var(--color-text-maxcontrast);
	}

	&__text {
		flex: 1;
	}

	&__drag-handle {
		color: var(--color-text-maxcontrast);
		cursor: grab;

		&:hover,
		&:focus,
		&:focus-within {
			color: var(--color-main-text);
		}

		&:active {
			cursor: grabbing;
		}
	}
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

.options-list-transition-leave-active {
	position: absolute;
}
</style>
