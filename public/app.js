class JapaneseProofreadingSystem {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.currentFile = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkApiStatus();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const processBtn = document.getElementById('process-btn');
        const copyTextBtn = document.getElementById('copy-text-btn');

        // ファイルアップロード関連
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 処理実行
        processBtn.addEventListener('click', this.processFile.bind(this));

        // コピー機能
        copyTextBtn.addEventListener('click', this.copyToClipboard.bind(this));
    }

    async checkApiStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/health`);
            const data = await response.json();
            
            const statusElement = document.getElementById('api-status');
            if (data.status === 'ok') {
                statusElement.textContent = 'API: 正常';
                statusElement.className = 'text-green-600';
            } else {
                throw new Error('API異常');
            }
        } catch (error) {
            console.error('API status check failed:', error);
            const statusElement = document.getElementById('api-status');
            statusElement.textContent = 'API: エラー';
            statusElement.className = 'text-red-600';
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
    }

    handleDrop(e) {
        e.preventDefault();
        const uploadArea = e.currentTarget;
        uploadArea.classList.remove('border-blue-400', 'bg-blue-50');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.selectFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.selectFile(files[0]);
        }
    }

    selectFile(file) {
        // ファイル形式チェック
        const allowedTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
            'application/octet-stream'
        ];

        const allowedExtensions = ['docx', 'xlsx', 'txt', 'csv'];
        const extension = file.name.toLowerCase().split('.').pop();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
            alert('サポートされていないファイル形式です。\\nDOCX, XLSX, TXT, CSVファイルを選択してください。');
            return;
        }

        // ファイルサイズチェック（10MB）
        if (file.size > 10 * 1024 * 1024) {
            alert('ファイルサイズが10MBを超えています。');
            return;
        }

        this.currentFile = file;
        this.showFileInfo(file);
    }

    showFileInfo(file) {
        const fileInfo = document.getElementById('file-info');
        const fileDetails = document.getElementById('file-details');
        
        const sizeKB = Math.round(file.size / 1024);
        const fileTypeText = this.getFileTypeText(file);
        
        fileDetails.innerHTML = `
            <strong>${file.name}</strong><br>
            種類: ${fileTypeText} | サイズ: ${sizeKB} KB
        `;
        
        fileInfo.classList.remove('hidden');
        this.hideResults();
    }

    getFileTypeText(file) {
        const extension = file.name.toLowerCase().split('.').pop();
        const typeMap = {
            'docx': 'Microsoft Word文書',
            'xlsx': 'Microsoft Excel文書',
            'txt': 'テキストファイル',
            'csv': 'CSVファイル'
        };
        return typeMap[extension] || 'その他';
    }

    async processFile() {
        if (!this.currentFile) return;

        this.showProgress('ファイルを解析しています...');

        try {
            // Step 1: ファイル解析
            this.updateProgress(25, 'ファイルを解析中...');
            const parseResult = await this.parseFile(this.currentFile);

            if (!parseResult.success) {
                throw new Error(parseResult.error || 'ファイル解析に失敗しました');
            }

            // Step 2: 校正処理
            this.updateProgress(75, '文章を校正中...');
            const proofreadResult = await this.proofreadText(parseResult.text);

            if (!proofreadResult.success) {
                throw new Error(proofreadResult.error || '校正処理に失敗しました');
            }

            // Step 3: 結果表示
            this.updateProgress(100, '完了');
            await this.delay(500);
            
            this.hideProgress();
            this.showResults(parseResult, proofreadResult.result);

        } catch (error) {
            console.error('Processing error:', error);
            this.hideProgress();
            this.showError(error.message);
        }
    }

    async parseFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.apiBaseUrl}/api/parse`, {
            method: 'POST',
            body: formData
        });

        return await response.json();
    }

    async proofreadText(text) {
        const response = await fetch(`${this.apiBaseUrl}/api/proofread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        return await response.json();
    }

    showResults(parseResult, proofreadResult) {
        const noResult = document.getElementById('no-result');
        const statsArea = document.getElementById('correction-stats');
        const textArea = document.getElementById('corrected-text-area');
        const changesArea = document.getElementById('changes-list-area');

        noResult.classList.add('hidden');
        
        // 統計情報
        document.getElementById('changes-count').textContent = proofreadResult.totalChanges;
        document.getElementById('original-length').textContent = parseResult.text.length.toLocaleString();
        document.getElementById('tables-count').textContent = parseResult.metadata?.tables || 0;
        statsArea.classList.remove('hidden');

        // 校正後テキスト
        document.getElementById('corrected-text').textContent = proofreadResult.correctedText;
        textArea.classList.remove('hidden');

        // 変更一覧
        if (proofreadResult.changes.length > 0) {
            this.showChangesList(proofreadResult.changes);
            changesArea.classList.remove('hidden');
        }

        console.log('Results displayed:', {
            originalLength: parseResult.text.length,
            changesCount: proofreadResult.totalChanges,
            tablesCount: parseResult.metadata?.tables || 0
        });
    }

    showChangesList(changes) {
        const changesList = document.getElementById('changes-list');
        changesList.innerHTML = '';

        changes.forEach((change, index) => {
            const changeItem = document.createElement('div');
            changeItem.className = 'bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded';
            
            changeItem.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900">
                            ${index + 1}. ${change.rule.category}
                        </div>
                        <div class="mt-1 text-sm text-gray-600">
                            <span class="line-through text-red-600">${change.original}</span>
                            <i class="fas fa-arrow-right mx-2 text-gray-400"></i>
                            <span class="text-green-600 font-medium">${change.corrected}</span>
                        </div>
                        ${change.rule.note ? `<div class="mt-1 text-xs text-gray-500">${change.rule.note}</div>` : ''}
                    </div>
                </div>
            `;
            
            changesList.appendChild(changeItem);
        });
    }

    async copyToClipboard() {
        const correctedText = document.getElementById('corrected-text').textContent;
        
        try {
            await navigator.clipboard.writeText(correctedText);
            
            const button = document.getElementById('copy-text-btn');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check mr-2"></i>コピー完了！';
            button.classList.remove('bg-gray-600', 'hover:bg-gray-700');
            button.classList.add('bg-green-600', 'hover:bg-green-700');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('bg-green-600', 'hover:bg-green-700');
                button.classList.add('bg-gray-600', 'hover:bg-gray-700');
            }, 2000);
        } catch (error) {
            console.error('Copy failed:', error);
            alert('テキストのコピーに失敗しました');
        }
    }

    showProgress(message) {
        document.getElementById('progress-text').textContent = message;
        document.getElementById('progress-bar').style.width = '0%';
        document.getElementById('progress').classList.remove('hidden');
    }

    updateProgress(percent, message) {
        document.getElementById('progress-text').textContent = message;
        document.getElementById('progress-bar').style.width = `${percent}%`;
    }

    hideProgress() {
        document.getElementById('progress').classList.add('hidden');
    }

    hideResults() {
        document.getElementById('no-result').classList.remove('hidden');
        document.getElementById('correction-stats').classList.add('hidden');
        document.getElementById('corrected-text-area').classList.add('hidden');
        document.getElementById('changes-list-area').classList.add('hidden');
    }

    showError(message) {
        alert(`エラー: ${message}`);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new JapaneseProofreadingSystem();
});