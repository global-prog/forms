/**
 * SPDX-FileCopyrightText: 2025 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { FormsOption } from '../models/Entities.d.ts'

import { getRequestToken } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { showError, showUndo } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { translate as t } from '@nextcloud/l10n'
import { generateOcsUrl } from '@nextcloud/router'
import debounce from 'debounce'
import { defineComponent } from 'vue'
import { INPUT_DEBOUNCE_MS, OptionType } from '../models/Constants.ts'
import logger from '../utils/Logger.js'

export default defineComponent({
	emits: ['update:options'],

	data() {
		return {
			dirtyOptionsType: null,
			// Deleted options the server has not been told about yet, so the deletion can
			// still be undone: option id -> its type, and functions that send it now,
			// either as usual or in a way that outlives the page
			pendingOptionDeletes: {} as Record<
				number,
				{
					optionType: string
					send: (quiet?: boolean) => Promise<void>
					sendOnLeave: () => void
				}
			>,
		}
	},

	created() {
		// Built per instance: a debounced watcher defined once in `watch` is shared by
		// every question, and the debounce library throws when a second question calls
		// it before the first one's timer ran, so that question's new order was never saved.
		this.debouncedSaveOptionsOrder = debounce(() => {
			if (!this.dirtyOptionsType) {
				return
			}
			this.saveOptionsOrder(this.dirtyOptionsType)
		}, INPUT_DEBOUNCE_MS)
	},

	mounted() {
		// Only the editor deletes options
		if (!this.readOnly) {
			window.addEventListener('pagehide', this.sendPendingOptionDeletesOnLeave)
		}
	},

	beforeUnmount() {
		window.removeEventListener('pagehide', this.sendPendingOptionDeletesOnLeave)
		// A reorder made just before leaving is saved now rather than dropped. It sends
		// the deletions of its own option type first, as every reorder does.
		this.debouncedSaveOptionsOrder.flush()
		// Leaving the editor within the app takes the undo toast's question away, so the
		// deletion goes out now rather than being lost. There is nothing left on screen
		// to restore the option into if it fails.
		this.flushPendingOptionDeletes(null, true)
	},

	computed: {
		areNoneChecked() {
			return this.values.length === 0
		},

		contentValid() {
			return this.answerType.validate(this)
		},

		isLastEmpty() {
			const value = this.options[this.options.length - 1]
			return value?.text?.trim?.().length === 0
		},

		expectedOptionTypes() {
			return [OptionType.Choice, OptionType.Row, OptionType.Column]
		},

		sortedOptionsPerType(): { [key: string]: FormsOption[] } {
			const optionsPerType = Object.fromEntries(
				this.expectedOptionTypes.map((optionType) => [optionType, []]),
			)

			this.options.forEach((option) => {
				optionsPerType[option.optionType].push(option)
			})

			for (const optionType of Object.keys(optionsPerType)) {
				// Only shuffle options if not in editing mode (and shuffling is enabled)
				if (this.readOnly && this.extraSettings?.shuffleOptions) {
					optionsPerType[optionType] = this.shuffleArray(
						optionsPerType[optionType],
					)
				} else {
					// Ensure order of options always is the same
					optionsPerType[optionType] = [
						...optionsPerType[optionType],
					].sort((a, b) => {
						if (a.order === b.order) {
							return a.id - b.id
						}
						return (a.order ?? 0) - (b.order ?? 0)
					})

					if (!this.readOnly) {
						// In edit mode append an empty option
						optionsPerType[optionType].push({
							local: true,
							questionId: this.id,
							text: '',
							optionType,
							order: optionsPerType[optionType].length,
						})
					}
				}
			}

			return optionsPerType
		},
	},

	methods: {
		/**
		 * How long the drag-and-drop library animates a reordered item. It sets the
		 * transition inline, so a stylesheet cannot switch it off for people who asked
		 * the system for less motion; this has to.
		 *
		 * @param ms the animation length when motion is welcome
		 */
		sortAnimation(ms: number = 300): number {
			return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
				? 0
				: ms
		},

		/**
		 * Re-check a question that is showing an error once the answer changes, so the
		 * red note goes away as soon as the respondent fixes it instead of lingering
		 * until the next Next or Submit. It waits a tick for the new values to arrive.
		 */
		revalidateIfInvalid() {
			if (this.errorMessage) {
				this.$nextTick(() => this.validate())
			}
		},

		/**
		 * Set focus on next AnswerInput
		 *
		 * @param index Index of current option
		 * @param optionType Type of current option
		 */
		focusNextInput(index: number, optionType: string) {
			this.focusIndex(index + 1, optionType)
		},

		/**
		 * Focus the input matching the index
		 *
		 * @param index the value index
		 * @param optionType the option type to focus. Callers shared with every question
		 *   type (adding several options at once) only ever add choices and pass none.
		 */
		focusIndex(index: number, optionType: string = OptionType.Choice) {
			// refs are not guaranteed to be in correct order - we need to find the correct item
			const item = this.$refs.input.find((instance) => {
				return (
					instance.$props.optionType === optionType
					&& instance.$props.index === index
				)
			})
			if (item) {
				item.focus()
			} else {
				logger.warn('Could not find option to focus', {
					index,
					options: this.sortedOptionsPerType[optionType],
				})
			}
		},

		sortOptionsOfType(
			options: FormsOption[],
			optionType: string,
		): FormsOption[] {
			// Only shuffle options if not in editing mode (and shuffling is enabled)
			options = options.filter((option) => option.optionType === optionType)
			if (this.readOnly && this.extraSettings?.shuffleOptions) {
				return this.shuffleArray(options)
			}

			// Ensure order of options always is the same
			options = [...options].sort((a, b) => {
				if (a.order === b.order) {
					return a.id - b.id
				}
				return (a.order ?? 0) - (b.order ?? 0)
			})

			if (!this.readOnly) {
				// In edit mode append an empty option
				return [
					...options,
					{
						local: true,
						questionId: this.id,
						text: '',
						optionType,
						order: options.length,
					},
				]
			}
			return options
		},

		updateOptionsOrder(newOptions: FormsOption[], optionType: string) {
			this.replaceOptionsOfType(
				newOptions
					.filter((option) => !option.local)
					.map((option, index) => {
						return {
							...option,
							order: index,
						}
					}),
				optionType,
			)
		},

		/**
		 * Handles the creation of a new answer option.
		 *
		 * @param index the index of the answer
		 * @param answer - The new answer option to be added.
		 */
		onCreateAnswer(index: number, answer: FormsOption): void {
			this.$nextTick(() => {
				// Move focus to the newly appended empty local option.
				this.$nextTick(() => this.focusIndex(index + 1, answer.optionType))
			})
			this.updateOptions([...this.options, answer])
		},

		/**
		 * Replace all options of a certain type
		 *
		 * @param options options to change
		 * @param optionType the type of options to update
		 */
		replaceOptionsOfType(options: FormsOption[], optionType: string) {
			const updatedOptions = [
				...this.options.filter((option) => option.optionType !== optionType),
				...options,
			]

			this.updateOptions(updatedOptions)
		},
		/**
		 * Update the options
		 * This will handle updating the form (emitting the changes) and update last changed property
		 *
		 * @param options options to change
		 */
		updateOptions(options: FormsOption[]) {
			this.$emit('update:options', options)
			emit('forms:last-updated:set', this.formId)
		},

		/**
		 * Update an existing answer locally
		 *
		 * @param index the current index to update
		 * @param answer the new answer value
		 */
		updateAnswer(index: number, answer: FormsOption) {
			const options = [...this.sortedOptionsPerType[answer.optionType]]
			const [oldValue] = options.splice(index, 1, answer)

			// New value created - we need to set the correct focus
			if (oldValue.local && !answer.local) {
				this.$nextTick(() => {
					this.$nextTick(() => this.focusIndex(index, answer.optionType))
				})
			}

			this.replaceOptionsOfType(
				options.filter(({ local }) => !local),
				answer.optionType,
			)
		},

		/**
		 * Remove any empty options when leaving an option
		 *
		 * @param optionType The type of options to validate
		 */
		checkValidOption(optionType: string) {
			// When leaving edit mode, filter and delete empty options. That is tidying up
			// rather than something the user asked for, so it offers no undo.
			this.sortedOptionsPerType[optionType].forEach((option) => {
				if (!option.text && !option.local) {
					this.deleteOption(option, false)
				}
			})
		},

		/**
		 * Delete an option
		 *
		 * The option leaves the list at once, but the server is only told once the undo
		 * toast has gone, so a slip of the finger on a delete button costs nothing.
		 *
		 * @param optionToDelete The option to delete
		 * @param withUndo Whether to offer an undo before the deletion is sent
		 */
		deleteOption(optionToDelete: FormsOption, withUndo: boolean = true) {
			const optionType = optionToDelete.optionType
			const sortedOptions = this.sortedOptionsPerType[optionType]
			const index = sortedOptions.findIndex(
				(option) => option.id === optionToDelete.id,
			)
			const options = [...sortedOptions]
			const [option] = options.splice(index, 1)

			if (withUndo && !option.local) {
				this.deleteOptionWithUndo(option, index)
			} else {
				this.deleteOptionFromDatabase(option, index)
			}

			// Update question - remove option and reorder other
			this.replaceOptionsOfType(
				options
					.filter(({ local }) => !local)
					.map((option, order) => ({ ...option, order })),
				optionType,
			)

			// Focus the previous option
			this.$nextTick(() => this.focusIndex(Math.max(index - 1, 0), optionType))
		},

		/**
		 * Offer to undo a deletion, and send it once the toast closes, whether it timed
		 * out or was dismissed.
		 *
		 * @param option The deleted option
		 * @param index Its position among the options of its type
		 */
		deleteOptionWithUndo(option: FormsOption, index: number) {
			let settled = false
			let toast: ReturnType<typeof showUndo> | null = null

			// Whichever of undo, send or leave comes first decides; the others do nothing
			const settle = () => {
				if (settled) {
					return false
				}
				settled = true
				delete this.pendingOptionDeletes[option.id]
				return true
			}

			const send = (quiet = false, hideToast = true) => {
				if (!settle()) {
					return Promise.resolve()
				}
				if (hideToast) {
					toast?.hideToast()
				}
				return this.deleteOptionFromDatabase(option, index, quiet)
			}

			toast = showUndo(
				this.optionDeletedMessage(option.optionType),
				() => {
					if (settle()) {
						this.restoreOption(option, index)
					}
				},
				// Runs once the toast is gone for any reason, the undo button included; by
				// then an undo has already settled the matter.
				{ onRemove: () => send(false, false) },
			)

			this.pendingOptionDeletes[option.id] = {
				optionType: option.optionType,
				send,
				sendOnLeave: () => {
					if (settle()) {
						// A page kept in the back/forward cache comes back with the toast
						// still showing, and an undo there could no longer take effect.
						toast?.hideToast()
						this.deleteOptionOnLeave(option.id)
					}
				},
			}
		},

		/**
		 * What the undo toast says. A grid deletes its rows and columns through the same
		 * path, so the message names which one went.
		 *
		 * @param optionType the type of the deleted option
		 */
		optionDeletedMessage(optionType: string): string {
			if (optionType === OptionType.Column) {
				return t('forms', 'Column deleted')
			}
			if (optionType === OptionType.Row) {
				return t('forms', 'Row deleted')
			}
			return t('forms', 'Option deleted')
		},

		/**
		 * Send the deletions still waiting on their undo toast.
		 *
		 * The server only reorders a complete set of options, so an option that is gone
		 * here but still stored there would make a reorder fail.
		 *
		 * @param optionType only send deletions of this type, or all of them when null
		 * @param quiet neither report a failure nor restore the option
		 */
		flushPendingOptionDeletes(
			optionType: string | null = null,
			quiet: boolean = false,
		): Promise<unknown> {
			const sends = Object.values(this.pendingOptionDeletes)
				.filter(
					(pending) =>
						optionType === null || pending.optionType === optionType,
				)
				.map((pending) => pending.send(quiet))
			return Promise.all(sends)
		},

		/**
		 * Copy this question. The server makes the copy from the options it has stored,
		 * so any deletion still waiting on its undo toast goes out first; otherwise the
		 * deleted option would come back in the copy.
		 */
		async onClone() {
			await this.flushPendingOptionDeletes()
			this.$emit('clone')
		},

		/**
		 * The page is being closed or navigated away from: send what is pending.
		 */
		sendPendingOptionDeletesOnLeave() {
			Object.values(this.pendingOptionDeletes).forEach((pending) => {
				pending.sendOnLeave()
			})
		},

		/**
		 * Delete an option while the page goes away. An ordinary request would be
		 * cancelled along with the page, so this one is left for the browser to finish.
		 *
		 * @param optionId the option id
		 */
		deleteOptionOnLeave(optionId: number) {
			const logFailure = (error: unknown) => {
				logger.error('Could not send a pending option deletion', { error })
			}
			try {
				fetch(this.optionUrl(optionId), {
					method: 'DELETE',
					keepalive: true,
					headers: {
						requesttoken: getRequestToken() ?? '',
						'OCS-APIRequest': 'true',
					},
				}).catch(logFailure)
			} catch (error) {
				logFailure(error)
			}
		},

		/**
		 * The API address of one option of this question
		 *
		 * @param optionId the option id
		 */
		optionUrl(optionId: number): string {
			return generateOcsUrl(
				'apps/forms/api/v3/forms/{id}/questions/{questionId}/options/{optionId}',
				{
					id: this.formId,
					questionId: this.id,
					optionId,
				},
			)
		},

		/**
		 * Delete the option from Db in background.
		 * Restore option if delete not possible
		 *
		 * @param option The option to delete
		 * @param index Its position among the options of its type
		 * @param quiet neither report a failure nor restore the option
		 */
		deleteOptionFromDatabase(
			option: FormsOption & { local?: boolean },
			index: number,
			quiet: boolean = false,
		): Promise<void> {
			if (option.local) {
				return Promise.resolve()
			}

			return axios
				.delete(this.optionUrl(option.id))
				.then(() => {})
				.catch((error) => {
					logger.error('Error while deleting an option', {
						error,
						option,
					})
					if (quiet) {
						return
					}
					showError(t('forms', 'There was an issue deleting this option'))
					// restore option
					this.restoreOption(option, index)
				})
		},

		/**
		 * Put a deleted option back locally, where it was among the options of its type
		 *
		 * @param option the option
		 * @param index its former position among the options of its type
		 */
		restoreOption(option: FormsOption, index: number) {
			const optionType = option.optionType
			const options = this.sortedOptionsPerType[optionType].filter(
				({ local }) => !local,
			)
			// Another option may have been deleted in the meantime
			const position = Math.min(Math.max(index, 0), options.length)
			options.splice(position, 0, option)

			// Deleting renumbered the options that stayed, so the restored one only gets
			// its place back once all of them are numbered again.
			this.replaceOptionsOfType(
				options.map((item, order) => ({ ...item, order })),
				optionType,
			)
			this.$nextTick(() => this.focusIndex(position, optionType))
		},

		async saveOptionsOrder(optionType: string) {
			try {
				// The new order must list exactly the options the server holds
				await this.flushPendingOptionDeletes(optionType)
				const newOrder = this.sortedOptionsPerType[optionType]
					.filter((option) => !option.local)
					.map((option) => option.id)

				await axios.patch(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/questions/{questionId}/options',
						{
							id: this.formId,
							questionId: this.id,
						},
					),
					{
						newOrder,
						optionType,
					},
				)
				emit('forms:last-updated:set', this.formId)
				this.dirtyOptionsType = null
			} catch (error) {
				logger.error('Could not reorder options', { error })
				showError(t('forms', 'Error while saving options order'))
			}
		},

		/**
		 * Reorder option by moving it upwards the list
		 *
		 * @param index Option that should move up
		 * @param optionType Type of current option
		 */
		onOptionMoveUp(index: number, optionType: string) {
			if (index > 0) {
				this.onOptionMoveDown(index - 1, optionType)
			}
		},

		/**
		 * Reorder option by moving it downwards the list
		 *
		 * @param index Option that should move down
		 * @param optionType Type of current option
		 */
		onOptionMoveDown(index: number, optionType: string) {
			if (index === this.sortedOptionsPerType[optionType].length - 1) {
				return
			}

			// swap positions
			const first = this.sortedOptionsPerType[optionType][index]
			const second = this.sortedOptionsPerType[optionType][index + 1]
			second.order = index
			first.order = index + 1

			this.dirtyOptionsType = optionType
		},
	},

	watch: {
		dirtyOptionsType() {
			this.debouncedSaveOptionsOrder()
		},
	},
})
