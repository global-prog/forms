<!--
  - SPDX-FileCopyrightText: 2018 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcAppContent :pageHeading="t('forms', 'Responses')">
		<NcDialog
			v-model:open="showLinkedFileNotAvailableDialog"
			:name="t('forms', 'Linked file not available')"
			:message="
				t(
					'forms',
					'Linked file is not available, would you like to link a new file?',
				)
			"
			:buttons="linkedFileNotAvailableButtons"
			size="normal"
			noClose />

		<TopBar
			:archived="isFormArchived"
			:locked="isFormLocked"
			:permissions="form?.permissions"
			:sidebarOpened="sidebarOpened"
			:submissionCount="form?.submissionCount"
			@shareForm="onShareForm" />

		<!-- Showing submissions -->
		<header>
			<h2
				ref="resultsHeading"
				dir="auto"
				tabindex="-1"
				:title="formTitle"
				:style="{ textAlign: authorTextAlign }">
				{{ formTitle }}
			</h2>
			<!-- A live region, so a finished search or a deletion is announced. -->
			<p role="status">
				<!-- The count is only known once a load has succeeded; until then it
				     would read as a form nobody answered. -->
				<template v-if="loadedView !== null && !loadError">
					{{
						n(
							'forms',
							'%n response',
							'%n responses',
							filteredSubmissionsCount,
						)
					}}
				</template>
			</p>

			<!-- Paper only. On screen the heading above is enough; a printed report also
			     has to say when it was taken, since it outlives the page it came from. -->
			<p v-if="printedAt" class="results-print-meta">
				{{
					t('forms', 'Summary generated {datetime}', {
						datetime: printedAt,
					})
				}}
			</p>

			<!-- View switcher between Summary and Responses -->
			<div class="response-actions">
				<PillMenu
					v-model:active="activeResponseView"
					:disabled="noSubmissions"
					:options="responseViews"
					:groupLabel="t('forms', 'View mode')"
					class="response-actions__toggle"
					@update:active="loadFormResults" />

				<!-- Action menu for cloud export and deletion -->
				<NcActions
					v-if="canExportSubmissions"
					:aria-label="t('forms', 'Options')"
					forceName
					:inline="isMobile ? 0 : 1"
					@blur="isDownloadActionOpened = false"
					@close="isDownloadActionOpened = false">
					<template v-if="!isDownloadActionOpened">
						<NcActionButton
							v-if="canEditForm && !form.fileId && !isFormLocked"
							@click="onLinkFile">
							<template #icon>
								<NcIconSvgWrapper :svg="IconLink" />
							</template>
							{{ t('forms', 'Create spreadsheet') }}
						</NcActionButton>
						<template v-if="canEditForm && form.fileId">
							<!-- A link, not a button: inside the collapsed menu on a phone a
							     button has nothing to navigate with. -->
							<NcActionLink :href="fileUrl" closeAfterClick>
								<template #icon>
									<NcIconSvgWrapper :svg="IconTable" />
								</template>
								{{ t('forms', 'Open spreadsheet') }}
							</NcActionLink>
							<NcActionButton closeAfterClick @click="onReExport">
								<template #icon>
									<NcIconSvgWrapper :svg="IconRefresh" />
								</template>
								{{ t('forms', 'Re-export spreadsheet') }}
							</NcActionButton>
							<NcActionButton
								closeAfterClick
								:disabled="isFormLocked"
								@click="onUnlinkFile">
								<template #icon>
									<NcIconSvgWrapper :svg="IconLinkVariantOff" />
								</template>
								{{ t('forms', 'Unlink spreadsheet') }}
							</NcActionButton>
							<NcActionSeparator v-if="!noSubmissions" />
						</template>
						<NcActionButton
							v-if="!noSubmissions"
							closeAfterClick
							@click="onStoreToFiles">
							<template #icon>
								<NcIconSvgWrapper :svg="IconFolder" />
							</template>
							{{ t('forms', 'Save copy to Files') }}
						</NcActionButton>
						<NcActionButton
							v-if="!noSubmissions"
							closeAfterClick
							@click="onPrintSummary">
							<template #icon>
								<NcIconSvgWrapper :svg="IconPrint" />
							</template>
							{{ t('forms', 'Print summary or save as PDF') }}
						</NcActionButton>
						<NcActionButton
							v-if="!noSubmissions"
							:closeAfterClick="false"
							isMenu
							@click="isDownloadActionOpened = true">
							<template #icon>
								<NcIconSvgWrapper :svg="IconDownload" />
							</template>
							{{ downloadLabel }}
						</NcActionButton>
						<NcActionButton
							v-if="canDeleteSubmissions && !noSubmissions"
							closeAfterClick
							@click="deleteAllSubmissions">
							<template #icon>
								<NcIconSvgWrapper :svg="IconDelete" />
							</template>
							{{ t('forms', 'Delete all responses') }}
						</NcActionButton>
					</template>

					<template v-else>
						<!-- Back to top-level button -->
						<NcActionButton @click="isDownloadActionOpened = false">
							<template #icon>
								<NcIconSvgWrapper :svg="IconBack" />
							</template>
							{{ downloadLabel }}
						</NcActionButton>
						<NcActionSeparator />
						<NcActionButton
							closeAfterClick
							@click="onDownloadFile('csv')">
							<template #icon>
								<NcIconSvgWrapper :svg="IconFileDelimited" />
							</template>
							CSV
						</NcActionButton>
						<NcActionButton
							closeAfterClick
							@click="onDownloadFile('ods')">
							<template #icon>
								<NcIconSvgWrapper :svg="IconTable" />
							</template>
							ODS
						</NcActionButton>
						<NcActionButton
							closeAfterClick
							@click="onDownloadFile('xlsx')">
							<template #icon>
								<NcIconSvgWrapper :svg="IconFileExcelOutline" />
							</template>
							XLSX
						</NcActionButton>
					</template>
				</NcActions>

				<div
					v-if="
						(!noSubmissions
							|| loadingResults
							|| submissionSearch.length > 0)
						&& activeResponseView.id !== 'summary'
					"
					class="search-wrapper">
					<NcTextField
						v-model="submissionSearch"
						:label="t('forms', 'Search')"
						trailingButtonIcon="close"
						:showTrailingButton="submissionSearch.length > 0"
						@trailingButtonClick="submissionSearch = ''">
						<template #icon>
							<NcIconSvgWrapper :svg="IconMagnify" />
						</template>
					</NcTextField>
				</div>
			</div>
		</header>

		<!-- Loading submissions. Only when there is nothing of this view to show yet:
		     replacing a list that is on screen would take the pagination buttons, and
		     the keyboard focus on them, away with it. -->
		<NcEmptyContent
			v-if="showFullLoader"
			class="forms-emptycontent"
			:name="t('forms', 'Loading responses …')">
			<template #icon>
				<NcLoadingIcon :size="64" />
			</template>
		</NcEmptyContent>

		<!-- Loading failed. A toast alone disappears and leaves a page that looks empty. -->
		<NcEmptyContent
			v-else-if="loadError"
			class="forms-emptycontent"
			:name="t('forms', 'Responses could not be loaded')">
			<template #icon>
				<NcIconSvgWrapper :svg="IconPoll" :size="64" />
			</template>
			<template #action>
				<NcButton @click="loadFormResults">
					<template #icon>
						<NcIconSvgWrapper :svg="IconRefresh" />
					</template>
					{{ t('forms', 'Try again') }}
				</NcButton>
			</template>
		</NcEmptyContent>

		<!-- Empty search results -->
		<NcEmptyContent
			v-else-if="noFilteredSubmissions && submissionSearch.length > 0"
			:name="t('forms', 'No responses found')"
			class="forms-emptycontent"
			:description="
				t('forms', 'No responses found for \'{submissionSearch}\'', {
					submissionSearch,
				})
			">
			<template #icon>
				<NcIconSvgWrapper :svg="IconPoll" :size="64" />
			</template>
		</NcEmptyContent>

		<!-- No submissions -->
		<NcEmptyContent
			v-else-if="noSubmissions"
			:name="t('forms', 'No responses yet')"
			class="forms-emptycontent"
			:description="t('forms', 'Responses will show up here')">
			<template #icon>
				<NcIconSvgWrapper :svg="IconPoll" :size="64" />
			</template>
			<template #action>
				<div class="response-actions">
					<NcButton variant="primary" @click="onShareForm">
						<template #icon>
							<NcIconSvgWrapper :svg="IconShareVariant" />
						</template>
						{{ t('forms', 'Share form') }}
					</NcButton>
				</div>
			</template>
		</NcEmptyContent>

		<!-- Summary view for visualization.

		     Laid out in the form's own direction, not the reader's. The questions, the
		     answers and every label in the charts are the form author's words, so an
		     Arabic form read by someone whose interface is English must still run right
		     to left. The chrome above -- the view switcher, the menus -- deliberately
		     does not, because that belongs to the reader. -->
		<!-- The filter belongs to the reader, like the view switcher above it, so it is
		     laid out in the reader's direction rather than the form's. -->
		<section
			v-else-if="activeResponseView.id === 'summary'"
			:aria-busy="loadingResults ? 'true' : 'false'">
			<SummaryFilter
				v-if="submissions.length > 1"
				v-model="summaryFilter"
				:questions="summaryQuestions"
				:shown="summarySubmissions.length"
				:total="submissions.length" />
			<!-- A form with many questions makes a long page; this jumps down it. -->
			<div v-if="summaryQuestions.length >= 8" class="summary-jump">
				<NcSelect
					class="summary-jump__select"
					:inputLabel="t('forms', 'Jump to question')"
					:placeholder="t('forms', 'Choose a question')"
					:options="jumpOptions"
					:modelValue="null"
					label="label"
					trackBy="id"
					@update:modelValue="onJumpToQuestion" />
			</div>
			<p v-if="!summarySubmissions.length" class="summary-filter-empty">
				{{ t('forms', 'No responses match the chosen answers.') }}
			</p>
			<div v-else :dir="formDirection" :lang="formLanguage || undefined">
				<ResponseTimeline :submissions="summarySubmissions" />
				<QuizInsights
					v-if="form.settings?.quizMode"
					:submissions="summarySubmissions"
					:questions="questions" />
				<ResultsSummary
					v-for="question in summaryQuestions"
					:key="question.id"
					:question="question"
					:questions="summaryQuestions"
					:submissions="summarySubmissions"
					:formLanguage="formLanguage" />
			</div>
		</section>

		<!-- Responses view for individual responses -->
		<section
			v-else
			ref="responsesSection"
			tabindex="-1"
			class="responses-section"
			:aria-busy="loadingResults ? 'true' : 'false'"
			:dir="formDirection"
			:lang="formLanguage || undefined">
			<NcLoadingIcon
				v-if="loadingResults"
				class="responses-section__loading"
				:name="t('forms', 'Loading responses …')" />
			<Submission
				v-for="submission in submissions"
				:key="submission.id"
				:data-submission-id="submission.id"
				:formHash="form.hash"
				:submission="submission"
				:questions="questions"
				:highlight="submissionSearch"
				:canDeleteSubmission="canDeleteSubmission(submission.userId)"
				:canEditSubmission="canEditSubmission(submission.userId)"
				@delete="deleteSubmission(submission.id)" />

			<PaginationToolbar
				v-model:limit="limit"
				v-model:offset="offset"
				class="bottom-pagination"
				:totalItemsCount="filteredSubmissionsCount" />
		</section>

		<!-- Confirmation dialog for deleting all submissions -->
		<NcDialog
			v-model:open="showConfirmDeleteDialog"
			:name="t('forms', 'Delete responses')"
			:message="confirmDeleteAllMessage"
			:buttons="confirmDeleteButtons" />

		<!-- Deleting all of them asked first; deleting one did not, though it destroys
		     somebody's answers just as permanently. -->
		<NcDialog
			v-model:open="showConfirmDeleteOneDialog"
			:name="t('forms', 'Delete response')"
			:message="confirmDeleteOneMessage"
			:buttons="confirmDeleteOneButtons" />
	</NcAppContent>
