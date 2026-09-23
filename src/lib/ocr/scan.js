import { extractCandidates } from '../extractIds'
import { getCachedSignedUrl } from '../signedUrlCache'

const isPdf = (blob) => blob.type === 'application/pdf'

/**
 * Get readable text out of an ID scan: a photo, or a PDF (digital or scanned).
 *
 * PDFs try their embedded text first. Downloaded e-Aadhaar / e-PAN files carry
 * the number as real text, which is instant and exact. Only if that yields no
 * number for this ID type do we render the first page and OCR it.
 *
 * Heavy modules are imported on demand so none of this touches the main bundle.
 *
 * @returns {Promise<{ text: string, method: 'pdf-text'|'ocr' }>}
 */
export async function readIdText(blob, type, { askPassword }) {
  if (isPdf(blob)) {
    const { openPdf } = await import('./pdf')
    const pdf = await openPdf(blob, { askPassword })
    try {
      if (extractCandidates(pdf.text, type).length) return { text: pdf.text, method: 'pdf-text' }
      const canvas = await pdf.renderFirstPage()
      const { recognizeImage } = await import('./tesseract')
      const ocrText = await recognizeImage(canvas)
      return { text: `${pdf.text}\n${ocrText}`, method: 'ocr' }
    } finally {
      pdf.destroy()
    }
  }

  const [{ prepareForOcr }, { recognizeImage }] = await Promise.all([
    import('./preprocess'),
    import('./tesseract'),
  ])
  const canvas = await prepareForOcr(blob)
  return { text: await recognizeImage(canvas), method: 'ocr' }
}

export function canScan(blob) {
  return !!blob && (isPdf(blob) || blob.type?.startsWith('image/'))
}

/**
 * Fetch an uploaded document as a Blob for scanning (offline copy if cached).
 * Storage may report a generic content type, so trust our own record's.
 */
export async function fetchDocumentBlob(doc) {
  const url = await getCachedSignedUrl(doc.file_url)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const raw = await resp.blob()
  return new Blob([raw], { type: doc.file_type || raw.type })
}
