import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  School,
  Login as LoginIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginCredentials } from '../types';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCredentials(prev => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!credentials.username || !credentials.password) {
      setError('ユーザー名とパスワードを入力してください。');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await login(credentials);
      
      // Navigation will be handled by the useEffect above
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'ログインに失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  // Show loading screen while checking authentication
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
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          認証情報を確認しています...
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Container component="main" maxWidth="sm">
        <Paper
          elevation={6}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 2,
          }}
        >
          {/* Logo and Title */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <School
              sx={{
                fontSize: 40,
                color: 'primary.main',
                mr: 2,
              }}
            />
            <Box>
              <Typography component="h1" variant="h4" color="primary">
                学校情報共有
              </Typography>
              <Typography variant="h6" color="text.secondary">
                システム
              </Typography>
            </Box>
          </Box>

          <Typography variant="h5" component="h2" gutterBottom>
            ログイン
          </Typography>
          
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
            職員間の情報共有を安全・迅速に行うためのシステムです。
            音声入力による効率的なコミュニケーションが可能です。
          </Typography>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="ユーザー名 / メールアドレス"
              name="username"
              autoComplete="username"
              autoFocus
              value={credentials.username}
              onChange={handleChange}
              disabled={loading}
              variant="outlined"
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="パスワード"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={handleChange}
              disabled={loading}
              variant="outlined"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={handleTogglePasswordVisibility}
                      edge="end"
                      disabled={loading}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={loading || !credentials.username || !credentials.password}
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
              size="large"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </Box>

          {/* Demo Information */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1, width: '100%' }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              <strong>デモアカウント:</strong>
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              管理者: admin / password
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              教職員: staff / password
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              一般職員: user / password
            </Typography>
          </Box>

          {/* System Features */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              🎤 音声入力 | 🔒 秘匿性管理 | 📱 モバイル対応 | ⚡ リアルタイム通信
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;