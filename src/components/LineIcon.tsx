// src/components/LineIcon.tsx — 線画アイコン (2026/9/26)
//
// King「絵文字ダサい」(2026/9/26) を受けて、UI の絵文字をここの線画に置き換える。
// ホームの「できること」カードの線画と同じ作法: 24px グリッド・stroke 1.5・丸端・currentColor。
// 色は親の color を継ぐ (指定したいときは color prop)。塗りが要るもの (お気に入りの塗りハート等) は filled。
//
// 使い方:  <LineIcon name="paw" />   <LineIcon name="heart" size={16} filled />   <LineIcon name="warning" color="#C97B5F" />
// 絵文字 → 名前 の対応は下の EMOJI_TO_ICON。無い名前は "dot" (小さな丸) に落ちる。
//
// ⚠️ ペットの種類 (constants/pets.ts の 🐕🐈🐰…) はデータとして各所で使っているので、ここでは扱わない。

import type { ReactNode, CSSProperties } from "react";

const P: Record<string, ReactNode> = {
  // 街・案内
  home:        <><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></>,
  house:       <><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M10 20v-5h4v5" /></>,
  shop:        <><path d="M4 10V7l2-3h12l2 3v3" /><path d="M4 10c0 1.4 1.2 2.4 2.7 2.4S9.3 11.4 9.3 10c0 1.4 1.2 2.4 2.7 2.4s2.7-1 2.7-2.4c0 1.4 1.2 2.4 2.7 2.4S20 11.4 20 10" /><path d="M5 12.4V20h14v-7.6M10 20v-5h4v5" /></>,
  building:    <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" /></>,
  pin:         <><path d="M12 21s-6-5.2-6-10.5a6 6 0 0 1 12 0C18 15.8 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.3" /></>,
  map:         <><path d="M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2z" /><path d="M9 4v14M15 6v14" /></>,
  compass:     <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>,
  hospital:    <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M12 10v6M9 13h6M9 3h6v3H9z" /></>,
  truck:       <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  // 人・コミュニティ
  person:      <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
  people:      <><circle cx="9" cy="8" r="3.5" /><circle cx="17" cy="9.5" r="2.5" /><path d="M3 20c.8-3.5 3.2-5.5 6-5.5s5.2 2 6 5.5" /><path d="M15.5 15.5c2.3 0 4.3 1.5 5 4" /></>,
  chat:        <><path d="M9 4h9a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-3l-3 3v-3H9a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" /><circle cx="6.5" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></>,
  bubble:      <><path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4 3.5V16H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></>,
  crown:       <><path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z" /><path d="M4 18v2h16v-2" /></>,
  medal:       <><circle cx="12" cy="14" r="5" /><path d="M9 9.5L7 3h4l1 3 1-3h4l-2 6.5" /></>,
  // 作品・買い物
  palette:     <><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.8 2-1.8 0-.9-.7-1.2-.7-2.2 0-1 .8-1.8 1.9-1.8H17a4 4 0 0 0 4-4c0-4.7-4-8.2-9-8.2z" /><circle cx="7.5" cy="12" r="1" /><circle cx="9.5" cy="8" r="1" /><circle cx="14" cy="7.5" r="1" /></>,
  basket:      <><path d="M4 9h16l-1.4 9.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9z" /><path d="M8 9l3-5M16 9l-3-5" /><path d="M9 13v3M12 13v3M15 13v3" /></>,
  bag:         <><path d="M6 8h12l-1 12H7z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  cart:        <><path d="M3 4h2l2.4 11h10.4l2-7H7" /><circle cx="9" cy="19" r="1.5" /><circle cx="17" cy="19" r="1.5" /></>,
  box:         <><path d="M3 8l9-4 9 4v9l-9 4-9-4z" /><path d="M3 8l9 4 9-4M12 12v9" /></>,
  gift:        <><rect x="3" y="9" width="18" height="12" rx="1.5" /><path d="M3 13h18M12 9v12" /><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z" /></>,
  scissors:    <><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="6.5" cy="17.5" r="2.5" /><path d="M8.6 8.2L20 19M8.6 15.8L20 5" /></>,
  thread:      <><circle cx="12" cy="12" r="8" /><path d="M4.5 10c5 0 10 4 15 4M5 14c5 0 9-4 14-4" /></>,
  shirt:       <><path d="M8 4l4 2 4-2 4 3-2 3-2-1v11H8V9l-2 1-2-3z" /></>,
  camera:      <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 7l1.5-3h5L16 7" /><circle cx="12" cy="13.5" r="3.4" /></>,
  image:       <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></>,
  bone:        <><path d="M7 9.5a2.5 2.5 0 1 1 2.5-2.5v.5h5v-.5A2.5 2.5 0 1 1 17 9.5h-.5v5h.5a2.5 2.5 0 1 1-2.5 2.5v-.5h-5v.5A2.5 2.5 0 1 1 7 14.5h.5v-5z" /></>,
  paw:         <><ellipse cx="12" cy="15.5" rx="4.2" ry="3.4" /><circle cx="6.8" cy="10.5" r="1.7" /><circle cx="17.2" cy="10.5" r="1.7" /><circle cx="9.5" cy="6.8" r="1.7" /><circle cx="14.5" cy="6.8" r="1.7" /></>,
  dog:         <><path d="M6 9l-2-4 4 1M18 9l2-4-4 1" /><path d="M7 8h10l1 6c0 3-3 5-6 5s-6-2-6-5z" /><circle cx="10" cy="12" r=".9" /><circle cx="14" cy="12" r=".9" /><path d="M12 14.5c-1 0-1.5.6-1.5 1.2 0 .8.7 1.3 1.5 1.3s1.5-.5 1.5-1.3c0-.6-.5-1.2-1.5-1.2z" /></>,
  // 書く・記録
  pencil:      <><path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16z" /><path d="M13 7l4 4" /></>,
  note:        <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>,
  clipboard:   <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 10h6M9 14h6" /></>,
  book:        <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5V5.5M8 7h8M8 10.5h6" /></>,
  scroll:      <><path d="M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6" /><path d="M6 4a2 2 0 0 0-2 2v1h4V6a2 2 0 0 0-2-2zM6 20a2 2 0 0 1-2-2v-1h4v1a2 2 0 0 1-2 2zM10 9h5M10 13h5" /></>,
  chart:       <><path d="M4 20V4M4 20h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></>,
  save:        <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-6h8v6" /></>,
  upload:      <><path d="M12 16V5M7 10l5-5 5 5" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" /></>,
  link:        <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  // 連絡・通知
  mail:        <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 8l9 6 9-6" /></>,
  mailbox:     <><path d="M4 10a4 4 0 0 1 4-4h9a3 3 0 0 1 3 3v9H4z" /><path d="M8 6a4 4 0 0 1 4 4v8M20 18v3M9 10h3" /></>,
  phone:       <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></>,
  mobile:      <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.5h2" /></>,
  bell:        <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  headset:     <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19v1a2 2 0 0 1-2 2h-3" /></>,
  // 状態
  check:       <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16.5 9.5" /></>,
  close:       <><path d="M6 6l12 12M18 6L6 18" /></>,
  closeCircle: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  warning:     <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></>,
  alert:       <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.01" /></>,
  ban:         <><circle cx="12" cy="12" r="9" /><path d="M6 6l12 12" /></>,
  question:    <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4M12 17v.01" /></>,
  info:        <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></>,
  dot:         <><circle cx="12" cy="12" r="4" /></>,
  eye:         <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  cone:        <><path d="M9 4h6l4 14H5z" /><path d="M3 18h18M7.5 11h9" /></>,
  // お金・安全
  coin:        <><circle cx="12" cy="12" r="8" /><path d="M9 9.5h4.5a2 2 0 0 1 0 4H10.5a2 2 0 0 0 0 4H15M12 6v2M12 16v2" /></>,
  card:        <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  bank:        <><path d="M3 9l9-5 9 5H3z" /><path d="M5 9v8M10 9v8M14 9v8M19 9v8M3 20h18" /></>,
  lock:        <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  unlock:      <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>,
  key:         <><circle cx="8" cy="14" r="4" /><path d="M11 11l9-9M16 6l2 2M13 9l2 2" /></>,
  shield:      <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  scale:       <><path d="M12 4v16M4 20h16M6 8h12" /><path d="M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z" /></>,
  // 道具
  wrench:      <><path d="M14 4a5 5 0 0 0-6 6L4 14l3 3 4-4a5 5 0 0 0 6-6l-2.5 2.5-2-2z" /></>,
  tools:       <><path d="M14 4a5 5 0 0 0-6 6L4 14l3 3 4-4a5 5 0 0 0 6-6l-2.5 2.5-2-2z" /><path d="M15 15l4 4" /></>,
  settings:    <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>,
  trash:       <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  search:      <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.3-4.3" /></>,
  plus:        <><path d="M12 5v14M5 12h14" /></>,
  arrowRight:  <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  logout:      <><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4M18 12H9" /></>,
  laptop:      <><rect x="4" y="5" width="16" height="11" rx="1.5" /><path d="M2 19h20" /></>,
  bolt:        <><path d="M13 3L5 13h6l-1 8 8-10h-6z" /></>,
  target:      <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
  rocket:      <><path d="M12 3c3 2 5 6 5 10l-2 2h-6l-2-2c0-4 2-8 5-10z" /><path d="M9 15l-3 2 1-4M15 15l3 2-1-4M12 15v5" /></>,
  // 気持ち・自然・時間
  heart:       <><path d="M12 20s-7-4.4-7-9.5A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.5C19 15.6 12 20 12 20z" /></>,
  star:        <><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" /></>,
  sparkle:     <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>,
  bulb:        <><path d="M9 18h6M10 21h4" /><path d="M8 11a4 4 0 1 1 8 0c0 2-1.5 2.5-1.5 4h-5C9.5 13.5 8 13 8 11z" /></>,
  flower:      <><circle cx="12" cy="12" r="2.5" /><path d="M12 9.5V5a2 2 0 1 1 2 2M12 9.5V5a2 2 0 1 0-2 2M14.5 12H19a2 2 0 1 1-2 2M14.5 12H19a2 2 0 1 0-2-2M12 14.5V19a2 2 0 1 1-2-2M12 14.5V19a2 2 0 1 0 2-2M9.5 12H5a2 2 0 1 1 2-2M9.5 12H5a2 2 0 1 0 2 2" /></>,
  leaf:        <><path d="M5 19C5 10 11 5 20 5c0 9-5 15-14 14z" /><path d="M5 19c3-4 6-7 10-9" /></>,
  sprout:      <><path d="M12 21v-8" /><path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6z" /><path d="M12 13c0-3-2-5-5-5 0 3 2 5 5 5z" /></>,
  sun:         <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>,
  sunrise:     <><path d="M4 17h16M6 13a6 6 0 0 1 12 0" /><path d="M12 4v3M4.5 8.5L6.5 10M19.5 8.5L17.5 10M2 21h20" /></>,
  moon:        <><path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z" /></>,
  clock:       <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  calendar:    <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  bird:        <><path d="M4 12c3 0 5-1 7-4 1-1.5 2.5-2 4-2 2 0 4 1.5 5 3l-3 .5c0 4-3 7-8 7H6l3-3c-2 0-4-1-5-1.5z" /><circle cx="14.5" cy="8.5" r=".6" /></>,
  candle:      <><rect x="9" y="9" width="6" height="12" rx="1" /><path d="M12 9V6" /><path d="M12 3c-1 1-1.5 2-1.5 2.5a1.5 1.5 0 0 0 3 0C13.5 5 13 4 12 3z" /></>,
  infinity:    <><path d="M8 8.5c-2 0-3.5 1.5-3.5 3.5S6 15.5 8 15.5c3 0 5-7 8-7 2 0 3.5 1.5 3.5 3.5S18 15.5 16 15.5c-3 0-5-7-8-7z" /></>,
  rainbow:     <><path d="M3 17a9 9 0 0 1 18 0" /><path d="M6.5 17a5.5 5.5 0 0 1 11 0" /><path d="M10 17a2 2 0 0 1 4 0" /></>,
};

