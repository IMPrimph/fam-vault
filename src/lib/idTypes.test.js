import { describe, it, expect } from 'vitest'
import {
  detectIdType,
  verhoeffValid,
  verhoeffCheckDigit,
  normalizeIdNumber,
  formatIdNumber,
  copyValue,
  validateIdNumber,
} from './idTypes'

// A syntactically valid Aadhaar: 11 digits + computed Verhoeff check digit.
const AADHAAR = '23412341234' + verhoeffCheckDigit('23412341234')

describe('detectIdType', () => {
  it.each([
    ['Aadhaar', 'aadhaar'],
    ['Aadhaar Card', 'aadhaar'],
    ['aadhar', 'aadhaar'],
    ['PAN Card', 'pan'],
    ['PAN', 'pan'],
    ['Passport', 'passport'],
    ['Voter ID', 'voter'],
    ['EPIC', 'voter'],
    ['Driving License', 'dl'],
    ['Driving Licence', 'dl'],
    ['DL', 'dl'],
    ['Insurance', 'other'],
    ['Company Papers', 'other'],
    ['', 'other'],
    [null, 'other'],
  ])('%s → %s', (name, type) => {
    expect(detectIdType(name)).toBe(type)
  })
})

describe('verhoeff', () => {
  it('validates the textbook example 2363', () => {
    expect(verhoeffCheckDigit('236')).toBe('3')
    expect(verhoeffValid('2363')).toBe(true)
    expect(verhoeffValid('2364')).toBe(false)
  })

  it('catches a single changed digit in an Aadhaar', () => {
    expect(verhoeffValid(AADHAAR)).toBe(true)
    const broken = (AADHAAR[0] === '9' ? '8' : '9') + AADHAAR.slice(1)
    expect(verhoeffValid(broken)).toBe(false)
  })
})

describe('normalize / format / copy', () => {
  it('stores Aadhaar as bare digits whatever the separators', () => {
    const spaced = `${AADHAAR.slice(0, 4)} ${AADHAAR.slice(4, 8)} ${AADHAAR.slice(8)}`
    const dashed = spaced.replaceAll(' ', '-')
    expect(normalizeIdNumber('aadhaar', spaced)).toBe(AADHAAR)
    expect(normalizeIdNumber('aadhaar', dashed)).toBe(AADHAAR)
  })

  it('displays Aadhaar in 4-4-4 groups and copies without spaces', () => {
    expect(formatIdNumber('aadhaar', AADHAAR)).toBe(
      `${AADHAAR.slice(0, 4)} ${AADHAAR.slice(4, 8)} ${AADHAAR.slice(8)}`
    )
    expect(copyValue('aadhaar', AADHAAR)).toBe(AADHAAR)
  })

  it('uppercases PAN and strips spaces', () => {
    expect(normalizeIdNumber('pan', ' abcde 1234f ')).toBe('ABCDE1234F')
    expect(copyValue('pan', 'ABCDE1234F')).toBe('ABCDE1234F')
  })

  it('keeps other types as typed, trimmed', () => {
    expect(normalizeIdNumber('other', '  Policy 12/34  ')).toBe('Policy 12/34')
    expect(formatIdNumber('other', 'Policy 12/34')).toBe('Policy 12/34')
  })

  it('uppercases driving licences but keeps their separators', () => {
    expect(normalizeIdNumber('dl', 'ap09 20150012345')).toBe('AP09 20150012345')
  })

  it('treats empty input as no number', () => {
    expect(normalizeIdNumber('aadhaar', '   ')).toBe('')
    expect(formatIdNumber('aadhaar', null)).toBe('')
  })
})

describe('validateIdNumber', () => {
  it('accepts a valid Aadhaar', () => {
    expect(validateIdNumber('aadhaar', AADHAAR)).toBeNull()
  })

  it('warns on wrong length or checksum', () => {
    expect(validateIdNumber('aadhaar', '12345')).toMatch(/12 digits/)
    const broken = (AADHAAR[0] === '9' ? '8' : '9') + AADHAAR.slice(1)
    expect(validateIdNumber('aadhaar', broken)).toMatch(/doesn't look like/i)
  })

  it('checks PAN shape', () => {
    expect(validateIdNumber('pan', 'ABCDE1234F')).toBeNull()
    expect(validateIdNumber('pan', 'ABCD1234F')).toMatch(/5 letters/)
  })

  it('never warns for other types or empty values', () => {
    expect(validateIdNumber('other', 'anything')).toBeNull()
    expect(validateIdNumber('pan', '')).toBeNull()
  })
})
