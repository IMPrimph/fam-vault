# Fam Vault Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a family document vault web app where an admin creates a family tree, uploads documents, and invites members via magic links — all on free-tier infrastructure.

**Architecture:** React SPA (Vite + TailwindCSS) deployed on Netlify. Supabase provides PostgreSQL database, file storage, and magic-link auth. React Flow renders the family tree. All logic runs client-side — no server functions.

**Tech Stack:** React 18, Vite, TailwindCSS, Supabase (DB + Auth + Storage), React Flow, React Router v6, JSZip

---

## File Structure

```
fam/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx                    # React root
│   ├── App.jsx                     # Router + providers
│   ├── lib/
│   │   └── supabase.js             # Supabase client init
│   ├── context/
│   │   └── AuthContext.jsx          # Auth state provider + useAuth hook
│   ├── hooks/
│   │   ├── useFamily.js            # Family CRUD + current family state
│   │   ├── useMembers.js           # Members CRUD
│   │   ├── useDocuments.js         # Document CRUD + storage operations
│   │   ├── useCategories.js        # Category CRUD
│   │   └── useInvites.js           # Invite generation + management
│   ├── components/
│   │   ├── Layout.jsx              # Responsive shell: sidebar (desktop) + bottom nav (mobile)
│   │   ├── AuthGuard.jsx           # Redirects unauthenticated users to /
│   │   ├── AdminGuard.jsx          # Redirects non-admin users to /dashboard
│   │   ├── LoginForm.jsx           # Email input + magic link trigger
│   │   ├── CreateFamily.jsx        # Family name form (post-signup)
│   │   ├── FamilyTree.jsx          # React Flow tree wrapper + layout logic
│   │   ├── MemberNode.jsx          # Individual tree node (avatar, name, relationship, doc count)
│   │   ├── MemberCard.jsx          # Grid card for a member
│   │   ├── MemberGrid.jsx          # Grid of MemberCards
│   │   ├── AddMemberForm.jsx       # Modal form: name, relationship, parent/spouse links
│   │   ├── DocumentCard.jsx        # Single document thumbnail + actions
│   │   ├── DocumentGrid.jsx        # Documents grouped by category
│   │   ├── DocumentPreview.jsx     # Full-screen image/PDF viewer
│   │   ├── UploadForm.jsx          # File picker + category select + notes
│   │   ├── SearchBar.jsx           # Client-side search with results dropdown
│   │   ├── InviteManager.jsx       # Generate/copy/revoke invite links
│   │   └── StorageWarning.jsx      # Banner when storage > 800MB
│   ├── pages/
│   │   ├── LandingPage.jsx         # Public: hero + login form
│   │   ├── DashboardPage.jsx       # Tree + member grid + search
│   │   ├── MemberPage.jsx          # Member profile + documents
│   │   ├── UploadPage.jsx          # Upload form for a specific member
│   │   ├── SettingsPage.jsx        # Admin: family name, categories, invites, roles
│   │   └── InvitePage.jsx          # Public: invite acceptance
│   └── utils/
│       ├── format.js               # formatFileSize, formatDate helpers
│       └── treeLayout.js           # Convert members array → React Flow nodes/edges
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Full schema + RLS + RPC functions
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
├── .env.example
└── .env.local                      # (gitignored) VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
```

---

**Important:** Task 15 (Supabase project setup) must be completed before testing Tasks 3-4. Create the Supabase project and populate `.env.local` with credentials before testing auth flows.

---

## Chunk 1: Foundation — Project Setup, Database, Auth

### Task 1: Scaffold Vite + React project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`
- Create: `.env.example`, `.gitignore`, `netlify.toml`

- [ ] **Step 1: Initialize Vite project**

```bash
cd /Users/primph/Documents/fam
npm create vite@latest . -- --template react
```

Select React + JavaScript when prompted. If files already exist (docs/), Vite will scaffold around them.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js react-router-dom @xyflow/react jszip file-saver
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Configure TailwindCSS**

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

Update `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

- [ ] **Step 4: Create environment files**

`.env.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Add to `.gitignore`:
```
.env.local
.env
```

- [ ] **Step 5: Create Netlify config**

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The redirect rule ensures client-side routing works.

- [ ] **Step 6: Create Supabase client**

`src/lib/supabase.js`:
```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server running on localhost, default React page loads.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold vite + react + tailwind project"
```

---

### Task 2: Database schema + RLS + RPC functions

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

This is the SQL migration that sets up everything in Supabase. It will be run manually via the Supabase SQL editor (no CLI needed for a single migration).

- [ ] **Step 1: Write the full migration**

`supabase/migrations/001_initial_schema.sql`:

