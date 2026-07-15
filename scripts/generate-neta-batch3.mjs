// ============================================================================
// SNSユーモアネタ 第3弾 量産 (2026/7/13) — fal.ai FLUX 2 Pro
//   12ネタ × 各2案 = 24枚。sns-neta バケットへアップ (投稿タスク用)。
//   命名: neta_[番号2桁]_[key]_a/b.webp (第2弾踏襲・use_count管理体系)
//   ⚠️ キーはローテ済み: env優先だが scripts/.falkey.local / .sbkey.local を優先で読む。
//   DB(sns_neta_posts)追加は別処理 (curate後にMCPでinsert)。
// 実行: node scripts/generate-neta-batch3.mjs [--dry-run] [--only 21]
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir, readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const FAL_KEY = await readLocal("./.falkey.local") || process.env.FAL_KEY;
const SERVICE_KEY = await readLocal("./.sbkey.local") || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "sns-neta";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i+1].split(",").map(s=>s.trim()) : null; })();
if (!DRY_RUN) {
  if (!FAL_KEY) { console.error("❌ FAL_KEY未設定 (scripts/.falkey.local)"); process.exit(1); }
  if (!SERVICE_KEY) { console.error("❌ SERVICE_KEY未設定 (scripts/.sbkey.local)"); process.exit(1); }
}

const VARIANTS = ["a", "b"];
const COMMON = "photorealistic, professional photography, warm lighting, shallow depth of field, highly detailed, cute and funny, whimsical, wholesome humor, natural animal fur color, leave some empty space for later text overlay";

// 12ネタ (動物×日本の日常のギャップ・短い日本語看板)
const NETA = [
  { n: "21", key: "shiba_bandai", label: "柴犬の番台",
    p: `A traditional Japanese public bathhouse (sento) where a shiba inu sits proudly at the tall wooden reception desk (bandai) overseeing the entrance, calm dignified expression. A sign reads "男湯 女湯". Warm retro sento interior, tiled walls` },
  { n: "22", key: "cat_kaisatsu", label: "猫の改札",
    p: `A Japanese train station ticket gate where a cat stands on hind legs holding up a commuter IC pass to the card reader, commuter-serious face. A sign reads "改札". Morning station, rows of automatic gates` },
  { n: "23", key: "golden_hanami", label: "ゴールデンの花見場所取り",
    p: `A cherry blossom park during hanami where a golden retriever lies sprawled on a blue picnic tarp reserving the spot under blooming sakura trees, content expression. A small sign reads "場所取り中". Pink petals falling, spring` },
  { n: "24", key: "frenchie_takoyaki", label: "フレブルのたこ焼き屋台",
    p: `A festival food stall at night where a french bulldog wearing a headband and apron flips takoyaki balls on a hot griddle with a pick, focused chef face. A stall banner reads "たこ焼き". Warm festival lanterns` },
  { n: "25", key: "rabbit_wagashi", label: "うさぎの和菓子選び",
    p: `A traditional Japanese sweets shop where a fluffy rabbit peers into a display case of daifuku mochi, contemplating its choice, paws on the glass. A sign reads "和菓子". Elegant wagashi shop, wooden counter` },
  { n: "26", key: "dachshund_library", label: "ダックスの図書館",
    p: `A quiet cozy library where a long dachshund lies stretched along an open book on a reading desk as if reading, one paw on the page. A sign reads "お静かに". Warm reading lamp, tall bookshelves` },
  { n: "27", key: "corgi_izakaya", label: "コーギーの居酒屋",
    p: `A cozy Japanese izakaya where a corgi sits at the counter with a small plate of edamame beans, relaxed after-work vibe. A red lantern reads "居酒屋". Warm dim izakaya, bottles behind the counter` },
  { n: "28", key: "husky_yukimatsuri", label: "ハスキーの雪まつり",
    p: `A winter snow festival where a husky uses its paws to sculpt a big snow statue, dusted with snow, proud of its work. A banner reads "雪まつり". Snowy plaza, other snow sculptures behind` },
  { n: "29", key: "pug_engawa", label: "パグの縁側お茶",
    p: `A traditional Japanese house veranda (engawa) where a wrinkly pug sits beside a cup of green tea gazing at the garden, peaceful old-soul expression. A small sign reads "お茶". Sunlit engawa, zen garden view` },
  { n: "30", key: "akita_yubin", label: "秋田犬の郵便局",
    p: `A Japanese post office counter where a large fluffy akita dog pushes a parcel across the counter to send it, polite serious face. A sign reads "郵便局". Clean bright post office interior` },
  { n: "31", key: "cat_senpuki", label: "猫の扇風機",
    p: `A traditional Japanese tatami room in summer where a cat lies flopped in front of an old-fashioned electric fan, fur blowing back, utterly relaxed. A small sign reads "涼". Tatami mats, summer afternoon light` },
  { n: "32", key: "toypoodle_latteart", label: "トイプードルのラテアート",
    p: `A stylish cafe where a toy poodle sits at a table staring in wonder at a cup of latte with beautiful latte art, eyes wide. A chalkboard reads "カフェ". Cozy modern cafe, soft window light` },
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
await mkdir("neta-out", { recursive: true });
console.log(`${targets.length}ネタ × ${VARIANTS.length}案 = ${targets.length*VARIANTS.length}枚 ${DRY_RUN ? "(dry-run)" : ""}\n`);

for (const neta of targets) {
  for (const v of VARIANTS) {
    const fname = `neta_${neta.n}_${neta.key}_${v}`;
    if (DRY_RUN) { if (v==="a") console.log(`[${neta.n}] ${neta.label}\n  ${neta.p}\n`); continue; }
    try {
      const webp = await sharp(await gen(neta.p)).webp({ quality: 88 }).toBuffer();
      await writeFile(`neta-out/${fname}.webp`, webp);
      const url = await upload(`${fname}.webp`, webp);
      results.push({ n: neta.n, neta: neta.label, key: neta.key, v, path: `${fname}.webp`, url, kb: Math.round(webp.length/1024), ok: true });
      console.log(`✅ ${fname} (${Math.round(webp.length/1024)}KB)`);
    } catch (e) {
      results.push({ n: neta.n, neta: neta.label, key: neta.key, v, error: e.message, ok: false });
      console.error(`❌ ${fname}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
if (!DRY_RUN) {
  await writeFile("neta-out/neta-batch3-results.json", JSON.stringify(results, null, 2));
  console.log(`\n成功 ${results.filter(r=>r.ok).length}/${results.length}`);
}
