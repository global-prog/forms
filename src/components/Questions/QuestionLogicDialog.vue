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
			<!-- A subquestion is shown by its branch, and the respondent view reads
			     neither a condition nor a jump on it, so neither is offered. -->
			<p v-if="isSubQuestion" class="logic__empty">
				{{
					t(
						'forms',
						'Questions inside a branch are shown by their branch; conditions and jumps are not available here.',
					)
				}}
			</p>

			<!-- ------------------------------------------------ show/hide -->
			<h4 v-if="!isSubQuestion" class="logic__heading">
				{{ t('forms', 'Show this question') }}
			</h4>

			<NcCheckboxRadioSwitch
				v-if="!isSubQuestion"
				:modelValue="hasCondition"
				@update:modelValue="toggleCondition">
				{{ t('forms', 'Only if earlier answers match') }}
			</NcCheckboxRadioSwitch>

			<template v-if="hasCondition && !isSubQuestion">
				<p v-if="sourceCandidates.length === 0" class="logic__empty">
					{{
						t(
							'forms',
							'No earlier question can be used as a condition. Only choice, text, scale and time questions can be.',
						)
					}}
				</p>

				<template v-else>
					<label class="logic__row">
						<span>{{ t('forms', 'Match') }}</span>
						<select :value="match" @change="onMatchChange">
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
							:aria-describedby="
								['missing', 'order'].includes(ruleProblem(rule))
									? problemId(index)
									: undefined
							"
							@change="onRuleQuestion(index, $event)">
							<option disabled value="">
								{{ t('forms', 'Choose a question') }}
							</option>
							<option
								v-if="ruleKind(rule) === 'missing'"
								disabled
								:value="rule.questionId">
								{{ t('forms', 'Deleted question') }}
							</option>
							<!-- Still named, so the editor sees which question the rule
							     looks at while choosing an earlier one. -->
							<option
								v-else-if="ruleProblem(rule) === 'order'"
								disabled
								:value="rule.questionId">
								{{
									sourceText(rule.questionId)
									|| t('forms', 'Untitled question')
								}}
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
							:value="
								missingOptionId(rule)
								?? rule.conditions?.[0]?.optionId
								?? rule.conditions?.[0]?.optionIds?.[0]
								?? ''
							"
							:aria-label="t('forms', 'Answer that must be chosen')"
							:aria-describedby="
								ruleProblem(rule) ? problemId(index) : undefined
							"
							@change="onRuleOption(index, $event)">
							<option disabled value="">
								{{ t('forms', 'Choose an answer') }}
							</option>
							<option
								v-if="ruleProblem(rule) === 'missing-option'"
								disabled
								:value="missingOptionId(rule)">
								{{ t('forms', 'Deleted answer') }}
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
								:aria-invalid="
									ruleProblem(rule) === 'pattern'
										? 'true'
										: undefined
								"
								:aria-describedby="
									ruleProblem(rule) ? problemId(index) : undefined
								"
								@input="onRuleValue(index, $event)" />
						</template>

						<!-- numeric questions: operator + value -->
						<template v-else-if="ruleKind(rule) === 'number'">
							<select
								:value="rule.conditions?.[0]?.type ?? 'value_equals'"
								:aria-label="
									t('forms', 'How the number is compared')
								"
								@change="onRuleType(index, $event, true)">
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
								:value="numberValue(rule)"
								:aria-label="t('forms', 'Number to compare against')"
								:aria-describedby="
									ruleProblem(rule) ? problemId(index) : undefined
								"
								@input="onRuleValue(index, $event, true)" />
						</template>

						<!-- time questions: one bound, in the answer's own HH:mm format -->
						<template v-else-if="ruleKind(rule) === 'time'">
							<select
								:value="timeOperator(rule)"
								:aria-label="t('forms', 'How the time is compared')"
								@change="onTimeOperator(index, $event)">
								<option value="min">
									{{ t('forms', 'is at or after') }}
								</option>
								<option value="max">
									{{ t('forms', 'is at or before') }}
								</option>
							</select>
							<input
								type="time"
								:value="timeBound(rule)"
								:aria-label="t('forms', 'Time to compare against')"
								:aria-describedby="
									ruleProblem(rule) ? problemId(index) : undefined
								"
								@input="onTimeValue(index, $event)" />
						</template>

						<span
							v-else-if="ruleKind(rule) === 'unknown'"
							class="logic__empty">
							{{
								t(
									'forms',
									'This question type cannot be used as a condition.',
								)
							}}
						</span>

						<NcButton
							variant="tertiary"
							:aria-label="
								t('forms', 'Remove rule {number}', {
									number: index + 1,
								})
							"
							@click="removeRule(index)">
							{{ t('forms', 'Remove') }}
						</NcButton>

						<!-- Such a rule never matches, or matches everyone, without any other sign.
						     No live role: it changes as the editor types, and the fields it
						     concerns already point at it. -->
						<p
							v-if="ruleProblem(rule)"
							:id="problemId(index)"
							class="logic__warning">
							{{ problemText(rule) }}
						</p>
					</div>

					<NcButton variant="secondary" @click="addRule">
						{{ t('forms', 'Add rule') }}
					</NcButton>
				</template>
			</template>

			<!-- ------------------------------------------------ answer key -->
			<template v-if="isQuiz">
				<h4 class="logic__heading">{{ t('forms', 'Answer key') }}</h4>

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

				<!-- Scoring is skipped only when there is no correct answer; a blank Points
				     value still scores 1, so the hint belongs with the answer, not above Points. -->
				<p class="logic__empty">
					{{
						t(
							'forms',
							'Leave the correct answer empty to exclude this question from scoring.',
						)
					}}
				</p>

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
						@input="onFeedbackChange('feedbackCorrect', $event)" />
				</label>
				<label class="logic__row">
					<span>{{ t('forms', 'Feedback if incorrect') }}</span>
					<input
						type="text"
						:value="feedbackIncorrect"
						@input="onFeedbackChange('feedbackIncorrect', $event)" />
				</label>
			</template>

			<!-- ------------------------------------------------ branching -->
			<template v-if="options.length > 0 && !isSubQuestion">
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
						:aria-label="
							t('forms', 'Where to go after the answer {option}', {
								option: option.text,
							})
						"
						:aria-describedby="
							targetOf(option.id) === 'missing'
								? targetProblemId(option.id)
								: undefined
						"
						@change="onTarget(option.id, $event)">
						<!-- Respondents go to the next page when the section is gone or
						     now comes earlier; saying so beats a blank field. -->
						<option
							v-if="targetOf(option.id) === 'missing'"
							value="missing"
							disabled>
							{{
								t('forms', 'Removed section (goes to the next page)')
							}}
						</option>
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
					<p
						v-if="targetOf(option.id) === 'missing'"
						:id="targetProblemId(option.id)"
						class="logic__warning">
						{{
							t(
								'forms',
								'This destination no longer exists; choose another.',
							)
						}}
					</p>
				</div>
			</template>
		</div>
	</NcDialog>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import {
	compilePattern,
	DATE_STORAGE_FORMATS,
} from '../../utils/DisplayConditions.js'