// 絵文字 → 線画名。ページの置き換え作業で参照する (コードには絵文字を残さない)。
export const EMOJI_TO_ICON: Record<string, string> = {
  "🐾": "paw", "⚠️": "warning", "⚠": "warning", "✅": "checkCircle", "✓": "check", "📝": "note", "💬": "bubble", "📦": "box",
  "🎨": "palette", "✕": "close", "❌": "closeCircle", "📍": "pin", "🔒": "lock", "🔓": "unlock", "💰": "coin", "📷": "camera",
  "📸": "camera", "🏠": "home", "🏡": "house", "🎁": "gift", "🌅": "sunrise", "🌆": "sunrise", "📅": "calendar", "✏️": "pencil",
  "✍️": "pencil", "📋": "clipboard", "❤️": "heart", "🤍": "heart", "💝": "heart", "💕": "heart", "💾": "save", "💡": "bulb",
  "🐕": "dog", "🐶": "dog", "🌸": "flower", "🌷": "flower", "🐦": "bird", "🔴": "dot", "🛒": "cart", "🧵": "thread", "📞": "phone",
  "🔗": "link", "📱": "mobile", "👥": "people", "★": "star", "☆": "star", "🌟": "star", "🚨": "alert", "🎯": "target", "🚧": "cone",
  "🗑️": "trash", "🗑": "trash", "🖼️": "image", "🖼": "image", "👑": "crown", "🏅": "medal", "🌈": "rainbow", "✨": "sparkle",
  "🎉": "sparkle", "🏦": "bank", "💳": "card", "💸": "coin", "⚡": "bolt", "📜": "scroll", "🔧": "wrench", "🛠": "tools",
  "✉️": "mail", "📧": "mail", "📮": "mailbox", "📭": "mailbox", "📬": "mailbox", "🔍": "search", "🔎": "search", "💻": "laptop",
  "🕐": "clock", "🌿": "leaf", "👤": "person", "🛍️": "bag", "🛍": "bag", "🔔": "bell", "🎧": "headset", "🗾": "map", "🗺️": "map",
  "📌": "pin", "📤": "upload", "🚀": "rocket", "📚": "book", "📔": "book", "🚚": "truck", "📊": "chart", "📈": "chart", "🍖": "bone",
  "🦴": "bone", "❓": "question", "👁": "eye", "👁️": "eye", "⚖️": "scale", "🏥": "hospital", "☀️": "sun", "🌙": "moon",
  "🕯": "candle", "🚪": "logout", "➕": "plus", "➡️": "arrowRight", "🛡️": "shield", "💭": "bubble", "🚫": "ban", "🏢": "building",
  "🏘": "house", "👕": "shirt", "🔑": "key", "♾": "infinity", "🎀": "gift", "🎂": "gift",
};

export const LineIcon = ({
  name, size = 20, color, filled = false, strokeWidth = 1.5, style,
}: { name: string; size?: number; color?: string; filled?: boolean; strokeWidth?: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"
    style={{ stroke: color ?? "currentColor", fill: filled ? (color ?? "currentColor") : "none", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0, ...style }}>
    {P[name] ?? P.dot}
  </svg>
);

export const LINE_ICON_NAMES = Object.keys(P);
