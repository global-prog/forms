<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  authoring UI for the two rules the engine supports.

    displayCondition -- show this question only when an EARLIER question matches
    branching        -- send the respondent to a section (or straight to submit)
                        depending on which option they chose

  Both are stored in extra_settings_json, so nothing here needs a migration. The shapes
  written must stay in sync with SubmissionService::isQuestionVisible() /
  ::getReachableQuestions() and src/utils/DisplayConditions.js.

  Only native inputs are used, so this cannot break on a component-API change.
-->
<template>
	<NcDialog
		:open="open"
		:name="t('forms', 'Logic')"
		size="normal"
		@update:open="$emit('update:open', $event)">
		<div class="logic">
			<!-- ------------------------------------------------ show/hide -->
			<h4 class="logic__heading">{{ t('forms', 'Show this question') }}</h4>

			<NcCheckboxRadioSwitch
				:modelValue="hasCondition"
				@update:modelValue="toggleCondition">
				{{ t('forms', 'Only if earlier answers match') }}
			</NcCheckboxRadioSwitch>

			<template v-if="hasCondition">
				<p v-if="sourceCandidates.length === 0" class="logic__empty">
					{{
						t(
							'forms',
							'There are no earlier questions to base a condition on. Move this question further down the form.',
						)
					}}
				</p>

				<template v-else>
					<label class="logic__row">
						<span>{{ t('forms', 'Match') }}</span>
						<select
							:value="match"
							:aria-label="
								t(
									'forms',
									'Whether all rules or any rule must match',
								)
							"
							@change="onMatchChange">
							<option value="all">
								{{ t('forms', 'all rules') }}
							</option>
							<option value="any">{{ t('forms', 'any rule') }}</option>
						</select>
					</label>

					<div
						v-for="(rule, index) in rules"
						:key="index"
						class="logic__rule">
						<select
							:value="rule.questionId"
							:aria-label="t('forms', 'Question this rule looks at')"
							@change="onRuleQuestion(index, $event)">
							<option disabled value="">
								{{ t('forms', 'Choose a question') }}
							</option>
							<option
								v-for="candidate in sourceCandidates"
								:key="candidate.id"
								:value="candidate.id">
								{{
									candidate.text || t('forms', 'Untitled question')
								}}
							</option>
						</select>

						<!-- choice questions: pick an option -->
						<select
							v-if="ruleKind(rule) === 'choice'"
							:value="rule.conditions?.[0]?.optionId ?? ''"
							:aria-label="t('forms', 'Answer that must be chosen')"
							@change="onRuleOption(index, $event)">
							<option disabled value="">
								{{ t('forms', 'Choose an answer') }}
							</option>
							<option
								v-for="option in optionsFor(rule.questionId)"
								:key="option.id"
								:value="option.id">
								{{ option.text }}
							</option>
						</select>

						<!-- text questions: operator + value -->
						<template v-else-if="ruleKind(rule) === 'text'">
							<select
								:value="
									rule.conditions?.[0]?.type ?? 'string_contains'
								"
								:aria-label="t('forms', 'How the text is compared')"
								@change="onRuleType(index, $event)">
								<option value="string_contains">
									{{ t('forms', 'contains') }}
								</option>
								<option value="string_equals">
									{{ t('forms', 'is') }}
								</option>
								<option value="regex">
									{{ t('forms', 'matches pattern') }}
								</option>
							</select>
							<input
								type="text"
								:value="rule.conditions?.[0]?.value ?? ''"
								:placeholder="t('forms', 'Value')"
								:aria-label="t('forms', 'Value to compare against')"
								@input="onRuleValue(index, $event)" />
						</template>

						<!-- numeric questions: operator + value -->
						<template v-else-if="ruleKind(rule) === 'number'">
							<select
								:value="rule.conditions?.[0]?.type ?? 'value_equals'"
								@change="onRuleType(index, $event)">
								<option value="value_equals">
									{{ t('forms', 'is') }}
								</option>
								<option value="value_not_equals">
									{{ t('forms', 'is not') }}
								</option>
								<option value="value_min">
									{{ t('forms', 'is at least') }}
								</option>
								<option value="value_max">
									{{ t('forms', 'is at most') }}
								</option>
							</select>
							<input
								type="number"
								:value="rule.conditions?.[0]?.value ?? ''"
								:aria-label="t('forms', 'Number to compare against')"
								@input="onRuleValue(index, $event, true)" />
						</template>

						<span v-else class="logic__empty">
							{{
								t(
									'forms',
									'This question type cannot be used as a condition.',
								)
							}}
						</span>

						<NcButton variant="tertiary" @click="removeRule(index)">
							{{ t('forms', 'Remove') }}
						</NcButton>
					</div>

					<NcButton variant="secondary" @click="addRule">
						{{ t('forms', 'Add rule') }}
					</NcButton>
				</template>
			</template>

			<!-- ------------------------------------------------ answer key -->
			<template v-if="isQuiz">
				<h4 class="logic__heading">{{ t('forms', 'Answer key') }}</h4>
				<p class="logic__empty">
					{{
						t(
							'forms',
							'Leave blank to exclude this question from scoring.',
						)
					}}
				</p>

				<label class="logic__row">
					<span>{{ t('forms', 'Points') }}</span>
					<input
						type="number"
						min="0"
						step="1"
						:value="points"
						:aria-label="t('forms', 'Points for a correct answer')"
						@input="onPointsChange" />
				</label>

				<!-- choice questions: tick the correct options -->
				<template v-if="options.length > 0">
					<NcCheckboxRadioSwitch
						v-for="option in options"
						:key="option.id"
						:modelValue="isCorrectOption(option.id)"
						@update:modelValue="
							onToggleCorrectOption(option.id, $event)
						">
						{{ option.text }}
					</NcCheckboxRadioSwitch>
				</template>

				<!-- everything else: type the expected answer -->
				<template v-else>
					<label class="logic__row">
						<span>{{ t('forms', 'Correct answer') }}</span>
						<input
							type="text"
							:value="correctAnswer"
							:aria-label="t('forms', 'The expected answer')"
							@input="onCorrectAnswerChange" />
					</label>
					<NcCheckboxRadioSwitch
						:modelValue="caseSensitive"
						@update:modelValue="onCaseSensitiveChange">
						{{ t('forms', 'Match upper and lower case exactly') }}
					</NcCheckboxRadioSwitch>
				</template>

				<label class="logic__row">
					<span>{{ t('forms', 'Feedback if correct') }}</span>
					<input
						type="text"
						:value="feedbackCorrect"
						:aria-label="t('forms', 'Shown when the answer is right')"
						@input="onFeedbackChange('feedbackCorrect', $event)" />
				</label>
				<label class="logic__row">
					<span>{{ t('forms', 'Feedback if incorrect') }}</span>
					<input
						type="text"
						:value="feedbackIncorrect"
						:aria-label="t('forms', 'Shown when the answer is wrong')"
						@input="onFeedbackChange('feedbackIncorrect', $event)" />
				</label>
			</template>

			<!-- ------------------------------------------------ branching -->
			<template v-if="options.length > 0">
				<h4 class="logic__heading">
					{{ t('forms', 'After this question, go to') }}
				</h4>
				<p v-if="sectionTargets.length === 0" class="logic__empty">
					{{
						t(
							'forms',
							'Add a section break later in the form to be able to jump to it.',
						)
					}}
				</p>
				<div v-for="option in options" :key="option.id" class="logic__row">
					<span class="logic__option">{{ option.text }}</span>
					<select
						:value="targetOf(option.id)"
						@change="onTarget(option.id, $event)">
						<option value="next">{{ t('forms', 'Next page') }}</option>
						<option
							v-for="section in sectionTargets"
							:key="section.id"
							:value="`section:${section.id}`">
							{{ section.text || t('forms', 'Untitled section') }}
						</option>
						<option value="submit">
							{{ t('forms', 'Submit the form') }}
						</option>
					</select>
				</div>
			</template>
		</div>
	</NcDialog>
