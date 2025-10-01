'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/signup', form);
      const data = res.data;
      setLoading(false);

      if (res.status === 201) {
        router.push('/login');
      } else {
        setError(data.error);
      }
    } catch (error: any) {
      setLoading(false);
      setError(error.response?.data?.error || 'Signup failed');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black text-gray-100 flex items-center justify-center px-4 relative">
      {/* subtle grid + glow, matching landing */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(40,40,40,0.3),transparent_60%)]" />
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/60 backdrop-blur-lg shadow-xl p-6">
        <h1 className="text-3xl font-extrabold text-center tracking-tight mb-2">Create your account</h1>
        <p className="text-center text-gray-400 mb-6">
          Join <span className="text-blue-500">VidWise</span> — upload, learn, <span className="text-blue-500">master</span>.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800/80 border border-gray-700 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="w-full px-4 py-3 rounded-lg bg-gray-800/80 border border-gray-700 text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="email"
            placeholder="Email Address"
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
            {loading ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-gray-400 text-sm text-center mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-blue-500 hover:underline">Login</a>
        </p>
      </div>
    </div>
  );
}
