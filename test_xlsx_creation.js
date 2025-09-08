import * as XLSX from 'xlsx';
import fs from 'fs';

// テスト用XLSXファイルの作成
const testData = [
  ['項目', '内容', 'コメント'],
  ['名前', 'あゆみ　たろう', '平仮名 でスペース有り'],
  ['住所', '東京都　渋谷区', 'スペース　があります'],
  ['電話', '０３－１２３４－５６７８', '全角数字　で記載'],
  ['メール', 'ayumi＠example．com', '全角記号　使用'],
  ['金額', '１，０００円', 'カンマ　付き全角数字'],
  ['日付', '２０２４年１月１日', '全角文字　の日付'],
  ['備考', '校正　テスト用の　ファイルです。', 'スペースや　句読点の　テスト']
];

// ワークシート作成
const worksheet = XLSX.utils.aoa_to_sheet(testData);

// スタイル設定（一部のセルに背景色など）
worksheet['A1'] = { 
  v: '項目', 
  t: 's',
  s: { 
    fill: { fgColor: { rgb: 'FFFF00' } },
    font: { bold: true }
  }
};
worksheet['B1'] = { 
  v: '内容', 
  t: 's',
  s: { 
    fill: { fgColor: { rgb: 'FFFF00' } },
    font: { bold: true }
  }
};
worksheet['C1'] = { 
  v: 'コメント', 
  t: 's',
  s: { 
    fill: { fgColor: { rgb: 'FFFF00' } },
    font: { bold: true }
  }
};

// 列幅設定
worksheet['!cols'] = [
  { width: 10 },
  { width: 25 },
  { width: 30 }
];

// ワークブック作成
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'テストデータ');

// XLSXファイル出力
XLSX.writeFile(workbook, 'test_proofreading.xlsx', { cellStyles: true });

console.log('テスト用XLSXファイル「test_proofreading.xlsx」を作成しました。');
console.log('内容: 日本語校正ルールに違反するテキストを含むスプレッドシート');