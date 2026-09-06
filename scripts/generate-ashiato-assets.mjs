// ============================================================================
// あしあと UI素材 自動生成パイプライン (Phase C-1 素材・2026/7/4)
//   fal.ai Recraft V3 → (raster は sharp WebP変換) → Supabase Storage 'ashiato-assets'
//   10点 × 2案 = 20枚。docs/ashiato-ui-design.md §4 のプロンプト準拠。
//
// 実行前提 (環境変数・コード直書き禁止):
//   FAL_KEY                    … fal.ai API キー
//   SUPABASE_SERVICE_ROLE_KEY  … Storage アップ用 (service_role)
// 実行: node scripts/generate-ashiato-assets.mjs
//   オプション: --dry-run (API を呼ばずプロンプト一覧のみ表示)
//              --only s1,f2 (指定素材のみ再生成)
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const FAL_KEY = process.env.FAL_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const BUCKET = "ashiato-assets";
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i >= 0 ? process.argv[i + 1].split(",").map(s => s.trim()) : null;
})();

if (!DRY_RUN) {
  if (!FAL_KEY) { console.error("❌ FAL_KEY が未設定。export FAL_KEY=... してから実行"); process.exit(1); }
  if (!SERVICE_KEY) { console.error("❌ SUPABASE_SERVICE_ROLE_KEY が未設定"); process.exit(1); }
}

// 共通スタイル (設計書 §4 冒頭) + ブランドカラー厳密固定
const COMMON_STYLE =
  "warm orange (#F5A94A) and cream color palette, soft rounded shapes, flat illustration with subtle paper texture, gentle and cozy, no text, no letters, consistent minimal style";
const BRAND_COLORS = [{ r: 245, g: 169, b: 74 }]; // #F5A94A

// 10点の定義 (設計書 §4-1〜4-3)。kind: vector=SVG / raster=PNG→WebP
const ASSETS = [
  { key: "s1", path: "stamps/s1_hajimete",  kind: "vector", label: "はじめてのあしあと (スタンプ 3🐾)",
    prompt: "a single small cute paw print stamp, first step motif, cream background" },
  { key: "s2", path: "stamps/s2_quokka",    kind: "vector", label: "街のクオッカ (スタンプ 3🐾)",
    prompt: "a smiling quokka face stamp, round friendly character, flat illustration with soft edges" },
  { key: "s3", path: "stamps/s3_ameagari",  kind: "vector", label: "雨あがりのあしあと (スタンプ 5🐾)",
    prompt: "paw prints beside a small puddle reflecting a soft rainbow after rain" },
  { key: "s4", path: "stamps/s4_osanpo",    kind: "vector", label: "おさんぽ日和 (拡張スタンプ)",
    prompt: "a curved walking path with tiny paw prints and a leash, sunny day mood" },
  { key: "s5", path: "stamps/s5_oyatsu",    kind: "vector", label: "おやつの時間 (拡張スタンプ)",
    prompt: "a bone-shaped cookie and a fish-shaped cookie, bakery style" },
  { key: "s6", path: "stamps/s6_hana",      kind: "vector", label: "まちの花 (拡張スタンプ)",
    prompt: "a single gentle flower with round petals, soft green accents" },
  { key: "f1", path: "frames/f1_komorebi",  kind: "raster", label: "木漏れ日のフレーム (15🐾)",
    prompt: "a square photo frame border of soft dappled sunlight through leaves, gentle leaf shadows on the frame edges only, empty plain cream center" },
  { key: "f2", path: "frames/f2_kami",      kind: "raster", label: "紙の質感フレーム (15🐾)",
    prompt: "a square photo frame border made of warm craft paper with torn edges, empty plain cream center, cozy handmade feel" },
  { key: "f3", path: "frames/f3_yuugure",   kind: "raster", label: "夕暮れの街並みフレーム (25🐾)",
    prompt: "a square photo frame with a tiny warm town silhouette along the bottom edge at sunset, soft orange gradient sky on frame edges, empty plain cream center" },
  { key: "i1", path: "icon/i1_ashiato",     kind: "vector", label: "🐾 あしあと通貨アイコン",
    prompt: "a simple rounded paw print icon, single warm orange color, soft plump pads, minimal flat logo style, centered" },
];

