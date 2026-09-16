<!--
  - SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<Question
		v-bind="questionProps"
		:titlePlaceholder="answerType.titlePlaceholder"
		:warningInvalid="answerType.warningInvalid"
		:errorMessage="errorMessage"
		:isTriggerQuestion="isTriggerQuestion"
		v-on="commonListeners">
		<template #actions>
			<template v-if="!allowedFileTypesDialogOpened">
				<NcActionButton isMenu @click="allowedFileTypesDialogOpened = true">
					<template #icon>
						<NcIconSvgWrapper :svg="IconFileDocumentAlert" />
					</template>
					{{ allowedFileTypesLabel }}
				</NcActionButton>

				<NcActionInput
					type="number"
					:modelValue="maxAllowedFilesCount"
					labelOutside
					:label="t('forms', 'Maximum number of files')"
					:showTrailingButton="false"
					@update:modelValue="onMaxAllowedFilesCountInput" />

				<NcActionInput
					type="number"
					:modelValue="maxFileSizeValue"
					labelOutside
					:showTrailingButton="false"
					:label="t('forms', 'Maximum file size')"
					@update:modelValue="onMaxFileSizeValueInput" />

				<NcActionInput
					type="multiselect"
					:modelValue="selectedUnit"
					:options="availableUnits"
					:ariaLabelCombobox="t('forms', 'Maximum file size unit')"
					required
					:clearable="false"
					:searchable="false"
					@update:modelValue="onMaxFileSizeUnitInput" />
			</template>

			<template v-else>
				<NcActionSeparator />

				<NcActionButton @click="allowedFileTypesDialogOpened = false">
					<template #icon>
						<NcIconSvgWrapper :svg="IconBack" />
					</template>
					{{ t('forms', 'Allow only specific file types') }}
				</NcActionButton>

				<NcActionCheckbox
					v-for="({ label: fileTypeLabel }, fileType) in fileTypes"
					:key="fileType"
					:modelValue="extraSettings?.allowedFileTypes?.includes(fileType)"
					:value="fileType"
					class="file-type-checkbox"
					@update:modelValue="onAllowedFileTypesChange(fileType, $event)">
					{{ fileTypeLabel }}
				</NcActionCheckbox>

				<NcActionInput
					key="allowed-file-extensions-multiselect"
					:label="t('forms', 'Custom file extensions')"
					type="multiselect"
					multiple
					taggable
					:modelValue="allowedFileExtensions"
					@option:created="onAllowedFileExtensionsAdded"
					@option:deselected="onAllowedFileExtensionsDeleted" />

				<NcActionSeparator />
			</template>
		</template>

		<div class="question__content">
			<ul ref="fileList" tabindex="-1">
				<NcListItem
					v-for="uploadedFile of values"
					:key="uploadedFile.uploadedFileId"
					:name="uploadedFile.fileName"
					compact>
					<template #icon>
						<NcIconSvgWrapper :svg="IconFile" />
					</template>

					<template #actions>
						<NcActionButton
							@click="
								onDeleteUploadedFile(uploadedFile.uploadedFileId)
							">
							<template #icon>
								<NcIconSvgWrapper :svg="IconDelete" />
							</template>
							{{ t('forms', 'Delete') }}
						</NcActionButton>
					</template>
				</NcListItem>
				<li v-if="fileLoading" class="question__loading">
					<NcLoadingIcon v-show="fileLoading" />
					{{ t('forms', 'Uploading …') }}
				</li>
				<li v-else-if="values.length < maxAllowedFilesCount">
					<div
						class="question__input-wrapper"
						:class="{ 'question__input-wrapper--dragging': dragging }"
						role="group"
						:aria-labelledby="titleId"
						:aria-describedby="description ? descriptionId : undefined"
						:aria-errormessage="hasError ? errorId : undefined"
						:aria-invalid="hasError ? 'true' : undefined"
						@dragenter.prevent="onDragEnter"
						@dragover.prevent="onDragOver"
						@dragleave="onDragLeave"
						@drop.prevent="onDrop">
						<label>
							{{
								readOnly
									? n(
											'forms',
											'Choose a file or drop it here',
											'Choose files or drop them here',
											maxAllowedFilesCount,
										)
									: t('forms', 'Add new file as answer')
							}}
							<input
								ref="fileInput"
								class="hidden-visually"
								type="file"
								:required="isRequired && values.length === 0"
								:disabled="!readOnly"
								:multiple="maxAllowedFilesCount > 1"
								:name="name || undefined"
								:accept="
									acceptTokens.length
										? acceptTokens.join(',')
										: null
								"
								@invalid.prevent="validate"
								@input="onFileInput" />
						</label>
						<NcButton
							ref="uploadButton"
							:disabled="
								!readOnly || values.length >= maxAllowedFilesCount
							"
							:aria-label="
								n(
									'forms',
									'Choose a file',
									'Choose files',
									maxAllowedFilesCount,
								)
							"
							variant="tertiary-no-background"
							@click="toggleFileInput">
							<template #icon>
								<NcIconSvgWrapper
									v-if="maxAllowedFilesCount > 1"
									:svg="IconUploadMultiple" />
								<NcIconSvgWrapper v-else :svg="IconUpload" />
							</template>
						</NcButton>
					</div>
				</li>
			</ul>
			<p v-if="limitsHint" class="question__file-hint">
				{{ limitsHint }}
			</p>
			<!-- Picking a file swaps the focused input for a spinner, so the start and end
			     of the upload are announced here instead. -->
			<p class="hidden-visually" role="status" aria-live="polite">
				{{ uploadStatus }}
			</p>
		</div>
		<template #insert>
			<slot name="insert" />
		</template>
	</Question>
