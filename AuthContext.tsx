import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';

export const SUPER_ADMIN_EMAIL = 'marcuswong0327@gmail.com';

export type UserRole = 'super_admin' | 'sub_admin' | 'sub_editor' | 'public';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  roles?: UserRole[];
  currentRole?: UserRole;
  associationId?: string;
  points: number;
  donorBadge?: 'bronze' | 'gold' | null;
  totalDonations?: number;
  roleVerificationId?: string;
  roleVerificationExpiry?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: string, associationId?: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: string, verificationId?: string) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
  changePassword?: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function authUserToProfile(authUser: { id: string; email?: string }, row: { name?: string; role: string; association_id?: string; points?: number } | null): UserProfile {
  const role = (row?.role as UserRole) || 'public';
  return {
    id: authUser.id,
    email: authUser.email ?? '',
    name: row?.name ?? authUser.email ?? '',
    role,
    roles: [role, 'public'],
    currentRole: role,
    associationId: row?.association_id ?? undefined,
    points: row?.points ?? 0,
    donorBadge: null,
    totalDonations: 0,
  };
}

async function fetchOrCreateProfile(supabaseClient: NonNullable<typeof supabase>, authUserId: string, email: string, name: string): Promise<UserProfile> {
  const { data: row, error: fetchError } = await supabaseClient
    .from('profiles')
    .select('name, role, association_id, points')
    .eq('id', authUserId)
    .maybeSingle();

  if (fetchError) {
    console.error('Fetch profile error:', fetchError);
    throw new Error('Could not load profile');
  }

  if (row) {
    return authUserToProfile({ id: authUserId, email }, row);
  }

  const role = email === SUPER_ADMIN_EMAIL ? 'super_admin' : 'public';
  const { error: insertError } = await supabaseClient.from('profiles').insert({
    id: authUserId,
    email,
    name: name || email,
    role,
    points: 0,
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error('Create profile error:', insertError);
    throw new Error('Could not create profile');
  }

  return authUserToProfile({ id: authUserId, email }, { name: name || email, role, points: 0 });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessionAndProfile = async () => {
    if (!isSupabaseConfigured() || !supabase) {
      const savedUser = localStorage.getItem('myHainanUser');
      if (savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          if (!userData.roles) {
            userData.roles = [userData.role, 'public'];
            userData.currentRole = userData.role;
          }
          setUser(userData);
        } catch (_) {}
      }
      setLoading(false);
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      const profile = await fetchOrCreateProfile(
        supabase,
        session.user.id,
        session.user.email ?? '',
        (session.user.user_metadata?.name as string) ?? ''
      );
      setUser(profile);
    } catch (e) {
      console.error('Auth load error:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionAndProfile();

    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false);
      return;
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchOrCreateProfile(supabase!, session.user.id, session.user.email ?? '', (session.user.user_metadata?.name as string) ?? '')
          .then(setUser)
          .catch(() => setUser(null));
      } else {
        setUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Invalid email or password' : error.message);
      if (!data.user) throw new Error('Sign in failed');
      const profile = await fetchOrCreateProfile(supabase, data.user.id, data.user.email ?? email, (data.user.user_metadata?.name as string) ?? '');
      setUser(profile);
      return;
    }
    const savedUser = localStorage.getItem('myHainanUser');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      if (userData.email === email && userData.password === password) {
        setUser(userData);
        return;
      }
    }
    throw new Error('Invalid email or password');
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: string,
    associationId?: string
  ) => {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Sign up failed');
      const profileRole = email === SUPER_ADMIN_EMAIL ? 'super_admin' : (role as UserRole);
      if (data.session) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          name: name || email,
          role: profileRole,
          association_id: associationId || null,
          points: 0,
          updated_at: new Date().toISOString(),
        });
        if (insertError) console.warn('Profile insert:', insertError);
        const profile = authUserToProfile(
          { id: data.user.id, email },
          { name: name || email, role: profileRole, association_id: associationId, points: 0 }
        );
        setUser(profile);
      } else {
        throw new Error('Sign up successful. Please check your email to confirm your account, then sign in.');
      }
      return;
    }
    const roleArray: UserRole[] = [role as UserRole, 'public'];
    const uniqueRoles = Array.from(new Set(roleArray)) as UserRole[];
    const newUser: UserProfile = {
      id: Date.now().toString(),
      email,
      name,
      role: role as UserRole,
      roles: uniqueRoles,
      currentRole: role as UserRole,
      associationId,
      points: 0,
      donorBadge: null,
      totalDonations: 0,
    };
    setUser(newUser);
    localStorage.setItem('myHainanUser', JSON.stringify({ ...newUser, password }));
  };

  const forgotPassword = async (email: string) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) throw new Error('Please enter your email.');
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw new Error(error.message);
      return;
    }
    throw new Error('Password reset requires Supabase configuration.');
  };

  const signOut = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem('myHainanUser');
  };

  const switchRole = async (role: string, verificationId?: string) => {
    if (!user) throw new Error('User not logged in');
    if (!user.roles?.includes(role as UserRole)) throw new Error('User does not have the role');
    if (verificationId && user.roleVerificationId !== verificationId) throw new Error('Invalid verification ID');
    if (verificationId && user.roleVerificationExpiry && new Date(user.roleVerificationExpiry) < new Date()) throw new Error('Verification ID expired');
    const updatedUser = { ...user, currentRole: role as UserRole };
    setUser(updatedUser);
    if (!isSupabaseConfigured()) {
      localStorage.setItem('myHainanUser', JSON.stringify({ ...JSON.parse(localStorage.getItem('myHainanUser') || '{}'), currentRole: role }));
    }
  };

  const updateUser = (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('User not logged in');
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    if (!isSupabaseConfigured()) {
      localStorage.setItem('myHainanUser', JSON.stringify(updatedUser));
    } else {
      const client = supabase;
      if (client) {
        client.from('profiles').update({
        name: updatedUser.name,
        association_id: updatedUser.associationId ?? null,
        points: updatedUser.points,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id).then(() => {});
      }
    }
  };

  const changePassword = isSupabaseConfigured() && supabase
    ? async (newPassword: string) => {
        const client = supabase!;
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
      }
    : undefined;

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, forgotPassword, signOut, switchRole, updateUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
