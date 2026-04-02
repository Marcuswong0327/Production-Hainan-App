import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { CheckCircle, XCircle, FileText, Building2, Download, HeartHandshake, Eye, FileDown, CreditCard, ExternalLink, UserPlus, DollarSign, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { StudyLoanApplication, LoanRecipient } from '../types/studyLoan';
import { STUDY_LOAN_BUCKET } from '../types/studyLoan';
import { AddLoanRecipientPage } from './AddLoanRecipientPage';
import { RecordLoanPaymentsPage } from './RecordLoanPaymentsPage';
import { LoanRecipientsStatsPage } from './LoanRecipientsStatsPage';
import { GuarantorRelationshipSelect } from './GuarantorRelationshipSelect';
import { formatMalaysiaMobileDash } from '../lib/malaysiaPhone';


interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  description: string;
  status: string;
  createdBy: string;
  createdAt: string;
  maxCapacity?: number;
  currentParticipants?: number;
}

interface WelfareApplication {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  applicantNameChinese: string;
  applicantNameEnglish: string;
  icNumber: string;
  age: string;
  gender: string;
  membershipNumber: string;
  joinDate: string;
  occupation: string;
  monthlyIncome: string;
  address: string;
  postcode: string;
  homePhone: string;
  mobilePhone: string;
  spouseNameChinese: string;
  spouseNameEnglish: string;
  spouseAge: string;
  spouseOccupation: string;
  spouseMonthlyIncome: string;
  children: any[];
  hasMedicalInsurance: 'yes' | 'no';
  insuranceCompany: string;
  hasOtherWelfareAid: 'yes' | 'no';
  otherWelfareOrg: string;
  requestType: 'general_welfare' | 'sub_association_donation';
  applicationReason: string;
  medicalDocument?: string;
  recommendationLetter?: string;
  recommendedBySubAssociation?: string;
  rejectionReason?: string;
}

const LOAN_TYPE_LABELS: Record<string, string> = {
  degree: 'Degree',
  tvet_vocational: 'TVET / Vocational',
  master: 'Master',
  phd: 'PhD',
};

