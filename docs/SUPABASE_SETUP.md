# Step-by-Step: Supabase Setup for Study Loan Applications

This guide walks you through setting up Supabase so the Hainan App can store and manage study loan applications.

---

## Step 1: Create a Supabase account and project

1. Go to **https://supabase.com** and sign up (or log in).
2. Click **New Project**.
3. Fill in:
   - **Name**: e.g. `hainan-app`
   - **Database Password**: choose a strong password and **save it** (you need it for DB access).
   - **Region**: pick one close to your users.
4. Click **Create new project** and wait until the project is ready (1–2 minutes).

---

## Step 2: Get your API keys

1. In the Supabase dashboard, open your project.
2. Go to **Settings** (gear icon in the left sidebar) → **API**.
3. You will see:
   - **Project URL** (e.g. `https://xxxxxxxx.supabase.co`) → this is your `VITE_SUPABASE_URL`
   - **Project API keys**:
     - **anon public** key → this is your `VITE_SUPABASE_ANON_KEY` (safe to use in the browser)

Copy both values; you will add them to `.env` in Step 5.

---

## Step 3: Create the database tables

1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Run the following in order.

### 3a. Profiles table (for Sign In / Sign Up and roles)

This table stores user profile and role, linked to Supabase Auth. Loan applications use the same `user_id` as the auth user id.

```sql
-- Profiles: one row per auth user (id = auth.uid())
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'public' CHECK (role IN ('super_admin', 'sub_admin', 'sub_editor', 'public')),
  association_id TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile (e.g. name)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow insert own profile (app creates profile after sign up with id = auth.uid())
CREATE POLICY "Allow insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow read for all (so super admin can list users if needed). Tighten in production.
CREATE POLICY "Allow read all profiles" ON profiles
  FOR SELECT USING (true);
```

**Super admin:** Sign up once from the app with email `marcuswong0327@gmail.com` and password `SHIquan@!05`. The app will assign the `super_admin` role to that email automatically. The super admin can change their password later from the dashboard (header → “Change password”).

### 3b. Study loan applications table

```sql
-- Study loan applications table
CREATE TABLE IF NOT EXISTS study_loan_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  association TEXT NOT NULL,
  full_name TEXT NOT NULL,
  age TEXT NOT NULL,
  email TEXT NOT NULL,
  university TEXT NOT NULL,
  courses TEXT NOT NULL,
  admission_date TEXT NOT NULL,
  expected_graduation_date TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  offer_letter_path TEXT,
  ic_front_path TEXT,
  ic_back_path TEXT,
  guarantor_ic_front_path TEXT,
  guarantor_ic_back_path TEXT,
  guarantor_relationship TEXT NOT NULL,
  guarantor_phone_number TEXT NOT NULL,
  loan_type TEXT NOT NULL,
  loan_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: index for listing by status and date
CREATE INDEX IF NOT EXISTS idx_study_loan_applications_status ON study_loan_applications (status);
CREATE INDEX IF NOT EXISTS idx_study_loan_applications_user_id ON study_loan_applications (user_id);
CREATE INDEX IF NOT EXISTS idx_study_loan_applications_applied_at ON study_loan_applications (applied_at DESC);

-- Enable Row Level Security (RLS) so you can restrict who reads/writes later
ALTER TABLE study_loan_applications ENABLE ROW LEVEL SECURITY;

-- Policy: allow anyone to insert (applications from the app). Adjust in production.
CREATE POLICY "Allow insert study_loan_applications" ON study_loan_applications
  FOR INSERT WITH CHECK (true);

-- Policy: allow anyone to read (so super admin and applicants can view). Tighten in production.
CREATE POLICY "Allow read study_loan_applications" ON study_loan_applications
  FOR SELECT USING (true);

-- Policy: allow anyone to update (so super admin can approve/reject). Tighten in production.
CREATE POLICY "Allow update study_loan_applications" ON study_loan_applications
  FOR UPDATE USING (true);

-- Optional: columns for repayment tracking (run if you want applicants to repay after approval)
ALTER TABLE study_loan_applications ADD COLUMN IF NOT EXISTS total_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE study_loan_applications ADD COLUMN IF NOT EXISTS payments_made INTEGER NOT NULL DEFAULT 0;
```

