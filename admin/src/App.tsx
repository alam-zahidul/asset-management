import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout, Menu, Button, Space, Spin, Dropdown } from 'antd';
import {
  SettingOutlined, UserOutlined, AuditOutlined, LogoutOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import LoginPage from './pages/LoginPage';
import FieldManagementPage from './pages/FieldManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import AuditLogsPage from './pages/AuditLogsPage';
import { useAuthStore } from './store/authStore';

const { Header, Content, Sider } = Layout;

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminLayout: React.FC = () => {
  const { user, logout, loadUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { loadUser(); }, [loadUser]);

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
    { key: '/', icon: <SettingOutlined />, label: 'Field Management' },
    { key: '/users', icon: <UserOutlined />, label: 'User Management' },
    { key: '/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' },
  ];

  const userMenuItems = [
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign Out', onClick: handleLogout },
  ];

  return (
    <Layout className="admin-layout">
      <Header className="admin-header">
        <Space>
          <AppstoreOutlined style={{ color: '#722ed1', fontSize: 20 }} />
          <span className="admin-logo">Admin Panel</span>
        </Space>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Button type="text" style={{ color: '#fff' }}>
            <Space><UserOutlined />{user?.username}</Space>
          </Button>
        </Dropdown>
      </Header>
      <Layout>
        <Sider width={220} theme="light">
          <Menu
            mode="inline"
            style={{ height: '100%', paddingTop: 8 }}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            defaultSelectedKeys={['/']}
          />
        </Sider>
        <Content className="admin-content">
          <Routes>
            <Route path="/" element={<FieldManagementPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
};

const App: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/*" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>} />
  </Routes>
);

export default App;
