// Qocca 足で広めるQRカード (2026/7/22 King「小さいイベントから足で広める」)
// 名刺サイズ(91x55mm@300dpi=1075x650px)の印刷用カード。
// 読み取り → PetWalker(犬と行ける場所が全国に)へ。utm付きで「どのイベントが効いたか」を計測。
// ⚠️ QRはスマホのカメラ=本物のブラウザで開くので、Meta広告と違いUTMが登録まで残る=計測が効く。
// ⚠️ 静けさ厳守: オレンジ/純黒/純白なし・weight<=500・煽らない。
//
// 実行: node scripts/generate-qr-card.mjs
//   任意で utm_campaign を変えたい時: node scripts/generate-qr-card.mjs pethaku_osaka

import QRCode from "qrcode";
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const OUT = "./ad-out";
const campaign = process.argv[2] || "ground";  // イベント別に測るなら引数で(例: pethaku_osaka)
const LANDING = `https://qocca.pet/petwalker?utm_source=qr&utm_medium=offline&utm_campaign=${campaign}`;

// QCトークン (静けさ)
const QC = { warmWhite: "#FAF7F2", cream: "#F5EFE6", lightSand: "#EEE6D9", charcoal: "#2C2926", warmGray: "#6B6259", softBrown: "#8B6F5C", sage: "#A8B59E" };
const FONT_MIN = "'Yu Mincho','YuMincho','MS Mincho',serif";
const FONT_EN = "Georgia,'Times New Roman',serif";
const FONT_JP = "'Yu Gothic UI','Meiryo',sans-serif";

const W = 1075, H = 650;

async function main() {
  await mkdir(OUT, { recursive: true });

  // QR: charcoalモジュール / warmWhite背景 (静けさ)。余白広め・誤り訂正M。
  const qrPng = await QRCode.toBuffer(LANDING, {
    type: "png", errorCorrectionLevel: "M", margin: 2, width: 300,
    color: { dark: QC.charcoal, light: QC.warmWhite },
  });

  const svg = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${W}" height="${H}" fill="${QC.warmWhite}"/>
    <rect x="20" y="20" width="${W - 40}" height="${H - 40}" fill="none" stroke="${QC.lightSand}" stroke-width="2" rx="18"/>
    <!-- 左: コピー -->
    <text x="70" y="150" font-family="${FONT_EN}" font-size="46" font-weight="400" fill="${QC.charcoal}" letter-spacing="2">Qocca</text>
    <rect x="72" y="176" width="46" height="1.5" fill="${QC.sage}"/>
    <text x="70" y="292" font-family="${FONT_MIN}" font-size="40" font-weight="400" fill="${QC.charcoal}" letter-spacing="2">うちの子と</text>
    <text x="70" y="352" font-family="${FONT_MIN}" font-size="40" font-weight="400" fill="${QC.charcoal}" letter-spacing="2">行ける場所が、</text>
    <text x="70" y="412" font-family="${FONT_MIN}" font-size="40" font-weight="400" fill="${QC.softBrown}" letter-spacing="2">全国に。</text>
    <text x="70" y="486" font-family="${FONT_JP}" font-size="21" font-weight="400" fill="${QC.warmGray}" letter-spacing="1">犬と入れる宿・カフェ・お出かけ先を、1,500以上。</text>
    <text x="70" y="560" font-family="${FONT_EN}" font-size="22" font-weight="400" fill="${QC.softBrown}" letter-spacing="2">qocca.pet</text>
    <!-- 右: QR枠 -->
    <rect x="700" y="175" width="300" height="300" fill="#fff" stroke="${QC.lightSand}" stroke-width="2" rx="16"/>
    <text x="850" y="520" text-anchor="middle" font-family="${FONT_JP}" font-size="19" font-weight="400" fill="${QC.warmGray}">スマホのカメラで読み取ってね</text>
  </svg>`);

  const card = await sharp(svg)
    .composite([{ input: await sharp(qrPng).resize(268, 268).toBuffer(), left: 716, top: 191 }])
    .png().toBuffer();

  const path = `${OUT}/qocca_qr_card_${campaign}.png`;
  await writeFile(path, card);
  console.log(`\n✅ ${path}  (${W}x${H} / 名刺サイズ@300dpi)`);
  console.log(`   → 読み取り先: ${LANDING}`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
