import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import type { LoanRecipient } from '../types/studyLoan';
import { STUDY_LOAN_BUCKET } from '../types/studyLoan';
// import { extractTextFromImage, isGeminiConfigured } from '../lib/gemini';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { formatMalaysiaMobileDash, isValidMalaysiaMobileDash } from '../lib/malaysiaPhone';
import { AssociationSelect } from './AssociationSelect';

const LOAN_TYPES = [
  { value: 'degree', label: 'Degree (学士)', amount: 4000 },
  { value: 'tvet_vocational', label: 'TVET / Vocational (技职教育)', amount: 4000 },
  { value: 'master', label: 'Master (硕士)', amount: 6000 },
  { value: 'phd', label: 'PhD (博士)', amount: 6000 },
];

interface AddLoanRecipientPageProps {
  onBack: () => void;
  onSubmit: (recipient: LoanRecipient) => Promise<void>;
}

const initialForm = {
  association: '',
  full_name: '',
  full_name_chinese: '',
  age: '',
  email: '',
  phone_number: '',
  university: '',
  courses: '',
  admission_date: '',
  expected_graduation_date: '',
  loan_type: '',
  loan_amount: '',
  association_chairman: '',
  notes: '',
};

export function AddLoanRecipientPage({ onBack, onSubmit }: AddLoanRecipientPageProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  // const [aiLoading, setAiLoading] = useState<string | null>(null);
  // Offer letter: file only
  const [offerLetterFile, setOfferLetterFile] = useState<File | null>(null);
  // Combined IC files (single upload each, can be PDF with front+back)
  const [studentIcFile, setStudentIcFile] = useState<File | null>(null);
  // AI-extracted text preview (read-only; admin copies from here)
  // const [icFrontPreview, setIcFrontPreview] = useState('');
  // const [guarantorIcFrontPreview, setGuarantorIcFrontPreview] = useState('');

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const loanAmount = form.loan_type ? (LOAN_TYPES.find(t => t.value === form.loan_type)?.amount ?? 0) : 0;
  // /** Photo+AI: pick file → extract text (preview) and optionally save file for upload (so no need to upload again). */
  // const handleAiExtract = async (
  //   setPreview: (t: string) => void,
  //   prompt: string,
  //   setFile?: (f: File | null) => void
  // ) => {
  //   const input = document.createElement('input');
  //   input.type = 'file';
  //   input.accept = 'image/*,.pdf';
  //   input.onchange = async (e) => {
  //     const file = (e.target as HTMLInputElement).files?.[0];
  //     if (!file) return;
  //     if (setFile) setFile(file);
  //     setAiLoading('extract');
  //     try {
  //       const text = await extractTextFromImage(file, prompt);
  //       setPreview(text);
  //     } catch (err: any) {
  //       alert(err?.message || 'AI extraction failed');
  //     } finally {
  //       setAiLoading(null);
  //     }
  //   };
  //   input.click();
  // };

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const isValidPhone = (value: string) => isValidMalaysiaMobileDash(value);

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

  const handleSubmit = async () => {
    const amount = loanAmount;
    const paidAmount = Math.max(0, parseInt(form.loan_amount || '0', 10) || 0);
    const ageNum = form.age ? parseInt(form.age, 10) : NaN;
    if (!form.association || !form.full_name.trim() || !form.email.trim() || !form.phone_number.trim() || !form.university.trim() || !form.courses.trim() || !form.association_chairman.trim() || !form.loan_type || !amount || amount <= 0) {
      alert('Please fill all required fields (association, name, email, phone, university, courses, 属会主席, loan type/amount).');
      return;
    }
    if (paidAmount > amount) {
      alert('Paid amount cannot be more than the loan amount.');
      return;
    }
    if (form.age && (Number.isNaN(ageNum) || ageNum < 17 || ageNum > 65)) {
      alert('Please enter a valid age between 17 and 65.');
      return;
    }
    if (!isValidEmail(form.email)) {
      alert('Please enter a valid email address.');
      return;
    }
    if (!isValidPhone(form.phone_number)) {
      alert('Phone number must be in the format 01X-XXXXXXX (e.g. 011-1234567).');
      return;
    }
    if (form.admission_date && form.expected_graduation_date && !areDatesValid(form.admission_date, form.expected_graduation_date)) {
      alert('Admission date must be before graduation date, with course length between 1 and 8 years.');
      return;
    }
    setSubmitting(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      let offer_letter_path: string | null = null;
      let ic_front_path: string | null = null;
      let ic_back_path: string | null = null;

      if (isSupabaseConfigured() && supabase) {
        const prefix = `recipients/${id}`;
        const upload = async (file: File | null, pathKey: string): Promise<string | null> => {
          if (!file) return null;
          const ext = file.name.split('.').pop() || 'bin';
          const path = `${prefix}/${pathKey}.${ext}`;
          const { error } = await supabase.storage.from(STUDY_LOAN_BUCKET).upload(path, file, { upsert: true });
          if (error) throw new Error(`Upload failed: ${pathKey}`);
          return path;
        };
        offer_letter_path = await upload(offerLetterFile, 'offer_letter');
        const studentIcPath = await upload(studentIcFile, 'student_ic');
        // Keep compatibility with existing columns by storing the same file in front/back fields.
        ic_front_path = studentIcPath;
        ic_back_path = studentIcPath;
      }

      const recipient: LoanRecipient = {
        id,
        full_name: form.full_name.trim(),
        full_name_chinese: form.full_name_chinese.trim() || null,
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        association: form.association,
        university: form.university.trim(),
        courses: form.courses.trim(),
        admission_date: form.admission_date || '',
        expected_graduation_date: form.expected_graduation_date || '',
        loan_type: form.loan_type,
        loan_amount: amount,
        total_paid: paidAmount,
        payments_made: 0,
        status: paidAmount >= amount ? 'completed' : 'active',
        guarantor_relationship: form.association_chairman.trim(),
        guarantor_phone_number: '',
        offer_letter_path: offer_letter_path || null,
        ic_front_path: ic_front_path || null,
        ic_back_path: ic_back_path || null,
        guarantor_ic_front_path: null,
        guarantor_ic_back_path: null,
        ic_front_text: null,
        ic_back_text: null,
        guarantor_ic_text: null,
        notes: form.notes.trim() || null,
        created_at: now,
        updated_at: now,
      };
      await onSubmit(recipient);
      onBack();
    } catch (err: any) {
      alert(err?.message || 'Failed to add student');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <span className="font-medium text-gray-700">Add student · Step {step} of 3</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {s}
              </div>
              {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && 'Student & loan info'}
              {step === 2 && 'Documents'}
              {step === 3 && '属会主席 & submit'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <>
                <AssociationSelect
                  id="student-association"
                  value={form.association}
                  onChange={(v) => update('association', v)}
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full name (English) *</Label>
                    <Input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} placeholder="Student full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Chinese name (中文)</Label>
                    <Input value={form.full_name_chinese} onChange={(e) => update('full_name_chinese', e.target.value)} placeholder="中文姓名" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input type="number" value={form.age} onChange={(e) => update('age', e.target.value)} placeholder="Age" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="email@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input
                      value={form.phone_number}
                      onChange={(e) => update('phone_number', formatMalaysiaMobileDash(e.target.value))}
                      placeholder="011-1234567"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>University *</Label>
                  <Input value={form.university} onChange={(e) => update('university', e.target.value)} placeholder="University name" />
                </div>
                <div className="space-y-2">
                  <Label>Courses *</Label>
                  <Input value={form.courses} onChange={(e) => update('courses', e.target.value)} placeholder="Course name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Admission date</Label>
                    <Input type="date" value={form.admission_date} onChange={(e) => update('admission_date', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected graduation date</Label>
                    <Input type="date" value={form.expected_graduation_date} onChange={(e) => update('expected_graduation_date', e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Loan type *</Label>
                  <Select value={form.loan_type} onValueChange={(v) => update('loan_type', v)}>
                    <SelectTrigger><SelectValue placeholder="Select loan type" /></SelectTrigger>
                    <SelectContent>
                      {LOAN_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label} – RM {t.amount.toLocaleString()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Paid Amount (RM)</Label>
                  <Input type="number" min="0" value={form.loan_amount} onChange={(e) => update('loan_amount', e.target.value)} placeholder="e.g. 0 or 500" />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                {/* Offer letter: file browse only */}
                <div className="space-y-2">
                  <Label>Offer letter</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setOfferLetterFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="offerLetter"
                    />
                    <label htmlFor="offerLetter" className="cursor-pointer flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {offerLetterFile ? offerLetterFile.name : 'Browse file (PDF or image)'}
                      </span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Student IC document (front + back in one file)</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 text-center">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      id="studentIcFile"
                      onChange={(e) => setStudentIcFile(e.target.files?.[0] || null)}
                    />
                    <label htmlFor="studentIcFile" className="cursor-pointer text-sm text-gray-600">
                      {studentIcFile ? studentIcFile.name : 'Upload document'}
                    </label>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="association-chairman">属会主席 *</Label>
                  <Input
                    id="association-chairman"
                    value={form.association_chairman}
                    onChange={(e) => update('association_chairman', e.target.value)}
                    placeholder="请输入属会主席姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Any notes" />
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : onBack()} disabled={submitting}>
                {step === 1 ? 'Cancel' : 'Back'}
              </Button>
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)}>Next</Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Add student'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
