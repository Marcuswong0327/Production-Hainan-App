import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ArrowLeft, Calendar, Clock, MapPin, CreditCard, Smartphone, Building2, CheckCircle2 } from 'lucide-react';

interface Event {
    id: string;
    title: string;
    date: string;
    time: string;
    venue: string;
    price: number;
    description: string;
    imageUrl?: string;
}

export function EventBookingPage({ event, onBack }: { event: Event; onBack: () => void }) {
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [attendees, setAttendees] = useState(1);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [bookingComplete, setBookingComplete] = useState(false);

    const totalPrice = event.price * attendees;

    const handleCompleteBooking = () => {
        // Save booking to localStorage
        const bookings = JSON.parse(localStorage.getItem('myHainanBookings') || '[]');
        const newBooking = {
            id: Date.now().toString(),
            userId: user?.id,
            eventId: event.id,
            eventTitle: event.title,
            eventDate: event.date,
            eventTime: event.time,
            eventVenue: event.venue,
            attendees,
            totalPrice,
            paymentMethod,
            status: 'active',
            bookingDate: new Date().toISOString(),
            qrCode: generateQRCode(),
        };
        bookings.push(newBooking);
        localStorage.setItem('myHainanBookings', JSON.stringify(bookings));

        // Update user points
        if (user) {
            const pointsEarned = Math.floor(totalPrice / 10);
            const updatedUser = { ...user, points: (user.points || 0) + pointsEarned };
            localStorage.setItem('myHainanUser', JSON.stringify(updatedUser));
        }

        setBookingComplete(true);
    };

    const generateQRCode = () => {
        // Generate 2 letters + 5 digits
        const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
            String.fromCharCode(65 + Math.floor(Math.random() * 26));
        const numbers = Math.floor(10000 + Math.random() * 90000);
        return `${letters}${numbers}`;
    };

    if (bookingComplete) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                <div className="max-w-2xl mx-auto">
                    <Card className="shadow-xl">
                        <CardContent className="pt-6 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed! 预订成功!</h2>
                            <p className="text-gray-600 mb-6">
                                Your tickets have been booked successfully.
                            </p>
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg mb-6">
                                <p className="text-sm font-medium text-gray-700 mb-2">Your tickets are now in My Pass</p>
                                <p className="text-xs text-gray-600">Check "Active" tab to view your QR code</p>
                            </div>
                            <div className="space-y-2">
                                <Button onClick={onBack} className="w-full">
                                    Return to Events
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <div className="max-w-2xl mx-auto">
                <Button variant="ghost" onClick={onBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Events
                </Button>

                <Card className="shadow-xl">
                    <CardHeader className="border-b bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
                        <CardTitle className="text-2xl">Book Event 预订活动</CardTitle>
                    </CardHeader>

                    <CardContent className="pt-6 space-y-6">
                        {/* Progress Steps */}
                        <div className="flex items-center justify-between mb-8">
                            {[1, 2, 3].map((s) => (
                                <div key={s} className="flex items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= s ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                        {s}
                                    </div>
                                    {s < 3 && <div className={`w-16 h-1 mx-2 ${step > s ? 'bg-blue-500' : 'bg-gray-200'}`} />}
                                </div>
                            ))}
                        </div>

                        {/* Event Details */}
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <h3 className="font-semibold mb-3">{event.title}</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4" />
                                    <span>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    <span>{event.time}</span>
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <MapPin className="w-4 h-4" />
                                    <span>{event.venue}</span>
                                </div>
                            </div>
                        </div>

                        {/* Step 1: Select Attendees */}
                        {step === 1 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Number of Attendees 人数</h3>

                                <div className="space-y-2">
                                    <Label>How many people?</Label>
                                    <div className="flex items-center gap-4">
                                        <Button
                                            variant="outline"
                                            onClick={() => setAttendees(Math.max(1, attendees - 1))}
                                            className="w-12 h-12"
                                        >
                                            -
                                        </Button>
                                        <div className="flex-1 text-center">
                                            <p className="text-3xl font-bold">{attendees}</p>
                                            <p className="text-sm text-gray-500">Attendee{attendees > 1 ? 's' : ''}</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => setAttendees(attendees + 1)}
                                            className="w-12 h-12"
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-gray-700">Price per person:</span>
                                        <span className="font-semibold">RM{event.price.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-lg">Total:</span>
                                        <span className="font-bold text-lg text-blue-600">RM{totalPrice.toFixed(2)}</span>
                                    </div>
                                </div>

                                <Button onClick={() => setStep(2)} className="w-full">
                                    Continue to Payment
                                </Button>
                            </div>
                        )}

                        {/* Step 2: Payment Method */}
                        {step === 2 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Payment Method 支付方式</h3>

                                <div className="grid gap-3">
                                    {[
                                        { id: 'online_banking', name: 'Online Banking', icon: Building2 },
                                        { id: 'credit_card', name: 'Credit/Debit Card', icon: CreditCard },
                                        { id: 'ewallet', name: 'E-Wallet (TNG/GrabPay)', icon: Smartphone },
                                    ].map(method => (
                                        <Card
                                            key={method.id}
                                            className={`cursor-pointer transition-all ${paymentMethod === method.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'hover:border-blue-300'
                                                }`}
                                            onClick={() => setPaymentMethod(method.id)}
                                        >
                                            <CardContent className="p-4 flex items-center gap-3">
                                                <method.icon className="w-5 h-5 text-blue-600" />
                                                <span className="font-medium">{method.name}</span>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                                        Back
                                    </Button>
                                    <Button
                                        onClick={() => setStep(3)}
                                        disabled={!paymentMethod}
                                        className="flex-1"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Payment Details */}
                        {step === 3 && (
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Payment Details 支付详情</h3>

                                {paymentMethod === 'credit_card' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>Card Number</Label>
                                            <Input placeholder="1234 5678 9012 3456" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                                <Label>Expiry</Label>
                                                <Input placeholder="MM/YY" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>CVV</Label>
                                                <Input placeholder="123" type="password" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'online_banking' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>Select Bank</Label>
                                            <select className="w-full border rounded-md p-2">
                                                <option>Maybank</option>
                                                <option>CIMB Bank</option>
                                                <option>Public Bank</option>
                                                <option>Hong Leong Bank</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'ewallet' && (
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>Phone Number</Label>
                                            <Input placeholder="012-345-6789" />
                                        </div>
                                    </div>
                                )}

                                {/* Summary */}
                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <h4 className="font-semibold mb-2">Booking Summary</h4>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Event:</span>
                                        <span className="font-medium">{event.title}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Attendees:</span>
                                        <span className="font-medium">{attendees}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Payment Method:</span>
                                        <span className="font-medium capitalize">{paymentMethod.replace('_', ' ')}</span>
                                    </div>
                                    <div className="border-t pt-2 mt-2">
                                        <div className="flex justify-between font-bold">
                                            <span>Total Amount:</span>
                                            <span className="text-blue-600">RM{totalPrice.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleCompleteBooking}
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                    >
                                        Complete Payment
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
