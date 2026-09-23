import { useState, useRef, useEffect, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useMembers } from '../../hooks/useMembers'
import { useAllDocuments } from '../../hooks/useAllDocuments'
import { useMemberIds } from '../../hooks/useMemberIds'
import { useCategories } from '../../hooks/useCategories'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { usePdfPasswordPrompt } from '../../hooks/useNumberScan'
import { buildPeople, scanTargets } from '../../lib/idRecords'
import { extractCandidates } from '../../lib/extractIds'
import { formatIdNumber } from '../../lib/idTypes'
import { readIdText, fetchDocumentBlob } from '../../lib/ocr/scan'
import { ScanIcon, CheckIcon } from './icons'

/**
 * Backfill numbers for IDs uploaded before copyable numbers existed.
 *
 * Scans every eligible ID on this device, one at a time, then shows a single
 * review list. Nothing is saved until the user presses Save, and each row can
 * be unticked. Admins cover the whole family; members only themselves, which
 * is also all the member_ids policy would let them save.
 */
export default function BulkNumberScan() {
  const { member: me, isAdmin } = useAuth()
  const familyId = me?.family_id
  const toast = useToast()
  const online = useOnlineStatus()
  const askPassword = usePdfPasswordPrompt()
  const { members } = useMembers(familyId)
  const { documents } = useAllDocuments(familyId)
  const { memberIds, saveNumber } = useMemberIds(familyId)
  const { categories } = useCategories(familyId)

  const [phase, setPhase] = useState('idle') // idle | scanning | review | saving
  const [progress, setProgress] = useState({ done: 0, total: 0, current: '' })
  const [found, setFound] = useState([]) // { key, member, record, candidates, choice, selected }
  const [missed, setMissed] = useState([]) // { key, member, record }
  const stopRef = useRef(false)

  useEffect(() => () => { stopRef.current = true }, [])

  const targets = useMemo(() => {
    const people = buildPeople({ members, documents, memberIds, categories, selfMemberId: me?.id })
    return scanTargets(people, id => isAdmin || id === me?.id)
  }, [members, documents, memberIds, categories, me?.id, isAdmin])

  async function start() {
    stopRef.current = false
    const hits = []
    const misses = []
    setFound([])
    setMissed([])
    setPhase('scanning')

    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break
      const { member, record, docs } = targets[i]
      setProgress({ done: i, total: targets.length, current: `${member.name} · ${record.categoryName}` })

      let candidates = []
      for (const doc of docs) {
        if (stopRef.current) break
        try {
          const { text } = await readIdText(await fetchDocumentBlob(doc), record.type, { askPassword })
          candidates = extractCandidates(text, record.type)
        } catch (err) {
          // A skipped password or an unreadable file just moves on.
          if (err?.name !== 'PdfCancelled') console.warn('Bulk scan: could not read', doc.file_url, err)
        }
        if (candidates.length) break
      }

      if (candidates.length) {
        hits.push({ key: record.key, member, record, candidates, choice: candidates[0], selected: true })
      } else if (!stopRef.current) {
        misses.push({ key: record.key, member, record })
      }
      setFound([...hits])
    }

    setMissed(misses)
    setProgress(p => ({ ...p, done: p.total }))
    setPhase('review')
  }

  async function saveSelected() {
    const chosen = found.filter(f => f.selected)
    setPhase('saving')
    let saved = 0
    for (const f of chosen) {
      try {
        await saveNumber({ memberId: f.member.id, categoryId: f.record.categoryId, idNumber: f.choice })
        saved++
      } catch (err) {
        console.warn('Bulk save failed for', f.key, err)
      }
    }
    if (saved === chosen.length) toast.success(`Saved ${saved} ${saved === 1 ? 'number' : 'numbers'}`)
    else toast.error(`Saved ${saved} of ${chosen.length}. Check your connection and try the rest again.`)
    setFound([])
    setMissed([])
    setPhase('idle')
  }

  const update = (key, patch) => setFound(list => list.map(f => (f.key === key ? { ...f, ...patch } : f)))
  const selectedCount = found.filter(f => f.selected).length

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary mb-1">Find numbers in existing files</h2>
        <p className="text-sm text-text-muted">
          Reads your uploaded cards on this device and suggests their ID numbers. You review everything before it's saved.
        </p>
      </div>

      {phase === 'idle' && (
        targets.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary bg-surface-muted rounded-xl px-4 py-3">
            <CheckIcon className="w-4 h-4 text-emerald-600" />
            Every ID with a card uploaded already has its number{isAdmin ? '' : ' (for your profile)'}.
          </div>
        ) : (
          <div className="bg-surface rounded-2xl border border-stone-200/60 p-4">
            <p className="text-sm text-text-primary font-medium">
              {targets.length} {targets.length === 1 ? 'ID has' : 'IDs have'} a file but no number
            </p>
            <p className="text-xs text-text-muted mt-1">
              About {Math.max(1, Math.round(targets.length * 3 / 60))} min. Keep this screen open while it runs. The first scan on a device downloads about 7MB.
            </p>
            <button
              onClick={start}
              disabled={!online}
              className="mt-3 inline-flex items-center gap-2 min-h-11 px-5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
            >
              <ScanIcon /> Scan {targets.length} {targets.length === 1 ? 'ID' : 'IDs'}
            </button>
            {!online && <p className="text-xs text-text-muted mt-2">Needs internet to fetch files and save numbers.</p>}
          </div>
        )
      )}

      {phase === 'scanning' && (
        <div className="bg-surface rounded-2xl border border-stone-200/60 p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-sm font-medium text-text-primary">
              Reading {Math.min(progress.done + 1, progress.total)} of {progress.total}
            </p>
            <button onClick={() => { stopRef.current = true }} className="min-h-10 px-3 rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-hover">
              Stop
            </button>
          </div>
          <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-text-muted mt-2 truncate">{progress.current} · {found.length} found so far</p>
        </div>
      )}

      {(phase === 'review' || phase === 'saving') && (
        <div className="space-y-4">
          {found.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-text-primary mb-2">
                Found {found.length} {found.length === 1 ? 'number' : 'numbers'}. Untick any that look wrong.
              </p>
              <div className="bg-surface-card rounded-2xl border border-stone-200/60 divide-y divide-stone-100 overflow-hidden">
                {found.map(f => (
                  <label key={f.key} className="flex items-center gap-3 px-4 py-2.5 min-h-14 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.selected}
                      onChange={e => update(f.key, { selected: e.target.checked })}
                      className="w-5 h-5 accent-primary-600 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-text-muted truncate">{f.member.name} · {f.record.categoryName}</span>
                      {f.candidates.length > 1 ? (
                        <select
                          value={f.choice}
                          onChange={e => update(f.key, { choice: e.target.value })}
                          aria-label={`Which number for ${f.member.name}'s ${f.record.categoryName}`}
                          className="mt-0.5 bg-surface border border-stone-300 rounded-lg px-2 py-1 font-mono tabular-nums text-[15px] text-text-primary"
                        >
                          {f.candidates.map(c => <option key={c} value={c}>{formatIdNumber(f.record.type, c)}</option>)}
                        </select>
                      ) : (
                        <span className="block font-mono tabular-nums text-[15px] text-text-primary">{formatIdNumber(f.record.type, f.choice)}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary bg-surface-muted rounded-xl px-4 py-3">No numbers could be read from these files.</p>
          )}

          {missed.length > 0 && (
            <div className="text-sm text-text-muted">
              <p className="font-medium text-text-secondary mb-1">Couldn't read a number for:</p>
              <p>{missed.map(m => `${m.member.name} · ${m.record.categoryName}`).join(', ')}</p>
              <p className="text-xs mt-1">Open these from the home screen and type the number in.</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setFound([]); setMissed([]); setPhase('idle') }}
              disabled={phase === 'saving'}
              className="min-h-11 px-4 rounded-xl text-sm font-medium text-text-secondary bg-surface border border-stone-300 hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              {found.length ? 'Discard' : 'Done'}
            </button>
            {found.length > 0 && (
              <button
                onClick={saveSelected}
                disabled={phase === 'saving' || selectedCount === 0 || !online}
                className="min-h-11 px-5 rounded-xl text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors active:scale-[0.98]"
              >
                {phase === 'saving' ? 'Saving…' : `Save ${selectedCount} ${selectedCount === 1 ? 'number' : 'numbers'}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
