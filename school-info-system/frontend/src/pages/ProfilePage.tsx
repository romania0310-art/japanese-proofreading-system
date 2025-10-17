import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Avatar,
  Divider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Lock,
  Person,
} from '@mui/icons-material';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { User, USER_ROLES } from '../types';

const ProfilePage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<Partial<User>>({});
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) {
    return (
      <Layout>
        <Container maxWidth="md" sx={{ py: 3 }}>
          <Alert severity="error">
            ユーザー情報が見つかりません。
          </Alert>
        </Container>
      </Layout>
    );
  }

  const handleEditStart = () => {
    setEditing(true);
    setEditedUser({
      fullName: user.fullName,
      email: user.email,
      department: user.department,
      phone: user.phone,
    });
    setError(null);
    setSuccess(null);
  };

  const handleEditCancel = () => {
    setEditing(false);
    setEditedUser({});
    setError(null);
  };

  const handleEditSave = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await updateUser(editedUser);
      setEditing(false);
      setEditedUser({});
      setSuccess('プロフィールが更新されました。');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setError(error.message || 'プロフィールの更新に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('新しいパスワードが一致しません。');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください。');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      await apiService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      
      setPasswordDialogOpen(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSuccess('パスワードが変更されました。再ログインが必要です。');
      
      // Auto logout after password change
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (error: any) {
      console.error('Failed to change password:', error);
      setError(error.message || 'パスワードの変更に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const getUserRoleInfo = (role: string) => {
    return USER_ROLES.find(r => r.value === role);
  };

  const roleInfo = getUserRoleInfo(user.role);

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          プロフィール
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Paper sx={{ p: 4 }}>
          {/* Profile Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                mr: 3,
                bgcolor: 'primary.main',
                fontSize: '2rem',
              }}
            >
              {user.fullName?.[0] || user.username[0]}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5" gutterBottom>
                {user.fullName || user.username}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  icon={<Person />}
                  label={roleInfo?.label || user.role}
                  color={user.role === 'ADMIN' ? 'error' : 
                         user.role === 'STAFF' ? 'warning' : 'default'}
                  size="small"
                />
                {user.department && (
                  <Chip
                    label={user.department}
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>
            </Box>
            {!editing && (
              <Button
                variant="outlined"
                startIcon={<Edit />}
                onClick={handleEditStart}
              >
                編集
              </Button>
            )}
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Profile Information */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="ユーザー名"
                value={user.username}
                disabled
                helperText="ユーザー名は変更できません"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="メールアドレス"
                value={editing ? (editedUser.email || '') : (user.email || '')}
                onChange={(e) => editing && setEditedUser(prev => ({ ...prev, email: e.target.value }))}
                disabled={!editing}
                type="email"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="氏名"
                value={editing ? (editedUser.fullName || '') : (user.fullName || '')}
                onChange={(e) => editing && setEditedUser(prev => ({ ...prev, fullName: e.target.value }))}
                disabled={!editing}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="部署"
                value={editing ? (editedUser.department || '') : (user.department || '')}
                onChange={(e) => editing && setEditedUser(prev => ({ ...prev, department: e.target.value }))}
                disabled={!editing}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="電話番号"
                value={editing ? (editedUser.phone || '') : (user.phone || '')}
                onChange={(e) => editing && setEditedUser(prev => ({ ...prev, phone: e.target.value }))}
                disabled={!editing}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="役職"
                value={roleInfo?.label || user.role}
                disabled
                helperText="役職は管理者のみが変更できます"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="アカウント作成日"
                value={new Date(user.createdAt).toLocaleDateString('ja-JP')}
                disabled
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="最終ログイン"
                value={user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('ja-JP') : '未記録'}
                disabled
              />
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            {editing ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={handleEditCancel}
                  disabled={loading}
                >
                  キャンセル
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleEditSave}
                  disabled={loading}
                >
                  保存
                </Button>
              </>
            ) : (
              <Button
                variant="outlined"
                startIcon={<Lock />}
                onClick={() => setPasswordDialogOpen(true)}
              >
                パスワード変更
              </Button>
            )}
          </Box>
        </Paper>

        {/* Password Change Dialog */}
        <Dialog
          open={passwordDialogOpen}
          onClose={() => setPasswordDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>パスワード変更</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2 }}>
              <TextField
                fullWidth
                type="password"
                label="現在のパスワード"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                type="password"
                label="新しいパスワード"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                margin="normal"
                required
                helperText="8文字以上で入力してください"
              />
              <TextField
                fullWidth
                type="password"
                label="新しいパスワード（確認）"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                margin="normal"
                required
                error={passwordData.confirmPassword !== '' && passwordData.newPassword !== passwordData.confirmPassword}
                helperText={passwordData.confirmPassword !== '' && passwordData.newPassword !== passwordData.confirmPassword 
                  ? 'パスワードが一致しません' : ''}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPasswordDialogOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={handlePasswordChange}
              variant="contained"
              disabled={loading || 
                       !passwordData.currentPassword || 
                       !passwordData.newPassword || 
                       !passwordData.confirmPassword ||
                       passwordData.newPassword !== passwordData.confirmPassword}
            >
              変更
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default ProfilePage;