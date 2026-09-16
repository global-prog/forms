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
		:shiftDragHandle="false"
		:isTriggerQuestion="isTriggerQuestion"
		v-on="commonListeners">
		<template #actions>
			<!-- Trigger type selection in menu -->
			<NcActionButton
				v-for="tt in triggerTypesList"
				:key="tt.type"
				:closeAfterClick="true"
				@click="setTriggerType(tt.type)">
				<template #icon>
					<NcIconSvgWrapper :svg="tt.icon" />
				</template>
				{{ tt.label }}
			</NcActionButton>
		</template>

		<div class="question-conditional">
			<!-- Trigger Type Selection (Edit Mode) -->
			<div v-if="!readOnly && !triggerType" class="trigger-type-selector">
				<p class="trigger-type-selector__label">
					{{ t('forms', 'Select the trigger question type:') }}
				</p>
				<div class="trigger-type-selector__options">
					<NcButton
						v-for="tt in triggerTypesList"
						:key="tt.type"
						variant="secondary"
						@click="setTriggerType(tt.type)">
						<template #icon>
							<NcIconSvgWrapper :svg="tt.icon" />
						</template>
						{{ tt.label }}
					</NcButton>
				</div>
			</div>

			<!-- Trigger Question -->
			<div v-else-if="triggerType" class="trigger-question">
				<div v-if="!readOnly" class="trigger-question__header">
					<NcIconSvgWrapper
						:svg="currentTriggerIcon"
						class="trigger-question__icon" />
					<span class="trigger-question__type-label">
						{{
							t('forms', 'Trigger type: {type}', {
								type: currentTriggerLabel,
							})
						}}
					</span>
					<NcButton
						variant="tertiary"
						:aria-label="t('forms', 'Change trigger type')"
						@click="clearTriggerType">
						<template #icon>
							<NcIconSvgWrapper :svg="IconPencil" />
						</template>
					</NcButton>
				</div>

				<!-- Instructions for option-based triggers -->
				<p
					v-if="!readOnly && isOptionBasedTrigger"
					class="trigger-question__instructions">
					{{
						t(
							'forms',
							'Add the answer options below. These will be used as trigger conditions.',
						)
					}}
				</p>

				<!-- Render the appropriate trigger question component -->
				<component
					:is="triggerComponentName"
					v-if="triggerComponentName"
					:id="id"
					ref="triggerQuestion"
					:formId="formId"
					:text="text"
					description=""
					:isRequired="false"
					:index="index"
					:options="options"
					:extraSettings="triggerExtraSettings"
					:maxStringLengths="maxStringLengths"
					:answerType="triggerAnswerTypeConfig"
					:readOnly="readOnly"
					:isTriggerQuestion="true"
					:values="triggerValues"
					@update:values="onTriggerValueChange"
					@update:options="onOptionsChange"
					@update:extraSettings="onExtraSettingsChange"
					@delete="clearTriggerType" />

				<!-- Branch Management (Edit Mode) -->
				<div v-if="!readOnly" class="branches-editor">
					<h4 class="branches-editor__title">
						{{ t('forms', 'Conditional Branches') }}
					</h4>
					<p class="branches-editor__description">
						{{
							t(
								'forms',
								'Define which subquestions appear based on the answer above.',
							)
						}}
					</p>

					<!-- List of branches -->
					<TransitionGroup
						tag="div"
						:name="isDragging ? undefined : 'branch-list'">
						<div
							v-for="(branch, branchIndex) in branches"
							:key="branch.id"
							class="branch">
							<div class="branch__header">
								<span class="branch__label">
									{{ getBranchLabel(branch, branchIndex) }}
								</span>
								<NcButton
									variant="tertiary"
									:aria-label="t('forms', 'Delete branch')"
									@click="deleteBranch(branch.id)">
									<template #icon>
										<NcIconSvgWrapper
											:svg="IconDelete"></NcIconSvgWrapper>
									</template>
								</NcButton>
							</div>

							<!-- Branch Conditions -->
							<div class="branch__conditions">
								<BranchConditionEditor
									:branch="branch"
									:triggerType="triggerType"
									:options="options"
									@update:branch="
										onBranchUpdate(branchIndex, $event)
									" />
							</div>

							<!-- Subquestions for this branch -->
							<div class="branch__subquestions">
								<QuestionList
									v-model="branches[branchIndex].subQuestions"
									:getComponent="getSubQuestionComponent"
									:getAnswerType="getSubQuestionAnswerType"
									:maxStringLengths="maxStringLengths"
									:baseIndex="index"
									:animation="200"
									:formId="formId"
									:showInsert="true"
									:insertMenuName="
										t('forms', 'Insert subquestion')
									"
									:answerTypesFilter="subQuestionAnswerTypesFilter"
									:hasSubtypes="hasSubtypes"
									:isLoadingQuestions="isLoadingQuestions"
									@updateProperty="
										(idx, prop, val) =>
											updateSubQuestion(
												branch.id,
												branches[branchIndex].subQuestions[
													idx
												].id,
												prop,
												val,
											)
									"
									@clone="
										(question) =>
											cloneSubQuestion(branch.id, question.id)
									"
									@delete="
										(question) =>
											deleteSubQuestion(branch.id, question.id)
									"
									@moveDown="(idx) => onMoveDown(idx, branchIndex)"
									@moveUp="(idx) => onMoveUp(idx, branchIndex)"
									@orderChange="onQuestionOrderChange(branchIndex)"
									@dragStart="isDragging = true"
									@dragEnd="isDragging = false"
									@addQuestion="
										(type, subtype, position) =>
											addSubQuestion(branch.id, type, position)
									" />

								<!-- Add subquestion button -->
								<NcActions
									:aria-label="t('forms', 'Add subquestion')">
									<template #icon>
										<NcIconSvgWrapper :svg="IconPlus" />
									</template>
									<NcActionButton
										v-for="sqType in subQuestionTypesList"
										:key="sqType.type"
										:closeAfterClick="true"
										@click="
											addSubQuestion(branch.id, sqType.type)
										">
										<template #icon>
											<NcIconSvgWrapper :svg="sqType.icon" />
										</template>
										{{ sqType.label }}
									</NcActionButton>
								</NcActions>
							</div>
						</div>
					</TransitionGroup>
					<!-- Add new branch button -->
					<NcButton variant="secondary" @click="addBranch">
						<template #icon>
							<NcIconSvgWrapper :svg="IconPlus" />
						</template>
						{{ t('forms', 'Add branch') }}
					</NcButton>
				</div>

				<!-- Submit Mode: Show only the active branch's subquestions -->
				<div v-else class="active-subquestions">
					<TransitionGroup tag="div" name="branch-list">
						<div
							v-for="activeBranch in activeBranches"
							:key="activeBranch.id">
							<component
								:is="getSubQuestionComponentName(subQuestion.type)"
								v-for="(
									subQuestion, subIndex
								) in activeBranch.subQuestions"
								:key="subQuestion.id"
								ref="subQuestions"
								v-bind="subQuestion"
								:formId="formId"
								:index="subIndex + index + 1"
								:maxStringLengths="maxStringLengths"
								:answerType="
									getSubQuestionAnswerTypeConfig(subQuestion.type)
								"
								:readOnly="true"
								:values="getSubQuestionValues(subQuestion.id)"
								@update:values="
									onSubQuestionValueChange(subQuestion.id, $event)
								" />
						</div>
					</TransitionGroup>
				</div>
			</div>
		</div>
		<slot name="insert" />
	</Question>
