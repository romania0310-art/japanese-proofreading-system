import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Stop,
  VolumeUp,
  Settings,
  Delete,
  PlayArrow,
  Pause,
} from '@mui/icons-material';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { VoiceRecognitionResult } from '../../types';

interface VoiceInputProps {
  onTranscriptChange: (transcript: string) => void;
  onAudioCapture?: (audioBlob: Blob, duration: number) => void;
  disabled?: boolean;
  placeholder?: string;
  maxDuration?: number; // seconds
  className?: string;
}

interface AudioRecorderState {
  isRecording: boolean;
  mediaRecorder: MediaRecorder | null;
  audioBlob: Blob | null;
  duration: number;
  audioUrl: string | null;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscriptChange,
  onAudioCapture,
  disabled = false,
  placeholder = '音声入力ボタンを押して話してください...',
  maxDuration = 300, // 5 minutes default
  className,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('ja-JP');
  const [audioRecorder, setAudioRecorder] = useState<AudioRecorderState>({
    isRecording: false,
    mediaRecorder: null,
    audioBlob: null,
    duration: 0,
    audioUrl: null,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingTimer, setRecordingTimer] = useState<NodeJS.Timeout | null>(null);

  const {
    isSupported,
    isListening,
    state,
    transcript,
    interimTranscript,
    confidence,
    error,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition({
    language,
    continuous: true,
    interimResults: true,
    onResult: handleSpeechResult,
    onError: handleSpeechError,
    onEnd: handleSpeechEnd,
  });

  function handleSpeechResult(result: VoiceRecognitionResult) {
    if (result.isFinal) {
      console.log('Final result:', result.text, 'Confidence:', result.confidence);
    }
  }

  function handleSpeechError(error: any) {
    console.error('Speech recognition error:', error);
  }

  function handleSpeechEnd() {
    console.log('Speech recognition ended');
  }

  // Update transcript when it changes
  useEffect(() => {
    const fullTranscript = transcript + interimTranscript;
    onTranscriptChange(fullTranscript);
  }, [transcript, interimTranscript, onTranscriptChange]);

  // Recording timer
  useEffect(() => {
    if (audioRecorder.isRecording) {
      const timer = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            return prev;
          }
          return newTime;
        });
      }, 1000);
      setRecordingTimer(timer);
    } else {
      if (recordingTimer) {
        clearInterval(recordingTimer);
        setRecordingTimer(null);
      }
    }

    return () => {
      if (recordingTimer) {
        clearInterval(recordingTimer);
      }
    };
  }, [audioRecorder.isRecording, maxDuration, recordingTimer]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setAudioRecorder(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false,
          mediaRecorder: null,
        }));

        // Call callback with audio data
        if (onAudioCapture) {
          onAudioCapture(audioBlob, recordingTime);
        }

        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setAudioRecorder(prev => ({
        ...prev,
        isRecording: true,
        mediaRecorder,
      }));
      setRecordingTime(0);

      // Also start speech recognition
      startListening();

    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('音声録音の開始に失敗しました。マイクへのアクセス許可を確認してください。');
    }
  }, [startListening, onAudioCapture, recordingTime]);

  const stopRecording = useCallback(() => {
    if (audioRecorder.mediaRecorder && audioRecorder.isRecording) {
      audioRecorder.mediaRecorder.stop();
    }
    stopListening();
  }, [audioRecorder.mediaRecorder, audioRecorder.isRecording, stopListening]);

  const playRecording = useCallback(() => {
    if (audioRecorder.audioUrl) {
      const audio = new Audio(audioRecorder.audioUrl);
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        alert('音声の再生に失敗しました。');
      };

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play();
      }
    }
  }, [audioRecorder.audioUrl, isPlaying]);

  const deleteRecording = useCallback(() => {
    if (audioRecorder.audioUrl) {
      URL.revokeObjectURL(audioRecorder.audioUrl);
    }
    setAudioRecorder({
      isRecording: false,
      mediaRecorder: null,
      audioBlob: null,
      duration: 0,
      audioUrl: null,
    });
    setRecordingTime(0);
    resetTranscript();
  }, [audioRecorder.audioUrl, resetTranscript]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRecordingProgress = (): number => {
    return Math.min((recordingTime / maxDuration) * 100, 100);
  };

  if (!isSupported) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        お使いのブラウザは音声認識機能をサポートしていません。
        Chrome、Safari、またはEdgeをお使いください。
      </Alert>
    );
  }

  return (
    <Box className={className}>
      {/* Main Voice Input Card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          {/* Controls */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6" component="div">
              音声入力
            </Typography>
            <Box>
              <IconButton
                onClick={() => setSettingsOpen(true)}
                size="small"
                disabled={disabled || audioRecorder.isRecording}
              >
                <Settings />
              </IconButton>
            </Box>
          </Box>

          {/* Recording Status */}
          {audioRecorder.isRecording && (
            <Box mb={2}>
              <Typography variant="body2" color="error" gutterBottom>
                録音中... {formatTime(recordingTime)} / {formatTime(maxDuration)}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={getRecordingProgress()} 
                color="secondary"
              />
            </Box>
          )}

          {/* Speech Recognition Status */}
          {isListening && (
            <Box mb={2}>
              <Chip 
                icon={<VolumeUp />}
                label={state === 'listening' ? '聞いています...' : '処理中...'}
                color="primary"
                size="small"
              />
              {confidence > 0 && (
                <Chip 
                  label={`信頼度: ${Math.round(confidence * 100)}%`}
                  size="small"
                  sx={{ ml: 1 }}
                />
              )}
            </Box>
          )}

          {/* Error Display */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Transcript Display */}
          <Box
            sx={{
              minHeight: 120,
              p: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'background.default',
              mb: 2,
            }}
          >
            <Typography variant="body1" component="div">
              {transcript && (
                <span style={{ color: '#1976d2' }}>{transcript}</span>
              )}
              {interimTranscript && (
                <span style={{ color: '#666', fontStyle: 'italic' }}>
                  {interimTranscript}
                </span>
              )}
              {!transcript && !interimTranscript && (
                <span style={{ color: '#999' }}>{placeholder}</span>
              )}
            </Typography>
          </Box>

          {/* Control Buttons */}
          <Box display="flex" gap={1} justifyContent="center" flexWrap="wrap">
            {!audioRecorder.isRecording ? (
              <Button
                variant="contained"
                startIcon={<Mic />}
                onClick={startRecording}
                disabled={disabled}
                color="primary"
                size="large"
              >
                録音開始
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<Stop />}
                onClick={stopRecording}
                color="secondary"
                size="large"
              >
                録音停止
              </Button>
            )}

            {audioRecorder.audioUrl && !audioRecorder.isRecording && (
              <>
                <Button
                  variant="outlined"
                  startIcon={isPlaying ? <Pause /> : <PlayArrow />}
                  onClick={playRecording}
                  disabled={disabled}
                >
                  {isPlaying ? '停止' : '再生'}
                </Button>
                
                <Button
                  variant="outlined"
                  startIcon={<Delete />}
                  onClick={deleteRecording}
                  disabled={disabled}
                  color="error"
                >
                  削除
                </Button>
              </>
            )}

            {(transcript || interimTranscript) && !audioRecorder.isRecording && (
              <Button
                variant="outlined"
                onClick={resetTranscript}
                disabled={disabled}
              >
                クリア
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>音声入力設定</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>言語</InputLabel>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                label="言語"
              >
                <MenuItem value="ja-JP">日本語</MenuItem>
                <MenuItem value="en-US">English (US)</MenuItem>
                <MenuItem value="zh-CN">中文 (简体)</MenuItem>
                <MenuItem value="ko-KR">한국어</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              最大録音時間: {formatTime(maxDuration)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VoiceInput;