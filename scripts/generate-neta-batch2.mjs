// ============================================================================
// SNSユーモアネタ 第2弾 量産 (2026/7/4) — fal.ai FLUX 2 Pro
//   15ネタ × 各2案 = 30枚。sns-neta バケットへアップ (Storage保存で投稿タスク用に整理)。
//   命名: neta_[番号2桁]_[key]_a/b.webp (「二度使わない」use_count管理を見据えた体系)
// 実行: node scripts/generate-neta-batch2.mjs [--dry-run] [--only 06]
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const FAL_KEY = process.env.FAL_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "sns-neta";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i+1].split(",").map(s=>s.trim()) : null; })();
if (!DRY_RUN) {
  if (!FAL_KEY) { console.error("❌ FAL_KEY未設定"); process.exit(1); }
  if (!SERVICE_KEY) { console.error("❌ SUPABASE_SERVICE_ROLE_KEY未設定"); process.exit(1); }
}

const VARIANTS = ["a", "b"];
const COMMON = "photorealistic, professional photography, warm lighting, shallow depth of field, highly detailed, cute and funny, whimsical, wholesome humor, leave some empty space for later text overlay";

// 15ネタ (勝ちパターン: 動物の身体特徴×場面のギャップ + 短い日本語看板)
const NETA = [
  { n: "06", key: "pug_yoga", label: "パグヨガ教室",
    p: `A serene Japanese yoga studio where many wrinkly pugs sit on yoga mats attempting yoga poses, tongues out, looking unbothered. A small wooden sign reads "ヨガ教室". Bright airy studio, wooden floor` },
  { n: "07", key: "golden_library", label: "ゴールデン図書館",
    p: `A quiet cozy Japanese library where golden retrievers lie between tall bookshelves as if reading, one resting its chin on an open book. A small sign reads "お静かに". Warm reading lamps, wooden shelves full of books` },
  { n: "08", key: "chihuahua_koban", label: "チワワ交番",
    p: `A tiny Japanese police box (koban) with small chihuahuas wearing tiny police caps standing guard at the entrance, looking very serious and alert. A sign reads "交番". Street corner, red lamp` },
  { n: "09", key: "bordercollie_school", label: "ボーダーコリー学校",
    p: `A Japanese elementary school classroom where border collie dogs sit attentively at wooden desks facing a blackboard, one with a paw raised as if answering. Blackboard reads "しつけ教室". Sunlight through windows` },
  { n: "10", key: "akita_sumo", label: "秋田相撲部屋",
    p: `A traditional Japanese sumo training stable where large fluffy akita dogs face off in the dohyo ring in sumo stance, serious expressions. A banner reads "相撲部屋". Wooden training hall, sand ring` },
  { n: "11", key: "frenchie_bakery", label: "フレブル パン工房",
    p: `A warm artisan bakery where french bulldogs wearing tiny bakers hats and aprons stand at the counter surrounded by fresh bread, flour dusting their faces. A sign reads "パン工房". Rustic bakery, wooden shelves of bread` },
  { n: "12", key: "ragdoll_massage", label: "ラグドール マッサージ",
    p: `A calm Japanese massage parlor where a fluffy ragdoll cat lies completely limp and relaxed on a massage table, utterly boneless. A sign reads "もみほぐし". Soft towels, dim relaxing spa lighting` },
  { n: "13", key: "blackcat_bar", label: "黒猫バー",
    p: `A moody dimly-lit Japanese bar at night where an elegant black cat stands behind the counter as bartender, polishing a glass. A small sign reads "夜のバー". Bottles backlit, cozy jazz bar atmosphere` },
  { n: "14", key: "munchkin_bakery", label: "マンチカン背伸びパン屋",
    p: `A cute Japanese bakery where short-legged munchkin cats stretch up on their hind legs reaching for bread on a high shelf, one barely reaching. A sign reads "パン屋さん". Warm bakery, breads on shelves` },
  { n: "15", key: "persian_salon", label: "ペルシャ美容室",
    p: `A chic Japanese hair salon where fluffy long-haired persian cats sit in styling chairs facing mirrors, looking glamorous mid-grooming. A sign reads "美容室". Salon mirrors, soft lighting, stylish interior` },
  { n: "16", key: "hamster_sushi", label: "ハムスター寿司屋",
    p: `A miniature Japanese sushi counter scaled for hamsters, where a tiny hamster chef stuffs its cheeks behind a tiny neta case with tiny sushi. A tiny wooden sign reads "すし". Warm tiny wooden interior, macro detail` },
  { n: "17", key: "rabbit_cafe", label: "うさぎカフェ",
    p: `A pastel cozy Japanese cafe where fluffy rabbits sit at small tables with tiny cups, ears perked, one nibbling a carrot cake. A chalkboard reads "うさぎカフェ". Soft pastel interior, window light` },
  { n: "18", key: "finch_stock", label: "文鳥証券取引所",
    p: `A busy trading floor where many java sparrow finches perch in front of tiny screens showing stock charts, looking intense and business-like. A board reads "取引所". Rows of small screens, serious office mood` },
  { n: "19", key: "ferret_yoga", label: "フェレットヨガ",
    p: `A bright Japanese yoga studio where long stretchy ferrets contort into impossible yoga poses on mats, showing off their flexibility. A sign reads "ヨガ". Airy studio, wooden floor, morning light` },
  { n: "20", key: "shiba_dagashi", label: "柴犬の駄菓子屋",
    p: `A nostalgic Showa-era Japanese penny candy shop (dagashiya) where a shiba inu sits at the counter as the shopkeeper surrounded by colorful old-fashioned candies and toys. A faded sign reads "駄菓子". Retro cluttered cozy shop` },
];

async function gen(prompt) {
  const res = await fetch("https://fal.run/fal-ai/flux-2-pro", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `${prompt}, ${COMMON}`, image_size: "landscape_16_9", num_images: 1 }),
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0,180)}`);
  const url = (await res.json())?.images?.[0]?.url;
  if (!url) throw new Error("no url");
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}
async function upload(path, buf) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": "image/webp", "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0,180)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

const results = [];
const targets = NETA.filter(x => !ONLY || ONLY.includes(x.n) || ONLY.includes(x.key));
await mkdir("ashiato-out", { recursive: true });
console.log(`${targets.length}ネタ × ${VARIANTS.length}案 = ${targets.length*VARIANTS.length}枚 ${DRY_RUN ? "(dry-run)" : ""}\n`);

for (const neta of targets) {
  for (const v of VARIANTS) {
    const fname = `neta_${neta.n}_${neta.key}_${v}`;
    if (DRY_RUN) { if (v==="a") console.log(`[${neta.n}] ${neta.label}\n  ${neta.p}\n`); continue; }
    try {
      const webp = await sharp(await gen(neta.p)).webp({ quality: 88 }).toBuffer();
      await writeFile(`ashiato-out/${fname}.webp`, webp);
      const url = await upload(`${fname}.webp`, webp);
      results.push({ n: neta.n, neta: neta.label, v, url, kb: Math.round(webp.length/1024), ok: true });
      console.log(`✅ ${fname} (${Math.round(webp.length/1024)}KB)`);
    } catch (e) {
      results.push({ n: neta.n, neta: neta.label, v, error: e.message, ok: false });
      console.error(`❌ ${fname}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
if (!DRY_RUN) {
  await writeFile("ashiato-out/neta-batch2-results.json", JSON.stringify(results, null, 2));
  console.log(`\n成功 ${results.filter(r=>r.ok).length}/${results.length}`);
}
