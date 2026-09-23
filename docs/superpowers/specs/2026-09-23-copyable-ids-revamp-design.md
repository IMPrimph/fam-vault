# Fam Vault: Copyable ID Numbers + People-First Revamp

**Date:** 2026-09-23
**Status:** Draft, awaiting review

## Intent

The most common thing the family does in Fam Vault is copy an ID number (Aadhaar, PAN, …) into some form. Today that means opening an image and retyping the number. The dashboard is also cluttered, takes too many taps to reach a specific person's ID, has cards that show nothing useful, and feels clunky on mobile. The app is used heavily on both mobile and desktop.

**Success looks like:**
- Any family member's ID number is copyable from the home screen in one tap, online or offline.
- Numbers are captured with minimal typing: OCR suggests them from images and PDFs, the user confirms.
- The home screen reads as "people → their IDs", not a wall of thumbnails.

**Decisions made during brainstorming:**
| Question | Decision |
|---|---|
| Where numbers live | Per person + ID type (not per file) |
| What is copyable | Just the main ID number |
| Entry method | Manual + "Read from image", AND auto-OCR on upload (suggest, never auto-save) |
| PDFs | In scope: text-layer extraction first, OCR fallback, password prompt |
| Home layout | People-first |
| Masking | Numbers always fully visible |
| Removed from home | Recently viewed strip, category chips, starred filter |

## 1. Data model

### New table `member_ids`

```sql
CREATE TABLE member_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  id_number text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (member_id, category_id)
);
-- + updated_at trigger (reuse update_updated_at())
```

- An "ID record" in the UI = (member, category). Its files are the `documents` rows with the same `member_id` + `category_id`. **`documents` is unchanged**; no backfill is needed.
- A record appears in the UI if a `member_ids` row exists OR at least one document exists for that pair.
- Documents with `category_id IS NULL` are shown under "Other files" for that person. They cannot carry a number.
- Categories without a meaningful number (Insurance, Certificates) use the same record shape with `id_number` null.

### RLS (mirrors `documents`)

| Op | Rule |
|---|---|
| SELECT | `member_id` in caller's family |
| INSERT / UPDATE | in caller's family AND (`is_admin()` OR `member_id` = caller's own member row) |
| DELETE | `is_admin()` |

`category_id` must also belong to the caller's family (check in INSERT/UPDATE policy).

Saving a number is an upsert on `(member_id, category_id)`.

### Category deletion

`ON DELETE CASCADE` removes numbers with the category. The category delete confirmation in Settings must say: "This also deletes N saved ID numbers."

### Offline

`member_ids` is fetched with TanStack Query under `['memberIds', familyId]`, so it is persisted in the existing encrypted IDB query cache. Viewing and copying work offline. Editing is disabled offline.

### ID type detection and formatting (`src/lib/idTypes.js`)

The type is derived from the category name, normalized (lowercase, spaces and punctuation stripped), so renames like "Aadhaar Card" still match:

| Type | Name match | Validate | Display | Copy |
|---|---|---|---|---|
| aadhaar | contains `aadhaar` / `aadhar` | 12 digits + Verhoeff checksum | `1234 5678 9012` | `123456789012` |
| pan | equals `pan` / `pancard` | `^[A-Z]{5}\d{4}[A-Z]$` | uppercase | as displayed |
| passport | contains `passport` | `^[A-Z]\d{7}$` | uppercase | as displayed |
| voter | contains `voter` / `epic` | `^[A-Z]{3}\d{7}$` | uppercase | as displayed |
| dl | contains `driving` / `licen` / equals `dl` | `^[A-Z]{2}[-\s]?\d{2}[-\s]?\d{4}[-\s]?\d{7}$` (lenient) | as entered | as entered |
| other | anything else | none | as entered | as entered |

Validation failures on manual entry **warn but do not block** saving.

## 2. OCR and PDF extraction

### Libraries
- `tesseract.js` (v7), lazy-loaded with dynamic `import()` only when a scan runs.
- `pdfjs-dist` (v6), lazy-loaded only for PDFs.

### Hosting under the existing CSP
- The Tesseract worker, WASM core and `eng` traineddata (fast variant), plus the pdf.js worker, are copied into `public/ocr/` at build time and loaded from our own domain.
- CSP change in `public/_headers`: add `'wasm-unsafe-eval'` to `script-src`, and `worker-src 'self' blob:`.
- Workbox: exclude `ocr/**` from precache, and add a `CacheFirst` runtime route for `/ocr/` so OCR works offline after the first use.

### Pipeline (`src/lib/ocr/`)
1. **Input:** a `File`/`Blob` (upload) or a URL (existing doc: cached signed URL or offline blob URL).
2. **PDF:** open with pdf.js.
   - If it's encrypted, ask for the password in a sheet ("e-Aadhaar: first 4 letters of name in CAPS + birth year"). The password is held in memory only and never stored.
   - Run `getTextContent()` on page 1 (and page 2 if it exists). If a candidate matches, use it without OCR.
   - Otherwise render page 1 to a canvas at 2× and continue to step 3.
