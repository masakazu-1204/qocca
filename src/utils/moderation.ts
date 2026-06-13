// モデレーション・決済防御ユーティリティ (App.tsx 分割 Phase 1 ④)
// ⚠️ 決済防御 (v29/v30/v31) の心臓部。ロジックは1文字も改変せず App.tsx から移動。
//   - detectContacts: 連絡先(電話/メール/URL/SNS等)検知＋マスク → サイト外取引防止
//   - detectNGWords: 誹謗中傷・喧嘩ワード検知
//   - checkFacilityNGWords: 施設レビューの名誉毀損リスクワード検知
// 参照する辞書定数 (CONTACT_PATTERNS/NG_WORDS/FACILITY_NG_WORDS) は constants/data.ts に在る。

import { CONTACT_PATTERNS, NG_WORDS, FACILITY_NG_WORDS } from "../constants/data";

export const detectContacts = (text:string): { found: boolean; types: string[]; masked: string } => {
  const types: string[] = [];
  let masked = text;
  for (const { regex, label } of CONTACT_PATTERNS) {
    const newRegex = new RegExp(regex.source, regex.flags);
    if (newRegex.test(text)) {
      if (!types.includes(label)) types.push(label);
      const replaceRegex = new RegExp(regex.source, regex.flags);
      masked = masked.replace(replaceRegex, "***");
    }
  }
  return { found: types.length > 0, types, masked };
};

export const detectNGWords = (text:string): { found: boolean; words: string[] } => {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const ng of NG_WORDS) {
    if (lower.includes(ng.toLowerCase()) && !found.includes(ng)) {
      found.push(ng);
    }
  }
  return { found: found.length > 0, words: found };
};

// NGワードチェック関数
export const checkFacilityNGWords = (text) => {
  if (!text) return null;
  for (const word of FACILITY_NG_WORDS) {
    if (text.includes(word)) return word;
  }
  return null;
};
