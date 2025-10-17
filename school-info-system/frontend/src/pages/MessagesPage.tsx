import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  Pagination,
} from '@mui/material';
import {
  Message as MessageIcon,
  MarkEmailRead,
  Delete,
  Reply,
  FilterList,
  Search,
  Refresh,
  Close,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useMessages } from '../contexts/MessageContext';
import { useAuth } from '../contexts/AuthContext';
import { Message, CONFIDENTIALITY_LEVELS } from '../types';

const MessagesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { messages, stats, loading, error, refreshMessages, markAsRead, deleteMessage } = useMessages();
  
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<Message | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    confidentialityLevel: '',
    isUrgent: '',
    isRead: '',
  });
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const messagesPerPage = 20;

  useEffect(() => {
    if (!loading && messages.length === 0) {
      refreshMessages();
    }
  }, []);

  const filteredMessages = messages.filter(message => {
    if (filters.search && !message.content.toLowerCase().includes(filters.search.toLowerCase()) &&
        !message.sender.fullName?.toLowerCase().includes(filters.search.toLowerCase()) &&
        !message.sender.username.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    
    if (filters.confidentialityLevel && message.confidentialityLevel !== parseInt(filters.confidentialityLevel)) {
      return false;
    }
    
    if (filters.isUrgent !== '' && message.isUrgent !== (filters.isUrgent === 'true')) {
      return false;
    }
    
    if (filters.isRead !== '' && message.isRead !== (filters.isRead === 'true')) {
      return false;
    }
    
    return true;
  });

  const paginatedMessages = filteredMessages.slice(
    (page - 1) * messagesPerPage,
    page * messagesPerPage
  );

  const handleMessageClick = async (message: Message) => {
    setSelectedMessage(message);
    
    // Mark as read if not already read
    if (!message.isRead) {
      try {
        await markAsRead(message.id);
      } catch (error) {
        console.error('Failed to mark message as read:', error);
      }
    }
  };

  const handleMarkAsRead = async (message: Message) => {
    try {
      await markAsRead(message.id);
    } catch (error: any) {
      alert('既読マークに失敗しました: ' + error.message);
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    try {
      await deleteMessage(message.id);
      setDeleteDialogOpen(null);
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
      }
    } catch (error: any) {
      alert('メッセージの削除に失敗しました: ' + error.message);
    }
  };

  const handleReply = (message: Message) => {
    // Navigate to send page with reply context
    navigate('/send', { 
      state: { 
        replyTo: message,
        recipientIds: [message.sender.id],
      }
    });
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP');
  };

  const getConfidentialityInfo = (level: number) => {
    return CONFIDENTIALITY_LEVELS.find(l => l.value === level);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      confidentialityLevel: '',
      isUrgent: '',
      isRead: '',
    });
    setPage(1);
  };

  return (
    <Layout>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            メッセージ
          </Typography>
          
          {stats && (
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <Chip
                label={`未読: ${stats.unreadCount}`}
                color={stats.unreadCount > 0 ? 'error' : 'default'}
              />
              <Chip
                label={`緊急: ${stats.urgentCount}`}
                color={stats.urgentCount > 0 ? 'warning' : 'default'}
              />
              <Chip
                label={`機密: ${stats.confidentialCount}`}
                color="info"
              />
            </Box>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Filter Panel */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Button
                    startIcon={<FilterList />}
                    onClick={() => setShowFilters(!showFilters)}
                    variant={showFilters ? 'contained' : 'outlined'}
                  >
                    フィルター
                  </Button>
                  
                  <Button
                    startIcon={<Refresh />}
                    onClick={refreshMessages}
                    disabled={loading}
                  >
                    更新
                  </Button>
                  
                  {Object.values(filters).some(v => v !== '') && (
                    <Button
                      startIcon={<Close />}
                      onClick={clearFilters}
                      size="small"
                    >
                      クリア
                    </Button>
                  )}
                </Box>

                {showFilters && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <TextField
                        fullWidth
                        label="検索"
                        value={filters.search}
                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        placeholder="メッセージ内容や送信者名"
                        size="small"
                        InputProps={{
                          startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>秘匿レベル</InputLabel>
                        <Select
                          value={filters.confidentialityLevel}
                          onChange={(e) => setFilters(prev => ({ ...prev, confidentialityLevel: e.target.value }))}
                          label="秘匿レベル"
                        >
                          <MenuItem value="">すべて</MenuItem>
                          {CONFIDENTIALITY_LEVELS.map((level) => (
                            <MenuItem key={level.value} value={level.value}>
                              {level.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>緊急</InputLabel>
                        <Select
                          value={filters.isUrgent}
                          onChange={(e) => setFilters(prev => ({ ...prev, isUrgent: e.target.value }))}
                          label="緊急"
                        >
                          <MenuItem value="">すべて</MenuItem>
                          <MenuItem value="true">緊急のみ</MenuItem>
                          <MenuItem value="false">通常のみ</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={2}>
                      <FormControl fullWidth size="small">
                        <InputLabel>既読状態</InputLabel>
                        <Select
                          value={filters.isRead}
                          onChange={(e) => setFilters(prev => ({ ...prev, isRead: e.target.value }))}
                          label="既読状態"
                        >
                          <MenuItem value="">すべて</MenuItem>
                          <MenuItem value="false">未読のみ</MenuItem>
                          <MenuItem value="true">既読のみ</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Messages List */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ height: '70vh', overflow: 'auto' }}>
              {paginatedMessages.length > 0 ? (
                <>
                  <List>
                    {paginatedMessages.map((message) => {
                      const confidentialityInfo = getConfidentialityInfo(message.confidentialityLevel);
                      
                      return (
                        <ListItem
                          key={message.id}
                          button
                          onClick={() => handleMessageClick(message)}
                          selected={selectedMessage?.id === message.id}
                          sx={{
                            bgcolor: message.isRead ? 'inherit' : 'action.hover',
                            borderLeft: message.isUrgent ? '4px solid #f44336' : 'none',
                          }}
                        >
                          <ListItemIcon>
                            <MessageIcon color={message.isRead ? 'disabled' : 'primary'} />
                          </ListItemIcon>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                  <Chip label="緊急" size="small" color="error" />
                                )}
                                
                                {confidentialityInfo && (
                                  <Chip
                                    label={confidentialityInfo.label}
                                    size="small"
                                    sx={{
                                      bgcolor: confidentialityInfo.color,
                                      color: 'white',
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
                                  {formatDate(message.createdAt)}
                                </Typography>
                              </Box>
                            }
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                  
                  {/* Pagination */}
                  {filteredMessages.length > messagesPerPage && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                      <Pagination
                        count={Math.ceil(filteredMessages.length / messagesPerPage)}
                        page={page}
                        onChange={(_, newPage) => setPage(newPage)}
                      />
                    </Box>
                  )}
                </>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    p: 3,
                  }}
                >
                  <MessageIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    メッセージがありません
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Message Detail */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '70vh', overflow: 'auto' }}>
              {selectedMessage ? (
                <Box>
                  {/* Message Header */}
                  <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6">
                          {selectedMessage.sender.fullName || selectedMessage.sender.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selectedMessage.sender.department} | {formatDate(selectedMessage.createdAt)}
                        </Typography>
                      </Box>
                      
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {!selectedMessage.isRead && (
                          <Tooltip title="既読にする">
                            <IconButton
                              size="small"
                              onClick={() => handleMarkAsRead(selectedMessage)}
                            >
                              <MarkEmailRead />
                            </IconButton>
                          </Tooltip>
                        )}
                        
                        <Tooltip title="返信">
                          <IconButton
                            size="small"
                            onClick={() => handleReply(selectedMessage)}
                          >
                            <Reply />
                          </IconButton>
                        </Tooltip>
                        
                        {(selectedMessage.sender.id === user?.id || user?.role === 'ADMIN') && (
                          <Tooltip title="削除">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setDeleteDialogOpen(selectedMessage)}
                            >
                              <Delete />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>

                    {/* Message Labels */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      {selectedMessage.isUrgent && (
                        <Chip label="緊急" size="small" color="error" />
                      )}
                      
                      {(() => {
                        const confidentialityInfo = getConfidentialityInfo(selectedMessage.confidentialityLevel);
                        return confidentialityInfo && (
                          <Chip
                            label={confidentialityInfo.label}
                            size="small"
                            sx={{
                              bgcolor: confidentialityInfo.color,
                              color: 'white',
                            }}
                          />
                        );
                      })()}
                      
                      {selectedMessage.audioDuration && (
                        <Chip
                          label={`音声: ${Math.round(selectedMessage.audioDuration)}秒`}
                          size="small"
                          color="info"
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Message Content */}
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {selectedMessage.content}
                  </Typography>

                  {/* Recipients */}
                  {selectedMessage.recipients && selectedMessage.recipients.length > 0 && (
                    <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        宛先:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedMessage.recipients.map((recipient) => (
                          <Chip
                            key={recipient.id}
                            label={recipient.fullName || recipient.username}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                  }}
                >
                  <MessageIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary">
                    メッセージを選択してください
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(null)}
        >
          <DialogTitle>メッセージ削除の確認</DialogTitle>
          <DialogContent>
            <Typography>
              このメッセージを削除してもよろしいですか？この操作は取り消すことができません。
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => deleteDialogOpen && handleDeleteMessage(deleteDialogOpen)}
              color="error"
              variant="contained"
            >
              削除
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Layout>
  );
};

export default MessagesPage;