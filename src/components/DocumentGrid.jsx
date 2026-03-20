import DocumentCard from './DocumentCard'

export default function DocumentGrid({ documents, onPreview, onDelete, getSignedUrl, canDelete }) {
  if (!documents.length) {
    return <p className="text-text-muted text-center py-8">No documents uploaded yet.</p>
  }

  const grouped = {}
  for (const doc of documents) {
    const catName = doc.categories?.name || 'Uncategorized'
    if (!grouped[catName]) grouped[catName] = []
    grouped[catName].push(doc)
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([catName, docs]) => (
        <div key={catName}>
          <h3 className="text-xs font-semibold text-text-secondary mb-3 uppercase tracking-wider">{catName}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {docs.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onPreview={onPreview}
                onDelete={onDelete}
                getSignedUrl={getSignedUrl}
                canDelete={canDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
