<!--
  - SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
  Copy questions from another form.

  The server already knew how to clone a question with its options; it simply refused to do so
  across forms. That restriction is lifted for forms the user may edit, so this dialog is a
  picker over the existing clone call rather than a second copy implementation.

  Imported questions arrive without any display condition, branching rule or conditional
  parent: those reference question ids in the form they came from, which mean nothing here.
-->
<template>
	<NcDialog
		:open="open"
		:name="t('forms', 'Import questions')"
		size="normal"
		:noClose="importing"
		@update:open="onUpdateOpen">
		<!-- aria-busy while a list loads; the spinners carry names of their own. Not a live
		     region: that would read out every question of a long form once it arrived. -->
		<div
			class="import"
			:aria-busy="loadingForms || loadingQuestions ? 'true' : 'false'">
			<NcLoadingIcon
				v-if="loadingForms"
				:size="32"
				:name="t('forms', 'Loading forms …')" />

			<!-- A failed request is not the same as having no other forms: say so, and
			     offer to try again without closing the dialog. -->
			<NcEmptyContent
				v-else-if="loadError"
				:name="t('forms', 'Could not load your forms')">
				<template #action>
					<NcButton @click="loadForms">
						{{ t('forms', 'Retry') }}
					</NcButton>
				</template>
			</NcEmptyContent>

			<template v-else-if="otherForms.length === 0">
				<NcEmptyContent :name="t('forms', 'No other forms to import from')">
					<template #description>
						{{
							t(
								'forms',
								'Questions can be imported from any form you are able to edit.',
							)
						}}
					</template>
				</NcEmptyContent>
			</template>

			<template v-else>
				<label class="import__row">
					<span>{{ t('forms', 'Copy from') }}</span>
					<!-- Locked while copying: a new choice clears the selection the
					     running import is still working through. -->
					<select
						:value="selectedFormId ?? ''"
						:disabled="importing"
						@change="onSelectForm">
						<option disabled value="">
							{{ t('forms', 'Choose a form') }}
						</option>
						<option
							v-for="candidate in otherForms"
							:key="candidate.id"
							:value="candidate.id">
							{{ candidate.title || t('forms', 'Untitled form') }}
						</option>
					</select>
				</label>

				<NcLoadingIcon
					v-if="loadingQuestions"
					:size="32"
					:name="t('forms', 'Loading questions …')" />

				<template v-else-if="selectedFormId">
					<p v-if="importable.length === 0" class="import__empty">
						{{
							t(
								'forms',
								'That form has no questions that can be copied.',
							)
						}}
					</p>
					<template v-else>
						<NcCheckboxRadioSwitch
							:modelValue="allChosen"
							:indeterminate="someChosen && !allChosen"
							@update:modelValue="onToggleAll">
							{{ t('forms', 'Select all') }}
						</NcCheckboxRadioSwitch>
						<ul class="import__list">
							<li v-for="question in importable" :key="question.id">
								<NcCheckboxRadioSwitch
									:modelValue="chosen.includes(question.id)"
									@update:modelValue="
										onToggle(question.id, $event)
									">
									{{
										question.text
										|| t('forms', 'Untitled question')
									}}
									<span class="import__type">
										{{ typeLabel(question.type) }}
									</span>
								</NcCheckboxRadioSwitch>
							</li>
						</ul>
					</template>
				</template>
			</template>
		</div>

		<template #actions>
			<NcButton
				:disabled="chosen.length === 0 || importing"
				variant="primary"
				@click="onImport">
				<template v-if="importing" #icon>
					<NcLoadingIcon :size="20" />
				</template>
				{{
					chosen.length
						? n(
								'forms',
								'Copy %n question',
								'Copy %n questions',
								chosen.length,
							)
						: t('forms', 'Copy')
				}}
			</NcButton>
		</template>
	</NcDialog>
</template>

<script>
import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { translate as t } from '@nextcloud/l10n'
import { generateOcsUrl } from '@nextcloud/router'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import answerTypes from '../models/AnswerTypes.js'
import logger from '../utils/Logger.js'
import OcsResponse2Data from '../utils/OcsResponse2Data.js'

/** Display-only blocks are copied happily; only these carry no meaning on their own. */
const NOT_IMPORTABLE = ['conditional']