</template>

<script>
import IconPoll from '@material-symbols/svg-400/outlined/bar_chart.svg?raw'
import IconCancel from '@material-symbols/svg-400/outlined/block.svg?raw'
import IconFileDelimited from '@material-symbols/svg-400/outlined/csv.svg?raw'
import IconDelete from '@material-symbols/svg-400/outlined/delete.svg?raw'
import IconDownload from '@material-symbols/svg-400/outlined/download.svg?raw'
import IconFolder from '@material-symbols/svg-400/outlined/folder.svg?raw'
import IconLink from '@material-symbols/svg-400/outlined/link.svg?raw'
import IconLinkVariantOff from '@material-symbols/svg-400/outlined/link_off.svg?raw'
import IconPrint from '@material-symbols/svg-400/outlined/print.svg?raw'
import IconRefresh from '@material-symbols/svg-400/outlined/refresh.svg?raw'
import IconMagnify from '@material-symbols/svg-400/outlined/search.svg?raw'
import IconShareVariant from '@material-symbols/svg-400/outlined/share.svg?raw'
import IconFileExcelOutline from '@material-symbols/svg-400/outlined/table.svg?raw'
import IconTable from '@material-symbols/svg-400/outlined/table_chart.svg?raw'
import { getCurrentUser, getRequestToken } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { getFilePickerBuilder, showError, showSuccess } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { FileType } from '@nextcloud/files'
import { translatePlural as n, translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import { generateOcsUrl, generateUrl } from '@nextcloud/router'
import { useIsSmallMobile } from '@nextcloud/vue'
import debounce from 'debounce'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionLink from '@nextcloud/vue/components/NcActionLink'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcAppContent from '@nextcloud/vue/components/NcAppContent'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcEmptyContent from '@nextcloud/vue/components/NcEmptyContent'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import PaginationToolbar from '../components/PaginationToolbar.vue'
import PillMenu from '../components/PillMenu.vue'
import QuizInsights from '../components/Results/QuizInsights.vue'
import ResponseTimeline from '../components/Results/ResponseTimeline.vue'
import ResultsSummary from '../components/Results/ResultsSummary.vue'
import Submission from '../components/Results/Submission.vue'
import SummaryFilter from '../components/Results/SummaryFilter.vue'
import TopBar from '../components/TopBar.vue'
import { loadEcharts } from '../components/Results/Charts/echartsLoader.js'
import PermissionTypes from '../mixins/PermissionTypes.js'
import ViewsMixin from '../mixins/ViewsMixin.js'
import answerTypes from '../models/AnswerTypes.js'
import { FormState, INPUT_DEBOUNCE_MS } from '../models/Constants.ts'
import { IconBack } from '../utils/DirectionalIcons.js'
import logger from '../utils/Logger.js'
import OcsResponse2Data from '../utils/OcsResponse2Data.js'
import SetWindowTitle from '../utils/SetWindowTitle.js'
import { applySummaryFilter } from '../utils/SummaryFilter.js'

const SUPPORTED_FILE_FORMATS = {
	ods: IconTable,
	csv: IconFileDelimited,
	xlsx: IconFileExcelOutline,
}
let fileFormat = 'csv'

const responseViews = [
	{
		title: t('forms', 'Summary'),
		id: 'summary',
	},
	{
		title: t('forms', 'Responses'),
		id: 'responses',
	},
]

export default {
	// eslint-disable-next-line vue/multi-word-component-names
	name: 'Results',

	components: {
		NcActionButton,
		NcActionLink,
		NcActionSeparator,
		NcActions,
		NcAppContent,
		NcButton,
		NcDialog,
		NcIconSvgWrapper,
		NcTextField,
		PaginationToolbar,
		NcEmptyContent,
		NcLoadingIcon,
		NcSelect,
		PillMenu,
		QuizInsights,
		ResponseTimeline,
		ResultsSummary,
		SummaryFilter,
		Submission,
		TopBar,
	},

	mixins: [PermissionTypes, ViewsMixin],
	emits: ['update:form'],

	setup() {
		return {
			isMobile: useIsSmallMobile(),

			// non reactive props
			responseViews,

			IconBack,
			IconDelete,
			IconDownload,
			IconFileDelimited,
			IconPrint,
			IconFileExcelOutline,
			IconFolder,
			IconLink,
			IconLinkVariantOff,
			IconPoll,
			IconRefresh,
			IconShareVariant,
			IconTable,
			IconMagnify,
		}
	},

	data() {
		return {
			activeResponseView: responseViews[0],

			questions: [],
			submissions: [],
			/** the answers the summary is narrowed to; empty describes every response */
			summaryFilter: [],
			filteredSubmissionsCount: 0,

			isDownloadActionOpened: false,
			printedAt: '',
			loadingResults: true,
			/** The last load failed, so what is on screen cannot be trusted */
			loadError: false,
			/** Which view the loaded submissions belong to; the summary loads them all */
			loadedView: null,
			/** Counts loads, so a slow one that finishes late is ignored */
			loadSeq: 0,
			loadController: null,
			skipReloadOnOffsetChange: false,

			picker: null,
			showConfirmDeleteDialog: false,

			/** The response the delete dialog is asking about, or null when it is closed */
			submissionPendingDelete: null,
			showConfirmDeleteOneDialog: false,

			submissionSearch: '',
			limit: 20,
			offset: 0,

			linkedFileNotAvailableButtons: [
				{
					label: t('forms', 'Unlink spreadsheet'),
					icon: IconLinkVariantOff,
					variant: 'error',
					callback: () => {
						this.onUnlinkFile()
					},
				},
				{
					label: t('forms', 'Create spreadsheet'),
					icon: IconLink,
					variant: 'primary',
					callback: () => {
						this.onLinkFile()
					},
				},
			],

			confirmDeleteButtons: [
				{
					label: t('forms', 'Cancel'),
					icon: IconCancel,
					variant: 'tertiary',
					callback: () => {
						this.showConfirmDeleteDialog = false
					},
				},
				{
					label: t('forms', 'Delete responses'),
					icon: IconDelete,
					variant: 'error',
					callback: () => {
						this.deleteAllSubmissionsConfirmed()
					},
				},
			],

			confirmDeleteOneButtons: [
				{
					label: t('forms', 'Cancel'),
					icon: IconCancel,
					variant: 'tertiary',
					callback: () => {
						this.submissionPendingDelete = null
					},
				},
				{
					label: t('forms', 'Delete response'),
					icon: IconDelete,
					variant: 'error',
					callback: () => {
						this.deleteSubmissionConfirmed()
					},
				},
			],
		}
	},

	computed: {
		/**
		 * The search narrows the list on screen but not what "delete all" removes, so
		 * the question says how many will go and that it is every one of them.
		 *
		 * @return {string} the question to put before deleting every response
		 */
		confirmDeleteAllMessage() {
			return n(
				'forms',
				'The %n response to this form will be permanently deleted, including any hidden by your search. This cannot be undone.',
				'All %n responses to this form will be permanently deleted, including any hidden by your search. This cannot be undone.',
				this.form?.submissionCount ?? 0,
			)
		},

		/**
		 * Which response is about to be deleted, said in full. A list of responses is a
		 * column of near-identical rows, and "are you sure?" does not tell the reader
		 * which one they opened the menu on.
		 *
		 * @return {string} the question to put before deleting it
		 */
		confirmDeleteOneMessage() {
			const submission = this.submissions.find(
				(candidate) => candidate.id === this.submissionPendingDelete,
			)
			if (!submission) {
				return t(
					'forms',
					'This response will be deleted. It cannot be undone.',
				)
			}
			return t(
				'forms',
				'The response from {respondent}, sent {date}, will be deleted. It cannot be undone.',
				{
					respondent: submission.userDisplayName,
					date: moment(submission.timestamp, 'X').format('LLL'),
				},
				undefined,
				// The dialog shows its message as text; escaping or sanitising would put
				// entities such as &amp; on screen.
				{ escape: false, sanitize: false },
			)
		},

		/**
		 * The questions that have results to summarise.
		 *
		 * Sections, images and videos are part of the form but take no answer, so a
		 * summary of one could only ever say that nobody answered it.
		 *
		 * @return {object[]} the answerable questions, in form order
		 */
		summaryQuestions() {
			return this.questions.filter(
				(question) => !answerTypes[question.type]?.displayOnly,
			)
		},

		/** @return {{id: number, label: string}[]} the questions, for the jump list */
		jumpOptions() {
			return this.summaryQuestions.map((question) => ({
				id: question.id,
				label: question.text,
			}))
		},

		/** @return {object[]} the responses the summary describes */
		summarySubmissions() {
			return applySummaryFilter(this.submissions, this.summaryFilter)
		},

		/**
		 * The page-wide loader, shown only when there is nothing of this view on screen.
		 * Switching from the summary to the responses must still wait: the summary has
		 * every response loaded, and the list would briefly draw all of them unpaginated.
		 *
		 * @return {boolean}
		 */
		showFullLoader() {
			return (
				this.loadingResults
				&& (!this.submissions.length
					|| this.loadedView !== this.activeResponseView.id)
			)
		},

		/**
		 * The summary filter is not visible in the responses view, so only the summary
		 * applies it to a download.
		 *
		 * @return {boolean}
		 */
		downloadIsFiltered() {
			return (
				this.activeResponseView.id === 'summary'
				&& this.summaryFilter?.length > 0
			)
		},

		/** @return {string} the download entry, saying when it is only a subset */
		downloadLabel() {
			return this.downloadIsFiltered
				? t('forms', 'Download filtered responses')
				: t('forms', 'Download')
		},

		isFormArchived() {
			return this.form.state === FormState.FormArchived
		},

		canExportSubmissions() {
			return this.form.permissions.includes(
				this.PERMISSION_TYPES.PERMISSION_RESULTS,
			)
		},

		canDeleteSubmissions() {
			return (
				this.form.permissions.includes(
					this.PERMISSION_TYPES.PERMISSION_RESULTS_DELETE,
				) && !this.isFormArchived
			)
		},

		canEditForm() {
			return this.form.permissions.includes(
				this.PERMISSION_TYPES.PERMISSION_EDIT,
			)
		},

		noSubmissions() {
			return this.form?.submissionCount === 0
		},

		noFilteredSubmissions() {
			return this.submissions.length === 0
		},

		/**
		 * Generate link to linked file
		 *
		 * @return {string}
		 */
		fileUrl() {
			if (this.form.fileId) {
				return generateUrl('/f/{fileId}', { fileId: this.form.fileId })
			}
			return window.location.href
		},

		showLinkedFileNotAvailableDialog() {
			if (this.form.partial) {
				return false
			}
			return (
				this.canEditForm
				&& this.form.fileId
				&& !this.form.filePath
				&& !this.isFormLocked
			)
		},
	},

	watch: {
		// Reload results when form changes
		async hash() {
			// Another form's questions: an answer chosen for this one means nothing there.
			this.summaryFilter = []
			// Nor are its responses: drop them, and any load still running for them, so
			// the page-wide loader shows instead of the old list under the new title.
			this.loadSeq++
			this.loadController?.abort()
			this.loadController = null
			this.submissions = []
			this.loadedView = null
			// The component is reused for the next form, so a search typed for the last
			// one, and the page it was on, would otherwise be sent along with it.
			const hadSearch = this.submissionSearch !== ''
			this.skipReloadOnOffsetChange = true
			this.offset = 0
			this.submissionSearch = ''
			await this.fetchFullForm(this.form.id)
			if (hadSearch) {
				// Clearing the search queued the debounced reload; this load replaces it.
				const reloads = [].concat(
					this.$options.watch?.submissionSearch ?? [],
				)
				for (const reload of reloads) {
					reload?.clear?.()
				}
			}
			this.loadFormResults()
			this.$nextTick(() => {
				this.skipReloadOnOffsetChange = false
			})
			SetWindowTitle(this.formTitle)
		},

		limit() {
			this.loadFormResults()
		},

		offset() {
			// Only load results if we're not changing offset from submissionSearch watch
			if (!this.skipReloadOnOffsetChange) {
				this.loadFormResults()
			}
		},

		submissionSearch: debounce(function () {
			this.skipReloadOnOffsetChange = true
			this.offset = 0
			this.$nextTick(() => {
				this.skipReloadOnOffsetChange = false
			})
			this.loadFormResults()
		}, INPUT_DEBOUNCE_MS),
	},

	async beforeMount() {
		await this.fetchFullForm(this.form.id)
		this.loadFormResults()
		SetWindowTitle(this.formTitle)
	},

	mounted() {
		// The top bar sticks over the content and wraps to two rows on a phone, so a
		// question scrolled to the top would sit underneath it. Its measured height
		// keeps anything scrolled into view clear of it.
		const bar = this.$el?.querySelector?.('.top-bar')
		if (bar && window.ResizeObserver) {
			this.topBarObserver = new ResizeObserver(() => {
				this.$el?.style?.setProperty(
					'--results-top-bar-height',
					`${bar.offsetHeight}px`,
				)
			})
			this.topBarObserver.observe(bar)
		}
	},

	beforeUnmount() {
		this.topBarObserver?.disconnect()
	},

	methods: {
		async onUnlinkFile() {
			try {
				await axios.patch(
					generateOcsUrl('apps/forms/api/v3/forms/{formId}', {
						formId: this.form.id,
					}),
					{
						keyValuePairs: {
							fileId: null,
							fileFormat: null,
						},
					},
				)

				const updatedForm = {
					...this.form,
					fileFormat: null,
					fileId: null,
					filePath: null,
				}
				this.$emit('update:form', updatedForm)
				emit('forms:last-updated:set', this.form.id)
			} catch (error) {
				logger.error('Error while unlinking the file', { error })
				showError(t('forms', 'There was an error while unlinking the file'))
			}
		},

		async loadFormResults() {
			// Switching views, paging and searching each start a load. Only the newest
			// may land, or a slow summary could overwrite the page that replaced it.
			const seq = ++this.loadSeq
			this.loadController?.abort()
			const controller = new AbortController()
			this.loadController = controller
			const view = this.activeResponseView.id

			this.loadingResults = true
			this.loadError = false
			logger.debug(`Loading responses for form ${this.form.hash}`)

			try {
				let response = null
				if (view === 'summary') {
					response = await axios.get(
						generateOcsUrl('apps/forms/api/v3/forms/{id}/submissions', {
							id: this.form.id,
						}),
						{ signal: controller.signal },
					)
				} else {
					response = await axios.get(
						generateOcsUrl(
							'apps/forms/api/v3/forms/{id}/submissions?limit={limit}&offset={offset}&query={query}',
							{
								id: this.form.id,
								limit: this.limit,
								offset: this.offset,
								query: this.submissionSearch,
							},
						),
						{ signal: controller.signal },
					)
				}
				if (seq !== this.loadSeq) {
					return
				}
				const data = OcsResponse2Data(response)

				// Append questions & submissions
				this.submissions = this.formatDateAnswers(
					data.submissions,
					data.questions,
				)
				this.questions = data.questions
				this.filteredSubmissionsCount = data.filteredSubmissionsCount
				this.loadedView = view
			} catch (error) {
				// A newer load took over (and aborted this one); its outcome is the one
				// that counts.
				if (seq !== this.loadSeq) {
					return
				}
				logger.error('Error while loading responses', { error })
				this.loadError = true
				showError(t('forms', 'An error occurred while loading responses'))
			} finally {
				if (seq === this.loadSeq) {
					this.loadingResults = false
					this.loadController = null
				}
			}
		},

		/**
		 * Print the summary, which is also how a PDF is produced: every browser print
		 * dialog offers "Save as PDF", so this needs no PDF library, no extra dependency
		 * and no server round trip.
		 *
		 * The summary view is switched on first, and deliberately. The responses view is
		 * paginated twenty rows at a time, so printing from it would produce a report of
		 * whichever page happened to be on screen while claiming to be the whole form.
		 */
		async onPrintSummary() {
			if (this.activeResponseView.id !== 'summary') {
				this.activeResponseView = responseViews.find(
					(view) => view.id === 'summary',
				)
				// Reloads without limit/offset, so the charts summarise every response.
				await this.loadFormResults()
			}
			// In the reader's Nextcloud language, like every other date on the page.
			this.printedAt = moment().format('LLL')
			// Let the charts get as far as waiting to be drawn, which printing then starts
			// for all of them. Each first waits for the chart library, which on a first
			// visit is still being fetched, and then for its own render.
			await this.$nextTick()
			if (this.summaryQuestions.length) {
				try {
					await loadEcharts()
				} catch (error) {
					// The charts say so themselves; the text of the summary still prints.
					logger.debug('Chart library not available for printing', {
						error,
					})
				}
				await this.$nextTick()
			}
			await new Promise((resolve) => {
				if (window.requestAnimationFrame) {
					window.requestAnimationFrame(() => resolve())
				} else {
					setTimeout(resolve, 0)
				}
			})
			window.print()
		},

		async onDownloadFile(fileFormat) {
			// A filtered summary downloads what it describes, so the spreadsheet and the
			// page on screen say the same thing. The linked file is untouched by this: it
			// stays a copy of every response. The responses view does not show the
			// filter, so a download from there is always every response.
			const filter = this.downloadIsFiltered
				? '&filter=' + encodeURIComponent(JSON.stringify(this.summaryFilter))
				: ''
			const exportUrl =
				generateOcsUrl('apps/forms/api/v3/forms/{id}/submissions', {
					id: this.form.id,
				})
				+ '?requesttoken='
				+ encodeURIComponent(getRequestToken())
				+ '&fileFormat='
				+ fileFormat
				+ filter
			window.open(exportUrl, '_self')
		},

		async onLinkFile() {
			try {
				await this.getPicker()
					.pick()
					.then(async (path) => {
						try {
							await axios.patch(
								generateOcsUrl('apps/forms/api/v3/forms/{id}', {
									id: this.form.id,
								}),
								{
									keyValuePairs: {
										path,
										fileFormat,
									},
								},
							)
							await this.fetchFullForm(this.form.id)
							await this.loadFormResults()

							showSuccess(
								t('forms', 'File {file} successfully linked', {
									file: this.form.filePath.split('/').pop(),
								}),
							)
							emit('forms:last-updated:set', this.form.id)
						} catch (error) {
							logger.error(
								'Error while exporting to Files and linking',
								{ error },
							)
							showError(
								t(
									'forms',
									'There was an error while linking the file',
								),
							)
						}
					})
			} catch (error) {
				// User aborted
				logger.debug('No file selected', { error })
			}
		},

		// Show Filepicker, then call API to store
		async onStoreToFiles() {
			try {
				await this.getPicker()
					.pick()
					.then(async (path) => {
						try {
							const response = await axios.post(
								generateOcsUrl(
									'apps/forms/api/v3/forms/{id}/submissions/export',
									{
										id: this.form.id,
									},
								),
								{
									path,
									fileFormat,
								},
							)
							showSuccess(
								t('forms', 'Export successful to {file}', {
									file: OcsResponse2Data(response),
								}),
							)
						} catch (error) {
							logger.error('Error while exporting to Files', {
								error,
							})
							showError(
								t(
									'forms',
									'There was an error while exporting to Files',
								),
							)
						}
					})
			} catch (error) {
				// User aborted
				logger.debug('No file selected', { error })
			}
		},

		async onReExport() {
			if (!this.form.fileId) {
				// Theoretically this will never fire
				showError(t('forms', 'File is not linked'))
				return
			}
			try {
				const response = await axios.post(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/submissions/export',
						{
							id: this.form.id,
						},
					),
					{
						path: this.form.filePath,
						fileFormat: this.form.fileFormat,
					},
				)
				showSuccess(
					t('forms', 'Export successful to {file}', {
						file: OcsResponse2Data(response),
					}),
				)
			} catch (error) {
				logger.error('Error while exporting to Files', { error })
				showError(t('forms', 'There was an error while exporting to Files'))
			}
		},

		/**
		 * Determines if a submission can be deleted.
		 *
		 * @param {string} submissionUser - The ID of the user who created the submission.
		 * @return {boolean} - Returns true if the submission can be deleted, otherwise false.
		 *                      A submission can be deleted if:
		 *                      - The user has the `canDeleteSubmissions` permission, or
		 *                      - The form allows editing (`form.allowEditSubmissions`) and the current user is the owner of the submission.
		 */
		canDeleteSubmission(submissionUser) {
			return (
				this.canDeleteSubmissions
				|| (this.form.allowEditSubmissions
					&& getCurrentUser().uid === submissionUser)
			)
		},

		/**
		 * Determines if a submission can be edited.
		 *
		 * @param {string} submissionUser - The ID of the user who created the submission.
		 * @return {boolean} - Returns true if the submission can be edited, otherwise false.
		 */
		canEditSubmission(submissionUser) {
			return (
				this.form.allowEditSubmissions
				&& getCurrentUser().uid === submissionUser
			)
		},

		deleteSubmission(id) {
			this.submissionPendingDelete = id
			this.showConfirmDeleteOneDialog = true
		},

		/** Delete the response the dialog named, once it has been agreed to. */
		async deleteSubmissionConfirmed() {
			const id = this.submissionPendingDelete
			this.submissionPendingDelete = null
			this.showConfirmDeleteOneDialog = false
			if (id === null) {
				return
			}
			this.loadingResults = true

			try {
				await axios.delete(
					generateOcsUrl(
						'apps/forms/api/v3/forms/{id}/submissions/{submissionId}',
						{
							id: this.form.id,
							submissionId: id,
						},
					),
				)
				showSuccess(t('forms', 'Response deleted'))
				const index = this.submissions.findIndex(
					(search) => search.id === id,
				)
				// Where keyboard focus goes next: the response that takes this one's
				// place, or the one before it when this was the last on the page.
				const nextId = (
					this.submissions[index + 1] ?? this.submissions[index - 1]
				)?.id
				this.filteredSubmissionsCount = Math.max(
					0,
					this.filteredSubmissionsCount - 1,
				)
				this.form.submissionCount = Math.max(
					0,
					(this.form.submissionCount ?? 1) - 1,
				)
				emit('forms:last-updated:set', this.form.id)

				if (this.submissions.length === 1 && this.offset > 0) {
					// The page is now empty, so go back one. The last card stays until
					// that page arrives: an empty list would swap the whole section for
					// the page-wide loader.
					this.skipReloadOnOffsetChange = true
					this.offset = Math.max(0, this.offset - this.limit)
					await this.loadFormResults()
					this.skipReloadOnOffsetChange = false
				} else {
					if (index > -1) {
						this.submissions.splice(index, 1)
					}
					// Refill the page from the one after it.
					await this.loadFormResults()
				}
				this.$nextTick(() => this.focusAfterDelete(nextId))
			} catch (error) {
				logger.error(`Error while deleting response ${id}`, { error })
				showError(
					t('forms', 'An error occurred while deleting this response'),
				)
			} finally {
				this.loadingResults = false
			}
		},

		deleteAllSubmissions() {
			this.showConfirmDeleteDialog = true
		},

		async deleteAllSubmissionsConfirmed() {
			this.showConfirmDeleteDialog = false
			this.loadingResults = true
			try {
				await axios.delete(
					generateOcsUrl('apps/forms/api/v3/forms/{id}/submissions', {
						id: this.form.id,
					}),
				)
				this.submissions = []
				this.form.submissionCount = 0
				this.filteredSubmissionsCount = 0
				this.summaryFilter = []
				showSuccess(t('forms', 'All responses deleted'))
				emit('forms:last-updated:set', this.form.id)
			} catch (error) {
				logger.error('Error while deleting responses', { error })
				showError(t('forms', 'An error occurred while deleting responses'))
			} finally {
				this.loadingResults = false
			}
		},

		/**
		 * Put keyboard focus back into the list after a deletion, instead of leaving it
		 * on the menu that was just removed along with its response.
		 *
		 * @param {number|undefined} nextId the response to move to, if still on the page
		 */
		focusAfterDelete(nextId) {
			const section = this.$refs.responsesSection
			if (!section) {
				// The list itself is gone (the last response, or the last search match, was
				// deleted), so the heading is the nearest stable place to land.
				this.$refs.resultsHeading?.focus()
				return
			}
			const card =
				nextId === undefined
					? null
					: section.querySelector(`[data-submission-id="${nextId}"]`)
			const target = card?.querySelector('button') ?? section
			target.focus({ preventScroll: !!card })
		},

		formatDateAnswers(submissions, questions) {
			// Filter questions that are date/datetime/time
			const dateQuestions = Object.fromEntries(
				questions
					.filter(
						(question) =>
							(question.type === 'date')
							| (question.type === 'datetime')
							| (question.type === 'time'),
					)
					.map((question) => [question.id, question.type]),
			)

			// Go through submissions and reformat answers to date/time questions
			submissions.forEach((submission) => {
				submission.answers
					.filter((answer) => answer.questionId in dateQuestions)
					.forEach((answer) => {
						const date = moment(
							answer.text,
							answerTypes[dateQuestions[answer.questionId]]
								.storageFormat,
						)
						if (date.isValid()) {
							answer.text = date.format(
								answerTypes[dateQuestions[answer.questionId]]
									.momentFormat,
							)
						}
					})
			})

			return submissions
		},

		/**
		 * @param {?{id: number}} option the question to jump to
		 */
		onJumpToQuestion(option) {
			if (!option) {
				return
			}
			const target = document.getElementById(`question-summary-${option.id}`)
			if (!target) {
				return
			}
			const gently = !window.matchMedia?.('(prefers-reduced-motion: reduce)')
				?.matches
			target.scrollIntoView({
				block: 'start',
				behavior: gently ? 'smooth' : 'auto',
			})
			// Move focus along with the view, so the keyboard and a screen reader carry
			// on from the question rather than from the picker at the top.
			if (!target.hasAttribute('tabindex')) {
				target.setAttribute('tabindex', '-1')
			}
			target.focus({ preventScroll: true })
		},

		getPicker() {
			if (this.picker !== null) {
				return this.picker
			}

			this.picker = getFilePickerBuilder(
				t('forms', 'Choose spreadsheet location'),
			)
				.setMultiSelect(false)
				.allowDirectories(true)
				.setCanPick((node) => {
					if (node.type === FileType.Folder) {
						return true
					}

					const extension = node.extension?.slice(1).toLowerCase()
					return !!extension && extension in SUPPORTED_FILE_FORMATS
				})
				.setButtonFactory((selectedNodes) => {
					const [node] = selectedNodes
					if (node && node.type === FileType.File) {
						const extension = node.extension?.slice(1).toLowerCase()
						return [
							{
								label: t('forms', 'Select {file}', {
									file: selectedNodes[0].basename,
								}),
								icon: SUPPORTED_FILE_FORMATS[extension],
								callback() {
									fileFormat = extension
								},
								variant: 'primary',
							},
						]
					}

					// no node selected (pick current folder) or folder selected
					return [
						{
							label: t('forms', 'Create XLSX'),
							icon: IconFileExcelOutline,
							callback() {
								fileFormat = 'xlsx'
							},
							variant: 'secondary',
						},
						{
							label: t('forms', 'Create CSV'),
							icon: IconFileDelimited,
							callback() {
								fileFormat = 'csv'
							},
							variant: 'secondary',
						},
						{
							label: t('forms', 'Create ODS'),
							icon: IconTable,
							callback() {
								fileFormat = 'ods'
							},
							variant: 'primary',
						},
					]
				})
				.build()

			return this.picker
		},
	},
}
</script>

