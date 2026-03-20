# Fam Vault — Family Document Vault

**Date:** 2026-03-20
**Status:** Draft

## Overview

A web app for Indian families to store, organize, and share government IDs and personal documents (Aadhaar, PAN, driving license, etc.) in one place. The admin creates a family tree, uploads documents, and invites family members via unique links. All members can view and download any family member's documents.

Internal family tool — not intended for public release. Security is basic; convenience is prioritized.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | React + Vite + TailwindCSS | Large ecosystem, tree visualization libraries, fast builds |
| Backend/DB | Supabase (PostgreSQL) | Family tree is relational data; PostgreSQL models parent-child relationships natively |
| File Storage | Supabase Storage (1GB free) | More than enough for ~100MB of document scans |
| Auth | Supabase Auth (magic links) | No passwords — family members just enter email and click a link |
| Tree Visualization | React Flow | Mature, supports zoom/pan, touch-friendly for mobile |
| Hosting | Netlify (free tier) | User already familiar with Netlify deployments |

## Data Model

### `families`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| name | text | e.g., "The Sharma Family" |
| created_by | uuid (FK → auth.users) | Admin user |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via trigger |

### `members`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| family_id | uuid (FK → families) | |
| user_id | uuid (FK → auth.users, nullable) | Linked when they accept an invite |
| name | text | Display name |
| relationship | text | Display-only label. Suggested values: "Father", "Mother", "Brother", "Sister", "Son", "Daughter", "Grandfather", "Grandmother", "Uncle", "Aunt", "Cousin", "Spouse". Free text — no validation; the field has no semantic meaning to the app beyond display |
| role | text | "admin" or "member". Seeded as "admin" for the creator. Enables future multi-admin support and simplifies RLS policies |
| parent_member_id | uuid (FK → members, nullable) | Links a child to one parent. The other parent is inferred via `spouse_member_id` on the linked parent. Convention: link to whichever parent was added to the tree first |
| spouse_member_id | uuid (FK → members, nullable) | Links spouses. **Must be bidirectional** — when A.spouse = B, then B.spouse = A. Enforced in application logic on write |
| avatar_url | text (nullable) | Profile picture |
| created_by | uuid (FK → auth.users) | Who added this member |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via trigger |

### `categories`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| family_id | uuid (FK → families) | |
| name | text | e.g., "Aadhaar", "PAN Card", or any custom name |
| created_at | timestamptz | |

**Default categories** (seeded on family creation): Aadhaar, PAN Card, Driving License, Passport, Voter ID

**Permissions:** Both admin and members can create new categories. Only admin can rename or delete categories.

### `documents`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| member_id | uuid (FK → members) | Which family member this belongs to |
| category_id | uuid (FK → categories) | Which category |
| label | text | e.g., "Dad's Aadhaar Front" |
| file_url | text | Supabase Storage path |
| file_type | text | "image/jpeg", "image/png", "application/pdf" |
| file_size | bigint | File size in bytes. Used for display, 5MB upload enforcement, and storage usage tracking |
| notes | text (nullable) | Optional notes |
| uploaded_by | uuid (FK → auth.users) | |
| created_at | timestamptz | |
| updated_at | timestamptz | Auto-updated via trigger |

**Storage path convention:** `/{family_id}/{member_id}/{document_id}.ext`

### `invites`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| family_id | uuid (FK → families) | |
| member_id | uuid (FK → members) | Which member this invite is for |
| token | text (unique) | URL-safe random token |
| email | text (nullable) | Optional — for tracking |
| status | text | "pending", "accepted", or "revoked" |
| expires_at | timestamptz (nullable) | Null = never expires. Admin can set expiry when generating the link. Default: no expiry (family links are long-lived by nature) |
| created_at | timestamptz | |

## Row-Level Security (RLS)

All tables have RLS enabled. Policies use the authenticated user's `auth.uid()` to determine access.

**Constraint:** A user belongs to exactly one family. Enforced via a unique constraint on `members(user_id)` (where user_id is not null).

