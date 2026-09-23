import * as pdfjs from 'pdfjs-dist'
// Vite emits the worker as a hashed asset on our own origin.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const TEXT_PAGES = 2
const RENDER_LONG_SIDE = 2000

export class PdfCancelled extends Error {
  constructor() { super('Cancelled'); this.name = 'PdfCancelled' }
}

/**
 * Open a PDF, prompting for a password if it has one (e-Aadhaar always does).
 *
 * @param {Blob} blob
 * @param {{ askPassword: (opts: { wrong: boolean }) => Promise<string|null> }} opts
 * @returns {Promise<{ text: string, renderFirstPage: () => Promise<HTMLCanvasElement>, destroy: () => void }>}
 */
export async function openPdf(blob, { askPassword }) {
  const data = new Uint8Array(await blob.arrayBuffer())
  // No eval: the CSP forbids it, and pdf.js falls back cleanly without it.
  const task = pdfjs.getDocument({ data, isEvalSupported: false })

  let cancelled = false
  task.onPassword = async (updatePassword, reason) => {
    const wrong = reason === pdfjs.PasswordResponses.INCORRECT_PASSWORD
    const password = await askPassword({ wrong })
    if (password == null) {
      cancelled = true
      task.destroy()
      return
    }
    updatePassword(password)
  }

  let doc
  try {
    doc = await task.promise
  } catch (err) {
    if (cancelled) throw new PdfCancelled()
    throw err
  }

  const parts = []
  for (let n = 1; n <= Math.min(TEXT_PAGES, doc.numPages); n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    parts.push(content.items.map(i => (i.str || '') + (i.hasEOL ? '\n' : ' ')).join(''))
  }

  async function renderFirstPage() {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: RENDER_LONG_SIDE / Math.max(base.width, base.height) })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    // 'print' renders without requestAnimationFrame pacing. The default
    // 'display' intent stalls whenever the tab is hidden (the user switched
    // apps mid-scan), and we never show this canvas anyway.
    await page.render({ canvas, viewport, intent: 'print' }).promise
    return canvas
  }

  return { text: parts.join('\n'), renderFirstPage, destroy: () => task.destroy() }
}
