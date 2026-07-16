// Qocca 動画広告 (Meta Reels 9:16) — 静けさ世界観
// 2026/7/17 King「動画のが100%効果あるやろうけど、作りたいね」
//
// 設計思想:
//   ・着地先が特集記事「犬の神様を、たずねる旅」になったので、広告も同じ世界で揃える。
//     派手な広告 → 静かな記事 は裏切りになり離脱を生む。この動画は「記事の第一段落」。
//   ・AI動画生成は使わない。既存のスポット画像(1,551枚の資産)をゆっくり溶かすだけ。
//     理由: ①生成コストゼロ ②世界観が完全に一致 ③AI動画の破綻(犬の脚が増える等)がない
//   ・コピーは記事のリード文そのもの。広告で語り始め、記事で続きを読ませる。
//
// ⚠️ 静けさ厳守: オレンジ(#F5A94A)禁止・純黒/純白禁止・font-weight<=500・
//    煽り表現禁止・「！」使わない・transition 0.8s+ (= クロスフェード0.8s)
//
// 出力: ad-out/qocca_reel_inu_no_kamisama.mp4 (1080x1920 / 約12秒 / 無音)
//   ※ Reels は既定でミュート自動再生。音楽は世界観リスクのため入れない (King判断待ち)。
//
// 実行: node scripts/generate-qocca-video-ad.mjs

import sharp from "sharp";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);
const W = 1080, H = 1920;
const OUT = "./ad-out";
const TMP = "./ad-out/_frames";

// QC デザイントークン (src/constants/theme.ts と一致)
const QC = { warmWhite: "#FAF7F2", cream: "#F5EFE6", charcoal: "#2C2926", warmGray: "#6B6259", softBrown: "#8B6F5C", sage: "#A8B59E" };
// Windows 標準の明朝 = Shippori Mincho (サイトの見出しフォント) に最も近い
const FONT_MIN = "'Yu Mincho', 'YuMincho', 'MS Mincho', serif";
const FONT_EN = "Georgia, 'Times New Roman', serif";

const B = "https://qufrqkuipzuqeqkvuhkx.supabase.co/storage/v1/object/public/petwalker/spots";

// 記事のリード文を、そのまま広告のコピーに (広告=第一段落・記事=続き)
const SCENES = [
  { img: `${B}/mitake_shrine.webp`,    lines: ["鳥居の前で、", "ふと立ち止まる。"] },
  { img: `${B}/izu_jingi.webp`,        lines: ["この先へ、うちの子も", "入っていいのだろうか。"] },
  { img: `${B}/chichibu_imamiya.webp`, lines: ["その迷いに、", "まっすぐ応えてくれる", "場所がある。"] },
  { img: `${B}/izumo_taisha.webp`,     lines: ["犬の神様に会える神社が、", "全国に。"] },
];
const HOLD = 2.9;    // 各カットの尺
const FADE = 0.8;    // クロスフェード (静けさ: 最低0.6s・推奨0.8s)

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 写真カット: 画像を9:16でカバー → 下半分にスクリム → 明朝コピー
function overlaySvg(lines) {
  const size = 58, lh = 92;
  const startY = H - 300 - (lines.length - 1) * lh;
  const text = lines.map((l, i) =>
    `<text x="86" y="${startY + i * lh}" font-family="${FONT_MIN}" font-size="${size}" font-weight="400" fill="#ffffff" letter-spacing="2">${esc(l)}</text>`
  ).join("\n  ");
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${QC.charcoal}" stop-opacity="0.15"/>
      <stop offset="45%" stop-color="${QC.charcoal}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${QC.charcoal}" stop-opacity="0.82"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#scrim)"/>
  <text x="86" y="150" font-family="${FONT_EN}" font-size="34" font-weight="400" fill="#ffffff" opacity="0.9" letter-spacing="6">Qocca</text>
  ${text}
</svg>`);
}

// 締めカード: 写真なし・warmWhite の余白 (静けさの"間")
function endCardSvg() {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${QC.warmWhite}"/>
  <text x="${W / 2}" y="820" text-anchor="middle" font-family="${FONT_EN}" font-size="86" font-weight="400" fill="${QC.charcoal}" letter-spacing="3">Qocca</text>
  <rect x="${W / 2 - 30}" y="880" width="60" height="1" fill="${QC.sage}"/>
  <text x="${W / 2}" y="1000" text-anchor="middle" font-family="${FONT_MIN}" font-size="52" font-weight="400" fill="${QC.charcoal}" letter-spacing="3">うちの子と、出かける。</text>
  <text x="${W / 2}" y="1092" text-anchor="middle" font-family="${FONT_MIN}" font-size="31" font-weight="400" fill="${QC.warmGray}" letter-spacing="1">犬と入れる場所を、1,500以上。</text>
  <text x="${W / 2}" y="1290" text-anchor="middle" font-family="${FONT_EN}" font-size="27" font-weight="400" fill="${QC.softBrown}" letter-spacing="3">qocca.pet</text>
</svg>`);
}

