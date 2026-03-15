export type StudyLoanStatus = 'pending' | 'approved' | 'rejected';

export interface StudyLoanApplication {
  id: string;
  user_id: string;
  association: string;
  full_name: string;
  age: string;
  university: string;
  courses: string;
  admission_date: string;
  expected_graduation_date: string;
  phone_number: string;
  offer_letter_path: string | null;
  ic_front_path: string | null;
  ic_back_path: string | null;
  guarantor_ic_front_path: string | null;
  guarantor_ic_back_path: string | null;
  guarantor_relationship: string;
  guarantor_phone_number: string;
  loan_type: string;
  loan_amount: number;
  status: StudyLoanStatus;
  applied_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Repayment tracking (optional; add columns in Supabase if needed) */
  total_paid?: number;
  payments_made?: number;
}

export const STUDY_LOAN_BUCKET = 'study-loan-documents';

/** Manually entered student who received a study loan (for repayment tracking and future notifications) */
export interface LoanRecipient {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  association: string;
  university: string;
  courses: string;
  admission_date?: string;
  expected_graduation_date?: string;
  loan_type?: string;
  loan_amount: number;
  total_paid: number;
  payments_made: number;
  status: 'active' | 'completed';
  guarantor_relationship?: string;
  guarantor_phone_number?: string;
  /** Offer letter: file only (path after upload) */
  offer_letter_path?: string | null;
  /** Optional saved IC/document paths */
  ic_front_path?: string | null;
  ic_back_path?: string | null;
  guarantor_ic_front_path?: string | null;
  guarantor_ic_back_path?: string | null;
  /** Key details pasted by admin (e.g. IC number) after copying from AI preview */
  ic_front_text?: string | null;
  ic_back_text?: string | null;
  guarantor_ic_text?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const MONTHLY_PAYMENTS = 20;
