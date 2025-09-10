import express from 'express';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentParser } from './lib/documentParser.js';
import { ProofreadingEngine } from './lib/proofreadingEngine.js';
import { DocumentFormatter } from './lib/docxFormatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// セキュリティとCORS設定
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静的ファイル配信
app.use(express.static(path.join(__dirname, 'public')));

// multer設定（ファイルアップロード）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB制限
  },
  // 日本語ファイル名対応
  preservePath: false,
  // ファイル名の文字エンコーディングを適切に処理
  fileFilter: (req, file, cb) => {
    try {
      // originalname が正しく UTF-8 でデコードされていない場合の対処
      if (file.originalname.includes('\\x') || file.originalname.includes('ã')) {
        // 文字化けしている可能性があるため、Base64でデコードを試行
        console.log('文字化けファイル名を検出:', file.originalname);
        
        // フロントエンドからの正しいファイル名が追加フィールドで送信される場合の処理
        // 現在はとりあえず通す
      }
      cb(null, true);
    } catch (error) {
      console.error('ファイル名処理エラー:', error);
      cb(null, true); // エラーでも通す
    }
  }
});

// インスタンス初期化
const documentParser = new DocumentParser();
const proofreadingEngine = new ProofreadingEngine();
const documentFormatter = new DocumentFormatter();

// メインページ
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ファイル解析API
app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'ファイルが選択されていません' 
      });
    }

    console.log('=== ファイル解析開始 ===');
    console.log('ファイル名:', req.file.originalname);
    console.log('MIMEタイプ:', req.file.mimetype);
    console.log('ファイルサイズ:', req.file.size, 'bytes');

    const result = await documentParser.parseBuffer(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    console.log('解析結果:', {
      success: result.success,
      textLength: result.text?.length || 0,
      error: result.error
    });

    res.json(result);
  } catch (error) {
    console.error('ファイル解析エラー:', error);
    res.status(500).json({
      success: false,
      error: 'ファイル解析中にエラーが発生しました'
    });
  }
});

// 校正API
app.post('/api/proofread', (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: '校正対象のテキストが指定されていません'
      });
    }

    console.log('=== 校正処理開始 ===');
    console.log('テキスト長:', text.length);

    const result = proofreadingEngine.proofread(text);

    console.log('校正結果:', {
      totalChanges: result.totalChanges,
      textLength: result.correctedText?.length || 0
    });

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('校正処理エラー:', error);
    res.status(500).json({
      success: false,
      error: '校正処理中にエラーが発生しました'
    });
  }
});

// 校正後DOCXダウンロードAPI
app.post('/api/generate-docx', upload.single('file'), async (req, res) => {
  try {
    const { correctedText, originalText, changes, originalFileName } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'ファイルが選択されていません' 
      });
    }

    if (!correctedText) {
      return res.status(400).json({
        success: false,
        error: '校正テキストが指定されていません'
      });
    }

    console.log('=== DOCX生成開始 ===');
    
    // ファイル名の適切な取得（フロントエンドから送信された正しいファイル名を優先）
    let actualFileName = originalFileName || req.file.originalname;
    
    // Base64デコードの試行（フロントエンドでエンコードされている場合）
    if (originalFileName && originalFileName.startsWith('data:')) {
      try {
        // data: URLs形式の場合
        const base64Data = originalFileName.split(',')[1];
        actualFileName = Buffer.from(base64Data, 'base64').toString('utf8');
      } catch (e) {
        actualFileName = originalFileName;
      }
    }
    
    console.log('元ファイル名（受信）:', req.file.originalname);
    console.log('元ファイル名（使用）:', actualFileName);
    console.log('校正テキスト長:', correctedText.length);

    let docxBuffer;
    const extension = actualFileName.toLowerCase().split('.').pop();
    
    if (extension === 'docx' || extension === 'xlsx') {
      // DOCX/XLSXの場合：元の構造を保持して生成
      const parsedChanges = changes ? JSON.parse(changes) : [];
      docxBuffer = await documentFormatter.generateCorrectedFile(
        req.file.buffer,
        originalText || '',
        correctedText,
        parsedChanges,
        extension
      );
    } else {
      // その他の場合：新規DOCXとして生成
      docxBuffer = await documentFormatter.generateSimpleDocx(
        correctedText,
        req.file.originalname.replace(/\.[^.]+$/, '_corrected.docx')
      );
    }

    // ファイル名を生成（分かりやすい形式）
    const baseName = actualFileName.replace(/\.[^.]+$/, '');
    const outputExtension = (extension === 'docx' || extension === 'xlsx') ? extension : 'docx';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
    const timeStr = `${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
    const outputFileName = `【校正済み】${baseName}_${dateStr}_${timeStr}.${outputExtension}`;

    console.log('DOCX生成完了:', {
      originalFileName: req.file.originalname,
      baseName: baseName,
      outputFileName: outputFileName,
      encodedFileName: encodeURIComponent(outputFileName),
      size: docxBuffer.length
    });

    // レスポンスヘッダーを設定（日本語ファイル名対応）
    const mimeType = extension === 'xlsx' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    res.setHeader('Content-Type', mimeType);
    
    // 日本語ファイル名対応：元のファイル名の形式を最大限保持
    const encodedFileName = encodeURIComponent(outputFileName);
    
    // ASCII互換ファイル名：ファイルシステム禁止文字のみ置換（日本語は残す）
    const safeBaseName = baseName.replace(/[<>:"/\\|?*]/g, '_');
    const asciiFileName = `corrected_${safeBaseName}_${dateStr}_${timeStr}.${outputExtension}`;
    
    console.log('ファイル名生成詳細:', {
      originalBaseName: baseName,
      safeBaseName: safeBaseName,
      outputFileName: outputFileName,
      asciiFileName: asciiFileName,
      encodedFileName: encodedFileName
    });
    
    // RFC 6266準拠のContent-Dispositionヘッダー
    // filename*=UTF-8''が優先される（モダンブラウザ）
    // filenameはフォールバック用（古いブラウザ）
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    
    // デバッグ用：代替手法も試してみる
    // res.setHeader('Content-Disposition', `attachment; filename="${outputFileName}"; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Length', docxBuffer.length);
    
    res.send(docxBuffer);

  } catch (error) {
    console.error('DOCX生成エラー:', error);
    res.status(500).json({
      success: false,
      error: 'ファイル生成中にエラーが発生しました: ' + error.message
    });
  }
});

// 404ハンドラー
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'API endpoint not found' 
  });
});

// エラーハンドラー
app.use((error, req, res, next) => {
  console.error('サーバーエラー:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 日本語校正システム起動`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`📋 API: /api/health, /api/parse, /api/proofread, /api/generate-docx (DOCX/XLSX対応)`);
  console.log(`⏰ 起動時刻: ${new Date().toLocaleString('ja-JP')}`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
});