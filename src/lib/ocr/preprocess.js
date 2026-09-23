// Tesseract reads card text best at roughly 1500–2000px on the long side.
// Phone photos are 4000px+ (slow, memory-hungry); some scans are tiny.
const TARGET_LONG_SIDE = 2000
const MIN_LONG_SIDE = 1400

/**
 * Decode an image, scale it into Tesseract's sweet spot and flatten it to
 * high-contrast grayscale. Returns a canvas, which Tesseract accepts directly.
 */
export async function prepareForOcr(blob) {
  const bitmap = await createImageBitmap(blob)
  const long = Math.max(bitmap.width, bitmap.height)
  const scale = long > TARGET_LONG_SIDE
    ? TARGET_LONG_SIDE / long
    : long < MIN_LONG_SIDE ? MIN_LONG_SIDE / long : 1

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  toGrayscale(ctx, canvas.width, canvas.height)
  return canvas
}

// Done by hand rather than ctx.filter, which older Safari ignores silently.
function toGrayscale(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h)
  const px = img.data
  for (let i = 0; i < px.length; i += 4) {
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]
    // Mild contrast stretch around mid-grey helps faint laminated prints.
    const v = Math.max(0, Math.min(255, (y - 128) * 1.25 + 128))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}
