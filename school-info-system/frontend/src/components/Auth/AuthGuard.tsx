import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireRole?: string[];
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ 
  children, 
  requireRole 
}) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <CircularProgress size={60} thickness={4} />
        <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>
          認証情報を確認しています...
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements if specified
  if (requireRole && requireRole.length > 0) {
    if (!requireRole.includes(user.role)) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            backgroundColor: 'background.default',
            p: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom color="error">
            アクセス拒否
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center">
            このページにアクセスする権限がありません。
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            必要な権限: {requireRole.join(', ')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            現在の権限: {user.role}
          </Typography>
        </Box>
      );
    }
  }

  // Check if user account is active
  if (!user.isActive) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
          p: 3,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom color="error">
          アカウント無効
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          お使いのアカウントは無効化されています。
          管理者にお問い合わせください。
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
};