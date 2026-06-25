import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Upload, UserPlus } from 'lucide-react';


interface CommitteeMember {
  role: string;
  name: string;
}


export function SubAdminDashboard() {
  const { user, signOut } = useAuth();
  const [association, setAssociation] = useState<any>(null);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [associationName, setAssociationName] = useState('');
  const [showAssociationPrompt, setShowAssociationPrompt] = useState(false);
  const [hasSetAssociation, setHasSetAssociation] = useState(false);


  useEffect(() => {
    if (user?.associationId) {
      fetchAssociation();
      // Check if association name is already set
      const assocs = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      const found = assocs.find((a: any) => a.id === user?.associationId);
      if (found && found.name) {
        setHasSetAssociation(true);
        setAssociationName(found.name);
      } else {
        setShowAssociationPrompt(true);
      }
    } else {
      setShowAssociationPrompt(true);
    }
  }, [user]);


  const fetchAssociation = async () => {
    try {
      // Frontend-only: Load from localStorage
      const associations = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      const found = associations.find((a: any) => a.id === user?.associationId);
      if (found) {
        setAssociation(found);
        setCommitteeMembers(found.committeeMembers || []);
      }
    } catch (error) {
      console.error('Error fetching association:', error);
    }
  };


  const handleAddMember = () => {
    setCommitteeMembers([...committeeMembers, { role: '', name: '' }]);
  };


  const handleUpdateMember = (index: number, field: 'role' | 'name', value: string) => {
    const updated = [...committeeMembers];
    updated[index][field] = value;
    setCommitteeMembers(updated);
  };


  const handleRemoveMember = (index: number) => {
    const updated = committeeMembers.filter((_, i) => i !== index);
    setCommitteeMembers(updated);
  };


  const handleSaveCommittee = async () => {
    setLoading(true);
    try {
      // Ensure user has associationId
      if (!user?.associationId) {
        alert('Error: Association ID not found. Please log in again.');
        return;
      }


      // Frontend-only: Save to localStorage
      const associations = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      const assocId = user.associationId; // Use the association_id from login
      let index = associations.findIndex((a: any) => a.id === assocId);

      // Prepare committee members data with title (role) and name
      const membersData = committeeMembers.map(member => ({
        title: member.role || '',
        name: member.name || '',
        role: member.role || '', // Keep for backward compatibility
      }));

      if (index === -1) {
        // Create new association if it doesn't exist
        associations.push({
          id: assocId, // Store association_id
          name: associationName || 'Unknown Association',
          location: associationName || 'Unknown Association', // Location same as name
          committeeMembers: membersData,
          createdAt: new Date().toISOString(),
        });
      } else {
        // Update existing association
        associations[index].id = assocId; // Ensure association_id is stored
        associations[index].committeeMembers = membersData;
        // Ensure name and location are set
        if (associationName) {
          associations[index].name = associationName;
          associations[index].location = associationName; // Location same as name
        }
      }

      localStorage.setItem('myHainanAssociations', JSON.stringify(associations));
      alert('Committee members updated successfully! Data will be available for Super Admin to download.');
      fetchAssociation();
    } catch (error) {
      console.error('Error saving committee:', error);
      alert('Failed to save committee members');
    } finally {
      setLoading(false);
    }
  };


  const handleSetAssociation = async () => {
    if (!associationName.trim()) {
      alert('Please enter the association name');
      return;
    }


    setLoading(true);
    try {
      // Frontend-only: Save to localStorage
      const associations = JSON.parse(localStorage.getItem('myHainanAssociations') || '[]');
      const assocId = user?.associationId || `assoc_${Date.now()}`;

      let index = associations.findIndex((a: any) => a.id === assocId);
      if (index === -1) {
        // Create new association
        associations.push({
          id: assocId,
          name: associationName,
          location: associationName, // Location same as name
          committeeMembers: [],
          createdAt: new Date().toISOString(),
        });
      } else {
        // Update existing association
        associations[index].name = associationName;
        associations[index].location = associationName; // Location same as name
      }

      localStorage.setItem('myHainanAssociations', JSON.stringify(associations));
      setHasSetAssociation(true);
      setShowAssociationPrompt(false);
      fetchAssociation();
      alert('Association name saved successfully!');
    } catch (error) {
      console.error('Error saving association:', error);
      alert('Failed to save association name');
    } finally {
      setLoading(false);
    }
  };


  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


    if (!hasSetAssociation) {
      alert('Please set your association name first before uploading committee members.');
      return;
    }


    alert('AI OCR Feature: In a production environment, this would use Google Gemini API to extract handwritten text from the uploaded image and auto-populate the committee members list.');


    // Mock auto-fill for demonstration
    const mockData = [
      { role: '会长', name: 'Wong Ah Meng' },
      { role: '副会长', name: 'Tan Ah Kao' },
      { role: '秘书', name: 'Lim Siew Cheng' },
      { role: '财政', name: 'Chan Mei Ling' },
    ];
    setCommitteeMembers(mockData);
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-bold text-2xl">Sub-Admin Dashboard</h1>
            <p className="text-sm text-gray-600">分会管理中心 - {association?.name || associationName || 'Not Set'}</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>


      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Association Name Prompt */}
        {showAssociationPrompt && (
          <Card className="mb-6 border-blue-300 bg-blue-50">
            <CardHeader>
              <CardTitle>Set Your Association</CardTitle>
              <CardDescription>
                Please enter which association you're from before entering committee members
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="association-name">Association Name *</Label>
                <Input
                  id="association-name"
                  placeholder="e.g., Selangor Hainan Association"
                  value={associationName}
                  onChange={(e) => setAssociationName(e.target.value)}
                  className="text-lg"
                  required
                />
                <p className="text-xs text-gray-600">
                  This helps identify which association the committee members belong to
                </p>
              </div>
              <Button
                onClick={handleSetAssociation}
                className="w-full"
                disabled={loading || !associationName.trim()}
              >
                {loading ? 'Saving...' : 'Save Association'}
              </Button>
            </CardContent>
          </Card>
        )}


        <Tabs defaultValue="committee" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="committee">Committee Members</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>


          {/* Committee Members Tab */}
          <TabsContent value="committee">
            {!hasSetAssociation ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-600 mb-4">
                    Please set your association name above before entering committee members.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Manage Committee Members (理事表)</CardTitle>
                  <CardDescription>
                    Fill in your association's committee members list
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* AI Handwriting Input */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <Upload className="w-6 h-6 text-blue-600 mt-1" />
                        <div className="flex-1">
                          <h3 className="font-semibold mb-2">AI Handwriting Recognition</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            Upload a photo of your handwritten committee list, and AI will automatically extract the names.
                            Perfect for seniors who prefer traditional methods!
                          </p>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoUpload}
                              className="hidden"
                              id="photo-upload"
                            />
                            <label htmlFor="photo-upload">
                              <Button asChild variant="outline">
                                <span className="cursor-pointer">
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Photo
                                </span>
                              </Button>
                            </label>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>


                  {/* Manual Input */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Or Type Manually</h3>
                      <Button size="sm" variant="outline" onClick={handleAddMember}>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add Member
                      </Button>
                    </div>


                    <div className="space-y-3">
                      {committeeMembers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No committee members added yet. Click "Add Member" to start.
                        </div>
                      ) : (
                        committeeMembers.map((member, index) => (
                          <Card key={index}>
                            <CardContent className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor={`role-${index}`}>Position (职位)</Label>
                                  <Input
                                    id={`role-${index}`}
                                    placeholder="e.g., 会长, 副会长"
                                    value={member.role}
                                    onChange={(e) => handleUpdateMember(index, 'role', e.target.value)}
                                    className="text-lg"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`name-${index}`}>Name (姓名)</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      id={`name-${index}`}
                                      placeholder="e.g., Wong Ah Meng"
                                      value={member.name}
                                      onChange={(e) => handleUpdateMember(index, 'name', e.target.value)}
                                      className="text-lg"
                                    />
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleRemoveMember(index)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>


                    <Button
                      className="w-full mt-4"
                      size="lg"
                      onClick={handleSaveCommittee}
                      disabled={loading || committeeMembers.length === 0}
                    >
                      {loading ? 'Saving...' : 'Save Committee Members'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>


          {/* Reports Tab */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle>Association Reports</CardTitle>
                <CardDescription>View donation and membership reports for your association</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <p className="text-gray-600 mb-4">
                    Donation and membership reports will appear here
                  </p>
                  <Button variant="outline">Generate Report</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

