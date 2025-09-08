import JSZip from 'jszip';

export class DocumentParser {
  
  /**
   * バッファからテキストを抽出
   * @param {Buffer} buffer ファイルバッファ
   * @param {string} fileName ファイル名
   * @param {string} mimeType MIMEタイプ
   * @returns {Promise<Object>} 抽出結果
   */
  async parseBuffer(buffer, fileName, mimeType) {
    const fileSize = buffer.length;
    const extractedAt = new Date().toISOString();

    try {
      // ファイルサイズチェック（10MB制限）
      if (fileSize > 10 * 1024 * 1024) {
        throw new Error('ファイルサイズが10MBを超えています');
      }

      // ファイル拡張子を取得（MIMEタイプが不正確な場合の対応）
      const extension = fileName.toLowerCase().split('.').pop() || '';

      // MIMEタイプまたは拡張子による判定
      const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                     mimeType === 'application/octet-stream' && extension === 'docx';
      const isXlsx = mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                     mimeType === 'application/octet-stream' && extension === 'xlsx';
      const isText = mimeType === 'text/plain' || extension === 'txt';
      const isCsv = mimeType === 'text/csv' || extension === 'csv';
      
      console.log('=== ファイル解析判定 ===');
      console.log('ファイル名:', fileName);
      console.log('MIMEタイプ:', mimeType);
      console.log('拡張子:', extension);
      console.log('判定結果:', { isDocx, isXlsx, isText, isCsv });

      let extractedText = '';
      let metadata = {};

      if (isDocx) {
        const result = await this.parseDocx(buffer);
        extractedText = result.text;
        metadata = result.metadata;
      } else if (isXlsx) {
        const result = await this.parseXlsx(buffer);
        extractedText = result.text;
        metadata = result.metadata;
      } else if (isText || isCsv) {
        extractedText = await this.parseText(buffer);
      } else {
        throw new Error(`サポートされていないファイル形式です: ${mimeType} (.${extension})`);
      }

      return {
        text: extractedText,
        fileName,
        fileType: mimeType,
        fileSize,
        extractedAt,
        metadata,
        success: true
      };

    } catch (error) {
      console.error('ファイル解析エラー:', error);
      return {
        text: '',
        fileName,
        fileType: mimeType,
        fileSize,
        extractedAt,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * DOCXファイルの解析
   */
  async parseDocx(buffer) {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(buffer);
      
      // document.xmlからテキストを抽出
      const documentXml = await zipContent.file('word/document.xml')?.async('text');
      if (!documentXml) {
        throw new Error('document.xmlが見つかりません');
      }

      // XMLからテキストを抽出（表構造も保持）
      const textWithTables = this.extractTextWithTables(documentXml);
      
      // メタデータ解析
      const metadata = await this.extractDocxMetadata(zipContent);

      return {
        text: textWithTables,
        metadata
      };
    } catch (error) {
      throw new Error(`DOCXファイルの解析に失敗しました: ${error.message}`);
    }
  }

  /**
   * XMLからテキストと表構造を抽出（フォーマット保持）
   */
  extractTextWithTables(xml) {
    let result = '';
    
    // 表の解析
    const tableMatches = xml.match(/<w:tbl[^>]*>.*?<\/w:tbl>/gs) || [];
    let processedXml = xml;
    
    tableMatches.forEach((tableXml, index) => {
      const tableText = this.parseTableStructure(tableXml);
      // 表を一時的なプレースホルダーに置換
      processedXml = processedXml.replace(tableXml, `__TABLE_${index}__`);
      // 後で復元するために記録
      processedXml += `<!-- TABLE_${index}: ${tableText.replace(/\n/g, '\\n')} -->`;
    });

    // 通常のテキストを抽出
    let text = processedXml.replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ')
                          .trim();

    // 表のプレースホルダーを復元
    tableMatches.forEach((tableXml, index) => {
      const tableText = this.parseTableStructure(tableXml);
      text = text.replace(`__TABLE_${index}__`, `\\n\\n${tableText}\\n\\n`);
    });

    return text.replace(/\\n/g, '\\n');
  }

  /**
   * 表構造の解析
   */
  parseTableStructure(tableXml) {
    const rows = tableXml.match(/<w:tr[^>]*>.*?<\/w:tr>/gs) || [];
    let tableText = '';
    
    rows.forEach(rowXml => {
      const cells = rowXml.match(/<w:tc[^>]*>.*?<\/w:tc>/gs) || [];
      const rowData = cells.map(cellXml => {
        return cellXml.replace(/<[^>]+>/g, ' ')
                      .replace(/\s+/g, ' ')
                      .trim();
      });
      
      if (rowData.length > 0) {
        tableText += rowData.join('\\t') + '\\n';
      }
    });
    
    return tableText;
  }

  /**
   * DOCXメタデータ抽出
   */
  async extractDocxMetadata(zipContent) {
    const metadata = {
      tables: 0,
      paragraphs: 0,
      characters: 0
    };

    try {
      const documentXml = await zipContent.file('word/document.xml')?.async('text');
      if (documentXml) {
        // 表の数
        metadata.tables = (documentXml.match(/<w:tbl[^>]*>/g) || []).length;
        // 段落の数
        metadata.paragraphs = (documentXml.match(/<w:p[^>]*>/g) || []).length;
      }
    } catch (error) {
      console.warn('メタデータ取得エラー:', error);
    }

    return metadata;
  }

  /**
   * XLSXファイルの解析
   */
  async parseXlsx(buffer) {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(buffer);
      
      // shared strings を読み込み
      const sharedStringsXml = await zipContent.file('xl/sharedStrings.xml')?.async('text');
      const sharedStrings = this.parseSharedStrings(sharedStringsXml);
      
      // ワークシートデータを読み込み
      let allText = '';
      const sheets = Object.keys(zipContent.files).filter(name => 
        name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml')
      );
      
      for (const sheetPath of sheets) {
        const sheetXml = await zipContent.file(sheetPath)?.async('text');
        if (sheetXml) {
          const sheetText = this.parseWorksheet(sheetXml, sharedStrings);
          allText += sheetText + '\\n\\n';
        }
      }
      
      return {
        text: allText.trim(),
        metadata: {
          sheets: sheets.length
        }
      };
    } catch (error) {
      throw new Error(`XLSXファイルの解析に失敗しました: ${error.message}`);
    }
  }

  /**
   * Shared Stringsの解析
   */
  parseSharedStrings(xml) {
    if (!xml) return [];
    
    const strings = [];
    const matches = xml.match(/<si[^>]*>.*?<\/si>/gs) || [];
    
    matches.forEach(match => {
      const text = match.replace(/<[^>]+>/g, '').trim();
      strings.push(text);
    });
    
    return strings;
  }

  /**
   * ワークシートの解析
   */
  parseWorksheet(xml, sharedStrings) {
    const cells = xml.match(/<c[^>]*>.*?<\/c>/gs) || [];
    const rows = {};
    
    cells.forEach(cellXml => {
      const rMatch = cellXml.match(/r="([A-Z]+\d+)"/);
      const tMatch = cellXml.match(/t="([^"]+)"/);
      const vMatch = cellXml.match(/<v[^>]*>([^<]+)<\/v>/);
      
      if (rMatch && vMatch) {
        const cellRef = rMatch[1];
        const cellType = tMatch ? tMatch[1] : '';
        let cellValue = vMatch[1];
        
        // 共有文字列の参照の場合
        if (cellType === 's') {
          const index = parseInt(cellValue, 10);
          cellValue = sharedStrings[index] || '';
        }
        
        // 行番号を抽出
        const rowNum = parseInt(cellRef.match(/\d+/)[0], 10);
        if (!rows[rowNum]) rows[rowNum] = {};
        
        // 列位置を抽出
        const col = cellRef.match(/[A-Z]+/)[0];
        rows[rowNum][col] = cellValue;
      }
    });
    
    // 行を順序よく並べる
    let result = '';
    const sortedRowNums = Object.keys(rows).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    
    sortedRowNums.forEach(rowNum => {
      const row = rows[rowNum];
      const sortedCols = Object.keys(row).sort();
      const values = sortedCols.map(col => row[col]).filter(val => val);
      
      if (values.length > 0) {
        result += values.join('\\t') + '\\n';
      }
    });
    
    return result;
  }

  /**
   * テキストファイルの解析
   */
  async parseText(buffer) {
    // マルチエンコーディング対応
    const encodings = ['utf8', 'shift_jis', 'euc-jp'];
    
    for (const encoding of encodings) {
      try {
        if (encoding === 'utf8') {
          return buffer.toString('utf8');
        } else {
          // Node.jsでは iconv-lite が必要だが、基本的にUTF-8で処理
          return buffer.toString('utf8');
        }
      } catch (error) {
        continue;
      }
    }
    
    // フォールバック
    return buffer.toString('utf8');
  }
}