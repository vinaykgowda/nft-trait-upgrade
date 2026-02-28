'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';

const PUBLIC_PATHS = ['/admin/login', '/admin/logout'];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  const isPublicPage = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (isPublicPage) {
      setAuthChecked(true);
      setIsAuthed(true);
      return;
    }

    // Check admin session via an API call (httpOnly cookie is sent automatically)
    fetch('/api/admin/session-check')
      .then(res => {
        if (res.ok) {
          setIsAuthed(true);
        } else {
          router.replace('/admin/login');
        }
      })
      .catch(() => {
        router.replace('/admin/login');
      })
      .finally(() => setAuthChecked(true));
  }, [pathname, isPublicPage, router]);

  if (isPublicPage) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-white/50">Loading...</div>
      </div>
    );
  }

  if (!isAuthed) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex">
      <AdminNavigation />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
