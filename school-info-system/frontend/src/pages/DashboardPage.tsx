import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Message,
  Send,
  People,
  Notifications,
  TrendingUp,
  Warning,
  CheckCircle,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { apiService } from '../services/api';
import { MessageStats, Message as MessageType, CONFIDENTIALITY_LEVELS } from '../types';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, onlineUsers } = useSocket();
  
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [recentMessages, setRecentMessages] = useState<MessageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, messagesData] = await Promise.all([
        apiService.getMessageStats(),
        apiService.getMessages({ limit: 5 }),
      ]);

      setStats(statsData);
      setRecentMessages(messagesData.data || []);
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError('ダッシュボードデータの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const getConfidentialityInfo = (level: number) => {
    return CONFIDENTIALITY_LEVELS.find(l => l.value === level);
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    return `${diffDays}日前`;
  };

  if (loading) {
    return (
      <Layout>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
            <CircularProgress size={60} />
          </Box>
        </Container>
      </Layout>
    );
  }

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            ダッシュボード
          </Typography>
          <Typography variant="body1" color="text.secondary">
            おかえりなさい、{user?.fullName || user?.username}さん
          </Typography>
        </Box>

        {/* Connection Status Alert */}
        <Alert
          severity={isConnected ? 'success' : 'warning'}
          sx={{ mb: 3 }}
          icon={isConnected ? <CheckCircle /> : <Warning />}
        >
          {isConnected 
            ? 'リアルタイム通信に接続されています。新しいメッセージは即座に通知されます。'
            : 'リアルタイム通信が切断されています。ページを更新してください。'
          }
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Statistics Cards */}
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.unreadCount || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      未読メッセージ
                    </Typography>
                  </Box>
                  <Message sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.totalReceived || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      受信メッセージ
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" component="div">
                      {stats?.urgentCount || 0}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      緊急メッセージ
                    </Typography>
                  </Box>
                  <Notifications sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h4" component="div">
                      {onlineUsers.length}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                      オンラインユーザー
                    </Typography>
                  </Box>
                  <People sx={{ fontSize: 40, opacity: 0.8 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                クイックアクション
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  startIcon={<Send />}
                  onClick={() => navigate('/send')}
                  fullWidth
                  size="large"
                >
                  新しいメッセージを送信
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Message />}
                  onClick={() => navigate('/messages')}
                  fullWidth
                >
                  メッセージ一覧を見る
                </Button>

                {['ADMIN', 'STAFF'].includes(user?.role || '') && (
                  <Button
                    variant="outlined"
                    startIcon={<People />}
                    onClick={() => navigate('/admin')}
                    fullWidth
                  >
                    管理画面を開く
                  </Button>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Recent Messages */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                最近のメッセージ
              </Typography>
              
              {recentMessages.length > 0 ? (
                <List>
                  {recentMessages.map((message, index) => {
                    const confidentialityInfo = getConfidentialityInfo(message.confidentialityLevel);
                    
                    return (
                      <ListItem
                        key={message.id}
                        divider={index < recentMessages.length - 1}
                        sx={{ px: 0 }}
                      >
                        <ListItemIcon>
                          <Message color={message.isRead ? 'disabled' : 'primary'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography
                                variant="subtitle2"
                                sx={{ 
                                  fontWeight: message.isRead ? 'normal' : 'bold',
                                  flexGrow: 1,
                                }}
                              >
                                {message.sender.fullName || message.sender.username}
                              </Typography>
                              
                              {message.isUrgent && (
                                <Chip
                                  label="緊急"
                                  size="small"
                                  color="error"
                                  sx={{ fontSize: '0.75rem' }}
                                />
                              )}
                              
                              {confidentialityInfo && (
                                <Chip
                                  label={confidentialityInfo.label}
                                  size="small"
                                  sx={{
                                    backgroundColor: confidentialityInfo.color,
                                    color: 'white',
                                    fontSize: '0.75rem',
                                  }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  mb: 0.5,
                                }}
                              >
                                {message.content}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatTimeAgo(message.createdAt)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Box
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  py={4}
                >
                  <Message sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    メッセージはありません
                  </Typography>
                </Box>
              )}
              
              {recentMessages.length > 0 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Button
                    variant="text"
                    onClick={() => navigate('/messages')}
                  >
                    すべてのメッセージを見る
                  </Button>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
};

export default DashboardPage;