```sql
-- ============================================
-- Fam Vault: Initial Schema
-- ============================================

-- === updated_at trigger function ===
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- === families ===
CREATE TABLE families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER families_updated_at
  BEFORE UPDATE ON families
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === members ===
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  name text NOT NULL,
  relationship text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  parent_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  spouse_member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  avatar_url text,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Partial unique index: one user_id per family (nulls excluded)
CREATE UNIQUE INDEX members_user_id_unique ON members (user_id) WHERE user_id IS NOT NULL;

-- === categories ===
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- === documents ===
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  label text NOT NULL,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  notes text,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- === invites ===
CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  token text UNIQUE NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- RLS Helper Functions
-- ============================================

CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS uuid AS $$
  SELECT family_id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM members WHERE user_id = auth.uid() LIMIT 1),
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- --- families ---
CREATE POLICY "families_select" ON families FOR SELECT USING (id = get_my_family_id());
CREATE POLICY "families_insert" ON families FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "families_update" ON families FOR UPDATE USING (is_admin());

-- --- members ---
CREATE POLICY "members_select" ON members FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "members_insert" ON members FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "members_update" ON members FOR UPDATE USING (
  is_admin() OR user_id = auth.uid()
);
CREATE POLICY "members_delete" ON members FOR DELETE USING (is_admin());

-- --- categories ---
CREATE POLICY "categories_select" ON categories FOR SELECT USING (family_id = get_my_family_id());
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (family_id = get_my_family_id());
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (is_admin());
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (is_admin());

-- --- documents ---
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
  member_id IN (SELECT id FROM members WHERE family_id = get_my_family_id())
);
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (
  is_admin() OR member_id = (SELECT id FROM members WHERE user_id = auth.uid())
);
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (
  is_admin() OR uploaded_by = auth.uid()
);
CREATE POLICY "documents_delete" ON documents FOR DELETE USING (
  is_admin() OR uploaded_by = auth.uid()
);

-- --- invites ---
CREATE POLICY "invites_select" ON invites FOR SELECT USING (is_admin());
CREATE POLICY "invites_insert" ON invites FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "invites_update" ON invites FOR UPDATE USING (is_admin());

-- ============================================
-- RPC Functions (SECURITY DEFINER — bypass RLS)
-- ============================================

-- Lookup invite by token (public-facing, returns minimal info)
CREATE OR REPLACE FUNCTION lookup_invite(invite_token text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'family_name', f.name,
    'member_name', m.name,
    'relationship', m.relationship,
    'status', i.status,
    'expires_at', i.expires_at
  ) INTO result
  FROM invites i
  JOIN members m ON m.id = i.member_id
  JOIN families f ON f.id = i.family_id
  WHERE i.token = invite_token;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Accept invite: links user_id to member, flips invite status
CREATE OR REPLACE FUNCTION accept_invite(invite_token text)
RETURNS json AS $$
DECLARE
  inv record;
  result json;
BEGIN
  -- Fetch and lock the invite
  SELECT * INTO inv FROM invites WHERE token = invite_token FOR UPDATE;

  IF inv IS NULL THEN
    RETURN json_build_object('error', 'Invite not found');
  END IF;

  IF inv.status != 'pending' THEN
    RETURN json_build_object('error', 'Invite is no longer valid');
  END IF;

  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN
    RETURN json_build_object('error', 'Invite has expired');
  END IF;

  -- Check user isn't already linked to a member
  IF EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'You are already a member of a family');
  END IF;

  -- Link the user to the member
  UPDATE members SET user_id = auth.uid() WHERE id = inv.member_id;

  -- Mark invite as accepted
  UPDATE invites SET status = 'accepted' WHERE id = inv.id;

  SELECT json_build_object(
    'success', true,
    'family_id', inv.family_id,
    'member_id', inv.member_id
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create family + admin member in one atomic operation (post-signup)
CREATE OR REPLACE FUNCTION create_family_with_admin(family_name text, admin_name text)
RETURNS json AS $$
DECLARE
  new_family_id uuid;
  new_member_id uuid;
  default_categories text[] := ARRAY['Aadhaar', 'PAN Card', 'Driving License', 'Passport', 'Voter ID'];
  cat text;
BEGIN
  -- Check user doesn't already belong to a family
  IF EXISTS (SELECT 1 FROM members WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('error', 'You already belong to a family');
  END IF;

  -- Create family
  INSERT INTO families (name, created_by)
  VALUES (family_name, auth.uid())
  RETURNING id INTO new_family_id;

  -- Create admin member
  INSERT INTO members (family_id, user_id, name, relationship, role, created_by)
  VALUES (new_family_id, auth.uid(), admin_name, 'Self', 'admin', auth.uid())
  RETURNING id INTO new_member_id;

  -- Seed default categories
  FOREACH cat IN ARRAY default_categories LOOP
    INSERT INTO categories (family_id, name) VALUES (new_family_id, cat);
  END LOOP;

  RETURN json_build_object(
    'family_id', new_family_id,
    'member_id', new_member_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Storage bucket (run in Supabase dashboard > Storage)
-- ============================================
-- Create a private bucket named "documents" with fileSizeLimit: 5242880 (5MB)
-- Storage policies:
--   SELECT: authenticated, path starts with user's family_id
--   INSERT: authenticated, path starts with user's family_id
--   DELETE: authenticated, path starts with user's family_id
```

- [ ] **Step 2: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema, RLS policies, and RPC functions"
```

---

### Task 3: Auth context + Login flow

**Files:**
- Create: `src/context/AuthContext.jsx`
- Create: `src/components/LoginForm.jsx`
- Create: `src/components/AuthGuard.jsx`
- Create: `src/components/AdminGuard.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create AuthContext**

