# 学校現場情報共有システム

学校現場での多忙な環境において、各担当者間（児童支援担当教諭、養護教諭、ICT支援員、国際教室担当等）での情報共有を迅速・確実・安全に行うためのWebアプリケーションシステムです。

## 🌟 主要機能

### 🎤 音声入力による情報入力
- **Web Speech API**による音声認識
- スマートフォン・タブレット対応
- リアルタイム音声→テキスト変換
- 音声ファイル録音・保存機能

### 🔒 高度なセキュリティ機能
- **3段階の秘匿レベル管理**（一般・注意・機密）
- AES-256暗号化によるメッセージ保護
- 役職ベースのアクセス制御（RBAC）
- JWT認証とセッション管理
- 監査ログ機能

### ⚡ リアルタイム通信
- **Socket.io**によるリアルタイムメッセージ配信
- 既読・未読ステータス管理
- 緊急メッセージ通知機能
- オンラインユーザー表示

### 👥 ユーザー管理
- 管理者による入力者・共有先の管理
- 部署別ユーザー分類
- 権限レベル設定
- アカウント有効/無効切り替え

## 🏗️ システム構成

### バックエンド
- **Node.js + Express** - RESTful API
- **Prisma + PostgreSQL** - データベースORM
- **Socket.io** - リアルタイム通信
- **Redis** - セッション管理
- **JWT + bcrypt** - 認証・暗号化

### フロントエンド  
- **React + TypeScript** - メインUI
- **Material-UI** - UIコンポーネント
- **Web Speech API** - 音声認識
- **Socket.io Client** - リアルタイム通信

## 📦 インストール・セットアップ

### 必要な環境
- Node.js 18.0.0以上
- PostgreSQL 13以上
- Redis 6以上

### 1. プロジェクトクローン
```bash
cd /home/user/webapp/school-info-system
```

### 2. バックエンドセットアップ
```bash
cd backend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# .envファイルを適切に編集

# データベース設定
# PostgreSQLデータベース作成
createdb school_info_system

# Prismaマイグレーション実行
npx prisma migrate dev --name init

# 初期データ挿入（オプション）
npx prisma db seed
```

### 3. フロントエンドセットアップ
```bash
cd ../frontend

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# React用環境変数を設定
```

## 🚀 起動方法

### 開発環境
```bash
# バックエンド起動
cd backend
npm run dev

# フロントエンド起動（別ターミナル）
cd frontend
npm start
```

### 本番環境
```bash
# バックエンドビルド・起動
cd backend
npm run build
npm start

# フロントエンドビルド・配信
cd frontend
npm run build
# 生成されたbuildフォルダを適切なWebサーバーで配信
```

## 📱 使用方法

### 1. ログイン
- 管理者が作成したアカウントでログイン
- デモアカウント：
  - 管理者: `admin` / `password`
  - 教職員: `staff` / `password`
  - 一般職員: `user` / `password`

### 2. メッセージ送信
1. 「メッセージ送信」ページにアクセス
2. 受信者を選択
3. 音声入力ボタンを押して話すか、直接テキスト入力
4. 秘匿レベルと緊急度を設定
5. 送信ボタンをクリック

### 3. メッセージ確認
- ダッシュボードで未読メッセージ数を確認
- 「メッセージ」ページで詳細確認・返信・既読マーク

### 4. 管理機能（管理者・教職員）
- ユーザー管理（作成・編集・削除）
- システム統計の確認
- セキュリティ設定

## 🔧 設定項目

### 環境変数（バックエンド）
```env
# データベース
DATABASE_URL="postgresql://username:password@localhost:5432/school_info_system"

# JWT設定
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="24h"

# 暗号化
ENCRYPTION_KEY="your-256-bit-encryption-key"

# Redis
REDIS_URL="redis://localhost:6379"

# CORS
CORS_ORIGIN="http://localhost:3000,https://yourdomain.com"
```

### 環境変数（フロントエンド）
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
```

## 🔐 セキュリティ機能

### 秘匿レベル
- **レベル1（一般）**: 通常の業務連絡
- **レベル2（注意）**: 個人情報を含む内容  
- **レベル3（機密）**: 高度な秘匿性が必要な内容

### 暗号化
- メッセージ内容：AES-256-GCM暗号化
- パスワード：bcrypt + salt
- 通信：HTTPS/WSS強制

### アクセス制御
- JWT認証
- 役職ベースの権限管理
- セッション管理・自動ログアウト

## 📊 API仕様

### 認証エンドポイント
- `POST /auth/login` - ログイン
- `POST /auth/logout` - ログアウト
- `GET /auth/me` - 現在のユーザー情報

### メッセージエンドポイント
- `GET /api/messages` - メッセージ一覧取得
- `POST /api/messages` - メッセージ送信
- `POST /api/messages/:id/read` - 既読マーク

### 音声処理エンドポイント
- `POST /api/speech/upload` - 音声ファイルアップロード
- `POST /api/speech/transcribe` - 音声→テキスト変換

## 🚢 デプロイメント

### 推奨環境
- **フロントエンド**: Vercel、Netlify
- **バックエンド**: Railway、Render、Heroku
- **データベース**: PostgreSQL（Railway、Render、AWS RDS）
- **Redis**: Railway、Render、AWS ElastiCache

### デプロイ手順
1. 環境変数を本番環境用に設定
2. データベースマイグレーション実行
3. フロントエンドビルド・デプロイ
4. バックエンドデプロイ
5. CORS設定の確認

## 🔧 開発・カスタマイズ

### 新しい機能追加
1. バックエンドAPIエンドポイント作成
2. フロントエンドコンポーネント開発
3. 型定義追加（TypeScript）
4. テスト作成

### データベーススキーマ変更
```bash
# Prismaスキーマ編集後
npx prisma migrate dev --name migration_name
npx prisma generate
```

## 📋 今後の拡張予定

- [ ] プッシュ通知（PWA）
- [ ] ファイル添付機能
- [ ] グループチャット機能
- [ ] 音声メッセージ再生
- [ ] モバイルアプリ版
- [ ] 外部システム連携API

## 🐛 トラブルシューティング

### よくある問題
1. **音声認識が動作しない**
   - ブラウザがWeb Speech APIをサポートしているか確認
   - マイクアクセス許可を確認
   - HTTPS環境での利用を推奨

2. **リアルタイム通信が切断される**
   - ネットワーク接続を確認
   - ファイアウォール設定を確認
   - WebSocket接続が許可されているか確認

3. **データベース接続エラー**
   - DATABASE_URLが正しく設定されているか確認
   - PostgreSQLサービスが起動しているか確認

## 📞 サポート

技術的な質問や不具合報告は、プロジェクトのIssueページまでお願いします。

---

**開発チーム**: School Info System Team  
**バージョン**: 1.0.0  
**最終更新**: 2024-10-16