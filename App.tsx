import { AuthProvider, useAuth } from './AuthContext';
import { AuthPage } from './components/AuthPage';
import { PublicHomePage } from './components/PublicHomePage';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SubAdminDashboard } from './components/SubAdminDashboard';
import { SubEditorDashboard } from './components/SubEditorDashboard';

// AppContent component - must be inside AuthProvider
function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading MyHainan App...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  // Route based on user role (use currentRole if available, otherwise use role)
  const activeRole = user.currentRole || user.role;
  switch (activeRole) {
    case 'super_admin':
      return <SuperAdminDashboard />;
    case 'sub_admin':
      return <SubAdminDashboard />;
    case 'sub_editor':
      return <SubEditorDashboard />;
    case 'public':
    default:
      return <PublicHomePage />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}