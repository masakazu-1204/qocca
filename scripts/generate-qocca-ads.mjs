// ============================================================================
// Qocca Meta広告クリエイティブ生成 (2026/7/11) — fal.ai FLUX 2 Pro + sharp合成
//   おでかけ訴求2案 + マーケット訴求2案 = 計4枚 (1:1 / 1080x1080)
//   方針: falはフォトリアル被写体のみ生成(テキスト/ロゴなし) →
//          コピー・実ロゴ(public/qocca_logo.png)・#F5A94A を sharp で確実合成
// 実行: FAL_KEY を env か scripts/.falkey.local に。 node scripts/generate-qocca-ads.mjs
// 出力: ad-out/ad_<key>.webp (+ raw保存)
// ============================================================================
import sharp from "sharp";
import { writeFile, mkdir, readFile } from "node:fs/promises";

const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const FAL_KEY = await readLocal("./.falkey.local") || process.env.FAL_KEY;
if (!FAL_KEY) { console.error("❌ FAL_KEY 未設定"); process.exit(1); }

const S = 1080;                         // 出力正方形サイズ
const ORANGE = "#F5A94A";               // ブランドオレンジ(統一指定)
const COMMON = "photorealistic, professional advertising photography, natural soft light, high detail, shallow depth of field, absolutely no text, no letters, no logo, no watermark";

const ADS = [
  { key: "odekake_A", axis: "おでかけ",
    prompt: "A happy young Japanese woman joyfully walking a cheerful golden retriever along a bright sunny seaside boardwalk, ocean and clear blue sky, warm summer light, both looking delighted, plenty of open sky above, candid lifestyle moment",
    main: ["愛犬と行ける", "場所、全国に。"], sub: "全国47都道府県のペット可スポット" },
  { key: "odekake_B", axis: "おでかけ",
    prompt: "A smiling young Japanese person with a happy corgi dog at a scenic green mountain overlook in autumn Japan, colorful foliage, bright clear day, the dog looking up cheerfully on a leash, wide open sky, warm joyful candid mood",
    main: ["愛犬と行ける", "場所、全国に。"], sub: "全国47都道府県のペット可スポット" },
  { key: "market_A", axis: "マーケット",
    prompt: "An adorable toy poodle wearing a handmade artisan bandana, sitting beside beautifully arranged handmade pet accessories, a leather name tag and a knitted toy, on a warm wooden table by a window, cozy craft atelier atmosphere, soft natural light, clean simple background",
    main: ["うちの子だけの、", "特別な一点。"], sub: "ペット好き作家の作品" },
  { key: "market_B", axis: "マーケット",
    prompt: "A cute shiba inu dog gazing at a beautiful handmade leather collar and a custom engraved name tag displayed on natural linen cloth, artisan pet goods styled with the dog, warm soft window light, cozy minimal wooden background",
    main: ["うちの子だけの、", "特別な一点。"], sub: "ペット好き作家の作品" },
];

async function gen(prompt) {
  const res = await fetch("https://fal.run/fal-ai/flux-2-pro", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: `${prompt}, ${COMMON}`, image_size: "square_hd", num_images: 1 }),
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const url = (await res.json())?.images?.[0]?.url;
  if (!url) throw new Error("no url");
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

// コピー・帯・スクリム・ワードマークを1枚のSVGで重ねる
function overlaySvg({ main, sub }) {
  const font = "Yu Gothic UI, Meiryo, 'Noto Sans JP', sans-serif";
  return Buffer.from(`<svg width="${S}" height="${S}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.35" stop-color="#1c1712" stop-opacity="0"/>
      <stop offset="0.62" stop-color="#1c1712" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#140f0b" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="topscrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#140f0b" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#140f0b" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${S}" height="220" fill="url(#topscrim)"/>
  <rect x="0" y="0" width="${S}" height="${S}" fill="url(#scrim)"/>
  <!-- ワードマーク (ロゴマークは別途ラスタ合成) -->
  <text x="176" y="118" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="400" fill="#ffffff" letter-spacing="1">Qocca</text>
  <!-- メインコピー -->
  <text x="70" y="812" font-family="${font}" font-size="94" font-weight="700" fill="#ffffff">${main[0]}</text>
  <text x="70" y="922" font-family="${font}" font-size="94" font-weight="700" fill="#ffffff">${main[1]}</text>
  <!-- オレンジ帯 + サブコピー -->
  <rect x="72" y="968" width="46" height="8" rx="4" fill="${ORANGE}"/>
  <text x="134" y="990" font-family="${font}" font-size="42" font-weight="500" fill="#ffffff">${sub}</text>
</svg>`);
}

await mkdir("ad-out", { recursive: true });
const results = [];
for (const ad of ADS) {
  try {
    const raw = await gen(ad.prompt);
    await writeFile(`ad-out/raw_${ad.key}.webp`, await sharp(raw).resize(S, S, { fit: "cover" }).webp({ quality: 90 }).toBuffer());
    const base = await sharp(raw).resize(S, S, { fit: "cover" }).toBuffer();
    const logo = await sharp("public/qocca_logo.png").resize(150, 150, { fit: "inside" }).toBuffer(); // 透過Qマーク
    const out = await sharp(base)
      .composite([
        { input: logo, top: 40, left: 44 },
        { input: overlaySvg(ad), top: 0, left: 0 },
      ])
      .webp({ quality: 90 }).toBuffer();
    await writeFile(`ad-out/ad_${ad.key}.webp`, out);
    results.push({ key: ad.key, ok: true, kb: Math.round(out.length / 1024) });
    console.log(`✅ ad_${ad.key} (${Math.round(out.length / 1024)}KB)`);
  } catch (e) {
    results.push({ key: ad.key, ok: false, error: e.message });
    console.error(`❌ ${ad.key}: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}
console.log(`\n成功 ${results.filter(r => r.ok).length}/${results.length}`);
