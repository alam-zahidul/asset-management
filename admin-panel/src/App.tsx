import React, { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { Settings, Users, Shield, ScrollText, LogOut } from 'lucide-react';
import FieldsPage from './pages/FieldsPage';
import UsersPage from './pages/UsersPage';
import RolesPage from './pages/RolesPage';
import AuditPage from './pages/AuditPage';
import LoginPage from './pages/LoginPage';

const navItems = [
  { path: '/fields', label: 'Field Management', icon: Settings },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/roles', label: 'Roles & Permissions', icon: Shield },
  { path: '/audit', label: 'Audit Logs', icon: ScrollText },
];

function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = localStorage.getItem('accessToken');

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-gray-800 border-r border-gray-700">
        <div className="h-16 flex items-center px-6 border-b border-gray-700">
          <h1 className="text-lg font-bold text-primary-400">Admin Panel</h1>
        </div>
        <nav className="mt-4 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors ${
                  active ? 'bg-primary-900/50 text-primary-300' : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-3 right-3">
          <button
            onClick={() => { localStorage.removeItem('accessToken'); window.location.href = '/login'; }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 rounded-lg"
          >
            <LogOut className="h-4 w-4" /> Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <AdminLayout>
          <Routes>
            <Route path="/fields" element={<FieldsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="*" element={<Navigate to="/fields" replace />} />
          </Routes>
        </AdminLayout>
      } />
    </Routes>
  );
}