`src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchMember(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchMember(session.user.id)
      else {
        setMember(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchMember(userId) {
    const uid = userId || session?.user?.id
    if (!uid) { setLoading(false); return }
    const { data } = await supabase
      .from('members')
      .select('*, families(name)')
      .eq('user_id', uid)
      .single()
    setMember(data)
    setLoading(false)
  }

  async function signInWithEmail(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/dashboard' }
    })
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null)
    setMember(null)
  }

  const isAdmin = member?.role === 'admin'

  return (
    <AuthContext.Provider value={{ session, member, loading, isAdmin, signInWithEmail, signOut, fetchMember }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Create LoginForm**

`src/components/LoginForm.jsx`:

```jsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function LoginForm() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signInWithEmail(email)
    setLoading(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) {
    return (
      <div className="text-center p-6">
        <h2 className="text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-gray-600">We sent a magic link to <strong>{email}</strong></p>
        <p className="text-sm text-gray-400 mt-4">
          Didn't receive it? Check spam, wait a minute, then try again. Limit: 4 emails/hour.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {loading ? 'Sending...' : 'Send Magic Link'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create AuthGuard and AdminGuard**

`src/components/AuthGuard.jsx`:

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AuthGuard({ children }) {
  const { session, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>

  if (!session) return <Navigate to="/" replace />

  return children
}
```

`src/components/AdminGuard.jsx`:

```jsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminGuard({ children }) {
  const { isAdmin, loading } = useAuth()

  if (loading) return null
  if (!isAdmin) return <Navigate to="/dashboard" replace />

  return children
}
```

- [ ] **Step 4: Set up App with routing**

`src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import AdminGuard from './components/AdminGuard'
import Layout from './components/Layout'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import MemberPage from './pages/MemberPage'
import UploadPage from './pages/UploadPage'
import SettingsPage from './pages/SettingsPage'
import InvitePage from './pages/InvitePage'

function AppRoutes() {
  const { session, member, loading } = useAuth()

  if (loading) return <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<AuthGuard><Layout /></AuthGuard>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/member/:id" element={<MemberPage />} />
        <Route path="/member/:id/upload" element={<UploadPage />} />
        <Route path="/settings" element={<AdminGuard><SettingsPage /></AdminGuard>} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Create placeholder pages**

Create stub pages so the app compiles. Each file exports a simple component:

`src/pages/LandingPage.jsx`:
```jsx
import LoginForm from '../components/LoginForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Fam Vault</h1>
        <p className="text-gray-600">Your family's documents, in one place.</p>
      </div>
      <LoginForm />
    </div>
  )
}
```

`src/pages/DashboardPage.jsx`:
```jsx
export default function DashboardPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Dashboard</h1></div>
}
```

`src/pages/MemberPage.jsx`:
```jsx
export default function MemberPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Member</h1></div>
}
```

`src/pages/UploadPage.jsx`:
```jsx
export default function UploadPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Upload</h1></div>
}
```

`src/pages/SettingsPage.jsx`:
```jsx
export default function SettingsPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Settings</h1></div>
}
```

`src/pages/InvitePage.jsx`:
```jsx
export default function InvitePage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Invite</h1></div>
}
```

- [ ] **Step 6: Create Layout component (placeholder)**

`src/components/Layout.jsx`:
```jsx
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Outlet />
    </div>
  )
}
```

- [ ] **Step 7: Update main.jsx**

`src/main.jsx`:
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 8: Verify app compiles and routes work**

```bash
npm run dev
```

Expected: Landing page shows at `/`, login form visible. Other routes redirect to `/`.

- [ ] **Step 9: Commit**

```bash
git add src/
git commit -m "feat: add auth context, login form, routing, and page stubs"
```

---

### Task 4: Create Family flow (post-signup)

**Files:**
- Create: `src/components/CreateFamily.jsx`
- Create: `src/hooks/useFamily.js`
- Modify: `src/App.jsx` — add create-family gate

- [ ] **Step 1: Create useFamily hook**

`src/hooks/useFamily.js`:

```js
import { supabase } from '../lib/supabase'

export function useFamily() {
  async function createFamily(familyName, adminName) {
    const { data, error } = await supabase.rpc('create_family_with_admin', {
      family_name: familyName,
      admin_name: adminName,
    })
    if (error) throw error
    if (data?.error) throw new Error(data.error)
    return data
  }

  async function updateFamilyName(familyId, name) {
    const { error } = await supabase
      .from('families')
      .update({ name })
      .eq('id', familyId)
    if (error) throw error
  }

  return { createFamily, updateFamilyName }
}
```

- [ ] **Step 2: Create CreateFamily component**

`src/components/CreateFamily.jsx`:

```jsx
import { useState } from 'react'
import { useFamily } from '../hooks/useFamily'
import { useAuth } from '../context/AuthContext'

export default function CreateFamily() {
  const { createFamily } = useFamily()
  const { fetchMember } = useAuth()
  const [familyName, setFamilyName] = useState('')
  const [yourName, setYourName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await createFamily(familyName, yourName)
      await fetchMember()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 bg-white p-8 rounded-xl shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Create Your Family</h1>
          <p className="text-gray-600 mt-1">Set up your family vault to get started.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Family Name</label>
          <input
            type="text"
            required
            value={familyName}
            onChange={e => setFamilyName(e.target.value)}
            placeholder='e.g., "The Sharma Family"'
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
          <input
            type="text"
            required
            value={yourName}
            onChange={e => setYourName(e.target.value)}
            placeholder="Your display name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Creating...' : 'Create Family'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Add create-family gate to App**

In `src/App.jsx`, update `AppRoutes` to check if user has a member record. If logged in but no member (no family yet), show CreateFamily:

```jsx
// Inside AppRoutes, before the Routes return:
if (session && !loading && !member) {
  return <CreateFamily />
}
```

Add import: `import CreateFamily from './components/CreateFamily'`

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: add family creation flow with RPC"
```

---

## Chunk 2: Layout, Members, and Family Tree

### Task 5: Responsive Layout (sidebar + bottom nav)

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Build responsive Layout**

`src/components/Layout.jsx`:

```jsx
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Home', icon: '🏠' },
  { to: '/settings', label: 'Settings', icon: '⚙️', adminOnly: true },
]

function NavItem({ to, label, icon, mobile }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          isActive
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-600 hover:bg-gray-100'
        } ${mobile ? 'flex-col text-xs gap-1' : ''}`
      }
    >
      <span className={mobile ? 'text-lg' : ''}>{icon}</span>
      <span>{label}</span>
    </NavLink>
  )
}

export default function Layout() {
  const { member, isAdmin, signOut } = useAuth()
  const familyName = member?.families?.name || 'Fam Vault'

  const visibleNav = navItems.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-56 bg-white border-r border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h1 className="font-bold text-lg text-gray-900">{familyName}</h1>
          <p className="text-sm text-gray-500">{member?.name}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-56 pb-20 md:pb-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <h1 className="font-bold text-lg text-gray-900">{familyName}</h1>
          <button onClick={signOut} className="text-sm text-gray-600">Sign out</button>
        </header>
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex justify-around py-2 px-4">
        {visibleNav.map(item => (
          <NavItem key={item.to} {...item} mobile />
        ))}
      </nav>
    </div>
  )
}
```

- [ ] **Step 2: Verify layout renders**

```bash
npm run dev
```

Expected: Desktop shows sidebar, mobile (resize browser) shows bottom nav + top header.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "feat: add responsive layout with sidebar and bottom nav"
```

---

### Task 6: Members CRUD hook + Add Member form

**Files:**
- Create: `src/hooks/useMembers.js`
- Create: `src/components/AddMemberForm.jsx`

- [ ] **Step 1: Create useMembers hook**

`src/hooks/useMembers.js`:

```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useMembers(familyId) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchMembers()
  }, [familyId])

  async function fetchMembers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('members')
      .select('*, documents(id)')
      .eq('family_id', familyId)
      .order('created_at')
    if (!error) setMembers(data || [])
    setLoading(false)
  }

  async function addMember({ name, relationship, parentMemberId, spouseMemberId }) {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('members')
      .insert({
        family_id: familyId,
        name,
        relationship,
        parent_member_id: parentMemberId || null,
        spouse_member_id: spouseMemberId || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) throw error

    // If spouse was set, enforce bidirectional link
    if (spouseMemberId) {
      await supabase
        .from('members')
        .update({ spouse_member_id: data.id })
        .eq('id', spouseMemberId)
    }

    await fetchMembers()
    return data
  }

  async function updateMember(id, updates) {
    const { error } = await supabase
      .from('members')
      .update(updates)
      .eq('id', id)
    if (error) throw error
    await fetchMembers()
  }

  async function deleteMember(id) {
    // First delete storage files for this member's documents
    const { data: docs } = await supabase
      .from('documents')
      .select('file_url')
      .eq('member_id', id)

    if (docs?.length) {
      const paths = docs.map(d => d.file_url)
      await supabase.storage.from('documents').remove(paths)
    }

    // Clear spouse back-reference
    const member = members.find(m => m.id === id)
    if (member?.spouse_member_id) {
      await supabase
        .from('members')
        .update({ spouse_member_id: null })
        .eq('id', member.spouse_member_id)
    }

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchMembers()
  }

  return { members, loading, addMember, updateMember, deleteMember, refetch: fetchMembers }
}
```

- [ ] **Step 2: Create AddMemberForm**

`src/components/AddMemberForm.jsx`:

```jsx
import { useState } from 'react'

const RELATIONSHIP_SUGGESTIONS = [
  'Father', 'Mother', 'Brother', 'Sister', 'Son', 'Daughter',
  'Grandfather', 'Grandmother', 'Uncle', 'Aunt', 'Cousin', 'Spouse',
]

export default function AddMemberForm({ members, onSubmit, onClose }) {
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [parentMemberId, setParentMemberId] = useState('')
  const [spouseMemberId, setSpouseMemberId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await onSubmit({ name, relationship, parentMemberId, spouseMemberId })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Add Family Member</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text" required value={name} onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relationship</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {RELATIONSHIP_SUGGESTIONS.map(r => (
              <button
                key={r} type="button"
                onClick={() => setRelationship(r)}
                className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                  relationship === r ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="text" required value={relationship} onChange={e => setRelationship(e.target.value)}
            placeholder="Or type a custom relationship"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Parent (optional)</label>
          <select
            value={parentMemberId} onChange={e => setParentMemberId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">None</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Spouse (optional)</label>
          <select
            value={spouseMemberId} onChange={e => setSpouseMemberId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">None</option>
            {members.filter(m => !m.spouse_member_id).map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Adding...' : 'Add Member'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMembers.js src/components/AddMemberForm.jsx
git commit -m "feat: add members CRUD hook and add-member form"
```

