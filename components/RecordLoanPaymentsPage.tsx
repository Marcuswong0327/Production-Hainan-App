import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { ArrowLeft, FileText, Loader2, ExternalLink } from 'lucide-react';
import type { LoanRecipient } from '../types/studyLoan';
import { STUDY_LOAN_BUCKET, MONTHLY_PAYMENTS } from '../types/studyLoan';
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
  payment_month: number | null;
  receipt_path: string | null;
}

export function RecordLoanPaymentsPage({ recipient, onBack, onTotalsUpdated }: RecordLoanPaymentsPageProps) {
  const [tab, setTab] = useState<'monthly' | 'annually'>('monthly');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const schedule = useMemo(() => {
    const baseDateStr = recipient.admission_date || recipient.created_at;
    const base = new Date(baseDateStr);
    if (Number.isNaN(base.getTime())) return [];
    const items: { index: number; label: string; date: string }[] = [];
    for (let i = 0; i < MONTHLY_PAYMENTS; i++) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      const label = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      const dayStr = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      items.push({ index: i + 1, label, date: dayStr });
    }
    return items;
  }, [recipient.admission_date, recipient.created_at]);

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
          setPayments(
            data.map((p: any) => ({
              id: p.id,
              amount: p.amount,
              paid_at: p.paid_at,
              payment_month: p.payment_month,
              receipt_path: p.receipt_path,
            })),
          );
        }
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanPayments') || '[]');
        const filtered = raw
          .filter((p: any) => p.recipientId === recipient.id)
          .sort((a: any, b: any) => (b.paidAt || '').localeCompare(a.paidAt || ''));
        setPayments(
          filtered.map((p: any) => ({
            id: p.id,
            amount: p.amount,
            paid_at: p.paidAt,
            payment_month: p.paymentMonth ?? null,
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

  const handleSaveMonth = async (monthIndex: number) => {
    const amount = parseInt(amountInput, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }
    try {
      setSaving(true);
      let receiptPath: string | null = null;
      if (isSupabaseConfigured() && supabase) {
        if (receiptFile) {
          const ext = receiptFile.name.split('.').pop() || 'bin';
          const path = `recipients/${recipient.id}/payments/month-${monthIndex}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from(STUDY_LOAN_BUCKET)
            .upload(path, receiptFile, { upsert: true });
          if (uploadError) throw uploadError;
          receiptPath = path;
        }
        const { error: payError } = await supabase.from('study_loan_payments').insert({
          recipient_id: recipient.id,
          amount,
          payment_month: monthIndex,
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
          paymentMonth: monthIndex,
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
      setSelectedMonth(null);
      setAmountInput('');
      setReceiptFile(null);
      await loadPayments();
    } catch (e: any) {
      alert(e?.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const withPaymentsByMonth = useMemo(() => {
    const map: Record<number, PaymentRow | undefined> = {};
    for (const p of payments) {
      if (p.payment_month != null && map[p.payment_month] == null) {
        map[p.payment_month] = p;
      }
    }
    return map;
  }, [payments]);

  const totalLoaned = recipient.loan_amount;
  const totalPaid = recipient.total_paid;
  const remaining = Math.max(0, totalLoaned - totalPaid);
  const progressPct = totalLoaned > 0 ? (totalPaid / totalLoaned) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="font-semibold text-lg">Loan repayments · {recipient.full_name}</h1>
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

        <Tabs value={tab} onValueChange={(v) => setTab(v as 'monthly' | 'annually')}>
          <TabsList className="grid grid-cols-2 w-full max-w-xs">
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annually">Annually</TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monthly schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading payments...
                  </div>
                ) : (
                  schedule.map((m) => {
                    const pay = withPaymentsByMonth[m.index];
                    const isEditing = selectedMonth === m.index;
                    return (
                      <div
                        key={m.index}
                        className="border rounded-lg px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{m.label}</span>
                            {pay && <Badge variant="outline">Paid</Badge>}
                          </div>
                          <p className="text-xs text-gray-500">{m.date}</p>
                          {pay && (
                            <p className="text-xs text-gray-600">
                              Paid RM {pay.amount.toLocaleString()} on{' '}
                              {new Date(pay.paid_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 w-full sm:w-auto">
                          {pay ? (
                            <div className="flex gap-2 justify-end">
                              {pay.receipt_path && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openReceipt(pay.receipt_path)}
                                >
                                  <ExternalLink className="w-3 h-3 mr-1" />
                                  View receipt
                                </Button>
                              )}
                            </div>
                          ) : isEditing ? (
                            <div className="space-y-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Amount (RM)</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={amountInput}
                                  onChange={(e) => setAmountInput(e.target.value)}
                                  placeholder={String(Math.floor(recipient.loan_amount / MONTHLY_PAYMENTS))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Receipt / proof (optional)</Label>
                                <div className="border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-center">
                                  <input
                                    type="file"
                                    accept="image/*,.pdf"
                                    id={`receipt-${m.index}`}
                                    className="hidden"
                                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                                  />
                                  <label
                                    htmlFor={`receipt-${m.index}`}
                                    className="cursor-pointer text-xs text-gray-600"
                                  >
                                    {receiptFile ? receiptFile.name : 'Upload receipt (optional)'}
                                  </label>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedMonth(null);
                                    setAmountInput('');
                                    setReceiptFile(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveMonth(m.index)}
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Saving...
                                    </>
                                  ) : (
                                    'Save'
                                  )}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMonth(m.index);
                                  setAmountInput(
                                    String(Math.floor(recipient.loan_amount / MONTHLY_PAYMENTS)),
                                  );
                                  setReceiptFile(null);
                                }}
                              >
                                Record payment
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="annually" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Yearly summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {payments.length === 0 ? (
                  <p className="text-gray-500 text-sm">No payments recorded yet.</p>
                ) : (
                  Object.entries(
                    payments.reduce<Record<string, number>>((acc, p) => {
                      const year = new Date(p.paid_at).getFullYear().toString();
                      acc[year] = (acc[year] || 0) + p.amount;
                      return acc;
                    }, {}),
                  )
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([year, total]) => (
                      <div
                        key={year}
                        className="flex items-center justify-between border-b last:border-b-0 pb-2"
                      >
                        <span>{year} Yearly total</span>
                        <span className="font-semibold">RM {total.toLocaleString()}</span>
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

