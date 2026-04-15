/** Stored in `LoanRecipient.guarantor_ic_text` for super-admin “add student” guarantor step. */

export const GUARANTOR_PAYLOAD_VERSION = 1 as const;

export interface GuarantorRecipientPayloadV1 {
  version: typeof GUARANTOR_PAYLOAD_VERSION;
  g1: {
    name_zh: string;
    name_en: string;
    ic: string;
    address: string;
    date: string;
  };
  g2: {
    name_zh: string;
    name_en: string;
    ic: string;
    address: string;
    date: string;
    age: number;
  };
}

export function stringifyGuarantorPayload(p: GuarantorRecipientPayloadV1): string {
  return JSON.stringify(p);
}

export function parseGuarantorPayload(raw: string | null | undefined): GuarantorRecipientPayloadV1 | null {
  if (!raw?.trim().startsWith('{')) return null;
  try {
    const o = JSON.parse(raw) as Partial<GuarantorRecipientPayloadV1>;
    if (o.version !== 1 || !o.g1 || !o.g2) return null;
    return o as GuarantorRecipientPayloadV1;
  } catch {
    return null;
  }
}
