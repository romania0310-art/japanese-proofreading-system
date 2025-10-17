const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { PrismaClient } = require('@prisma/client');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'audio');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Allow audio files
    const allowedMimes = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/x-m4a'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only audio files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
  }
});

/**
 * POST /api/speech/upload
 * Upload audio file for processing
 */
router.post('/upload', upload.single('audio'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No audio file provided', 400, 'NO_FILE');
  }

  const {
    duration,
    confidentialityLevel = 1,
    metadata = {}
  } = req.body;

  // Validate duration
  const maxDuration = parseInt(process.env.MAX_AUDIO_DURATION) || 300; // 5 minutes default
  if (duration && parseInt(duration) > maxDuration) {
    // Delete uploaded file if duration is too long
    try {
      await fs.unlink(req.file.path);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
    throw new AppError(`Audio duration exceeds maximum limit of ${maxDuration} seconds`, 400, 'DURATION_TOO_LONG');
  }

  // Generate a temporary URL for the audio file
  const audioUrl = `/uploads/audio/${req.file.filename}`;
  
  // Store file metadata temporarily (in production, you might use a proper storage service)
  const fileInfo = {
    id: req.file.filename,
    originalName: req.file.originalname,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    mimetype: req.file.mimetype,
    duration: duration ? parseInt(duration) : null,
    uploadedBy: req.user.id,
    uploadedAt: new Date().toISOString(),
    confidentialityLevel: parseInt(confidentialityLevel),
    metadata: {
      ...metadata,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    },
    url: audioUrl,
    // Auto-delete after 24 hours
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };

  res.json({
    success: true,
    message: 'Audio file uploaded successfully',
    file: {
      id: fileInfo.id,
      filename: fileInfo.filename,
      size: fileInfo.size,
      duration: fileInfo.duration,
      url: fileInfo.url,
      uploadedAt: fileInfo.uploadedAt,
      expiresAt: fileInfo.expiresAt
    }
  });
}));

/**
 * POST /api/speech/transcribe
 * Transcribe audio to text (placeholder - in production you would integrate with a speech-to-text service)
 */
router.post('/transcribe', asyncHandler(async (req, res) => {
  const { audioUrl, language = 'ja-JP', options = {} } = req.body;

  if (!audioUrl) {
    throw new AppError('Audio URL is required', 400, 'MISSING_AUDIO_URL');
  }

  // TODO: Integrate with actual speech-to-text service (e.g., Google Speech-to-Text, Azure Speech, AWS Transcribe)
  // For now, return a mock response
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Mock transcription result
  const mockTranscriptions = [
    '児童支援について緊急の連絡があります。田中さんの件で保護者との面談が必要です。',
    '養護教諭の山田です。インフルエンザの流行に注意が必要です。手洗いの徹底をお願いします。',
    'ICT支援について、新しいタブレットの設定が完了しました。来週から使用開始予定です。',
    '国際教室の件で連絡です。新しい転入生の受け入れ準備をお願いします。',
    'お疲れ様です。明日の会議の資料について確認したい点があります。'
  ];

  const randomTranscription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];

  // Calculate confidence score (mock)
  const confidence = 0.85 + Math.random() * 0.10; // 85-95% confidence

  const transcriptionResult = {
    text: randomTranscription,
    confidence: Math.round(confidence * 100) / 100,
    language: language,
    duration: options.duration || null,
    alternatives: [
      {
        text: randomTranscription,
        confidence: confidence
      }
    ],
    metadata: {
      audioUrl,
      processedAt: new Date().toISOString(),
      processingTime: 1000, // ms
      service: 'mock-speech-service'
    }
  };

  res.json({
    success: true,
    message: 'Audio transcribed successfully',
    transcription: transcriptionResult
  });
}));

/**
 * GET /api/speech/languages
 * Get supported languages for speech recognition
 */
