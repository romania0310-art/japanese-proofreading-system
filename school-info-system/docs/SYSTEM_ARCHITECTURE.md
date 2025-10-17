# 学校情報共有システム - システム構成・設計書

## システム全体構成図

```
┌─────────────────────────────────────────────────────────────────┐
│                        学校情報共有システム                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────────────────────────┐  │
│  │  フロントエンド  │    │             バックエンド             │  │
│  │                 │    │                                     │  │
│  │ ┌─────────────┐ │    │ ┌─────────────┐ ┌─────────────────┐ │  │
│  │ │ 音声入力UI  │ │◄───┤ │   REST API  │ │  認証サーバー   │ │  │
│  │ └─────────────┘ │    │ └─────────────┘ └─────────────────┘ │  │
│  │                 │    │                                     │  │
│  │ ┌─────────────┐ │    │ ┌─────────────┐ ┌─────────────────┐ │  │
│  │ │ 管理画面    │ │◄───┤ │ Socket.IO   │ │  暗号化エンジン │ │  │
│  │ └─────────────┘ │    │ └─────────────┘ └─────────────────┘ │  │
│  │                 │    │                                     │  │
│  │ ┌─────────────┐ │    │ ┌─────────────┐ ┌─────────────────┐ │  │
│  │ │ PWA機能     │ │    │ │ ビジネス    │ │  監査ログ       │ │  │
│  │ └─────────────┘ │    │ │ ロジック    │ └─────────────────┘ │  │
│  │                 │    │ └─────────────┘                     │  │
│  └─────────────────┘    │                                     │  │
│                         │                                     │  │
│                         └─────────────────────────────────────┘  │
│                                          │                       │
│                                          ▼                       │
│        ┌─────────────────────────────────────────────────────┐   │
│        │                データ永続化層                        │   │
│        │                                                     │   │
│        │ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │   │
│        │ │PostgreSQL   │ │   Redis     │ │  ファイル       │ │   │
│        │ │メインDB     │ │ セッション  │ │  ストレージ     │ │   │
│        │ └─────────────┘ └─────────────┘ └─────────────────┘ │   │
│        └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

      ▲                          ▲                          ▲
      │                          │                          │
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│ スマートフォン│         │    タブレット    │         │ デスクトップ │
│    端末      │         │     端末        │         │    端末     │
└─────────────┘         └─────────────────┘         └─────────────┘
```

## セキュリティアーキテクチャ

### 1. 認証・認可システム

#### 認証フロー
```
1. ユーザー → ログイン情報送信 → 認証サーバー
2. 認証サーバー → JWT発行 → ユーザー
3. ユーザー → JWT付きAPIリクエスト → バックエンド
4. バックエンド → JWT検証 → アクセス許可/拒否
```

#### 役職ベースアクセス制御（RBAC）
```
管理者(ADMIN)
├── 全システム管理権限
├── ユーザー追加・削除・編集
├── 全メッセージ閲覧・削除
├── セキュリティ設定変更
└── 監査ログ閲覧

教職員(STAFF)
├── メッセージ送受信
├── 自分の送信履歴閲覧
├── 割り当てられたグループメッセージ
└── プロフィール編集

一般職員(USER)
├── メッセージ送受信（制限付き）
├── 自分のメッセージのみ閲覧
└── 基本プロフィール編集
```

### 2. データ暗号化システム

#### 暗号化レイヤー
```
[ユーザー入力] → [フロント暗号化] → [通信暗号化(HTTPS)] → [バックエンド処理] → [DB暗号化]
      │                │                     │                   │              │
   平文データ        AES-256-GCM          TLS 1.3            復号・処理      AES-256-CBC
```

#### 暗号化対象データ
- **メッセージ内容**: AES-256-GCM（フロントエンド暗号化）
- **個人情報**: AES-256-CBC（データベースレベル）
- **パスワード**: bcrypt + salt（ハッシュ化）
- **セッション**: Redis暗号化ストレージ

### 3. 秘匿性レベル管理

```
レベル3（機密）
├── 暗号化キー：専用キー
├── アクセス：管理者+指定職員のみ
├── 保存期間：3ヶ月（自動削除）
├── 監査：全アクセスログ記録
└── 通知：暗号化プッシュ通知

レベル2（注意）  
├── 暗号化キー：グループキー
├── アクセス：関係者のみ
├── 保存期間：6ヶ月
├── 監査：読み書きログ記録
└── 通知：通常プッシュ通知

レベル1（一般）
├── 暗号化キー：共通キー
├── アクセス：全職員
├── 保存期間：1年
├── 監査：基本ログのみ
└── 通知：通常通知
```

## データベース設計

