'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/login', form);
      const data = res.data;
      setLoading(false);

      if (res.status === 200) {
        router.push('/dashboard'); // Redirect after successful login
      } else {
        setError(data.error);
      }
    } catch (error: any) {
      setLoading(false);
      setError(error.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex items-center justify-center px-4 relative">
      {/* subtle grid + glow, matching landing */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(40,40,40,0.3),transparent_60%)]" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/60 backdrop-blur-lg shadow-xl p-6">
        <h1 className="text-3xl font-extrabold text-center tracking-tight mb-2">Login</h1>
        <p className="text-center text-gray-400 mb-6">Welcome back to <span className="text-blue-500">VidWise</span></p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800/80 border border-gray-700 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800/80 border border-gray-700 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-6">
          New here?{' '}
          <a href="/signup" className="text-blue-500 hover:underline">Create an account</a>
        </p>
      </div>
    </div>
  );
}
