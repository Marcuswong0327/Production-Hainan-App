import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, CreditCard, DollarSign, CheckCircle2, Camera, FileText, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { STUDY_LOAN_BUCKET } from '../types/studyLoan';
//import { checkPaymentDeadlines, isPaymentOverdue } from '../DeadlineSimulator';

export function LoansPage({ onBack, onApplied }: { onBack: () => void; onApplied?: () => void }) {
  const { user } = useAuth();
  const [hasExistingApplication, setHasExistingApplication] = useState(false);
  const [showIntroduction, setShowIntroduction] = useState(true);
  const [showConsent, setShowConsent] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applicationStep, setApplicationStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Application form state
  const [formData, setFormData] = useState({
    association: '',
    fullName: '',
    age: '',
    email: '',
    university: '',
    courses: '',
    admissionDate: '',
    expectedGraduationDate: '',
    phoneNumber: '',
    offerLetter: null as File | null,
    icFront: null as File | null,
    icBack: null as File | null,
    guarantorIcFront: null as File | null,
    guarantorIcBack: null as File | null,
    guarantorRelationship: '',
    guarantorPhoneNumber: '',
    loanType: '',
  });

  // Check for existing study loan application (Supabase or localStorage)
  useEffect(() => {
    if (!user?.id) return;
    const check = async () => {
      if (isSupabaseConfigured() && supabase) {
        const { data } = await supabase
          .from('study_loan_applications')
          .select('id')
          .eq('user_id', user.id)
          .order('applied_at', { ascending: false })
          .limit(1);
        setHasExistingApplication((data?.length ?? 0) > 0);
      } else {
        const applications = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        setHasExistingApplication(applications.some((a: any) => a.userId === user?.id));
      }
    };
    check();
  }, [user?.id]);

  const getLoanAmount = (loanType: string) => {
    switch (loanType) {
      case 'degree':
        return 4000;
      case 'tvet':
        return 4000;
      case 'master_phd':
        return 5000;
      default:
        return 0;
    }
  };

  const handleFileUpload = (field: string, file: File | null) => {
    setFormData({ ...formData, [field]: file });
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const isValidPhone = (value: string) => {
    const raw = value.replace(/[\s-]/g, '');
    if (!raw) return false;
    if (!/^\+?60?\d{9,11}$/.test(raw)) return false;
    if (/^(\d)\1{5,}$/.test(raw.replace(/^\+?60/, ''))) return false;
    return true;
  };

  const areDatesValid = (admission: string, graduation: string) => {
    if (!admission || !graduation) return false;
    const start = new Date(admission);
    const end = new Date(graduation);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    if (start >= end) return false;
    const diffMs = end.getTime() - start.getTime();
    const yearMs = 365 * 24 * 60 * 60 * 1000;
    if (diffMs < yearMs) return false;
    if (diffMs > 8 * yearMs) return false;
    return true;
  };

  const handleSubmitApplication = async () => {
    if (!user?.id) return;
    setSubmitting(true);
    setSubmitError(null);
    setValidationError(null);

    const ageNum = parseInt(formData.age, 10);
    if (Number.isNaN(ageNum) || ageNum < 17 || ageNum > 65) {
      setValidationError('Please enter a valid age between 17 and 65.');
      setSubmitting(false);
      return;
    }
    if (!isValidEmail(formData.email)) {
      setValidationError('Please enter a valid email address.');
      setSubmitting(false);
      return;
    }
    if (!isValidPhone(formData.phoneNumber)) {
      setValidationError('Please enter a valid phone number (e.g. 012-3456789 or +60...).');
      setSubmitting(false);
      return;
    }
    if (!areDatesValid(formData.admissionDate, formData.expectedGraduationDate)) {
      setValidationError('Admission date must be before graduation date, with course length between 1 and 8 years.');
      setSubmitting(false);
      return;
    }

    const loanAmount = getLoanAmount(formData.loanType);

    try {
      if (isSupabaseConfigured() && supabase) {
        const client = supabase;
        const id = crypto.randomUUID();
        const prefix = `${id}`;

        const upload = async (file: File | null, pathKey: string): Promise<string | null> => {
          if (!file) return null;
          const ext = file.name.split('.').pop() || 'bin';
          const path = `${prefix}/${pathKey}.${ext}`;
          const { error } = await client.storage.from(STUDY_LOAN_BUCKET).upload(path, file, { upsert: true });
          if (error) throw new Error(`Upload failed: ${pathKey}`);
          return path;
        };

        const offerLetterPath = await upload(formData.offerLetter, 'offer_letter');
        const icFrontPath = await upload(formData.icFront, 'ic_front');
        const icBackPath = await upload(formData.icBack, 'ic_back');
        const guarantorIcFrontPath = await upload(formData.guarantorIcFront, 'guarantor_ic_front');
        const guarantorIcBackPath = await upload(formData.guarantorIcBack, 'guarantor_ic_back');

        const { error } = await client.from('study_loan_applications').insert({
          id,
          user_id: user.id,
          association: formData.association,
          full_name: formData.fullName,
          age: formData.age,
          email: formData.email,
          university: formData.university,
          courses: formData.courses,
          admission_date: formData.admissionDate,
          expected_graduation_date: formData.expectedGraduationDate,
          phone_number: formData.phoneNumber,
          offer_letter_path: offerLetterPath,
          ic_front_path: icFrontPath,
          ic_back_path: icBackPath,
          guarantor_ic_front_path: guarantorIcFrontPath,
          guarantor_ic_back_path: guarantorIcBackPath,
          guarantor_relationship: formData.guarantorRelationship,
          guarantor_phone_number: formData.guarantorPhoneNumber,
          loan_type: formData.loanType,
          loan_amount: loanAmount,
          status: 'pending',
        });
        if (error) throw error;
      } else {
        const applications = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        applications.push({
          id: Date.now().toString(),
          userId: user.id,
          ...formData,
          offerLetterName: formData.offerLetter?.name || '',
          icFrontName: formData.icFront?.name || '',
          icBackName: formData.icBack?.name || '',
          guarantorIcFrontName: formData.guarantorIcFront?.name || '',
          guarantorIcBackName: formData.guarantorIcBack?.name || '',
          loanAmount,
          appliedDate: new Date().toISOString(),
          status: 'pending',
        });
        localStorage.setItem('myHainanLoanApplications', JSON.stringify(applications));
      }

      setHasExistingApplication(true);
      setShowApplyForm(false);
      setShowIntroduction(false);
      setShowConsent(false);
      setApplicationStep(1);
      onApplied?.();
    } catch (e: any) {
      setSubmitError(e?.message || 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return formData.association !== '';
      case 2:
        return (
          formData.fullName.trim() !== '' &&
          formData.age.trim() !== '' &&
          isValidEmail(formData.email) &&
          formData.university.trim() !== '' &&
          formData.courses.trim() !== '' &&
          areDatesValid(formData.admissionDate, formData.expectedGraduationDate) &&
          isValidPhone(formData.phoneNumber) &&
          formData.offerLetter !== null
        );
      case 3:
        return formData.icFront !== null && formData.icBack !== null;
      case 4:
        return formData.guarantorIcFront !== null && formData.guarantorIcBack !== null &&
          formData.guarantorRelationship !== '' && formData.guarantorPhoneNumber !== '';
      case 5:
        return formData.loanType !== '';
      default:
        return false;
    }
  };

  // Hainan associations list
  const hainanAssociations = [
    'Selangor Hainan Association',
    'Kuala Lumpur Hainan Association',
    'Penang Hainan Association',
    'Johor Hainan Association',
    'Melaka Hainan Association',
    'Negeri Sembilan Hainan Association',
    'Perak Hainan Association',
    'Kedah Hainan Association',
    'Perlis Hainan Association',
    'Kelantan Hainan Association',
    'Terengganu Hainan Association',
    'Pahang Hainan Association',
    'Sabah Hainan Association',
    'Sarawak Hainan Association',
  ];

  const loanTypes = [
    { value: 'degree', label: 'Degree (学士)', amount: 'RM 4,000' },
    { value: 'tvet', label: 'TVET (技职教育)', amount: 'RM 4,000' },
    { value: 'master_phd', label: 'Master/PhD (硕士/博士)', amount: 'RM 5,000' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {/* View application status (when user already has an application) */}
        {showIntroduction && !showApplyForm && !showConsent && hasExistingApplication && onApplied ? (
          <Card className="shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8" />
                <div>
                  <CardTitle className="text-2xl">Study Loan Application</CardTitle>
                  <p className="text-sm text-blue-100 mt-1">Check your application status</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-gray-700 mb-4">
                You have already submitted a study loan application. Super admin will review it. You can check the status and any updates on the status page.
              </p>
              <Button onClick={onApplied} className="w-full" size="lg">
                View application status
              </Button>
            </CardContent>
          </Card>
        ) : showIntroduction && !showApplyForm && !showConsent ? (
          <Card className="shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <div className="flex items-center gap-3">
                <CreditCard className="w-8 h-8" />
                <div>
                  <CardTitle className="text-2xl">Study Loans 教育贷款</CardTitle>
                  <p className="text-sm text-blue-100 mt-1">Supporting Hainan students in their educational journey</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold mb-4">About Study Loans</h3>
                <div className="bg-blue-50 p-6 rounded-lg mb-6 text-left space-y-4">
                  <p className="text-gray-700">
                    The Hainan Association Study Loan Program is designed to support students from Hainan associations
                    in pursuing their higher education. We offer interest-free loans to help cover tuition fees,
                    living expenses, and other educational costs.
                  </p>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-900">Loan Types Available:</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span><strong>Degree Programs:</strong> Up to RM 4,000</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span><strong>TVET Programs:</strong> Up to RM 4,000</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span><strong>Master/PhD Programs:</strong> Up to RM 5,000</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2 mt-4">
                    <h4 className="font-semibold text-blue-900">Key Features:</h4>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>0% interest rate</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>Flexible repayment terms</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>Repayment starts after graduation</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5" />
                        <span>Support for various educational programs</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <Button onClick={() => setShowConsent(true)} size="lg" className="w-full">
                  Continue to Application
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : showConsent && !showApplyForm ? (
          <Card className="shadow-xl">
            <CardHeader className="border-b">
              <CardTitle>Privacy & Consent</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <h4 className="font-semibold mb-3 text-yellow-900">Important Information</h4>
                <p className="text-sm text-gray-700 mb-3">
                  To process your study loan application, we will need to collect and process your personal information,
                  including but not limited to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 mb-3">
                  <li>Personal identification details (Name, Age, IC Number)</li>
                  <li>Educational information (University, Courses, Admission details)</li>
                  <li>Contact information (Phone number)</li>
                  <li>Supporting documents (Offer letter, IC copies)</li>
                  <li>Guarantor information</li>
                </ul>
                <p className="text-sm text-gray-700 font-semibold">
                  We assure you that all personal information will be kept strictly private and confidential.
                  Your data will only be used for the purpose of processing your loan application and will not
                  be shared with third parties without your explicit consent.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowConsent(false)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setShowApplyForm(true)} className="flex-1">
                  I Understand and Agree
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : showApplyForm ? (
          <Card className="shadow-xl">
            <CardHeader className="border-b">
              <CardTitle>Study Loan Application</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Step {applicationStep} of 5</p>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-6">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${applicationStep >= step ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                      {step}
                    </div>
                    {step < 5 && <div className={`flex-1 h-1 mx-1 ${applicationStep > step ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Association */}
              {applicationStep === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">1. Hainan Association</h3>
                  <div className="space-y-2">
                    <Label>From which Hainan association?</Label>
                    <Select value={formData.association} onValueChange={(value) => handleInputChange('association', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your association" />
                      </SelectTrigger>
                      <SelectContent>
                        {hainanAssociations.map((assoc) => (
                          <SelectItem key={assoc} value={assoc}>
                            {assoc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setShowApplyForm(false); setShowConsent(false); }} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={() => setApplicationStep(2)} disabled={!isStepValid(1)} className="flex-1">
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Personal Information */}
              {applicationStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">2. Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Full Name *</Label>
                      <Input
                        value={formData.fullName}
                        onChange={(e) => handleInputChange('fullName', e.target.value)}
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Age *</Label>
                      <Input
                        type="number"
                        value={formData.age}
                        onChange={(e) => handleInputChange('age', e.target.value)}
                        placeholder="Enter your age"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                  {validationError && (
                    <p className="text-xs text-red-600">{validationError}</p>
                  )}
                  <div className="space-y-2">
                    <Label>University *</Label>
                    <Input
                      value={formData.university}
                      onChange={(e) => handleInputChange('university', e.target.value)}
                      placeholder="Enter university name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Courses *</Label>
                    <Input
                      value={formData.courses}
                      onChange={(e) => handleInputChange('courses', e.target.value)}
                      placeholder="Enter course name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Admission Date *</Label>
                      <Input
                        type="date"
                        value={formData.admissionDate}
                        onChange={(e) => handleInputChange('admissionDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Graduation Date *</Label>
                      <Input
                        type="date"
                        value={formData.expectedGraduationDate}
                        onChange={(e) => handleInputChange('expectedGraduationDate', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <Input
                      value={formData.phoneNumber}
                      onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                      placeholder="012-345-6789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Offer Letter (PDF) *</Label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileUpload('offerLetter', e.target.files?.[0] || null)}
                        className="hidden"
                        id="offerLetter"
                      />
                      <label htmlFor="offerLetter" className="cursor-pointer">
                        <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                          {formData.offerLetter ? formData.offerLetter.name : 'Click to upload PDF'}
                        </p>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setApplicationStep(1)} className="flex-1">
                      Back
                    </Button>
                    <Button onClick={() => setApplicationStep(3)} disabled={!isStepValid(2)} className="flex-1">
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Student IC */}
              {applicationStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">3. Student IC (Front & Back)</h3>
                  <p className="text-sm text-gray-600">
                    Please ensure good lighting and avoid flash when taking photos. The text should be clearly visible.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IC Front *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileUpload('icFront', e.target.files?.[0] || null)}
                          className="hidden"
                          id="icFront"
                        />
                        <label htmlFor="icFront" className="cursor-pointer">
                          <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {formData.icFront ? formData.icFront.name : 'Take/Upload Photo'}
                          </p>
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>IC Back *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileUpload('icBack', e.target.files?.[0] || null)}
                          className="hidden"
                          id="icBack"
                        />
                        <label htmlFor="icBack" className="cursor-pointer">
                          <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {formData.icBack ? formData.icBack.name : 'Take/Upload Photo'}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-700">
                      <strong>Note:</strong> This will be processed using Gemini 1.5 Flash AI API to extract text from your IC.
                      Make sure the image is clear and well-lit.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setApplicationStep(2)} className="flex-1">
                      Back
                    </Button>
                    <Button onClick={() => setApplicationStep(4)} disabled={!isStepValid(3)} className="flex-1">
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Guarantor Information */}
              {applicationStep === 4 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">4. Guarantor Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Guarantor IC Front *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileUpload('guarantorIcFront', e.target.files?.[0] || null)}
                          className="hidden"
                          id="guarantorIcFront"
                        />
                        <label htmlFor="guarantorIcFront" className="cursor-pointer">
                          <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {formData.guarantorIcFront ? formData.guarantorIcFront.name : 'Take/Upload Photo'}
                          </p>
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Guarantor IC Back *</Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => handleFileUpload('guarantorIcBack', e.target.files?.[0] || null)}
                          className="hidden"
                          id="guarantorIcBack"
                        />
                        <label htmlFor="guarantorIcBack" className="cursor-pointer">
                          <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {formData.guarantorIcBack ? formData.guarantorIcBack.name : 'Take/Upload Photo'}
                          </p>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship to Student *</Label>
                    <Select value={formData.guarantorRelationship} onValueChange={(value) => handleInputChange('guarantorRelationship', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dad">Dad (父亲)</SelectItem>
                        <SelectItem value="mom">Mom (母亲)</SelectItem>
                        <SelectItem value="uncle">Uncle (叔叔/舅舅)</SelectItem>
                        <SelectItem value="aunty">Aunty (阿姨/姑姑)</SelectItem>
                        <SelectItem value="brother">Brother (兄弟)</SelectItem>
                        <SelectItem value="sister">Sister (姐妹)</SelectItem>
                        <SelectItem value="other">Other (其他)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Guarantor Phone Number *</Label>
                    <Input
                      value={formData.guarantorPhoneNumber}
                      onChange={(e) => handleInputChange('guarantorPhoneNumber', e.target.value)}
                      placeholder="012-345-6789"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setApplicationStep(3)} className="flex-1">
                      Back
                    </Button>
                    <Button onClick={() => setApplicationStep(5)} disabled={!isStepValid(4)} className="flex-1">
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 5: Loan Type */}
              {applicationStep === 5 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">5. Loan Type Selection</h3>
                  <div className="space-y-2">
                    <Label>Select Loan Type *</Label>
                    <Select value={formData.loanType} onValueChange={(value) => handleInputChange('loanType', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select loan type" />
                      </SelectTrigger>
                      <SelectContent>
                        {loanTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label} - {type.amount}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.loanType && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Selected Loan Details:</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-700">Loan Type:</span>
                          <span className="font-bold text-blue-900">
                            {loanTypes.find(t => t.value === formData.loanType)?.label}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Loan Amount:</span>
                          <span className="font-bold text-blue-900">
                            {loanTypes.find(t => t.value === formData.loanType)?.amount}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">Estimated Monthly Payment:</span>
                          <span className="font-bold text-blue-900">
                            RM {Math.floor(getLoanAmount(formData.loanType) / 20).toLocaleString()}.00
                          </span>
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
                  )}
                  {submitError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded-lg">
                      {submitError}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setApplicationStep(4)} className="flex-1" disabled={submitting}>
                      Back
                    </Button>
                    <Button onClick={handleSubmitApplication} disabled={!isStepValid(5) || submitting} className="flex-1">
                      {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</> : 'Submit Application'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}