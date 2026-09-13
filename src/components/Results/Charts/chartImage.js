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
	const background =
		style.getPropertyValue('--color-main-background').trim() || '#ffffff'
	const ink = style.getPropertyValue('--color-main-text').trim() || '#222222'
	const family = style.fontFamily || 'sans-serif'

	const canvas = document.createElement('canvas')
	const context = canvas.getContext('2d')
	context.font = `bold 16px ${family}`
	const lines = wrapText(context, title, width).slice(0, 3)
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
