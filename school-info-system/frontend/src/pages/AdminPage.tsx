import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  People,
  AdminPanelSettings,
  Statistics,
  Security,
} from '@mui/icons-material';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/api';
import { User, UserStats, USER_ROLES } from '../types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  
  // Users management
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'USER' as 'ADMIN' | 'STAFF' | 'USER',
    department: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'STAFF') {
      loadUsers();
      loadUserStats();
    }
  }, [user]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiService.getUsers();
      setUsers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load users:', error);
      setError('ユーザー一覧の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const stats = await apiService.getUserStats();
      setUserStats(stats);
    } catch (error: any) {
      console.error('Failed to load user stats:', error);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.username || !newUser.email || !newUser.password) {
        setError('必須フィールドを入力してください。');
        return;
      }

      setLoading(true);
      await apiService.createUser(newUser);
      
      // Reload users
      await loadUsers();
      await loadUserStats();
      
      // Reset form
      setNewUser({
        username: '',
        email: '',
        password: '',
        fullName: '',
        role: 'USER',
        department: '',
        phone: '',
      });
      setUserDialogOpen(null);
      setError(null);
    } catch (error: any) {
      console.error('Failed to create user:', error);
      setError(error.message || 'ユーザーの作成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: number, updates: Partial<User>) => {
    try {
      setLoading(true);
      await apiService.updateUser(userId, updates);
      await loadUsers();
      await loadUserStats();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      setError(error.message || 'ユーザーの更新に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!window.confirm('このユーザーを削除してもよろしいですか？')) {
      return;
    }

    try {
      setLoading(true);
      await apiService.deleteUser(userId);
      await loadUsers();
      await loadUserStats();
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      setError(error.message || 'ユーザーの削除に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const getUserRoleInfo = (role: string) => {
    return USER_ROLES.find(r => r.value === role);
  };

  // Only admin and staff can access this page
  if (!user || !['ADMIN', 'STAFF'].includes(user.role)) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Alert severity="error">
            このページにアクセスする権限がありません。
          </Alert>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          管理画面
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab 
              label="ダッシュボード" 
              icon={<Statistics />} 
              iconPosition="start"
            />
            <Tab 
              label="ユーザー管理" 
              icon={<People />} 
              iconPosition="start"
            />
            <Tab 
              label="セキュリティ" 
              icon={<Security />} 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Dashboard Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {userStats && (
              <>
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        総ユーザー数
                      </Typography>
                      <Typography variant="h4" component="h2">
                        {userStats.totalUsers}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        アクティブユーザー
                      </Typography>
                      <Typography variant="h4" component="h2">
                        {userStats.activeUsers}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        管理者
                      </Typography>
                      <Typography variant="h4" component="h2">
                        {userStats.usersByRole.admin}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        最近のログイン
                      </Typography>
                      <Typography variant="h4" component="h2">
                        {userStats.recentLogins}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Department Distribution */}
                {userStats.departmentDistribution.length > 0 && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          部署別ユーザー分布
                        </Typography>
                        <Grid container spacing={2}>
                          {userStats.departmentDistribution.map((dept) => (
                            <Grid item key={dept.department}>
                              <Chip
                                label={`${dept.department}: ${dept.count}人`}
                                variant="outlined"
                              />
                            </Grid>
                          ))}
                        </Grid>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </>
            )}
          </Grid>
        </TabPanel>

        {/* Users Management Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setUserDialogOpen({} as User)}
              disabled={user?.role !== 'ADMIN'}
            >
              新規ユーザー作成
            </Button>
          </Box>

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ユーザー名</TableCell>
                  <TableCell>氏名</TableCell>
                  <TableCell>メール</TableCell>
                  <TableCell>役職</TableCell>
                  <TableCell>部署</TableCell>
                  <TableCell>ステータス</TableCell>
                  <TableCell>最終ログイン</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((userData) => {
                  const roleInfo = getUserRoleInfo(userData.role);
                  
                  return (
                    <TableRow key={userData.id}>
                      <TableCell>{userData.username}</TableCell>
                      <TableCell>{userData.fullName || '-'}</TableCell>
                      <TableCell>{userData.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={roleInfo?.label || userData.role}
                          size="small"
                          color={userData.role === 'ADMIN' ? 'error' : 
                                 userData.role === 'STAFF' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{userData.department || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={userData.isActive ? 'アクティブ' : '無効'}
                          size="small"
                          color={userData.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {userData.lastLogin 
                          ? new Date(userData.lastLogin).toLocaleDateString('ja-JP')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => setUserDialogOpen(userData)}
                          disabled={user?.role !== 'ADMIN'}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteUser(userData.id)}
                          disabled={user?.role !== 'ADMIN' || userData.id === user?.id}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Security Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    セキュリティ設定
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    セキュリティ機能は実装中です。
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        {/* User Dialog */}
        <Dialog
          open={!!userDialogOpen}
          onClose={() => setUserDialogOpen(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {userDialogOpen?.id ? 'ユーザー編集' : '新規ユーザー作成'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="ユーザー名"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="メールアドレス"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="氏名"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </Grid>
              {!userDialogOpen?.id && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="パスワード"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>役職</InputLabel>
                  <Select
                    value={newUser.role}
                    onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as 'ADMIN' | 'STAFF' | 'USER' }))}
                    label="役職"
                  >
                    {USER_ROLES.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="部署"
                  value={newUser.department}
                  onChange={(e) => setNewUser(prev => ({ ...prev, department: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="電話番号"
                  value={newUser.phone}
                  onChange={(e) => setNewUser(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUserDialogOpen(null)}>
              キャンセル
            </Button>
            <Button
              onClick={handleCreateUser}
              variant="contained"
              disabled={loading}
            >
              {userDialogOpen?.id ? '更新' : '作成'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default AdminPage;