<!--
  - SPDX-FileCopyrightText: 2024 Nextcloud GmbH and Nextcloud contributors
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcDialog
		closeOnClickOutside
		:name="title"
		:open="isOpen"
		size="small"
		@close="isOpen = false"
		@update:open="$emit('closed', true)">
		<div class="qr-dialog__content">
			<!-- The code is drawn at print size and shown smaller, so a saved copy stays sharp
			     on a poster. It keeps its own white ground: a scanner needs dark on light. -->
			<img
				v-if="uri"
				class="qr-dialog__code"
				:src="uri"
				:alt="
					t('forms', 'QR code representation of {text}', {
						text: text,
					})
				" />
			<NcLoadingIcon v-else :size="44" class="qr-dialog__code" />

			<p class="qr-dialog__link" dir="ltr">
				{{ text }}
			</p>

			<NcButton
				v-if="uri"
				variant="secondary"
				:href="uri"
				:download="downloadName">
				<template #icon>
					<NcIconSvgWrapper :svg="IconDownload" />
				</template>
				{{ t('forms', 'Save as image') }}
			</NcButton>
		</div>
	</NcDialog>
</template>

<script>
import IconDownload from '@material-symbols/svg-400/outlined/download.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import QRCode from 'qrcode'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import logger from '../utils/Logger.js'

export default {
	name: 'QRDialog',

	components: {
		NcButton,
		NcDialog,
		NcIconSvgWrapper,
		NcLoadingIcon,
	},

	props: {
		title: {
			type: String,
			default: '',
		},

		text: {
			type: String,
			default: '',
		},

		/** What the saved picture is called, before the extension. */
		fileName: {
			type: String,
			default: '',
		},
	},

	emits: ['closed'],

	setup() {
		return { IconDownload, t }
	},

	data() {
		return {
			uri: '',
			isOpen: false,
		}
	},

	computed: {
		downloadName() {
			// Characters no common file system accepts, and runs of space they leave behind.
			const base = this.fileName
				.replace(/[\\/:*?"<>|\p{Cc}]+/gu, ' ')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 80)
			return `${base || t('forms', 'Form')} - QR.png`
		},
	},

	watch: {
		text: {
			immediate: true,
			handler() {
				this.generateQr()
				this.isOpen = !!this.text
			},
		},
	},

	methods: {
		async generateQr() {
			const text = this.text
			this.uri = ''
			if (!text) {
				return
			}
			try {
				const uri = await QRCode.toDataURL(text, {
					width: 1024,
					margin: 2,
				})
				// A second link may have been opened while this one was drawing.
				if (text === this.text) {
					this.uri = uri
				}
			} catch (err) {
				logger.error(err)
			}
		},
	},
}
</script>

<style lang="scss">
.qr-dialog__content {
	align-items: center;
	display: flex;
	flex-direction: column;
	gap: 12px;
	padding-block-end: 12px;
	width: 100%;
}

.qr-dialog__code {
	aspect-ratio: 1;
	background-color: #fff;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large);
	display: flex;
	inline-size: min(256px, 100%);
	justify-content: center;
	max-inline-size: 100%;
}

.qr-dialog__link {
	color: var(--color-text-maxcontrast);
	font-size: 0.9em;
	margin: 0;
	max-inline-size: 100%;
	overflow-wrap: anywhere;
	text-align: center;
	user-select: all;
}
</style>
