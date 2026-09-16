/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/*
 * The parts of "save this chart as a picture" that are the same whatever is being drawn.
 *
 * Two things draw their own image: a chart the library rendered, and the grid's heatmap,
 * which is a table and has no library behind it. They share the titling, the file naming
 * and the saving; only the middle differs.
 */

/**
 * The palette an exported picture is drawn in.
 *
 * A downloaded chart is on its way somewhere else - a report, a slide, an email - and
 * those are on white. Matching the screen means someone reading in dark mode exports a
 * dark rectangle that lands badly in a document and wastes ink on a printer. The printed
 * report already forces paper colours for the same reason; this is the same decision for
 * the same destination. The series are the light values from css/forms.css, which are the
 * ones checked for contrast on white.
 */
export const PAPER = {
	series: [
		'#2a78d6',
		'#d4551f',
		'#12805d',
		'#9a6a00',
		'#c4456f',
		'#008300',
		'#4a3aa7',
	],
	muted: '#767676',
	ink: '#222222',
	inkFaint: '#555555',
	track: '#f0f0f0',
	surface: '#ffffff',
	border: '#999999',
}

/**
 * A colour reduced to the three numbers it is, so two spellings of it compare equal.
 *
 * A stylesheet says `#3987e5` and getComputedStyle says `rgb(57, 135, 229)`; both are the
 * same colour and neither string matches the other.
 *
 * @param {string} value a hex or rgb() colour
 * @return {string} "r,g,b", or the input lowercased if it is neither
 */
export function colourKey(value) {
	const text = String(value ?? '')
		.trim()
		.toLowerCase()
	const hex = text.match(/^#([0-9a-f]{3,8})$/)
	if (hex) {
		const digits = hex[1]
		const parts =
			digits.length <= 4
				? [...digits].slice(0, 3).map((digit) => digit + digit)
				: [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)]
		return parts.map((part) => parseInt(part, 16)).join(',')
	}
	const rgb = text.match(/^rgba?\(([^)]+)\)$/)
	if (rgb) {
		return rgb[1]
			.split(/[\s,/]+/)
			.filter(Boolean)
			.slice(0, 3)
			.map((part) => Math.round(parseFloat(part)))
			.join(',')
	}
	return text
}

/**
 * Break a title into lines that fit a given width.
 *
 * @param {CanvasRenderingContext2D} context the context whose font the text is measured in
 * @param {string} text the title
 * @param {number} width the width to fit
 * @return {string[]} the lines
 */
export function wrapText(context, text, width) {
	const lines = []
	let line = ''
	for (const word of String(text ?? '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)) {
		const candidate = line ? `${line} ${word}` : word
		if (line && context.measureText(candidate).width > width) {
			lines.push(line)
			line = word
		} else {
			line = candidate
		}
	}
	if (line) {
		lines.push(line)
	}
	return lines
}

/**
 * A title broken into lines, at most `limit` of them.
 *
 * A title that needs more is cut at the end of the last line and marked with an ellipsis,
 * so a reader of the picture can tell there was more rather than taking a sentence that
 * stops mid-way as the whole question.
 *
 * @param {CanvasRenderingContext2D} context the context whose font the text is measured in
 * @param {string} text the title
 * @param {number} width the width to fit
 * @param {number} [limit] the most lines to use
 * @return {string[]} the lines
 */
export function titleLines(context, text, width, limit = 3) {
	const lines = wrapText(context, text, width)
	if (lines.length <= limit) {
		return lines
	}
	const kept = lines.slice(0, limit)
	let last = kept[limit - 1]
	while (last && context.measureText(`${last}…`).width > width) {
		last = last.slice(0, -1)
	}
	kept[limit - 1] = `${last.trimEnd()}…`
	return kept
}

/**
 * A question's text, made safe to use as a file name.
 *
 * @param {string} title the question
 * @return {string} something a file system will accept
 */
export function fileNameFor(title) {
	const name = String(title ?? '')
		// eslint-disable-next-line no-control-regex -- control characters are what it removes
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80)
	return name || 'chart'
}

/**
 * Hand a finished canvas to the browser as a PNG download.
 *
 * @param {HTMLCanvasElement} canvas the drawing
 * @param {string} title what to call the file
 */
export async function savePng(canvas, title) {
	const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
	if (!blob) {
		return
	}
	const link = document.createElement('a')
	link.href = URL.createObjectURL(blob)
	link.download = `${fileNameFor(title)}.png`
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

/**
 * Start a canvas for a chart image: the page's own background, the title written above,
 * and room left for whatever the caller draws underneath.
 *
 * @param {object} options how big, and in what style
 * @param {number} options.width the drawing's width in CSS pixels
 * @param {number} options.height the drawing's height in CSS pixels
 * @param {number} options.extraHeight room below the drawing, for a key
 * @param {string} options.title the question
 * @param {string} options.direction 'rtl' or 'ltr', how the title reads
 * @param {CSSStyleDeclaration} options.style computed style to take colours and font from
 * @return {{canvas: HTMLCanvasElement, context: CanvasRenderingContext2D,
 *   padding: number, titleHeight: number, ink: string}} the started drawing
 */
export function startChartCanvas({
	width,
	height,
	extraHeight = 0,
	title,
	direction = 'ltr',
	style,
}) {
	const scale = 2
	const padding = 24
	const background = PAPER.surface
	const ink = PAPER.ink
	const family = style.fontFamily || 'sans-serif'

	const canvas = document.createElement('canvas')
	const context = canvas.getContext('2d')
	context.font = `bold 16px ${family}`
	const lines = titleLines(context, title, width)
	const titleHeight = lines.length ? lines.length * 22 + padding : 0

	canvas.width = (width + 2 * padding) * scale
	canvas.height = (height + titleHeight + extraHeight + 2 * padding) * scale
	context.scale(scale, scale)
	context.fillStyle = background
	context.fillRect(0, 0, canvas.width, canvas.height)

	context.font = `bold 16px ${family}`
	context.fillStyle = ink
	context.direction = direction === 'rtl' ? 'rtl' : 'ltr'
	context.textAlign = 'start'
	context.textBaseline = 'top'
	const x = direction === 'rtl' ? width + padding : padding
	lines.forEach((line, index) => {
		context.fillText(line, x, padding + index * 22)
	})

	return { canvas, context, padding, titleHeight, ink }
}
