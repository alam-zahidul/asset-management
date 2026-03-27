import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';
import { Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = DOMPurify.sanitize(username, { ALLOWED_TAGS: [] }).trim();
    if (!clean || !password) { toast.error('Credentials required'); return; }
    if (!/^[a-zA-Z0-9._@-]+$/.test(clean)) { toast.error('Invalid username'); return; }

    setLoading(true);
    try {
      // Admin panel uses the backend auth endpoint (same JWT)
      const res = await axios.post('/api/auth/login', { username: clean, password }, {
        baseURL: 'http://localhost:3001',
        withCredentials: true,
      });
      localStorage.setItem('accessToken', res.data.accessToken);

      // Verify admin role
      if (!res.data.user.roles.includes('admin')) {
        localStorage.removeItem('accessToken');
        toast.error('Admin access required');
        return;
      }

      toast.success('Logged in');
      navigate('/fields', { replace: true });
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 border border-gray-700">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary-900/50 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-gray-400 mt-1">Sign in with admin credentials</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="AD username" maxLength={100} required autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="Password" maxLength={256} required autoComplete="current-password"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
