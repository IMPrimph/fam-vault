import { useState, useEffect } from 'react'
import { formatFileSize } from '../utils/format'
import ImageEditor from './ImageEditor'

export default function DocumentPreview({ doc, getSignedUrl, onClose, canEdit = false, familyId }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [editing, setEditing] = useState(false)
  const isImage = doc.file_type?.startsWith('image/')
  const isPdf = doc.file_type === 'application/pdf' || doc.file_url?.toLowerCase().endsWith('.pdf')
  const categoryName = doc.categories?.name || ''
  const memberName = doc.members?.name || ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    setRotation(0)
    getSignedUrl(doc.file_url)
      .then(u => { if (!cancelled) { setUrl(u); setLoading(false) } })
      .catch(() => { if (!cancelled) { setLoadError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [doc.file_url, getSignedUrl])

  const rotate = (delta) => setRotation(r => (((r + delta) % 360) + 360) % 360)
  const isQuarter = rotation % 180 !== 0

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleDownload() {
    if (!url) return
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = url
      a.download = doc.label + '.' + doc.file_url.split('.').pop()
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  if (editing) {
    return (
      <ImageEditor
        doc={doc}
        familyId={familyId}
        getSignedUrl={getSignedUrl}
        initialRotation={rotation}
        onClose={() => setEditing(false)}
        onSaved={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 md:px-6 py-3 bg-black/50 backdrop-blur-md border-b border-white/10 shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {/* Left: doc info */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="p-2 -ml-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
          <div className="min-w-0">
            <p className="text-white font-medium text-sm truncate">{doc.label}</p>
            <p className="text-white/50 text-xs truncate">
              {memberName && `${memberName} · `}{categoryName}
              {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
            </p>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {isImage && url && (
            <>
              <button
                onClick={() => rotate(-90)}
                aria-label="Rotate left"
                title="Rotate left"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
                <span className="hidden sm:inline">Rotate Left</span>
              </button>
              <button
                onClick={() => rotate(90)}
                aria-label="Rotate right"
                title="Rotate right"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
                <span className="hidden sm:inline">Rotate Right</span>
              </button>
              {canEdit && (
                // Rotating above only changes this view. This carries the
                // current angle into the editor so the fix can be saved.
                <button
                  onClick={() => setEditing(true)}
                  title="Rotate, crop and save"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    rotation !== 0
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.848 8.25l1.536.887M7.848 8.25a3 3 0 1 1-5.196-3 3 3 0 0 1 5.196 3Zm1.536.887a2.165 2.165 0 0 1 1.083 1.839c.005.351.054.695.14 1.024M9.384 9.137l2.077 1.199M7.848 15.75l1.536-.887m-1.536.887a3 3 0 1 1-5.196 3 3 3 0 0 1 5.196-3Zm1.536-.887a2.165 2.165 0 0 0 1.083-1.838c.005-.352.054-.695.14-1.025m-1.223 2.863 2.077-1.199m0-3.328a4.323 4.323 0 0 1 2.068-1.379l5.325-1.628a4.5 4.5 0 0 1 2.48-.044l.803.215-7.794 4.5m-2.882-1.664A4.33 4.33 0 0 0 10.607 12m3.736 0 7.794 4.5-.802.215a4.5 4.5 0 0 1-2.48-.043l-5.326-1.629a4.324 4.324 0 0 1-2.068-1.379M14.343 12l-2.882 1.664" /></svg>
                  <span className="hidden sm:inline">{rotation !== 0 ? 'Save rotation' : 'Fix image'}</span>
                </button>
              )}
            </>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading || !url}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            <span className="hidden sm:inline">Download</span>
          </button>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
              <span className="hidden sm:inline">Open</span>
            </a>
          )}
        </div>
      </div>

      {/* Content area — clicking the padding closes, clicking the media doesn't */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        {loading ? (
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
        ) : loadError || !url ? (
          <PreviewError doc={doc} onClose={onClose} />
        ) : isImage ? (
          <img
            src={url}
            alt={doc.label}
            className="object-contain rounded-lg shadow-2xl transition-transform duration-200"
            style={{
              // At 90°/270° the image's natural height becomes its display
              // width and vice versa, so we swap the caps to keep it inside
              // the viewport without clipping.
              maxWidth: isQuarter ? 'calc(100vh - 80px)' : '100%',
              maxHeight: isQuarter ? '100%' : 'calc(100vh - 80px)',
              transform: `rotate(${rotation}deg)`,
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : isPdf ? (
          <PdfFrame
            key={url}
            url={url}
            label={doc.label}
            onOpen={() => window.open(url, '_blank', 'noopener,noreferrer')}
            onDownload={handleDownload}
          />
        ) : (
          <iframe
            src={url}
            className="w-full max-w-4xl bg-white rounded-lg shadow-2xl"
            style={{ height: 'calc(100vh - 80px)' }}
            title={doc.label}
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  )
}

// PDF-specific frame: <object> with explicit type is the most reliable
// way to inline-render PDFs across browsers. Falls back to an action panel
// (download / open-in-new-tab) when the browser refuses to render (common
// on iOS Safari or when the blob MIME can't be inferred).
function PdfFrame({ url, label, onOpen, onDownload }) {
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <div className="bg-surface-card rounded-2xl p-8 max-w-md text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
        </div>
        <p className="text-sm font-semibold text-text-primary mb-1">{label}</p>
        <p className="text-xs text-text-muted mb-5">This browser can't preview PDFs inline. Open it in a new tab or download it.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onOpen} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">Open in new tab</button>
          <button onClick={onDownload} className="px-4 py-2 bg-surface border border-stone-300 text-text-secondary rounded-xl text-sm font-medium hover:bg-surface-hover transition-colors">Download</button>
        </div>
      </div>
    )
  }

  return (
    <object
      data={url}
      type="application/pdf"
      className="w-full max-w-4xl bg-white rounded-lg shadow-2xl"
      style={{ height: 'calc(100vh - 80px)' }}
      aria-label={label}
      onClick={e => e.stopPropagation()}
    >
      {/* Rendered by the browser if <object> can't display the PDF. */}
      <iframe
        src={url}
        className="w-full h-full bg-white rounded-lg"
        title={label}
        onError={() => setErrored(true)}
      />
    </object>
  )
}

function PreviewError({ doc, onClose }) {
  return (
    <div className="bg-surface-card rounded-2xl p-8 max-w-md text-center shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
      </div>
      <p className="text-sm font-semibold text-text-primary mb-1">Couldn't load preview</p>
      <p className="text-xs text-text-muted mb-5">"{doc.label}" is missing or inaccessible. Try again or check if it was deleted.</p>
      <button onClick={onClose} className="px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors">Close</button>
    </div>
  )
}
