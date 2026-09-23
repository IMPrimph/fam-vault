import { describe, it, expect } from 'vitest'
import { buildPeople, searchPeople, findRecord, otherFilesRecord, scanTargets } from './idRecords'

const members = [
  { id: 'm-dad', name: 'Ramesh', relationship: 'Father' },
  { id: 'm-me', name: 'Vishnu', relationship: 'Son' },
  { id: 'm-mom', name: 'Lakshmi', relationship: 'Mother' },
]

const doc = (id, memberId, categoryId, categoryName, extra = {}) => ({
  id, member_id: memberId, category_id: categoryId,
  categories: categoryName ? { name: categoryName } : null,
  label: extra.label || categoryName || 'File', notes: extra.notes || null,
  created_at: extra.created_at || '2026-01-01T00:00:00Z',
})

const documents = [
  doc('d1', 'm-dad', 'c-aadhaar', 'Aadhaar', { label: 'Aadhaar front' }),
  doc('d2', 'm-dad', 'c-aadhaar', 'Aadhaar', { label: 'Aadhaar back' }),
  doc('d3', 'm-dad', 'c-ins', 'Insurance', { notes: 'LIC policy' }),
  doc('d4', 'm-dad', null, null, { label: 'Random scan' }),
  doc('d5', 'm-me', 'c-pan', 'PAN Card'),
]

const categories = [
  { id: 'c-aadhaar', name: 'Aadhaar' },
  { id: 'c-pan', name: 'PAN Card' },
  { id: 'c-ins', name: 'Insurance' },
  { id: 'c-pass', name: 'Passport' },
]

const memberIds = [
  { member_id: 'm-dad', category_id: 'c-aadhaar', id_number: '523412341236' },
  // A number with no scan uploaded yet.
  { member_id: 'm-mom', category_id: 'c-pass', id_number: 'Z1234567' },
]

const people = buildPeople({ members, documents, memberIds, categories, selfMemberId: 'm-me' })
const byId = Object.fromEntries(people.map(p => [p.member.id, p]))

describe('buildPeople', () => {
  it('puts the signed-in member first, then family order', () => {
    expect(people.map(p => p.member.id)).toEqual(['m-me', 'm-dad', 'm-mom'])
  })

  it('groups front and back under one record carrying the number', () => {
    const aadhaar = byId['m-dad'].records.find(r => r.type === 'aadhaar')
    expect(aadhaar.docs.map(d => d.id)).toEqual(['d1', 'd2'])
    expect(aadhaar.idNumber).toBe('523412341236')
    expect(aadhaar.categoryName).toBe('Aadhaar')
  })

  it('orders known ID types before other categories', () => {
    expect(byId['m-dad'].records.map(r => r.categoryName)).toEqual(['Aadhaar', 'Insurance'])
  })

  it('keeps uncategorized files aside', () => {
    expect(byId['m-dad'].otherDocs.map(d => d.id)).toEqual(['d4'])
  })

  it('creates a record from a number alone', () => {
    const passport = byId['m-mom'].records[0]
    expect(passport).toMatchObject({ type: 'passport', idNumber: 'Z1234567', docs: [] })
  })

  it('includes people with nothing yet', () => {
    const empty = buildPeople({ members, documents: [], memberIds: [], categories, selfMemberId: null })
    expect(empty).toHaveLength(3)
    expect(empty.every(p => p.records.length === 0)).toBe(true)
  })

  it('skips number rows whose category no longer exists', () => {
    const orphan = buildPeople({
      members, documents: [], categories,
      memberIds: [{ member_id: 'm-dad', category_id: 'gone', id_number: '1' }],
    })
    expect(orphan.find(p => p.member.id === 'm-dad').records).toEqual([])
  })
})

describe('searchPeople', () => {
  const keys = (q) => searchPeople(people, q).map(r => `${r.member.id}:${r.record.categoryName}`)

  it('matches a number regardless of spaces', () => {
    expect(keys('5234 1234')).toEqual(['m-dad:Aadhaar'])
  })

  it('matches by person name, returning all their records', () => {
    expect(keys('ramesh')).toEqual(['m-dad:Aadhaar', 'm-dad:Insurance'])
  })

  it('matches by relationship', () => {
    expect(keys('mother')).toEqual(['m-mom:Passport'])
  })

  it('matches by ID type across people', () => {
    expect(keys('pan')).toEqual(['m-me:PAN Card'])
  })

  it('matches file labels and notes', () => {
    expect(keys('back')).toEqual(['m-dad:Aadhaar'])
    expect(keys('lic')).toEqual(['m-dad:Insurance'])
  })

  it('returns nothing for a blank query', () => {
    expect(searchPeople(people, '  ')).toEqual([])
  })
})

describe('findRecord / otherFilesRecord', () => {
  it('finds a real record by key', () => {
    expect(findRecord(people, 'm-dad:c-aadhaar').record.idNumber).toBe('523412341236')
  })

  it('finds the other-files pseudo record', () => {
    const hit = findRecord(people, 'm-dad:other')
    expect(hit.member.id).toBe('m-dad')
    expect(hit.record.docs.map(d => d.id)).toEqual(['d4'])
  })

  it('returns null for a vanished record and when there are no other files', () => {
    expect(findRecord(people, 'm-dad:nope')).toBeNull()
    expect(otherFilesRecord(byId['m-me'])).toBeNull()
  })
})

describe('scanTargets', () => {
  const img = (id, m, c, name, created_at) => ({ ...doc(id, m, c, name, { created_at }), file_type: 'image/jpeg' })
  const docs = [
    img('a1', 'm-me', 'c-aadhaar', 'Aadhaar', '2026-01-01'),
    img('a2', 'm-me', 'c-aadhaar', 'Aadhaar', '2026-03-01'),
    img('p1', 'm-dad', 'c-pan', 'PAN Card', '2026-01-01'),
    img('i1', 'm-dad', 'c-ins', 'Insurance', '2026-01-01'),
    { ...doc('z1', 'm-mom', 'c-aadhaar', 'Aadhaar'), file_type: 'application/zip' },
    img('done', 'm-dad', 'c-aadhaar', 'Aadhaar', '2026-01-01'),
  ]
  const ppl = buildPeople({
    members, documents: docs, categories, selfMemberId: 'm-me',
    memberIds: [{ member_id: 'm-dad', category_id: 'c-aadhaar', id_number: '523412341236' }],
  })

  it('picks known ID types with scannable files and no number, newest file first', () => {
    const t = scanTargets(ppl, () => true)
    expect(t.map(x => `${x.member.id}:${x.record.categoryName}`)).toEqual(['m-me:Aadhaar', 'm-dad:PAN Card'])
    expect(t[0].docs.map(d => d.id)).toEqual(['a2', 'a1'])
  })

  it('respects who may edit whom', () => {
    const t = scanTargets(ppl, id => id === 'm-me')
    expect(t.map(x => x.member.id)).toEqual(['m-me'])
  })
})
