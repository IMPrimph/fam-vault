# Copyable IDs + People-First Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-tap copyable ID numbers per person + ID type, OCR/PDF-assisted entry, and a people-first home screen.

**Architecture:** A new `member_ids` table keyed by (member, category) holds the number. Documents are grouped client-side into "ID records" by the same key. Pure logic (ID types, Verhoeff, extraction, grouping, search) lives in `src/lib/` and is unit-tested with Vitest. OCR (Tesseract.js) and PDF text (pdf.js) are lazy-loaded and self-hosted, and only suggest a number the user must confirm.

**Tech Stack:** React 19, Vite 8, Tailwind 4, Supabase, TanStack Query, tesseract.js 7, pdfjs-dist 6, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-23-copyable-ids-revamp-design.md`

**Execution note:** The user asked for end-to-end execution with no commits. Every "Commit" step is replaced by "leave changes uncommitted". Implementation code lives in the files; this plan fixes the interfaces and tests.

## Global Constraints

- No git commits. The user commits.
- Aadhaar is stored and copied as 12 digits with no spaces, and displayed as `1234 5678 9012`.
- OCR never saves a number without an explicit user tap.
- The CSP keeps `script-src 'self'`; add only `'wasm-unsafe-eval'` and `worker-src 'self' blob:`.
- No third-party CDN at runtime. OCR assets are served from `/ocr/`.
- Numbers are always fully visible (no masking).
- Offline: view and copy work; edits are disabled with "Needs internet".

## Review Focus

1. Aadhaar typed with spaces or dashes (`1234-5678-9012`): stored as 12 digits, copied without spaces. Tested in `idTypes.test.js`.
2. OCR text where an Aadhaar number is split across a line break or has O/0 and I/1 confusions: still extracted if the checksum passes. Tested in `extract.test.js`.
3. A VID (16 digits) or a phone number printed on the card must not be offered as the Aadhaar. Tested in `extract.test.js`.
4. A category renamed "Aadhaar Card" / "aadhar" / "PAN Card" still detects its type. Tested in `idTypes.test.js`.
5. A document with no category, or a number with no files, still renders: "Other files" group / a record with no docs. Tested in `idRecords.test.js`.

---

### Task 1: Vitest + ID type logic

**Files:**
- Create: `vitest.config.js`, `src/lib/idTypes.js`, `src/lib/idTypes.test.js`
- Modify: `package.json` (add a `"test": "vitest run"` script)

**Produces:**
- `detectIdType(categoryName: string) → 'aadhaar'|'pan'|'passport'|'voter'|'dl'|'other'`
- `ID_TYPES: Record<type, { placeholder: string, hint: string }>`
- `verhoeffValid(digits: string) → boolean`
- `normalizeIdNumber(type, raw) → string` (the stored form)
- `formatIdNumber(type, stored) → string` (the displayed form)
- `copyValue(type, stored) → string`
- `validateIdNumber(type, stored) → string|null` (a warning, or null)

- [ ] Write tests: detection variants; Verhoeff on a known-valid number (`234123412346`) vs one digit changed; normalize/format/copy for Aadhaar with spaces and dashes, and for lowercase PAN; validation warnings.
- [ ] Run `npm test` → FAIL.
- [ ] Implement `idTypes.js`.
- [ ] Run `npm test` → PASS.

### Task 2: Candidate extraction from OCR / PDF text

**Files:** Create `src/lib/extractIds.js`, `src/lib/extractIds.test.js`

**Consumes:** `normalizeIdNumber`, `verhoeffValid`, `detectIdType` types
**Produces:** `extractCandidates(text: string, type) → string[]` (normalized, unique, valid-first; for Aadhaar only checksum-valid)

- [ ] Tests:
  - Aadhaar inside noisy text with `O`→`0` / `l`→`1` confusions
  - a 16-digit VID and a 10-digit phone number both ignored
  - the number split across a newline
  - PAN in `Permanent Account Number ABCDE1234F` text
  - passport, voter
  - `other` returns `[]`
- [ ] Implement and run the tests to green.

### Task 3: Record grouping + search

**Files:** Create `src/lib/idRecords.js`, `src/lib/idRecords.test.js`

**Produces:**
- `buildPeople({ members, documents, memberIds, selfMemberId }) → Person[]` where
  `Person = { member, records: Record[], otherDocs: Doc[] }` and
  `Record = { key, memberId, categoryId, categoryName, type, idNumber, docs }`.
  The self member comes first; records are sorted by type priority (aadhaar, pan, passport, dl, voter, then others alphabetical).
- `searchPeople(people, query) → Array<{ member, record }>`. Matches name, relationship, category, number (alphanumerics only), doc label and notes.

- [ ] Tests:
  - docs grouped by category
  - a `member_ids` row with no docs still produces a record
  - an uncategorized doc goes to `otherDocs`
  - self first
  - a search for `1234 5678` matches a stored `123456789012`
  - a search by the person's name returns all their records
- [ ] Implement and run the tests to green.

### Task 4: Migration `007_member_ids.sql`

**Files:** Create `supabase/migrations/007_member_ids.sql`

- [ ] Table, updated_at trigger, index on `member_id`, RLS policies per spec §1 (the category must be in the caller's family). Grant the table to `authenticated`.

### Task 5: Data hooks + clipboard

**Files:**
- Create: `src/hooks/useMemberIds.js`, `src/lib/clipboard.js`
- Modify: `src/hooks/useCategories.js` (the delete invalidates `memberIds`), `src/pages/SettingsPage.jsx` (the category delete warning counts numbers)

**Produces:**
- `useMemberIds(familyId) → { memberIds, loading, saveNumber({ memberId, categoryId, idNumber }) }`. It upserts on `member_id,category_id` and invalidates `['memberIds', familyId]`.
- `copyText(text) → Promise<boolean>`: the Clipboard API, with an `execCommand` fallback.

### Task 6: UI components

**Files:** Create in `src/components/ids/`:
- `CopyButton.jsx` `{ value, label, toastLabel, size }`: copies, shows ✓ for 1.5s, toast `"<toastLabel> copied"`, and a manual-copy modal on failure.
- `IdRow.jsx` `{ record, memberName, canEdit, onOpen }`.
- `PersonCard.jsx` `{ person, isSelf, canEditMember, onOpenRecord, compact }`.
- `NumberEditor.jsx` `{ record, onSaved, onCancel, scanSource? }`: input + validation warning + a "Read from image" button that uses `useNumberScan`.
- `IdSheet.jsx` `{ person, record, onClose }`: a bottom sheet on mobile and a right panel on desktop, with the number, copy, edit, file thumbnails, preview and "+ Add file".
- `Sheet.jsx`: a generic sheet shell (reuses the Modal focus trap pattern).

### Task 7: Home, person page, upload

**Files:**
- Rewrite: `src/pages/DashboardPage.jsx`
- Rewrite: `src/pages/MemberPage.jsx` (uses `PersonCard` expanded + Download all + admin delete)
- Modify: `src/pages/UploadPage.jsx`, `src/components/UploadForm.jsx`: preset via `?category=<id>`, category chips, a "More" toggle for notes, an ID number field fed by the scan chip, and an upsert of the number after upload
- Delete if unused: `useRecentlyViewed.js`, `useStarred.js`, `DocumentGrid.jsx`, `DocumentCard.jsx`

- [ ] Run `npm run build` + `npm run lint` → clean.

### Task 8: Image OCR

**Files:**
- Create: `src/lib/ocr/tesseract.js` (`recognizeImage(blob) → string`, a lazy singleton worker), `src/lib/ocr/preprocess.js` (`prepareForOcr(blob) → Blob`: grayscale, max 2000px), `src/lib/ocr/scan.js` (`scanForNumber(source: Blob, type, { askPassword }) → { candidates, source: 'text'|'ocr' }`), `src/hooks/useNumberScan.js`, `src/components/ids/ScanChip.jsx`
- Modify: `vite.config.js` (a copy-assets plugin into `public/ocr/`, Workbox `globIgnores` + a CacheFirst `/ocr/` route), `public/_headers` (CSP), `.gitignore` (`public/ocr`)

### Task 9: PDF extraction

**Files:**
- Create: `src/lib/ocr/pdf.js` (`readPdf(blob, { askPassword }) → { text, pageBlob }`)
- Modify: `scan.js` (route PDFs: text first, else OCR on the rendered page 1), `DialogContext.jsx` (the prompt supports `inputType: 'password'` and an error message)

### Task 10: Verification

- [ ] `npm test`, `npm run lint`, `npm run build` all pass.
- [ ] Run the dev server and check in Chrome at 390px and at desktop width: home renders, copy works, sheet opens, upload page renders with chips. Real Supabase writes need migration 007 applied, so flag that to the user.
