/**
 * On-device OCR via Tesseract.js, loaded only when a scan actually runs.
 *
 * Every asset is served from /ocr/ on our own origin (copied there at build
 * time by vite.config.js). The library's defaults pull from a public CDN,
 * which the CSP blocks and which would leak that someone is scanning an ID.
 * The service worker caches /ocr/ after first use, so scans work offline.
 */

const IDLE_MS = 60_000
let workerPromise = null
let idleTimer = null

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js')
      // OEM 1 = LSTM only, which matches the *-lstm cores we ship.
      return createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/core',
        langPath: '/ocr/lang',
        workerBlobURL: false,
        gzip: true,
      })
    })().catch(err => {
      workerPromise = null
      throw err
    })
  }
  return workerPromise
}

// A live worker holds tens of MB; phones reclaim it quickly if we let go.
function scheduleIdleShutdown() {
  clearTimeout(idleTimer)
  idleTimer = setTimeout(async () => {
    const pending = workerPromise
    workerPromise = null
    try { (await pending)?.terminate() } catch { /* already gone */ }
  }, IDLE_MS)
}

/** @param {HTMLCanvasElement|Blob} image */
export async function recognizeImage(image) {
  clearTimeout(idleTimer)
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(image)
    return data.text || ''
  } finally {
    scheduleIdleShutdown()
  }
}
