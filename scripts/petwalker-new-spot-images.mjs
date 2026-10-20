// ペットウォーカー 画像が空のスポットに「イメージ」画像を作って配線する (2026/10/21)
//   1) DB から image_urls が空のスポットを取る (--area で絞れる)
//   2) 種類 (キャンプ/温泉宿/ドッグラン/カフェ/城…) と地域から英語の情景を組み立てる
//   3) fal flux-2-pro で生成 → webp → Storage petwalker/spots/pw_<id8>.webp → image_urls を id 単位で PATCH
//   画面には「イメージ」バッジと「※画像はイメージです」の注記が出る (petwalker.tsx)。実写ではない前提。
// 実行: node scripts/petwalker-new-spot-images.mjs [--area 北摂・箕面,堺・りんくう] [--dry-run] [--limit N]
// 鍵: scripts/.falkey.local / scripts/.sbkey.local (gitignore 済・チャットに貼らない)
import sharp from "sharp";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const FAL_KEY = await readLocal("./.falkey.local");
const SB_KEY = await readLocal("./.sbkey.local");
const SB_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const DRY = process.argv.includes("--dry-run");
const argv = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const AREAS = argv("--area")?.split(",").map((s) => s.trim()) || null;
const LIMIT = Number(argv("--limit") || Infinity);
const COMMON = "photorealistic travel photography, soft natural light, no people, no text, no watermark, serene atmosphere, high detail";
const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

const REGION = {
  "田沢湖・角館": "in Akita, northern Japan countryside with beech forests and lakes",
  "長崎・ハウステンボス": "in Nagasaki, western Japan, near a calm bay and green islands",
  "堺・りんくう": "in southern Osaka, Japan, near the sea and low green hills",
  "北摂・箕面": "in the hills of northern Osaka, Japan, surrounded by green forest",
  "富山・雨晴海岸": "in Toyama, Japan, with the snowy Tateyama mountains beyond the bay",
  "唐津・嬉野": "in Saga, Kyushu, Japan, near the Genkai sea and green hills",
  "お台場・東京ベイ": "on the Tokyo bay waterfront, Japan, with the city skyline and bridges",
  "越後湯沢・新潟": "in Niigata, Japan, among mountains and rice fields",
  "青島・高千穂": "in Miyazaki, southern Kyushu, Japan, with palm trees and the Pacific coast",
  "奥入瀬・弘前": "in Aomori, northern Japan, with beech forests and apple orchards",
  "函館・大沼": "in southern Hokkaido, Japan, near lakes and a harbor town",
  "鹿児島・桜島": "in Kagoshima, Japan, with the Sakurajima volcano across the bay",
  "奥飛騨温泉郷": "in the Okuhida hot spring villages of Gifu, Japan, beneath the Northern Alps",
  "淡路島": "on Awaji Island, Japan, with the calm Seto Inland Sea and coastal roads",
  "小豆島": "on Shodoshima Island, Japan, with olive groves and the Seto Inland Sea",
  "湯布院": "in Yufuin, Oita, Japan, with Mount Yufu and misty fields",
  "軽井沢": "in Karuizawa, Nagano, Japan, among larch forests and quiet villa lanes",
  "河口湖": "by Lake Kawaguchi, Yamanashi, Japan, with Mount Fuji in the distance",
  "神戸": "in Kobe, Japan, between the Rokko mountains and the harbor",
  "別府": "in Beppu, Oita, Japan, with hot spring steam rising over the town and the bay",
};
// 先に当たったものを採用 (具体的なものから順に)
const RULES = [
  [/足湯/, "a long public footbath by the sea at sunset with steam rising"],
  [/グランピング/, "glamping dome tents on a quiet grassy field with wooden decks"],
  [/キャンプ/, "a quiet campsite in the woods with a tent, a campfire pit and a wooden table"],
  [/トレーラー/, "a row of modern trailer house cabins on a grassy island field"],
  [/コテージ|ログ|ヴィラ|離れ|一棟|ロッジ|山荘/, "a wooden cottage with a small private garden and terrace among trees"],
  [/温泉|旅館|湯/, "a traditional Japanese onsen inn with a steaming outdoor stone bath and a quiet garden"],
  [/ホテル|宿/, "a calm hotel room with large windows looking out to the scenery, a small dog bed by the window"],
  [/ドッグラン|ランが|ドッグパーク/, "a spacious fenced grass dog run surrounded by trees, no dogs visible"],
  [/お好み焼き/, "a casual Japanese okonomiyaki restaurant with an iron griddle table, warm light"],
  [/フランス料理|ピッツ|レストラン|食事処/, "a warm restaurant terrace with wooden tables and plants, empty seats"],
  [/カフェ|喫茶|コーヒー|パフェ|ティー|Tea/, "a cozy dog-friendly cafe terrace with wooden tables, empty seats, a water bowl on the floor"],
  [/城/, "Japanese castle grounds with a white keep and stone walls under a clear sky"],
  [/バラ|ローズ|花/, "a flower garden with rose arches and gentle walking paths"],
  [/牧場|ファーム/, "a hillside farm with green pasture and a wooden fence"],
  [/モール|アウトレット|商業/, "an open-air shopping promenade with trees and benches"],
  [/くじゃく/, "a small park on a peninsula with peacocks walking on the lawn"],
  [/洋館|グラバー/, "an old Western-style mansion garden on a hill overlooking a harbor, stone paths and flowers"],
  [/九十九島|遊覧|入り江/, "many small green islands scattered in a calm bay seen from a wooden boardwalk"],
  [/公園|広場|緑地/, "a wide green park with lawns and walking paths among trees"],
];
const sceneOf = (s) => {
  const text = `${s.name} ${s.description || ""}`;
  for (const [re, scene] of RULES) if (re.test(text)) return scene;
  return "a peaceful scenic walking path with greenery";
};

