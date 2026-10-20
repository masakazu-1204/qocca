// ペットウォーカー: エリアごとの件数と、調査役に渡す材料を出す
// 実行: node scripts/petwalker-area-status.mjs                 … 全エリアを件数の少ない順に (画像なし・座標なしも)
//       node scripts/petwalker-area-status.mjs --areas 宮島,鎌倉 … そのエリアの既存の名前と市区町村 (調査役の「除外リスト」用)
import { readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SB_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const i = process.argv.indexOf("--areas");
const AREAS = i >= 0 ? process.argv[i + 1].split(",").map((s) => s.trim()) : null;

let all = [];
for (let o = 0; ; o += 1000) {
  const r = await fetch(`${SB_URL}/rest/v1/pet_walker_spots?select=name,area_tag,address,latitude,image_urls,created_at&order=id`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Range: `${o}-${o + 999}` },
  });
  const d = await r.json(); all = all.concat(d); if (d.length < 1000) break;
}
const city = (a) => (a || "").match(/^(.+?[都道府県])(.+?郡.+?[町村]|.+?市.+?区|.+?[市区町村])/)?.slice(1, 3).join("") || "";

if (!AREAS) {
  const m = new Map();
  for (const s of all) {
    const e = m.get(s.area_tag) || { n: 0, noImg: 0, noCoord: 0, last: "" };
    e.n++; if (!s.image_urls?.length) e.noImg++; if (s.latitude == null) e.noCoord++;
    if (s.created_at > e.last) e.last = s.created_at;
    m.set(s.area_tag, e);
  }
  console.log(`合計 ${all.length} 件 / ${m.size} エリア`);
  console.log("エリア\t件数\t画像なし\t座標なし\t最終追加(UTC)");
  for (const [a, e] of [...m].sort((x, y) => x[1].n - y[1].n)) console.log(`${a}\t${e.n}\t${e.noImg}\t${e.noCoord}\t${e.last.slice(0, 10)}`);
} else {
  for (const a of AREAS) {
    const rows = all.filter((s) => s.area_tag === a);
    const cities = [...new Set(rows.map((s) => city(s.address)).filter(Boolean))];
    console.log(`## ${a} (${rows.length} 件)`);
    console.log(`市区町村: ${cities.join(" / ") || "(住所なし)"}`);
    console.log(`既存の名前: ${rows.map((s) => s.name).join(" / ")}\n`);
  }
}