</template>

<script>
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'

/** Source types the condition engine understands, grouped by the input they need */
const CHOICE_TYPES = ['multiple_unique', 'dropdown', 'multiple']
const TEXT_TYPES = ['short', 'long']
const NUMBER_TYPES = ['linearscale', 'time']

export default {
	name: 'QuestionLogicDialog',

	components: {
		NcButton,
		NcCheckboxRadioSwitch,
		NcDialog,
	},

	inject: {
		formQuestions: { default: () => [] },
		formSettings: { default: () => ({}) },
	},

	props: {
		open: {
			type: Boolean,
			default: false,
		},

		questionId: {
			type: Number,
			required: true,
		},

		extraSettings: {
			type: Object,
			default: () => ({}),
		},

		options: {
			type: Array,
			default: () => [],
		},
	},

	emits: ['update:open', 'update:extraSettings'],

	computed: {
		/** @return {Array} every question of the form, in order */
		allQuestions() {
			const questions =
				typeof this.formQuestions === 'function'
					? this.formQuestions()
					: this.formQuestions
			return Array.isArray(questions) ? questions : []
		},

		/** @return {number} this question's position in the form */
		ownIndex() {
			return this.allQuestions.findIndex((q) => q.id === this.questionId)
		},

		/**
		 * Only EARLIER questions may drive a condition: a rule referencing a later answer
		 * could never be satisfied at the moment the question is shown.
		 *
		 * @return {Array} questions usable as a condition source
		 */
		sourceCandidates() {
			if (this.ownIndex < 0) {
				return []
			}
			return this.allQuestions
				.slice(0, this.ownIndex)
				.filter((q) =>
					[...CHOICE_TYPES, ...TEXT_TYPES, ...NUMBER_TYPES].includes(
						q.type,
					),
				)
		},

		/** @return {Array} sections after this question, i.e. valid jump targets */
		sectionTargets() {
			if (this.ownIndex < 0) {
				return []
			}
			return this.allQuestions
				.slice(this.ownIndex + 1)
				.filter((q) => q.type === 'section')
		},

		/** @return {boolean} whether this form grades responses */
		isQuiz() {
			const settings =
				typeof this.formSettings === 'function'
					? this.formSettings()
					: this.formSettings
			return settings?.quizMode === true
		},

		/** @return {number} points awarded for a correct answer */
		points() {
			return this.extraSettings?.points ?? 1
		},

		/** @return {string} the expected answer for a non-choice question */
		correctAnswer() {
			return this.extraSettings?.correctAnswer || ''
		},

		/** @return {boolean} whether case must match */
		caseSensitive() {
			return this.extraSettings?.caseSensitive === true
		},

		/** @return {string} feedback shown for a correct answer */
		feedbackCorrect() {
			return this.extraSettings?.feedbackCorrect || ''
		},

		/** @return {string} feedback shown for an incorrect answer */
		feedbackIncorrect() {
			return this.extraSettings?.feedbackIncorrect || ''
		},

		/** @return {object|null} the stored displayCondition */
		condition() {
			return this.extraSettings?.displayCondition ?? null
		},

		/** @return {boolean} whether a condition is configured */
		hasCondition() {
			return !!this.condition
		},

		/** @return {string} 'all' or 'any' */
		match() {
			return this.condition?.match === 'any' ? 'any' : 'all'
		},

		/** @return {Array} the configured rules */
		rules() {
			return this.condition?.rules ?? []
		},
	},

	methods: {
		/**
		 * @param {number} optionId the option to test
		 * @return {boolean} whether it is part of the answer key
		 */
		isCorrectOption(optionId) {
			return (this.extraSettings?.correctOptions ?? []).includes(optionId)
		},

		/**
		 * @param {number} optionId the option toggled
		 * @param {boolean} correct whether it is now part of the key
		 */
		onToggleCorrectOption(optionId, correct) {
			const current = this.extraSettings?.correctOptions ?? []
			const next = correct
				? [...current, optionId]
				: current.filter((id) => id !== optionId)
			this.$emit('update:extraSettings', {
				correctOptions: next.length ? next : undefined,
			})
		},

		/** @param {Event} event the input event */
		onPointsChange(event) {
			const value = parseInt(event.target.value)
			this.$emit('update:extraSettings', {
				points: isNaN(value) || value < 0 ? undefined : value,
			})
		},

		/** @param {Event} event the input event */
		onCorrectAnswerChange(event) {
			this.$emit('update:extraSettings', {
				correctAnswer: event.target.value || undefined,
			})
		},

		/** @param {boolean} checked whether case must match */
		onCaseSensitiveChange(checked) {
			this.$emit('update:extraSettings', {
				caseSensitive: checked || undefined,
			})
		},

		/**
		 * @param {string} key which feedback field
		 * @param {Event} event the input event
		 */
		onFeedbackChange(key, event) {
			this.$emit('update:extraSettings', {
				[key]: event.target.value || undefined,
			})
		},

		/**
		 * @param {object} rule the rule to classify
		 * @return {string} which input the rule's source question needs
		 */
		ruleKind(rule) {
			const source = this.allQuestions.find((q) => q.id === rule.questionId)
			if (!source) {
				return 'unknown'
			}
			if (CHOICE_TYPES.includes(source.type)) {
				return 'choice'
			}
			if (TEXT_TYPES.includes(source.type)) {
				return 'text'
			}
			if (NUMBER_TYPES.includes(source.type)) {
				return 'number'
			}
			return 'unknown'
		},

		/**
		 * @param {number} questionId source question
		 * @return {Array} that question's answer options
		 */
		optionsFor(questionId) {
			return this.allQuestions.find((q) => q.id === questionId)?.options ?? []
		},

		/**
		 * @param {object} displayCondition the new condition, or null to clear it
		 */
		save(displayCondition) {
			this.$emit('update:extraSettings', { displayCondition })
		},

		/**
		 * @param {boolean} enabled whether to attach a condition
		 */
		toggleCondition(enabled) {
			this.save(enabled ? { match: 'all', rules: [] } : undefined)
		},

		/** @param {Event} event the select change */
		onMatchChange(event) {
			this.save({ ...this.condition, match: event.target.value })
		},

		addRule() {
			const first = this.sourceCandidates[0]
			this.save({
				...this.condition,
				rules: [...this.rules, { questionId: first?.id, conditions: [{}] }],
			})
		},

		/** @param {number} index rule to drop */
		removeRule(index) {
			const rules = this.rules.filter((_, i) => i !== index)
			this.save({ ...this.condition, rules })
		},

		/**
		 * @param {number} index rule being edited
		 * @param {object} conditions replacement conditions
		 * @param {number|undefined} questionId replacement source question
		 */
		updateRule(index, conditions, questionId) {
			const rules = this.rules.map((rule, i) =>
				i === index
					? {
							questionId: questionId ?? rule.questionId,
							conditions,
						}
					: rule,
			)
			this.save({ ...this.condition, rules })
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the select change
		 */
		onRuleQuestion(index, event) {
			// Changing the source invalidates the old condition, so start it fresh.
			this.updateRule(index, [{}], Number(event.target.value))
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the select change
		 */
		onRuleOption(index, event) {
			this.updateRule(index, [{ optionId: Number(event.target.value) }])
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the select change
		 */
		onRuleType(index, event) {
			const existing = this.rules[index]?.conditions?.[0] ?? {}
			this.updateRule(index, [{ ...existing, type: event.target.value }])
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the input event
		 * @param {boolean} numeric whether to store a number
		 */
		onRuleValue(index, event, numeric = false) {
			const existing = this.rules[index]?.conditions?.[0] ?? {}
			const raw = event.target.value
			this.updateRule(index, [
				{ ...existing, value: numeric ? parseFloat(raw) : raw },
			])
		},

		/**
		 * @param {number} optionId the answer option
		 * @return {string} the currently selected target
		 */
		targetOf(optionId) {
			const rule = this.extraSettings?.branching?.byOption?.[String(optionId)]
			if (rule?.target === 'submit') {
				return 'submit'
			}
			if (rule?.target === 'section') {
				return `section:${rule.questionId}`
			}
			return 'next'
		},

		/**
		 * @param {number} optionId the answer option
		 * @param {Event} event the select change
		 */
		onTarget(optionId, event) {
			const value = event.target.value
			const byOption = { ...(this.extraSettings?.branching?.byOption ?? {}) }
			if (value === 'next') {
				delete byOption[String(optionId)]
			} else if (value === 'submit') {
				byOption[String(optionId)] = { target: 'submit' }
			} else {
				byOption[String(optionId)] = {
					target: 'section',
					questionId: Number(value.split(':')[1]),
				}
			}
			this.$emit('update:extraSettings', {
				branching: Object.keys(byOption).length ? { byOption } : undefined,
			})
		},
	},
}
</script>

<style lang="scss" scoped>
.logic {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 8px 0;

	&__heading {
		margin: 8px 0 0;
	}

	&__row,
	&__rule {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	&__rule {
		border-inline-start: 3px solid var(--color-border);
		padding-inline-start: 8px;
	}

	// Controls default to shrinking below their content in a flex row, which squashes the
	// question picker to an unreadable sliver once a couple of rules are on one line.
	select,
	input {
		flex: 1 1 12ch;
		min-height: 44px;
		min-width: 0;
	}

	// On a phone each control takes its own line instead of competing for width.
	@media (max-width: 512px) {
		&__row,
		&__rule {
			align-items: stretch;
			flex-direction: column;
		}

		select,
		input {
			width: 100%;
		}
	}

	&__option {
		flex: 1 1 40%;
	}

	&__empty {
		color: var(--color-text-maxcontrast);
	}
}
</style>