### 3c. Manual loan recipients (track students who received the loan)

For super admin to enter students manually and track repayment progress (and future notifications):

```sql
CREATE TABLE IF NOT EXISTS study_loan_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  association TEXT NOT NULL,
  university TEXT NOT NULL,
  courses TEXT NOT NULL,
  loan_amount INTEGER NOT NULL,
  total_paid INTEGER NOT NULL DEFAULT 0,
  payments_made INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_loan_recipients_status ON study_loan_recipients (status);
ALTER TABLE study_loan_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read study_loan_recipients" ON study_loan_recipients FOR SELECT USING (true);
CREATE POLICY "Allow insert study_loan_recipients" ON study_loan_recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update study_loan_recipients" ON study_loan_recipients FOR UPDATE USING (true);
CREATE POLICY "Allow delete study_loan_recipients" ON study_loan_recipients FOR DELETE USING (true);

-- Optional: extra columns for full application-style data (admission, guarantor, document paths and pasted text)
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS admission_date TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS expected_graduation_date TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS loan_type TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS guarantor_relationship TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS guarantor_phone_number TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS offer_letter_path TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS ic_front_path TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS ic_back_path TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS guarantor_ic_front_path TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS guarantor_ic_back_path TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS ic_front_text TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS ic_back_text TEXT;
ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS guarantor_ic_text TEXT;

-- Optional: store individual repayment records with receipts
CREATE TABLE IF NOT EXISTS study_loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES study_loan_recipients(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_month INTEGER,
  receipt_path TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_study_loan_payments_recipient ON study_loan_payments (recipient_id);
```

4. Confirm the query runs without errors. The table `study_loan_applications` is now ready. If you added the optional `total_paid` and `payments_made` columns, applicants can record repayments from their status page.

---

## Step 4: Create Storage bucket for documents

1. In the left sidebar, go to **Storage**.
2. Click **New bucket**.
3. Name: `study-loan-documents`.
4. Set **Public bucket** to **Off** (documents are private).
5. Click **Create bucket**.
6. Open the bucket and go to **Policies** (or Storage → Policies).
7. Add a policy so the app can upload and read files. In **SQL Editor**, run:

```sql
-- Allow uploads (insert) for authenticated or anon users. Tighten in production.
CREATE POLICY "Allow upload study loan documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'study-loan-documents');

-- Allow reads so applicants and super admin can view documents
CREATE POLICY "Allow read study loan documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'study-loan-documents');
```

If you prefer to do it via the UI: Storage → study-loan-documents → Policies → New policy → define “Allow upload” and “Allow read” for `study-loan-documents`.

---

## Step 5: Connect the app with environment variables

1. In your project root (where `package.json` is), create a file named **`.env`** (no name before the dot).
2. Add these lines (replace with your actual values from Step 2):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

3. Restart the dev server so Vite picks up the new env:

```bash
npm run dev
```

Never commit `.env` (it should be in `.gitignore`). You can commit `.env.example` with placeholder values.

---

## Step 6: Install the Supabase client (if not already)

From the project root:

```bash
npm install @supabase/supabase-js
```

---

## Summary checklist

- [ ] Supabase project created  
- [ ] Project URL and anon key copied  
- [ ] SQL run: `study_loan_applications` table created  
- [ ] Storage bucket `study-loan-documents` created and policies added  
- [ ] `.env` created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`  
- [ ] `npm install @supabase/supabase-js` and `npm run dev`  

After this, the study loan application form will save to Supabase, and the super admin dashboard will load applications from Supabase for review.
