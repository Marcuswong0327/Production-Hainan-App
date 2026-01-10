import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ChevronDown, User, Shield, Edit3, Users } from 'lucide-react';
import { Badge } from '../ui/badge';

export function RoleSwitcher() {
  const { user, switchRole, updateUser } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  if (!user || !user.roles || user.roles.length <= 1) {
    return null; // Don't show switcher if user has only one role
  }

  const currentRole = user.currentRole || user.role;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Shield className="w-4 h-4" />;
      case 'sub_admin':
        return <Users className="w-4 h-4" />;
      case 'sub_editor':
        return <Edit3 className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'sub_admin':
        return 'Sub Admin';
      case 'sub_editor':
        return 'Sub Editor';
      default:
        return 'Public User';
    }
  };

  const handleRoleClick = (role: string) => {
    if (role === currentRole) {
      setShowMenu(false);
      return;
    }

    // Check if verification is needed
    const needsVerification = !user.roleVerificationId ||
      !user.roleVerificationExpiry ||
      new Date(user.roleVerificationExpiry) < new Date();

    if (needsVerification && role !== 'public') {
      setSelectedRole(role);
      setShowVerification(true);
      setShowMenu(false);
    } else {
      // Switch role directly
      switchRole(role, user.roleVerificationId);
      setShowMenu(false);
    }
  };

  const handleVerification = () => {
    setError('');

    // Validate format: HNHG followed by 4 digits
    const regex = /^HNHG\s?\d{4}$/i;
    if (!regex.test(verificationId)) {
      setError('Invalid format. Please use format: HNHG 1011');
      return;
    }

    // Set verification expiry to 30 days from now
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    // Update user with verification details
    updateUser({
      roleVerificationId: verificationId.toUpperCase().replace(/\s/g, ''),
      roleVerificationExpiry: expiry.toISOString(),
      currentRole: selectedRole as any,
    });

    setShowVerification(false);
    setVerificationId('');
    setSelectedRole('');
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2"
        >
          {getRoleIcon(currentRole)}
          <span className="hidden sm:inline">{getRoleLabel(currentRole)}</span>
          <ChevronDown className="w-4 h-4" />
        </Button>

        {showMenu && (
          <div className="absolute right-0 top-12 w-56 bg-white shadow-xl rounded-lg border overflow-hidden z-50">
            <div className="p-3 border-b bg-gray-50">
              <p className="text-xs text-gray-600 mb-1">Switch Role</p>
              <p className="text-sm font-semibold">{user.name}</p>
            </div>

            <div className="py-2">
              {user.roles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleRoleClick(role)}
                  className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${currentRole === role ? 'bg-blue-50' : ''
                    }`}
                >
                  {getRoleIcon(role)}
                  <span className="flex-1 text-left text-sm">{getRoleLabel(role)}</span>
                  {currentRole === role && (
                    <Badge variant="outline" className="text-xs bg-blue-500 text-white">
                      Active
                    </Badge>
                  )}
                </button>
              ))}
            </div>

            {user.roleVerificationExpiry && (
              <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
                Verification valid until:{' '}
                {new Date(user.roleVerificationExpiry).toLocaleDateString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      {showVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Verify Your Identity</h3>
                <p className="text-sm text-gray-600">
                  Please enter your Hainan Association ID to switch to {getRoleLabel(selectedRole)} role.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Association ID</Label>
                  <Input
                    placeholder="HNHG 1011"
                    value={verificationId}
                    onChange={(e) => setVerificationId(e.target.value)}
                    className={error ? 'border-red-500' : ''}
                  />
                  {error && (
                    <p className="text-xs text-red-600">{error}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Format: HNHG followed by 4 digits (e.g., HNHG 1011)
                  </p>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-700">
                    <strong>Note:</strong> You only need to verify once every 30 days.
                    After verification, you can switch roles seamlessly.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowVerification(false);
                      setVerificationId('');
                      setError('');
                      setSelectedRole('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleVerification}
                    className="flex-1"
                  >
                    Verify & Switch
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
