'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
      .catch(() => {})
      .finally(() => router.replace('/admin/login'));
  }, [router]);

  return null;
}