async function fetchBuf(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${r.status}: ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main() {
  await mkdir(TMP, { recursive: true });
  const frames = [];

  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    process.stdout.write(`  [${i + 1}/${SCENES.length + 1}] ${s.img.split("/").pop()} … `);
    const src = await fetchBuf(s.img);
    const png = await sharp(src)
      .resize(W, H, { fit: "cover", position: "attention" })  // 被写体を優先して9:16にトリム
      .composite([{ input: overlaySvg(s.lines) }])
      .png().toBuffer();
    const p = `${TMP}/scene_${i}.png`;
    await writeFile(p, png);
    frames.push(p);
    console.log("ok");
  }

  process.stdout.write(`  [${SCENES.length + 1}/${SCENES.length + 1}] end card … `);
  const endPng = await sharp(endCardSvg()).png().toBuffer();
  const endP = `${TMP}/scene_end.png`;
  await writeFile(endP, endPng);
  frames.push(endP);
  console.log("ok");

  // ffmpeg: 各静止画を尺ぶん伸ばし → xfade で 0.8s ずつ溶かす。
  // ゆるいズーム (1.0→1.05) で「息」を入れる。動きはこれだけ = 静けさ。
  const inputs = frames.flatMap((f) => ["-loop", "1", "-t", String(HOLD), "-i", f]);
  const FPS = 30;
  const zoomFrames = Math.round(HOLD * FPS);
  const filters = [];
  frames.forEach((_, i) => {
    // 最後の締めカードはズームなし (静止で終わる)
    if (i === frames.length - 1) {
      filters.push(`[${i}:v]scale=${W}:${H},setsar=1,fps=${FPS},format=yuv420p[v${i}]`);
    } else {
      filters.push(
        `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='min(1.0+0.05*on/${zoomFrames},1.05)':d=${zoomFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${W}x${H}:fps=${FPS},setsar=1,format=yuv420p[v${i}]`
      );
    }
  });
  // xfade チェーン
  let prev = "v0";
  for (let i = 1; i < frames.length; i++) {
    const off = (HOLD - FADE) * i - FADE * 0 + (HOLD - FADE) * 0; // 各カットは (HOLD-FADE) ずつ前進
    const offset = (HOLD - FADE) * i;
    const out = i === frames.length - 1 ? "vout" : `x${i}`;
    filters.push(`[${prev}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${offset.toFixed(2)}[${out}]`);
    prev = out;
    void off;
  }

  const args = [
    "-y", ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "[vout]",
    "-c:v", "libx264", "-preset", "slow", "-crf", "19",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    "-r", String(FPS),
    `${OUT}/qocca_reel_inu_no_kamisama.mp4`,
  ];
  console.log("  ffmpeg: 合成中 …");
  await run(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 64 });
  await rm(TMP, { recursive: true, force: true });
  const total = (HOLD - FADE) * (frames.length - 1) + HOLD;
  console.log(`\n✅ ${OUT}/qocca_reel_inu_no_kamisama.mp4  (${W}x${H} / 約${total.toFixed(1)}秒 / 無音)`);
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
