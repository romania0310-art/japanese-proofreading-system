class JapaneseProofreadingSystem {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.currentFile = null;
        this.currentResult = null; // 校正結果を保持
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
        const clearFileBtn = document.getElementById('clear-file-btn');
        const copyTextBtn = document.getElementById('copy-text-btn');
        const downloadDocxBtn = document.getElementById('download-docx-btn');

        // ファイルアップロード関連
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // 処理実行
        processBtn.addEventListener('click', this.processFile.bind(this));
        
        // ファイル削除
        clearFileBtn.addEventListener('click', this.clearFile.bind(this));

        // コピー機能
        copyTextBtn.addEventListener('click', this.copyToClipboard.bind(this));
        
        // ファイルダウンロード機能
        downloadDocxBtn.addEventListener('click', this.downloadFile.bind(this));
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

    clearFile() {
        this.currentFile = null;
        this.currentResult = null;
        
        // UI要素をリセット
        document.getElementById('file-info').classList.add('hidden');
        document.getElementById('file-input').value = '';
        this.hideResults();
        
        console.log('ファイルをクリアしました');
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
        console.log('=== PROOFREADING DEBUG ===');
        console.log('Input text:', text);
        
        const response = await fetch(`${this.apiBaseUrl}/api/proofread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        const result = await response.json();
        
        console.log('Proofreading API response:', result);
        console.log('Corrected text:', result.result?.correctedText);
        console.log('Total changes:', result.result?.totalChanges);
        console.log('Changes list:', result.result?.changes);
        
        return result;
    }

    showResults(parseResult, proofreadResult) {
        const noResult = document.getElementById('no-result');
        const statsArea = document.getElementById('correction-stats');
        const downloadSection = document.getElementById('download-section');
        const changesArea = document.getElementById('changes-list-area');

        // 結果を保存（ダウンロード用）
        this.currentResult = {
            parseResult,
            proofreadResult
        };

        noResult.classList.add('hidden');
        
        // 統計情報
        document.getElementById('changes-count').textContent = proofreadResult.totalChanges;
        document.getElementById('original-length').textContent = parseResult.text.length.toLocaleString();
        document.getElementById('tables-count').textContent = parseResult.metadata?.tables || 0;
        statsArea.classList.remove('hidden');

        // ダウンロードセクションを表示
        downloadSection.classList.remove('hidden');

        // 変更一覧
        if (proofreadResult.changes.length > 0) {
            this.showChangesList(proofreadResult.changes);
            changesArea.classList.remove('hidden');
        }

        console.log('=== RESULTS DISPLAY DEBUG ===');
        console.log('Parse result:', parseResult);
        console.log('Proofread result:', proofreadResult);
        console.log('Results displayed:', {
            originalLength: parseResult.text.length,
            changesCount: proofreadResult.totalChanges,
            tablesCount: parseResult.metadata?.tables || 0,
            changes: proofreadResult.changes
        });
    }

    showChangesList(changes) {
        console.log('=== CHANGES LIST DEBUG ===');
        console.log('Changes to display:', changes);
        
        const changesList = document.getElementById('changes-list');
        changesList.innerHTML = '';

        changes.forEach((change, index) => {
            console.log(`Change ${index + 1}:`, change);
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
        if (!this.currentResult) {
            alert('コピー可能なテキストがありません');
            return;
        }
        
        const correctedText = this.currentResult.proofreadResult.correctedText;
        
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
        document.getElementById('download-section').classList.add('hidden');
        document.getElementById('changes-list-area').classList.add('hidden');
    }

    showError(message) {
        alert(`エラー: ${message}`);
    }

    async downloadFile() {
        if (!this.currentFile || !this.currentResult) {
            alert('ダウンロード可能なファイルがありません');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', this.currentFile);
            formData.append('correctedText', this.currentResult.proofreadResult.correctedText);
            formData.append('originalText', this.currentResult.parseResult.text);
            formData.append('changes', JSON.stringify(this.currentResult.proofreadResult.changes));
            
            // 正しい日本語ファイル名を送信（文字化け対策）
            formData.append('originalFileName', this.currentFile.name);
            
            console.log('送信ファイル名:', this.currentFile.name);

            const button = document.getElementById('download-docx-btn');
            const originalText = button.innerHTML;
            const fileExtension = this.currentFile.name.toLowerCase().split('.').pop();
            const isOfficeFile = ['docx', 'xlsx'].includes(fileExtension);
            
            button.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>${isOfficeFile ? fileExtension.toUpperCase() : 'DOCX'}生成中...`;
            button.disabled = true;

            const response = await fetch(`${this.apiBaseUrl}/api/generate-docx`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('ダウンロードに失敗しました');
            }

            // ファイル名を取得（RFC 6266対応）
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = 'corrected_document.docx';
            
            console.log('Content-Disposition header:', contentDisposition);
            
            if (contentDisposition) {
                // RFC 6266 filename*=UTF-8''形式を優先
                const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]*)/);
                if (utf8Match) {
                    fileName = decodeURIComponent(utf8Match[1]);
                    console.log('UTF-8 filename extracted:', fileName);
                } else {
                    // フォールバック: 通常のfilename形式
                    const normalMatch = contentDisposition.match(/filename=['"]?([^;'"]*)/);
                    if (normalMatch) {
                        fileName = normalMatch[1];
                        console.log('Normal filename extracted:', fileName);
                    }
                }
            }
            
            console.log('Final filename for download:', fileName);

            // ファイルをダウンロード
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // ボタンを成功状態に
            button.innerHTML = '<i class="fas fa-check mr-2"></i>ダウンロード完了！';
            button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            button.classList.add('bg-green-600', 'hover:bg-green-700');
            
            setTimeout(() => {
                button.innerHTML = originalText;
                button.classList.remove('bg-green-600', 'hover:bg-green-700');
                button.classList.add('bg-blue-600', 'hover:bg-blue-700');
                button.disabled = false;
            }, 3000);

        } catch (error) {
            console.error('DOCX download error:', error);
            alert(`ダウンロードエラー: ${error.message}`);
            
            const button = document.getElementById('download-docx-btn');
            button.innerHTML = '<i class="fas fa-download mr-2"></i>元の形式でダウンロード (DOCX/XLSX)';
            button.disabled = false;
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// アプリケーション初期化
document.addEventListener('DOMContentLoaded', () => {
    new JapaneseProofreadingSystem();
});