router.get('/languages', asyncHandler(async (req, res) => {
  const supportedLanguages = [
    {
      code: 'ja-JP',
      name: '日本語',
      displayName: 'Japanese (Japan)',
      isDefault: true
    },
    {
      code: 'en-US',
      name: 'English',
      displayName: 'English (United States)',
      isDefault: false
    },
    {
      code: 'zh-CN',
      name: '中文',
      displayName: 'Chinese (Simplified)',
      isDefault: false
    },
    {
      code: 'ko-KR',
      name: '한국어',
      displayName: 'Korean',
      isDefault: false
    }
  ];

  res.json({
    success: true,
    languages: supportedLanguages
  });
}));

/**
 * DELETE /api/speech/files/:id
 * Delete uploaded audio file
 */
router.delete('/files/:id', asyncHandler(async (req, res) => {
  const fileId = req.params.id;
  
  // In a production system, you would check database records
  // For now, we'll try to delete the file directly
  const filePath = path.join(process.cwd(), 'uploads', 'audio', fileId);
  
  try {
    await fs.access(filePath); // Check if file exists
    await fs.unlink(filePath); // Delete file
    
    res.json({
      success: true,
      message: 'Audio file deleted successfully'
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new AppError('Audio file not found', 404, 'FILE_NOT_FOUND');
    }
    throw new AppError('Failed to delete audio file', 500, 'DELETE_FAILED');
  }
}));

/**
 * GET /api/speech/settings
 * Get speech recognition settings
 */
router.get('/settings', asyncHandler(async (req, res) => {
  const settings = {
    maxDuration: parseInt(process.env.MAX_AUDIO_DURATION) || 300,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024,
    supportedFormats: [
      'audio/webm',
      'audio/mp4', 
      'audio/mpeg',
      'audio/wav',
      'audio/ogg'
    ],
    defaultLanguage: 'ja-JP',
    confidentialityLevels: [
      { value: 1, label: '一般', description: '通常の業務連絡' },
      { value: 2, label: '注意', description: '個人情報を含む内容' },
      { value: 3, label: '機密', description: '高度な秘匿性が必要' }
    ]
  };

  res.json({
    success: true,
    settings
  });
}));

/**
 * POST /api/speech/analyze
 * Analyze speech characteristics (volume, quality, etc.)
 */
router.post('/analyze', asyncHandler(async (req, res) => {
  const { audioUrl, analysisType = 'basic' } = req.body;

  if (!audioUrl) {
    throw new AppError('Audio URL is required', 400, 'MISSING_AUDIO_URL');
  }

  // Mock analysis results
  const analysis = {
    quality: {
      score: 0.8 + Math.random() * 0.15, // 80-95%
      noiseLevel: Math.random() * 0.2, // 0-20%
      clarity: 0.75 + Math.random() * 0.2, // 75-95%
      volume: 0.6 + Math.random() * 0.3 // 60-90%
    },
    duration: {
      total: Math.floor(Math.random() * 120) + 10, // 10-130 seconds
      silence: Math.floor(Math.random() * 10), // 0-10 seconds silence
      speech: null // Will be calculated
    },
    characteristics: {
      language: 'ja-JP',
      speakingRate: 'normal', // slow, normal, fast
      emotionalTone: ['neutral', 'calm', 'urgent'][Math.floor(Math.random() * 3)],
      confidence: 0.85 + Math.random() * 0.1
    },
    recommendations: []
  };

  // Calculate speech duration
  analysis.duration.speech = analysis.duration.total - analysis.duration.silence;

  // Add recommendations based on analysis
  if (analysis.quality.noiseLevel > 0.15) {
    analysis.recommendations.push('録音環境の改善を推奨します（ノイズが多い）');
  }
  if (analysis.quality.volume < 0.4) {
    analysis.recommendations.push('音量を上げることを推奨します');
  }
  if (analysis.duration.silence > analysis.duration.total * 0.3) {
    analysis.recommendations.push('無音部分が多いです。録音の見直しを推奨します');
  }

  res.json({
    success: true,
    message: 'Audio analysis completed',
    analysis
  });
}));

module.exports = router;