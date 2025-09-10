import JSZip from 'jszip';
import fs from 'fs';
import * as XLSX from 'xlsx';

export class DocumentFormatter {
  
  /**
   * ファイル形式に応じて校正済みファイルを生成
   * @param {Buffer} originalBuffer 元のファイル
   * @param {string} originalText 元のテキスト
   * @param {string} correctedText 校正後のテキスト
   * @param {Array} changes 変更箇所一覧
   * @param {string} fileExtension ファイル拡張子
   * @returns {Promise<Buffer>} 校正後のファイル
   */
  async generateCorrectedFile(originalBuffer, originalText, correctedText, changes, fileExtension) {
    if (fileExtension === 'docx') {
      return await this.generateCorrectedDocx(originalBuffer, originalText, correctedText, changes);
    } else if (fileExtension === 'xlsx') {
      return await this.generateCorrectedXlsx(originalBuffer, originalText, correctedText, changes);
    } else {
      throw new Error(`サポートされていないファイル形式です: ${fileExtension}`);
    }
  }

  /**
   * DOCXファイルの構造を保持して校正テキストを適用
   * @param {Buffer} originalBuffer 元のDOCXファイル
   * @param {string} originalText 元のテキスト
   * @param {string} correctedText 校正後のテキスト
   * @param {Array} changes 変更箇所一覧
   * @returns {Promise<Buffer>} 校正後のDOCXファイル
   */
  async generateCorrectedDocx(originalBuffer, originalText, correctedText, changes) {
    try {
      // 元のDOCXファイルを解析
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(originalBuffer);
      
      // document.xmlを取得
      const documentXml = await zipContent.file('word/document.xml')?.async('text');
      if (!documentXml) {
        throw new Error('document.xmlが見つかりません');
      }

      // XMLに校正テキストを適用
      const correctedXml = await this.applyCorrectionToXml(
        documentXml, 
        originalText, 
        correctedText, 
        changes
      );

      // 新しいdocument.xmlを設定
      zipContent.file('word/document.xml', correctedXml);

      // 校正後のDOCXファイルを生成
      const correctedBuffer = await zipContent.generateAsync({ 
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      return correctedBuffer;

    } catch (error) {
      console.error('DOCX生成エラー:', error);
      throw new Error(`DOCX生成に失敗しました: ${error.message}`);
    }
  }

  /**
   * XMLに校正結果を適用（全文置換方式）
   */
  async applyCorrectionToXml(xml, originalText, correctedText, changes) {
    try {
      console.log('=== XML校正適用開始 ===');
      console.log('元テキスト:', originalText);
      console.log('校正後テキスト:', correctedText);
      console.log('変更一覧:', changes);

      // 元のXMLから全テキストを抽出
      const textTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let extractedText = '';
      let matches = [];
      let match;
      
      while ((match = textTagRegex.exec(xml)) !== null) {
        extractedText += match[1];
        matches.push({
          fullMatch: match[0],
          textContent: match[1],
          startIndex: match.index
        });
      }

      console.log('XMLから抽出されたテキスト:', extractedText);

      // 抽出されたテキストが元テキストと一致するか確認
      if (extractedText.trim() === originalText.trim()) {
        console.log('テキストが一致 - 全文置換を実行');
        
        // 校正後テキストを使って全体を置換
        let correctedXml = xml;
        const fullTextRegex = new RegExp(this.escapeRegExp(extractedText), 'g');
        
        // XMLから全テキストを校正後テキストに置換
        // ただし、XMLタグ構造は保持する必要があるため、段階的に置換
        let correctedTextIndex = 0;
        
        correctedXml = correctedXml.replace(textTagRegex, (match, textContent) => {
          const originalLength = textContent.length;
          const replacementText = correctedText.substr(correctedTextIndex, originalLength) || '';
          correctedTextIndex += originalLength;
          
          return match.replace(textContent, replacementText);
        });

        // 残りの校正テキストがある場合は、最後のタグに追加
        if (correctedTextIndex < correctedText.length) {
          const remainingText = correctedText.substr(correctedTextIndex);
          const lastTagRegex = /(<w:t[^>]*>)([^<]*)(<\/w:t>)(?![\s\S]*<w:t)/;
          correctedXml = correctedXml.replace(lastTagRegex, `$1$2${remainingText}$3`);
        }

        console.log('XML校正完了');
        return correctedXml;
      } else {
        console.log('テキスト不一致 - 変更ベース適用');
        
        // フォールバック: 個別変更適用
        const changeMap = new Map();
        changes.forEach(change => {
          changeMap.set(change.original, change.corrected);
        });

        let correctedXml = xml;
        correctedXml = correctedXml.replace(textTagRegex, (match, textContent) => {
          let correctedContent = textContent;
          
          changeMap.forEach((corrected, original) => {
            const regex = new RegExp(this.escapeRegExp(original), 'g');
            correctedContent = correctedContent.replace(regex, corrected);
          });

          return match.replace(textContent, correctedContent);
        });

        return correctedXml;
      }

    } catch (error) {
      console.error('XML校正適用エラー:', error);
      throw error;
    }
  }

  /**
   * より高度なDOCX生成（docxライブラリ使用）
   */
  async generateDocxFromStructuredText(text, metadata = {}) {
    try {
      // docxライブラリをdynamic importで使用
      const { Document, Paragraph, TextRun, Table, TableRow, TableCell, Packer } = await import('docx');

      // テキストを段落と表に分解
      const elements = this.parseStructuredText(text);
      
      const children = [];

      elements.forEach(element => {
        if (element.type === 'paragraph') {
          children.push(new Paragraph({
            children: [new TextRun(element.content)]
          }));
        } else if (element.type === 'table') {
          const tableRows = element.rows.map(row => 
            new TableRow({
              children: row.cells.map(cell => 
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun(cell)]
                  })]
                })
              )
            })
          );

          children.push(new Table({
            rows: tableRows
          }));
        }
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      return await Packer.toBuffer(doc);

    } catch (error) {
      console.error('構造化DOCX生成エラー:', error);
      throw error;
    }
  }

  /**
   * 構造化テキストの解析
   */
  parseStructuredText(text) {
    const elements = [];
    const lines = text.split('\\n');
    let currentTable = null;

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;

      // 表形式の判定（タブ区切り）
      if (line.includes('\\t')) {
        const cells = line.split('\\t').filter(cell => cell.trim());
        
        if (!currentTable) {
          currentTable = {
            type: 'table',
            rows: []
          };
        }
        
        currentTable.rows.push({ cells });
      } else {
        // 表が終了
        if (currentTable) {
          elements.push(currentTable);
          currentTable = null;
        }

        // 通常の段落
        elements.push({
          type: 'paragraph',
          content: line
        });
      }
    });

    // 最後に表が残っている場合
    if (currentTable) {
      elements.push(currentTable);
    }

    return elements;
  }

  /**
   * XLSXファイルの体裁を保持して校正テキストを適用
   * @param {Buffer} originalBuffer 元のXLSXファイル
   * @param {string} originalText 元のテキスト
   * @param {string} correctedText 校正後のテキスト
   * @param {Array} changes 変更箇所一覧
   * @returns {Promise<Buffer>} 校正後のXLSXファイル
   */
  async generateCorrectedXlsx(originalBuffer, originalText, correctedText, changes) {
    try {
      // 変更マップを作成
      const changeMap = new Map();
      changes.forEach(change => {
        changeMap.set(change.original, change.corrected);
      });

      // 元のXLSXワークブックを読み込み（書式保持）
      const workbook = XLSX.read(originalBuffer, { 
        type: 'buffer', 
        cellStyles: true,
        cellHTML: false,
        cellNF: false,
        cellDates: true
      });
      
      console.log('XLSX処理開始:', {
        sheetCount: workbook.SheetNames.length,
        changeCount: changes.length
      });

      // 各シートのセルに校正を適用
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        let cellsProcessed = 0;
        
        // シート内の各セルを処理
        Object.keys(worksheet).forEach(cellAddress => {
          if (cellAddress.startsWith('!')) return; // メタデータセルはスキップ
          
          const cell = worksheet[cellAddress];
          if (cell && cell.t === 's' && cell.v) { // 文字列セルのみ処理
            let cellValue = cell.v.toString();
            let hasChanged = false;
            
            // 校正を適用
            changeMap.forEach((corrected, original) => {
              const regex = new RegExp(this.escapeRegExp(original), 'g');
              const newValue = cellValue.replace(regex, corrected);
              if (newValue !== cellValue) {
                cellValue = newValue;
                hasChanged = true;
              }
            });
            
            // セルの値を更新（書式は保持）
            if (hasChanged) {
              cell.v = cellValue;
              cell.w = cellValue; // 表示値も更新
              cellsProcessed++;
            }
          }
        });
        
        console.log(`シート「${sheetName}」: ${cellsProcessed}個のセルを校正`);
      });

      // XLSXファイルとして出力（書式保持）
      const correctedBuffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        cellStyles: true,
        sheetStubs: false
      });

      return correctedBuffer;

    } catch (error) {
      console.error('XLSX生成エラー:', error);
      throw new Error(`XLSX生成に失敗しました: ${error.message}`);
    }
  }

  /**
   * シンプルなXLSX生成（テキストから）
   */
  async generateSimpleXlsx(text, fileName = 'corrected_document.xlsx') {
    try {
      // テキストを行ごとに分割してシートに配置
      const lines = text.split('\\n').filter(line => line.trim());
      const worksheetData = [];
      
      lines.forEach((line, index) => {
        // タブ区切りの場合は列に分ける
        if (line.includes('\\t')) {
          worksheetData.push(line.split('\\t'));
        } else {
          worksheetData.push([line]);
        }
      });

      // ワークシート作成
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      
      // ワークブック作成
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '校正済み');

      // XLSXファイルとして出力
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    } catch (error) {
      console.error('シンプルXLSX生成エラー:', error);
      throw error;
    }
  }

  /**
   * 正規表現エスケープ
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  }

  /**
   * ファイル形式に応じて校正済みファイルを生成（統合メソッド）
   * @param {Buffer} originalBuffer 元のファイル
   * @param {string} originalText 元のテキスト
   * @param {string} correctedText 校正後のテキスト
   * @param {Array} changes 変更箇所一覧
   * @param {string} extension ファイル拡張子
   * @returns {Promise<Buffer>} 校正後のファイル
   */
  async generateCorrectedFile(originalBuffer, originalText, correctedText, changes, extension) {
    try {
      console.log(`校正ファイル生成開始 (形式: ${extension})`);
      
      if (extension === 'xlsx') {
        return await this.generateCorrectedXlsx(originalBuffer, originalText, correctedText, changes);
      } else if (extension === 'docx') {
        return await this.generateCorrectedDocx(originalBuffer, originalText, correctedText, changes);
      } else {
        // その他の形式は新規DOCXとして生成
        return await this.generateSimpleDocx(correctedText);
      }
    } catch (error) {
      console.error(`校正ファイル生成エラー (${extension}):`, error);
      throw new Error(`校正ファイル生成に失敗しました: ${error.message}`);
    }
  }

  /**
   * シンプルなテキストベースDOCX生成
   */
  async generateSimpleDocx(text, fileName = 'corrected_document.docx') {
    try {
      const { Document, Paragraph, TextRun, Packer } = await import('docx');

      const paragraphs = text.split('\\n\\n').filter(p => p.trim()).map(paragraph => 
        new Paragraph({
          children: [new TextRun(paragraph.trim())]
        })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });

      return await Packer.toBuffer(doc);

    } catch (error) {
      console.error('シンプルDOCX生成エラー:', error);
      throw error;
    }
  }
}