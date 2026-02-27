'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AuditLog {
  id: string;
  actorType: string;
  actorId: string;
  action: string;
  payloadJson: any;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export default function AuditPage() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const router = useRouter();

  const [filters, setFilters] = useState({
    actorType: '',
    action: '',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0 });

  useEffect(() => { fetchAuditLogs(); }, [filters, pagination.page]);

  const fetchAuditLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, value]) => value)),
      });
      const response = await fetch(`/api/admin/audit-logs?${params}`);
      if (!response.ok) {
        if (response.status === 401) { router.push('/admin/login'); return; }
        throw new Error('Failed to fetch audit logs');
      }
      const data = await response.json();
      setAuditLogs(data.logs || []);
      setPagination(prev => ({ ...prev, total: data.total || 0 }));
    } catch { setError('Failed to load audit logs'); }
    finally { setLoading(false); }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleString();
  const formatAction = (action: string) => action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const getActionColor = (action: string) => {
    if (action.includes('login') || action.includes('logout')) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (action.includes('created') || action.includes('gift')) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (action.includes('updated') || action.includes('modified')) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (action.includes('deleted') || action.includes('revoked')) return 'bg-red-500/20 text-red-400 border-red-500/30';
    return 'bg-white/[0.06] text-white/50 border-white/[0.08]';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Audit Logs</h1>
        <p className="mt-1 text-sm text-white/40">System activity and administrative actions</p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Actor Type</label>
            <select value={filters.actorType} onChange={(e) => setFilters({ ...filters, actorType: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors">
              <option value="">All Types</option>
              <option value="admin">Admin</option>
              <option value="user">User</option>
              <option value="system">System</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Action</label>
            <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors">
              <option value="">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="project_created">Project Created</option>
              <option value="project_updated">Project Updated</option>
              <option value="trait_created">Trait Created</option>
              <option value="trait_updated">Trait Updated</option>
              <option value="gift_created">Gift Created</option>
              <option value="gift_revoked">Gift Revoked</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Start Date</label>
            <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">End Date</label>
            <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Actor</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">IP</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-white/30 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-white/20">No audit logs found.</td></tr>
              ) : auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-sm text-white/40">{formatDate(log.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="text-sm text-white/60">{log.actorType}</div>
                    <div className="text-xs text-white/20 font-mono">{log.actorId ? `${log.actorId.slice(0, 8)}...` : 'N/A'}</div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded border ${getActionColor(log.action)}`}>
                      {formatAction(log.action)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-white/30 font-mono">{log.ipAddress}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => setSelectedLog(log)} className="text-violet-400 hover:text-violet-300 text-xs">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-white/20">
            {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.08] transition-colors">Prev</button>
            <span className="px-3 py-1.5 text-xs text-white/30">{pagination.page} / {totalPages}</span>
            <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === totalPages} className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/40 text-xs disabled:opacity-30 hover:bg-white/[0.08] transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#14161d] p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Log Details</h3>
              <button onClick={() => setSelectedLog(null)} className="text-white/30 hover:text-white/60">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-white/30">Timestamp</p><p className="text-white/60">{formatDate(selectedLog.createdAt)}</p></div>
                <div><p className="text-xs text-white/30">Action</p><span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded border ${getActionColor(selectedLog.action)}`}>{formatAction(selectedLog.action)}</span></div>
                <div><p className="text-xs text-white/30">Actor</p><p className="text-white/60">{selectedLog.actorType}</p></div>
                <div><p className="text-xs text-white/30">Actor ID</p><p className="text-white/60 font-mono text-xs">{selectedLog.actorId || 'N/A'}</p></div>
                <div><p className="text-xs text-white/30">IP</p><p className="text-white/60 font-mono">{selectedLog.ipAddress}</p></div>
              </div>
              <div><p className="text-xs text-white/30 mb-1">User Agent</p><p className="text-white/40 text-xs break-all">{selectedLog.userAgent}</p></div>
              {selectedLog.payloadJson && (
                <div><p className="text-xs text-white/30 mb-1">Payload</p><pre className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-xs text-white/50 overflow-x-auto">{JSON.stringify(selectedLog.payloadJson, null, 2)}</pre></div>
              )}
            </div>
            <div className="flex justify-end pt-4">
              <button onClick={() => setSelectedLog(null)} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm hover:bg-white/[0.08] transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
