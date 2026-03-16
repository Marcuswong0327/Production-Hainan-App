import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { ArrowLeft, CreditCard, Clock, CheckCircle2, XCircle, Loader2, DollarSign } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StudyLoanApplication, StudyLoanStatus } from '../types/studyLoan';

const MONTHLY_PAYMENTS = 20;

const loanTypeLabels: Record<string, string> = {
  degree: 'Degree (学士)',
  tvet: 'TVET (技职教育)',
  master_phd: 'Master/PhD (硕士/博士)',
};

export function StudyLoanStatusPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [application, setApplication] = useState<StudyLoanApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const fetchApplication = async () => {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('study_loan_applications')
          .select('*')
          .eq('user_id', user.id)
          .order('applied_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!error && data) {
          const row = data as StudyLoanApplication & { total_paid?: number; payments_made?: number };
          setApplication({
            ...row,
            total_paid: row.total_paid ?? 0,
            payments_made: row.payments_made ?? 0,
          });
        }
      } else {
        const applications = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const repayments: Record<string, { totalPaid: number; paymentsMade: number }> = JSON.parse(localStorage.getItem('myHainanStudyLoanRepayments') || '{}');
        const mine = applications.find((a: any) => a.userId === user.id);
        if (mine) {
          const rep = repayments[mine.id] || { totalPaid: 0, paymentsMade: 0 };
          setApplication({
            id: mine.id,
            user_id: mine.userId,
            association: mine.association,
            full_name: mine.fullName,
            age: mine.age,
            email: mine.email || user.email || '',
            university: mine.university,
            courses: mine.courses,
            admission_date: mine.admissionDate,
            expected_graduation_date: mine.expectedGraduationDate,
            phone_number: mine.phoneNumber,
            offer_letter_path: null,
            ic_front_path: null,
            ic_back_path: null,
            guarantor_ic_front_path: null,
            guarantor_ic_back_path: null,
            guarantor_relationship: mine.guarantorRelationship,
            guarantor_phone_number: mine.guarantorPhoneNumber,
            loan_type: mine.loanType,
            loan_amount: mine.loanAmount,
            status: mine.status,
            applied_at: mine.appliedDate,
            reviewed_at: null,
            rejection_reason: mine.rejectionReason || null,
            created_at: mine.appliedDate,
            updated_at: mine.appliedDate,
            total_paid: rep.totalPaid,
            payments_made: rep.paymentsMade,
          });
        }
      }
      setLoading(false);
    };
    fetchApplication();
  }, [user?.id]);

  const statusConfig: Record<StudyLoanStatus, { icon: typeof Clock; label: string; color: string; bg: string; message: string }> = {
    pending: {
      icon: Clock,
      label: 'Under review',
      color: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200',
      message: 'Your study loan application has been submitted. Super admin will review it. You will be notified when there is an update. Repayment details will be available after approval.',
    },
    approved: {
      icon: CheckCircle2,
      label: 'Approved',
      color: 'text-green-700',
      bg: 'bg-green-50 border-green-200',
      message: 'Your study loan has been approved. You can start repaying below.',
    },
    rejected: {
      icon: XCircle,
      label: 'Rejected',
      color: 'text-red-700',
      bg: 'bg-red-50 border-red-200',
      message: 'Your application was not approved. See reason below if provided.',
    },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" onClick={onBack} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          <Card className="shadow-xl">
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-600">You have not submitted a study loan application yet.</p>
              <Button onClick={onBack} className="mt-4">
                Back to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const config = statusConfig[application.status];
  const StatusIcon = config.icon;

  const loanAmount = application.loan_amount ?? 0;
  const totalPaid = application.total_paid ?? 0;
  const paymentsMade = application.payments_made ?? 0;
  const monthlyPayment = Math.floor(loanAmount / MONTHLY_PAYMENTS);
  const remaining = Math.max(0, loanAmount - totalPaid);
  const progressPercent = loanAmount > 0 ? (totalPaid / loanAmount) * 100 : 0;
  const isRepaid = remaining <= 0;

  const handlePayment = async (amount: number) => {
    setPaying(true);
    try {
      if (isSupabaseConfigured() && supabase) {
        const newTotalPaid = totalPaid + amount;
        const newPaymentsMade = paymentsMade + 1;
        const { error } = await supabase
          .from('study_loan_applications')
          .update({
            total_paid: newTotalPaid,
            payments_made: newPaymentsMade,
            updated_at: new Date().toISOString(),
          })
          .eq('id', application.id);
        if (!error) {
          setApplication({ ...application, total_paid: newTotalPaid, payments_made: newPaymentsMade });
        } else throw error;
      } else {
        const repayments: Record<string, { totalPaid: number; paymentsMade: number }> = JSON.parse(localStorage.getItem('myHainanStudyLoanRepayments') || '{}');
        const rep = repayments[application.id] || { totalPaid: 0, paymentsMade: 0 };
        rep.totalPaid += amount;
        rep.paymentsMade += 1;
        repayments[application.id] = rep;
        localStorage.setItem('myHainanStudyLoanRepayments', JSON.stringify(repayments));
        setApplication({ ...application, total_paid: rep.totalPaid, payments_made: rep.paymentsMade });
      }
    } catch (e: any) {
      alert(e?.message || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <Card className="shadow-xl">
          <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <div className="flex items-center gap-3">
              <CreditCard className="w-8 h-8" />
              <div>
                <CardTitle className="text-2xl">Study Loan Application Status</CardTitle>
                <p className="text-sm text-blue-100 mt-1">教育贷款申请状态</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className={`rounded-lg border p-4 ${config.bg}`}>
              <div className="flex items-center gap-3 mb-2">
                <StatusIcon className={`w-8 h-8 ${config.color}`} />
                <span className={`font-semibold text-lg ${config.color}`}>{config.label}</span>
              </div>
              <p className="text-gray-700">{config.message}</p>
            </div>

            {application.status === 'approved' && (
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Repayment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-600">Total loan</p>
                      <p className="text-xl font-bold text-gray-900">RM {loanAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-sm text-gray-600">Remaining</p>
                      <p className="text-xl font-bold text-green-700">RM {remaining.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium">{progressPercent.toFixed(0)}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                    <p className="text-xs text-gray-500">{paymentsMade} / {MONTHLY_PAYMENTS} payments · RM {totalPaid.toLocaleString()} paid</p>
                  </div>
                  {!isRepaid && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-700">Monthly payment: <strong>RM {monthlyPayment.toLocaleString()}</strong> (due by 8th of each month)</p>
                      <Button
                        className="w-full"
                        size="lg"
                        disabled={paying}
                        onClick={() => handlePayment(monthlyPayment)}
                      >
                        {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</> : `Pay RM ${monthlyPayment.toLocaleString()} (monthly)`}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        disabled={paying || remaining < monthlyPayment}
                        onClick={() => handlePayment(remaining)}
                      >
                        Pay full balance (RM {remaining.toLocaleString()})
                      </Button>
                    </div>
                  )}
                  {isRepaid && (
                    <div className="bg-green-100 border border-green-300 rounded-lg p-4 text-center">
                      <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
                      <p className="font-semibold text-green-900">Loan fully repaid</p>
                      <p className="text-sm text-green-700 mt-1">Thank you for completing your repayment.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Name</span><br />{application.full_name}</div>
              <div><span className="text-gray-500">University</span><br />{application.university}</div>
              <div><span className="text-gray-500">Loan type</span><br />{loanTypeLabels[application.loan_type] || application.loan_type}</div>
              <div><span className="text-gray-500">Amount</span><br />RM {application.loan_amount?.toLocaleString()}</div>
              <div><span className="text-gray-500">Applied on</span><br />{new Date(application.applied_at).toLocaleDateString()}</div>
            </div>

            {application.status === 'rejected' && application.rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-red-900 mb-1">Rejection reason</p>
                <p className="text-sm text-red-800">{application.rejection_reason}</p>
              </div>
            )}

            <Button onClick={onBack} variant="outline" className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