async function gen(prompt) {
  const res = await fetch("https://fal.run/fal-ai/flux-2-pro", {
    method: "POST", headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `${prompt}, ${COMMON}`, image_size: "landscape_16_9", num_images: 1 }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const url = (await res.json())?.images?.[0]?.url;
  if (!url) throw new Error("no url");
  return Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer());
}
async function upload(path, buf) {
  const res = await fetch(`${SB_URL}/storage/v1/object/petwalker/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${SB_KEY}`, apikey: SB_KEY, "Content-Type": "image/webp", "x-upsert": "true" }, body: buf,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return `${SB_URL}/storage/v1/object/public/petwalker/${path}`;
}

let q = `${SB_URL}/rest/v1/pet_walker_spots?select=id,name,area_tag,description&image_urls=eq.[]&order=created_at.asc`;
if (AREAS) q += `&area_tag=in.(${AREAS.map((a) => `"${a}"`).join(",")})`;
const spots = (await (await fetch(q, { headers: H })).json()).slice(0, LIMIT);
console.log(`対象 ${spots.length} 件${DRY ? " (dry-run)" : ""}`);
await mkdir("petwalker-out/spots", { recursive: true });
let ok = 0, ng = 0;
for (const s of spots) {
  const prompt = `${sceneOf(s)}, ${REGION[s.area_tag] || "in Japan"}`;
  const path = `spots/pw_${s.id.replace(/-/g, "").slice(0, 8)}.webp`;
  if (DRY) { console.log(`[${s.area_tag}] ${s.name} → ${prompt}`); continue; }
  try {
    const webp = await sharp(await gen(prompt)).resize({ width: 1280 }).webp({ quality: 85 }).toBuffer();
    await writeFile(`petwalker-out/${path}`, webp);
    const url = await upload(path, webp);
    const pr = await fetch(`${SB_URL}/rest/v1/pet_walker_spots?id=eq.${s.id}&image_urls=eq.[]`, { method: "PATCH", headers: H, body: JSON.stringify({ image_urls: [url] }) });
    if (!pr.ok) throw new Error(`patch ${pr.status}`);
    ok++; console.log(`ok ${s.name}`);
  } catch (e) {
    ng++; console.error(`NG ${s.name}: ${e.message}`);
    if (/fal 40[23]/.test(e.message)) { console.error("fal の残高切れ・鍵切れの可能性。ここで止めます。"); break; }
  }
  await new Promise((r) => setTimeout(r, 1200));
}
if (!DRY) console.log(`成功 ${ok} / 失敗 ${ng}`);
