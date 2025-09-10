import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ProofreadingEngine {
  constructor() {
    this.rules = this.loadRules();
  }

  /**
   * 校正ルールの読み込み
   */
  loadRules() {
    try {
      const rulesPath = path.join(__dirname, '../data/ayumiRules.json');
      const rulesData = fs.readFileSync(rulesPath, 'utf8');
      const parsed = JSON.parse(rulesData);
      return parsed.rules;
    } catch (error) {
      console.error('校正ルールの読み込みに失敗しました:', error);
      return [];
    }
  }

  /**
   * 文章を推敲する
   * @param {string} text 推敲対象の文章
   * @returns {Object} 推敲結果
   */
  proofread(text) {
    const originalText = text;
    let correctedText = text;
    const allChanges = [];

    // 各ルールを適用
    for (const rule of this.rules) {
      for (const incorrectForm of rule.incorrect) {
        // 実際に変更があるかチェック（同じ文字列の場合はスキップ）
        if (incorrectForm === rule.correct) {
          continue;
        }

        // パターンマッチングと置換
        const regex = new RegExp(this.escapeRegExp(incorrectForm), 'g');
        let match;

        // まず全てのマッチ位置を記録
        const matches = [];
        let regexMatch;
        while ((regexMatch = regex.exec(correctedText)) !== null) {
          matches.push({
            start: regexMatch.index,
            end: regexMatch.index + incorrectForm.length,
            text: regexMatch[0]
          });
          
          // 無限ループ防止
          if (regex.lastIndex === regexMatch.index) {
            regex.lastIndex++;
          }
        }

        // マッチがある場合、全て置換して変更履歴に追加
        if (matches.length > 0) {
          // 全置換を実行
          correctedText = correctedText.replace(new RegExp(this.escapeRegExp(incorrectForm), 'g'), rule.correct);
          
          // 各マッチを変更履歴に追加
          matches.forEach(matchInfo => {
            const change = {
              original: incorrectForm,
              corrected: rule.correct,
              position: {
                start: matchInfo.start,
                end: matchInfo.end
              },
              rule: rule
            };
            allChanges.push(change);
          });
        }
      }
    }

    // 変更位置の調整（後ろから順に処理して位置ずれを防ぐ）
    allChanges.sort((a, b) => b.position.start - a.position.start);

    const result = {
      originalText,
      correctedText,
      changes: allChanges,
      totalChanges: allChanges.length
    };

    console.log('校正処理完了:', {
      originalLength: originalText.length,
      correctedLength: correctedText.length,
      changesCount: allChanges.length,
      rules: this.rules.length
    });

    return result;
  }

  /**
   * 正規表現用のエスケープ処理
   * @param {string} string エスケープ対象文字列
   * @returns {string} エスケープ済み文字列
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  }

  /**
   * 校正ルール数を取得
   * @returns {number} ルール数
   */
  getRulesCount() {
    return this.rules.length;
  }

  /**
   * カテゴリ別ルール数を取得
   * @returns {Object} カテゴリ別ルール数
   */
  getRulesByCategory() {
    const categories = {};
    
    this.rules.forEach(rule => {
      if (!categories[rule.category]) {
        categories[rule.category] = 0;
      }
      categories[rule.category]++;
    });

    return categories;
  }
}