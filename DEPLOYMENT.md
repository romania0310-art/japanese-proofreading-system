# 日本語校正システム - デプロイガイド

## 🚀 推奨デプロイ方法

### 1. Vercel（最推奨）

#### 準備
1. [Vercel](https://vercel.com/)アカウントを作成
2. GitHubと連携

#### デプロイ手順
```bash
# 1. Vercel CLIインストール（ローカル環境）
npm i -g vercel

# 2. ログイン
vercel login

# 3. プロジェクトルートでデプロイ
vercel

# 4. 設定確認
# - フレームワーク: Other
# - Build Command: npm run build  
# - Output Directory: ./
# - Install Command: npm install
```

#### 自動デプロイ（GitHub連携）
1. Vercelダッシュボードで「New Project」
2. GitHubリポジトリを選択
3. 以下設定で「Deploy」:
   - Framework Preset: Other
   - Root Directory: ./
   - Build Command: `npm run build`
   - Output Directory: ./
   - Install Command: `npm install`

### 2. Railway

#### デプロイ手順
1. [Railway](https://railway.app/)でアカウント作成
2. 「Deploy from GitHub repo」を選択
3. リポジトリを選択してデプロイ

#### 環境設定
- Start Command: `npm start`
- Port: 3000（自動検出）

### 3. Render

#### デプロイ手順
1. [Render](https://render.com/)でアカウント作成  
2. 「New Web Service」を選択
3. GitHubリポジトリを連携
4. 以下設定:
   - Name: jp-proofreading-system
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`

### 4. Netlify（Functions使用）

#### 事前準備
```bash
# netlify-lambda インストール
npm install netlify-lambda

# netlify.toml 作成（既に含まれています）
```

#### デプロイ手順
1. [Netlify](https://netlify.com/)でアカウント作成
2. 「Deploy from Git」を選択  
3. GitHubリポジトリを連携
4. Build設定:
   - Build command: `npm run build`
   - Publish directory: `public`

## 📋 必要ファイル一覧

デプロイに必要なファイルは全て準備済みです：

- ✅ `vercel.json` - Vercel設定
- ✅ `package.json` - 依存関係（更新済み）  
- ✅ `server.js` - メインアプリケーション
- ✅ `lib/` - 校正エンジン
- ✅ `public/` - 静的ファイル
- ✅ `.gitignore` - Git除外設定

## 🔧 デプロイ後の確認事項

1. **健康チェック**: `https://your-domain.com/api/health`
2. **ファイルアップロード**: DOCXファイルのテスト
3. **校正機能**: 181ルールの動作確認
4. **ダウンロード機能**: DOCX/XLSX体裁保持確認

## ⚠️ 注意事項

### Vercel制限事項
- ファイルサイズ上限: 50MB（設定済み）
- 実行時間上限: 30秒（設定済み）
- メモリ上限: 1GB

### 推奨設定
- Node.js バージョン: 18.x以上
- ファイルアップロード上限: 10MB（現在設定）
- タイムアウト: 30秒

## 🎯 デプロイ完了後

1. カスタムドメイン設定（オプション）
2. HTTPS証明書（自動）
3. CDN配信（自動）
4. 監視・ログ確認

## 🆘 トラブルシューティング

### ビルドエラー
- `npm install` の依存関係エラー → package.jsonの依存関係確認
- メモリ不足 → vercel.jsonのmaxLambdaSizeを調整

### 実行時エラー  
- ファイルアップロードエラー → multerとexpressの設定確認
- 校正処理エラー → lib/ディレクトリの存在確認

---

**🚀 Ready for Deployment!**

このシステムは本格運用に対応済みです。推奨はVercelでの自動デプロイです。