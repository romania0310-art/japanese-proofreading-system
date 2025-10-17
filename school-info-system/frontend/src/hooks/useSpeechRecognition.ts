import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceRecognitionResult, SpeechRecognitionState } from '../types';

// Extend the Window interface to include webkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface UseSpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  onResult?: (result: VoiceRecognitionResult) => void;
  onError?: (error: any) => void;
  onEnd?: () => void;
}

interface SpeechRecognitionHook {
  isSupported: boolean;
  isListening: boolean;
  state: SpeechRecognitionState;
  transcript: string;
  interimTranscript: string;
  confidence: number;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

export const useSpeechRecognition = (
  options: UseSpeechRecognitionOptions = {}
): SpeechRecognitionHook => {
  const {
    language = 'ja-JP',
    continuous = true,
    interimResults = true,
    maxAlternatives = 1,
    onResult,
    onError,
    onEnd,
  } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [state, setState] = useState<SpeechRecognitionState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      setupRecognition();
    } else {
      setIsSupported(false);
      setError('音声認識機能がサポートされていません。Chrome、Safari、またはEdgeをお使いください。');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const setupRecognition = useCallback(() => {
    if (!recognitionRef.current) return;

    const recognition = recognitionRef.current;

    // Configure recognition
    recognition.language = language;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = maxAlternatives;

    // Event handlers
    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      setState('listening');
      setError(null);
    };

    recognition.onresult = (event: any) => {
      console.log('Speech recognition result:', event);
      setState('processing');
      
      let finalTranscript = '';
      let interimTranscript = '';
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0;

        if (result.isFinal) {
          finalTranscript += transcript;
          maxConfidence = Math.max(maxConfidence, confidence);
          
          // Call onResult callback with final result
          if (onResult) {
            onResult({
              text: transcript,
              confidence: confidence,
              isFinal: true,
              timestamp: new Date().toISOString(),
            });
          }
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        setConfidence(maxConfidence);
      }
      
      setInterimTranscript(interimTranscript);
      
      // Call onResult callback with interim result
      if (interimTranscript && onResult) {
        onResult({
          text: interimTranscript,
          confidence: 0,
          isFinal: false,
          timestamp: new Date().toISOString(),
        });
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event);
      
      let errorMessage = '音声認識エラーが発生しました。';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = '音声が検出されませんでした。マイクが正しく設定されているか確認してください。';
          break;
        case 'audio-capture':
          errorMessage = 'マイクにアクセスできませんでした。マイクの許可を確認してください。';
          break;
        case 'not-allowed':
          errorMessage = 'マイクの使用が許可されていません。ブラウザ設定を確認してください。';
          break;
        case 'network':
          errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
          break;
        case 'service-not-allowed':
          errorMessage = '音声認識サービスが利用できません。';
          break;
        default:
          errorMessage = `音声認識エラー: ${event.error}`;
      }

      setError(errorMessage);
      setState('error');
      setIsListening(false);

      if (onError) {
        onError(event);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      setState('completed');

      if (onEnd) {
        onEnd();
      }
    };

    recognition.onspeechstart = () => {
      console.log('Speech detected');
    };

    recognition.onspeechend = () => {
      console.log('Speech ended');
    };

    recognition.onnomatch = () => {
      console.log('No speech was recognised');
      setError('音声を認識できませんでした。もう一度お試しください。');
    };

  }, [language, continuous, interimResults, maxAlternatives, onResult, onError, onEnd]);

  // Update recognition configuration when options change
  useEffect(() => {
    setupRecognition();
  }, [setupRecognition]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('音声認識機能が利用できません。');
      return;
    }

    if (isListening) {
      console.log('Already listening');
      return;
    }

    try {
      setError(null);
      setState('idle');
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setError('音声認識の開始に失敗しました。');
      setState('error');
    }
  }, [isSupported, isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) {
      return;
    }

    try {
      recognitionRef.current.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setConfidence(0);
    setError(null);
    setState('idle');
  }, []);

  return {
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
  };
};