'use client';

import { AuthProvider } from '@/hooks/useAuth';
import { PermissionsProvider } from '@/hooks/usePermissions';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>
        <PermissionsProvider>{children}</PermissionsProvider>
      </AuthProvider>
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
