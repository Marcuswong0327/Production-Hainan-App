-- Chinese name for manual loan recipients; payment date for each repayment row.

ALTER TABLE study_loan_recipients ADD COLUMN IF NOT EXISTS full_name_chinese TEXT;

ALTER TABLE study_loan_payments ADD COLUMN IF NOT EXISTS payment_date DATE;

UPDATE study_loan_payments
SET payment_date = paid_at::date
WHERE payment_date IS NULL;
