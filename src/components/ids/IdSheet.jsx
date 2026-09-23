import { useState } from 'react'
import Modal from '../Modal'
import RecordDetail from './RecordDetail'

/** Bottom sheet (phone) / side panel (desktop) for a single ID. */
export default function IdSheet({ member, record, startEditing, onClose }) {
  // While a preview or edit dialog sits on top, Escape and backdrop taps
  // belong to it, not to the sheet underneath.
  const [overlayOpen, setOverlayOpen] = useState(false)

  return (
    <Modal
      variant="panel"
      title={record.categoryId ? `${member.name}'s ${record.categoryName}` : `${member.name}'s other files`}
      description={member.relationship}
      onClose={() => { if (!overlayOpen) onClose() }}
    >
      <div className="p-5 sm:p-6 pb-8">
        <RecordDetail
          key={record.key}
          record={record}
          member={member}
          startEditing={startEditing}
          onOverlayChange={setOverlayOpen}
        />
      </div>
    </Modal>
  )
}
