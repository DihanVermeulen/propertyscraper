'use client';

import { useAuth } from '../../contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { AppSidebar } from './Sidebar';
import { SidebarProvider, SidebarTrigger } from '../ui/sidebar';
import TopBar from './TopBar';
import LoadingSpinner from '../ui/LoadingSpinner';
import ApiDebugger from '../debug/ApiDebugger';

interface ProtectedLayoutProps {
  children: React.ReactNode;
}

const ProtectedLayout: React.FC<ProtectedLayoutProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();

  // Don't apply protection to auth routes
  const isAuthRoute = pathname?.startsWith('/login') || pathname?.startsWith('/(auth)');

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return <ApiDebugger />;

  // If not authenticated and not on auth route, the AuthContext will redirect to login
  // If on auth route, render children directly without sidebar
  if (isAuthRoute || !isAuthenticated) {
    return <>{children}</>;
  }

  // Render protected layout with sidebar
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex flex-1 flex-col transition-all duration-300 ease-in-out">
        <div className="flex items-center gap-2 p-4 border-b">
          <SidebarTrigger />
          <TopBar />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
};

export default ProtectedLayout;
