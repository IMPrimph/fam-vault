/**
 * Known Indian ID types and how their numbers are stored, shown and copied.
 *
 * The type is inferred from the category name rather than stored, so it
 * survives renames like "Aadhaar" → "Aadhaar Card" and needs no schema field.
 * Anything unrecognised is 'other': free text, no validation, no OCR pattern.
 */

export const ID_TYPES = {
  aadhaar: { placeholder: '1234 5678 9012', hint: '12 digits' },
  pan: { placeholder: 'ABCDE1234F', hint: '5 letters, 4 digits, 1 letter' },
  passport: { placeholder: 'A1234567', hint: '1 letter, 7 digits' },
  voter: { placeholder: 'ABC1234567', hint: '3 letters, 7 digits' },
  dl: { placeholder: 'AP09 20150012345', hint: 'State code, RTO, year, number' },
  other: { placeholder: 'ID or reference number', hint: '' },
}

export function detectIdType(categoryName) {
  const n = (categoryName || '').toLowerCase().replace(/[^a-z]/g, '')
  if (!n) return 'other'
  if (n.includes('aadhaar') || n.includes('aadhar')) return 'aadhaar'
  if (n === 'pan' || n === 'pancard' || n.startsWith('pan')) return 'pan'
  if (n.includes('passport')) return 'passport'
  if (n.includes('voter') || n.includes('epic')) return 'voter'
  if (n === 'dl' || n.includes('driving') || n.includes('licen')) return 'dl'
  return 'other'
}

// --- Verhoeff checksum (the check digit scheme Aadhaar uses) ---------------

const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]

export function verhoeffValid(digits) {
  if (!/^\d+$/.test(digits || '')) return false
  let c = 0
  const rev = [...digits].reverse()
  for (let i = 0; i < rev.length; i++) c = D[c][P[i % 8][+rev[i]]]
  return c === 0
}

export function verhoeffCheckDigit(digits) {
  let c = 0
  const rev = [...digits].reverse()
  for (let i = 0; i < rev.length; i++) c = D[c][P[(i + 1) % 8][+rev[i]]]
  return String(INV[c])
}

// --- Storage / display / clipboard forms -----------------------------------

/** The canonical stored form. Empty string means "no number". */
export function normalizeIdNumber(type, raw) {
  const s = (raw || '').trim()
  if (!s) return ''
  switch (type) {
    case 'aadhaar':
      return s.replace(/\D/g, '')
    case 'pan':
    case 'passport':
    case 'voter':
      return s.replace(/[^a-z0-9]/gi, '').toUpperCase()
    case 'dl':
      return s.replace(/\s+/g, ' ').toUpperCase()
    default:
      return s
  }
}

export function formatIdNumber(type, stored) {
  if (!stored) return ''
  if (type === 'aadhaar' && /^\d{12}$/.test(stored)) {
    return stored.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')
  }
  return stored
}

/** What lands on the clipboard. Forms want bare digits for Aadhaar. */
export function copyValue(type, stored) {
  return stored || ''
}

/** A human warning for an odd-looking number, or null. Never blocks saving. */
export function validateIdNumber(type, stored) {
  if (!stored) return null
  switch (type) {
    case 'aadhaar':
      if (!/^\d{12}$/.test(stored)) return 'Aadhaar numbers have 12 digits'
      if (!verhoeffValid(stored) || /^[01]/.test(stored)) return "This doesn't look like a valid Aadhaar number"
      return null
    case 'pan':
      return /^[A-Z]{5}\d{4}[A-Z]$/.test(stored) ? null : 'PAN is 5 letters, 4 digits, then 1 letter'
    case 'passport':
      return /^[A-Z]\d{7}$/.test(stored) ? null : 'Passport numbers are 1 letter and 7 digits'
    case 'voter':
      return /^[A-Z]{3}\d{7}$/.test(stored) ? null : 'Voter ID is 3 letters and 7 digits'
    case 'dl':
      return /^[A-Z]{2}\d{13}$/.test(stored.replace(/[^A-Z0-9]/g, ''))
        ? null
        : 'Driving licence numbers are usually 2 letters and 13 digits'
    default:
      return null
  }
}