</template>

<script>
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconFile from '@material-symbols/svg-400/outlined/draft.svg?raw'
import IconFileDocumentAlert from '@material-symbols/svg-400/outlined/quick_reference.svg?raw'
import IconUpload from '@material-symbols/svg-400/outlined/upload.svg?raw'
import IconUploadMultiple from '@material-symbols/svg-400/outlined/upload_file.svg?raw'
import axios from '@nextcloud/axios'
import { showError } from '@nextcloud/dialogs'
import { formatFileSize } from '@nextcloud/files'
import { loadState } from '@nextcloud/initial-state'
import { translatePlural as n, translate as t } from '@nextcloud/l10n'
import { generateOcsUrl } from '@nextcloud/router'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcListItem from '@nextcloud/vue/components/NcListItem'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import Question from './Question.vue'
import QuestionMixin from '../../mixins/QuestionMixin.js'
import fileTypes from '../../models/FileTypes.js'
import { IconBack } from '../../utils/DirectionalIcons.js'
import logger from '../../utils/Logger.js'
import OcsResponse2Data from '../../utils/OcsResponse2Data.js'

/**
 * A constant object representing file size units in bytes.
 *
 * @example
 * ```typescript
 * const kilobytes = FILE_SIZE_UNITS.kb; // 1024
 * const megabytes = FILE_SIZE_UNITS.mb; // 1048576
 * const gigabytes = FILE_SIZE_UNITS.gb; // 1073741824
 * ```
 */
const FILE_SIZE_UNITS = {
	kb: 1024,
	mb: 1024 ** 2,
	gb: 1024 ** 3,
}

/**
 * The office groups are stored under Nextcloud's own alias names, which a browser does
 * not know: `x-office/document` in an `accept` list is ignored, and a picker offered
 * `image/*, x-office/document` shows images only. These are the files each alias covers,
 * by extension and by type, so the picker can offer them.
 */
const OFFICE_ACCEPT = {
	'x-office/document': [
		'.doc',
		'.docx',
		'.docm',
		'.dot',
		'.dotx',
		'.dotm',
		'.odt',
		'.ott',
		'.odm',
		'.oth',
		'.fodt',
		'.rtf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.oasis.opendocument.text',
	],
	'x-office/presentation': [
		'.ppt',
		'.pptx',
		'.pptm',
		'.pps',
		'.ppsx',
		'.ppsm',
		'.pot',
		'.potx',
		'.potm',
		'.odp',
		'.otp',
		'.fodp',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'application/vnd.oasis.opendocument.presentation',
	],
	'x-office/spreadsheet': [
		'.xls',
		'.xlsx',
		'.xlsm',
		'.xlsb',
		'.xlt',
		'.xltx',
		'.xltm',
		'.ods',
		'.ots',
		'.fods',
		'.csv',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/vnd.oasis.opendocument.spreadsheet',
		'text/csv',
	],
}