3. **Image preprocess:** decode, scale the longest side to ~2000px, convert to grayscale (reuse the helpers in `imageEdit.js`).
4. **OCR:** a Tesseract `recognize()` produces raw text.
5. **Extract** (`extractCandidates(text, idType)`): apply the type's regex over the text, normalize, and validate (Aadhaar must pass Verhoeff). Return unique candidates ranked by validity. For `other` types, return none.

### UX
- **At upload (images and PDFs):** extraction starts as soon as a file is picked, in parallel with the form. A chip moves through `Reading number…` → `Found 1234 5678 9012 · Use this` / `No number found`.
  - Tapping **Use this** fills the number field. Nothing is saved without that tap.
  - If the record already has a different number, the chip shows `Doesn't match saved number` with the option to replace it.
  - The upload itself never waits on OCR.
- **"Read from image"** button in the ID sheet: runs the pipeline on the record's files (the newest first) and shows the same chip.

## 3. Screens

### Home (`/dashboard`)
- **Sticky search bar.** Matches person name, relationship, ID type, number (digits and letters only, spaces ignored), file label and notes. While searching, the view shows matching ID rows, flattened as `Person · Type · number [⧉]`.
- **Person cards**, the signed-in member first, then family order.
  - Header: avatar, name, relationship, `›` to the person page.
  - ID row: `Type   number   [⧉]`.
    - Tapping the number or ⧉ copies it. The icon changes to ✓ for 1.5s, and a toast reads "Dad's Aadhaar copied".
    - With no number, the row shows `+ Add number` (if the user can edit) or `N files`.
    - Tapping elsewhere on the row opens the ID sheet.
- **Desktop (md+):** a left column lists people (plus "Everyone") and the right column shows the cards. Choosing a person filters to their card.
- The **+ Add** button stays (above the bottom nav on mobile).
- **Removed:** the recently viewed strip, category chips and the starred filter. `useRecentlyViewed` and `useStarred` are deleted if nothing else uses them.

### ID sheet (new component)
- A bottom sheet on mobile and a right-side panel on desktop.
- A large number with **Copy**, **Edit** (inline input with format hint + validation warning) and **Read from image**.
- A grid of large file thumbnails. Tapping one opens the existing `DocumentPreview` (rotate/crop editor unchanged).
- **+ Add file** opens upload with the person and type preset.
- Per-file edit and delete, gated by the existing `canModify` rules.

### Upload
- **From the ID sheet:** only a file/camera picker, the OCR chip and Save.
- **From global + Add:** step 1 person (skipped for non-admins), step 2 ID type as tappable chips (+ "New type"), step 3 file.
- The label defaults to the type name. Notes sit behind a "More" toggle.
- Saving creates the document and, if a number was confirmed, upserts `member_ids`.

### Person page (`/member/:id`)
Uses the same person card, fully expanded with thumbnails, plus "Download all" and the admin actions.

### Unchanged
The Family page, Settings (except the category-delete warning), invites and auth.

### Mobile polish
Modals become bottom sheets, all tap targets are at least 44px, and the search stays sticky under the header.

## 4. Edge cases

| Case | Behavior |
|---|---|
| Clipboard API unavailable / denied | Fall back to a hidden textarea + `execCommand('copy')`. If that fails, show the number selected in a sheet for manual copy. |
| Offline | View and copy work. Edit number / Read from image are disabled with "Needs internet" (unless the OCR assets and file blob are cached, in which case the scan works but saving is still disabled). |
| OCR assets never downloaded + offline | "Scanning needs internet the first time." |
| No candidate found | "Couldn't find a number, type it in." |
| Wrong PDF password | Re-prompt with "Wrong password". Cancel skips extraction. |
| Concurrent edits | Last write wins. |
| Member deleted | Their `member_ids` rows cascade. |

## 5. Testing

- Add **Vitest** (dev dependency, `npm test`).
- Unit tests for the pure logic:
  - Verhoeff checksum
  - `extractCandidates` (against realistic noisy OCR text)
  - ID type detection from category names
  - display/copy formatting
  - grouping documents + `member_ids` into records
  - search matching
- Manual verification in Chrome at a 390px phone width and at desktop width: copy, add/edit number, upload with OCR (image + text PDF + password PDF + scanned PDF), offline copy.
- `npm run build` and `npm run lint` pass.

## 6. Delivery phases

Each phase ships on its own.

1. **Numbers + new home.** Migration `007_member_ids.sql`, `idTypes.js`, `useMemberIds` hook, copy helper, people-first home, ID sheet, simplified upload with manual number entry, category-delete warning, Vitest setup.
2. **Image OCR.** Self-hosted Tesseract, CSP + Workbox changes, auto-scan on image upload, "Read from image".
3. **PDF extraction.** pdf.js text layer, password prompt, render-to-canvas OCR fallback.

## Out of scope
- Extra copyable fields (name on card, DOB, expiry)
- Masking numbers
- OCR languages other than English
- An offline edit queue
- Server-side OCR

## Operational notes
- The user applies migration `007` in Supabase manually.
- The user commits all changes themselves.
