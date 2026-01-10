import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';


export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);


  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');


  // Sign Up State
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpRole, setSignUpRole] = useState('public');
  const [signUpAssociation, setSignUpAssociation] = useState('');


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');


    try {
      await signIn(signInEmail, signInPassword);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };


  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');


    try {
      console.log('Attempting signup with:', { signUpEmail, signUpName, signUpRole, signUpAssociation });
      await signUp(
        signUpEmail,
        signUpPassword,
        signUpName,
        signUpRole,
        signUpRole !== 'public' && signUpRole !== 'super_admin' ? signUpAssociation : undefined
      );
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to sign up. Please check your network connection and try again.');
    } finally {
      setLoading(false);
    }
  };


  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');


    try {
      // Add your forgot password logic here
      // For example, you might call a function from your AuthContext
      // await forgotPassword(resetEmail);
      setResetSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">


      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center border-b bg-white">
          <div className="mx-auto mb-4 w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
            <span className="text-white text-3xl">Hi</span>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome back
          </CardTitle>
          <CardDescription className="text-base">
            海南会馆 Super App
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>


            <TabsContent value="signin" className="mt-4">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full"
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="pt-2">
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </div>
                <div className="text-sm text-gray-500 text-center pt-2">
                  <button
                    type="button"
                    className="text-blue-500 hover:text-blue-700 underline"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            </TabsContent>


            <TabsContent value="signup" className="mt-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Marcus Wong"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-role">Role</Label>
                  <Select value={signUpRole} onValueChange={setSignUpRole}>
                    <SelectTrigger id="signup-role" className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="public">Public User (会员)</SelectItem>
                      <SelectItem value="sub_editor">Sub-Editor (分会编辑)</SelectItem>
                      <SelectItem value="sub_admin">Sub-Admin (分会管理员)</SelectItem>
                      <SelectItem value="super_admin">Super Admin (总会)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {signUpRole !== 'public' && signUpRole !== 'super_admin' && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-association">Association ID</Label>
                    <Input
                      id="signup-association"
                      type="text"
                      placeholder="e.g. selangor_01"
                      value={signUpAssociation}
                      onChange={(e) => setSignUpAssociation(e.target.value)}
                      className="w-full"
                      required
                    />
                  </div>
                )}
                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                <div className="pt-2">
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? 'Creating account...' : 'Sign Up'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>


      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="text-center border-b bg-white">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Reset Password
              </CardTitle>
              <CardDescription className="text-base">
                Enter your email to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="text-center border-b bg-white">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {resetSuccess && <p className="text-sm text-green-600">Password reset email sent!</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Sending...' : 'Reset Password'}
                </Button>
                <div className="text-sm text-gray-500 text-center mt-2">
                  <button
                    type="button"
                    className="text-blue-500 hover:text-blue-700"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}



