import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  FormControlLabel,
  Switch,
  Alert,
  Divider,
  CircularProgress,
  Autocomplete,
} from '@mui/material';
import {
  Send,
  Person,
  Security,
  Warning,
  Check,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import VoiceInput from '../components/Voice/VoiceInput';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { apiService } from '../services/api';
import { User, MessageFormData, CONFIDENTIALITY_LEVELS } from '../types';

const SendMessagePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sendMessage } = useSocket();
  
  const [formData, setFormData] = useState<MessageFormData>({
    content: '',
    recipientIds: [],
    confidentialityLevel: 1,
    isUrgent: false,
    audioDuration: 0,
    metadata: {},
  });
  
  const [recipients, setRecipients] = useState<User[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recipientsLoading, setRecipientsLoading] = useState(false);

  // Load available recipients
  useEffect(() => {
    loadRecipients();
  }, []);

  const loadRecipients = async () => {
    try {
      setRecipientsLoading(true);
      const recipientData = await apiService.getRecipients();
      setRecipients(recipientData);
    } catch (error) {
      console.error('Failed to load recipients:', error);
      setError('受信者リストの取得に失敗しました。');
    } finally {
      setRecipientsLoading(false);
    }
  };

  const handleVoiceTranscriptChange = (transcript: string) => {
    setFormData(prev => ({ ...prev, content: transcript }));
  };

  const handleAudioCapture = (audioBlob: Blob, duration: number) => {
    setFormData(prev => ({ 
      ...prev, 
      audioDuration: duration,
      metadata: {
        ...prev.metadata,
        hasAudio: true,
        audioSize: audioBlob.size,
      }
    }));
  };

  const handleRecipientChange = (event: any, value: User[]) => {
    setSelectedRecipients(value);
    setFormData(prev => ({
      ...prev,
      recipientIds: value.map(user => user.id),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!formData.content.trim()) {
      setError('メッセージ内容を入力してください。');
      return;
    }

    if (formData.recipientIds.length === 0) {
      setError('受信者を選択してください。');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Send via API
      const message = await apiService.sendMessage({
        ...formData,
        content: formData.content.trim(),
        metadata: {
          ...formData.metadata,
          deviceType: 'web',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        }
      });

      // Send real-time notification via socket
      sendMessage({
        content: formData.content.trim(),
        recipientIds: formData.recipientIds,
        confidentialityLevel: formData.confidentialityLevel,
        isUrgent: formData.isUrgent,
      });

      setSuccess(true);
      
      // Reset form after short delay
      setTimeout(() => {
        setFormData({
          content: '',
          recipientIds: [],
          confidentialityLevel: 1,
          isUrgent: false,
          audioDuration: 0,
          metadata: {},
        });
        setSelectedRecipients([]);
        setSuccess(false);
        
        // Navigate to messages page
        navigate('/messages');
      }, 2000);

    } catch (error: any) {
      console.error('Send message error:', error);
      setError(error.message || 'メッセージの送信に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  const getConfidentialityLevelInfo = (level: number) => {
    return CONFIDENTIALITY_LEVELS.find(l => l.value === level);
  };

  const confidentialityInfo = getConfidentialityLevelInfo(formData.confidentialityLevel);

  return (
    <Layout>
      <Container maxWidth="lg">
        <Box sx={{ py: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            メッセージ送信
          </Typography>

          <Paper sx={{ p: 3, mt: 3 }}>
            <form onSubmit={handleSubmit}>
              {/* Recipients Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                  受信者選択
                </Typography>
                
                <Autocomplete
                  multiple
                  options={recipients}
                  getOptionLabel={(option) => `${option.fullName || option.username} (${option.department || option.role})`}
                  value={selectedRecipients}
                  onChange={handleRecipientChange}
                  loading={recipientsLoading}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="受信者を選択"
                      placeholder="受信者を検索..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {recipientsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => (
                      <Chip
                        label={option.fullName || option.username}
                        {...getTagProps({ index })}
                        color={option.role === 'ADMIN' ? 'secondary' : 'default'}
                        size="small"
                      />
                    ))
                  }
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Message Content */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  メッセージ内容
                </Typography>
                
                {/* Voice Input Component */}
                <VoiceInput
                  onTranscriptChange={handleVoiceTranscriptChange}
                  onAudioCapture={handleAudioCapture}
                  disabled={loading}
                  placeholder="音声入力ボタンを押して話すか、下のテキストフィールドに直接入力してください..."
                />

                {/* Text Input (as fallback or additional editing) */}
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  variant="outlined"
                  label="メッセージ（テキスト入力）"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="メッセージを入力してください..."
                  helperText={`${formData.content.length} 文字`}
                  disabled={loading}
                  sx={{ mt: 2 }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Message Settings */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  <Security sx={{ mr: 1, verticalAlign: 'middle' }} />
                  メッセージ設定
                </Typography>

                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 2 }}>
                  {/* Confidentiality Level */}
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>秘匿レベル</InputLabel>
                    <Select
                      value={formData.confidentialityLevel}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        confidentialityLevel: e.target.value as 1 | 2 | 3 
                      }))}
                      label="秘匿レベル"
                      disabled={loading}
                    >
                      {CONFIDENTIALITY_LEVELS.map((level) => (
                        <MenuItem key={level.value} value={level.value}>
                          <Chip
                            label={level.label}
                            size="small"
                            sx={{ 
                              backgroundColor: level.color,
                              color: 'white',
                              mr: 1 
                            }}
                          />
                          {level.description}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Urgent Flag */}
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={formData.isUrgent}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            isUrgent: e.target.checked 
                          }))}
                          disabled={loading}
                          color="warning"
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Warning sx={{ mr: 1 }} />
                          緊急
                        </Box>
                      }
                    />
                  </Box>
                </Box>

                {/* Confidentiality Level Info */}
                {confidentialityInfo && (
                  <Alert 
                    severity={formData.confidentialityLevel === 1 ? 'info' : 
                             formData.confidentialityLevel === 2 ? 'warning' : 'error'}
                    sx={{ mt: 2 }}
                  >
                    <strong>{confidentialityInfo.label}:</strong> {confidentialityInfo.description}
                  </Alert>
                )}

                {/* Urgent Message Warning */}
                {formData.isUrgent && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <strong>緊急メッセージ:</strong> 受信者に即座に通知されます。
                  </Alert>
                )}
              </Box>

              {/* Error/Success Messages */}
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Check sx={{ mr: 1 }} />
                  メッセージが正常に送信されました。
                </Alert>
              )}

              {/* Submit Button */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate('/messages')}
                  disabled={loading}
                >
                  キャンセル
                </Button>
                
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                  disabled={loading || !formData.content.trim() || formData.recipientIds.length === 0}
                  size="large"
                >
                  {loading ? '送信中...' : '送信'}
                </Button>
              </Box>
            </form>
          </Paper>
        </Box>
      </Container>
    </Layout>
  );
};

export default SendMessagePage;