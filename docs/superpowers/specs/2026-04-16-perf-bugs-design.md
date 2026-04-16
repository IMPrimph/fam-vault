# Fam Vault: Bugs + Optimization Pass

**Date:** 2026-04-16
**Scope:** Fix 2 data bugs, add query caching (TanStack Query), signed URL cache, client-side thumbnails, trim over-fetched queries.

---

## 1. Bugs

### Bug 1: Storage quota queries ignore family_id

**Files:** `src/components/StorageWarning.jsx:10-13`, `src/components/UploadForm.jsx:23`

Both query `supabase.from('documents').select('file_size')` with no `.eq()` filter. RLS scopes the result to the caller's family today, but the queries rely entirely on RLS rather than explicit filtering. If RLS policies change or a superuser/service-role query is ever used, this returns cross-family totals.

**Fix:** Add `.eq('family_id', familyId)` via a join through members, or query total via a dedicated RPC. Simplest: join through `members!inner` with a family_id filter:

```js
supabase
  .from('documents')
  .select('file_size, members!inner(family_id)')
  .eq('members.family_id', familyId)
```

This makes intent explicit and survives RLS changes. Both `StorageWarning` and `UploadForm` receive `familyId` as a prop, so the value is already available.

### Bug 2: useAllDocuments missing family_id filter

**File:** `src/hooks/useAllDocuments.js:15-18`

The select uses `members!inner(...)` but never filters `.eq('members.family_id', familyId)`. Same as Bug 1 — works today because RLS scopes it, but the query expresses no family constraint.

**Fix:** Add `.eq('members.family_id', familyId)` to the query.

---

## 2. Signed URL Cache

### Problem

Every `DocumentCard` mount calls `getSignedUrl()` independently (`src/components/DocumentCard.jsx:12-14`). Same for `DocumentPreview.jsx:13`. Navigation between pages discards URLs and re-requests them. With 20 image docs visible, that's 20 parallel `createSignedUrl` calls — each taking 40-100ms.

URLs are valid for 3600s (1 hour), so most re-requests within a session are wasted.

### Design

New module: `src/lib/signedUrlCache.js`

```
Map<filePath, { url: string, expiresAt: number }>
```

- **TTL:** 50 minutes (3000s) — 10-minute safety margin before the 60-minute Supabase expiry.
- **Lookup:** Before calling `supabase.storage.createSignedUrl()`, check cache. Return cached URL if present and not expired.
- **Store:** After a successful `createSignedUrl()`, cache the result.
- **Eviction:** Lazy — check expiry on read, delete expired entries. No background timer.
- **Scope:** Module-level singleton. Survives component unmounts. Cleared on sign-out (wire into `AuthContext.signOut`).
- **Deduplication:** If a request for the same filePath is already in-flight, return the existing Promise instead of firing a duplicate.

### API

```js
export async function getCachedSignedUrl(filePath) → string
export function clearSignedUrlCache() → void
```

All components (`DocumentCard`, `DocumentPreview`, `DashboardPage`, `MemberPage`) call `getCachedSignedUrl` instead of raw `supabase.storage.createSignedUrl`.

The `getSignedUrl` function in hooks (`useDocuments`, `useAllDocuments`) will delegate to `getCachedSignedUrl` internally, so the hook API doesn't change.

---

## 3. TanStack Query (React Query)

### Problem

All 6 hooks (`useDocuments`, `useAllDocuments`, `useMembers`, `useCategories`, `useInvites`, `useFamily`) use manual `useState` + `useEffect` + `fetchX()`. This means:
- No caching between navigations (Dashboard → Member → Dashboard = 2 full fetches of all docs)
- No request deduplication (2 components using `useMembers(familyId)` = 2 parallel fetches)
- Full collection refetch after every single mutation (`await fetchMembers()` after adding one member)
- Manual loading/error state in every hook

### Design

**New dependency:** `@tanstack/react-query` (^5)

**New file:** `src/lib/queryClient.js`

```js
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 min — data treated as fresh
      gcTime: 30 * 60 * 1000,      // 30 min — cache eviction
      retry: 1,
      refetchOnWindowFocus: false,  // family app, not real-time trading
    },
  },
})
```

**Wrap app:** In `src/main.jsx`, wrap `<App />` with `<QueryClientProvider client={queryClient}>`.

### Hook refactors

Each hook refactored to use `useQuery` for reads and `useMutation` + `queryClient.invalidateQueries` for writes. The public API (return shape) stays the same so page components don't change.

**Query keys** (hierarchical for targeted invalidation):

| Hook | Query Key | Invalidation scope |
|---|---|---|
| `useMembers(familyId)` | `['members', familyId]` | On add/update/delete member |
| `useCategories(familyId)` | `['categories', familyId]` | On add/update/delete category |
| `useDocuments(memberId)` | `['documents', memberId]` | On upload/delete doc |
| `useAllDocuments(familyId)` | `['allDocuments', familyId]` | On any doc mutation |
| `useInvites(familyId)` | `['invites', familyId]` | On create/revoke invite |

**`useFamily`** stays as-is — it has no reads, only RPC mutations (`createFamily`, `updateFamilyName`). After `updateFamilyName`, invalidate the member's auth context (already triggers `fetchMember` in `AuthContext`).

