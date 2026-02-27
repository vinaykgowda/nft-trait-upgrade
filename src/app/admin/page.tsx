'use client';

import Link from 'next/link';

const quickLinks = [
  {
    name: 'Projects',
    description: 'Manage project settings and collections',
    href: '/admin/projects',
    color: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconColor: 'text-blue-400',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Token Manager',
    description: 'Add and configure SPL payment tokens',
    href: '/admin/token-manager',
    color: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconColor: 'text-amber-400',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Traits Manager',
    description: 'Upload and manage trait catalog',
    href: '/admin/traits-manager',
    color: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconColor: 'text-emerald-400',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    name: 'Analytics',
    description: 'View performance metrics and data',
    href: '/admin/analytics',
    color: 'from-violet-500/20 to-violet-600/5',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    iconColor: 'text-violet-400',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

export default function AdminDashboard() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-white/40">
          NFT Trait Marketplace administration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.name} href={link.href} className="group block">
            <div className={`relative overflow-hidden rounded-xl border ${link.border} bg-gradient-to-br ${link.color} p-5 transition-all duration-200 hover:shadow-lg hover:shadow-black/20`}>
              <div className="flex items-start gap-4">
                <div className={`${link.iconColor} mt-0.5`}>
                  {link.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white group-hover:text-white/90">
                    {link.name}
                  </h3>
                  <p className="mt-1 text-xs text-white/40">
                    {link.description}
                  </p>
                </div>
                <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
