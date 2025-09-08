// XLSX校正テスト
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const testXlsxProofreading = async () => {
    const baseUrl = 'http://localhost:3000';
    
    console.log('=== XLSX校正テスト開始 ===');
    
    try {
        // 1. ファイル解析テスト
        console.log('1. XLSXファイル解析テスト...');
        const formData = new FormData();
        formData.append('file', fs.createReadStream('test_proofreading.xlsx'));
        
        const parseResponse = await fetch(`${baseUrl}/api/parse`, {
            method: 'POST',
            body: formData
        });
        
        const parseResult = await parseResponse.json();
        console.log('解析結果:', {
            success: parseResult.success,
            textLength: parseResult.text?.length || 0,
            fileName: parseResult.fileName,
            metadata: parseResult.metadata
        });
        
        if (!parseResult.success) {
            throw new Error('ファイル解析失敗: ' + parseResult.error);
        }
        
        // 2. 校正処理テスト
        console.log('\\n2. 校正処理テスト...');
        const proofreadResponse = await fetch(`${baseUrl}/api/proofread`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: parseResult.text })
        });
        
        const proofreadResult = await proofreadResponse.json();
        console.log('校正結果:', {
            success: proofreadResult.success,
            totalChanges: proofreadResult.result?.totalChanges || 0,
            changesFound: proofreadResult.result?.changes.length || 0
        });
        
        if (proofreadResult.success && proofreadResult.result.changes.length > 0) {
            console.log('\\n発見された修正:', proofreadResult.result.changes.slice(0, 3).map((c, i) => 
                `${i + 1}. "${c.original}" → "${c.corrected}" (${c.rule.category})`
            ).join('\\n'));
        }
        
        // 3. XLSX生成テスト
        console.log('\\n3. XLSX体裁保持生成テスト...');
        const xlsxFormData = new FormData();
        xlsxFormData.append('file', fs.createReadStream('test_proofreading.xlsx'));
        xlsxFormData.append('correctedText', proofreadResult.result.correctedText);
        xlsxFormData.append('originalText', parseResult.text);
        xlsxFormData.append('changes', JSON.stringify(proofreadResult.result.changes));
        
        const xlsxResponse = await fetch(`${baseUrl}/api/generate-docx`, {
            method: 'POST',
            body: xlsxFormData
        });
        
        if (xlsxResponse.ok) {
            const buffer = await xlsxResponse.arrayBuffer();
            fs.writeFileSync('test_corrected.xlsx', Buffer.from(buffer));
            console.log('校正済みXLSXファイル生成成功: test_corrected.xlsx');
            console.log('ファイルサイズ:', buffer.byteLength, 'bytes');
            
            // Content-Disposition ヘッダーチェック
            const contentDisposition = xlsxResponse.headers.get('Content-Disposition');
            console.log('Content-Disposition:', contentDisposition);
        } else {
            throw new Error('XLSX生成失敗: ' + xlsxResponse.status);
        }
        
        console.log('\\n✅ XLSX校正機能テスト完了！');
        
    } catch (error) {
        console.error('❌ テストエラー:', error);
        process.exit(1);
    }
};

testXlsxProofreading();