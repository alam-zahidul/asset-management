import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { sanitize } from '../utils/sanitizer';

const { Title } = Typography;

const LoginPage: React.FC = () => {
  const [error, setError] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setError('');
    try {
      const sanitizedUsername = sanitize(values.username);
      await login(sanitizedUsername, values.password);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'Authentication failed');
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card" bordered={false}>
        <Title level={3} className="login-title">
          Asset Management
        </Title>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form onFinish={handleSubmit} size="large" autoComplete="off">
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Please enter your username' },
              { max: 100, message: 'Username too long' },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Username (AD account)" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={isLoading} block>
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
