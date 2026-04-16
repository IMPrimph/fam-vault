const MAX_WIDTH = 448

export function generateThumbnail(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const scale = Math.min(1, MAX_WIDTH / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      URL.revokeObjectURL(objectUrl)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Thumbnail generation failed')),
        'image/jpeg',
        0.8,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for thumbnail'))
    }

    img.src = objectUrl
  })
}

export function getThumbPath(fileUrl) {
  const dotIdx = fileUrl.lastIndexOf('.')
  if (dotIdx === -1) return fileUrl + '_thumb.jpg'
  return fileUrl.substring(0, dotIdx) + '_thumb.jpg'
}
