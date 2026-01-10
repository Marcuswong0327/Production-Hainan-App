import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Calendar, Clock, MapPin, DollarSign, Building2, CheckCircle, XCircle, Clock as ClockIcon } from 'lucide-react';


interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  price: number;
  description: string;
  status: string;
  associationName?: string;
  createdAt: string;
  rejectionComment?: string;
}


export function SubEditorDashboard() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '',
    venue: '',
    price: '',
    description: '',
    imageUrl: 'https://images.unsplash.com/photo-1760281151533-6667546ec444?w=800',
    organizationName: '',
  });
  const [myEvents, setMyEvents] = useState<Event[]>([]);


  useEffect(() => {
    fetchMyEvents();
  }, []);


  const fetchMyEvents = () => {
    try {
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const userEvents = events.filter((e: any) => e.createdBy === user?.id);
      setMyEvents(userEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);


    try {
      if (!eventForm.organizationName.trim()) {
        alert('Please enter the organization/association name');
        setLoading(false);
        return;
      }


      // Frontend-only: Save to localStorage
      const events = JSON.parse(localStorage.getItem('myHainanEvents') || '[]');
      const newEvent = {
        id: Date.now().toString(),
        ...eventForm,
        price: parseFloat(eventForm.price),
        associationId: user?.associationId,
        associationName: eventForm.organizationName,
        status: 'pending',
        createdBy: user?.id,
        createdAt: new Date().toISOString(),
      };
      events.push(newEvent);
      localStorage.setItem('myHainanEvents', JSON.stringify(events));


      alert('Event submitted for approval! Super Admin will review it soon.');
      setEventForm({
        title: '',
        date: '',
        time: '',
        venue: '',
        price: '',
        description: '',
        imageUrl: 'https://images.unsplash.com/photo-1760281151533-6667546ec444?w=800',
        organizationName: '',
      });
      fetchMyEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      alert('Failed to create event');
    } finally {
      setLoading(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline"><ClockIcon className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="font-bold text-2xl">Sub-Editor Dashboard</h1>
            <p className="text-sm text-gray-600">分会编辑中心</p>
          </div>
          <Button variant="outline" onClick={signOut}>
            Sign Out
          </Button>
        </div>
      </div>


      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="create">Create Event</TabsTrigger>
            <TabsTrigger value="status">Approval Status</TabsTrigger>
          </TabsList>


          {/* Create Event Tab */}
          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create New Event</CardTitle>
                <CardDescription>
                  Fill in the event details. Your submission will be reviewed by Super Admin before going live.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Organization/Association Name */}
                  <div className="space-y-2">
                    <Label htmlFor="organizationName">Organization/Association Name *</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="organizationName"
                        placeholder="e.g., Selangor Hainan Association"
                        value={eventForm.organizationName}
                        onChange={(e) => setEventForm({ ...eventForm, organizationName: e.target.value })}
                        className="pl-10 text-lg"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Please specify which organization is organizing this event
                    </p>
                  </div>


                  {/* Event Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Event Title</Label>
                    <Input
                      id="title"
                      placeholder="Chinese New Year Dinner 2025"
                      value={eventForm.title}
                      onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                      className="text-lg"
                      required
                    />
                  </div>


                  {/* Date and Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="date"
                          type="date"
                          value={eventForm.date}
                          onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="time"
                          type="time"
                          value={eventForm.time}
                          onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                  </div>


                  {/* Venue */}
                  <div className="space-y-2">
                    <Label htmlFor="venue">Venue</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="venue"
                        placeholder="Hainan Association Hall, Kuala Lumpur"
                        value={eventForm.venue}
                        onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>


                  {/* Price */}
                  <div className="space-y-2">
                    <Label htmlFor="price">Ticket Price (RM)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        placeholder="100.00"
                        value={eventForm.price}
                        onChange={(e) => setEventForm({ ...eventForm, price: e.target.value })}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>


                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Event Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the event, activities, special guests, etc."
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      rows={5}
                      required
                    />
                  </div>


                  {/* Image URL */}
                  <div className="space-y-2">
                    <Label htmlFor="imageUrl">Event Image URL (optional)</Label>
                    <Input
                      id="imageUrl"
                      type="url"
                      placeholder="https://example.com/event-image.jpg"
                      value={eventForm.imageUrl}
                      onChange={(e) => setEventForm({ ...eventForm, imageUrl: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">
                      A default image will be used if not provided
                    </p>
                  </div>


                  {/* Submit Button */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-3">
                      <strong>Note:</strong> Your event will be submitted for review and will not be visible to the public until approved by the Super Admin.
                    </p>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? 'Submitting...' : 'Submit for Approval'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Approval Status Tab */}
          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>Event Approval Status</CardTitle>
                <CardDescription>
                  Track the approval status of your submitted events
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No events submitted yet. Create your first event to see its status here.
                  </div>
                ) : (
                  myEvents.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg mb-1">{event.title}</h3>
                            {event.associationName && (
                              <p className="text-sm text-gray-600 mb-2">
                                <Building2 className="w-3 h-3 inline mr-1" />
                                {event.associationName}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                              <div>Date: {event.date}</div>
                              <div>Time: {event.time}</div>
                              <div>Venue: {event.venue}</div>
                              <div>Price: RM {event.price}</div>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{event.description}</p>
                            <p className="text-xs text-gray-500">
                              Submitted: {new Date(event.createdAt).toLocaleDateString()}
                            </p>
                            {event.rejectionComment && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                <strong>Rejection Reason:</strong> {event.rejectionComment}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            {getStatusBadge(event.status)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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