### Mutation pattern

```js
const uploadMutation = useMutation({
  mutationFn: (args) => uploadDocumentFn(args),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['documents', memberId] })
    queryClient.invalidateQueries({ queryKey: ['allDocuments'] })
  },
})
```

This replaces the `await fetchDocuments()` pattern. TanStack refetches only the affected queries, and only if they're mounted.

### What stays manual

- `AuthContext` — session management is not a query. Stays as-is.
- `useOnlineStatus` — browser API, not Supabase. Stays as-is.
- `lookupInvite` / `acceptInvite` — one-shot RPCs called during invite flow, not cached data. Stay as plain async functions.

---

## 4. Client-Side Thumbnails

### Problem

Image documents (JPG, PNG) are loaded at full resolution in 112px-tall `DocumentCard` preview areas (`src/components/DocumentCard.jsx:38`). A 3MB Aadhaar scan renders in a thumbnail card. With 20 images, that's potentially 60MB of image data for a grid of tiny previews.

### Design

**New module:** `src/lib/thumbnails.js`

At upload time, for image files only (not PDFs), generate a 448px-wide thumbnail (4x density for 112px cards on retina) using the Canvas API:

```js
export async function generateThumbnail(file, maxWidth = 448) → Blob
```

1. Create an `<img>` from the File blob via `URL.createObjectURL`
2. Draw onto a `<canvas>` scaled to `maxWidth` (preserve aspect ratio)
3. Export as JPEG at quality 0.8
4. Return the Blob

### Upload flow change

In `useDocuments.uploadDocument()`:

1. If `file.type` starts with `image/`, call `generateThumbnail(file)` → get thumbBlob
2. Upload original to `{familyId}/{memberId}/{docId}.{ext}` (unchanged)
3. Upload thumbnail to `{familyId}/{memberId}/{docId}_thumb.jpg`
4. Store `thumb_url` path in documents table? **No** — convention-based: thumbnail path is always `{file_url_without_ext}_thumb.jpg`. No schema change needed.

### Display

- `DocumentCard`: Request signed URL for `{docPath}_thumb.jpg` instead of full file. If thumb doesn't exist (old docs uploaded before this change), fall back to the full-res signed URL.
- `DocumentPreview`: Always loads full-res URL (unchanged).

### Existing documents

Old documents won't have thumbnails. The fallback (load full-res) preserves existing behavior. Optionally, a one-time migration script could generate thumbnails for existing images, but that's out of scope for this pass.

---

## 5. Query Trimming

### useMembers over-fetch

**File:** `src/hooks/useMembers.js:17`

```js
.select('*, documents(id)')
```

The `documents(id)` join fetches every document ID for every member. This is never used in the members list UI — document counts aren't displayed. If document counts are needed later, use a Postgres computed column or RPC.

**Fix:** Change to `.select('*')`.

### useAllDocuments column trim

**File:** `src/hooks/useAllDocuments.js:17`

```js
.select('*, categories(name), members!inner(id, name, relationship, avatar_url)')
```

The `avatar_url` on members is used by the dashboard's member filter chips. This select is fine — no trim needed here.

---

## 6. Files Changed (Summary)

### New files
| File | Purpose |
|---|---|
| `src/lib/queryClient.js` | TanStack Query client configuration |
| `src/lib/signedUrlCache.js` | In-memory signed URL cache with TTL + dedup |
| `src/lib/thumbnails.js` | Canvas-based image thumbnail generator |

### Modified files
| File | Change |
|---|---|
| `package.json` | Add `@tanstack/react-query` |
| `src/main.jsx` | Wrap app in `QueryClientProvider` |
| `src/hooks/useDocuments.js` | Refactor to TanStack Query; add thumbnail upload; use cached signed URLs |
| `src/hooks/useAllDocuments.js` | Refactor to TanStack Query; add family_id filter; use cached signed URLs |
| `src/hooks/useMembers.js` | Refactor to TanStack Query; remove `documents(id)` join |
| `src/hooks/useCategories.js` | Refactor to TanStack Query |
| `src/hooks/useInvites.js` | Refactor `useInvites` to TanStack Query (keep `lookupInvite`/`acceptInvite` as-is) |
| `src/components/StorageWarning.jsx` | Add family_id filter to file_size query |
| `src/components/UploadForm.jsx` | Add family_id filter to file_size query |
| `src/components/DocumentCard.jsx` | Load thumbnail URL; use cached signed URL |
| `src/components/DocumentPreview.jsx` | Use cached signed URL |
| `src/context/AuthContext.jsx` | Clear signed URL cache on sign-out |

### Not changed
| File | Reason |
|---|---|
| `src/hooks/useFamily.js` | No reads to cache; mutations trigger AuthContext refresh |
| `src/hooks/useOnlineStatus.js` | Browser API, not Supabase |
| `src/components/FamilyTree.jsx` | No performance issue |
| Supabase migration | No schema changes (thumbnails use convention-based paths) |
| `vite.config.js` | Service worker config unchanged |

---

## 7. Out of Scope

- React.memo wrapping (marginal at family scale)
- Virtualization (sub-200 documents)
- Code splitting / lazy routes
- Offline mutation queue
- Dark mode, search/OCR, expiry reminders (separate features)
- Thumbnail migration for existing documents
