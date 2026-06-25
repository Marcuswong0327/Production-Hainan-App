import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ArrowLeft, QrCode, Download, Share2, Trophy, Star, Calendar, MapPin, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';

export function MyPassPage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    // Load user's bookings from localStorage
    const allBookings = JSON.parse(localStorage.getItem('myHainanBookings') || '[]');
    const userBookings = allBookings.filter((b: any) => b.userId === user?.id);
    setBookings(userBookings);
  }, [user]);

  const activeBookings = bookings.filter(b => {
    const eventDate = new Date(b.eventDate);
    const today = new Date();
    return eventDate >= today && b.status === 'active';
  });

  const pastBookings = bookings.filter(b => {
    const eventDate = new Date(b.eventDate);
    const today = new Date();
    return eventDate < today || b.status === 'used' || b.status === 'expired';
  });

  const membershipTier = user?.points && user.points >= 500 ? 'Gold' : user?.points && user.points >= 100 ? 'Silver' : 'Bronze';
  const tierColor = membershipTier === 'Gold' ? 'from-yellow-400 to-yellow-600' : membershipTier === 'Silver' ? 'from-gray-300 to-gray-500' : 'from-orange-400 to-orange-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="space-y-4">
          {/* Digital Membership Card */}
          <Card className="shadow-2xl overflow-hidden">
            <div className={`bg-gradient-to-r ${tierColor} p-6 text-white`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm opacity-90">MyHainan Member</p>
                  <h2 className="text-2xl font-bold mt-1">{user?.name}</h2>
                  <p className="text-sm opacity-90 mt-1">{user?.email}</p>
                </div>
                <Badge className="bg-white/20 backdrop-blur text-white border-white/40">
                  {membershipTier} Member
                </Badge>
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs opacity-75">Member ID</p>
                  <p className="font-mono font-semibold">{user?.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs opacity-75">Points</p>
                  <p className="text-2xl font-bold">{user?.points || 0}</p>
                </div>
              </div>
            </div>

            <CardContent className="p-6">
              {/* QR Code Section */}
              <div className="text-center mb-6">
                <div className="bg-white p-6 rounded-lg border-2 border-dashed border-gray-300 inline-block">
                  <QrCode className="w-48 h-48 mx-auto text-gray-800" />
                  <p className="text-xs text-gray-500 mt-2">Scan at events for check-in</p>
                </div>
              </div>

              {/* Membership Benefits */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Membership Benefits</h3>
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                    <span>Priority event registration</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                    <span>10% discount on all events</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                    <span>Access to exclusive community resources</span>
                  </div>
                  {user?.donorBadge && (
                    <div className="flex items-center gap-2 text-sm">
                      <Trophy className="w-4 h-4 text-orange-500" fill="currentColor" />
                      <span>Donor recognition at events</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" className="w-full">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <Trophy className="w-8 h-8 mx-auto mb-2 text-orange-500" />
                  <p className="text-2xl font-bold text-gray-900">{user?.points || 0}</p>
                  <p className="text-sm text-gray-600">Total Points</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  {user?.donorBadge ? (
                    <>
                      <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${user.donorBadge === 'gold' ? 'bg-yellow-100' : 'bg-orange-100'
                        }`}>
                        <Trophy className={`w-5 h-5 ${user.donorBadge === 'gold' ? 'text-yellow-600' : 'text-orange-600'
                          }`} />
                      </div>
                      <p className="text-lg font-bold text-gray-900 capitalize">{user.donorBadge}</p>
                      <p className="text-sm text-gray-600">Donor Badge</p>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-600">No Badge Yet</p>
                      <p className="text-xs text-gray-500">Donate to earn</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Event Tickets Section */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>My Event Tickets 我的活动门票</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {/* Tab Buttons */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={activeTab === 'active' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('active')}
                  className="flex-1"
                >
                  Active ({activeBookings.length})
                </Button>
                <Button
                  variant={activeTab === 'past' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('past')}
                  className="flex-1"
                >
                  Past ({pastBookings.length})
                </Button>
              </div>

              {/* Ticket List */}
              <div className="space-y-4">
                {activeTab === 'active' ? (
                  activeBookings.length > 0 ? (
                    activeBookings.map((booking) => (
                      <Card key={booking.id} className="overflow-hidden border-2">
                        <CardContent className="p-0">
                          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-4">
                            <h3 className="font-semibold text-lg mb-1">{booking.eventTitle}</h3>
                            <div className="flex items-center gap-4 text-sm opacity-90">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(booking.eventDate).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {booking.eventTime}
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-white">
                            <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                              <MapPin className="w-4 h-4" />
                              {booking.eventVenue}
                            </div>

                            {/* QR Code */}
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                              <div className="bg-white p-4 inline-block rounded-lg border-2 border-dashed">
                                <QrCode className="w-32 h-32 text-gray-800" />
                              </div>
                              <p className="font-mono font-bold text-lg mt-3">{booking.qrCode}</p>
                              <p className="text-xs text-gray-500 mt-1">Show this code at the entrance</p>
                            </div>

                            <div className="mt-4 flex justify-between items-center">
                              <div>
                                <p className="text-sm text-gray-600">Attendees</p>
                                <p className="font-semibold">{booking.attendees} {booking.attendees > 1 ? 'people' : 'person'}</p>
                              </div>
                              <Badge className="bg-green-100 text-green-700">
                                Active
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <QrCode className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No active tickets</p>
                      <p className="text-sm mt-1">Book an event to get started!</p>
                    </div>
                  )
                ) : (
                  pastBookings.length > 0 ? (
                    pastBookings.map((booking) => (
                      <Card key={booking.id} className="overflow-hidden border opacity-70">
                        <CardContent className="p-0">
                          <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white p-4">
                            <h3 className="font-semibold text-lg mb-1">{booking.eventTitle}</h3>
                            <div className="flex items-center gap-4 text-sm opacity-90">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(booking.eventDate).toLocaleDateString()}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {booking.eventTime}
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-white">
                            <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                              <MapPin className="w-4 h-4" />
                              {booking.eventVenue}
                            </div>

                            {/* QR Code - Expired */}
                            <div className="bg-gray-50 p-4 rounded-lg text-center">
                              <div className="bg-white p-4 inline-block rounded-lg border-2 border-dashed opacity-50">
                                <QrCode className="w-32 h-32 text-gray-400" />
                              </div>
                              <p className="font-mono font-bold text-lg mt-3 text-gray-400">{booking.qrCode}</p>
                              <p className="text-xs text-gray-500 mt-1">Expired</p>
                            </div>

                            <div className="mt-4 flex justify-between items-center">
                              <div>
                                <p className="text-sm text-gray-600">Attendees</p>
                                <p className="font-semibold">{booking.attendees} {booking.attendees > 1 ? 'people' : 'person'}</p>
                              </div>
                              <Badge className="bg-gray-100 text-gray-600">
                                Used
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <QrCode className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No past tickets</p>
                      <p className="text-sm mt-1">Your event history will appear here</p>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}