### Helper function

```sql
-- Returns the family_id for the current user
CREATE FUNCTION get_my_family_id() RETURNS uuid AS $$
  SELECT family_id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns whether the current user is an admin
CREATE FUNCTION is_admin() RETURNS boolean AS $$
  SELECT role = 'admin' FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| families | `id = get_my_family_id()` | Authenticated users (signup flow) | `is_admin()` | None |
| members | `family_id = get_my_family_id()` | `is_admin()` | `is_admin() OR user_id = auth.uid()` (see note below) | `is_admin()` |
| categories | `family_id = get_my_family_id()` | `family_id = get_my_family_id()` (any member) | `is_admin()` | `is_admin()` |
| documents | `member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())` | Own member row OR `is_admin()` | Own uploads OR `is_admin()` | Own uploads OR `is_admin()` |
| invites | `is_admin()` | `is_admin()` | `is_admin()` (for revocation) | None |

**Note on member self-updates:** RLS allows members to update their own row (where `user_id = auth.uid()`), but column-level restriction (only `name` and `avatar_url`) is enforced via **application logic** — the update function only passes those two fields. RLS operates at the row level; column restrictions are not possible in RLS alone.

**Note on invites:** The `/invite/:token` page reads invite data and the invite acceptance flow (linking `user_id` to `members` and updating `invites.status` to "accepted") both run via **`SECURITY DEFINER` RPC functions** that bypass RLS. This is necessary because the accepting user is not yet a linked member when they accept. The RPC functions validate the token, check it is not expired/revoked, and perform the linkage atomically.

## Storage Access

- **Bucket:** Private. Named `documents`.
- **Bucket policy:** Authenticated users can upload to paths matching their family (`/{their_family_id}/**`). All authenticated family members can read from their family's path.
- **Download:** App generates **signed URLs** via `supabase.storage.createSignedUrl()` with a 1-hour expiry. URLs are generated on demand when a user opens a document or clicks download.
- **Upload:** Client uploads directly to Supabase Storage via `supabase.storage.upload()`. File size is validated client-side (5MB max) before upload. Additionally, the bucket is configured with `fileSizeLimit: 5MB` as server-side defense-in-depth.

## Auth & Invite Flow

### Admin Signup

1. Visit the app → sign up with email (magic link, no password)
2. Create a family (enter family name)
3. Automatically becomes admin + first member (role = "admin")

### Inviting Family Members

1. Admin adds members to the family tree (name + relationship)
2. Admin generates an invite link per member
3. Link format: `{app_url}/invite/{token}`
4. Each link is tied to a **specific member node** — the Father link only works for Father
5. When Father clicks the link:
   - Sees: "You've been invited to join [Family Name] as Father"
   - Enters email → gets magic link → logs in
   - Their `auth.users` ID is linked to the existing `members` row (role = "member")
   - Invite status flips to "accepted"

### Permissions

| Role | View all members & docs | Add/edit own docs | Add/edit others' docs | Create categories | Manage tree, invites, categories |
|------|---|---|---|---|---|
| Admin | Yes | Yes | Yes | Yes | Yes |
| Member | Yes | Yes | No | Yes | No |

Role is stored in `members.role`. Admin can promote other members to admin via the settings page.

### Subsequent Logins

Enter email → receive magic link → logged in. No passwords ever.

**Note on Supabase free-tier rate limits:** Magic link emails are limited to ~4 per hour per email address. When onboarding the family, stagger invite sends or inform members to wait a few minutes between login attempts if they don't receive the email immediately.

## Pages

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Landing page — login/signup if not authenticated, redirect to dashboard if authenticated | Public |
| `/dashboard` | Family tree visualization + member grid with quick access | Authenticated |
| `/member/:id` | Member profile — documents grouped by category, preview & download | Authenticated |
| `/member/:id/upload` | Upload document — select/create category, attach file, add notes | Authenticated (own profile or admin) |
| `/settings` | Manage family name, categories, generate/revoke invite links, promote members to admin | Admin only |
| `/invite/:token` | Invite landing — shows family name & role, prompts signup | Public (valid token required) |

## Family Tree Visualization

- **Layout:** Vertical — elders at top, younger generation below
- **Anchor:** Admin is the reference node, visually highlighted
- **Connections:** Vertical lines for parent → child, horizontal lines for spouses
- **Node content:** Avatar (or initials), name, relationship label, document count badge
- **Interaction:**
  - Tap node → navigate to member profile
  - Pinch-to-zoom (mobile), scroll-to-zoom (desktop)
  - Admin sees "+" button on nodes to add connected members
- **Library:** React Flow
- **Scope:** Handles typical Indian family structures — parents, siblings, spouse, children, grandparents, uncles/aunts. Not a full genealogy tool.

## File Storage & Document Management

### Upload

- Select member → pick/create category → attach file
- Input methods: drag & drop, file picker, camera capture (mobile)
- Supported formats: JPG, PNG, PDF
- Max file size: 5MB per document (validated client-side before upload)
- Files stored in Supabase Storage at `/{family_id}/{member_id}/{document_id}.ext`

### Viewing

- Images: Full-screen preview with pinch-to-zoom
- PDFs: Inline browser PDF viewer
- Document card shows: thumbnail, category label, document name, upload date, file size

### Downloading

- Single document: Download button on each card (uses signed URL)
- Bulk: "Download all" on a member profile → client-side zip generation using **JSZip** library. Downloads all files to browser memory, bundles into a zip, and triggers download. Acceptable for the expected data sizes (<50MB per member).

### Organization

- Documents grouped by category on member profile
- Default categories pre-seeded on family creation
- Admin and members can create custom categories (e.g., "Insurance", "Property", "Education Certificates")
- Only admin can rename or delete categories

### Storage Budget

- Supabase free tier: 1GB storage
- Average card scan: ~200KB–1MB
- Capacity: 500+ documents — well beyond a family's needs
- App tracks total storage used (sum of `documents.file_size`) and shows a warning on the dashboard when usage exceeds 800MB

## UI/UX

### Responsive Design

- Mobile-first with full desktop support
- TailwindCSS for responsive utility classes

### Mobile

- Bottom navigation bar: Home (tree), Members (grid list), Upload (goes to member selection → then upload form), Settings
- Swipe-friendly document cards
- Camera integration for card photo capture

### Desktop

- Sidebar navigation
- Larger tree visualization with more visible nodes
- Grid layout for member documents

### Search

- Search bar on dashboard
- **Implementation:** Client-side filtering. On dashboard load, fetch all members and document metadata. Filter in-memory as the user types. Appropriate for the small dataset size (< 100 members, < 1000 documents).
- Search by member name, category name, or document label
- e.g., type "Aadhaar" → shows all family members' Aadhaar cards

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Invite link already accepted | Show message: "This invite has already been used." with a link to login |
| Invite link revoked or expired | Show message: "This invite is no longer valid. Contact your family admin." |
| Email already linked to another member | Prevent linking — show error: "This email is already associated with a family member." |
| Admin deletes a member who has documents | Cascade delete: remove all their documents from DB and storage. **Application must explicitly delete files from Supabase Storage** before deleting DB rows — database cascades do not trigger storage cleanup. Confirm with a dialog first. |
| 1GB storage limit approached | Show warning banner on dashboard at 800MB. Block uploads at 950MB with message to contact admin. |
| Magic link email not received | Show "Didn't receive the email?" with tips: check spam, wait 1 minute, try again. Note the 4/hour rate limit. |
| Admin wants to transfer ownership | Admin promotes another member to admin via settings. Multiple admins are supported. |

## Non-Goals

- End-to-end encryption or advanced security
- Public release or multi-tenancy
- Full genealogy tool (no support for complex extended family beyond 2-3 generations)
- Offline access
- Document OCR or text extraction
- Server-side processing (Edge Functions) — everything runs client-side
