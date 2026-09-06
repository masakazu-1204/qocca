// ============================================================================
// あしあと スタンプ追加: 犬猫の顔6種 (2026/7/4)
//   ★色縛りなし: colors パラメータを使わず、各犬種/猫種の実際の毛色で生成。
//   統一するのは「画風(タッチ)」のみ。fal.ai Recraft V3 → WebP → Storage → 報告。
//   ※既存の generate-ashiato-assets.mjs とは別ファイル(色ロジックが異なるため)。
// 実行: node scripts/generate-ashiato-pets.mjs [--dry-run] [--only dog_shiba]
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const FAL_KEY = process.env.FAL_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "ashiato-assets";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => { const i = process.argv.indexOf("--only"); return i >= 0 ? process.argv[i+1].split(",").map(s=>s.trim()) : null; })();

if (!DRY_RUN) {
  if (!FAL_KEY) { console.error("❌ FAL_KEY 未設定"); process.exit(1); }
  if (!SERVICE_KEY) { console.error("❌ SUPABASE_SERVICE_ROLE_KEY 未設定"); process.exit(1); }
}

// 画風のみ統一 (色は各毛色に任せる)
const STYLE = "soft rounded, flat illustration, cute kawaii style, clean simple, white background, no text, centered face";

// 6種 (実際の毛色をプロンプトに明記・colors指定なし)
const PETS = [
  { key: "dog_shiba",        label: "柴犬",              price: 3, prompt: "a cute shiba inu dog face, reddish-brown fur with white muzzle and cheeks, perky triangular ears, gentle smiling expression" },
  { key: "dog_toypoodle",    label: "トイプードル",       price: 3, prompt: "a cute toy poodle dog face, apricot colored curly fluffy fur, round fluffy ears, sweet round eyes" },
  { key: "dog_frenchbulldog",label: "フレンチブルドッグ", price: 3, prompt: "a cute french bulldog face, pied coat white and fawn brown patches, large bat ears, flat nose, adorable wrinkles" },
  { key: "cat_kijitora",     label: "キジトラ猫",         price: 3, prompt: "a cute brown tabby cat face, brown fur with dark mackerel stripes, pointed ears, green eyes, gentle expression" },
  { key: "cat_mikeneko",     label: "三毛猫",             price: 3, prompt: "a cute calico cat face, tricolor fur patches of white orange and black, pointed ears, round eyes" },
  { key: "cat_scottishfold", label: "スコティッシュフォールド", price: 5, prompt: "a cute scottish fold cat face, soft grey fur, distinctive folded ears lying flat, big round copper eyes" },
];

async function generateOne(pet) {
  const body = {
    prompt: `${pet.prompt}, ${STYLE}`,
    image_size: "square_hd",
    style: "digital_illustration", // 毛色の階調を残すため raster。色指定(colors)は付けない
    // ★ colors パラメータ 無し = 自然な毛色で生成
  };
  const res = await fetch("https://fal.run/fal-ai/recraft/v3/text-to-image", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`no image url`);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  return buf;
}

async function uploadToStorage(path, buf, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${SERVICE_KEY}`, "apikey": SERVICE_KEY, "Content-Type": contentType, "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0,200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

const results = [];
const targets = PETS.filter(p => !ONLY || ONLY.includes(p.key));
await mkdir("ashiato-out", { recursive: true });
console.log(`犬猫スタンプ ${targets.length}種 ${DRY_RUN ? "(dry-run)" : ""}\n`);

for (const pet of targets) {
  if (DRY_RUN) { console.log(`[${pet.key}] ${pet.price}🐾 :: ${pet.prompt}, ${STYLE}`); continue; }
  try {
    const raw = await generateOne(pet);
    const webp = await sharp(raw).webp({ quality: 85 }).toBuffer();
    const path = `stamps/${pet.key}.webp`;
    await writeFile(`ashiato-out/${pet.key}.webp`, webp);
    const url = await uploadToStorage(path, webp, "image/webp");
    results.push({ key: pet.key, label: pet.label, price: pet.price, url, ok: true });
    console.log(`✅ ${pet.key} (${pet.label}) → ${url}`);
  } catch (e) {
    results.push({ key: pet.key, label: pet.label, error: e.message, ok: false });
    console.error(`❌ ${pet.key}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

if (!DRY_RUN) {
  await writeFile("ashiato-out/pets-results.json", JSON.stringify(results, null, 2));
  console.log(`\n成功 ${results.filter(r=>r.ok).length}/${results.length}`);
}
