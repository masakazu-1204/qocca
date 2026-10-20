// ペットウォーカー 座標の穴埋め (国土地理院 住所検索・鍵不要) 2026/10/21
//   Google Places の鍵が 403 (権限なし) のときの代わり。住所がある & latitude が空のスポットだけ対象。
//   結果の住所に「県名」が含まれるときだけ採用 (別の県に飛ぶのを防ぐ)。書込は latitude=is.null ガード付き PATCH。
// 実行: node scripts/geocode-petwalker-gsi.mjs [--write]   (--write なしは表示のみ)
import { readFile } from "node:fs/promises";
const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const SB_KEY = await readLocal("./.sbkey.local");
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const WRITE = process.argv.includes("--write");
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };
const spots = await (await fetch(`${SB_URL}/rest/v1/pet_walker_spots?select=id,name,pref,city,address&latitude=is.null&address=not.is.null`, { headers: H })).json();
console.log(`対象 ${spots.length} 件${WRITE ? "" : " (表示のみ)"}`);
let ok = 0, skip = 0;
for (const s of spots) {
  const q = s.address.startsWith(s.pref) ? s.address : `${s.pref}${s.address.replace(/^.*?[都道府県]/, "")}`;
  try {
    const r = await (await fetch(`https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(q)}`)).json();
    const hit = (r || [])[0];
    const [lng, lat] = hit?.geometry?.coordinates || [];
    const title = hit?.properties?.title || "";
    const good = hit && title.includes(s.pref) && lat > 24 && lat < 46 && lng > 122 && lng < 154;
    if (!good) { skip++; console.log(`skip ${s.name} ← ${q} (${title || "該当なし"})`); continue; }
    if (WRITE) {
      const res = await fetch(`${SB_URL}/rest/v1/pet_walker_spots?id=eq.${s.id}&latitude=is.null`, { method: "PATCH", headers: H, body: JSON.stringify({ latitude: lat, longitude: lng }) });
      if (!res.ok) { console.log(`NG ${s.name} ${res.status}`); continue; }
    }
    ok++; console.log(`ok ${s.name} → ${lat.toFixed(5)},${lng.toFixed(5)} (${title})`);
  } catch (e) { skip++; console.log(`err ${s.name}: ${e.message}`); }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`採用 ${ok} / 見送り ${skip}`);
