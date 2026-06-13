// 動物カテゴリ定数・表示ヘルパー (App.tsx 分割 Phase 1 a)
// 依頼書 #19 (5/27): 動物カテゴリ 16種拡張 共通定数
// Qocca ビジョン「動物を飼った時に当たり前のアプリ」体現
// クラスタ一括移動: evPet* → petLabel/petColor/petBg → PET_CAT_BY_ID → PET_CATEGORIES
// (依存チェーンが全て本ファイル内で完結するため循環import無し)。ロジック・参照名無改変。

// id (英) / label (日) / icon (emoji) / color (主色) / bg (背景色)
export const PET_CATEGORIES: Array<{ id: string; label: string; icon: string; color: string; bg: string }> = [
  { id: "dog",         label: "犬",         icon: "🐕", color: "#F5A94A", bg: "#FFF3E0" }, // orange
  { id: "cat",         label: "猫",         icon: "🐈", color: "#9C27B0", bg: "#F3E5F5" }, // purple
  { id: "rabbit",      label: "うさぎ",     icon: "🐰", color: "#EC407A", bg: "#FCE4EC" }, // pink
  { id: "hamster",     label: "ハムスター", icon: "🐹", color: "#FFA726", bg: "#FFF8E1" }, // amber
  { id: "guinea_pig",  label: "モルモット", icon: "🐭", color: "#A1887F", bg: "#EFEBE9" }, // brown
  { id: "ferret",      label: "フェレット", icon: "🦦", color: "#8D6E63", bg: "#EFEBE9" }, // brown
  { id: "chinchilla",  label: "チンチラ",   icon: "🐭", color: "#90A4AE", bg: "#ECEFF1" }, // bluegrey
  { id: "hedgehog",    label: "ハリネズミ", icon: "🦔", color: "#A1887F", bg: "#EFEBE9" }, // brown
  { id: "squirrel",    label: "リス",       icon: "🐿️", color: "#FF7043", bg: "#FBE9E7" }, // deeporange
  { id: "bird",        label: "鳥",         icon: "🐦", color: "#42A5F5", bg: "#E3F2FD" }, // blue (小鳥・インコ・オウム・文鳥等)
  { id: "reptile",     label: "爬虫類",     icon: "🦎", color: "#66BB6A", bg: "#E8F5E9" }, // green (カメ・ヘビ・トカゲ等)
  { id: "amphibian",   label: "両生類",     icon: "🐸", color: "#26A69A", bg: "#E0F2F1" }, // teal (カエル・サンショウウオ等)
  { id: "fish",        label: "魚",         icon: "🐠", color: "#29B6F6", bg: "#E1F5FE" }, // lightblue (金魚・熱帯魚・メダカ等)
  { id: "crustacean",  label: "甲殻類",     icon: "🦀", color: "#EF5350", bg: "#FFEBEE" }, // red (エビ・カニ等)
  { id: "insect",      label: "昆虫",       icon: "🐛", color: "#9CCC65", bg: "#F1F8E9" }, // lightgreen (カブトムシ・クワガタ等)
  { id: "other",       label: "その他",     icon: "🐾", color: "#9E9B95", bg: "#FAFAF7" }, // warmgray
];
export const PET_CAT_BY_ID: Record<string, typeof PET_CATEGORIES[number]> =
  Object.fromEntries(PET_CATEGORIES.map(c => [c.id, c]));
// ヘルパー (既存 dog/cat/both API 後方互換)
export const petLabel = (id: string): string => {
  if (id === "both") return "🐾 両方";
  const c = PET_CAT_BY_ID[id];
  return c ? `${c.icon} ${c.label}` : `🐾 ${id || "その他"}`;
};
export const petLabelShort = (id: string): string => {
  if (id === "both") return "両方";
  return PET_CAT_BY_ID[id]?.label || id || "その他";
};
export const petIcon = (id: string): string => {
  if (id === "both") return "🐾";
  return PET_CAT_BY_ID[id]?.icon || "🐾";
};
export const petColor = (id: string): string => {
  if (id === "both") return "#4CAF50";  // green
  return PET_CAT_BY_ID[id]?.color || "#9E9B95";
};
export const petBg = (id: string): string => {
  if (id === "both") return "#E8F5E9";  // greenpale
  return PET_CAT_BY_ID[id]?.bg || "#FAFAF7";
};
// 既存 API 後方互換 (event 系)
export const evPetLabel = (p: string) => p === "dog" ? "🐕 犬" : p === "cat" ? "🐈 猫" : p === "both" ? "🐾 両方" : petLabel(p);
export const evPetColor = (p: string) => p === "dog" ? "#F5A94A" : p === "cat" ? "#9C27B0" : p === "both" ? "#4CAF50" : petColor(p);
export const evPetBg = (p: string) => p === "dog" ? "#FFF3E0" : p === "cat" ? "#F3E5F5" : p === "both" ? "#E8F5E9" : petBg(p);
