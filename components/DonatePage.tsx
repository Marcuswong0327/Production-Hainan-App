import { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ArrowLeft, Heart, CreditCard, Building2, Smartphone } from 'lucide-react';
import { Badge } from '../ui/badge';

interface Association {
  id: string;
  name: string;
  state: string;
}

export function DonatePage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedState, setSelectedState] = useState('');
  const [selectedAssociation, setSelectedAssociation] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [donorName, setDonorName] = useState(user?.name || '');
  const [associations, setAssociations] = useState<Association[]>([]);

  useEffect(() => {
    // Load associations from localStorage
    const saved = localStorage.getItem('myHainanAssociations');
    if (saved) {
      setAssociations(JSON.parse(saved));
    } else {
      // Default associations
      const defaultAssociations = [
        { id: 'selangor_01', name: 'Selangor Hainan Association', state: 'Selangor' },
        { id: 'selangor_02', name: 'Petaling Jaya Hainan Clan', state: 'Selangor' },
        { id: 'kl_01', name: 'KL Hainan Association', state: 'Kuala Lumpur' },
        { id: 'kl_02', name: 'Cheras Hainan Community', state: 'Kuala Lumpur' },
        { id: 'penang_01', name: 'Penang Hainan Association', state: 'Penang' },
        { id: 'penang_02', name: 'Georgetown Hainan Clan', state: 'Penang' },
        { id: 'johor_01', name: 'Johor Bahru Hainan Association', state: 'Johor' },
        { id: 'melaka_01', name: 'Melaka Hainan Community', state: 'Melaka' },
      ];
      setAssociations(defaultAssociations);
      localStorage.setItem('myHainanAssociations', JSON.stringify(defaultAssociations));
    }
  }, []);

  const states = [...new Set(associations.map(a => a.state))].sort();
  const filteredAssociations = associations.filter(a => a.state === selectedState);

  const quickAmounts = [50, 100, 200, 500, 1000, 5000];

  const handleDonate = () => {
    // Save donation to localStorage
    const donations = JSON.parse(localStorage.getItem('myHainanDonations') || '[]');
    const newDonation = {
      id: Date.now().toString(),
      userId: user?.id,
      donorName,
      associationId: selectedAssociation,
      amount: parseFloat(amount),
      paymentMethod,
      date: new Date().toISOString(),
      status: 'completed',
    };
    donations.push(newDonation);
    localStorage.setItem('myHainanDonations', JSON.stringify(donations));

    // Update user's total donations and badge
    if (user) {
      const totalDonations = (user.totalDonations || 0) + parseFloat(amount);
      let badge = user.donorBadge;
      if (totalDonations >= 5000) badge = 'gold';
      else if (totalDonations >= 100) badge = 'bronze';

      const updatedUser = { ...user, totalDonations, donorBadge: badge };
      localStorage.setItem('myHainanUser', JSON.stringify(updatedUser));
    }

    setStep(4); // Success
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 p-4">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        {step === 4 ? (
          <Card className="shadow-xl">
            <CardContent className="pt-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-10 h-10 text-green-600" fill="currentColor" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You! 感谢您!</h2>
              <p className="text-gray-600 mb-6">
                Your generous donation of RM{amount} has been received.
              </p>
              {user && user.donorBadge && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-lg mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Your Donor Status</p>
                  <Badge className={user.donorBadge === 'gold' ? 'bg-yellow-500' : 'bg-orange-600'}>
                    {user.donorBadge === 'gold' ? '🏆 Gold Donor' : '🥉 Bronze Donor'}
                  </Badge>
                </div>
              )}
              <Button onClick={onBack} className="w-full">
                Return to Home
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl">
            <CardHeader className="border-b bg-gradient-to-r from-red-500 to-orange-500 text-white">
              <div className="flex items-center gap-3">
                <Heart className="w-8 h-8" />
                <div>
                  <CardTitle className="text-2xl">Donate 捐款</CardTitle>
                  <p className="text-sm text-red-100 mt-1">Support your local Hainan association</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              {/* Progress Steps */}
              <div className="flex items-center justify-between mb-8">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step >= s ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                      {s}
                    </div>
                    {s < 3 && <div className={`w-16 h-1 mx-2 ${step > s ? 'bg-red-500' : 'bg-gray-200'}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Select State & Association */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Select Association 选择会馆</h3>

                  <div className="space-y-2">
                    <Label>State / 州属</Label>
                    <Select value={selectedState} onValueChange={setSelectedState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose your state" />
                      </SelectTrigger>
                      <SelectContent>
                        {states.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedState && (
                    <div className="space-y-2">
                      <Label>Association / 会馆</Label>
                      <div className="grid gap-3">
                        {filteredAssociations.map(assoc => (
                          <Card
                            key={assoc.id}
                            className={`cursor-pointer transition-all ${selectedAssociation === assoc.id
                              ? 'border-red-500 bg-red-50'
                              : 'hover:border-red-300'
                              }`}
                            onClick={() => setSelectedAssociation(assoc.id)}
                          >
                            <CardContent className="p-4 flex items-center gap-3">
                              <Building2 className="w-5 h-5 text-red-600" />
                              <span className="font-medium">{assoc.name}</span>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => setStep(2)}
                    disabled={!selectedAssociation}
                    className="w-full"
                  >
                    Next
                  </Button>
                </div>
              )}

              {/* Step 2: Select Amount */}
              {step === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Donation Amount 捐款金额</h3>

                  <div className="grid grid-cols-3 gap-3">
                    {quickAmounts.map(amt => (
                      <Button
                        key={amt}
                        variant={amount === amt.toString() ? 'default' : 'outline'}
                        onClick={() => setAmount(amt.toString())}
                        className="h-16"
                      >
                        RM{amt}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label>Custom Amount (RM)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Donor Name</Label>
                    <Input
                      type="text"
                      placeholder="Your name"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      Back
                    </Button>
                    <Button
                      onClick={() => setStep(3)}
                      disabled={!amount || parseFloat(amount) <= 0}
                      className="flex-1"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Payment Method */}
              {step === 3 && (
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
                          ? 'border-red-500 bg-red-50'
                          : 'hover:border-red-300'
                          }`}
                        onClick={() => setPaymentMethod(method.id)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <method.icon className="w-5 h-5 text-red-600" />
                          <span className="font-medium">{method.name}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <h4 className="font-semibold mb-2">Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Association:</span>
                      <span className="font-medium">
                        {associations.find(a => a.id === selectedAssociation)?.name}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium">RM{amount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Donor:</span>
                      <span className="font-medium">{donorName || 'Anonymous'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                      Back
                    </Button>
                    <Button
                      onClick={handleDonate}
                      disabled={!paymentMethod}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      Complete Donation
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
