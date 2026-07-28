// Re-encoding cap. ID card scans past ~2400px carry no extra legibility but
// eat into the family's 1GB storage budget, and holding a 12-megapixel canvas
// is what pushes older phones into an out-of-memory crash.
const MAX_OUTPUT_DIM = 2400

function decode(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load this image'))
    img.src = url
  })
}

/**
 * Load an image in a form the canvas can export.
 *
 * Pointing an <img> straight at the signed URL risks a tainted canvas: the
 * preview has usually already fetched that same URL without a CORS mode, and
 * reusing that cached response would make toBlob() throw a security error.
 * Fetching to a blob makes the bitmap same-origin no matter what. Offline
 * reads already hand us a blob: URL, which needs no such treatment.
 */
export async function loadEditableImage(url) {
  if (url.startsWith('blob:')) return decode(url)

  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Could not load this image (${resp.status})`)
  const objectUrl = URL.createObjectURL(await resp.blob())
  try {
    return await decode(objectUrl)
  } finally {
    // The decoded bitmap outlives the URL, so this is safe once load settles.
    URL.revokeObjectURL(objectUrl)
  }
}

/** Dimensions of the image after applying a 90° multiple rotation. */
export function rotatedSize(img, rotation) {
  const quarter = rotation % 180 !== 0
  return {
    width: quarter ? img.naturalHeight : img.naturalWidth,
    height: quarter ? img.naturalWidth : img.naturalHeight,
  }
}

/**
 * Draw `img` rotated, cropped and scaled into a canvas in a single pass.
 *
 * `crop` is expressed as fractions (0..1) of the *rotated* image, so it stays
 * meaningful regardless of orientation. Compositing in one pass avoids
 * allocating a full-size intermediate canvas on top of the output one.
 */
export function renderEdited(img, rotation, crop, targetScale = null) {
  const { width: rw, height: rh } = rotatedSize(img, rotation)

  const cx = crop.x * rw
  const cy = crop.y * rh
  const cw = Math.max(1, crop.w * rw)
  const ch = Math.max(1, crop.h * rh)

  const scale = targetScale ?? Math.min(1, MAX_OUTPUT_DIM / Math.max(cw, ch))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(cw * scale))
  canvas.height = Math.max(1, Math.round(ch * scale))

  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'

  // Transforms compose outside-in: scale to output resolution, shift the crop
  // origin to (0,0), then rotate the source into the rotated frame.
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  if (rotation === 90) {
    ctx.translate(rw, 0)
    ctx.rotate(Math.PI / 2)
  } else if (rotation === 180) {
    ctx.translate(rw, rh)
    ctx.rotate(Math.PI)
  } else if (rotation === 270) {
    ctx.translate(0, rh)
    ctx.rotate(-Math.PI / 2)
  }

  ctx.drawImage(img, 0, 0)
  return canvas
}

export function canvasToBlob(canvas, mime = 'image/jpeg', quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('Could not save the edited image')),
      mime,
      quality,
    )
  })
}

export const FULL_CROP = { x: 0, y: 0, w: 1, h: 1 }

export function isCropped(crop) {
  return crop.x > 0.001 || crop.y > 0.001 || crop.w < 0.999 || crop.h < 0.999
}
