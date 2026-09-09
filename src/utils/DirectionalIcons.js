/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Icons whose meaning is "backwards" or "forwards" in READING order rather than on screen.
 *
 * A chevron pointing left means "previous" only while the page reads left to right. In
 * Arabic or Hebrew the same glyph means "next", so a hard-coded chevron_left sends the
 * reader the wrong way. CSS cannot fix this for these icons: they are inlined SVG markup
 * passed to NcIconSvgWrapper, not background images, and mirroring them with a transform
 * would also mirror any glyph that should not be flipped.
 *
 * Resolved once at module load, which is correct because the interface language is fixed
 * for the lifetime of the page. Note this follows the READER's language, not any language
 * a particular form is pinned to -- every place these are used is part of the application
 * interface (the responses pagination, a submenu's back button), not form content.
 */

import IconChevronLeftSvg from '@material-symbols/svg-400/outlined/chevron_left.svg?raw'
import IconChevronRightSvg from '@material-symbols/svg-400/outlined/chevron_right.svg?raw'
import IconFirstPageSvg from '@material-symbols/svg-400/outlined/first_page.svg?raw'
import IconLastPageSvg from '@material-symbols/svg-400/outlined/last_page.svg?raw'
import { isRTL } from '@nextcloud/l10n'

const rtl = isRTL()

/** Towards the start of the document: previous page, or up a menu level. */
export const IconBack = rtl ? IconChevronRightSvg : IconChevronLeftSvg

/** Towards the end of the document: next page. */
export const IconForward = rtl ? IconChevronLeftSvg : IconChevronRightSvg

/** All the way to the start. */
export const IconFirst = rtl ? IconLastPageSvg : IconFirstPageSvg

/** All the way to the end. */
export const IconLast = rtl ? IconFirstPageSvg : IconLastPageSvg
