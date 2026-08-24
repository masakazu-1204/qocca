// Qocca CM ビルダー (2026/8/25)
//
// 生成済みの縦動画クリップを、静けさ Redesign 準拠の 1本の CM に組み立てる。
//
//   使い方:
//     node scripts/build-cm.mjs 出力.mp4 "clip.mp4:開始:終了" ... [--copy "..."] [--sub "..."]
//   例:
//     node scripts/build-cm.mjs cm-out/qocca_cm_15s.mp4 \
//       cm-out/cut1.mp4:0:4.0 cm-out/cut2.mp4:1.2:5.0 \
//       cm-out/cut3.mp4:1.0:5.0 cm-out/cut4.mp4:0.6:5.0
//
//   --copy  締めのコピー (既定: うちの子を愛してる人が集まる街。)
//   --sub   その下に置く小さい一行 (任意)。広告の飛び先ごとの一言に使う。
//
// やること:
//   1. 各クリップを指定区間で切り出し、1080x1920 に揃える (Meta 推奨サイズ)
//   2. カット間を 0.5秒のディゾルブで繋ぐ (静けさ: ハードカットを使わない)
//   3. 末尾に締めのカード (コピー + ロゴ) を 0.9秒かけて重ねる
//   4. 無音の AAC トラックを付ける (音楽は scripts/add-music.mjs で後乗せ)
//
// ⚠️ 静けさルール準拠: 絵文字なし / 純黒・純白なし / transition は 0.5s 以上 /
//    フォントは QC_FONT_DISPLAY のフォールバックである游明朝 / 煽り表現なし。
// ⚠️ Windows の drawtext は fontfile のコロンをエスケープする必要がある。

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

// ── 静けさトークン (src/constants/theme.ts の QC と対応) ──────────────
// ⚠️ ffmpeg の 0xRRGGBB は RGB そのまま。BGR ではない (2026/8/25 実測で確認)。
const BG = "0xFAF7F2";        // QC.warmWhite
const INK = "0x8B6F5C";       // QC.softBrown  (コピー)
const MARK_INK = "0x2C2926";  // QC.charcoal   (ワードマーク)
const DEFAULT_COPY = "うちの子を愛してる人が集まる街。";
const SUB_INK = "0xA8B59E";   // QC.sage (小さい一行。主役のコピーより一段引く)
const LOGO = "public/qocca_logo.png";

const W = 1080, H = 1920, FPS = 24;
const XFADE = 0.5;            // カット間のディゾルブ
const OUTRO_IN = 0.9;         // 締めカードへの溶け込み (ゆっくり)
const OUTRO_HOLD = 3.4;       // 締めカードの尺
const FONT = "C:/Windows/Fonts/yumin.ttf";      // 游明朝 (QC_FONT_DISPLAY のフォールバック)
const FONT_EN = "C:/Windows/Fonts/georgia.ttf"; // QC_FONT_EN のフォールバック (セリフ)

// --copy / --sub を先に抜き取り、残りを「出力 + クリップ指定」として扱う
const argv = process.argv.slice(2);
const takeOpt = (name) => {
  const i = argv.indexOf(name);
  if (i < 0) return null;
  const v = argv[i + 1];
  if (v === undefined) { console.error(`${name} の値が無い`); process.exit(1); }
  argv.splice(i, 2);
  return v;
};
const COPY = takeOpt("--copy") ?? DEFAULT_COPY;
const SUB = takeOpt("--sub");

const [out, ...specs] = argv;
if (!out || specs.length < 2) {
  console.error('使い方: node scripts/build-cm.mjs 出力.mp4 "clip.mp4:開始:終了" ... [--copy "..."] [--sub "..."]');
  process.exit(1);
}

// "path:start:end" を分解する。Windows の "C:/..." があるので末尾2つだけを数値として剥がす。
const clips = specs.map((s) => {
  const parts = s.split(":");
  const end = Number(parts.pop());
  const start = Number(parts.pop());
  const path = parts.join(":");
  if (!existsSync(path)) { console.error(`見つからない: ${path}`); process.exit(1); }
  if (!(end > start)) { console.error(`区間がおかしい: ${s}`); process.exit(1); }
  return { path, start, dur: end - start };
});
if (!existsSync(LOGO)) { console.error(`ロゴが無い: ${LOGO}`); process.exit(1); }

