import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, Typography, Spin, Dropdown } from 'antd';
import {
  DatabaseOutlined, ImportOutlined, UserOutlined, LogoutOutlined,
} from '@ant-design/icons';
import LoginPage from './pages/LoginPage';
import AssetListPage from './pages/AssetListPage';
import ImportLogsPage from './pages/ImportLogsPage';
import { useAuthStore } from './store/authStore';

const { Header, Content, Sider } = Layout;

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppLayout: React.FC = () => {
  const { user, logout, loadUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { key: '/', icon: <DatabaseOutlined />, label: 'Inventory' },
    { key: '/import-logs', icon: <ImportOutlined />, label: 'Import Logs' },
  ];

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', onClick: handleLogout },
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <span className="app-logo">Asset Management</span>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" style={{ color: '#fff' }}>
            <Space>
              <UserOutlined />
              {user?.username}
            </Space>
          </Button>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            style={{ height: '100%' }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            defaultSelectedKeys={['/']}
          />
        </Sider>
        <Content className="app-content">
          <Routes>
            <Route path="/" element={<AssetListPage />} />
            <Route path="/import-logs" element={<ImportLogsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

export default App;
