import DocumentCard from './DocumentCard'

/**
 * Renders documents as cards, optionally grouped under category headings.
 *
 * Grouping is the calm default for browsing an unfiltered list — a wall of
 * undifferentiated tiles is the hardest thing to scan. When the user has
 * already narrowed by search or category, pass `grouped={false}` so the
 * results read as one direct answer instead of being re-split.
 *
 * `canDelete` / `canEdit` accept a boolean or a per-document predicate.
 */
export default function DocumentGrid({
  documents,
  onPreview,
  onDelete,
  onEdit,
  onToggleStar,
  isStarred,
  getSignedUrl,
  canDelete,
  canEdit,
  showMember = false,
  grouped = true,
  emptyMessage = 'No documents uploaded yet.',
}) {
  if (!documents.length) {
    return <p className="text-text-muted text-center py-8">{emptyMessage}</p>
  }

  const allow = (rule, doc) => (typeof rule === 'function' ? rule(doc) : rule)

  const renderCard = (doc) => (
    <DocumentCard
      key={doc.id}
      doc={doc}
      onPreview={onPreview}
      onDelete={onDelete && allow(canDelete, doc) ? onDelete : null}
      onEdit={onEdit && allow(canEdit, doc) ? onEdit : null}
      onToggleStar={onToggleStar ? () => onToggleStar(doc.id) : null}
      starred={isStarred?.(doc.id)}
      getSignedUrl={getSignedUrl}
      showMember={showMember}
    />
  )

  const gridClass = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3'

  if (!grouped) {
    return <div className={gridClass}>{documents.map(renderCard)}</div>
  }

  const groups = new Map()
  for (const doc of documents) {
    const catName = doc.categories?.name || 'Uncategorized'
    if (!groups.has(catName)) groups.set(catName, [])
    groups.get(catName).push(doc)
  }

  return (
    <div className="space-y-7">
      {[...groups.entries()].map(([catName, docs]) => (
        <div key={catName}>
          <h3 className="text-sm font-semibold text-text-secondary mb-3 flex items-center gap-2">
            {catName}
            <span className="text-xs font-medium text-text-muted bg-stone-100 px-1.5 py-0.5 rounded">{docs.length}</span>
          </h3>
          <div className={gridClass}>{docs.map(renderCard)}</div>
        </div>
      ))}
    </div>
  )
}
