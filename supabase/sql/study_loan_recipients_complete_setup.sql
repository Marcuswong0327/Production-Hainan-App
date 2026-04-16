-- =========================================
-- Study Loan Recipients + Guarantors — Complete Setup (app v2)
-- Safe to run in Supabase SQL Editor
-- =========================================
--
-- What changed vs older scripts:
-- - study_loan_recipients: full_name_en, full_name_zh, course (not full_name / courses)
-- - Single IC file path: student_ic_front_back_path (not ic_front_path + ic_back_path)
-- - offer_letter_path stays on recipients
-- - All guarantor fields + 文件截图 live in table `guarantors` (FK student_id)
--
-- If you ALREADY have the old table (full_name, guarantor1_*, etc.), do NOT use
-- section 1 CREATE blindly — use section 6 "Upgrade from legacy" after section 2–5,
-- or run: supabase/migrations/20260416140000_study_loan_recipients_v2_and_guarantors.sql
-- =========================================

-- ---------------------------------------------------------------------------
-- 1) Base table — recipients ONLY (no guarantor columns)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_loan_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name_en TEXT NOT NULL,
  full_name_zh TEXT,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  association TEXT NOT NULL,
  university TEXT NOT NULL,
  course TEXT NOT NULL,
  loan_type TEXT,
  admission_date TEXT,
  expected_graduation_date TEXT,
  loan_amount INTEGER NOT NULL,
  total_paid INTEGER NOT NULL DEFAULT 0,
  payments_made INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  offer_letter_path TEXT,
  student_ic_front_back_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2) Index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_study_loan_recipients_status
  ON public.study_loan_recipients (status);

-- ---------------------------------------------------------------------------
-- 3) Relational guarantors (one row per student)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guarantors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.study_loan_recipients(id) ON DELETE CASCADE,
  guarantor_1_zh TEXT,
  guarantor_1_en TEXT,
  guarantor_1_ic TEXT,
  guarantor_1_address TEXT,
  guarantor_1_sign_date TEXT,
  guarantor_2_zh TEXT,
  guarantor_2_en TEXT,
  guarantor_2_ic TEXT,
  guarantor_2_address TEXT,
  guarantor_2_sign_date TEXT,
  guarantor_2_age INTEGER,
  guarantor_info_pic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guarantors_student_id_unique UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_guarantors_student_id ON public.guarantors (student_id);

-- ---------------------------------------------------------------------------
-- 4) RLS — study_loan_recipients
-- ---------------------------------------------------------------------------
ALTER TABLE public.study_loan_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read study_loan_recipients" ON public.study_loan_recipients;
DROP POLICY IF EXISTS "Allow insert study_loan_recipients" ON public.study_loan_recipients;
DROP POLICY IF EXISTS "Allow update study_loan_recipients" ON public.study_loan_recipients;
DROP POLICY IF EXISTS "Allow delete study_loan_recipients" ON public.study_loan_recipients;

CREATE POLICY "Allow read study_loan_recipients"
  ON public.study_loan_recipients FOR SELECT USING (true);
CREATE POLICY "Allow insert study_loan_recipients"
  ON public.study_loan_recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update study_loan_recipients"
  ON public.study_loan_recipients FOR UPDATE USING (true);
CREATE POLICY "Allow delete study_loan_recipients"
  ON public.study_loan_recipients FOR DELETE USING (true);

-- ---------------------------------------------------------------------------
-- 5) RLS — guarantors
-- ---------------------------------------------------------------------------
ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read guarantors" ON public.guarantors;
DROP POLICY IF EXISTS "Allow insert guarantors" ON public.guarantors;
DROP POLICY IF EXISTS "Allow update guarantors" ON public.guarantors;
DROP POLICY IF EXISTS "Allow delete guarantors" ON public.guarantors;

CREATE POLICY "Allow read guarantors" ON public.guarantors FOR SELECT USING (true);
CREATE POLICY "Allow insert guarantors" ON public.guarantors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update guarantors" ON public.guarantors FOR UPDATE USING (true);
CREATE POLICY "Allow delete guarantors" ON public.guarantors FOR DELETE USING (true);

-- ---------------------------------------------------------------------------
-- 6) OPTIONAL — Upgrade path if you previously created OLD columns
--    (full_name, courses, guarantor1_*, ic_front_back_path, …)
--    Uncomment / run the migration file instead:
--    supabase/migrations/20260416140000_study_loan_recipients_v2_and_guarantors.sql
-- ---------------------------------------------------------------------------