/** Source types the condition engine understands, grouped by the input they need */
const CHOICE_TYPES = ['multiple_unique', 'dropdown', 'multiple']
const TEXT_TYPES = ['short', 'long']
const NUMBER_TYPES = ['linearscale']
// The server compares times as H:i strings in min/max, not as numbers.
const TIME_TYPES = ['time']

/**
 * @param {string|undefined} type a numeric condition type
 * @return {string} the key both engines read that condition's number from
 */
function numberKey(type) {
	if (type === 'value_min') {
		return 'min'
	}
	if (type === 'value_max') {
		return 'max'
	}
	return 'value'
}

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
					[
						...CHOICE_TYPES,
						...TEXT_TYPES,
						...NUMBER_TYPES,
						...TIME_TYPES,
					].includes(q.type),
				)
		},

		/**
		 * Subquestions live inside their conditional's branches, not in the form's own
		 * list, so they are the questions that list does not find.
		 *
		 * @return {boolean} whether this question sits inside a branch
		 */
		isSubQuestion() {
			return this.allQuestions.length > 0 && this.ownIndex < 0
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
				return 'missing'
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
			if (TIME_TYPES.includes(source.type)) {
				return 'time'
			}
			return 'unknown'
		},

		/**
		 * Rules that cannot match are stored without complaint and then hide the
		 * question from every respondent, so they are pointed out while editing.
		 *
		 * @param {object} rule the rule to check
		 * @return {string|null} missing, order, incomplete, missing-option or pattern;
		 *     null for a usable rule
		 */
		ruleProblem(rule) {
			const kind = this.ruleKind(rule)
			const condition = rule.conditions?.[0] ?? {}
			// A source moved below this question is not answered yet when this one is
			// shown, so the rule can never match; the picker lists earlier ones only.
			if (
				!['missing', 'unknown'].includes(kind)
				&& !this.sourceCandidates.some((q) => q.id === rule.questionId)
			) {
				return 'order'
			}
			switch (kind) {
				case 'missing':
					return 'missing'
				case 'choice': {
					const ids = condition.optionIds?.length
						? condition.optionIds
						: [condition.optionId]
					if (ids.every((id) => id === undefined || id === null)) {
						return 'incomplete'
					}
					// An answer deleted since keeps the rule stored but unmatched.
					const known = this.optionsFor(rule.questionId).map((o) =>
						String(o.id),
					)
					return ids.every((id) => known.includes(String(id)))
						? null
						: 'missing-option'
				}
				case 'text':
					if ((condition.value ?? '') === '') {
						return 'incomplete'
					}
					return condition.type === 'regex'
						&& compilePattern(String(condition.value)) === null
						? 'pattern'
						: null
				case 'number':
					return this.numberValue(rule) === '' ? 'incomplete' : null
				case 'time':
					return DATE_STORAGE_FORMATS.time.pattern.test(
						this.timeBound(rule),
					)
						? null
						: 'incomplete'
				default:
					return null
			}
		},

		/**
		 * @param {object} rule a rule with a problem
		 * @return {string} what the editor should do about it
		 */
		problemText(rule) {
			switch (this.ruleProblem(rule)) {
				case 'missing':
					return t(
						'forms',
						'The question this rule used has been deleted, so the rule can never match. Remove the rule.',
					)
				case 'order':
					return t(
						'forms',
						'This rule looks at a later question, so it can never match. Choose an earlier question.',
					)
				case 'missing-option':
					return t(
						'forms',
						'The answer this rule used has been deleted. Choose another answer.',
					)
				case 'pattern':
					return t('forms', 'This pattern is not valid')
				default:
					return this.ruleKind(rule) === 'choice'
						? t('forms', 'Choose an answer to finish this rule.')
						: t('forms', 'Enter a value to finish this rule.')
			}
		},

		/**
		 * @param {number} index the rule's position
		 * @return {string} id of the rule's warning
		 */
		problemId(index) {
			return `logic-${this.questionId}-rule-${index}-problem`
		},

		/**
		 * @param {number} optionId the answer option
		 * @return {string} id of the warning about that option's destination
		 */
		targetProblemId(optionId) {
			return `logic-${this.questionId}-target-${optionId}-problem`
		},

		/**
		 * The select shows the deleted answer rather than a surviving one of the same
		 * rule, so it matches the warning below it.
		 *
		 * @param {object} rule a choice rule
		 * @return {number|string|undefined} the first answer it names that no longer
		 *     exists, if any
		 */
		missingOptionId(rule) {
			const condition = rule.conditions?.[0] ?? {}
			const ids = condition.optionIds?.length
				? condition.optionIds
				: [condition.optionId]
			const known = this.optionsFor(rule.questionId).map((o) => String(o.id))
			return ids.find(
				(id) =>
					id !== undefined && id !== null && !known.includes(String(id)),
			)
		},

		/**
		 * @param {number} questionId a question of the form
		 * @return {string} its title, or '' when it has none
		 */
		sourceText(questionId) {
			return this.allQuestions.find((q) => q.id === questionId)?.text ?? ''
		},

		/**
		 * @param {object} rule a numeric rule
		 * @return {number|string} the stored number, or '' when there is none
		 */
		numberValue(rule) {
			const condition = rule.conditions?.[0] ?? {}
			// Older rules kept the bound of value_min/value_max in `value`.
			const value = condition[numberKey(condition.type)] ?? condition.value
			return typeof value === 'number' && !isNaN(value) ? value : ''
		},

		/**
		 * @param {object} rule a time rule
		 * @return {string} min for "at or after", max for "at or before"
		 */
		timeOperator(rule) {
			const condition = rule.conditions?.[0] ?? {}
			return condition.max !== undefined && condition.min === undefined
				? 'max'
				: 'min'
		},

		/**
		 * @param {object} rule a time rule
		 * @return {string} the stored HH:mm bound, or ''
		 */
		timeBound(rule) {
			const bound = rule.conditions?.[0]?.[this.timeOperator(rule)]
			return typeof bound === 'string' ? bound : ''
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
			const id = Number(event.target.value)
			// Checkbox questions are matched on a list of options that must all be ticked.
			const source = this.allQuestions.find(
				(q) => q.id === this.rules[index]?.questionId,
			)
			this.updateRule(index, [
				source?.type === 'multiple' ? { optionIds: [id] } : { optionId: id },
			])
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the select change
		 * @param {boolean} numeric whether the rule compares numbers
		 */
		onRuleType(index, event, numeric = false) {
			const existing = this.rules[index]?.conditions?.[0] ?? {}
			const type = event.target.value
			if (!numeric) {
				this.updateRule(index, [{ ...existing, type }])
				return
			}
			// The number moves to the key the new operator is read from.
			const value = this.numberValue(this.rules[index])
			this.updateRule(index, [
				{ type, [numberKey(type)]: value === '' ? undefined : value },
			])
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the input event
		 * @param {boolean} numeric whether to store a number
		 */
		onRuleValue(index, event, numeric = false) {
			const existing = this.rules[index]?.conditions?.[0] ?? {}
			const raw = event.target.value
			if (!numeric) {
				this.updateRule(index, [{ ...existing, value: raw }])
				return
			}
			const number = parseFloat(raw)
			this.updateRule(index, [
				{
					type: existing.type,
					[numberKey(existing.type)]: isNaN(number) ? undefined : number,
				},
			])
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the select change
		 */
		onTimeOperator(index, event) {
			const bound = this.timeBound(this.rules[index])
			this.updateRule(index, [
				{ type: 'date_range', [event.target.value]: bound },
			])
		},

		/**
		 * @param {number} index rule being edited
		 * @param {Event} event the input event
		 */
		onTimeValue(index, event) {
			const operator = this.timeOperator(this.rules[index])
			this.updateRule(index, [
				{ type: 'date_range', [operator]: event.target.value },
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
				// A section deleted, or moved above this question, is skipped by the
				// respondent view, which goes on to the next page.
				return this.sectionTargets.some((s) => s.id === rule.questionId)
					? `section:${rule.questionId}`
					: 'missing'
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

	// The option's own words, beside the destination they lead to. Growing to 40% of the
	// row put "Yes" against one edge and its dropdown against the other, with a third of
	// a dialog of nothing between them - and which option led where is the whole point of
	// this list. A floor keeps the dropdowns lined up under one another when the options
	// are short, which is most of the time; a ceiling stops a long one taking the row.
	&__option {
		flex: 0 1 auto;
		max-inline-size: 40%;
		min-inline-size: 96px;
	}

	// Only in a branch row. A condition rule's controls still share the width between
	// them, or the question picker is squeezed to an unreadable sliver.
	&__row select {
		flex: 0 1 auto;
	}

	&__empty {
		color: var(--color-text-maxcontrast);
	}

	&__warning {
		color: var(--color-error-text, var(--color-error));
		flex-basis: 100%;
		margin: 0;
	}
}
</style>