export default {
	name: 'QuestionFile',
	components: {
		NcIconSvgWrapper,
		NcActionButton,
		NcActionCheckbox,
		NcActionInput,
		NcActionSeparator,
		NcButton,
		NcListItem,
		NcLoadingIcon,
		Question,
	},

	mixins: [QuestionMixin],
	emits: ['update:values'],

	setup() {
		return {
			IconBack,
			IconDelete,
			IconFile,
			IconFileDocumentAlert,
			IconUpload,
			IconUploadMultiple,
		}
	},

	data() {
		return {
			fileTypes,
			fileLoading: false,
			uploadStatus: '',
			maxFileSizeUnit: Object.keys(FILE_SIZE_UNITS)[0],
			maxFileSizeValue: '',
			allowedFileTypesDialogOpened: false,
			// Counts nested enter/leave pairs, which fire for every child the file crosses.
			dragDepth: 0,
		}
	},

	computed: {
		/** @return {Array<{id: string, label: string}>} the size units, with readable names */
		availableUnits() {
			const labels = {
				kb: t('forms', 'KB'),
				mb: t('forms', 'MB'),
				gb: t('forms', 'GB'),
			}
			return Object.keys(FILE_SIZE_UNITS).map((id) => ({
				id,
				label: labels[id] ?? id.toUpperCase(),
			}))
		},

		/** @return {{id: string, label: string}|undefined} the unit currently chosen */
		selectedUnit() {
			return this.availableUnits.find(
				(unit) => unit.id === this.maxFileSizeUnit,
			)
		},

		dragging() {
			return this.dragDepth > 0
		},

		/** @return {string[]} what the picker may offer, with the office aliases spelled out */
		acceptTokens() {
			return this.accept.flatMap((token) => OFFICE_ACCEPT[token] ?? [token])
		},

		/**
		 * What a respondent needs to know before choosing: how many, what kind, how large.
		 * Nothing when the question sets none of those.
		 *
		 * @return {string}
		 */
		limitsHint() {
			const parts = []
			if (this.maxAllowedFilesCount > 1) {
				parts.push(
					n(
						'forms',
						'Up to %n file',
						'Up to %n files',
						this.maxAllowedFilesCount,
					),
				)
			}

			const kinds = [
				...(this.extraSettings?.allowedFileTypes ?? [])
					.map((type) => fileTypes[type]?.label)
					.filter(Boolean),
				...this.allowedFileExtensions.map((extension) =>
					extension.toUpperCase(),
				),
			]
			if (kinds.length) {
				parts.push(kinds.join(', '))
			}

			if (this.extraSettings?.maxFileSize > 0) {
				const size = formatFileSize(this.extraSettings.maxFileSize)
				parts.push(
					this.maxAllowedFilesCount > 1
						? t('forms', '{size} each at most', { size })
						: t('forms', '{size} at most', { size }),
				)
			}

			return parts.join(' · ')
		},

		maxAllowedFilesCount() {
			// Anything below one would remove the upload box and make the question
			// impossible to answer.
			return Math.max(
				1,
				parseInt(this.extraSettings?.maxAllowedFilesCount) || 1,
			)
		},

		allowedFileExtensions() {
			return this.extraSettings?.allowedFileExtensions || []
		},

		allowedFileTypesLabel() {
			const allowedFileTypes = []
			if (this.extraSettings?.allowedFileTypes?.length) {
				allowedFileTypes.push(
					...this.extraSettings.allowedFileTypes.map(
						(type) => fileTypes[type].label,
					),
				)
			}

			if (this.extraSettings?.allowedFileExtensions?.length) {
				allowedFileTypes.push(...this.extraSettings.allowedFileExtensions)
			}

			if (allowedFileTypes.length) {
				return t('forms', 'Allowed file types: {fileTypes}.', {
					fileTypes: allowedFileTypes.join(', '),
				})
			}

			return t('forms', 'All file types are allowed.')
		},
	},

	mounted() {
		if (this.extraSettings.maxFileSize) {
			Object.keys(FILE_SIZE_UNITS).forEach((unit) => {
				if (this.extraSettings.maxFileSize >= FILE_SIZE_UNITS[unit]) {
					this.maxFileSizeUnit = unit
				}
			})

			this.maxFileSizeValue =
				this.extraSettings.maxFileSize
				/ FILE_SIZE_UNITS[this.maxFileSizeUnit]
		}
	},

	methods: {
		toggleFileInput() {
			this.$refs.fileInput.click()
		},

		onDragEnter(event) {
			if (this.readOnly && event.dataTransfer?.types?.includes('Files')) {
				this.dragDepth++
			}
		},

		onDragOver(event) {
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = this.readOnly ? 'copy' : 'none'
			}
		},

		onDragLeave() {
			this.dragDepth = Math.max(0, this.dragDepth - 1)
		},

		onDrop(event) {
			this.dragDepth = 0
			if (!this.readOnly || this.fileLoading) {
				return
			}
			const files = [...(event.dataTransfer?.files ?? [])]
			if (files.length) {
				this.uploadFiles(files)
			}
		},

		/**
		 * Whether a file matches the picker's list. The picker enforces it only as a
		 * suggestion, and a dropped file skips the picker entirely; the server has the
		 * final say either way, this only saves an upload that would be refused.
		 *
		 * @param {File} file the file to check
		 * @return {boolean}
		 */
		isAcceptedType(file) {
			if (this.acceptTokens.length === 0) {
				return true
			}
			const name = file.name.toLowerCase()
			const type = (file.type || '').toLowerCase()
			return this.acceptTokens.some((token) => {
				token = token.toLowerCase()
				if (token.startsWith('.')) {
					return name.endsWith(token)
				}
				if (token.endsWith('/*')) {
					return type.startsWith(token.slice(0, -1))
				}
				return type === token
			})
		},

		async onFileInput() {
			const fileInput = this.$refs.fileInput
			const files = [...fileInput.files]
			// Cleared now, so choosing the same file again after a refusal still fires.
			fileInput.value = null
			await this.uploadFiles(files)
		},

		/**
		 * @param {File[]} files the files to upload as this question's answer
		 */
		async uploadFiles(files) {
			const remaining = this.maxAllowedFilesCount - this.values.length
			if (files.length > remaining) {
				showError(
					n(
						'forms',
						'Only %n more file can be added to this question.',
						'Only %n more files can be added to this question.',
						remaining,
					),
				)
				return
			}

			const formData = new FormData()
			let fileInvalid = false

			files.forEach((file) => {
				formData.append('files[]', file)

				if (!this.isAcceptedType(file)) {
					showError(
						t(
							'forms',
							'The file {fileName} is not a type this question accepts.',
							{
								fileName: file.name,
							},
						),
					)
					fileInvalid = true
					return
				}

				if (
					this.extraSettings.maxFileSize > 0
					&& file.size > this.extraSettings.maxFileSize
				) {
					showError(
						t(
							'forms',
							'The file {fileName} is too large. The maximum file size is {maxFileSize}.',
							{
								fileName: file.name,
								maxFileSize: formatFileSize(
									this.extraSettings.maxFileSize,
								),
							},
						),
					)

					fileInvalid = true
				}
			})

			if (fileInvalid) {
				return
			}

			formData.append('shareHash', loadState('forms', 'shareHash', null))

			// Only a respondent who was working in this question gets focus back; a
			// dropped file must not pull focus away from wherever it is.
			const hadFocus = this.$el?.contains?.(document.activeElement) ?? false

			const url = generateOcsUrl(
				'apps/forms/api/v3/forms/{id}/submissions/files/{questionId}',
				{
					id: this.formId,
					questionId: this.id,
				},
			)

			let response
			try {
				this.fileLoading = true
				this.uploadStatus = t('forms', 'Uploading …')
				response = await axios.post(url, formData, {
					headers: { 'Content-Type': 'multipart/form-data' },
				})
			} catch (error) {
				logger.error('Error while submitting the form', { error })
				this.uploadStatus = ''
				showError(
					t(
						'forms',
						'There was an error during submitting the file: {message}.',
						{
							message:
								error.response?.data?.ocs?.meta?.message
								?? error.message,
						},
					),
				)

				return
			} finally {
				this.fileLoading = false
			}

			const uploaded = OcsResponse2Data(response)
			this.$emit('update:values', [...this.values, ...uploaded])
			this.uploadStatus = n(
				'forms',
				'%n file uploaded',
				'%n files uploaded',
				uploaded.length,
			)

			if (hadFocus) {
				await this.$nextTick()
				const button = this.$refs.uploadButton?.$el
				if (button && !button.disabled) {
					button.focus()
				} else {
					this.$refs.fileList?.focus()
				}
			}
		},

		onMaxAllowedFilesCountInput(maxAllowedFilesCount) {
			return this.onExtraSettingsChange({
				maxAllowedFilesCount: Math.max(
					1,
					parseInt(maxAllowedFilesCount) || 1,
				),
			})
		},

		onMaxFileSizeValueInput(maxFileSizeValue) {
			this.maxFileSizeValue = maxFileSizeValue
			const maxFileSize = Math.round(
				maxFileSizeValue * FILE_SIZE_UNITS[this.maxFileSizeUnit],
			)

			return this.onExtraSettingsChange({ maxFileSize })
		},

		onMaxFileSizeUnitInput(option) {
			const maxFileSizeUnit = option?.id ?? option
			if (!FILE_SIZE_UNITS[maxFileSizeUnit]) {
				return
			}
			this.maxFileSizeUnit = maxFileSizeUnit
			const maxFileSize = Math.round(
				this.maxFileSizeValue * FILE_SIZE_UNITS[maxFileSizeUnit],
			)

			return this.onExtraSettingsChange({ maxFileSize })
		},

		onAllowedFileTypesChange(fileType, allowed) {
			let allowedFileTypes = this.extraSettings.allowedFileTypes || []

			if (allowed) {
				allowedFileTypes.push(fileType)
			} else {
				allowedFileTypes = allowedFileTypes.filter(
					(type) => type !== fileType,
				)
			}

			return this.onExtraSettingsChange({ allowedFileTypes })
		},

		onAllowedFileExtensionsAdded(fileExtension) {
			const allowedFileExtensions =
				this.extraSettings.allowedFileExtensions || []
			allowedFileExtensions.push(fileExtension)

			return this.onExtraSettingsChange({ allowedFileExtensions })
		},

		onAllowedFileExtensionsDeleted(fileExtension) {
			let allowedFileExtensions =
				this.extraSettings.allowedFileExtensions || []
			allowedFileExtensions = allowedFileExtensions.filter(
				(extension) => extension !== fileExtension,
			)

			return this.onExtraSettingsChange({ allowedFileExtensions })
		},

		onDeleteUploadedFile(uploadedFileId) {
			const values = this.values.filter(
				(value) => value.uploadedFileId !== uploadedFileId,
			)

			this.$emit('update:values', values)
		},

		async validate() {
			if (this.fileLoading) {
				this.errorMessage = t(
					'forms',
					'Please wait until the file has been uploaded.',
				)
				return false
			}

			if (this.isRequired && this.values.length === 0) {
				this.errorMessage = t('forms', 'You must answer this question')
				return false
			}

			this.errorMessage = null
			return true
		},
	},
}
</script>