</template>

<script>
// Icons
import IconPlus from '@material-symbols/svg-400/outlined/add.svg?raw'
import IconArrowDownDropCircleOutline from '@material-symbols/svg-400/outlined/arrow_drop_down_circle.svg?raw'
import IconCalendar from '@material-symbols/svg-400/outlined/calendar_today.svg?raw'
import IconCheckboxOutline from '@material-symbols/svg-400/outlined/check_box.svg?raw'
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconFile from '@material-symbols/svg-400/outlined/draft.svg?raw'
import IconPencil from '@material-symbols/svg-400/outlined/edit.svg?raw'
import IconLinearScale from '@material-symbols/svg-400/outlined/linear_scale.svg?raw'
import IconPalette from '@material-symbols/svg-400/outlined/palette.svg?raw'
import IconRadioboxMarked from '@material-symbols/svg-400/outlined/radio_button_checked.svg?raw'
import IconClockOutline from '@material-symbols/svg-400/outlined/schedule.svg?raw'
import IconTextShort from '@material-symbols/svg-400/outlined/short_text.svg?raw'
import IconTextLong from '@material-symbols/svg-400/outlined/subject.svg?raw'
import IconSwapVertical from '@material-symbols/svg-400/outlined/swap_vert.svg?raw'
import axios from '@nextcloud/axios'
import { showConfirmation, showError } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { translatePlural as n, translate as t } from '@nextcloud/l10n'
import { generateOcsUrl } from '@nextcloud/router'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import BranchConditionEditor from './BranchConditionEditor.vue'
import Question from './Question.vue'
// Question components - imported directly to avoid circular dependency with AnswerTypes.js
import QuestionColor from './QuestionColor.vue'
import QuestionDate from './QuestionDate.vue'
import QuestionDropdown from './QuestionDropdown.vue'
import QuestionFile from './QuestionFile.vue'
import QuestionLinearScale from './QuestionLinearScale.vue'
import QuestionList from './QuestionList.vue'
import QuestionLong from './QuestionLong.vue'
import QuestionMultiple from './QuestionMultiple.vue'
import QuestionRanking from './QuestionRanking.vue'
import QuestionShort from './QuestionShort.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import {
	DATE_STORAGE_FORMATS,
	evaluateConditions,
} from '../../utils/DisplayConditions.js'
import logger from '../../utils/Logger.js'
import OcsResponse2Data from '../../utils/OcsResponse2Data.js'