export function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editMaxCapacity, setEditMaxCapacity] = useState('');
  const [welfareApplications, setWelfareApplications] = useState<WelfareApplication[]>([]);
  const [selectedWelfareApp, setSelectedWelfareApp] = useState<WelfareApplication | null>(null);
  const [welfareFilter, setWelfareFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showRejectWelfareDialog, setShowRejectWelfareDialog] = useState(false);
  const [welfareRejectionReason, setWelfareRejectionReason] = useState('');

  // Study Loan Applications
  const [studyLoanApplications, setStudyLoanApplications] = useState<StudyLoanApplication[]>([]);
  const [selectedStudyLoan, setSelectedStudyLoan] = useState<StudyLoanApplication | null>(null);
  const [studyLoanFilter, setStudyLoanFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [showRejectStudyLoanDialog, setShowRejectStudyLoanDialog] = useState(false);
  const [studyLoanRejectionReason, setStudyLoanRejectionReason] = useState('');

  const [activeTab, setActiveTab] = useState<'studyLoans' | 'recipients'>('studyLoans');

  // Manual loan recipients (track students who got the loan)
  const [loanRecipients, setLoanRecipients] = useState<LoanRecipient[]>([]);
  const [showAddRecipientPage, setShowAddRecipientPage] = useState(false);
  const [recordPaymentsRecipient, setRecordPaymentsRecipient] = useState<LoanRecipient | null>(null);
  const [selectedRecipientForDetails, setSelectedRecipientForDetails] = useState<LoanRecipient | null>(null);
  const [editRecipient, setEditRecipient] = useState<LoanRecipient | null>(null);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationTarget, setNotificationTarget] = useState<'all' | 'active' | 'completed'>('active');
  const [notificationMessage, setNotificationMessage] = useState(
    'Your study loan repayment is due soon. Please check your loan status in the app.'
  );
  const [notificationSchedule, setNotificationSchedule] = useState('');
  const [sendingNotificationNow, setSendingNotificationNow] = useState(false);
  const [savingNotificationSchedule, setSavingNotificationSchedule] = useState(false);
  const [lastSendNowAt, setLastSendNowAt] = useState<number>(0);
  const [showLoanStats, setShowLoanStats] = useState(false);

  // New Association Form
  const [newAssociation, setNewAssociation] = useState({
    id: '',
    name: '',
    location: '',
  });


  useEffect(() => {
    fetchPendingEvents();
    fetchAssociations();
    fetchWelfareApplications();
    fetchStudyLoanApplications();
    fetchLoanRecipients();

    const interval = setInterval(() => {
      fetchWelfareApplications();
      fetchStudyLoanApplications();
      fetchLoanRecipients();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchPendingEvents = async () => {
    try {
      // Frontend-only: Load from localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const pending = events.filter((e: any) => e.status === 'pending');
      setPendingEvents(pending);
    } catch (error) {
      console.error('Error fetching pending events:', error);
    }
  };


  const fetchAssociations = async () => {
    try {
      // Frontend-only: Load from localStorage
      const assocs = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      setAssociations(assocs);
    } catch (error) {
      console.error('Error fetching associations:', error);
    }
  };

  const fetchWelfareApplications = async () => {
    try {
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      setWelfareApplications(allApplications);
    } catch (error) {
      console.error('Error fetching welfare applications:', error);
    }
  };

  const fetchStudyLoanApplications = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase
          .from('study_loan_applications')
          .select('*')
          .order('applied_at', { ascending: false });
        if (!error) setStudyLoanApplications((data as StudyLoanApplication[]) || []);
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const mapped: StudyLoanApplication[] = raw.map((a: any) => ({
          id: a.id,
          user_id: a.userId,
          association: a.association,
          full_name: a.fullName,
          age: a.age,
          university: a.university,
          courses: a.courses,
          admission_date: a.admissionDate,
          expected_graduation_date: a.expectedGraduationDate,
          phone_number: a.phoneNumber,
          offer_letter_path: null,
          ic_front_path: null,
          ic_back_path: null,
          guarantor_ic_front_path: null,
          guarantor_ic_back_path: null,
          guarantor_relationship: a.guarantorRelationship,
          guarantor_phone_number: a.guarantorPhoneNumber,
          loan_type: a.loanType,
          loan_amount: a.loanAmount,
          status: a.status,
          applied_at: a.appliedDate,
          reviewed_at: null,
          rejection_reason: a.rejectionReason || null,
          created_at: a.appliedDate,
          updated_at: a.appliedDate,
        }));
        setStudyLoanApplications(mapped);
      }
    } catch (error) {
      console.error('Error fetching study loan applications:', error);
    }
  };

  const notifyStudyLoanApplicant = (userId: string, approved: boolean, rejectionReason?: string) => {
    const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
    notifications.push({
      id: `study_loan_${Date.now()}_${userId}`,
      userId,
      title: approved ? 'Study Loan Approved' : 'Study Loan Rejected',
      message: approved
        ? 'Your study loan application has been approved. You can view status and start repayment from the Loans section.'
        : `Your study loan application was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'system',
    });
    localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));
  };

  const handleApproveStudyLoan = async (applicationId: string) => {
    const app = studyLoanApplications.find(a => a.id === applicationId);
    const userId = app?.user_id;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('study_loan_applications')
          .update({ status: 'approved', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', applicationId);
        if (!error) {
          // When approved, sync into loan recipients list so repayment can be tracked
          if (app) {
            const now = new Date().toISOString();
            const recipient: LoanRecipient = {
              id: app.id,
              full_name: app.full_name,
              email: app.email,
              phone_number: app.phone_number,
              association: app.association,
              university: app.university,
              courses: app.courses,
              admission_date: app.admission_date,
              expected_graduation_date: app.expected_graduation_date,
              loan_type: app.loan_type,
              loan_amount: app.loan_amount,
              total_paid: app.total_paid ?? 0,
              payments_made: app.payments_made ?? 0,
              status: 'active',
              guarantor_relationship: app.guarantor_relationship,
              guarantor_phone_number: app.guarantor_phone_number,
              offer_letter_path: app.offer_letter_path,
              ic_front_path: app.ic_front_path,
              ic_back_path: app.ic_back_path,
              guarantor_ic_front_path: app.guarantor_ic_front_path,
              guarantor_ic_back_path: app.guarantor_ic_back_path,
              ic_front_text: null,
              ic_back_text: null,
              guarantor_ic_text: null,
              notes: null,
              created_at: now,
              updated_at: now,
            };
            await saveLoanRecipient(recipient);
          }
          if (userId) notifyStudyLoanApplicant(userId, true);
          fetchStudyLoanApplications();
          setSelectedStudyLoan(null);
          alert('Study loan application approved. Applicant will see a notification on their home.');
        } else throw error;
      } else {
        const all = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const idx = all.findIndex((a: any) => a.id === applicationId);
        if (idx !== -1) {
          all[idx].status = 'approved';
          // Sync into loan recipients (local-only)
          if (app) {
            const now = new Date().toISOString();
            const recipient: LoanRecipient = {
              id: app.id,
              full_name: app.full_name,
              email: (app as any).email || '',
              phone_number: app.phone_number,
              association: app.association,
              university: app.university,
              courses: app.courses,
              admission_date: app.admission_date,
              expected_graduation_date: app.expected_graduation_date,
              loan_type: app.loan_type,
              loan_amount: app.loan_amount,
              total_paid: app.total_paid ?? 0,
              payments_made: app.payments_made ?? 0,
              status: 'active',
              guarantor_relationship: app.guarantor_relationship,
              guarantor_phone_number: app.guarantor_phone_number,
              offer_letter_path: null,
              ic_front_path: null,
              ic_back_path: null,
              guarantor_ic_front_path: null,
              guarantor_ic_back_path: null,
              ic_front_text: null,
              ic_back_text: null,
              guarantor_ic_text: null,
              notes: null,
              created_at: now,
              updated_at: now,
            };
            await saveLoanRecipient(recipient);
          }
          if (userId) notifyStudyLoanApplicant(userId, true);
          localStorage.setItem('myHainanLoanApplications', JSON.stringify(all));
          fetchStudyLoanApplications();
          setSelectedStudyLoan(null);
          alert('Study loan application approved. Applicant will see a notification on their home.');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to approve study loan application.');
    }
  };

  const handleRejectStudyLoan = async (applicationId: string, reason: string) => {
    const app = studyLoanApplications.find(a => a.id === applicationId);
    const userId = app?.user_id;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('study_loan_applications')
          .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', applicationId);
        if (!error) {
          if (userId) notifyStudyLoanApplicant(userId, false, reason);
          fetchStudyLoanApplications();
          setShowRejectStudyLoanDialog(false);
          setStudyLoanRejectionReason('');
          setSelectedStudyLoan(null);
          alert('Study loan application rejected. Applicant will see the reason on their status page and in notifications.');
        } else throw error;
      } else {
        const all = JSON.parse(localStorage.getItem('myHainanLoanApplications') || '[]');
        const idx = all.findIndex((a: any) => a.id === applicationId);
        if (idx !== -1) {
          all[idx].status = 'rejected';
          all[idx].rejectionReason = reason;
          if (userId) notifyStudyLoanApplicant(userId, false, reason);
          localStorage.setItem('myHainanLoanApplications', JSON.stringify(all));
          fetchStudyLoanApplications();
          setShowRejectStudyLoanDialog(false);
          setStudyLoanRejectionReason('');
          setSelectedStudyLoan(null);
          alert('Study loan application rejected. Applicant will see the reason on their status page and in notifications.');
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to reject study loan application.');
    }
  };

  const openStudyLoanRejectDialog = (app: StudyLoanApplication) => {
    setSelectedStudyLoan(app);
    setStudyLoanRejectionReason('');
    setShowRejectStudyLoanDialog(true);
  };

  const viewStudyLoanDetails = (app: StudyLoanApplication) => {
    setSelectedStudyLoan(app);
  };

  const filteredStudyLoanApplications = studyLoanApplications.filter(app => {
    if (studyLoanFilter === 'all') return true;
    return app.status === studyLoanFilter;
  });

  const openStudyLoanDocument = async (path: string | null, label: string) => {
    if (!path) return;
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.storage.from(STUDY_LOAN_BUCKET).createSignedUrl(path, 3600);
        if (error) {
          alert(`Could not open ${label}: ${error.message}`);
          return;
        }
        if (data?.signedUrl) window.open(data.signedUrl, '_blank');
      } catch (e: any) {
        alert(`Could not open ${label}: ${e?.message || 'Unknown error'}`);
      }
    } else {
      alert('Documents are stored in Supabase. Configure Supabase to open files.');
    }
  };

  const fetchLoanRecipients = async () => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { data, error } = await supabase.from('study_loan_recipients').select('*').order('created_at', { ascending: false });
        if (!error) setLoanRecipients((data as LoanRecipient[]) || []);
      } else {
        const raw = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        setLoanRecipients(raw);
      }
    } catch (e) {
      console.error('Fetch loan recipients:', e);
    }
  };

  const saveLoanRecipient = async (newRecipient: LoanRecipient) => {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('study_loan_recipients').insert({
        id: newRecipient.id,
        full_name: newRecipient.full_name,
        full_name_chinese: newRecipient.full_name_chinese ?? null,
        email: newRecipient.email,
        phone_number: newRecipient.phone_number,
        association: newRecipient.association,
        university: newRecipient.university,
        courses: newRecipient.courses,
        admission_date: newRecipient.admission_date || null,
        expected_graduation_date: newRecipient.expected_graduation_date || null,
        loan_type: newRecipient.loan_type || null,
        loan_amount: newRecipient.loan_amount,
        total_paid: newRecipient.total_paid ?? 0,
        payments_made: newRecipient.payments_made ?? 0,
        status: newRecipient.status,
        guarantor_relationship: newRecipient.guarantor_relationship || null,
        guarantor_phone_number: newRecipient.guarantor_phone_number || null,
        offer_letter_path: newRecipient.offer_letter_path || null,
        ic_front_path: newRecipient.ic_front_path || null,
        ic_back_path: newRecipient.ic_back_path || null,
        guarantor_ic_front_path: newRecipient.guarantor_ic_front_path || null,
        guarantor_ic_back_path: newRecipient.guarantor_ic_back_path || null,
        ic_front_text: newRecipient.ic_front_text || null,
        ic_back_text: newRecipient.ic_back_text || null,
        guarantor_ic_text: newRecipient.guarantor_ic_text || null,
        notes: newRecipient.notes || null,
        updated_at: newRecipient.updated_at,
      });
      if (error) throw error;
    } else {
      const list = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
      list.unshift(newRecipient);
      localStorage.setItem('myHainanLoanRecipients', JSON.stringify(list));
    }
    setLoanRecipients(prev => [newRecipient, ...prev]);
  };

  const deleteLoanRecipient = async (id: string) => {
    if (!window.confirm('Delete this loan recipient? This cannot be undone.')) return;
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('study_loan_recipients').delete().eq('id', id);
        if (error) throw error;
      } else {
        const list = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        const filtered = list.filter((r: LoanRecipient) => r.id !== id);
        localStorage.setItem('myHainanLoanRecipients', JSON.stringify(filtered));
      }
      setLoanRecipients(prev => prev.filter(r => r.id !== id));
      if (selectedRecipientForDetails && selectedRecipientForDetails.id === id) {
        setSelectedRecipientForDetails(null);
        setEditRecipient(null);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to delete recipient.');
    }
  };

  const updateLoanRecipient = async (updated: LoanRecipient) => {
    try {
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase.from('study_loan_recipients').update({
          full_name: updated.full_name,
          full_name_chinese: updated.full_name_chinese ?? null,
          email: updated.email,
          phone_number: updated.phone_number,
          association: updated.association,
          university: updated.university,
          courses: updated.courses,
          admission_date: updated.admission_date || null,
          expected_graduation_date: updated.expected_graduation_date || null,
          loan_type: updated.loan_type || null,
          loan_amount: updated.loan_amount,
          total_paid: updated.total_paid,
          payments_made: updated.payments_made,
          status: updated.status,
          guarantor_relationship: updated.guarantor_relationship || null,
          guarantor_phone_number: updated.guarantor_phone_number || null,
          offer_letter_path: updated.offer_letter_path || null,
          ic_front_path: updated.ic_front_path || null,
          ic_back_path: updated.ic_back_path || null,
          guarantor_ic_front_path: updated.guarantor_ic_front_path || null,
          guarantor_ic_back_path: updated.guarantor_ic_back_path || null,
          ic_front_text: updated.ic_front_text || null,
          ic_back_text: updated.ic_back_text || null,
          guarantor_ic_text: updated.guarantor_ic_text || null,
          notes: updated.notes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', updated.id);
        if (error) throw error;
      } else {
        const list = JSON.parse(localStorage.getItem('myHainanLoanRecipients') || '[]');
        const idx = list.findIndex((r: LoanRecipient) => r.id === updated.id);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...updated, updated_at: new Date().toISOString() };
          localStorage.setItem('myHainanLoanRecipients', JSON.stringify(list));
        }
      }
      setLoanRecipients(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
      setSelectedRecipientForDetails(null);
      setEditRecipient(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update recipient.');
    }
  };

  // record payments now handled by RecordLoanPaymentsPage


  const handleApproveEvent = async (eventId: string) => {
    try {
      // Frontend-only: Update in localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].status = 'approved';
        // Ensure maxCapacity and currentParticipants are set
        if (!events[index].maxCapacity) {
          events[index].maxCapacity = 100; // Default if not set
        }
        if (!events[index].currentParticipants) {
          events[index].currentParticipants = 0;
        }
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        alert('Event approved successfully!');
      }
    } catch (error) {
      console.error('Error approving event:', error);
      alert('Failed to approve event');
    }
  };

  const handleUpdateMaxCapacity = async (eventId: string) => {
    try {
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].maxCapacity = parseInt(editMaxCapacity) || 0;
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        setEditingEvent(null);
        setEditMaxCapacity('');
        alert('Max capacity updated successfully!');
      }
    } catch (error) {
      console.error('Error updating max capacity:', error);
      alert('Failed to update max capacity');
    }
  };

  const openEditCapacityDialog = (event: Event) => {
    setEditingEvent(event);
    setEditMaxCapacity(event.maxCapacity?.toString() || '');
  };


  const handleRejectEvent = async (eventId: string, comment: string) => {
    try {
      // Frontend-only: Update in localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].status = 'rejected';
        events[index].rejectionComment = comment;
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        setShowRejectDialog(false);
        setRejectionReason('');
        setSelectedEventForReject(null);
        alert('Event rejected. The Sub Editor will see the rejection reason in their dashboard.');
      }
    } catch (error) {
      console.error('Error rejecting event:', error);
      alert('Failed to reject event');
    }
  };


  const openRejectDialog = (eventId: string) => {
    setSelectedEventForReject(eventId);
    setRejectionReason('');
    setShowRejectDialog(true);
  };


  const submitRejection = () => {
    if (!selectedEventForReject) return;
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    handleRejectEvent(selectedEventForReject, rejectionReason);
  };


  const handleCreateAssociation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);


    try {
      // Frontend-only: Save to localStorage
      const associations = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      const newAssoc = {
        ...newAssociation,
        state: newAssociation.location,
        committeeMembers: [],
        createdAt: new Date().toISOString(),
      };
      associations.push(newAssoc);
      localStorage.setItem('myHainanAssociations', JSON.stringify(associations));


      setNewAssociation({ id: '', name: '', location: '' });
      fetchAssociations();
      alert('Association created successfully!');
    } catch (error) {
      console.error('Error creating association:', error);
      alert('Failed to create association');
    } finally {
      setLoading(false);
    }
  };


  const [selectedAssociationForExport, setSelectedAssociationForExport] = useState<string>('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [selectedEventForReject, setSelectedEventForReject] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');


  const generateExcelReport = (associationId?: string) => {
    if (associationId) {
      // Generate report for specific association
      const assoc = associations.find((a) => a.id === associationId);
      if (!assoc) {
        alert('Association not found');
        return;
      }


      // Use association name for both Association Name and Location
      const associationName = assoc.name || assoc.id;

      // Prepare worksheet data with headers
      const worksheetData: any[][] = [
        ['Association Name', 'Location', 'Name', 'Title', 'Category'],
      ];


      // Add committee members data if available
      if (assoc.committeeMembers && assoc.committeeMembers.length > 0) {
        assoc.committeeMembers.forEach((member: any) => {
          worksheetData.push([
            associationName,
            associationName, // Location same as Association Name
            member.name || '',
            member.title || member.role || '', // Use title if available, fallback to role
            member.category || '', // Optional category field
          ]);
        });
      }
      // If no committee members, worksheetData will only have headers (empty file)


      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Committee Members');


      // Clean filename but preserve .xlsx extension (not _xlsx)
      // Remove special characters but keep alphanumeric, spaces, and hyphens
      let cleanName = (assoc.name || assoc.id).replace(/[^a-z0-9\s-]/gi, '').trim();
      // Replace spaces with underscores
      cleanName = cleanName.replace(/\s+/g, '_');
      // Ensure we have a valid name
      if (!cleanName) cleanName = 'Association';
      // Ensure .xlsx extension (not _xlsx)
      const fileName = `${cleanName}_Committee_List.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } else {
      // Generate consolidated report (old behavior)
      const worksheetData = [
        ['Association ID', 'Association Name', 'Location'],
        ...associations.map((assoc) => [assoc.id, assoc.name, assoc.location]),
      ];


      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Associations');


      XLSX.writeFile(workbook, 'AGM_Committee_List.xlsx');
    }
  };


  const handleDownloadSelected = () => {
    if (!selectedAssociationForExport) {
      alert('Please select an association to download');
      return;
    }
    generateExcelReport(selectedAssociationForExport);
  };

  const handleApproveWelfare = async (applicationId: string) => {
    try {
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      const index = allApplications.findIndex((a: any) => a.id === applicationId);
      
      if (index !== -1) {
        allApplications[index].status = 'approved';
        localStorage.setItem('myHainanWelfareApplications', JSON.stringify(allApplications));
        fetchWelfareApplications();

        // Notify the applicant
        const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
        notifications.push({
          id: Date.now().toString() + '_' + allApplications[index].userId,
          userId: allApplications[index].userId,
          title: 'Welfare Application Approved',
          message: `Your welfare application has been approved. You will be contacted soon.`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'system',
        });

        // Notify the recommended sub-association if applicable
        if (allApplications[index].recommendedBySubAssociation) {
          // Create notification for the sub-association
          // In a real system, this would be sent to all sub_admin users of that association
          const subAssocNotification = {
            id: Date.now().toString() + '_sub_admin_' + allApplications[index].recommendedBySubAssociation,
            userId: 'sub_admin_' + allApplications[index].recommendedBySubAssociation, // Special marker for sub-association notifications
            title: 'Welfare Application Approved',
            message: `A welfare application you recommended from ${allApplications[index].applicantNameEnglish || allApplications[index].applicantNameChinese} has been approved by the General Association.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'system',
            associationName: allApplications[index].recommendedBySubAssociation,
          };
          
          notifications.push(subAssocNotification);
        }

        localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));
        alert('Welfare application approved successfully!');
      }
    } catch (error) {
      console.error('Error approving welfare application:', error);
      alert('Failed to approve welfare application');
    }
  };

  const handleRejectWelfare = async (applicationId: string, reason: string) => {
    try {
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      const index = allApplications.findIndex((a: any) => a.id === applicationId);
      
      if (index !== -1) {
        allApplications[index].status = 'rejected';
        allApplications[index].rejectionReason = reason;
        localStorage.setItem('myHainanWelfareApplications', JSON.stringify(allApplications));
        fetchWelfareApplications();

        // Notify the applicant
        const notifications = JSON.parse(localStorage.getItem('myHainanNotifications') || '[]');
        notifications.push({
          id: Date.now().toString() + '_' + allApplications[index].userId,
          userId: allApplications[index].userId,
          title: 'Welfare Application Rejected',
          message: `Your welfare application has been rejected. Reason: ${reason}`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'system',
        });
        localStorage.setItem('myHainanNotifications', JSON.stringify(notifications));

        setShowRejectWelfareDialog(false);
        setWelfareRejectionReason('');
        setSelectedWelfareApp(null);
        alert('Welfare application rejected.');
      }
    } catch (error) {
      console.error('Error rejecting welfare application:', error);
      alert('Failed to reject welfare application');
    }
  };

  const openWelfareRejectDialog = (application: WelfareApplication) => {
    setSelectedWelfareApp(application);
    setWelfareRejectionReason('');
    setShowRejectWelfareDialog(true);
  };

  const viewWelfareDetails = (application: WelfareApplication) => {
    setSelectedWelfareApp(application);
  };

  const downloadWelfareDocument = (base64Data: string, filename: string) => {
    if (!base64Data) {
      alert('Document not available');
      return;
    }
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = filename;
    link.click();
  };

  const filteredWelfareApplications = welfareApplications.filter(app => {
    if (welfareFilter === 'all') return true;
    return app.status === welfareFilter;
  });


  if (showAddRecipientPage) {
    return (
      <AddLoanRecipientPage
        onBack={() => {
          setShowAddRecipientPage(false);
          setActiveTab('recipients');
        }}
        onSubmit={saveLoanRecipient}
      />
    );
  }

  if (recordPaymentsRecipient) {
    return (
      <RecordLoanPaymentsPage
        recipient={recordPaymentsRecipient}
        onBack={() => {
          setRecordPaymentsRecipient(null);
          setActiveTab('recipients');
          fetchLoanRecipients();
        }}
        onTotalsUpdated={(updated) => {
          setLoanRecipients((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        }}
      />
    );
  }

  if (showLoanStats) {
    return (
      <LoanRecipientsStatsPage
        recipients={loanRecipients}
        onBack={() => {
          setShowLoanStats(false);
          setActiveTab('recipients');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-bold text-2xl">Super Admin Dashboard</h1>
            <p className="text-sm text-gray-600">总会管理中心</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </div>


      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'studyLoans' | 'recipients')} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-xl">
            {/* <TabsTrigger value="events">Event Approval</TabsTrigger> */}
            <TabsTrigger value="studyLoans">Study Loan Applications</TabsTrigger>
            <TabsTrigger value="recipients">Loan Recipients</TabsTrigger>
            {/* <TabsTrigger value="welfare">Welfare Applications</TabsTrigger> */}
            {/* <TabsTrigger value="associations">Associations</TabsTrigger> */}
            {/* <TabsTrigger value="export">Export Data</TabsTrigger> */}
          </TabsList>

          {/* Event Approval Tab - commented out */}
          {false && (
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Events for Approval</CardTitle>
                  <CardDescription>
                    Review and approve/reject events submitted by Sub-Associations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingEvents.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No pending events to review
                    </div>
                  ) : (
                    pendingEvents.map((event: any) => (
                      <Card key={event.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg mb-2">{event.title}</h3>
                              {event.associationName && (
                                <div className="mb-2">
                                  <Badge variant="outline" className="bg-blue-50">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    {event.associationName}
                                  </Badge>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                <div>Date: {event.date}</div>
                                <div>Time: {event.time}</div>
                                <div>Venue: {event.venue}</div>
                                <div>Price: RM {event.price}</div>
                                <div>Max Capacity: {event.maxCapacity || 'Not set'}</div>
                                <div>Current Participants: {event.currentParticipants || 0}</div>
                              </div>
                              {event.maxCapacity && (
                                <div className="mb-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openEditCapacityDialog(event)}
                                  >
                                    Edit Max Capacity
                                  </Button>
                                </div>
                              )}
                              <p className="text-sm text-gray-700 mb-3">{event.description}</p>
                              <Badge variant="outline">Submitted: {new Date(event.createdAt).toLocaleDateString()}</Badge>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleApproveEvent(event.id)}
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => openRejectDialog(event.id)}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Study Loan Applications Tab */}
          <TabsContent value="studyLoans">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Study Loan Applications
                </CardTitle>
                <CardDescription>
                  Review and approve/reject student study loan applications. Applicants will see status and can repay once approved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 border-b pb-4 flex-wrap">
                  <Button
                    variant={studyLoanFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudyLoanFilter('all')}
                  >
                    All ({studyLoanApplications.length})
                  </Button>
                  <Button
                    variant={studyLoanFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudyLoanFilter('pending')}
                  >
                    Pending ({studyLoanApplications.filter(a => a.status === 'pending').length})
                  </Button>
                  <Button
                    variant={studyLoanFilter === 'approved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudyLoanFilter('approved')}
                  >
                    Approved ({studyLoanApplications.filter(a => a.status === 'approved').length})
                  </Button>
                  <Button
                    variant={studyLoanFilter === 'rejected' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStudyLoanFilter('rejected')}
                  >
                    Rejected ({studyLoanApplications.filter(a => a.status === 'rejected').length})
                  </Button>
                </div>
                {filteredStudyLoanApplications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No study loan applications found
                  </div>
                ) : (
                  filteredStudyLoanApplications.map((app) => (
                    <Card key={app.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h3 className="font-semibold text-lg truncate">{app.full_name}</h3>
                              <Badge
                                variant="secondary"
                                className={
                                  app.status === 'approved'
                                    ? 'bg-green-600'
                                    : app.status === 'rejected'
                                      ? 'bg-red-600'
                                      : 'bg-yellow-600'
                                }
                              >
                                {app.status}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                              <div>{app.university}</div>
                              <div>RM {app.loan_amount?.toLocaleString()}</div>
                              <div className="col-span-2">
                                <Badge variant="outline" className="bg-blue-50">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {app.association}
                                </Badge>
                              </div>
                            </div>
                            <Badge variant="outline">
                              Applied: {new Date(app.applied_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          <div className="flex flex-col gap-2 ml-4 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewStudyLoanDetails(app)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                            {app.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApproveStudyLoan(app.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => openStudyLoanRejectDialog(app)}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loan Recipients Tab - manual entry to track repayment (for future notifications) */}
          <TabsContent value="recipients">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5" />
                      Loan Recipients
                    </CardTitle>
                    <CardDescription>
                      Manually add students who received the study loan to track repayment progress. Data is used for notifications later.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                    <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="ml-auto"
                        onClick={() => { setActiveTab('recipients'); setShowNotificationDialog(true); }}
                      >
                        Send notifications
                      </Button>
                      <Button
                        className="ml-auto"
                        onClick={() => { setActiveTab('recipients'); setShowAddRecipientPage(true); }}
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add student
                      </Button>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        className="ml-auto"
                        onClick={() => { setActiveTab('recipients'); setShowLoanStats(true); }}
                      >
                        Overall stats
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                  Starting July 2025, study-loan amounts were revised: Degree and TVET/Vocational increased from RM 3,000 to RM 4,000, and Master/PhD increased from RM 5,000 to RM 6,000.
                </div>
                {loanRecipients.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No loan recipients yet.</p>
                    <p className="text-sm mt-1">Click &quot;Add student&quot; to enter students who received the study loan.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {loanRecipients.map((r) => {
                      const remaining = Math.max(0, r.loan_amount - r.total_paid);
                      const progress = r.loan_amount > 0 ? (r.total_paid / r.loan_amount) * 100 : 0;
                      return (
                        <Card key={r.id}>
                          <CardContent className="p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-lg truncate">{r.full_name}</h3>
                                  <Badge
                                    variant={r.status === 'completed' ? 'default' : 'secondary'}
                                    className={r.status === 'completed' ? 'bg-green-600' : 'bg-amber-600'}
                                  >
                                    {r.status}
                                  </Badge>
                                </div>
                                {r.full_name_chinese?.trim() ? (
                                  <p className="text-sm text-gray-600">{r.full_name_chinese.trim()}</p>
                                ) : null}

                                {/* Mobile-first essential info */}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                                  <span className="truncate max-w-[12rem] sm:max-w-none">{r.university}</span>
                                  <span className="truncate max-w-[12rem] sm:max-w-none">{r.association}</span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 text-sm">
                                  <div>
                                    <div className="text-xs text-gray-500">Loan</div>
                                    <div className="font-medium">RM {r.loan_amount.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Paid</div>
                                    <div className="font-medium">RM {r.total_paid.toLocaleString()}</div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500">Remaining</div>
                                    <div className="font-medium">RM {remaining.toLocaleString()}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div className="h-full bg-green-600 rounded-full" style={{ width: `${Math.min(100, progress)}%` }} />
                                    </div>
                                  </div>
                                  <div className="text-sm font-medium whitespace-nowrap">{Math.round(progress)}%</div>
                                </div>

                                {/* Desktop-only: hide noisy info on phone */}
                                <div className="hidden sm:grid grid-cols-4 gap-2 text-xs text-gray-500">
                                  <span className="truncate">Course: {r.courses || '-'}</span>
                                  <span className="truncate">Type: {LOAN_TYPE_LABELS[r.loan_type || ''] || r.loan_type || '-'}</span>
                                  <span className="truncate">Email: {r.email || '-'}</span>
                                  <span className="truncate">Phone: {r.phone_number || '-'}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 shrink-0 relative z-10">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedRecipientForDetails(r);
                                    setEditRecipient({ ...r });
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  View / Edit
                                </Button>
                                {r.status === 'active' && remaining > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setRecordPaymentsRecipient(r);
                                    }}
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Record payment
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="text-red-700 border-red-200 hover:bg-red-50 col-span-2 sm:col-span-1"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    deleteLoanRecipient(r.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Welfare Applications Tab - commented out */}
          {false && (
            <TabsContent value="welfare">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HeartHandshake className="w-5 h-5" />
                    Welfare Fund Applications
                  </CardTitle>
                  <CardDescription>
                    Review and approve/reject welfare fund applications from members
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 border-b pb-4">
                    <Button variant={welfareFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('all')}>All ({welfareApplications.length})</Button>
                    <Button variant={welfareFilter === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('pending')}>Pending ({welfareApplications.filter(a => a.status === 'pending').length})</Button>
                    <Button variant={welfareFilter === 'approved' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('approved')}>Approved ({welfareApplications.filter(a => a.status === 'approved').length})</Button>
                    <Button variant={welfareFilter === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => setWelfareFilter('rejected')}>Rejected ({welfareApplications.filter(a => a.status === 'rejected').length})</Button>
                  </div>
                  {filteredWelfareApplications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No welfare applications found</div>
                  ) : (
                    filteredWelfareApplications.map((application) => (
                      <Card key={application.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{application.applicantNameEnglish || application.applicantNameChinese}</h3>
                                <Badge variant={application.status === 'approved' ? 'default' : application.status === 'rejected' ? 'destructive' : 'secondary'} className={application.status === 'approved' ? 'bg-green-600' : application.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-600'}>
                                  {application.status === 'approved' ? 'Approved' : application.status === 'rejected' ? 'Rejected' : 'Pending'}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                                <div>IC Number: {application.icNumber}</div>
                                <div>Age: {application.age}</div>
                                <div>Gender: {application.gender}</div>
                                <div>Membership #: {application.membershipNumber || 'N/A'}</div>
                                <div>Occupation: {application.occupation || 'N/A'}</div>
                                <div>Monthly Income: RM {application.monthlyIncome || '0'}</div>
                                <div>Phone: {application.mobilePhone || application.homePhone || 'N/A'}</div>
                                <div>Request Type: {application.requestType === 'general_welfare' ? 'General Welfare Fund' : 'Sub-Association Donation'}</div>
                                {application.recommendedBySubAssociation && (
                                  <div className="col-span-2">
                                    <Badge variant="outline" className="bg-blue-50"><Building2 className="w-3 h-3 mr-1" />Recommended by: {application.recommendedBySubAssociation}</Badge>
                                  </div>
                                )}
                              </div>
                              {application.applicationReason && (
                                <div className="mb-3">
                                  <p className="text-sm font-semibold mb-1">Application Reason:</p>
                                  <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{application.applicationReason.substring(0, 200)}{application.applicationReason.length > 200 ? '...' : ''}</p>
                                </div>
                              )}
                              <div className="flex gap-2 mb-2">
                                {application.medicalDocument && (
                                  <Button size="sm" variant="outline" onClick={() => downloadWelfareDocument(application.medicalDocument!, 'medical_document.pdf')}><FileDown className="w-3 h-3 mr-1" />Medical Doc</Button>
                                )}
                                {application.recommendationLetter && (
                                  <Button size="sm" variant="outline" onClick={() => downloadWelfareDocument(application.recommendationLetter!, 'recommendation_letter.pdf')}><FileDown className="w-3 h-3 mr-1" />Recommendation Letter</Button>
                                )}
                              </div>
                              <Badge variant="outline">Submitted: {new Date(application.submittedAt).toLocaleDateString()}</Badge>
                              {application.status === 'rejected' && application.rejectionReason && (
                                <div className="mt-3 bg-red-50 border border-red-200 p-3 rounded">
                                  <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                                  <p className="text-sm text-red-800">{application.rejectionReason}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-2 ml-4">
                              <Button size="sm" variant="outline" onClick={() => viewWelfareDetails(application)}><Eye className="w-4 h-4 mr-1" />View Details</Button>
                              {application.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleApproveWelfare(application.id)}><CheckCircle className="w-4 h-4 mr-1" />Approve</Button>
                                  <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => openWelfareRejectDialog(application)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Associations Tab - commented out */}
          {false && (
            <TabsContent value="associations">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Association</CardTitle>
                    <CardDescription>Add a new Sub-Association (分会)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateAssociation} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="assoc-id">Association ID</Label>
                        <Input id="assoc-id" placeholder="e.g., selangor_01" value={newAssociation.id} onChange={(e) => setNewAssociation({ ...newAssociation, id: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assoc-name">Association Name</Label>
                        <Input id="assoc-name" placeholder="Selangor Hainan Association" value={newAssociation.name} onChange={(e) => setNewAssociation({ ...newAssociation, name: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assoc-location">Location</Label>
                        <Input id="assoc-location" placeholder="Selangor" value={newAssociation.location} onChange={(e) => setNewAssociation({ ...newAssociation, location: e.target.value })} required />
                      </div>
                      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating...' : 'Create Association'}</Button>
                    </form>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Existing Associations</CardTitle>
                    <CardDescription>{associations.length} total associations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                    {associations.map((assoc) => (
                      <Card key={assoc.id}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <div className="flex-1">
                            <div className="font-medium">{assoc.name}</div>
                            <div className="text-sm text-gray-500">{assoc.location}</div>
                          </div>
                          <Badge variant="outline">{assoc.id}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Export Data Tab - commented out */}
          {false && (
            <TabsContent value="export">
              <Card>
                <CardHeader>
                  <CardTitle>Export Master Data</CardTitle>
                  <CardDescription>Generate Excel reports per association based on sub admin submissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <FileText className="w-8 h-8 text-blue-600" />
                      <div>
                        <h3 className="font-semibold text-lg">Export Association Report</h3>
                        <p className="text-sm text-gray-600">Download Excel file for a specific association</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="association-select">Select Association</Label>
                        <Select value={selectedAssociationForExport} onValueChange={setSelectedAssociationForExport}>
                          <SelectTrigger id="association-select" className="w-full">
                            <SelectValue placeholder="Choose an association to download" />
                          </SelectTrigger>
                          <SelectContent>
                            {associations.length === 0 ? (
                              <SelectItem value="none" disabled>No associations available</SelectItem>
                            ) : (
                              associations.map((assoc) => (
                                <SelectItem key={assoc.id} value={assoc.id}>
                                  {assoc.name || assoc.id} {assoc.location ? `- ${assoc.location}` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-600">{associations.length} association(s) available for export</p>
                      </div>
                      <Button className="w-full" onClick={handleDownloadSelected} disabled={!selectedAssociationForExport || associations.length === 0}>
                        <Download className="w-4 h-4 mr-2" />
                        Download Selected Association Report
                      </Button>
                      <div className="bg-white rounded p-3 text-xs text-gray-700">
                        <p className="font-semibold mb-1">Excel Format:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Association Name | Location | Name | Title | Category (optional)</li>
                          <li>One row per committee member</li>
                          <li>File name: [Association Name]_Committee_List.xlsx</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <FileText className="w-8 h-8 text-green-600 mb-2" />
                    <h3 className="font-semibold mb-1">Consolidated Report</h3>
                    <p className="text-sm text-gray-600 mb-3">Generate a consolidated list of all associations</p>
                    <Button className="w-full" variant="outline" onClick={() => generateExcelReport()}>Generate Consolidated Report</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>


      {/* Edit Max Capacity Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Max Capacity</DialogTitle>
            <DialogDescription>
              Update the maximum capacity for this event
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="max-capacity">Maximum Capacity *</Label>
              <Input
                id="max-capacity"
                type="number"
                min="1"
                value={editMaxCapacity}
                onChange={(e) => setEditMaxCapacity(e.target.value)}
                placeholder="Enter max capacity"
                required
              />
              {editingEvent && (
                <p className="text-xs text-gray-500">
                  Current: {editingEvent.maxCapacity || 'Not set'} |
                  Participants: {editingEvent.currentParticipants || 0}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditingEvent(null);
              setEditMaxCapacity('');
            }}>
              Cancel
            </Button>
            <Button onClick={() => editingEvent && handleUpdateMaxCapacity(editingEvent.id)}>
              Update Capacity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Event Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Event</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this event. The Sub Editor will see this reason in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="bg-white border-gray-300"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectDialog(false);
              setRejectionReason('');
              setSelectedEventForReject(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitRejection}>
              Reject Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Welfare Application Details Dialog */}
      <Dialog open={!!selectedWelfareApp && !showRejectWelfareDialog} onOpenChange={(open) => !open && setSelectedWelfareApp(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedWelfareApp && (
            <>
              <DialogHeader>
                <DialogTitle>Welfare Application Details</DialogTitle>
                <DialogDescription>
                  Full application information for {selectedWelfareApp.applicantNameEnglish || selectedWelfareApp.applicantNameChinese}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <h3 className="font-semibold mb-2">Applicant Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>Chinese Name:</strong> {selectedWelfareApp.applicantNameChinese}</div>
                    <div><strong>English Name:</strong> {selectedWelfareApp.applicantNameEnglish}</div>
                    <div><strong>IC Number:</strong> {selectedWelfareApp.icNumber}</div>
                    <div><strong>Age:</strong> {selectedWelfareApp.age}</div>
                    <div><strong>Gender:</strong> {selectedWelfareApp.gender}</div>
                    <div><strong>Membership #:</strong> {selectedWelfareApp.membershipNumber || 'N/A'}</div>
                    <div><strong>Join Date:</strong> {selectedWelfareApp.joinDate || 'N/A'}</div>
                    <div><strong>Occupation:</strong> {selectedWelfareApp.occupation || 'N/A'}</div>
                    <div><strong>Monthly Income:</strong> RM {selectedWelfareApp.monthlyIncome || '0'}</div>
                    <div><strong>Address:</strong> {selectedWelfareApp.address || 'N/A'}</div>
                    <div><strong>Postcode:</strong> {selectedWelfareApp.postcode || 'N/A'}</div>
                    <div><strong>Home Phone:</strong> {selectedWelfareApp.homePhone || 'N/A'}</div>
                    <div><strong>Mobile Phone:</strong> {selectedWelfareApp.mobilePhone || 'N/A'}</div>
                  </div>
                </div>

                {(selectedWelfareApp.spouseNameChinese || selectedWelfareApp.spouseNameEnglish) && (
                  <div>
                    <h3 className="font-semibold mb-2">Spouse Information</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><strong>Chinese Name:</strong> {selectedWelfareApp.spouseNameChinese || 'N/A'}</div>
                      <div><strong>English Name:</strong> {selectedWelfareApp.spouseNameEnglish || 'N/A'}</div>
                      <div><strong>Age:</strong> {selectedWelfareApp.spouseAge || 'N/A'}</div>
                      <div><strong>Occupation:</strong> {selectedWelfareApp.spouseOccupation || 'N/A'}</div>
                      <div><strong>Monthly Income:</strong> RM {selectedWelfareApp.spouseMonthlyIncome || '0'}</div>
                    </div>
                  </div>
                )}

                {selectedWelfareApp.children && selectedWelfareApp.children.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Children</h3>
                    <div className="space-y-2">
                      {selectedWelfareApp.children.map((child: any, index: number) => (
                        <div key={index} className="border p-2 rounded text-sm">
                          <div className="grid grid-cols-2 gap-2">
                            <div><strong>Name:</strong> {child.name}</div>
                            <div><strong>Gender:</strong> {child.gender}</div>
                            <div><strong>Age:</strong> {child.age}</div>
                            <div><strong>Occupation/School:</strong> {child.occupationOrSchool}</div>
                            <div><strong>Monthly Income:</strong> RM {child.monthlyIncome || '0'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Application Details</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Has Medical Insurance:</strong> {selectedWelfareApp.hasMedicalInsurance === 'yes' ? 'Yes' : 'No'}</div>
                    {selectedWelfareApp.hasMedicalInsurance === 'yes' && selectedWelfareApp.insuranceCompany && (
                      <div><strong>Insurance Company:</strong> {selectedWelfareApp.insuranceCompany}</div>
                    )}
                    <div><strong>Has Other Welfare Aid:</strong> {selectedWelfareApp.hasOtherWelfareAid === 'yes' ? 'Yes' : 'No'}</div>
                    {selectedWelfareApp.hasOtherWelfareAid === 'yes' && selectedWelfareApp.otherWelfareOrg && (
                      <div><strong>Other Welfare Organization:</strong> {selectedWelfareApp.otherWelfareOrg}</div>
                    )}
                    <div><strong>Request Type:</strong> {
                      selectedWelfareApp.requestType === 'general_welfare'
                        ? 'General Welfare Fund Allocation'
                        : 'Sub-Association Donation Request'
                    }</div>
                    {selectedWelfareApp.recommendedBySubAssociation && (
                      <div><strong>Recommended By:</strong> {selectedWelfareApp.recommendedBySubAssociation}</div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Application Reason</h3>
                  <p className="text-sm bg-gray-50 p-3 rounded">{selectedWelfareApp.applicationReason}</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Attachments</h3>
                  <div className="flex gap-2">
                    {selectedWelfareApp.medicalDocument && (
                      <Button
                        variant="outline"
                        onClick={() => downloadWelfareDocument(selectedWelfareApp.medicalDocument!, 'medical_document.pdf')}
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Download Medical Document
                      </Button>
                    )}
                    {selectedWelfareApp.recommendationLetter && (
                      <Button
                        variant="outline"
                        onClick={() => downloadWelfareDocument(selectedWelfareApp.recommendationLetter!, 'recommendation_letter.pdf')}
                      >
                        <FileDown className="w-4 h-4 mr-2" />
                        Download Recommendation Letter
                      </Button>
                    )}
                    {!selectedWelfareApp.medicalDocument && !selectedWelfareApp.recommendationLetter && (
                      <p className="text-sm text-gray-500">No attachments available</p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedWelfareApp(null)}>
                  Close
                </Button>
                {selectedWelfareApp.status === 'pending' && (
                  <>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleApproveWelfare(selectedWelfareApp.id);
                        setSelectedWelfareApp(null);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowRejectWelfareDialog(true);
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Welfare Application Dialog */}
      <Dialog open={showRejectWelfareDialog} onOpenChange={setShowRejectWelfareDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Welfare Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this welfare application. The applicant will see this reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="welfare-rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="welfare-rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={welfareRejectionReason}
                onChange={(e) => setWelfareRejectionReason(e.target.value)}
                rows={4}
                className="bg-white border-gray-300"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectWelfareDialog(false);
              setWelfareRejectionReason('');
              setSelectedWelfareApp(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              if (!welfareRejectionReason.trim()) {
                alert('Please provide a rejection reason');
                return;
              }
              if (selectedWelfareApp) {
                handleRejectWelfare(selectedWelfareApp.id, welfareRejectionReason);
              }
            }}>
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Study Loan Application Details Dialog */}
      <Dialog open={!!selectedStudyLoan && !showRejectStudyLoanDialog} onOpenChange={(open) => !open && setSelectedStudyLoan(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
          {selectedStudyLoan && (
            <>
              <DialogHeader>
                <DialogTitle className="text-gray-900">Study Loan Application Details</DialogTitle>
                <DialogDescription className="text-gray-600">
                  Full application for {selectedStudyLoan.full_name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4 bg-white text-gray-900">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Applicant</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>Name:</strong> {selectedStudyLoan.full_name}</div>
                    <div><strong>Age:</strong> {selectedStudyLoan.age}</div>
                    <div><strong>Phone:</strong> {selectedStudyLoan.phone_number}</div>
                    <div><strong>Association:</strong> {selectedStudyLoan.association}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Education</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>University:</strong> {selectedStudyLoan.university}</div>
                    <div><strong>Courses:</strong> {selectedStudyLoan.courses}</div>
                    <div><strong>Admission:</strong> {selectedStudyLoan.admission_date}</div>
                    <div><strong>Expected graduation:</strong> {selectedStudyLoan.expected_graduation_date}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Loan</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>Type:</strong> {LOAN_TYPE_LABELS[selectedStudyLoan.loan_type || ''] || selectedStudyLoan.loan_type}</div>
                    <div><strong>Amount:</strong> RM {selectedStudyLoan.loan_amount?.toLocaleString()}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Guarantor</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-800">
                    <div><strong>Relationship:</strong> {selectedStudyLoan.guarantor_relationship}</div>
                    <div><strong>Phone:</strong> {selectedStudyLoan.guarantor_phone_number}</div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Uploaded documents</h3>
                  <p className="text-sm text-gray-600 mb-3">Open the files the applicant uploaded (from Supabase Storage).</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedStudyLoan.offer_letter_path && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openStudyLoanDocument(selectedStudyLoan!.offer_letter_path, 'Offer letter')}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Offer letter
                      </Button>
                    )}
                    {selectedStudyLoan.ic_front_path && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openStudyLoanDocument(selectedStudyLoan!.ic_front_path, 'IC front')}>
                        <ExternalLink className="w-3 h-3 mr-1" /> IC front
                      </Button>
                    )}
                    {selectedStudyLoan.ic_back_path && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openStudyLoanDocument(selectedStudyLoan!.ic_back_path, 'IC back')}>
                        <ExternalLink className="w-3 h-3 mr-1" /> IC back
                      </Button>
                    )}
                    {selectedStudyLoan.guarantor_ic_front_path && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openStudyLoanDocument(selectedStudyLoan!.guarantor_ic_front_path, 'Guarantor IC front')}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Guarantor IC front
                      </Button>
                    )}
                    {selectedStudyLoan.guarantor_ic_back_path && (
                      <Button type="button" size="sm" variant="outline" onClick={() => openStudyLoanDocument(selectedStudyLoan!.guarantor_ic_back_path, 'Guarantor IC back')}>
                        <ExternalLink className="w-3 h-3 mr-1" /> Guarantor IC back
                      </Button>
                    )}
                    {!selectedStudyLoan.offer_letter_path && !selectedStudyLoan.ic_front_path && !selectedStudyLoan.ic_back_path && !selectedStudyLoan.guarantor_ic_front_path && !selectedStudyLoan.guarantor_ic_back_path && (
                      <span className="text-sm text-gray-500">No document paths stored (e.g. application from localStorage).</span>
                    )}
                  </div>
                </div>
                {selectedStudyLoan.status === 'rejected' && selectedStudyLoan.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <p className="text-sm font-semibold text-red-900">Rejection reason</p>
                    <p className="text-sm text-red-800">{selectedStudyLoan.rejection_reason}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedStudyLoan(null)}>
                  Close
                </Button>
                {selectedStudyLoan.status === 'pending' && (
                  <>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleApproveStudyLoan(selectedStudyLoan.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => openStudyLoanRejectDialog(selectedStudyLoan)}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Study Loan Dialog */}
      <Dialog open={showRejectStudyLoanDialog} onOpenChange={setShowRejectStudyLoanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Study Loan Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. The applicant will see this reason on their status page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="study-loan-rejection-reason">Rejection Reason *</Label>
              <Textarea
                id="study-loan-rejection-reason"
                placeholder="Enter the reason for rejection..."
                value={studyLoanRejectionReason}
                onChange={(e) => setStudyLoanRejectionReason(e.target.value)}
                rows={4}
                className="bg-white border-gray-300"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRejectStudyLoanDialog(false);
              setStudyLoanRejectionReason('');
              setSelectedStudyLoan(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {
              if (!studyLoanRejectionReason.trim()) {
                alert('Please provide a rejection reason');
                return;
              }
              if (selectedStudyLoan) {
                handleRejectStudyLoan(selectedStudyLoan.id, studyLoanRejectionReason);
              }
            }}>
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / Edit loan recipient details */}
      <Dialog open={!!selectedRecipientForDetails} onOpenChange={(open) => { if (!open) { setSelectedRecipientForDetails(null); setEditRecipient(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white text-gray-900">
          {selectedRecipientForDetails && editRecipient && (
            <>
              <DialogHeader>
                <DialogTitle>Edit loan recipient</DialogTitle>
                <DialogDescription>
                  Update details for {selectedRecipientForDetails.full_name}. Changes sync to Supabase.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full name (English)</Label>
                    <Input
                      value={editRecipient.full_name}
                      onChange={(e) => setEditRecipient({ ...editRecipient, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Chinese name (中文)</Label>
                    <Input
                      value={editRecipient.full_name_chinese || ''}
                      onChange={(e) => setEditRecipient({ ...editRecipient, full_name_chinese: e.target.value })}
                      placeholder="中文姓名"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editRecipient.email}
                      onChange={(e) => setEditRecipient({ ...editRecipient, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={editRecipient.phone_number}
                      onChange={(e) =>
                        setEditRecipient({ ...editRecipient, phone_number: formatMalaysiaMobileDash(e.target.value) })
                      }
                      placeholder="011-1234567"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Association</Label>
                    <Input
                      value={editRecipient.association}
                      onChange={(e) => setEditRecipient({ ...editRecipient, association: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>University</Label>
                    <Input
                      value={editRecipient.university}
                      onChange={(e) => setEditRecipient({ ...editRecipient, university: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Courses</Label>
                  <Input
                    value={editRecipient.courses}
                    onChange={(e) => setEditRecipient({ ...editRecipient, courses: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Admission date</Label>
                    <Input
                      type="date"
                      value={editRecipient.admission_date || ''}
                      onChange={(e) => setEditRecipient({ ...editRecipient, admission_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected graduation date</Label>
                    <Input
                      type="date"
                      value={editRecipient.expected_graduation_date || ''}
                      onChange={(e) => setEditRecipient({ ...editRecipient, expected_graduation_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Loan amount (RM)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editRecipient.loan_amount}
                      onChange={(e) => setEditRecipient({ ...editRecipient, loan_amount: parseInt(e.target.value || '0', 10) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total paid (RM)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editRecipient.total_paid}
                      onChange={(e) => setEditRecipient({ ...editRecipient, total_paid: parseInt(e.target.value || '0', 10) })}
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <GuarantorRelationshipSelect
                    id="edit-guarantor-relationship"
                    value={editRecipient.guarantor_relationship || ''}
                    onChange={(v) => setEditRecipient({ ...editRecipient, guarantor_relationship: v })}
                  />
                  <div className="space-y-2">
                    <Label htmlFor="edit-guarantor-phone">Guarantor phone</Label>
                    <Input
                      id="edit-guarantor-phone"
                      value={editRecipient.guarantor_phone_number || ''}
                      onChange={(e) =>
                        setEditRecipient({
                          ...editRecipient,
                          guarantor_phone_number: formatMalaysiaMobileDash(e.target.value),
                        })
                      }
                      placeholder="011-1234567"
                      inputMode="numeric"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                {/* Uploaded IC details and files (student + guarantor) */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-sm text-gray-900">IC details from uploaded files</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <Label className="text-xs">Student IC information</Label>
                      <Textarea
                        rows={3}
                        placeholder="IC number / address if recorded when adding the student"
                        value={editRecipient.ic_front_text || ''}
                        onChange={(e) => setEditRecipient({ ...editRecipient, ic_front_text: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Guarantor IC information</Label>
                      <Textarea
                        rows={3}
                        placeholder="Guarantor IC number / details"
                        value={editRecipient.guarantor_ic_text || ''}
                        onChange={(e) => setEditRecipient({ ...editRecipient, guarantor_ic_text: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editRecipient.offer_letter_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.offer_letter_path || null, 'Offer letter')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Offer letter
                      </Button>
                    )}
                    {editRecipient.ic_front_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.ic_front_path || null, 'Student IC front')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Student IC front
                      </Button>
                    )}
                    {editRecipient.ic_back_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.ic_back_path || null, 'Student IC back')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Student IC back
                      </Button>
                    )}
                    {editRecipient.guarantor_ic_front_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.guarantor_ic_front_path || null, 'Guarantor IC front')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Guarantor IC front
                      </Button>
                    )}
                    {editRecipient.guarantor_ic_back_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openStudyLoanDocument(editRecipient.guarantor_ic_back_path || null, 'Guarantor IC back')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" /> Guarantor IC back
                      </Button>
                    )}
                    {!editRecipient.offer_letter_path &&
                      !editRecipient.ic_front_path &&
                      !editRecipient.ic_back_path &&
                      !editRecipient.guarantor_ic_front_path &&
                      !editRecipient.guarantor_ic_back_path && (
                        <p className="text-xs text-gray-500">
                          No document paths stored for this recipient. New entries will save paths when files are uploaded.
                        </p>
                      )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editRecipient.status}
                    onValueChange={(v) => setEditRecipient({ ...editRecipient, status: v as LoanRecipient['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editRecipient.notes || ''}
                    onChange={(e) => setEditRecipient({ ...editRecipient, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRecipientForDetails(null);
                    setEditRecipient(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (editRecipient) updateLoanRecipient(editRecipient);
                  }}
                >
                  Save changes
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Schedule notifications for loan recipients */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="max-w-lg bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle>Send notifications to recipients</DialogTitle>
            <DialogDescription>
              Choose who to notify, customise the message, and when it should be sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Who to send to</Label>
              <Select
                value={notificationTarget}
                onValueChange={(v) => setNotificationTarget(v as 'all' | 'active' | 'completed')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All loan recipients</SelectItem>
                  <SelectItem value="active">Only active (not fully paid)</SelectItem>
                  <SelectItem value="completed">Only completed loans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>When to send</Label>
              <Input
                type="datetime-local"
                value={notificationSchedule}
                onChange={(e) => setNotificationSchedule(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Date and time when notifications should be sent.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Message template</Label>
              <Textarea
                rows={4}
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>Cancel</Button>
            <Button
              variant="outline"
              disabled={sendingNotificationNow}
              onClick={async () => {
                if (sendingNotificationNow) return;
                const now = Date.now();
                // Extra guard: prevent accidental double-click spamming
                if (now - lastSendNowAt < 8000) {
                  alert('Please wait a few seconds before sending again.');
                  return;
                }
                setSendingNotificationNow(true);
                setLastSendNowAt(now);
                // Send now: insert a due row and immediately invoke the Edge Function.
                const scheduleAt = new Date().toISOString();
                const id = `loan_${Date.now()}`;
                try {
                  if (!(isSupabaseConfigured() && supabase)) {
                    alert('Supabase is not configured; Send now requires Supabase.');
                    return;
                  }

                  const { error } = await supabase.from('scheduled_notifications').insert({
                    id,
                    target: notificationTarget,
                    message: notificationMessage,
                    schedule_at: scheduleAt,
                    created_at: new Date().toISOString(),
                  });
                  if (error) {
                    alert('Failed to save to Supabase: ' + (error.message || 'Unknown error'));
                    return;
                  }

                  const serviceRoleKey = (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;
                  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
                  if (!serviceRoleKey?.trim() || !supabaseUrl?.trim()) {
                    alert('Missing VITE_SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_URL in .env (required for Send now).');
                    return;
                  }

                  const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-scheduled-notifications`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${serviceRoleKey}`,
                    },
                    body: JSON.stringify({}),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    alert(`Edge Function failed (${res.status}): ${json?.error || 'Unknown error'}`);
                    return;
                  }

                  alert(`Sent now. Processed: ${json?.processed ?? 0}`);
                  setShowNotificationDialog(false);
                } catch (e: any) {
                  alert(e?.message || 'Failed to send now');
                } finally {
                  setSendingNotificationNow(false);
                }
              }}
            >
              {sendingNotificationNow ? 'Sending…' : 'Send now'}
            </Button>
            <Button
              disabled={savingNotificationSchedule || sendingNotificationNow}
              onClick={async () => {
                if (savingNotificationSchedule) return;
                setSavingNotificationSchedule(true);
                // datetime-local returns local time without timezone. Convert to UTC ISO for timestamptz.
                const scheduleAt = notificationSchedule
                  ? new Date(notificationSchedule).toISOString()
                  : new Date().toISOString();
                try {
                  if (isSupabaseConfigured() && supabase) {
                    const { error } = await supabase.from('scheduled_notifications').insert({
                      id: `loan_${Date.now()}`,
                      target: notificationTarget,
                      message: notificationMessage,
                      schedule_at: scheduleAt,
                      created_at: new Date().toISOString(),
                    });
                    if (error) {
                      alert('Failed to save to Supabase: ' + (error.message || 'Unknown error'));
                      return;
                    }
                  } else {
                    const list = JSON.parse(localStorage.getItem('myHainanScheduledNotifications') || '[]');
                    list.push({
                      id: `loan_${Date.now()}`,
                      target: notificationTarget,
                      message: notificationMessage,
                      schedule_at: scheduleAt,
                      created_at: new Date().toISOString(),
                    });
                    localStorage.setItem('myHainanScheduledNotifications', JSON.stringify(list));
                  }
                  alert('Notification schedule saved.');
                  setShowNotificationDialog(false);
                } catch (e: any) {
                  alert(e?.message || 'Failed to save notification schedule');
                } finally {
                  setSavingNotificationSchedule(false);
                }
              }}
            >
              {savingNotificationSchedule ? 'Saving…' : 'Save schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}