<style lang="scss" scoped>
.forms-emptycontent {
	height: 100%;
}

.summary-jump {
	margin-block-end: 16px;
	padding-inline: 20px;

	&__select {
		// The same width as the filter's fields directly above it: two lone controls
		// in a column, one 360px and one sized to its own text, read as a mistake.
		inline-size: 100%;
		max-inline-size: 360px;
		min-inline-size: 0;
	}
}

.summary-filter-empty {
	color: var(--color-text-maxcontrast);
	padding-inline: 20px;
}

.app-content {
	display: flex;
	align-items: center;
	flex-direction: column;
	// Clear of the sticky top bar, whose height is measured in script.
	scroll-padding-block-start: calc(var(--results-top-bar-height, 0px) + 8px);

	// Focused from script by "Jump to question"; a ring only for keyboard users.
	:deep(.question-summary:focus:not(:focus-visible)) {
		outline: none;
	}

	header,
	section {
		width: 100%;
		max-width: 750px;
	}

	// Title & description header. The same box as the section below it, with the
	// title, the count and the view switcher inset by the cards' own 20px, so every
	// left edge on the page is one of two lines rather than four slightly different ones.
	header {
		display: flex;
		flex-direction: column;
		margin-block-end: 24px;

		h2 {
			font-size: 28px;
			font-weight: bold;
			margin-block-start: 32px;
			// A margin, not padding: the clamp below hides the lines past the third
			// only down to the padding edge, so padding would show a sliver of the next.
			margin-block-end: 8px;
			padding-inline: 20px;
			// A long title wraps to a few lines rather than being cut to a few words on
			// a phone; the full text is in its tooltip beyond that.
			overflow-wrap: anywhere;
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
			overflow: hidden;

			@media (max-width: 512px) {
				font-size: 22px;
			}

			// Focused from script after the last response is deleted; a mouse user who
			// deleted it needs no ring there, a keyboard user keeps it.
			&:focus:not(:focus-visible) {
				outline: none;
			}
		}

		p {
			padding-inline: 20px;
		}
	}

	.response-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		margin-block-start: 8px;
		// A pill's label sits a corner radius in from its edge; this lines the label,
		// not the rounded edge, up with the title.
		padding-inline-start: calc(20px - var(--border-radius-pill));

		&__toggle {
			margin-inline-end: 1em;
		}
	}
}

