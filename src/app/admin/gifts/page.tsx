'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminNavigation from '@/components/admin/AdminNavigation';

interface GiftBalance {
  id: string;
  walletAddress: string;
  traitId: string;
  traitName: string;
  qtyAvailable: number;
  createdAt: string;
}

interface Trait {
  id: string;
  name: string;
  slotName: string;
  rarityTierName: string;
  active: boolean;
}

export default function GiftsPage() {
  const [gifts, setGifts] = useState<GiftBalance[]>([]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const router = useRouter();

  const [formData, setFormData] = useState({
    walletAddress: '',
    traitId: '',
    quantity: 1,
  });

  const [filters, setFilters] = useState({
    walletAddress: '',
    traitId: '',
  });

  useEffect(() => {
    fetchGifts();
    fetchTraits();
  }, []);

  useEffect(() => {
    fetchGifts();
  }, [filters]);

  const fetchGifts = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await fetch(`/api/admin/gifts?${params}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }
        throw new Error('Failed to fetch gifts');
      }
      const data = await response.json();
      setGifts(data.gifts || []);
    } catch (err) {
      setError('Failed to load gifts');
    } finally {
      setLoading(false);
    }
  };

  const fetchTraits = async () => {
    try {
      const response = await fetch('/api/admin/traits?active=true');
      if (!response.ok) {
        throw new Error('Failed to fetch traits');
      }
      const data = await response.json();
      setTraits(data.traits || []);
    } catch (err) {
      console.error('Failed to load traits:', err);
    }
  };

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!mfaRequired) {
      // First step: initiate gift process (will require MFA)
      setMfaRequired(true);
      return;
    }

    try {
      const response = await fetch('/api/admin/gifts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          mfaToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create gift');
      }

      await fetchGifts();
      resetGiftForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gift');
    }
  };

  const handleRevokeGift = async (giftId: string) => {
    if (!confirm('Are you sure you want to revoke this gift? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/gifts/${giftId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke gift');
      }

      await fetchGifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke gift');
    }
  };

  const resetGiftForm = () => {
    setFormData({
      walletAddress: '',
      traitId: '',
      quantity: 1,
    });
    setMfaToken('');
    setMfaRequired(false);
    setShowGiftForm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400">
        <AdminNavigation />
        <div className="p-6">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-400">
      <AdminNavigation />
      <div className="p-6">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-green-400">Gift Management</h1>
            <p className="mt-2 text-green-300">
              Manage trait gifts and balances for community rewards
            </p>
          </div>
        <button
          onClick={() => setShowGiftForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create Gift
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Address
            </label>
            <input
              type="text"
              value={filters.walletAddress}
              onChange={(e) => setFilters({ ...filters, walletAddress: e.target.value })}
              placeholder="Filter by wallet address"
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trait
            </label>
            <select
              value={filters.traitId}
              onChange={(e) => setFilters({ ...filters, traitId: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Traits</option>
              {traits.map((trait) => (
                <option key={trait.id} value={trait.id}>
                  {trait.name} ({trait.slotName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Gifts Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Wallet Address
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trait
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity Available
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {gifts.map((gift) => (
              <tr key={gift.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-mono">
                    {gift.walletAddress.slice(0, 8)}...{gift.walletAddress.slice(-4)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {gift.traitName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {gift.qtyAvailable}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(gift.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleRevokeGift(gift.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {gifts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No gifts found. Create your first gift to get started.</p>
          </div>
        )}
      </div>

      {/* Create Gift Form Modal */}
      {showGiftForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {mfaRequired ? 'MFA Verification Required' : 'Create Gift'}
              </h3>
              
              {!mfaRequired ? (
                <form onSubmit={handleGiftSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Wallet Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.walletAddress}
                      onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                      placeholder="Recipient wallet address"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Trait *
                    </label>
                    <select
                      required
                      value={formData.traitId}
                      onChange={(e) => setFormData({ ...formData, traitId: e.target.value })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select Trait</option>
                      {traits.map((trait) => (
                        <option key={trait.id} value={trait.id}>
                          {trait.name} ({trait.slotName} - {trait.rarityTierName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          This action requires MFA verification and will be logged in the audit trail.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={resetGiftForm}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Continue to MFA
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleGiftSubmit} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                    <p className="text-sm text-blue-700">
                      Creating gift for <strong>{formData.quantity}</strong> x{' '}
                      <strong>{traits.find(t => t.id === formData.traitId)?.name}</strong>{' '}
                      to wallet <strong>{formData.walletAddress.slice(0, 8)}...</strong>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      MFA Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]{6}"
                      value={mfaToken}
                      onChange={(e) => setMfaToken(e.target.value)}
                      placeholder="Enter 6-digit MFA code"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-center text-lg tracking-widest"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setMfaRequired(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Create Gift
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}