// Local mapping of question types - avoids circular dependency with AnswerTypes.js
const QUESTION_COMPONENTS = {
	short: QuestionShort,
	long: QuestionLong,
	multiple: QuestionMultiple,
	multiple_unique: QuestionMultiple,
	dropdown: QuestionDropdown,
	date: QuestionDate,
	time: QuestionDate,
	linearscale: QuestionLinearScale,
	color: QuestionColor,
	file: QuestionFile,
	ranking: QuestionRanking,
}

export default {
	name: 'QuestionConditional',

	components: {
		BranchConditionEditor,
		NcActionButton,
		NcActions,
		NcButton,
		NcIconSvgWrapper,
		Question,
		QuestionColor,
		QuestionDate,
		QuestionDropdown,
		QuestionFile,
		QuestionLinearScale,
		QuestionList,
		QuestionLong,
		QuestionMultiple,
		QuestionShort,
		QuestionRanking,
	},

	mixins: [QuestionMixin],
	emits: ['update:values', 'update:options', 'forms:last-updated:set'],

	setup() {
		return {
			IconPlus,
			IconArrowDownDropCircleOutline,
			IconCalendar,
			IconCheckboxOutline,
			IconClockOutline,
			IconDelete,
			IconFile,
			IconLinearScale,
			IconPalette,
			IconPencil,
			IconRadioboxMarked,
			IconTextLong,
			IconTextShort,
		}
	},

	data() {
		return {
			isDragging: false,
			isLoadingQuestions: false,
			triggerValues: [],
			subQuestionValues: {},
		}
	},

	computed: {
		/**
		 * Trigger types available for conditional questions
		 */
		triggerTypesList() {
			return [
				{
					type: 'multiple_unique',
					label: t('forms', 'Radio buttons'),
					icon: IconRadioboxMarked,
				},
				{
					type: 'dropdown',
					label: t('forms', 'Dropdown'),
					icon: IconArrowDownDropCircleOutline,
				},
				{
					type: 'multiple',
					label: t('forms', 'Checkboxes'),
					icon: IconCheckboxOutline,
				},
				{
					type: 'short',
					label: t('forms', 'Short answer'),
					icon: IconTextShort,
				},
				{ type: 'long', label: t('forms', 'Long text'), icon: IconTextLong },
				{
					type: 'linearscale',
					label: t('forms', 'Linear scale'),
					icon: IconLinearScale,
				},
				{ type: 'date', label: t('forms', 'Date'), icon: IconCalendar },
				{ type: 'time', label: t('forms', 'Time'), icon: IconClockOutline },
				{ type: 'color', label: t('forms', 'Color'), icon: IconPalette },
				{ type: 'file', label: t('forms', 'File'), icon: IconFile },
			]
		},

		/**
		 * Subquestion types (excludes conditional to prevent recursion)
		 */
		subQuestionTypesList() {
			return [
				{
					type: 'short',
					label: t('forms', 'Short answer'),
					icon: IconTextShort,
				},
				{ type: 'long', label: t('forms', 'Long text'), icon: IconTextLong },
				{
					type: 'multiple',
					label: t('forms', 'Checkboxes'),
					icon: IconCheckboxOutline,
				},
				{
					type: 'multiple_unique',
					label: t('forms', 'Radio buttons'),
					icon: IconRadioboxMarked,
				},
				{
					type: 'dropdown',
					label: t('forms', 'Dropdown'),
					icon: IconArrowDownDropCircleOutline,
				},
				{ type: 'date', label: t('forms', 'Date'), icon: IconCalendar },
				{ type: 'time', label: t('forms', 'Time'), icon: IconClockOutline },
				{
					type: 'linearscale',
					label: t('forms', 'Linear scale'),
					icon: IconLinearScale,
				},
				{ type: 'color', label: t('forms', 'Color'), icon: IconPalette },
				{ type: 'file', label: t('forms', 'File'), icon: IconFile },
				{
					type: 'ranking',
					label: t('forms', 'Ranking'),
					icon: IconSwapVertical,
				},
			]
		},

		triggerType() {
			return this.extraSettings?.triggerType || null
		},

		currentTriggerConfig() {
			return this.triggerTypesList.find((t) => t.type === this.triggerType)
		},

		currentTriggerIcon() {
			return this.currentTriggerConfig?.icon || IconRadioboxMarked
		},

		currentTriggerLabel() {
			return this.currentTriggerConfig?.label || ''
		},

		/**
		 * Check if trigger type uses predefined options (radio, dropdown, checkbox)
		 */
		isOptionBasedTrigger() {
			return ['multiple_unique', 'dropdown', 'multiple'].includes(
				this.triggerType,
			)
		},

		/**
		 * Ensure options is always an array for the trigger component
		 */
		triggerOptions() {
			return Array.isArray(this.options) ? this.options : []
		},

		/**
		 * Get component name for trigger (used with :is)
		 */
		triggerComponentName() {
			if (!this.triggerType) return null
			return QUESTION_COMPONENTS[this.triggerType]
				? this.getComponentNameForType(this.triggerType)
				: null
		},

		/**
		 * Answer type config for trigger question
		 */
		triggerAnswerTypeConfig() {
			if (!this.triggerType) return null
			return this.buildAnswerTypeConfig(this.triggerType)
		},

		triggerExtraSettings() {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { triggerType, branches, ...rest } = this.extraSettings || {}
			return rest
		},

		branches() {
			return this.extraSettings?.branches || []
		},

		/**
		 * Get component reference for subquestion (used with :is in QuestionList)
		 * Returns the actual component object, not a string name,
		 * so it works in QuestionList's scope.
		 */
		getSubQuestionComponent() {
			return (question) => QUESTION_COMPONENTS[question.type]
		},

		/**
		 * Get answer type config for subquestion (used with :answerType in QuestionList)
		 * Takes a question object and returns the answer type config.
		 */
		getSubQuestionAnswerType() {
			return (question) => this.buildAnswerTypeConfig(question.type)
		},

		/**
		 * Build answerTypes filter for subquestion insert menu
		 * Filters out 'conditional' to prevent recursion
		 */
		subQuestionAnswerTypesFilter() {
			const filter = {}
			for (const sqType of this.subQuestionTypesList) {
				filter[sqType.type] = {
					icon: sqType.icon,
					label: sqType.label,
				}
			}
			return filter
		},

		/**
		 * Check if an answer type has subtypes
		 */
		hasSubtypes() {
			return (answer) =>
				answer && answer.subtypes && Object.keys(answer.subtypes).length > 0
		},

		activeBranches() {
			// An unanswered trigger is evaluated too, as the server does: a "no file was
			// uploaded" branch is active from the start, and its required subquestions are
			// checked, so they have to be on screen.
			return this.branches.filter((branch) =>
				this.evaluateBranchCondition(branch),
			)
		},

		contentValid() {
			return !!this.triggerType && this.branches.length > 0
		},
	},

	watch: {
		values: {
			immediate: true,
			handler(newValues) {
				this.triggerValues = newValues?.trigger ?? []
				this.subQuestionValues = { ...(newValues?.subQuestions ?? {}) }
			},
		},
	},

	methods: {
		/**
		 * Get Vue component name string for a question type
		 *
		 * @param {string} type The question type
		 * @return {string|null} The component name or null
		 */
		getComponentNameForType(type) {
			const componentMap = {
				short: 'QuestionShort',
				long: 'QuestionLong',
				multiple: 'QuestionMultiple',
				multiple_unique: 'QuestionMultiple',
				dropdown: 'QuestionDropdown',
				date: 'QuestionDate',
				time: 'QuestionDate',
				linearscale: 'QuestionLinearScale',
				color: 'QuestionColor',
				file: 'QuestionFile',
				ranking: 'QuestionRanking',
			}
			return componentMap[type] || null
		},

		/**
		 * Get component name for subquestion
		 *
		 * @param {string} type The question type
		 * @return {string|null} The component name or null
		 */
		getSubQuestionComponentName(type) {
			return this.getComponentNameForType(type)
		},

		/**
		 * Build answerType config object for a question type
		 *
		 * @param {string} type The question type
		 * @return {object} The answer type configuration
		 */
		buildAnswerTypeConfig(type) {
			const configs = {
				short: {
					titlePlaceholder: t('forms', 'Short answer question title'),
					createPlaceholder: t('forms', 'People can enter a short answer'),
					submitPlaceholder: t('forms', 'Enter your answer'),
					validate: () => true,
				},

				long: {
					titlePlaceholder: t('forms', 'Long text question title'),
					createPlaceholder: t('forms', 'People can enter a long text'),
					submitPlaceholder: t('forms', 'Enter your answer'),
					validate: () => true,
				},

				multiple: {
					titlePlaceholder: t('forms', 'Checkbox question title'),
					createPlaceholder: t(
						'forms',
						'People can submit a different answer',
					),

					submitPlaceholder: t('forms', 'Enter your answer'),
					warningInvalid: t(
						'forms',
						'This question needs at least one answer!',
					),

					predefined: true,
					validate: (question) => question.options?.length > 0,
				},

				multiple_unique: {
					titlePlaceholder: t('forms', 'Radio buttons question title'),
					createPlaceholder: t(
						'forms',
						'People can submit a different answer',
					),

					submitPlaceholder: t('forms', 'Enter your answer'),
					warningInvalid: t(
						'forms',
						'This question needs at least one answer!',
					),

					predefined: true,
					unique: true,
					validate: (question) => question.options?.length > 0,
				},

				dropdown: {
					titlePlaceholder: t('forms', 'Dropdown question title'),
					createPlaceholder: t('forms', 'People can pick one option'),
					submitPlaceholder: t('forms', 'Pick an option'),
					warningInvalid: t(
						'forms',
						'This question needs at least one answer!',
					),

					predefined: true,
					validate: (question) => question.options?.length > 0,
				},

				date: {
					titlePlaceholder: t('forms', 'Date question title'),
					createPlaceholder: t('forms', 'People can pick a date'),
					submitPlaceholder: t('forms', 'Pick a date'),
					warningInvalid: t('forms', 'This question needs a title!'),
					pickerType: 'date',
					storageFormat: 'YYYY-MM-DD',
					momentFormat: 'L',
					validate: () => true,
				},

				time: {
					titlePlaceholder: t('forms', 'Time question title'),
					createPlaceholder: t('forms', 'People can pick a time'),
					submitPlaceholder: t('forms', 'Pick a time'),
					warningInvalid: t('forms', 'This question needs a title!'),
					pickerType: 'time',
					storageFormat: 'HH:mm',
					momentFormat: 'LT',
					validate: () => true,
				},

				linearscale: {
					titlePlaceholder: t('forms', 'Linear scale question title'),
					warningInvalid: t('forms', 'This question needs a title!'),
					predefined: true,
					validate: () => true,
				},

				color: {
					titlePlaceholder: t('forms', 'Color question title'),
					createPlaceholder: t('forms', 'People can pick a color'),
					submitPlaceholder: t('forms', 'Pick a color'),
					warningInvalid: t('forms', 'This question needs a title!'),
					validate: () => true,
				},

				file: {
					titlePlaceholder: t('forms', 'File question title'),
					warningInvalid: t('forms', 'This question needs a title!'),
					validate: () => true,
				},

				ranking: {
					titlePlaceholder: t('forms', 'Ranking question title'),
					warningInvalid: t('forms', 'This question needs a title!'),
					validate: () => true,
				},
			}
			return configs[type] || { validate: () => true }
		},

		/**
		 * Get answer type config for subquestion
		 *
		 * @param {string} type The question type
		 * @return {object} The answer type configuration
		 */
		getSubQuestionAnswerTypeConfig(type) {
			return this.buildAnswerTypeConfig(type)
		},

		/**
		 * Switch the trigger to another question type. Branch conditions written for the
		 * old type can never match the new one, yet would still read as configured, so
		 * they are carried over where the meaning survives and cleared otherwise.
		 *
		 * @param {string} type The new trigger type
		 */
		async setTriggerType(type) {
			const branches = this.branches.map((branch) =>
				this.fitBranchToType(branch, type),
			)
			const clearedCount = branches.filter(
				(branch, index) =>
					branch.conditions.length
					< (this.branches[index].conditions?.length ?? 0),
			).length

			if (clearedCount > 0) {
				// Closing the dialog without a button rejects, which is a cancel too.
				const confirmed = await showConfirmation({
					name: t('forms', 'Change trigger type'),
					text: n(
						'forms',
						'The conditions of %n branch do not fit the new trigger type and will be cleared.',
						'The conditions of %n branches do not fit the new trigger type and will be cleared.',
						clearedCount,
					),
					labelConfirm: t('forms', 'Change trigger type'),
					labelReject: t('forms', 'Cancel'),
				}).catch(() => false)
				if (!confirmed) {
					return
				}
			}

			this.onExtraSettingsChange({ triggerType: type, branches })
		},

		/**
		 * @param {object} branch The branch to adapt
		 * @param {string} type The new trigger type
		 * @return {object} The branch with only the conditions the type can evaluate
		 */
		fitBranchToType(branch, type) {
			const conditions = branch.conditions ?? []
			const [only] = conditions

			// A single chosen option means the same thing for radio buttons, dropdowns
			// and checkboxes, so it is converted rather than dropped.
			if (
				conditions.length === 1
				&& only.optionId !== undefined
				&& only.optionId !== null
				&& type === 'multiple'
			) {
				return { ...branch, conditions: [{ optionIds: [only.optionId] }] }
			}
			if (
				conditions.length === 1
				&& only.optionIds?.length === 1
				&& ['multiple_unique', 'dropdown'].includes(type)
			) {
				return { ...branch, conditions: [{ optionId: only.optionIds[0] }] }
			}

			return {
				...branch,
				conditions: conditions.filter((condition) =>
					this.conditionFitsType(condition, type),
				),
			}
		},

		/**
		 * @param {object} condition A stored branch condition
		 * @param {string} type A trigger type
		 * @return {boolean} Whether the condition has the shape that type is evaluated with
		 */
		conditionFitsType(condition, type) {
			switch (type) {
				case 'multiple_unique':
				case 'dropdown':
					return (
						condition.optionId !== undefined
						&& condition.optionId !== null
					)
				case 'multiple':
					return Array.isArray(condition.optionIds)
				case 'short':
					return ['string_equals', 'string_contains', 'regex'].includes(
						condition.type,
					)
				case 'long':
					return ['string_contains', 'regex'].includes(condition.type)
				case 'linearscale':
					return String(condition.type).startsWith('value_')
				case 'color':
					return !condition.type && typeof condition.value === 'string'
				case 'date':
				case 'datetime':
				case 'time':
					return (
						condition.type === 'date_range'
						&& [condition.min, condition.max].every(
							(bound) =>
								!bound
								|| DATE_STORAGE_FORMATS[type].pattern.test(bound),
						)
					)
				case 'file':
					return typeof condition.fileUploaded === 'boolean'
				default:
					return false
			}
		},

		clearTriggerType() {
			const newExtraSettings = {
				...this.extraSettings,
				triggerType: null,
			}
			this.onExtraSettingsChange(newExtraSettings)
		},

		onTriggerValueChange(values) {
			this.triggerValues = values
			this.emitValues()
		},

		onOptionsChange(options) {
			this.$emit('update:options', options)
		},

		addBranch() {
			const newBranch = {
				id: `branch-${Date.now()}`,
				// A file trigger has a single yes/no condition, shown switched on, so the
				// branch starts with it stored rather than looking set while matching nothing.
				conditions:
					this.triggerType === 'file' ? [{ fileUploaded: true }] : [],

				subQuestions: [],
			}
			const newBranches = [...this.branches, newBranch]
			this.onExtraSettingsChange({ branches: newBranches })
		},

		/**
		 * Delete a branch together with the subquestions built inside it. Those are real
		 * question rows, so they are deleted on the server too rather than left orphaned.
		 *
		 * @param {string} branchId The branch to delete
		 */
		async deleteBranch(branchId) {
			const branch = this.branches.find((b) => b.id === branchId)
			if (!branch) {
				return
			}
			const subQuestions = branch.subQuestions ?? []

			// One click on a bare icon would otherwise throw away all of that work.
			if (subQuestions.length > 0 || branch.conditions?.length > 0) {
				const confirmed = await showConfirmation({
					name: t('forms', 'Delete branch'),
					text:
						subQuestions.length > 0
							? n(
									'forms',
									'This branch and its %n subquestion will be deleted.',
									'This branch and its %n subquestions will be deleted.',
									subQuestions.length,
								)
							: t(
									'forms',
									'This branch and its conditions will be deleted.',
								),
					labelConfirm: t('forms', 'Delete'),
					labelReject: t('forms', 'Cancel'),
				}).catch(() => false)
				if (!confirmed) {
					return
				}
			}

			const results = await Promise.allSettled(
				subQuestions.map((question) =>
					axios.delete(
						generateOcsUrl(
							'apps/forms/api/v3/forms/{id}/questions/{questionId}',
							{
								id: this.formId,
								questionId: question.id,
							},
						),
					),
				),
			)
			const failed = subQuestions.filter(
				(_, index) => results[index].status === 'rejected',
			)

			if (failed.length > 0) {
				// Keep the branch with whatever could not be deleted, so nothing that still
				// exists on the server loses its place in the form.
				logger.error('Error deleting branch subquestions', {
					errors: results.filter((result) => result.status === 'rejected'),
				})
				showError(t('forms', 'Error deleting subquestion'))
				this.onExtraSettingsChange({
					branches: this.branches.map((b) =>
						b.id === branchId ? { ...b, subQuestions: failed } : b,
					),
				})
				return
			}

			this.onExtraSettingsChange({
				branches: this.branches.filter((b) => b.id !== branchId),
			})
		},

		onBranchUpdate(index, branch) {
			const newBranches = [...this.branches]
			newBranches[index] = branch
			this.onExtraSettingsChange({ branches: newBranches })
		},

		getBranchLabel(branch, index) {
			if (!branch.conditions || branch.conditions.length === 0) {
				return t('forms', 'Branch {number} (no conditions)', {
					number: index + 1,
				})
			}

			if (
				['multiple_unique', 'dropdown', 'multiple'].includes(
					this.triggerType,
				)
			) {
				// Checkboxes keep their chosen options in one optionIds list.
				const optionIds = branch.conditions.flatMap((c) =>
					this.triggerType === 'multiple'
						? (c.optionIds ?? [])
						: [c.optionId],
				)
				const optionTexts = optionIds
					.map((id) => this.options.find((o) => o.id === id)?.text)
					.filter(Boolean)
				if (optionTexts.length > 0) {
					return optionTexts.join(' + ')
				}
			}

			return t('forms', 'Branch {number}', { number: index + 1 })
		},

		async addSubQuestion(branchId, type, position = null) {
			const branch = this.branches.find((b) => b.id === branchId)
			if (!branch) return

			try {
				const response = await axios.post(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/questions', {
						id: this.formId,
					}),
					{
						type,
						text: '',
						parentQuestionId: this.id,
						branchId,
					},
				)
				const newQuestion = OcsResponse2Data(response)

				const branchIndex = this.branches.findIndex((b) => b.id === branchId)
				const newSubQuestions = [...(branch.subQuestions || [])]
				if (position !== null) {
					newSubQuestions.splice(position, 0, newQuestion)
				} else {
					newSubQuestions.push(newQuestion)
				}
				const newBranches = [...this.branches]
				newBranches[branchIndex] = {
					...branch,
					subQuestions: newSubQuestions,
				}
				this.onExtraSettingsChange({ branches: newBranches })
			} catch (error) {
				logger.error('Error adding subquestion', { error })
				showError(t('forms', 'Error adding subquestion'))
			}
		},

		onMoveUp(index, branchIndex) {
			const subQuestions = this.branches[branchIndex].subQuestions

			if (index > 0) {
				;[subQuestions[index - 1], subQuestions[index]] = [
					subQuestions[index],
					subQuestions[index - 1],
				]
			}
			this.onQuestionOrderChange(branchIndex)
		},

		onMoveDown(index, branchIndex) {
			// only if not the last one
			if (index < this.branches[branchIndex].subQuestions.length - 1) {
				this.onMoveUp(index + 1, branchIndex)
			}
		},

		async onQuestionOrderChange(branchIndex) {
			this.isLoadingQuestions = true
			const newOrder = this.branches[branchIndex].subQuestions.map(
				(question) => question.id,
			)
			try {
				await axios.patch(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/subquestions', {
						id: this.formId,
					}),
					{
						newOrder,
						branchId: this.branches[branchIndex].id,
						parentQuestionId: this.id,
					},
				)
				emit('forms:last-updated:set', this.formId)
			} catch (error) {
				logger.error('Error while saving form', { error })
				showError(t('forms', 'Error while saving form'))
			} finally {
				this.isLoadingQuestions = false
			}
		},

		async cloneSubQuestion(branchId, questionId) {
			const branch = this.branches.find((b) => b.id === branchId)
			if (!branch) return

			try {
				const response = await axios.post(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/questions?fromId={questionId}',
						{
							id: this.formId,
							questionId,
						},
					),
				)
				const newQuestion = OcsResponse2Data(response)

				const branchIndex = this.branches.findIndex((b) => b.id === branchId)
				const newBranches = [...this.branches]
				newBranches[branchIndex] = {
					...branch,
					subQuestions: [...(branch.subQuestions || []), newQuestion],
				}
				this.onExtraSettingsChange({ branches: newBranches })
			} catch (error) {
				logger.error('Error adding subquestion', { error })
				showError(t('forms', 'Error adding subquestion'))
			}
		},

		async deleteSubQuestion(branchId, questionId) {
			try {
				await axios.delete(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/questions/{questionId}',
						{
							id: this.formId,
							questionId,
						},
					),
				)

				const branchIndex = this.branches.findIndex((b) => b.id === branchId)
				const branch = this.branches[branchIndex]
				const newBranches = [...this.branches]
				newBranches[branchIndex] = {
					...branch,
					subQuestions: branch.subQuestions.filter(
						(q) => q.id !== questionId,
					),
				}
				this.onExtraSettingsChange({ branches: newBranches })
			} catch (error) {
				logger.error('Error deleting subquestion', { error })
				showError(t('forms', 'Error deleting subquestion'))
			}
		},

		updateSubQuestion(branchId, questionId, property, value) {
			const branchIndex = this.branches.findIndex((b) => b.id === branchId)
			const branch = this.branches[branchIndex]

			const newBranches = [...this.branches]
			newBranches[branchIndex] = {
				...branch,
				subQuestions: branch.subQuestions.map((q) =>
					q.id === questionId ? { ...q, [property]: value } : q,
				),
			}
			this.onExtraSettingsChange({ branches: newBranches })
		},

		getSubQuestionValues(questionId) {
			return this.subQuestionValues[questionId] || []
		},

		onSubQuestionValueChange(questionId, values) {
			this.subQuestionValues = {
				...this.subQuestionValues,
				[questionId]: values,
			}
			this.emitValues()
		},

		emitValues() {
			this.$emit('update:values', {
				trigger: this.triggerValues,
				subQuestions: this.subQuestionValues,
			})
		},

		/**
		 * Whether the trigger answer activates a branch. Uses the same engine as display
		 * conditions, which mirrors the server, so a branch the respondent sees is exactly
		 * a branch the server validates.
		 *
		 * @param {object} branch The branch to test
		 * @return {boolean} True when the branch is active
		 */
		evaluateBranchCondition(branch) {
			return evaluateConditions(
				this.triggerType,
				this.triggerValues,
				branch.conditions,
			)
		},

		async validate() {
			if (this.$refs.triggerQuestion?.validate) {
				const triggerValid = await this.$refs.triggerQuestion.validate()
				if (!triggerValid) return false
			}

			if (this.$refs.subQuestions) {
				for (const subQuestion of this.$refs.subQuestions) {
					if (subQuestion.validate) {
						const valid = await subQuestion.validate()
						if (!valid) return false
					}
				}
			}

			return true
		},
	},
}
</script>