---

### Task 7: Family tree visualization

**Files:**
- Create: `src/utils/treeLayout.js`
- Create: `src/components/FamilyTree.jsx`
- Create: `src/components/MemberNode.jsx`

- [ ] **Step 1: Create tree layout utility**

`src/utils/treeLayout.js`:

```js
const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const H_GAP = 60
const V_GAP = 120

export function buildTreeLayout(members) {
  if (!members.length) return { nodes: [], edges: [] }

  const byId = Object.fromEntries(members.map(m => [m.id, m]))
  const nodes = []
  const edges = []

  // Group by generation: find roots (no parent), then BFS down
  const roots = members.filter(m => !m.parent_member_id)
  const visited = new Set()
  const generations = [] // array of arrays

  let currentGen = roots.map(m => m.id)
  while (currentGen.length) {
    generations.push(currentGen)
    currentGen.forEach(id => visited.add(id))
    const nextGen = []
    for (const id of currentGen) {
      // Find children
      const children = members.filter(m => m.parent_member_id === id && !visited.has(m.id))
      // Also check if spouse's children
      const member = byId[id]
      if (member?.spouse_member_id) {
        const spouseChildren = members.filter(
          m => m.parent_member_id === member.spouse_member_id && !visited.has(m.id)
        )
        children.push(...spouseChildren)
      }
      children.forEach(c => {
        if (!visited.has(c.id)) nextGen.push(c.id)
      })
    }
    currentGen = [...new Set(nextGen)]
  }

  // Add unvisited members (orphans) to last generation
  const orphans = members.filter(m => !visited.has(m.id)).map(m => m.id)
  if (orphans.length) generations.push(orphans)

  // Position nodes
  let y = 0
  for (const gen of generations) {
    // Pair spouses together
    const placed = new Set()
    const units = [] // each unit is [member] or [member, spouse]

    for (const id of gen) {
      if (placed.has(id)) continue
      placed.add(id)
      const member = byId[id]
      if (member?.spouse_member_id && gen.includes(member.spouse_member_id) && !placed.has(member.spouse_member_id)) {
        placed.add(member.spouse_member_id)
        units.push([id, member.spouse_member_id])
      } else {
        units.push([id])
      }
    }

    // Calculate total width for centering
    let totalWidth = 0
    for (const unit of units) {
      totalWidth += unit.length * NODE_WIDTH + (unit.length - 1) * 20
    }
    totalWidth += (units.length - 1) * H_GAP

    let x = -totalWidth / 2
    for (const unit of units) {
      for (let i = 0; i < unit.length; i++) {
        const m = byId[unit[i]]
        nodes.push({
          id: m.id,
          type: 'memberNode',
          position: { x, y },
          data: { member: m, docCount: m.documents?.length || 0 },
        })

        // Spouse edge
        if (i === 1) {
          edges.push({
            id: `spouse-${unit[0]}-${unit[1]}`,
            source: unit[0],
            target: unit[1],
            type: 'straight',
            style: { stroke: '#f59e0b', strokeDasharray: '5,5' },
          })
        }

        x += NODE_WIDTH + 20
      }
      x += H_GAP
    }

    y += NODE_HEIGHT + V_GAP
  }

  // Parent-child edges
  for (const m of members) {
    if (m.parent_member_id && byId[m.parent_member_id]) {
      edges.push({
        id: `parent-${m.parent_member_id}-${m.id}`,
        source: m.parent_member_id,
        target: m.id,
        type: 'smoothstep',
        style: { stroke: '#6b7280' },
      })
    }
  }

  return { nodes, edges }
}
```

- [ ] **Step 2: Create MemberNode component**

`src/components/MemberNode.jsx`:

```jsx
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'

function MemberNode({ data }) {
  const { member, docCount } = data
  const navigate = useNavigate()
  const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div
      onClick={() => navigate(`/member/${member.id}`)}
      className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all w-44"
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-300 !w-2 !h-2" />
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold shrink-0">
          {member.avatar_url
            ? <img src={member.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
            : initials
          }
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm truncate">{member.name}</p>
          <p className="text-xs text-gray-500 truncate">{member.relationship}</p>
        </div>
      </div>
      {docCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {docCount}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-gray-300 !w-2 !h-2" />
    </div>
  )
}

export default memo(MemberNode)
```

- [ ] **Step 3: Create FamilyTree wrapper**

`src/components/FamilyTree.jsx`:

```jsx
import { useMemo, useEffect } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MemberNode from './MemberNode'
import { buildTreeLayout } from '../utils/treeLayout'

const nodeTypes = { memberNode: MemberNode }

export default function FamilyTree({ members }) {
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildTreeLayout(members),
    [members]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  // Update when members change
  useEffect(() => {
    setNodes(layoutNodes)
    setEdges(layoutEdges)
  }, [layoutNodes, layoutEdges])

  return (
    <div className="w-full h-96 md:h-[500px] bg-gray-50 rounded-xl border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/treeLayout.js src/components/FamilyTree.jsx src/components/MemberNode.jsx
git commit -m "feat: add family tree visualization with React Flow"
```

---

### Task 8: Dashboard page (tree + member grid + search)

**Files:**
- Create: `src/components/MemberCard.jsx`
- Create: `src/components/MemberGrid.jsx`
- Create: `src/components/SearchBar.jsx`
- Modify: `src/pages/DashboardPage.jsx`

- [ ] **Step 1: Create MemberCard**

`src/components/MemberCard.jsx`:

```jsx
import { useNavigate } from 'react-router-dom'

export default function MemberCard({ member }) {
  const navigate = useNavigate()
  const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const docCount = member.documents?.length || 0

  return (
    <div
      onClick={() => navigate(`/member/${member.id}`)}
      className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold shrink-0">
          {member.avatar_url
            ? <img src={member.avatar_url} className="w-12 h-12 rounded-full object-cover" alt="" />
            : initials
          }
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">{member.name}</p>
          <p className="text-sm text-gray-500">{member.relationship}</p>
          <p className="text-xs text-gray-400">{docCount} document{docCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create MemberGrid**

`src/components/MemberGrid.jsx`:

```jsx
import MemberCard from './MemberCard'

