// ペットウォーカー 新スポットを JSON から一括登録する (2026/10/21)
//   入力は調査結果の JSON (name, category, pref, city, address, description, evidence_url, evidence_type, conditions, latitude, longitude)。
//   source_note は「ペット可根拠: <URL> (<種別>) | 条件: <条件>」で組み立てる。image_urls は空で入れ、画像は別途配線。
// 実行: node scripts/insert-petwalker-spots.mjs <items.json> <area_tag> [--dry-run]
// 鍵: scripts/.sbkey.local (gitignore 済・チャットに貼らない)
import { readFile } from "node:fs/promises";
const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SB_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry-run");
const [file, areaTag] = args;
if (!file || !areaTag) { console.error("使い方: node scripts/insert-petwalker-spots.mjs <items.json> <area_tag> [--dry-run]"); process.exit(1); }
if (!SB_KEY) { console.error("scripts/.sbkey.local が見つかりません"); process.exit(1); }
const label = { facility_official: "施設公式", municipal_official: "自治体公式", tourism_association: "観光協会・観光局公式", honda_dog: "Honda Dog", pet_guide: "ペット旅行ガイド施設ページ" };
const items = JSON.parse(await readFile(file, "utf8"));
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// 同じエリアに同名があれば入れない (二重登録防止)
const exRes = await fetch(`${SB_URL}/rest/v1/pet_walker_spots?select=name&area_tag=eq.${encodeURIComponent(areaTag)}`, { headers: H });
const existing = new Set((await exRes.json()).map((r) => r.name));
const rows = items.filter((it) => !existing.has(it.name)).map((it) => {
  if (!["spot", "cafe", "hotel"].includes(it.category)) throw new Error(`category NG: ${it.name}`);
  return {
    name: it.name, category: it.category, pref: it.pref, city: it.city || null, pet_types: ["dog"],
    description: it.description, area_tag: areaTag,
    source_note: `ペット可根拠: ${it.evidence_url} (${label[it.evidence_type] || it.evidence_type}) | 条件: ${it.conditions}`,
    latitude: typeof it.latitude === "number" ? it.latitude : null,
    longitude: typeof it.longitude === "number" ? it.longitude : null,
    address: it.address || null, approval_status: "approved", image_urls: [],
  };
});
console.log(`${areaTag}: 入力 ${items.length} / 既存と同名で除外 ${items.length - rows.length} / 登録 ${rows.length}${DRY ? " (dry-run)" : ""}`);
if (!DRY && rows.length > 0) {
  const res = await fetch(`${SB_URL}/rest/v1/pet_walker_spots?select=id,name`, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(rows) });
  if (!res.ok) { console.error(`NG ${res.status}: ${(await res.text()).slice(0, 400)}`); process.exitCode = 1; }
  else console.log(`登録 ${(await res.json()).length} 件`);
}
// ⚠️ Windows の Node は通信直後の process.exit で libuv が落ちるので、exit せず自然終了させる
