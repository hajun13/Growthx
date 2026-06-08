'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { PermissionsProvider } from '@/hooks/usePermissions';
import { ToastProvider } from '@/components/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <PermissionsProvider>{children}</PermissionsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
