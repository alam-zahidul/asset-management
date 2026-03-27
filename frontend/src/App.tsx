import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AssetListPage from './pages/AssetListPage';
import AssetDetailPage from './pages/AssetDetailPage';
import AssetFormPage from './pages/AssetFormPage';
import ImportPage from './pages/ImportPage';
import ExportPage from './pages/ExportPage';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/assets" element={<AssetListPage />} />
                <Route path="/assets/new" element={<AssetFormPage />} />
                <Route path="/assets/:id" element={<AssetDetailPage />} />
                <Route path="/assets/:id/edit" element={<AssetFormPage />} />
                <Route path="/import" element={<ImportPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
