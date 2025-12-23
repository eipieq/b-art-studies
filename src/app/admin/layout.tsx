'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/?error=auth_required');
      } else if (!isAdmin) {
        router.push('/?error=admin_required');
      }
    }
  }, [isAuthenticated, isAdmin, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Verifying access...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Redirecting...
  }

  return <>{children}</>;
}
