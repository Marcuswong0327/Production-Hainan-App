import type { GuarantorRow, LoanRecipient } from '../types/studyLoan';

/** Map PostgREST row (`study_loan_recipients` + embedded `guarantors`) to `LoanRecipient`. */
export function mapLoanRecipientRow(row: Record<string, unknown>): LoanRecipient {
  const raw = row.guarantors as unknown;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const guarantor = (arr[0] as GuarantorRow | undefined) ?? null;
  const { guarantors: _g, ...rest } = row;
  return { ...(rest as Omit<LoanRecipient, 'guarantor'>), guarantor };
}