### ERD（Entity-Relationship Diagram）
```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Users       │       │    Messages     │       │  MessageReads   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄─────►│ id (PK)         │◄─────►│ id (PK)         │
│ username        │       │ sender_id (FK)  │       │ message_id (FK) │
│ email           │       │ content_encrypted│       │ user_id (FK)    │
│ password_hash   │       │ confidentiality │       │ read_at         │
│ role            │       │ created_at      │       │ created_at      │
│ department      │       │ updated_at      │       └─────────────────┘
│ is_active       │       │ is_urgent       │
│ created_at      │       │ audio_duration  │       ┌─────────────────┐
│ last_login      │       │ metadata        │       │ MessageRecipients│
└─────────────────┘       └─────────────────┘       ├─────────────────┤
                                                    │ id (PK)         │
┌─────────────────┐       ┌─────────────────┐       │ message_id (FK) │
│   UserGroups    │       │   AuditLogs     │       │ recipient_id (FK)│
├─────────────────┤       ├─────────────────┤       │ recipient_type  │
│ id (PK)         │       │ id (PK)         │       │ created_at      │
│ name            │       │ user_id (FK)    │       └─────────────────┘
│ description     │       │ action          │
│ created_by (FK) │       │ resource        │
│ created_at      │       │ ip_address      │
└─────────────────┘       │ user_agent      │
                          │ created_at      │
┌─────────────────┐       └─────────────────┘
│ UserGroupMembers│
├─────────────────┤       ┌─────────────────┐
│ id (PK)         │       │   Sessions      │
│ group_id (FK)   │       ├─────────────────┤
│ user_id (FK)    │       │ id (PK)         │
│ role_in_group   │       │ user_id (FK)    │
│ joined_at       │       │ token_hash      │
└─────────────────┘       │ expires_at      │
                          │ created_at      │
                          │ last_accessed   │
                          └─────────────────┘
```

### テーブル詳細設計

#### Users（ユーザー管理）
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'USER' CHECK (role IN ('ADMIN', 'STAFF', 'USER')),
    department VARCHAR(100),
    full_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

#### Messages（メッセージ管理）
```sql
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    content_encrypted TEXT NOT NULL,
    encryption_key_id VARCHAR(50),
    confidentiality_level INTEGER DEFAULT 1 CHECK (confidentiality_level IN (1,2,3)),
    is_urgent BOOLEAN DEFAULT false,
    audio_duration INTEGER, -- 秒単位
    original_audio_url TEXT, -- 一時的な音声ファイルURL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- 自動削除日時
    metadata JSONB -- デバイス情報、位置情報等
);
```

#### Message_Recipients（宛先管理）
```sql
CREATE TABLE message_recipients (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_type VARCHAR(10) DEFAULT 'USER' CHECK (recipient_type IN ('USER', 'GROUP')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API設計

### 認証エンドポイント
```
POST /auth/login          - ログイン
POST /auth/logout         - ログアウト  
POST /auth/refresh        - トークンリフレッシュ
POST /auth/forgot         - パスワードリセット
GET  /auth/me             - 現在のユーザー情報
```

### メッセージエンドポイント
```
GET    /api/messages             - メッセージ一覧取得
POST   /api/messages             - メッセージ送信
GET    /api/messages/:id         - 特定メッセージ取得
PUT    /api/messages/:id         - メッセージ編集
DELETE /api/messages/:id         - メッセージ削除
POST   /api/messages/:id/read    - 既読マーク
```

### ユーザー管理エンドポイント
```
GET    /api/users               - ユーザー一覧
POST   /api/users               - ユーザー作成
GET    /api/users/:id           - ユーザー詳細
PUT    /api/users/:id           - ユーザー更新
DELETE /api/users/:id           - ユーザー削除
```

### 音声処理エンドポイント
```
POST   /api/speech/transcribe   - 音声→テキスト変換
POST   /api/speech/upload       - 音声ファイルアップロード
```

## セキュリティ設定

### 環境変数
```env
# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/school_info
REDIS_URL=redis://localhost:6379

# JWT設定
JWT_SECRET=super-secret-key-for-production
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# 暗号化
ENCRYPTION_KEY=256-bit-encryption-key
SALT_ROUNDS=12

# セキュリティ
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# 外部サービス
PUSHER_APP_ID=your-pusher-app-id
PUSHER_KEY=your-pusher-key
PUSHER_SECRET=your-pusher-secret
```

### セキュリティヘッダー
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:"],
      mediaSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

## デプロイメント構成

### 本番環境推奨構成
```
フロントエンド: Vercel
├── React.js アプリケーション
├── 自動HTTPS
├── CDN配信
└── 環境変数管理

バックエンド: Railway/Render
├── Node.js + Express API
├── PostgreSQL データベース  
├── Redis セッション管理
├── SSL/TLS終端
└── 自動スケーリング

監視: 
├── アプリケーション監視（New Relic/Sentry）
├── データベース監視
├── セキュリティ監視（OWASP）
└── パフォーマンス監視
```

---

**作成日**: 2024-10-16  
**バージョン**: 1.0  
**ステータス**: システム構成設計完了