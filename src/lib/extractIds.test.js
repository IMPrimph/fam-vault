import { describe, it, expect } from 'vitest'
import { extractCandidates } from './extractIds'
import { verhoeffCheckDigit } from './idTypes'

const AADHAAR = '52341234123' + verhoeffCheckDigit('52341234123')
const spaced = (n) => `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8)}`

describe('extractCandidates: aadhaar', () => {
  it('finds a spaced number in card text', () => {
    const text = `Government of India\nRamesh Kumar\nDOB: 01/01/1970\nMALE\n${spaced(AADHAAR)}\nMera Aadhaar, Meri Pehchan`
    expect(extractCandidates(text, 'aadhaar')).toEqual([AADHAAR])
  })

  it('repairs O/0 and l/1 confusions when the checksum then passes', () => {
    const noisy = spaced(AADHAAR).replace(/0/g, 'O').replace(/1/g, 'l')
    expect(extractCandidates(`Your Aadhaar No. : ${noisy}`, 'aadhaar')).toEqual([AADHAAR])
  })

  it('handles the groups split across a line break', () => {
    const text = `${AADHAAR.slice(0, 4)} ${AADHAAR.slice(4, 8)}\n${AADHAAR.slice(8)}`
    expect(extractCandidates(text, 'aadhaar')).toEqual([AADHAAR])
  })

  it('ignores a 16-digit VID and a phone number', () => {
    const text = `VID : 9134 5678 1234 5678\nMobile: 9876543210\n${spaced(AADHAAR)}`
    expect(extractCandidates(text, 'aadhaar')).toEqual([AADHAAR])
  })

  it('rejects 12 digits that fail the checksum', () => {
    const broken = (AADHAAR[0] === '9' ? '8' : '9') + AADHAAR.slice(1)
    expect(extractCandidates(spaced(broken), 'aadhaar')).toEqual([])
  })

  it('returns each number once even if printed twice', () => {
    const text = `${spaced(AADHAAR)}\n...\n${spaced(AADHAAR)}`
    expect(extractCandidates(text, 'aadhaar')).toEqual([AADHAAR])
  })
})

describe('extractCandidates: other types', () => {
  it('finds a PAN, fixing an O in the digit block', () => {
    const text = 'INCOME TAX DEPARTMENT\nPermanent Account Number\nABCPE12O4F\nSignature'
    expect(extractCandidates(text, 'pan')).toEqual(['ABCPE1204F'])
  })

  it('finds a lowercase-read PAN', () => {
    expect(extractCandidates('pan: abcpe1234f', 'pan')).toEqual(['ABCPE1234F'])
  })

  it('finds a passport number', () => {
    expect(extractCandidates('Passport No.\nZ1234567\nP<INDSHARMA', 'passport')).toEqual(['Z1234567'])
  })

  it('finds a voter ID', () => {
    expect(extractCandidates('ELECTION COMMISSION OF INDIA\nXYZ1234567', 'voter')).toEqual(['XYZ1234567'])
  })

  it('finds a driving licence with separators', () => {
    expect(extractCandidates('DL No: AP09 20150012345 Valid Till', 'dl')).toEqual(['AP09 20150012345'])
  })

  it('never guesses for unknown types', () => {
    expect(extractCandidates('Policy No 123456', 'other')).toEqual([])
  })

  it('copes with empty input', () => {
    expect(extractCandidates('', 'aadhaar')).toEqual([])
    expect(extractCandidates(null, 'pan')).toEqual([])
  })
})
