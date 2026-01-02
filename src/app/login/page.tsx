'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    mfaToken: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresMFA, setRequiresMFA] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!requiresMFA) {
        // Initial login
        const response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: formData.username,
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Login failed');
          return;
        }

        if (data.requiresMFA) {
          setRequiresMFA(true);
          setError('');
        } else {
          // Login successful, redirect to dashboard
          router.push('/admin');
        }
      } else {
        // MFA verification
        const response = await fetch('/api/admin/mfa/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: formData.mfaToken,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'MFA verification failed');
          return;
        }

        // MFA successful, redirect to dashboard
        router.push('/admin');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {requiresMFA ? 'Enter MFA Code' : 'Admin Login'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {requiresMFA 
              ? 'Enter the 6-digit code from your authenticator app'
              : 'Sign in to your admin account'
            }
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {!requiresMFA ? (
              <>
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                    Username
                  </label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your username"
                    value={formData.username}
                    onChange={handleInputChange}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="mfaToken" className="block text-sm font-medium text-gray-700">
                  MFA Code
                </label>
                <input
                  id="mfaToken"
                  name="mfaToken"
                  type="text"
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm text-center text-lg tracking-widest"
                  placeholder="000000"
                  value={formData.mfaToken}
                  onChange={handleInputChange}
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Please wait...' : (requiresMFA ? 'Verify MFA' : 'Sign in')}
            </button>
          </div>

          {requiresMFA && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setRequiresMFA(false);
                  setFormData({ ...formData, mfaToken: '' });
                  setError('');
                }}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}