export default function MemberGrid({ members }) {
  if (!members.length) {
    return <p className="text-gray-500 text-center py-8">No family members yet. Add someone to get started.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {members.map(m => <MemberCard key={m.id} member={m} />)}
    </div>
  )
}
```

- [ ] **Step 3: Create SearchBar**

`src/components/SearchBar.jsx`:

```jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SearchBar({ members, documents }) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const matched = []

    // Search members
    for (const m of members) {
      if (m.name.toLowerCase().includes(q) || m.relationship.toLowerCase().includes(q)) {
        matched.push({ type: 'member', id: m.id, label: m.name, sub: m.relationship })
      }
    }

    // Search documents
    for (const d of (documents || [])) {
      if (d.label.toLowerCase().includes(q) || d.category_name?.toLowerCase().includes(q)) {
        matched.push({ type: 'document', id: d.member_id, label: d.label, sub: d.category_name })
      }
    }

    return matched.slice(0, 10)
  }, [query, members, documents])

  return (
    <div className="relative w-full max-w-md">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search members, documents, categories..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-auto">
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}-${i}`}
              onClick={() => { navigate(`/member/${r.id}`); setQuery('') }}
              className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <p className="text-sm font-medium text-gray-900">{r.label}</p>
              <p className="text-xs text-gray-500">{r.sub} &middot; {r.type}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build DashboardPage**

`src/pages/DashboardPage.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { supabase } from '../lib/supabase'
import FamilyTree from '../components/FamilyTree'
import MemberGrid from '../components/MemberGrid'
import SearchBar from '../components/SearchBar'
import AddMemberForm from '../components/AddMemberForm'
import StorageWarning from '../components/StorageWarning'

export default function DashboardPage() {
  const { member, isAdmin } = useAuth()
  const { members, loading, addMember } = useMembers(member?.family_id)
  const [showAddForm, setShowAddForm] = useState(false)
  const [allDocs, setAllDocs] = useState([])

  // Fetch all document metadata for search
  useEffect(() => {
    if (!member?.family_id) return
    supabase
      .from('documents')
      .select('id, label, member_id, categories(name)')
      .then(({ data }) => {
        setAllDocs((data || []).map(d => ({ ...d, category_name: d.categories?.name })))
      })
  }, [member?.family_id])

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>

  return (
    <div className="p-4 md:p-6 space-y-6">
      <StorageWarning familyId={member?.family_id} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Family</h1>
        <SearchBar members={members} documents={allDocs} />
      </div>

      {/* Family Tree */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Family Tree</h2>
        <FamilyTree members={members} />
      </section>

      {/* Members Grid */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Members</h2>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              + Add Member
            </button>
          )}
        </div>
        <MemberGrid members={members} />
      </section>

      {showAddForm && (
        <AddMemberForm
          members={members}
          onSubmit={addMember}
          onClose={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/MemberCard.jsx src/components/MemberGrid.jsx src/components/SearchBar.jsx src/pages/DashboardPage.jsx
git commit -m "feat: build dashboard with tree, member grid, and search"
```

---

## Chunk 3: Documents & Storage

### Task 9: Categories hook + Document hooks

**Files:**
- Create: `src/hooks/useCategories.js`
- Create: `src/hooks/useDocuments.js`
- Create: `src/utils/format.js`

- [ ] **Step 1: Create useCategories hook**

`src/hooks/useCategories.js`:

```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCategories(familyId) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchCategories()
  }, [familyId])

  async function fetchCategories() {
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('family_id', familyId)
      .order('name')
    if (!error) setCategories(data || [])
    setLoading(false)
  }

  async function addCategory(name) {
    const { data, error } = await supabase
      .from('categories')
      .insert({ family_id: familyId, name })
      .select()
      .single()
    if (error) throw error
    await fetchCategories()
    return data
  }

  async function updateCategory(id, name) {
    const { error } = await supabase
      .from('categories')
      .update({ name })
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
  }

  async function deleteCategory(id) {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
  }

  return { categories, loading, addCategory, updateCategory, deleteCategory, refetch: fetchCategories }
}
```

- [ ] **Step 2: Create useDocuments hook**

`src/hooks/useDocuments.js`:

```js
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useDocuments(memberId) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!memberId) return
    fetchDocuments()
  }, [memberId])

  async function fetchDocuments() {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*, categories(name)')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
    if (!error) setDocuments(data || [])
    setLoading(false)
  }

  async function uploadDocument({ memberId, categoryId, label, file, notes, familyId }) {
    const { data: { user } } = await supabase.auth.getUser()
    const fileExt = file.name.split('.').pop()
    const docId = crypto.randomUUID()
    const filePath = `${familyId}/${memberId}/${docId}.${fileExt}`

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { contentType: file.type })
    if (uploadError) throw uploadError

    // Create DB record
    const { data, error } = await supabase
      .from('documents')
      .insert({
        member_id: memberId,
        category_id: categoryId,
        label,
        file_url: filePath,
        file_type: file.type,
        file_size: file.size,
        notes: notes || null,
        uploaded_by: user.id,
      })
      .select('*, categories(name)')
      .single()

    if (error) throw error
    await fetchDocuments()
    return data
  }

  async function deleteDocument(doc) {
    // Delete from storage first
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.file_url])
    if (storageError) throw storageError

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', doc.id)
    if (error) throw error
    await fetchDocuments()
  }

  async function getSignedUrl(filePath) {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600) // 1 hour
    if (error) throw error
    return data.signedUrl
  }

  return { documents, loading, uploadDocument, deleteDocument, getSignedUrl, refetch: fetchDocuments }
}
```

- [ ] **Step 3: Create format utils**

`src/utils/format.js`:

```js
export function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCategories.js src/hooks/useDocuments.js src/utils/format.js
git commit -m "feat: add categories and documents hooks with storage operations"
```

---

### Task 10: Upload page

**Files:**
- Create: `src/components/UploadForm.jsx`
- Modify: `src/pages/UploadPage.jsx`

- [ ] **Step 1: Create UploadForm**

`src/components/UploadForm.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react'
import { useCategories } from '../hooks/useCategories'
import { supabase } from '../lib/supabase'
import { formatFileSize } from '../utils/format'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const STORAGE_BLOCK_BYTES = 950 * 1024 * 1024 // 950MB

