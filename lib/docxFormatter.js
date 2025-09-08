import JSZip from 'jszip';
import fs from 'fs';

export class DOCXFormatter {
  
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
   * XMLに校正結果を適用
   */
  async applyCorrectionToXml(xml, originalText, correctedText, changes) {
    try {
      // 変更マップを作成（位置ベースではなくテキストベース）
      const changeMap = new Map();
      changes.forEach(change => {
        changeMap.set(change.original, change.corrected);
      });

      // XMLの<w:t>タグ内のテキストを校正
      let correctedXml = xml;

      // <w:t>タグを抽出して校正
      const textTagRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      
      correctedXml = correctedXml.replace(textTagRegex, (match, textContent) => {
        let correctedContent = textContent;
        
        // 各変更を適用
        changeMap.forEach((corrected, original) => {
          const regex = new RegExp(this.escapeRegExp(original), 'g');
          correctedContent = correctedContent.replace(regex, corrected);
        });

        return match.replace(textContent, correctedContent);
      });

      return correctedXml;

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
   * 正規表現エスケープ
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
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