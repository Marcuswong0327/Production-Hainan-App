import { createContext, useContext, useState, useEffect, ReactNode } from 'react';


interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'sub_admin' | 'sub_editor' | 'public';
  roles?: ('super_admin' | 'sub_admin' | 'sub_editor' | 'public')[]; // Multiple roles for switching purposes
  currentRole?: 'super_admin' | 'sub_admin' | 'sub_editor' | 'public';
  associationId?: string;
  points: number;
  donorBadge?: 'bronze' | 'gold' | null; // havent configured UI yet
  totalDonations?: number;
  roleVerificationId?: string; // HNHG ID for role switching
  roleVerificationExpiry?: string; // 30 days expiry
}


interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: string, associationId?: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: string, verificationId?: string) => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => void;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);


// Frontend-only AuthProvider for UI/Design preview
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);


  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('myHainanUser');
    if (savedUser) {
      const userData = JSON.parse(savedUser);
      // Ensure roles array exists for backward compatibility
      if (!userData.roles) {
        userData.roles = [userData.role, 'public'];
        userData.currentRole = userData.role;
      }
      setUser(userData);
    }
    setLoading(false);
  }, []);


  const signIn = async (email: string, password: string) => {
    // Frontend-only: Check localStorage for existing user
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
    // Frontend-only: Create user immediately
    const roleArray = [role as any, 'public'] as ('super_admin' | 'sub_admin' | 'sub_editor' | 'public')[];
    // Remove duplicates
    const uniqueRoles = Array.from(new Set(roleArray));

    const newUser: UserProfile = {
      id: Date.now().toString(),
      email,
      name,
      role: role as any,
      roles: uniqueRoles,
      currentRole: role as any,
      associationId,
      points: 0,
      donorBadge: null,
      totalDonations: 0,
    };

    setUser(newUser);
    localStorage.setItem('myHainanUser', JSON.stringify(newUser));
  };


  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('myHainanUser');
  };


  const switchRole = async (role: string, verificationId?: string) => {
    if (!user) {
      throw new Error('User not logged in');
    }
    if (!user.roles || !user.roles.includes(role as any)) {
      throw new Error('User does not have the role');
    }
    if (verificationId && user.roleVerificationId !== verificationId) {
      throw new Error('Invalid verification ID');
    }
    if (verificationId && user.roleVerificationExpiry && new Date(user.roleVerificationExpiry) < new Date()) {
      throw new Error('Verification ID expired');
    }
    const updatedUser = {
      ...user,
      currentRole: role as any,
    };
    setUser(updatedUser);
    localStorage.setItem('myHainanUser', JSON.stringify(updatedUser));
  };


  const updateUser = (updates: Partial<UserProfile>) => {
    if (!user) {
      throw new Error('User not logged in');
    }
    const updatedUser = {
      ...user,
      ...updates,
    };
    setUser(updatedUser);
    localStorage.setItem('myHainanUser', JSON.stringify(updatedUser));
  };


  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, switchRole, updateUser }}>
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



