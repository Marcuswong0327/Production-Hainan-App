export type StudyLoanStatus = 'pending' | 'approved' | 'rejected';

export interface StudyLoanApplication {
  id: string;
  user_id: string;
  association: string;
  full_name: string;
  age: string;
  email: string;
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
  total_paid?: number;
  payments_made?: number;
}

export const STUDY_LOAN_BUCKET = 'study-loan-documents';

/** One row per student; linked from `study_loan_recipients.id` */
export interface GuarantorRow {
  id: string;
  student_id: string;
  guarantor_1_zh: string | null;
  guarantor_1_en: string | null;
  guarantor_1_ic: string | null;
  guarantor_1_address: string | null;
  guarantor_1_sign_date: string | null;
  guarantor_2_zh: string | null;
  guarantor_2_en: string | null;
  guarantor_2_ic: string | null;
  guarantor_2_address: string | null;
  guarantor_2_sign_date: string | null;
  guarantor_2_age: number | null;
  guarantor_info_pic: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Manually entered student who received a study loan (Super Admin “Add student”) */
export interface LoanRecipient {
  id: string;
  full_name_en: string;
  full_name_zh: string | null;
  loan_type: string | null;
  email: string;
  phone_number: string;
  association: string;
  university: string;
  course: string;
  admission_date: string;
  expected_graduation_date: string;
  loan_amount: number;
  total_paid: number;
  status: 'active' | 'completed';
  offer_letter_path: string | null;
  student_ic_front_back_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from `guarantors` (one row per student); null if not yet created */
  guarantor: GuarantorRow | null;
}

/** Row payload for insert/upsert into `guarantors` (no id/timestamps) */
export type GuarantorInsert = Omit<GuarantorRow, 'id' | 'created_at' | 'updated_at'>;

/** Recipient row without joined guarantor (used when saving from Add student) */
export type LoanRecipientCore = Omit<LoanRecipient, 'guarantor'>;

export const MONTHLY_PAYMENTS = 20;
