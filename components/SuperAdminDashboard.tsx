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
import { CheckCircle, XCircle, FileText, Building2, Download, HeartHandshake, Eye, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';


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
    
    // Refresh welfare applications periodically
    const interval = setInterval(() => {
      fetchWelfareApplications();
    }, 2000);
    
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
      // Frontend-only: Load from localStorage
      const allApplications = JSON.parse(localStorage.getItem('myHainanWelfareApplications') || '[]');
      setWelfareApplications(allApplications);
    } catch (error) {
      console.error('Error fetching welfare applications:', error);
    }
  };


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


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-bold text-2xl">Super Admin Dashboard</h1>
            <p className="text-sm text-gray-600">总会管理中心</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>


      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="events" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="events">Event Approval</TabsTrigger>
            <TabsTrigger value="welfare">Welfare Applications</TabsTrigger>
            <TabsTrigger value="associations">Associations</TabsTrigger>
            <TabsTrigger value="export">Export Data</TabsTrigger>
          </TabsList>


          {/* Event Approval Tab */}
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

          {/* Welfare Applications Tab */}
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
                {/* Filter Tabs */}
                <div className="flex gap-2 border-b pb-4">
                  <Button
                    variant={welfareFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWelfareFilter('all')}
                  >
                    All ({welfareApplications.length})
                  </Button>
                  <Button
                    variant={welfareFilter === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWelfareFilter('pending')}
                  >
                    Pending ({welfareApplications.filter(a => a.status === 'pending').length})
                  </Button>
                  <Button
                    variant={welfareFilter === 'approved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWelfareFilter('approved')}
                  >
                    Approved ({welfareApplications.filter(a => a.status === 'approved').length})
                  </Button>
                  <Button
                    variant={welfareFilter === 'rejected' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setWelfareFilter('rejected')}
                  >
                    Rejected ({welfareApplications.filter(a => a.status === 'rejected').length})
                  </Button>
                </div>

                {filteredWelfareApplications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No welfare applications found
                  </div>
                ) : (
                  filteredWelfareApplications.map((application) => (
                    <Card key={application.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">
                                {application.applicantNameEnglish || application.applicantNameChinese}
                              </h3>
                              <Badge
                                variant={
                                  application.status === 'approved'
                                    ? 'default'
                                    : application.status === 'rejected'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className={
                                  application.status === 'approved'
                                    ? 'bg-green-600'
                                    : application.status === 'rejected'
                                    ? 'bg-red-600'
                                    : 'bg-yellow-600'
                                }
                              >
                                {application.status === 'approved'
                                  ? 'Approved'
                                  : application.status === 'rejected'
                                  ? 'Rejected'
                                  : 'Pending'}
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
                              <div>
                                Request Type: {application.requestType === 'general_welfare'
                                  ? 'General Welfare Fund'
                                  : 'Sub-Association Donation'}
                              </div>
                              {application.recommendedBySubAssociation && (
                                <div className="col-span-2">
                                  <Badge variant="outline" className="bg-blue-50">
                                    <Building2 className="w-3 h-3 mr-1" />
                                    Recommended by: {application.recommendedBySubAssociation}
                                  </Badge>
                                </div>
                              )}
                            </div>

                            {application.applicationReason && (
                              <div className="mb-3">
                                <p className="text-sm font-semibold mb-1">Application Reason:</p>
                                <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                                  {application.applicationReason.substring(0, 200)}
                                  {application.applicationReason.length > 200 ? '...' : ''}
                                </p>
                              </div>
                            )}

                            <div className="flex gap-2 mb-2">
                              {(application.medicalDocument || application.recommendationLetter) && (
                                <>
                                  {application.medicalDocument && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => downloadWelfareDocument(application.medicalDocument!, 'medical_document.pdf')}
                                    >
                                      <FileDown className="w-3 h-3 mr-1" />
                                      Medical Doc
                                    </Button>
                                  )}
                                  {application.recommendationLetter && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => downloadWelfareDocument(application.recommendationLetter!, 'recommendation_letter.pdf')}
                                    >
                                      <FileDown className="w-3 h-3 mr-1" />
                                      Recommendation Letter
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>

                            <Badge variant="outline">
                              Submitted: {new Date(application.submittedAt).toLocaleDateString()}
                            </Badge>

                            {application.status === 'rejected' && application.rejectionReason && (
                              <div className="mt-3 bg-red-50 border border-red-200 p-3 rounded">
                                <p className="text-sm font-semibold text-red-900 mb-1">Rejection Reason:</p>
                                <p className="text-sm text-red-800">{application.rejectionReason}</p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewWelfareDetails(application)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View Details
                            </Button>
                            {application.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApproveWelfare(application.id)}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => openWelfareRejectDialog(application)}
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

          {/* Associations Tab */}
          <TabsContent value="associations">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create New Association */}
              <Card>
                <CardHeader>
                  <CardTitle>Create New Association</CardTitle>
                  <CardDescription>Add a new Sub-Association (分会)</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCreateAssociation} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="assoc-id">Association ID</Label>
                      <Input
                        id="assoc-id"
                        placeholder="e.g., selangor_01"
                        value={newAssociation.id}
                        onChange={(e) => setNewAssociation({ ...newAssociation, id: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assoc-name">Association Name</Label>
                      <Input
                        id="assoc-name"
                        placeholder="Selangor Hainan Association"
                        value={newAssociation.name}
                        onChange={(e) => setNewAssociation({ ...newAssociation, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assoc-location">Location</Label>
                      <Input
                        id="assoc-location"
                        placeholder="Selangor"
                        value={newAssociation.location}
                        onChange={(e) => setNewAssociation({ ...newAssociation, location: e.target.value })}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Creating...' : 'Create Association'}
                    </Button>
                  </form>
                </CardContent>
              </Card>


              {/* Existing Associations */}
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


          {/* Export Data Tab */}
          <TabsContent value="export">
            <Card>
              <CardHeader>
                <CardTitle>Export Master Data</CardTitle>
                <CardDescription>
                  Generate Excel reports per association based on sub admin submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Per Association Export */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-lg">Export Association Report</h3>
                      <p className="text-sm text-gray-600">
                        Download Excel file for a specific association
                      </p>
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
                      <p className="text-xs text-gray-600">
                        {associations.length} association(s) available for export
                      </p>
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleDownloadSelected}
                      disabled={!selectedAssociationForExport || associations.length === 0}
                    >
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


                {/* Consolidated Report (Optional) */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <FileText className="w-8 h-8 text-green-600 mb-2" />
                  <h3 className="font-semibold mb-1">Consolidated Report</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Generate a consolidated list of all associations
                  </p>
                  <Button className="w-full" variant="outline" onClick={() => generateExcelReport()}>
                    Generate Consolidated Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
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
    </div>
  );
}