<style scoped lang="scss">
.file-type-checkbox {
	margin-inline-start: 30px;
}

.question {
	&--editable {
		.question__input-wrapper {
			margin-inline-start: -13px;
		}
	}

	&__loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		inline-size: 100%;
		max-inline-size: 300px;
	}

	&__file-hint {
		color: var(--color-text-maxcontrast);
		font-size: 0.9em;
		margin-block: 6px 0;
	}

	&__input-wrapper {
		--focus-offset: calc(
			(var(--border-width-input-focused, 2px) - var(--border-width-input, 2px))
		);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border: var(--border-width-input, 2px) solid var(--color-border-dark);
		border-radius: var(--border-radius-element, var(--border-radius-large));
		padding-inline: calc(3 * var(--default-grid-baseline)) var(--focus-offset);
		padding-block: var(--focus-offset);
		height: var(--default-clickable-area);
		width: 100%;
		max-width: 300px;

		label {
			color: var(--color-text-maxcontrast);

			&:has(input:disabled) {
				cursor: default;
			}
		}

		&:hover,
		&:focus-within,
		&--dragging {
			border-color: var(--color-main-text);
			border-width: var(--border-width-input-focused, 2px);
			padding-block: 0;
			padding-inline: calc(
					3 * var(--default-grid-baseline) - var(--focus-offset)
				)
				0;
		}

		// A file held over the box: the same edge as focus, in the accent, on a tint.
		&--dragging {
			background-color: var(--color-primary-element-light);
			border-color: var(--color-primary-element);
			border-style: dashed;
		}
	}
}
</style>
