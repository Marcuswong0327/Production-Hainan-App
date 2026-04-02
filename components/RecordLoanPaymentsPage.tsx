import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import type { LoanRecipient } from '../types/studyLoan';
import { STUDY_LOAN_BUCKET } from '../types/studyLoan';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface RecordLoanPaymentsPageProps {
  recipient: LoanRecipient;
  onBack: () => void;
  onTotalsUpdated?: (updated: LoanRecipient) => void;
}

interface PaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  payment_date: string | null;
  receipt_path: string | null;
}

function displayPaymentDate(p: PaymentRow): string {
  if (p.payment_date) return p.payment_date;
  try {
    return new Date(p.paid_at).toLocaleDateString();
  } catch {
    return p.paid_at;
  }
}

export function RecordLoanPaymentsPage({ recipient, onBack, onTotalsUpdated }: RecordLoanPaymentsPageProps) {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const loadPayments = async () => {
    try {
      setLoading(true);
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('study_loan_payments')
          .select('*')
          .eq('recipient_id', recipient.id)
          .order('paid_at', { ascending: false });
        if (!error && data) {
          const rows = (data as any[]).map((p) => ({
            id: p.id,
            amount: p.amount,
            paid_at: p.paid_at,
            payment_date: p.payment_date ?? null,
            receipt_path: p.receipt_path ?? null,
          }));
          rows.sort((a, b) => {
            const da = a.payment_date || a.paid_at?.slice(0, 10) || '';
            const db = b.payment_date || b.paid_at?.slice(0, 10) || '';
            return db.localeCompare(da);
          });
          setPayments(rows);
        }
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        const filtered = raw
          .filter((p: any) => p.recipientId === recipient.id)
          .sort((a: any, b: any) => {
            const da = a.paymentDate || a.paidAt || '';
            const db = b.paymentDate || b.paidAt || '';
            return db.localeCompare(da);
          });
        setPayments(
          filtered.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paid_at: p.paidAt,
            payment_date: p.paymentDate ?? null,
            receipt_path: null,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [recipient.id]);

  const openReceipt = async (path: string | null) => {
    if (!path) return;
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.storage.from(STUDY_LOAN_BUCKET).createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) {
        alert('Unable to open receipt');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } else {
      alert('Receipt stored in Supabase; configure Supabase to view.');
    }
  };

  const handleSavePayment = async () => {
    const amount = parseInt(amountInput, 10);
    if (!paymentDate.trim()) {
      alert('Select the payment date (when the student paid).');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }
    try {
      setSaving(true);
      let receiptPath: string | null = null;
      if (isSupabaseConfigured() && supabase) {
        if (receiptFile) {
          const safeExt = receiptFile.name.split('.').pop() || 'bin';
          const path = `recipients/${recipient.id}/payments/${paymentDate}-${Date.now()}.${safeExt}`;
          const { error: uploadError } = await supabase.storage.from(STUDY_LOAN_BUCKET).upload(path, receiptFile, {
            upsert: true,
          });
          if (uploadError) throw uploadError;
          receiptPath = path;
        }
        const { error: payError } = await supabase.from('study_loan_payments').insert({
          recipient_id: recipient.id,
          amount,
          payment_date: paymentDate,
          paid_at: new Date().toISOString(),
          payment_month: null,
          receipt_path: receiptPath,
        });
        if (payError) throw payError;

        const newTotalPaid = recipient.total_paid + amount;
        const newPaymentsMade = recipient.payments_made + 1;
        const newStatus = newTotalPaid >= recipient.loan_amount ? 'completed' : 'active';

        const { error: updError } = await supabase
          .from('study_loan_recipients')
          .update({
            total_paid: newTotalPaid,
            payments_made: newPaymentsMade,
            status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', recipient.id);
        if (updError) throw updError;

        onTotalsUpdated?.({
          ...recipient,
          total_paid: newTotalPaid,
          payments_made: newPaymentsMade,
          status: newStatus,
          updated_at: new Date().toISOString(),
        });
      } else {
        const paymentsLocal = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        paymentsLocal.push({
          id: Date.now().toString(),
          recipientId: recipient.id,
          amount,
          paymentDate,
          paidAt: new Date().toISOString(),
          receiptName: receiptFile?.name || '',
        });
        localStorage.setItem('myHainanLoanPayments', JSON.stringify(paymentsLocal));

        const recipients = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        const idx = recipients.findIndex((r: any) => r.id === recipient.id);
        if (idx !== -1) {
          const r = recipients[idx];
          const newTotalPaid = (r.total_paid || 0) + amount;
          const newPaymentsMade = (r.payments_made || 0) + 1;
          const newStatus = newTotalPaid >= r.loan_amount ? 'completed' : 'active';
          recipients[idx] = {
            ...r,
            total_paid: newTotalPaid,
            payments_made: newPaymentsMade,
            status: newStatus,
            updated_at: new Date().toISOString(),
          };
          localStorage.setItem('myHainanLoanRecipients', JSON.stringify(recipients));
          onTotalsUpdated?.(recipients[idx]);
        }
      }
      setPaymentDate('');
      setAmountInput('');
      setReceiptFile(null);
      await loadPayments();
    } catch (e: any) {
      alert(e?.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const totalLoaned = recipient.loan_amount;
  const totalPaid = recipient.total_paid;
  const remaining = Math.max(0, totalLoaned - totalPaid);
  const progressPct = totalLoaned > 0 ? (totalPaid / totalLoaned) * 100 : 0;

  const yearlyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of payments) {
      const raw = p.payment_date || p.paid_at?.slice(0, 10);
      if (!raw) continue;
      const y = raw.slice(0, 4);
      map[y] = (map[y] || 0) + p.amount;
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [payments]);

  const titleName = [recipient.full_name, recipient.full_name_chinese?.trim()].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Loan repayments · {titleName}</h1>
            <p className="text-xs text-gray-500">
              {recipient.university} · {recipient.association}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="border rounded-lg p-3 bg-blue-50">
                <p className="text-xs text-gray-500">Total loan</p>
                <p className="text-lg font-semibold text-blue-700">RM {totalLoaned.toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-3 bg-green-50">
                <p className="text-xs text-gray-500">Total paid</p>
                <p className="text-lg font-semibold text-green-700">RM {totalPaid.toLocaleString()}</p>
              </div>
              <div className="border rounded-lg p-3 bg-amber-50">
                <p className="text-xs text-gray-500">Remaining</p>
                <p className="text-lg font-semibold text-amber-700">RM {remaining.toLocaleString()}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Overall progress</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter when the student paid, the amount, and optionally upload a receipt. There is no fixed calendar slot—use the actual payment date.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Payment date *</Label>
                <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Amount (RM) *</Label>
                <Input
                  type="number"
                  min="1"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="e.g. 200"
                />
              </div>
              <div className="space-y-2">
                <Label>Receipt / proof (optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-center">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    id="new-payment-receipt"
                    className="hidden"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="new-payment-receipt" className="cursor-pointer text-xs text-gray-600">
                    {receiptFile ? receiptFile.name : 'Upload (optional)'}
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSavePayment} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save payment'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading payments...
              </div>
            ) : payments.length === 0 ? (
              <p className="text-gray-500 text-sm">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border rounded-lg px-3 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium">RM {p.amount.toLocaleString()}</span>
                      <span className="text-gray-600">
                        {' '}
                        · Paid on {displayPaymentDate(p)}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {p.receipt_path && (
                        <Button type="button" size="sm" variant="outline" onClick={() => openReceipt(p.receipt_path)}>
                          <ExternalLink className="w-3 h-3 mr-1" />
                          View receipt
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {yearlyTotals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Yearly summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {yearlyTotals.map(([year, total]) => (
                <div key={year} className="flex items-center justify-between border-b last:border-b-0 pb-2">
                  <span>{year}</span>
                  <span className="font-semibold">RM {total.toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