export default {
	name: 'ImportQuestionsDialog',

	components: {
		NcButton,
		NcCheckboxRadioSwitch,
		NcDialog,
		NcEmptyContent,
		NcLoadingIcon,
	},

	props: {
		open: {
			type: Boolean,
			default: false,
		},

		formId: {
			type: Number,
			required: true,
		},
	},

	emits: ['update:open', 'imported'],

	data() {
		return {
			forms: [],
			questions: [],
			chosen: [],
			selectedFormId: null,
			loadingForms: false,
			loadError: false,
			loadingQuestions: false,
			importing: false,
		}
	},

	computed: {
		/** @return {Array} forms other than the one being edited */
		otherForms() {
			return this.forms.filter((form) => form.id !== this.formId)
		},

		/**
		 * Conditional containers are excluded: their subquestions live in separate rows tied
		 * to the parent, so copying the container alone would produce an empty shell.
		 *
		 * @return {Array} questions that can be copied
		 */
		importable() {
			return this.questions.filter((q) => !NOT_IMPORTABLE.includes(q.type))
		},

		/** @return {boolean} whether every importable question is selected */
		allChosen() {
			return (
				this.importable.length > 0
				&& this.chosen.length === this.importable.length
			)
		},

		/** @return {boolean} whether at least one is selected */
		someChosen() {
			return this.chosen.length > 0
		},
	},

	watch: {
		open: {
			immediate: true,
			handler(isOpen) {
				if (isOpen) {
					this.loadForms()
				}
			},
		},
	},

	methods: {
		/**
		 * Closing mid-copy would unmount the dialog while the server keeps creating
		 * copies, and the editor would never hear about them. Escape and the backdrop
		 * still reach here even with the close button hidden, so they are ignored too.
		 *
		 * @param {boolean} isOpen the requested state
		 */
		onUpdateOpen(isOpen) {
			if (this.importing && !isOpen) {
				return
			}
			this.$emit('update:open', isOpen)
		},

		/**
		 * @param {string} type the answer type
		 * @return {string} its human label
		 */
		typeLabel(type) {
			return answerTypes[type]?.label ?? type
		},

		/**
		 * The forms questions can come from: the user's own, plus forms shared with them
		 * that they may edit, which the server also accepts as a copy source. The list
		 * endpoint returns only one of the two per request.
		 */
		async loadForms() {
			this.loadingForms = true
			this.loadError = false
			const url = generateOcsUrl('apps/forms/api/v3/forms')
			const [owned, shared] = await Promise.allSettled([
				axios.get(url),
				axios.get(url, { params: { type: 'shared' } }),
			])

			if (owned.status === 'rejected') {
				logger.error('Could not load forms to import from', {
					error: owned.reason,
				})
				showError(t('forms', 'Could not load your forms'))
				this.forms = []
				this.loadError = true
				this.loadingForms = false
				return
			}

			const forms = OcsResponse2Data(owned.value) ?? []
			if (shared.status === 'fulfilled') {
				const known = new Set(forms.map((form) => form.id))
				for (const form of OcsResponse2Data(shared.value) ?? []) {
					if (!known.has(form.id) && form.permissions?.includes('edit')) {
						known.add(form.id)
						forms.push(form)
					}
				}
			} else {
				// The user's own forms are still worth offering on their own.
				logger.error('Could not load shared forms to import from', {
					error: shared.reason,
				})
			}
			this.forms = forms
			this.loadingForms = false
		},

		/** @param {Event} event the select change */
		async onSelectForm(event) {
			const requestedId = Number(event.target.value)
			this.selectedFormId = requestedId
			this.chosen = []
			this.loadingQuestions = true
			// Answers can arrive out of order when the choice changes quickly; only the one
			// for the form still selected may fill the list.
			try {
				const response = await axios.get(
					generateOcsUrl('apps/forms/api/v3/forms/{id}', {
						id: requestedId,
					}),
				)
				if (requestedId !== this.selectedFormId) {
					return
				}
				this.questions = OcsResponse2Data(response)?.questions ?? []
			} catch (error) {
				if (requestedId !== this.selectedFormId) {
					return
				}
				logger.error('Could not load questions to import', { error })
				showError(t('forms', 'Could not load that form’s questions'))
				this.questions = []
			} finally {
				if (requestedId === this.selectedFormId) {
					this.loadingQuestions = false
				}
			}
		},

		/**
		 * @param {number} questionId the question toggled
		 * @param {boolean} selected its new state
		 */
		onToggle(questionId, selected) {
			this.chosen = selected
				? [...this.chosen, questionId]
				: this.chosen.filter((id) => id !== questionId)
		},

		/** @param {boolean} selected whether to select every question */
		onToggleAll(selected) {
			this.chosen = selected ? this.importable.map((q) => q.id) : []
		},

		async onImport() {
			this.importing = true
			const created = []
			const copiedIds = []
			// Fixed up front, so nothing that changes the selection mid-way can cut the
			// import short while it still reports success.
			const toCopy = this.importable.filter((question) =>
				this.chosen.includes(question.id),
			)
			try {
				// Sequential rather than parallel: each copy is appended at the end of the
				// form, so firing them at once would give an unpredictable resulting order.
				for (const question of toCopy) {
					const response = await axios.post(
						generateOcsUrl('apps/forms/api/v3/forms/{id}/questions', {
							id: this.formId,
						}),
						{ fromId: question.id },
					)
					created.push(OcsResponse2Data(response))
					copiedIds.push(question.id)
				}
				this.$emit('imported', created)
				this.$emit('update:open', false)
			} catch (error) {
				logger.error('Could not import questions', { error })
				// Some may already have been copied; say so rather than implying none were.
				showError(
					created.length
						? t('forms', 'Only some questions could be copied')
						: t('forms', 'Could not copy the questions'),
				)
				// The dialog stays open for a retry, which should only cover what failed;
				// leaving the copied ones ticked would copy them a second time.
				this.chosen = this.chosen.filter((id) => !copiedIds.includes(id))
				if (created.length) {
					this.$emit('imported', created)
				}
			} finally {
				this.importing = false
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.import {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-height: 120px;

	&__row {
		align-items: center;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;

		select {
			flex: 1 1 12ch;
			min-height: 44px;
			min-width: 0;
		}
	}

	&__list {
		max-height: 320px;
		overflow-y: auto;
	}

	&__type {
		color: var(--color-text-maxcontrast);
		margin-inline-start: 8px;
	}

	&__empty {
		color: var(--color-text-maxcontrast);
	}

	@media (max-width: 512px) {
		&__row {
			align-items: stretch;
			flex-direction: column;
		}
	}
}
</style>
