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
import { CheckCircle, XCircle, FileText, Building2, Download } from 'lucide-react';
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
}


export function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [associations, setAssociations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);


  // New Association Form
  const [newAssociation, setNewAssociation] = useState({
    id: '',
    name: '',
    location: '',
  });


  useEffect(() => {
    fetchPendingEvents();
    fetchAssociations();
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


  const handleApproveEvent = async (eventId: string) => {
    try {
      // Frontend-only: Update in localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const index = events.findIndex((e: any) => e.id === eventId);
      if (index !== -1) {
        events[index].status = 'approved';
        localStorage.setItem('myHainanEvents', JSON.stringify(events));
        fetchPendingEvents();
        alert('Event approved successfully!');
      }
    } catch (error) {
      console.error('Error approving event:', error);
      alert('Failed to approve event');
    }
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
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="events">Event Approval</TabsTrigger>
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
                            </div>
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
    </div>
  );
}