// ディゾルブで重なる分、合計尺は (各尺の合計 - 重なり) になる
const filmDur = clips.reduce((a, c) => a + c.dur, 0) - XFADE * (clips.length - 1);
const total = filmDur + OUTRO_HOLD;

const esc = (p) => p.replace(/\\/g, "/").replace(/:/g, "\\:");
// drawtext の text= は単引用符で囲むため、'  \  % だけ潰せばよい
// (% は drawtext が strftime 展開に使う)
const escText = (t) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/%/g, "\\%");

// ── フィルタグラフ ───────────────────────────────────────────
const parts = [];

// 1) 各クリップ: 指定区間を切り出し → 1080x1920 に揃える
clips.forEach((c, i) => {
  parts.push(
    `[${i}:v]trim=start=${c.start}:duration=${c.dur},setpts=PTS-STARTPTS,` +
    `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p[c${i}]`
  );
});

// 2) 順にディゾルブで連結。offset は「それまでの尺 - 重なり」
let prev = "c0", acc = clips[0].dur;
for (let i = 1; i < clips.length; i++) {
  const offset = (acc - XFADE).toFixed(3);
  const label = i === clips.length - 1 ? "film" : `x${i}`;
  parts.push(`[${prev}][c${i}]xfade=transition=dissolve:duration=${XFADE}:offset=${offset}[${label}]`);
  prev = label;
  acc += clips[i].dur - XFADE;
}

// 3) 締めのカード: 無地 → コピー → マーク → ワードマーク。フィルム側からゆっくり溶ける。
//    ⚠️ ロゴ画像はマークのみで社名が入らないため、CM の締めとして名前が読めない。
//       下にワードマークを描き足して「Qocca」を必ず残す。
// ⚠️ ロゴは透過PNG。overlay の前に yuv420p へ落とすとアルファが死んで
//    白い箱が出る (2026/8/25 実測)。rgba のまま重ね、最後に yuv420p にする。
const subLine = SUB
  ? `drawtext=fontfile='${esc(FONT)}':text='${escText(SUB)}':fontcolor=${SUB_INK}:fontsize=30:` +
    `x=(w-text_w)/2:y=(h/2)-130,`
  : "";

parts.push(
  `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${(OUTRO_HOLD + OUTRO_IN).toFixed(3)},format=rgba,` +
  `drawtext=fontfile='${esc(FONT)}':text='${escText(COPY)}':fontcolor=${INK}:fontsize=58:` +
  `x=(w-text_w)/2:y=(h/2)-220,` +
  subLine +
  `drawtext=fontfile='${esc(FONT_EN)}':text='Qocca':fontcolor=${MARK_INK}:fontsize=62:` +
  `x=(w-text_w)/2:y=(h/2)+250[card_t]`,
  `[${clips.length}:v]scale=${Math.round(W * 0.16)}:-1,format=rgba[lg]`,
  `[card_t][lg]overlay=x=(W-w)/2:y=(H/2)+40:format=auto,format=yuv420p[card]`,
  // フィルム末尾に締めカードを重ねる (offset = フィルム尺 - 溶け込み時間)
  `[film][card]xfade=transition=fade:duration=${OUTRO_IN}:offset=${(filmDur - OUTRO_IN).toFixed(3)}[v]`
);

const args = [
  "-y", "-v", "error",
  ...clips.flatMap((c) => ["-i", c.path]),
  "-i", LOGO,
  // 無音トラック (Meta は音声トラックがある方が扱いが素直。音楽は後乗せ)
  "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
  "-filter_complex", parts.join(";"),
  "-map", "[v]", "-map", `${clips.length + 1}:a`,
  "-t", total.toFixed(3),
  "-c:v", "libx264", "-preset", "slow", "-crf", "19",
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
  "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
  "-movflags", "+faststart",
  out,
];

execFileSync(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });

console.log(`できた: ${out}`);
clips.forEach((c, i) => console.log(`  カット${i + 1}  ${c.path}  ${c.start}s から ${c.dur.toFixed(1)}秒`));
console.log(`  本編 ${filmDur.toFixed(1)}秒 + 締め ${OUTRO_HOLD}秒 = ${total.toFixed(1)}秒 / ${W}x${H} / 無音`);
console.log(`  音楽: node scripts/add-music.mjs ${out} 曲.mp3 出力.mp4`);