<style lang="scss" scoped>
.question-conditional {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.trigger-type-selector {
	padding: 16px;
	background-color: var(--color-background-dark);
	border-radius: var(--border-radius-large);

	&__label {
		margin-bottom: 12px;
		font-weight: bold;
	}

	&__options {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
}

.trigger-question {
	&__header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		padding: 8px;
		background-color: var(--color-primary-element-light);
		border-radius: var(--border-radius);
	}

	&__icon {
		color: var(--color-primary-element);
	}

	&__type-label {
		font-weight: 500;
		flex: 1;
	}

	&__instructions {
		margin: 0 0 12px 0;
		padding: 8px 12px;
		background-color: var(--color-background-hover);
		border-radius: var(--border-radius);
		color: var(--color-text-maxcontrast);
		font-size: 0.9em;
	}
}

.branches-editor {
	margin-top: 24px;
	padding: 16px;
	background-color: var(--color-background-dark);
	border-radius: var(--border-radius-large);

	&__title {
		margin: 0 0 8px 0;
		font-size: 1.1em;
	}

	&__description {
		margin-bottom: 16px;
		color: var(--color-text-maxcontrast);
	}
}

.branch {
	margin-bottom: 16px;
	padding: 12px;
	background-color: var(--color-main-background);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius);

	&__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	&__label {
		font-weight: 500;
	}

	&__conditions {
		margin-bottom: 12px;
	}

	&__subquestions {
		padding-inline-start: 16px;
		border-inline-start: 3px solid var(--color-primary-element-light);
	}
}

.active-subquestions {
	margin-top: 16px;
	padding-inline-start: 16px;
	border-inline-start: 3px solid var(--color-primary-element);
}

// Only opacity and transform change between the states below; naming them keeps `all`
// from animating whatever else shifts as a branch is pulled out of the flow, and keeps
// the work on the compositor.
.branch-list-move,
.branch-list-enter-active,
.branch-list-leave-active {
	transition:
		opacity var(--animation-slow) ease,
		transform var(--animation-slow) ease;
}

.branch-list-enter-from,
.branch-list-leave-to {
	opacity: 0;
	transform: translateX(var(--clickable-area-large));

	// Enter from, and leave toward, the same side in either reading direction.
	&:dir(rtl) {
		transform: translateX(calc(-1 * var(--clickable-area-large)));
	}
}

.branch-list-leave-active {
	position: absolute;
}

// Subquestions appear as the trigger answer changes; without motion they simply appear.
@media (prefers-reduced-motion: reduce) {
	.branch-list-move,
	.branch-list-enter-active,
	.branch-list-leave-active {
		transition: none;
	}
}
</style>
