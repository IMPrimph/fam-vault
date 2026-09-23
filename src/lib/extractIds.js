import { verhoeffValid } from './idTypes'

/**
 * Pull likely ID numbers out of OCR or PDF text for a given ID type.
 *
 * Results are suggestions for the user to confirm, never saved directly, so
 * the bar is "rarely wrong" rather than "never misses": Aadhaar candidates
 * must pass the Verhoeff checksum, which throws out nearly all misreads.
 */

// Letters OCR commonly returns in place of digits.
const DIGIT_FIXES = { O: '0', o: '0', D: '0', Q: '0', I: '1', l: '1', '|': '1', i: '1', S: '5', s: '5', B: '8', Z: '2', z: '2', G: '6', b: '6', g: '9' }
const toDigits = (s) => s.replace(/[OoDQIl|iSsBZzGbg]/g, c => DIGIT_FIXES[c])

const D = '[\\dOoDQIl|iSsBZzGbg]'

// 4-4-4 with optional space/dash/newline separators, not glued to more digits
// on the same line (which is what a 16-digit VID or an account number looks
// like). Digits on a neighbouring line, like a phone number, don't count.
const AADHAAR_RE = new RegExp(
  `(?<!\\d[ \\t-]*)(${D}{4})[ \\t-]*\\n?[ \\t-]*(${D}{4})[ \\t-]*\\n?[ \\t-]*(${D}{4})(?![ \\t-]*\\d)`,
  'g'
)

function aadhaar(text) {
  const out = []
  for (const m of text.matchAll(AADHAAR_RE)) {
    const digits = toDigits(m[1] + m[2] + m[3])
    if (!/^\d{12}$/.test(digits)) continue
    // A raw run needs at least some real digits; a word like "Sold" + two
    // more words shouldn't qualify just because every letter maps to a digit.
    if ((m[0].match(/\d/g) || []).length < 8) continue
    if (/^[01]/.test(digits) || !verhoeffValid(digits)) continue
    out.push(digits)
  }
  return out
}

function byPattern(text, re, fix) {
  const out = []
  for (const m of text.toUpperCase().matchAll(re)) out.push(fix ? fix(m) : m[0])
  return out
}

function pan(text) {
  return byPattern(
    text,
    /(?<![A-Z0-9])([A-Z]{5})([0-9OIDSBZ]{4})([A-Z])(?![A-Z0-9])/g,
    m => m[1] + toDigits(m[2]) + m[3]
  )
}

function passport(text) {
  return byPattern(
    text,
    /(?<![A-Z0-9])([A-Z])([0-9O]{7})(?![A-Z0-9])/g,
    m => m[1] + toDigits(m[2])
  )
}

function voter(text) {
  return byPattern(
    text,
    /(?<![A-Z0-9])([A-Z]{3})([0-9O]{7})(?![A-Z0-9])/g,
    m => m[1] + toDigits(m[2])
  )
}

function dl(text) {
  return byPattern(
    text,
    /(?<![A-Z0-9])([A-Z]{2})[- ]?(\d{2})[- ]?(\d{4})[- ]?(\d{7})(?![A-Z0-9])/g,
    m => `${m[1]}${m[2]} ${m[3]}${m[4]}`
  )
}

const EXTRACTORS = { aadhaar, pan, passport, voter, dl }

export function extractCandidates(text, type) {
  const fn = EXTRACTORS[type]
  if (!fn || !text) return []
  return [...new Set(fn(text))]
}
