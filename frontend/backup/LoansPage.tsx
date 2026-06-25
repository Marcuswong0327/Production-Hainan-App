import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { ArrowLeft, CreditCard, DollarSign, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/badge';

export function LoansPage({ onBack }: { onBack: () => void }) {
    const { user } = useAuth();
    const [hasLoan, setHasLoan] = useState(false);
    const [loan, setLoan] = useState<any>(null);
    const [showApplyForm, setShowApplyForm] = useState(false);
    const [loanAmount, setLoanAmount] = useState('');
    const [loanPurpose, setLoanPurpose] = useState('');

    useEffect(() => {
        // Load user's loan from localStorage
        const loans = JSON.parse(localStorage.getItem('myHainanLoans') || '[]');
        const userLoan = loans.find((l: any) => l.userId === user?.id);
        if (userLoan) {
            setHasLoan(true);
            setLoan(userLoan);
        }
    }, [user]);

    const handleApplyLoan = () => {
        const loans = JSON.parse(localStorage.getItem('myHainanLoans') || '[]');
        const newLoan = {
            id: Date.now().toString(),
            userId: user?.id,
            amount: 4000, // Fixed study loan amount
            purpose: loanPurpose,
            appliedDate: new Date().toISOString(),
            status: 'approved',
            monthlyPayment: 200, // Fixed monthly payment
            totalPaid: 0,
            remainingBalance: 4000,
            paymentsMade: 0,
            totalPayments: 20, // 4000 / 200 = 20 months
            nextPaymentDate: getNextMonthDate(),
        };
        loans.push(newLoan);
        localStorage.setItem('myHainanLoans', JSON.stringify(loans));
        setLoan(newLoan);
        setHasLoan(true);
        setShowApplyForm(false);
    };

    const getNextMonthDate = () => {
        const next = new Date();
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        return next.toISOString();
    };

    const handlePayment = (amount: number) => {
        const loans = JSON.parse(localStorage.getItem('myHainanLoans') || '[]');
        const loanIndex = loans.findIndex((l: any) => l.id === loan.id);

        const newTotalPaid = loan.totalPaid + amount;
        const newRemainingBalance = 4000 - newTotalPaid;
        const newPaymentsMade = loan.paymentsMade + 1;

        // Award points for payment
        const pointsEarned = Math.floor(amount / 10);
        if (user) {
            const updatedUser = { ...user, points: (user.points || 0) + pointsEarned };
            localStorage.setItem('myHainanUser', JSON.stringify(updatedUser));
        }

        const updatedLoan = {
            ...loan,
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentsMade: newPaymentsMade,
            status: newRemainingBalance <= 0 ? 'completed' : 'approved',
            nextPaymentDate: newRemainingBalance > 0 ? getNextMonthDate() : null,
        };

        loans[loanIndex] = updatedLoan;
        localStorage.setItem('myHainanLoans', JSON.stringify(loans));
        setLoan(updatedLoan);
    };

    const getDaysUntilPayment = () => {
        if (!loan?.nextPaymentDate) return 0;
        const next = new Date(loan.nextPaymentDate);
        const today = new Date();
        const diff = next.getTime() - today.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const progressPercentage = loan ? (loan.totalPaid / loan.amount) * 100 : 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
            <div className="max-w-2xl mx-auto">
                <Button variant="ghost" onClick={onBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </Button>

                {!hasLoan && !showApplyForm ? (
                    <Card className="shadow-xl">
                        <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                            <div className="flex items-center gap-3">
                                <CreditCard className="w-8 h-8" />
                                <div>
                                    <CardTitle className="text-2xl">Community Loans 互助贷款</CardTitle>
                                    <p className="text-sm text-blue-100 mt-1">Interest-free loans for members</p>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-6 space-y-6">
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <DollarSign className="w-10 h-10 text-blue-600" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">No Active Loan</h3>
                                <p className="text-gray-600 mb-6">Apply for an interest-free community loan</p>

                                <div className="bg-blue-50 p-4 rounded-lg mb-6 text-left">
                                    <h4 className="font-semibold mb-2">Loan Benefits:</h4>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                                            <span>0% interest rate for members</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                                            <span>Flexible repayment up to 12 months</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                                            <span>Earn points for on-time payments</span>
                                        </li>
                                        <li className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                                            <span>Maximum loan: RM10,000</span>
                                        </li>
                                    </ul>
                                </div>

                                <Button onClick={() => setShowApplyForm(true)} size="lg" className="w-full">
                                    Apply for Loan
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : showApplyForm ? (
                    <Card className="shadow-xl">
                        <CardHeader className="border-b">
                            <CardTitle>Apply for Study Loan 教育贷款</CardTitle>
                            <p className="text-sm text-gray-600 mt-1">Fixed amount for Hainan students</p>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                                <h4 className="font-semibold mb-3 text-blue-900">Study Loan Details</h4>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Loan Amount:</span>
                                        <span className="font-bold text-blue-900">RM 4,000.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Monthly Payment:</span>
                                        <span className="font-bold text-blue-900">RM 200.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Repayment Period:</span>
                                        <span className="font-bold text-blue-900">20 months</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-700">Interest Rate:</span>
                                        <span className="font-bold text-green-600">0% 免息</span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Purpose of Study Loan</Label>
                                <Input
                                    type="text"
                                    placeholder="e.g., University tuition, Books, Accommodation"
                                    value={loanPurpose}
                                    onChange={(e) => setLoanPurpose(e.target.value)}
                                />
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                                <p className="text-xs text-gray-700">
                                    <strong>Note:</strong> Payment starts immediately after graduation.
                                    Monthly payments of RM200 will be due on the 1st of each month.
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setShowApplyForm(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleApplyLoan}
                                    disabled={!loanPurpose}
                                    className="flex-1"
                                >
                                    Submit Application
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {/* Loan Overview Card */}
                        <Card className="shadow-xl">
                            <CardHeader className="border-b bg-gradient-to-r from-green-500 to-green-600 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-2xl">Active Loan</CardTitle>
                                        <p className="text-sm text-green-100 mt-1">{loan.purpose}</p>
                                    </div>
                                    <Badge className={`${loan.status === 'completed' ? 'bg-white/20 text-white' : 'bg-white/90 text-green-600'
                                        }`}>
                                        {loan.status === 'completed' ? 'Completed' : 'Active'}
                                    </Badge>
                                </div>
                            </CardHeader>

                            <CardContent className="pt-6 space-y-6">
                                {/* Balance Overview */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Total Loan</p>
                                        <p className="text-2xl font-bold text-gray-900">RM{loan.amount.toFixed(2)}</p>
                                    </div>
                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                        <p className="text-sm text-gray-600 mb-1">Remaining</p>
                                        <p className="text-2xl font-bold text-green-600">
                                            RM{loan.remainingBalance.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Repayment Progress</span>
                                        <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
                                    </div>
                                    <Progress value={progressPercentage} className="h-3" />
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>RM{loan.totalPaid.toFixed(2)} paid</span>
                                        <span>{loan.paymentsMade}/{loan.totalPayments} payments</span>
                                    </div>
                                </div>

                                {/* Payment Info */}
                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="w-5 h-5 text-blue-600" />
                                        <h4 className="font-semibold">Monthly Payment</h4>
                                    </div>
                                    <p className="text-3xl font-bold text-blue-600">
                                        RM{loan.monthlyPayment.toFixed(2)}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">Due on the 1st of each month</p>
                                </div>

                                {/* Payment Actions */}
                                {loan.status !== 'completed' && (
                                    <div className="space-y-2">
                                        <Button
                                            onClick={() => handlePayment(loan.monthlyPayment)}
                                            className="w-full"
                                            size="lg"
                                        >
                                            Make Monthly Payment (RM{loan.monthlyPayment.toFixed(2)})
                                        </Button>
                                        <Button
                                            onClick={() => handlePayment(loan.remainingBalance)}
                                            variant="outline"
                                            className="w-full"
                                        >
                                            Pay Full Balance (RM{loan.remainingBalance.toFixed(2)})
                                        </Button>
                                        <p className="text-xs text-center text-gray-500">
                                            Earn {Math.floor(loan.monthlyPayment / 10)} points per payment! 🎯
                                        </p>
                                    </div>
                                )}

                                {loan.status === 'completed' && (
                                    <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                                        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
                                        <h4 className="font-semibold text-green-900">Loan Completed!</h4>
                                        <p className="text-sm text-green-700 mt-1">
                                            Congratulations on completing your loan repayment!
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}