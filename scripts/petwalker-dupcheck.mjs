// ペットウォーカー: 最近登録したスポットを全国の既存スポットと突き合わせる (登録のたびに必ず流す)
// 実行: node scripts/petwalker-dupcheck.mjs <since>   例: 2026-10-21T00:00Z
//   since は UTC。created_at は UTC で入っているので、JST の日付で切ると取りこぼす。
// insert-petwalker-spots.mjs は「同じエリア内の同名」しか除外しないので、エリアをまたぐ重複はここで見つける。
// 判定: 名前の包含 (4 文字以上) か 住所の一致。商業施設とその中の店舗は別スポットなので、出てきても残してよい。
import { readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SB_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const since = process.argv[2];
if (!since) { console.error("使い方: node scripts/petwalker-dupcheck.mjs <since UTC>"); process.exit(1); }

let all = [];
for (let o = 0; ; o += 1000) {
  const r = await fetch(`${SB_URL}/rest/v1/pet_walker_spots?select=id,name,area_tag,address,created_at&order=id`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${o}-${o + 999}` },
  });
  const d = await r.json(); all = all.concat(d); if (d.length < 1000) break;
}
const norm = (s) => (s || "").replace(/[\s　()（）「」・\-ー〜~]/g, "").toLowerCase();
const addr = (s) => norm(s).replace(/番地|番|号/g, "-");
const fresh = all.filter((x) => x.created_at >= since);
const seen = new Set(); let n = 0;
for (const t of fresh) for (const o of all) {
  if (o.id === t.id) continue;
  const k = [t.id, o.id].sort().join(); if (seen.has(k)) continue;
  const a = norm(t.name), b = norm(o.name);
  const sameAddr = t.address && o.address && addr(t.address).length > 12 && addr(t.address) === addr(o.address);
  const nameHit = a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
  if (sameAddr || nameHit) {
    seen.add(k); n++;
    console.log(`[${t.area_tag}] ${t.name} (${t.id}) ${t.created_at.slice(0, 16)} | ${t.address}\n  ~ [${o.area_tag}] ${o.name} (${o.id}) ${o.created_at.slice(0, 16)} | ${o.address}`);
  }
}
console.log(`checked ${fresh.length} hits ${n}`);
