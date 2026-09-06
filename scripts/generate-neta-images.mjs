// ============================================================================
// SNSユーモアネタ画像 量産 (2026/7/4) — fal.ai FLUX 2 Pro
//   5ネタ × 各3案 = 15枚。日本語短文は直書き挑戦・決めコピーは後載せ余白。
//   生成のみ (投稿は別タスク・King GO後)。
// 実行: node scripts/generate-neta-images.mjs [--dry-run] [--only shiba_sento]
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const FAL_KEY = process.env.FAL_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i+1].split(",").map(s=>s.trim()) : null; })();
if (!DRY_RUN && !FAL_KEY) { console.error("❌ FAL_KEY未設定"); process.exit(1); }

const VARIANTS = 3;
const COMMON = "photorealistic, professional photography, warm lighting, shallow depth of field, highly detailed, cute and funny, whimsical, wholesome humor, leave some empty space for later text overlay";

const NETA = [
  { key: "shiba_sento", label: "柴犬だらけの銭湯",
    prompt: `The interior of a traditional Japanese public bath (sento) filled with many adorable shiba inu dogs relaxing in the warm bath and sitting on the tiled floor, steam rising. A fabric noren curtain at the entrance reads "柴の湯". A small paper sign on the wall reads "湯上がりマーキング禁止". Retro Showa-era tiled bath, mount fuji mural on the wall` },
  { key: "scottish_seitai", label: "スコティッシュ整体院",
    prompt: `A cozy Japanese massage and chiropractic clinic waiting room, full of grey scottish fold cats sitting in the loaf position (kobako-suwari) on the waiting chairs, patiently waiting. A wooden signboard on the wall reads "肩こり治療". Clean clinic interior, soft daylight` },
  { key: "mike_shotengai", label: "三毛猫だらけの商店街",
    prompt: `A charming old Japanese shopping street (shotengai), where every shop has a calico cat as its shop mascot sitting at the storefront. Colorful vertical banner flags (nobori) along the street read "三毛通り". Retro storefronts, evening lantern light, lively cozy atmosphere` },
  { key: "shiba_sushi", label: "柴犬の寿司屋",
    prompt: `Inside a traditional Japanese sushi restaurant, a shiba inu dog stands behind the counter as the sushi chef wearing a headband, with a refrigerated glass neta case displaying more shiba inu curled up like fresh fish. A small wooden sign reads "本日のおすすめ". Warm wooden interior, authentic sushi bar` },
  { key: "cat_cafe_staff", label: "猫のカフェ店員",
    prompt: `A cozy modern Japanese cafe where cats work as staff, one fluffy cat wearing a small waiter apron standing politely by a table as if serving customers. A small chalkboard sign reads "いらっしゃいませ". Warm cafe interior, plants, soft window light, adorable` },
];

const results = [];
const targets = NETA.filter(n => !ONLY || ONLY.includes(n.key));
await mkdir("ashiato-out", { recursive: true });
console.log(`${targets.length}ネタ × ${VARIANTS}案 = ${targets.length*VARIANTS}枚 ${DRY_RUN ? "(dry-run)" : ""}\n`);

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

for (const n of targets) {
  for (let v = 1; v <= VARIANTS; v++) {
    const name = `neta_${n.key}_${v}`;
    if (DRY_RUN) { if (v===1) console.log(`[${n.key}] ${n.label}\n  ${n.prompt}, ${COMMON}\n`); continue; }
    try {
      const webp = await sharp(await gen(n.prompt)).webp({ quality: 88 }).toBuffer();
      await writeFile(`ashiato-out/${name}.webp`, webp);
      results.push({ neta: n.label, key: n.key, v, file: `ashiato-out/${name}.webp`, kb: Math.round(webp.length/1024), ok: true });
      console.log(`✅ ${name} (${Math.round(webp.length/1024)}KB)`);
    } catch (e) {
      results.push({ neta: n.label, key: n.key, v, error: e.message, ok: false });
      console.error(`❌ ${name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
}
if (!DRY_RUN) {
  await writeFile("ashiato-out/neta-results.json", JSON.stringify(results, null, 2));
  console.log(`\n成功 ${results.filter(r=>r.ok).length}/${results.length}`);
}
