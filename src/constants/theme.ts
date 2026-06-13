// デザイントークン・テーマ定数 (App.tsx 分割 Phase 1)
// 色・フォント・キーフレーム・ヒーロー表示時間。ロジック無改変で App.tsx から移動。

// ── 旧ブランドカラー (賑やか系 UI で使用) ──────────────────────────────
export const C = {
  orange: "#F5A94A", orangeLight: "#FAC97A", orangePale: "#FFF3E0",
  orangeDeep: "#E8903A", cream: "#FAFAF7", dark: "#1A1208",
  darkBrown: "#2D1F0A", warmGray: "#9E9B95", lightGray: "#F5F3F0",
  border: "#EDE9E3", white: "#FFFFFF", green: "#4CAF50",
  greenPale: "#E8F5E9", blue: "#2196F3", bluePale: "#E3F2FD",
  red: "#EF5350", redPale: "#FFEBEE",
};

// カテゴリ別の淡色背景
export const CAT_COLORS = { illust:"#FFF3E0", clothes:"#F3E5F5", photo:"#E3F2FD", goods:"#E8F5E9", food:"#FCE4EC", training:"#E0F7FA" };

// ── QC デザイントークン (静けさ Redesign / 新世界観) ──────────────────
export const QC = {
  warmWhite: '#FAF7F2',
  cream: '#F5EFE6',
  lightSand: '#EEE6D9',
  charcoal: '#2C2926',
  warmGray: '#6B6259',
  softBrown: '#8B6F5C',
  mutedGreen: '#7A8B6E',
  sage: '#A8B59E',
  terracotta: '#C97B5F',
};

export const QC_FONT_JP = '"Zen Kaku Gothic New", "LINE Seed JP", "Noto Sans JP", sans-serif';
export const QC_FONT_EN = '"Instrument Serif", "Manrope", serif';
// 依頼書 #134 Phase 2 案A改 Editorial Documentary (2026/6/6):
// 見出し・キャッチ用 / index.html で Shippori Mincho を Google Fonts 読込
// CSS変数 var(--qc-font-display) でも参照可能 (将来の再判断余地を残す構造)
export const QC_FONT_DISPLAY = '"Shippori Mincho", "Yu Mincho", "游明朝", serif';

// CSS keyframes（インライン用）- 静けさ Redesign 版
export const QC_KEYFRAMES = `
  @keyframes qocca-fadeInSlow {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes qocca-fadeInSlowUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes qocca-breathe-slow {
    0%, 100% { opacity: 0.2; transform: translateX(-50%) translateY(0); }
    50%      { opacity: 0.6; transform: translateX(-50%) translateY(4px); }
  }

  @keyframes qocca-ken-burns-1 {
    0%   { transform: scale(1.0) translate(0, 0); }
    100% { transform: scale(1.08) translate(-1%, -1%); }
  }

  @keyframes qocca-ken-burns-2 {
    0%   { transform: scale(1.05) translate(1%, 0); }
    100% { transform: scale(1.0) translate(0, -1%); }
  }

  @keyframes qocca-ken-burns-3 {
    0%   { transform: scale(1.0) translate(0, 1%); }
    100% { transform: scale(1.08) translate(1%, 0); }
  }
`;

// 各画像の表示時間（秒）- display_priority 1〜7 に対応
// 静けさ Redesign: 各 +40% で時間をゆっくり流す
export const QC_HERO_DURATIONS = [14, 10, 10, 10, 10, 10, 14];

// タイミング定数
export const QC_TIMING = {
  hoverDuration: '0.8s',
  hoverEasing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sectionFadeIn: '1.2s',
  sectionFadeInEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  heroCrossFade: 1500,
  pageTransition: '0.8s',
  buttonHover: '0.6s',
  microMotion: '1.0s',
  staggerDelay: 200,
};

export const QC_HERO_TRANSITION_MS = 1500;
export const QC_PC_BREAKPOINT = 768;
