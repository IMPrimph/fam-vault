import { detectIdType } from './idTypes'

/**
 * Turn flat members / documents / member_ids rows into what the home screen
 * shows: one entry per person, each holding "ID records" — a (person,
 * category) pair with its optional number and the files filed under it.
 *
 * Kept free of React and Supabase so the grouping rules are unit-testable.
 */

const TYPE_ORDER = ['aadhaar', 'pan', 'passport', 'dl', 'voter']
const typeRank = (t) => {
  const i = TYPE_ORDER.indexOf(t)
  return i === -1 ? TYPE_ORDER.length : i
}

export const recordKey = (memberId, categoryId) => `${memberId}:${categoryId}`

export function buildPeople({ members, documents, memberIds, categories, selfMemberId }) {
  const catName = new Map((categories || []).map(c => [c.id, c.name]))
  const records = new Map()
  const otherDocs = new Map()

  const ensure = (memberId, categoryId, name) => {
    const key = recordKey(memberId, categoryId)
    let r = records.get(key)
    if (!r) {
      r = { key, memberId, categoryId, categoryName: name, type: detectIdType(name), idNumber: '', docs: [] }
      records.set(key, r)
    }
    return r
  }

  for (const d of documents || []) {
    if (!d.category_id) {
      if (!otherDocs.has(d.member_id)) otherDocs.set(d.member_id, [])
      otherDocs.get(d.member_id).push(d)
      continue
    }
    const name = d.categories?.name ?? catName.get(d.category_id) ?? 'Other'
    ensure(d.member_id, d.category_id, name).docs.push(d)
  }

  for (const row of memberIds || []) {
    const name = catName.get(row.category_id)
    // A number whose category was deleted has nothing to display under.
    if (name === undefined) continue
    ensure(row.member_id, row.category_id, name).idNumber = row.id_number || ''
  }

  const byMember = new Map()
  for (const r of records.values()) {
    if (!byMember.has(r.memberId)) byMember.set(r.memberId, [])
    byMember.get(r.memberId).push(r)
  }

  const ordered = selfMemberId
    ? [...members.filter(m => m.id === selfMemberId), ...members.filter(m => m.id !== selfMemberId)]
    : members

  return ordered.map(member => ({
    member,
    records: (byMember.get(member.id) || []).sort((a, b) =>
      typeRank(a.type) - typeRank(b.type) || a.categoryName.localeCompare(b.categoryName)
    ),
    otherDocs: otherDocs.get(member.id) || [],
  }))
}

/** Uncategorized files shown as a pseudo-record, or null if there are none. */
export function otherFilesRecord(person) {
  if (!person.otherDocs.length) return null
  const memberId = person.member.id
  return { key: `${memberId}:other`, memberId, categoryId: null, categoryName: 'Other files', type: 'other', idNumber: '', docs: person.otherDocs }
}

/** Find a record (including "Other files") by key across everyone. */
export function findRecord(people, key) {
  for (const person of people) {
    const record = person.records.find(r => r.key === key) || (otherFilesRecord(person)?.key === key ? otherFilesRecord(person) : null)
    if (record) return { member: person.member, record }
  }
  return null
}

const alnum = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Flat list of matching records. A query matching the person matches every
 * one of their records; otherwise the record itself (type, number, file
 * labels, notes) has to match.
 */
export function searchPeople(people, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  const qAlnum = alnum(q)

  const hit = (s) => (s || '').toLowerCase().includes(q)
  const results = []

  for (const person of people) {
    const { member } = person
    const personHit = hit(member.name) || hit(member.relationship)
    for (const record of person.records) {
      const recordHit =
        hit(record.categoryName) ||
        (qAlnum.length >= 3 && alnum(record.idNumber).includes(qAlnum)) ||
        record.docs.some(d => hit(d.label) || hit(d.notes))
      if (personHit || recordHit) results.push({ member, record })
    }
  }
  return results
}

export const isScannable = (d) => d.file_type?.startsWith('image/') || d.file_type === 'application/pdf'

/**
 * IDs worth a bulk number scan: a known ID type, no number saved yet, at
 * least one image/PDF, and the viewer allowed to edit that person. Files are
 * newest first, since a re-upload is usually the clearer copy.
 */
export function scanTargets(people, canEdit) {
  const out = []
  for (const { member, records } of people) {
    if (!canEdit(member.id)) continue
    for (const record of records) {
      if (record.type === 'other' || record.idNumber) continue
      const docs = record.docs
        .filter(isScannable)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      if (docs.length) out.push({ member, record, docs })
    }
  }
  return out
}
