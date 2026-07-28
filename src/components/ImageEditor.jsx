import { useState, useEffect, useRef, useCallback } from 'react'
import { loadEditableImage, rotatedSize, renderEdited, canvasToBlob, FULL_CROP, isCropped } from '../lib/imageEdit'
import { useReplaceDocumentFile } from '../hooks/useReplaceDocumentFile'
import { useToast } from '../context/ToastContext'

const HANDLES = [
  { id: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { id: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { id: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { id: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
]

const MIN_CROP = 0.08 // never let the box collapse to nothing

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

/**
 * Rotate / crop an uploaded photo and save it over the original.
 *
 * Phone photos of ID cards arrive sideways and framed against a desk. The
 * preview could already rotate for viewing, but nothing persisted — the
 * thumbnail in the grid stayed wrong forever. This writes the fix back.
 */
export default function ImageEditor({ doc, familyId, getSignedUrl, initialRotation = 0, onClose, onSaved }) {
  const { replaceFile, saving } = useReplaceDocumentFile()
  const toast = useToast()

  const [img, setImg] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [rotation, setRotation] = useState(((initialRotation % 360) + 360) % 360)
  const [crop, setCrop] = useState(FULL_CROP)
  const [box, setBox] = useState(null) // displayed image rect, in px

  const frameRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)

  // Fetch at full resolution — the thumbnail is too small to edit against.
  useEffect(() => {
    let cancelled = false
    getSignedUrl(doc.file_url)
      .then(loadEditableImage)
      .then(loaded => { if (!cancelled) setImg(loaded) })
      .catch(err => { if (!cancelled) setLoadError(err.message || 'Could not load this image') })
    return () => { cancelled = true }
  }, [doc.file_url, getSignedUrl])

  // Fit the rotated image inside the available frame.
  const measure = useCallback(() => {
    if (!img || !frameRef.current) return
    const { width: rw, height: rh } = rotatedSize(img, rotation)
    const rect = frameRef.current.getBoundingClientRect()
    const scale = Math.min(rect.width / rw, rect.height / rh, 1)
    setBox({ width: Math.round(rw * scale), height: Math.round(rh * scale) })
  }, [img, rotation])

  useEffect(() => { measure() }, [measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // Paint the rotated image at display resolution.
  useEffect(() => {
    if (!img || !box || !canvasRef.current) return
    const { width: rw } = rotatedSize(img, rotation)
    const preview = renderEdited(img, rotation, FULL_CROP, box.width / rw)
    const ctx = canvasRef.current.getContext('2d')
    canvasRef.current.width = preview.width
    canvasRef.current.height = preview.height
    ctx.drawImage(preview, 0, 0)
  }, [img, rotation, box])

  function rotate(delta) {
    setRotation(r => (((r + delta) % 360) + 360) % 360)
    setCrop(FULL_CROP) // remapping the box across a rotation reads as a glitch
  }

  const onPointerDown = (e, mode) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, startCrop: crop }
  }

  const onPointerMove = (e) => {
    const drag = dragRef.current
    if (!drag || !box) return
    const dx = (e.clientX - drag.startX) / box.width
    const dy = (e.clientY - drag.startY) / box.height
    const s = drag.startCrop

    if (drag.mode === 'move') {
      setCrop({
        ...s,
        x: clamp(s.x + dx, 0, 1 - s.w),
        y: clamp(s.y + dy, 0, 1 - s.h),
      })
      return
    }

    // Corner resize: move the grabbed edges, pin the opposite ones.
    let { x, y, w, h } = s
    const right = s.x + s.w
    const bottom = s.y + s.h

    if (drag.mode.includes('w')) {
      x = clamp(s.x + dx, 0, right - MIN_CROP)
      w = right - x
    }
    if (drag.mode.includes('e')) {
      w = clamp(s.w + dx, MIN_CROP, 1 - s.x)
    }
    if (drag.mode.includes('n')) {
      y = clamp(s.y + dy, 0, bottom - MIN_CROP)
      h = bottom - y
    }
    if (drag.mode.includes('s')) {
      h = clamp(s.h + dy, MIN_CROP, 1 - s.y)
    }
    setCrop({ x, y, w, h })
  }

  const endDrag = () => { dragRef.current = null }

  async function handleSave() {
    if (!img) return
    try {
      // Keep PNGs lossless; everything else re-encodes as JPEG.
      const mime = doc.file_type === 'image/png' ? 'image/png' : 'image/jpeg'
      const canvas = renderEdited(img, rotation, crop)
      const blob = await canvasToBlob(canvas, mime)
      await replaceFile({ doc, blob, familyId })
      toast.success('Image updated')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Could not save the image')
    }
  }

  const dirty = rotation !== 0 || isCropped(crop)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label={`Fix image for ${doc.label}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-black/60 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} aria-label="Cancel" className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">Fix image</p>
            <p className="text-white/50 text-xs truncate">{doc.label}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => rotate(-90)} disabled={!img} className="p-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40" aria-label="Rotate left" title="Rotate left">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
          </button>
          <button onClick={() => rotate(90)} disabled={!img} className="p-2.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40" aria-label="Rotate right" title="Rotate right">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
          </button>
          <button
            onClick={() => { setRotation(0); setCrop(FULL_CROP) }}
            disabled={!dirty}
            className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-40"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!img || saving}
            className="ml-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Canvas + crop overlay */}
      <div ref={frameRef} className="flex-1 flex items-center justify-center p-4 md:p-8 min-h-0">
        {loadError ? (
          <p className="text-white/70 text-sm">{loadError}</p>
        ) : !img || !box ? (
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
        ) : (
          <div
            className="relative touch-none select-none"
            style={{ width: box.width, height: box.height }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <canvas ref={canvasRef} className="block w-full h-full rounded-md" />

            {/* Dim everything outside the crop box */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bg-black/60" style={{ left: 0, right: 0, top: 0, height: `${crop.y * 100}%` }} />
              <div className="absolute bg-black/60" style={{ left: 0, right: 0, top: `${(crop.y + crop.h) * 100}%`, bottom: 0 }} />
              <div className="absolute bg-black/60" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, left: 0, width: `${crop.x * 100}%` }} />
              <div className="absolute bg-black/60" style={{ top: `${crop.y * 100}%`, height: `${crop.h * 100}%`, left: `${(crop.x + crop.w) * 100}%`, right: 0 }} />
            </div>

            {/* The crop box itself */}
            <div
              className="absolute border-2 border-white/90 cursor-move"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
              onPointerDown={(e) => onPointerDown(e, 'move')}
            >
              {HANDLES.map(h => (
                <span
                  key={h.id}
                  role="presentation"
                  onPointerDown={(e) => onPointerDown(e, h.id)}
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    cursor: h.cursor,
                  }}
                  className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md border border-stone-300"
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-white/50 text-xs pb-4 px-4 shrink-0">
        Drag the corners to trim the edges. Saving replaces the stored file for everyone.
      </p>
    </div>
  )
}
