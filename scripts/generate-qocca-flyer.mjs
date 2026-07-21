// Qocca 静けさフライヤー (2026/7/22 King「静けさ版・おしゃれ・キャラ入り」)
// 旧チラシ(オレンジ/絵文字/「今すぐ！」/賑やか)を、サイトと同じ静けさ世界観に化粧直し。
// レイアウトの良さは踏襲・色とコピーだけ静けさへ。ヒーロー写真とクオッカのキャラは fal 生成。
// A4縦(2480x3508 @300dpi)・印刷用。QRは utm 付き(イベント計測が効く)。
// ⚠️ オレンジ/純黒/純白/絵文字/「今すぐ」なし・weight<=500・「。」基調。
// 実行: node scripts/generate-qocca-flyer.mjs

import sharp from "sharp";
import QRCode from "qrcode";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const OUT = "./ad-out";
const readLocal = async (f) => { try { return (await readFile(new URL(f, import.meta.url), "utf8")).trim(); } catch { return undefined; } };
const FAL_KEY = await readLocal("./.falkey.local") || process.env.FAL_KEY;
if (!FAL_KEY) { console.error("❌ FAL_KEY 未設定"); process.exit(1); }

const QC = { warmWhite: "#FAF7F2", cream: "#F5EFE6", lightSand: "#EAE1D4", charcoal: "#2C2926", warmGray: "#6B6259", softBrown: "#8B6F5C", sage: "#A8B59E", mutedGreen: "#7A8B6E" };
const FONT_MIN = "'Yu Mincho','YuMincho','MS Mincho',serif";
const FONT_EN = "Georgia,'Times New Roman',serif";
const FONT_JP = "'Yu Gothic UI','Yu Gothic','Meiryo',sans-serif";

const W = 2480, H = 3508;                 // A4 @300dpi
const LANDING = "https://qocca.pet/petwalker?utm_source=qr&utm_medium=offline&utm_campaign=flyer";

