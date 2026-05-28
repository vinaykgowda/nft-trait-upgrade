'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /reforge — Redirects to the correct /reforge/<collection_name> URL
 * based on the first project with reforge packs enabled.
 */
export default function ReforgeIndexPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const redirect = async () => {
      try {
        const res = await fetch('/api/project');
        if (!res.ok) throw new Error('Failed to fetch project');
        const data = await res.json();
        const projectData = data.data || data;
        const projectName: string = projectData.name || '';

        if (projectName) {
          // Convert project name to slug: "Pepe Goddess" -> "pepe_goddess"
          const slug = projectName.toLowerCase().replace(/\s+/g, '_');
          router.replace(`/reforge/${slug}`);
        } else {
          setError('No project configured');
        }
      } catch (err) {
        console.error('Error redirecting:', err);
        setError('Failed to load project information');
      }
    };

    redirect();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
        <div className="text-center">
          <p className="text-red-400 mb-4 text-base">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0f' }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-yellow-600 border-t-transparent mx-auto mb-3" />
        <p className="text-yellow-600/70 font-cinzel text-base tracking-widest uppercase">
          Loading...
        </p>
      </div>
    </div>
  );
}
