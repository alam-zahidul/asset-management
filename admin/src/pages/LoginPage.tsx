import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import DOMPurify from 'dompurify';

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setError('');
    try {
      const sanitizedUsername = DOMPurify.sanitize(values.username.trim(), { ALLOWED_TAGS: [] });
      await login(sanitizedUsername, values.password);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e.response?.data?.message || e.message || 'Authentication failed');
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" bordered={false}>
        <Title level={3} className="login-title">Admin Panel</Title>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form onFinish={handleSubmit} size="large" autoComplete="off">
          <Form.Item name="username" rules={[{ required: true, message: 'Username required' }, { max: 100 }]}>
            <Input prefix={<UserOutlined />} placeholder="Admin username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Password required' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} block>Admin Sign In</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
