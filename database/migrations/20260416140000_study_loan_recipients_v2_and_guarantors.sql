-- Loan recipients (v2 field names) + relational `guarantors` table.
-- Safe to run once; uses IF NOT EXISTS / IF EXISTS guards where needed.

-- ---------------------------------------------------------------------------
-- 1) guarantors (one row per student)
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
-- 2) Add canonical columns on study_loan_recipients
-- ---------------------------------------------------------------------------
ALTER TABLE public.study_loan_recipients ADD COLUMN IF NOT EXISTS full_name_en TEXT;
ALTER TABLE public.study_loan_recipients ADD COLUMN IF NOT EXISTS full_name_zh TEXT;
ALTER TABLE public.study_loan_recipients ADD COLUMN IF NOT EXISTS course TEXT;
ALTER TABLE public.study_loan_recipients ADD COLUMN IF NOT EXISTS loan_type TEXT;
ALTER TABLE public.study_loan_recipients ADD COLUMN IF NOT EXISTS student_ic_front_back_path TEXT;

-- Backfill from legacy names when those columns still exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_loan_recipients' AND column_name = 'full_name'
  ) THEN
    UPDATE public.study_loan_recipients r
    SET full_name_en = COALESCE(NULLIF(trim(r.full_name_en), ''), NULLIF(trim(r.full_name), ''))
    WHERE r.full_name_en IS NULL OR trim(r.full_name_en) = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_loan_recipients' AND column_name = 'full_name_chinese'
  ) THEN
    UPDATE public.study_loan_recipients r
    SET full_name_zh = COALESCE(NULLIF(trim(r.full_name_zh), ''), NULLIF(trim(r.full_name_chinese), ''));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_loan_recipients' AND column_name = 'courses'
  ) THEN
    UPDATE public.study_loan_recipients r
    SET course = COALESCE(NULLIF(trim(r.course), ''), NULLIF(trim(r.courses), ''))
    WHERE r.course IS NULL OR trim(r.course) = '';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_loan_recipients' AND column_name = 'ic_front_path'
  ) THEN
    UPDATE public.study_loan_recipients r
    SET student_ic_front_back_path = COALESCE(
      NULLIF(trim(r.student_ic_front_back_path), ''),
      NULLIF(trim(r.ic_front_path), ''),
      NULLIF(trim(r.ic_back_path), '')
    )
    WHERE r.student_ic_front_back_path IS NULL OR trim(r.student_ic_front_back_path) = '';
  END IF;
END $$;

UPDATE public.study_loan_recipients
SET full_name_en = 'Unknown'
WHERE full_name_en IS NULL OR trim(full_name_en) = '';

UPDATE public.study_loan_recipients
SET course = '—'
WHERE course IS NULL OR trim(course) = '';

-- ---------------------------------------------------------------------------
-- 3) Optional: copy legacy flat guarantor_* columns into guarantors (if present)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_loan_recipients' AND column_name = 'guarantor1_name_zh'
  ) THEN
    INSERT INTO public.guarantors (
      student_id,
      guarantor_1_zh,
      guarantor_1_en,
      guarantor_1_ic,
      guarantor_1_address,
      guarantor_1_sign_date,
      guarantor_2_zh,
      guarantor_2_en,
      guarantor_2_ic,
      guarantor_2_address,
      guarantor_2_sign_date,
      guarantor_2_age,
      guarantor_info_pic
    )
    SELECT
      r.id,
      r.guarantor1_name_zh,
      r.guarantor1_name_en,
      r.guarantor1_ic_number,
      r.guarantor1_address,
      r.guarantor1_date,
      r.guarantor2_name_zh,
      r.guarantor2_name_en,
      r.guarantor2_ic_number,
      r.guarantor2_address,
      r.guarantor2_date,
      r.guarantor2_age,
      r.guarantor_ic_front_path
    FROM public.study_loan_recipients r
    WHERE NOT EXISTS (SELECT 1 FROM public.guarantors g WHERE g.student_id = r.id)
      AND (
        r.guarantor1_name_zh IS NOT NULL
        OR r.guarantor2_name_zh IS NOT NULL
        OR r.guarantor_ic_front_path IS NOT NULL
      );
  END IF;
END $$;

ALTER TABLE public.study_loan_recipients
  ALTER COLUMN full_name_en SET NOT NULL;

ALTER TABLE public.study_loan_recipients
  ALTER COLUMN course SET NOT NULL;