.search-wrapper {
	margin-block-start: calc(-1 * var(--default-grid-baseline));
	margin-inline-start: auto;
	margin-inline-end: var(--default-clickable-area);
}

.bottom-pagination {
	margin-bottom: 24px;
}

.responses-section {
	// Focused by script after a deletion. A mouse user needs no ring around the whole
	// list; a keyboard user still has to see where focus went.
	&:focus:not(:focus-visible) {
		outline: none;
	}

	&__loading {
		margin-block-end: 16px;
	}
}
</style>

<!--
  Print / Save as PDF. Not scoped: it has to reach the application furniture that Nextcloud
  itself renders outside this component.
-->
<style lang="scss">
/*
  The report is the page itself with the application removed -- no PDF library, no extra
  dependency, no server round trip, because every browser print dialog can save to PDF.

  Two things it quietly depends on, both easy to lose later:
    * the summary charts are HTML and SVG and never a `<meter>`. Browsers draw that native
      widget as a platform control and routinely print it blank, which is the main reason
      the summary stopped using one.
    * every chart fill declares `print-color-adjust: exact`. Without it a browser treats
      those fills as decorative backgrounds and drops them, printing an empty report.
*/
@media print {
	// None of the furniture belongs on paper. Both the id and class forms are listed
	// because which one Nextcloud renders has moved between versions.
	#header,
	#app-navigation,
	#app-navigation-vue,
	#app-sidebar,
	#app-sidebar-vue,
	.app-navigation,
	.app-sidebar,
	.top-bar,
	.response-actions,
	.search-wrapper,
	.bottom-pagination,
	.action-item,
	.button-vue {
		display: none !important;
	}

	// Let the content occupy the sheet instead of the app's scroll pane.
	//
	// Releasing `overflow` alone was not enough and the report printed as a single page:
	// Nextcloud holds the app inside `body#body-user` > `#content.app-forms` >
	// `#content-vue` > `#app-content-vue`, and those are `position: fixed` with a
	// viewport height, with `overflow: clip` on one of them. A fixed box one screen tall
	// has exactly one screen to give the printer however much is inside it. Every clamp
	// has to come off - position, height and overflow - or the sheet stops at the fold.
	// Measured on a 13-card summary: the document went from 695px to 6,570px.
	html,
	body,
	#body-user,
	#content,
	#content-vue,
	.app-forms,
	#app-content-vue,
	.app-content,
	.app-content-wrapper {
		position: static !important;
		display: block !important;
		inline-size: 100% !important;
		block-size: auto !important;
		min-block-size: 0 !important;
		max-block-size: none !important;
		margin: 0 !important;
		overflow: visible !important;
	}

	body {
		background: #fff !important;
	}

	.results-print-meta {
		color: #555;
		display: block !important;
	}

	// The cards lose their inset on paper, so the title does too and stays level with them.
	.app-content header :is(h2, p) {
		padding-inline: 0 !important;
	}

	// Paper has no tooltip to read the rest of a long title from.
	.app-content header h2 {
		display: block !important;
		-webkit-line-clamp: none !important;
		overflow: visible !important;
	}

	// A chart broken across a page turn cannot be read as one chart.
	.question-summary {
		break-inside: avoid;
		padding-inline: 0 !important;
	}
}

// Hidden on screen; the print block above reveals it.
.results-print-meta {
	display: none;
}
</style>