export default function UploadForm({ familyId, memberId, onUpload }) {
  const { categories, addCategory } = useCategories(familyId)
  const [categoryId, setCategoryId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [label, setLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [storageBlocked, setStorageBlocked] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  // Check storage usage on mount
  useEffect(() => {
    supabase.from('documents').select('file_size').then(({ data }) => {
      const total = (data || []).reduce((sum, d) => sum + (d.file_size || 0), 0)
      if (total >= STORAGE_BLOCK_BYTES) setStorageBlocked(true)
    })
  }, [])

  function validateAndSetFile(f) {
    if (!f) return
    if (f.size > MAX_FILE_SIZE) {
      setError(`File too large (${formatFileSize(f.size)}). Max is 5MB.`)
      return
    }
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(f.type)) {
      setError('Only JPG, PNG, and PDF files are supported.')
      return
    }
    setError('')
    setFile(f)
    if (!label) setLabel(f.name.replace(/\.[^.]+$/, ''))
  }

  function handleFileChange(e) { validateAndSetFile(e.target.files?.[0]) }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    validateAndSetFile(e.dataTransfer.files?.[0])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (storageBlocked) { setError('Storage limit reached. Contact your family admin.'); return }
    setLoading(true)
    setError('')
    try {
      let catId = categoryId
      if (newCategory.trim()) {
        const cat = await addCategory(newCategory.trim())
        catId = cat.id
      }
      if (!catId) throw new Error('Please select or create a category')
      await onUpload({ memberId, categoryId: catId, label, file, notes, familyId })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (storageBlocked) {
    return (
      <div className="bg-red-50 rounded-lg p-6 text-center">
        <p className="text-red-700 font-medium">Storage limit reached (950MB+)</p>
        <p className="text-red-600 text-sm mt-1">Delete some documents to free space before uploading.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* File input with drag & drop + camera */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Document File</label>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          {file ? (
            <div>
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-500">Click to select, drag & drop, or use camera</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, or PDF (max 5MB)</p>
            </div>
          )}
        </div>
        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={handleFileChange} className="hidden" />
        {/* Camera capture button (visible on mobile via media query) */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="mt-2 text-sm text-gray-600 md:hidden"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); setNewCategory('') }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        >
          <option value="">Select a category...</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="mt-2">
          <input
            type="text"
            value={newCategory}
            onChange={e => { setNewCategory(e.target.value); setCategoryId('') }}
            placeholder="Or create a new category..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
        <input
          type="text" required value={label} onChange={e => setLabel(e.target.value)}
          placeholder='e.g., "Dad\'s Aadhaar Front"'
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading || !file}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        {loading ? 'Uploading...' : 'Upload Document'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Build UploadPage**

`src/pages/UploadPage.jsx`:

```jsx
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDocuments } from '../hooks/useDocuments'
import { useMembers } from '../hooks/useMembers'
import UploadForm from '../components/UploadForm'

export default function UploadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const { members } = useMembers(authMember?.family_id)
  const { uploadDocument } = useDocuments(id)

  const targetMember = members.find(m => m.id === id)
  const canUpload = isAdmin || targetMember?.user_id === authMember?.user_id

  if (!canUpload) {
    return <div className="p-6 text-red-500">You can only upload documents for your own profile.</div>
  }

  async function handleUpload(data) {
    await uploadDocument(data)
    navigate(`/member/${id}`)
  }

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline mb-4">&larr; Back</button>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Upload Document</h1>
      {targetMember && <p className="text-gray-500 mb-6">For {targetMember.name} ({targetMember.relationship})</p>}
      <UploadForm familyId={authMember?.family_id} memberId={id} onUpload={handleUpload} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/UploadForm.jsx src/pages/UploadPage.jsx
git commit -m "feat: add document upload with category selection"
```

---

### Task 11: Member profile page (documents, preview, download)

**Files:**
- Create: `src/components/DocumentCard.jsx`
- Create: `src/components/DocumentGrid.jsx`
- Create: `src/components/DocumentPreview.jsx`
- Modify: `src/pages/MemberPage.jsx`

- [ ] **Step 1: Create DocumentCard**

`src/components/DocumentCard.jsx`:

```jsx
import { useState } from 'react'
import { formatFileSize, formatDate } from '../utils/format'

export default function DocumentCard({ doc, onPreview, onDelete, getSignedUrl, canDelete }) {
  const [downloading, setDownloading] = useState(false)
  const isImage = doc.file_type?.startsWith('image/')
  const categoryName = doc.categories?.name || 'Uncategorized'

  async function handleDownload() {
    setDownloading(true)
    try {
      const url = await getSignedUrl(doc.file_url)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.label + '.' + doc.file_url.split('.').pop()
      a.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow">
      {/* Thumbnail / icon */}
      <div
        onClick={() => onPreview(doc)}
        className="h-32 bg-gray-100 flex items-center justify-center cursor-pointer"
      >
        {isImage ? (
          <span className="text-4xl">🖼️</span>
        ) : (
          <span className="text-4xl">📄</span>
        )}
      </div>

      <div className="p-3">
        <p className="font-medium text-sm text-gray-900 truncate">{doc.label}</p>
        <p className="text-xs text-gray-500 mt-1">{categoryName}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)} &middot; {formatDate(doc.created_at)}</span>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 text-xs py-1.5 px-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 font-medium"
          >
            {downloading ? '...' : 'Download'}
          </button>
          {canDelete && (
            <button
              onClick={() => onDelete(doc)}
              className="text-xs py-1.5 px-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 font-medium"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create DocumentGrid**

`src/components/DocumentGrid.jsx`:

```jsx
import DocumentCard from './DocumentCard'

export default function DocumentGrid({ documents, categories, onPreview, onDelete, getSignedUrl, canDelete }) {
  if (!documents.length) {
    return <p className="text-gray-500 text-center py-8">No documents uploaded yet.</p>
  }

  // Group by category
  const grouped = {}
  for (const doc of documents) {
    const catName = doc.categories?.name || 'Uncategorized'
    if (!grouped[catName]) grouped[catName] = []
    grouped[catName].push(doc)
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([catName, docs]) => (
        <div key={catName}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">{catName}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {docs.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                onPreview={onPreview}
                onDelete={onDelete}
                getSignedUrl={getSignedUrl}
                canDelete={canDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create DocumentPreview**

`src/components/DocumentPreview.jsx`:

```jsx
import { useState, useEffect } from 'react'

export default function DocumentPreview({ doc, getSignedUrl, onClose }) {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const isImage = doc.file_type?.startsWith('image/')

  useEffect(() => {
    getSignedUrl(doc.file_url).then(u => {
      setUrl(u)
      setLoading(false)
    })
  }, [doc.file_url])

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-xl hover:text-gray-300"
        >
          &times; Close
        </button>
        <div className="bg-white rounded-xl overflow-hidden">
          <div className="p-3 border-b border-gray-200">
            <p className="font-medium text-gray-900">{doc.label}</p>
            <p className="text-sm text-gray-500">{doc.categories?.name}</p>
          </div>
          <div className="flex items-center justify-center bg-gray-100 min-h-64 max-h-[70vh] overflow-auto">
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            ) : isImage ? (
              <img src={url} alt={doc.label} className="max-w-full max-h-[70vh] object-contain" />
            ) : (
              <iframe src={url} className="w-full h-[70vh]" title={doc.label} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build MemberPage**

`src/pages/MemberPage.jsx`:

```jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMembers } from '../hooks/useMembers'
import { useDocuments } from '../hooks/useDocuments'
import DocumentGrid from '../components/DocumentGrid'
import DocumentPreview from '../components/DocumentPreview'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function MemberPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member: authMember, isAdmin } = useAuth()
  const { members, deleteMember } = useMembers(authMember?.family_id)
  const { documents, loading, deleteDocument, getSignedUrl } = useDocuments(id)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [zipping, setZipping] = useState(false)

  const targetMember = members.find(m => m.id === id)
  const isOwnProfile = targetMember?.user_id === authMember?.user_id
  const canUpload = isAdmin || isOwnProfile
  const canDelete = isAdmin || isOwnProfile
  const canDeleteMember = isAdmin && targetMember?.id !== authMember?.id

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.label}"? This cannot be undone.`)) return
    await deleteDocument(doc)
  }

  async function handleDeleteMember() {
    if (!confirm(`Delete ${targetMember.name} and all their documents? This cannot be undone.`)) return
    await deleteMember(targetMember.id)
    navigate('/dashboard')
  }

  async function handleDownloadAll() {
    if (!documents.length) return
    setZipping(true)
    try {
      const zip = new JSZip()
      for (const doc of documents) {
        const url = await getSignedUrl(doc.file_url)
        const resp = await fetch(url)
        const blob = await resp.blob()
        const ext = doc.file_url.split('.').pop()
        const catName = doc.categories?.name || 'Other'
        zip.file(`${catName}/${doc.label}.${ext}`, blob)
      }
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${targetMember?.name || 'documents'}.zip`)
    } finally {
      setZipping(false)
    }
  }

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>

  return (
    <div className="p-4 md:p-6">
      <button onClick={() => navigate('/dashboard')} className="text-sm text-blue-600 hover:underline mb-4">&larr; Dashboard</button>

      {/* Member header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-semibold">
            {targetMember?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{targetMember?.name}</h1>
            <p className="text-gray-500">{targetMember?.relationship}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canUpload && (
            <button
              onClick={() => navigate(`/member/${id}/upload`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Upload
            </button>
          )}
          {documents.length > 0 && (
            <button
              onClick={handleDownloadAll}
              disabled={zipping}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
            >
              {zipping ? 'Zipping...' : 'Download All'}
            </button>
          )}
          {canDeleteMember && (
            <button
              onClick={handleDeleteMember}
              className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-sm font-medium"
            >
              Delete Member
            </button>
          )}
        </div>
      </div>

      {/* Documents */}
      <DocumentGrid
        documents={documents}
        onPreview={setPreviewDoc}
        onDelete={handleDelete}
        getSignedUrl={getSignedUrl}
        canDelete={canDelete}
      />

      {/* Preview modal */}
      {previewDoc && (
        <DocumentPreview doc={previewDoc} getSignedUrl={getSignedUrl} onClose={() => setPreviewDoc(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentCard.jsx src/components/DocumentGrid.jsx src/components/DocumentPreview.jsx src/pages/MemberPage.jsx
git commit -m "feat: add member profile with document grid, preview, and bulk download"
```

---

## Chunk 4: Invites, Settings, and Deployment

### Task 12: Invites hook + Invite page

**Files:**
- Create: `src/hooks/useInvites.js`
- Create: `src/components/InviteManager.jsx`
- Modify: `src/pages/InvitePage.jsx`

- [ ] **Step 1: Create useInvites hook**

`src/hooks/useInvites.js`:

```js
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'

export function useInvites(familyId) {
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId) return
    fetchInvites()
  }, [familyId])

  async function fetchInvites() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invites')
      .select('*, members(name, relationship)')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
    if (!error) setInvites(data || [])
    setLoading(false)
  }

  async function createInvite(memberId) {
    const token = crypto.randomUUID().replace(/-/g, '')
    const { data, error } = await supabase
      .from('invites')
      .insert({
        family_id: familyId,
        member_id: memberId,
        token,
      })
      .select('*, members(name, relationship)')
      .single()
    if (error) throw error
    await fetchInvites()
    return data
  }

  async function revokeInvite(id) {
    const { error } = await supabase
      .from('invites')
      .update({ status: 'revoked' })
      .eq('id', id)
    if (error) throw error
    await fetchInvites()
  }

  return { invites, loading, createInvite, revokeInvite, refetch: fetchInvites }
}

// Standalone functions for the invite page (no auth context needed at first)
export async function lookupInvite(token) {
  const { data, error } = await supabase.rpc('lookup_invite', { invite_token: token })
  if (error) throw error
  return data
}

export async function acceptInvite(token) {
  const { data, error } = await supabase.rpc('accept_invite', { invite_token: token })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}
```

- [ ] **Step 2: Create InviteManager (admin component)**

`src/components/InviteManager.jsx`:

```jsx
import { useState } from 'react'
import { useInvites } from '../hooks/useInvites'

export default function InviteManager({ familyId, members }) {
  const { invites, createInvite, revokeInvite } = useInvites(familyId)
  const [selectedMember, setSelectedMember] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  // Members without a user_id and without a pending invite
  const invitableMembers = members.filter(m => {
    if (m.user_id) return false
    const hasActiveInvite = invites.some(i => i.member_id === m.id && i.status === 'pending')
    return !hasActiveInvite
  })

  async function handleCreate() {
    if (!selectedMember) return
    await createInvite(selectedMember)
    setSelectedMember('')
  }

  function copyLink(token) {
    const url = `${window.location.origin}/invite/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(token)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Invite Links</h3>

      {/* Create new invite */}
      {invitableMembers.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selectedMember}
            onChange={e => setSelectedMember(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">Select member to invite...</option>
            {invitableMembers.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.relationship})</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={!selectedMember}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            Generate Link
          </button>
        </div>
      )}

      {/* Existing invites */}
      <div className="space-y-2">
        {invites.map(inv => (
          <div key={inv.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
            <div>
              <p className="font-medium text-sm text-gray-900">
                {inv.members?.name} ({inv.members?.relationship})
              </p>
              <p className={`text-xs ${
                inv.status === 'accepted' ? 'text-green-600' :
                inv.status === 'revoked' ? 'text-red-500' : 'text-yellow-600'
              }`}>
                {inv.status}
              </p>
            </div>
            <div className="flex gap-2">
              {inv.status === 'pending' && (
                <>
                  <button
                    onClick={() => copyLink(inv.token)}
                    className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 font-medium"
                  >
                    {copiedId === inv.token ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => revokeInvite(inv.id)}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded-md hover:bg-red-100 font-medium"
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build InvitePage**

`src/pages/InvitePage.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { lookupInvite, acceptInvite } from '../hooks/useInvites'
import LoginForm from '../components/LoginForm'

export default function InvitePage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { session, member, fetchMember } = useAuth()
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    lookupInvite(token)
      .then(data => setInvite(data))
      .catch(() => setError('Invalid invite link.'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    setError('')
    try {
      await acceptInvite(token)
      await fetchMember()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setAccepting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (invite?.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Already Used</h1>
          <p className="text-gray-600 mb-4">This invite has already been accepted.</p>
          <a href="/" className="text-blue-600 hover:underline">Go to login</a>
        </div>
      </div>
    )
  }

  if (invite?.status === 'revoked' || (invite?.expires_at && new Date(invite.expires_at) < new Date())) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invite Expired</h1>
          <p className="text-gray-600">This invite is no longer valid. Contact your family admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm p-8 text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">You're Invited!</h1>
          <p className="text-gray-600 mt-2">
            Join <strong>{invite.family_name}</strong> as <strong>{invite.relationship}</strong>
          </p>
        </div>

        {!session ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">Sign in with your email to accept this invite.</p>
            <LoginForm />
          </div>
        ) : member ? (
          <div>
            <p className="text-gray-600">You already belong to a family.</p>
            <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline mt-2">
              Go to dashboard
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">You're signed in. Click below to join the family.</p>
            {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {accepting ? 'Joining...' : 'Accept Invite'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useInvites.js src/components/InviteManager.jsx src/pages/InvitePage.jsx
git commit -m "feat: add invite system with generation, acceptance, and revocation"
```

---

### Task 13: Settings page

**Files:**
- Modify: `src/pages/SettingsPage.jsx`
- Create: `src/components/StorageWarning.jsx`

- [ ] **Step 1: Create StorageWarning**

`src/components/StorageWarning.jsx`:

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatFileSize } from '../utils/format'

export default function StorageWarning({ familyId }) {
  const [totalSize, setTotalSize] = useState(0)

  useEffect(() => {
    if (!familyId) return
    supabase
      .from('documents')
      .select('file_size')
      .then(({ data }) => {
        const total = (data || []).reduce((sum, d) => sum + (d.file_size || 0), 0)
        setTotalSize(total)
      })
  }, [familyId])

  const maxBytes = 1024 * 1024 * 1024 // 1GB
  const pct = (totalSize / maxBytes) * 100

  if (pct < 80) return null

  return (
    <div className={`rounded-lg p-3 text-sm font-medium ${
      pct >= 95 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
    }`}>
      Storage: {formatFileSize(totalSize)} / 1 GB ({pct.toFixed(1)}%)
      {pct >= 95 && ' — Uploads are blocked. Delete some documents to free space.'}
    </div>
  )
}
```

- [ ] **Step 2: Build SettingsPage**

`src/pages/SettingsPage.jsx`:

```jsx
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useFamily } from '../hooks/useFamily'
import { useMembers } from '../hooks/useMembers'
import { useCategories } from '../hooks/useCategories'
import InviteManager from '../components/InviteManager'
import StorageWarning from '../components/StorageWarning'

export default function SettingsPage() {
  const { member } = useAuth()
  const familyId = member?.family_id
  const { updateFamilyName } = useFamily()
  const { members, updateMember } = useMembers(familyId)
  const { categories, addCategory, updateCategory, deleteCategory } = useCategories(familyId)

  const [familyName, setFamilyName] = useState(member?.families?.name || '')
  const [newCat, setNewCat] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSaveName(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateFamilyName(familyId, familyName)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.trim()) return
    await addCategory(newCat.trim())
    setNewCat('')
  }

  async function handleToggleAdmin(memberId, currentRole) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin'
    if (memberId === member?.id && newRole === 'member') {
      if (!confirm('Remove your own admin access? Make sure another admin exists.')) return
    }
    await updateMember(memberId, { role: newRole })
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <StorageWarning familyId={familyId} />

      {/* Family Name */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Family Name</h2>
        <form onSubmit={handleSaveName} className="flex gap-2">
          <input
            type="text" value={familyName} onChange={e => setFamilyName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
            Save
          </button>
        </form>
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Document Categories</h2>
        <div className="space-y-2 mb-3">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-900">{cat.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const newName = prompt('Rename category:', cat.name)
                    if (newName && newName !== cat.name) updateCategory(cat.id, newName)
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Rename
                </button>
                <button
                  onClick={() => { if (confirm(`Delete category "${cat.name}"?`)) deleteCategory(cat.id) }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text" value={newCat} onChange={e => setNewCat(e.target.value)}
            placeholder="New category name"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          />
          <button type="submit"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
            Add
          </button>
        </form>
      </section>

      {/* Member roles */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Member Roles</h2>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium text-gray-900">{m.name}</span>
                <span className="text-xs text-gray-500 ml-2">{m.relationship}</span>
              </div>
              <button
                onClick={() => handleToggleAdmin(m.id, m.role)}
                className={`text-xs px-3 py-1 rounded-full font-medium ${
                  m.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {m.role}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Invites */}
      <section>
        <InviteManager familyId={familyId} members={members} />
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/SettingsPage.jsx src/components/StorageWarning.jsx
git commit -m "feat: add settings page with family name, categories, roles, and invites"
```

---

### Task 14: Final wiring + cleanup + deploy config

**Files:**
- Verify all imports and routes in `src/App.jsx`
- Verify `src/components/Layout.jsx` nav items
- Clean up default Vite files (remove `src/App.css`, `src/assets/react.svg`, etc.)

- [ ] **Step 1: Remove Vite boilerplate files**

```bash
rm -f src/App.css src/assets/react.svg public/vite.svg
```

- [ ] **Step 2: Verify app compiles with no errors**

```bash
npm run build
```

Expected: Clean build output in `dist/` with no errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up boilerplate and verify production build"
```

---

### Task 15: Supabase project setup instructions

This task is manual — no code to write, but the implementer needs clear instructions.

- [ ] **Step 1: Document Supabase setup**

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Copy the project URL and anon key from Settings > API
3. Paste into `.env.local`:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...
   ```
4. Open SQL Editor in Supabase dashboard
5. Paste the contents of `supabase/migrations/001_initial_schema.sql` and run it
6. Go to Storage > Create new bucket:
   - Name: `documents`
   - Public: **OFF**
   - File size limit: `5242880` (5MB)
7. Add storage policies via SQL Editor:
   ```sql
   CREATE POLICY "Family members can read own family files"
   ON storage.objects FOR SELECT
   USING (
     bucket_id = 'documents'
     AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
   );

   CREATE POLICY "Family members can upload to own family path"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'documents'
     AND (storage.foldername(name))[1] = (SELECT get_my_family_id()::text)
   );

   CREATE POLICY "Admins can delete family files"
   ON storage.objects FOR DELETE
   USING (
     bucket_id = 'documents'
     AND (SELECT is_admin())
   );
   ```
8. Go to Authentication > URL Configuration:
   - Set Site URL to your Netlify URL (or `http://localhost:5173` for dev)
   - Add `http://localhost:5173` to Redirect URLs

- [ ] **Step 2: Commit the .env.example if not already done**

```bash
git add .env.example
git commit -m "docs: add supabase setup instructions in migration file"
```