const VARIANTS = ["a", "b"]; // 各2案

// ---- fal.ai Recraft V3 (sync) ----
async function generateOne(asset) {
  const body = {
    prompt: `${asset.prompt}, ${COMMON_STYLE}`,
    image_size: "square_hd",                       // 1024x1024
    style: asset.kind === "vector" ? "vector_illustration" : "digital_illustration",
    colors: BRAND_COLORS,                          // ★ #F5A94A 厳密固定 (Recraft 固有機能)
  };
  const res = await fetch("https://fal.run/fal-ai/recraft/v3/text-to-image", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`fal.ai ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error(`no image url: ${JSON.stringify(data).slice(0, 200)}`);
  const imgRes = await fetch(url);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const contentType = imgRes.headers.get("content-type") || "";
  return { buf, isSvg: contentType.includes("svg") || url.endsWith(".svg") };
}

// ---- Supabase Storage アップ ----
async function uploadToStorage(path, buf, contentType) {
  // レガシー service_role JWT / 新形式 sb_secret_... の両対応:
  //   - レガシー JWT は Authorization: Bearer で検証される
  //   - 新形式 secret key は apikey ヘッダで検証される (Bearer にも対応)
  //   → 両ヘッダに同じキーを載せればどちらの形式でも通る
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "apikey": SERVICE_KEY,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buf,
  });
  if (!res.ok) throw new Error(`storage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ---- main ----
const results = [];
const targets = ASSETS.filter(a => !ONLY || ONLY.includes(a.key));
console.log(`対象: ${targets.length}点 × ${VARIANTS.length}案 = ${targets.length * VARIANTS.length}枚 ${DRY_RUN ? "(dry-run)" : ""}\n`);

await mkdir("ashiato-out", { recursive: true });

for (const asset of targets) {
  for (const v of VARIANTS) {
    const name = `${asset.key}${v}`;
    if (DRY_RUN) {
      console.log(`[${name}] ${asset.kind} :: ${asset.prompt}, ${COMMON_STYLE}`);
      continue;
    }
    try {
      const { buf, isSvg } = await generateOne(asset);
      let outBuf, ext, ctype;
      if (isSvg) {
        outBuf = buf; ext = "svg"; ctype = "image/svg+xml";
      } else if (asset.kind === "raster") {
        outBuf = await sharp(buf).webp({ quality: 85 }).toBuffer(); ext = "webp"; ctype = "image/webp";
      } else {
        // vector 指定だが raster が返ったケース: PNG のまま保持 (後で vectorize 可)
        outBuf = await sharp(buf).webp({ quality: 90 }).toBuffer(); ext = "webp"; ctype = "image/webp";
      }
      const storagePath = `${asset.path}_${v}.${ext}`;
      await writeFile(`ashiato-out/${name}.${ext}`, outBuf);       // ローカル控え
      const publicUrl = await uploadToStorage(storagePath, outBuf, ctype);
      results.push({ name, label: asset.label, variant: v, url: publicUrl, ok: true });
      console.log(`✅ ${name} → ${publicUrl}`);
    } catch (e) {
      results.push({ name, label: asset.label, variant: v, error: e.message, ok: false });
      console.error(`❌ ${name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));  // レート配慮 (直列 + 1.5s間隔)
  }
}

if (!DRY_RUN) {
  console.log("\n===== 検収用URL一覧 =====");
  for (const r of results) {
    console.log(r.ok ? `${r.label} [案${r.variant}]\n  ${r.url}` : `${r.label} [案${r.variant}] ❌ ${r.error}`);
  }
  const okCount = results.filter(r => r.ok).length;
  console.log(`\n成功 ${okCount}/${results.length}`);
  await writeFile("ashiato-out/results.json", JSON.stringify(results, null, 2));
}