async function gen(prompt, image_size) {
  const res = await fetch("https://fal.run/fal-ai/flux-2-pro", {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_size, num_images: 1 }),
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const url = (await res.json())?.images?.[0]?.url;
  if (!url) throw new Error("no image url");
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const OFFERS = [
  ["Walk",      "おでかけ", "犬と行けるカフェ・宿・お出かけ先を、全国から。"],
  ["Market",    "商店街",   "ペット好きの作家がつくる、うちの子だけの一点。"],
  ["Album",     "アルバム", "うちの子の写真や日常を、そっと残しておく。"],
  ["Community", "広場",     "同じ想いの飼い主と、静かにつながる。"],
  ["Event",     "イベント", "マルシェや譲渡会など、全国の催しを。"],
  ["Places",    "施設",     "ペットと一緒に入れる場所を、見つける。"],
];

function offersSvg() {
  // 2列×3行。EN(小)を上・JP(明朝)を下に積む = 長いENでも衝突しない。行間 300。
  const colX = [200, 1300], rowY = 2040, rowH = 300;
  return OFFERS.map(([en, jp, line], i) => {
    const x = colX[i % 2], y = rowY + Math.floor(i / 2) * rowH;
    return `
    <line x1="${x}" y1="${y - 42}" x2="${x + 44}" y2="${y - 42}" stroke="${QC.sage}" stroke-width="2"/>
    <text x="${x}" y="${y}" font-family="${FONT_EN}" font-size="27" fill="${QC.sage}" letter-spacing="4">${en.toUpperCase()}</text>
    <text x="${x}" y="${y + 60}" font-family="${FONT_MIN}" font-size="46" fill="${QC.charcoal}" letter-spacing="2">${esc(jp)}</text>
    <text x="${x}" y="${y + 122}" font-family="${FONT_JP}" font-size="30" font-weight="400" fill="${QC.warmGray}" letter-spacing="0.5">${esc(line)}</text>`;
  }).join("\n");
}

async function main() {
  await mkdir(OUT, { recursive: true });

  // 生成画像はキャッシュ(レイアウト調整でfalを無駄に叩かない)。--regen で再生成。
  const regen = process.argv.includes("--regen");
  const heroPath = `${OUT}/_flyer_hero.png`, mascotPath = `${OUT}/_flyer_mascot.png`;

  let hero;
  if (!regen && existsSync(heroPath)) { console.log("  [1/4] ヒーロー: キャッシュ使用"); hero = await readFile(heroPath); }
  else {
    console.log("  [1/4] ヒーロー写真を生成 (静けさ) …");
    hero = await gen("Warm soft natural window light, a small apricot toy poodle and a gentle grey tabby cat resting calmly together on a cream linen blanket at home, muted warm earthy tones, serene quiet editorial photography, shallow depth of field, lots of soft negative space, calm and tender mood, no text", "landscape_4_3");
    await writeFile(heroPath, hero);
  }

  let mascot;
  if (!regen && existsSync(mascotPath)) { console.log("  [2/4] キャラ: キャッシュ使用"); mascot = await readFile(mascotPath); }
  else {
    console.log("  [2/4] クオッカのキャラを生成 …");
    mascot = await gen("A minimalist gentle illustration of a single cute quokka sitting, soft rounded simple shapes, warm soft-brown and beige delicate line art, calm friendly expression, on a plain solid warm off-white background, flat simple editorial illustration, lots of empty space, no text", "square_hd");
    await writeFile(mascotPath, mascot);
  }

  console.log("  [3/4] QR生成 …");
  const qrPng = await QRCode.toBuffer(LANDING, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 460, color: { dark: QC.charcoal, light: QC.warmWhite } });

  // 画像を整形
  const heroCard = await sharp(hero).resize(2080, 1120, { fit: "cover", position: "attention" })
    .composite([{ input: Buffer.from(`<svg width="2080" height="1120"><rect width="2080" height="1120" rx="28" ry="28" fill="#fff"/></svg>`), blend: "dest-in" }])
    .png().toBuffer();
  const mascotImg = await sharp(mascot).resize(440, 440, { fit: "cover" })
    .composite([{ input: Buffer.from(`<svg width="440" height="440"><rect width="440" height="440" rx="28" ry="28" fill="#fff"/></svg>`), blend: "dest-in" }])
    .png().toBuffer();
  const qrImg = await sharp(qrPng).resize(360, 360).png().toBuffer();

  console.log("  [4/4] A4合成 …");
  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="${QC.warmWhite}"/>
    <!-- ヘッダ -->
    <text x="200" y="250" font-family="${FONT_EN}" font-size="104" fill="${QC.charcoal}" letter-spacing="3">Qocca</text>
    <text x="640" y="250" font-family="${FONT_JP}" font-size="34" fill="${QC.warmGray}" letter-spacing="8">クオッカ</text>
    <text x="${W - 200}" y="230" text-anchor="end" font-family="${FONT_EN}" font-size="34" font-style="italic" fill="${QC.sage}" letter-spacing="1">with pets, with love.</text>
    <!-- 見出し -->
    <text x="200" y="1620" font-family="${FONT_MIN}" font-size="118" fill="${QC.charcoal}" letter-spacing="3">うちの子と、もっと自由に。</text>
    <text x="200" y="1760" font-family="${FONT_JP}" font-size="38" font-weight="400" fill="${QC.warmGray}" letter-spacing="1">おでかけも、思い出も、うちの子のためのものも。</text>
    <text x="200" y="1822" font-family="${FONT_JP}" font-size="38" font-weight="400" fill="${QC.warmGray}" letter-spacing="1">ペットと暮らす毎日が、そっとつながる場所。</text>
    <!-- 提供するもの (2列) -->
    ${offersSvg()}
    <!-- 下段右: QRブロック (QRは右端・文言はその左。被らない) -->
    <text x="${W - 200 - 360 - 60}" y="3070" text-anchor="end" font-family="${FONT_MIN}" font-size="54" fill="${QC.charcoal}" letter-spacing="2">のぞいてみてください。</text>
    <text x="${W - 200 - 360 - 60}" y="3132" text-anchor="end" font-family="${FONT_JP}" font-size="28" fill="${QC.warmGray}" letter-spacing="1">スマホのカメラで、そっと読み取って。</text>
    <text x="${W - 200 - 360 - 60}" y="3300" text-anchor="end" font-family="${FONT_EN}" font-size="54" fill="${QC.softBrown}" letter-spacing="3">qocca.pet</text>
    <!-- フッター -->
    <line x1="200" y1="3410" x2="${W - 200}" y2="3410" stroke="${QC.lightSand}" stroke-width="2"/>
    <text x="${W / 2}" y="3474" text-anchor="middle" font-family="${FONT_MIN}" font-size="40" fill="${QC.softBrown}" letter-spacing="4">うちの子を愛してる人が、集まる街。</text>
  </svg>`);

  const flyer = await sharp(svg)
    .composite([
      { input: heroCard, left: 200, top: 340 },
      { input: mascotImg, left: 200, top: 2960 },              // 左下: キャラ
      { input: qrImg, left: W - 200 - 360, top: 2990 },        // 右下: QR (右端)
    ])
    .png().toBuffer();

  const path = `${OUT}/qocca_flyer_shizukesa.png`;
  await writeFile(path, flyer);
  console.log(`\n✅ ${path}  (A4縦 ${W}x${H} @300dpi)`);
  console.log(`   QR → ${LANDING}`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
