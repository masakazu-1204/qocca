// ============================================================================
// ミーム動画 テキスト焼き込み v2 (2026/8/4)
//   参考: @hama.stage (60万いいね) — 映像 + 大きな日本語テキストのミーム型。
//   ショートは音を消して見る人が多いため、テキストが実質の本体になる。
//
// ★v2の要点: テキストを「時間で切り替えられる」ようにした。
//   オチは "後から出る" から効く。出しっぱなしだと落ちない(v1の失敗)。
//
// 使い方:
//   node scripts/add-meme-text.mjs 入力.mp4 出力.mp4 \
//     --seg "0,5,top,今日からダイエットします" \
//     --seg "5,10,top,3秒後" \
//     --seg "6,10,bottom,ムリでした"
//
//   --seg "開始秒,終了秒,位置,テキスト"   位置は top / center / bottom
//   改行したい場合はテキスト内に \n を書く
//
// 設計メモ:
//   - 白文字+黒フチ。どんな映像の上でも読める(SNSの定番)。
//   - フォントは Windows 同梱 Meiryo Bold。日本語が確実に出る。
//   - ⚠️ ffmpeg drawtext の癖:
//       fontsize は数式OK / borderw は整数のみ / Windowsパスの ':' はエスケープ必須
// ============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const argv = process.argv.slice(2);
const [input, output] = argv.filter(a => !a.startsWith("--") && !/^\d/.test(a)).slice(0, 2);

// --seg を全部集める
const segs = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--seg" && argv[i + 1]) {
    const raw = argv[i + 1];
    const m = raw.match(/^([\d.]+),([\d.]+),(top|center|bottom),([\s\S]+)$/);
    if (!m) { console.error(`--seg の書式が違う: ${raw}`); process.exit(1); }
    segs.push({ start: Number(m[1]), end: Number(m[2]), pos: m[3], text: m[4] });
    i++;
  }
}

if (!input || !output || segs.length === 0) {
  console.error('使い方: node scripts/add-meme-text.mjs 入力.mp4 出力.mp4 --seg "0,5,top,テキスト" [--seg ...]');
  process.exit(1);
}
if (!existsSync(input)) { console.error(`見つからない: ${input}`); process.exit(1); }

const FONT = "C:/Windows/Fonts/meiryob.ttc";
const fontFileArg = FONT.replace(/\\/g, "/").replace(/:/g, "\\:");

// ⚠️ borderw は数式を受け付けない(整数のみ)。fontsize は数式OKという非対称仕様。
const BORDER_W = 7;

// drawtext のテキスト側エスケープ。' は typographic に置換して壊れを避ける
const esc = (s) => s
  .replace(/\\n/g, "\n")
  .replace(/\\/g, "\\\\")
  .replace(/:/g, "\\:")
  .replace(/'/g, "\u2019")
  .replace(/%/g, "\\%");

const yOf = (pos) => pos === "top" ? "h*0.07" : pos === "bottom" ? "h*0.80" : "(h-text_h)/2";

const filters = segs.map(s =>
  `drawtext=fontfile='${fontFileArg}':text='${esc(s.text)}':` +
  `fontcolor=white:fontsize=h/17:borderw=${BORDER_W}:bordercolor=black@0.92:` +
  `x=(w-text_w)/2:y=${yOf(s.pos)}:line_spacing=14:` +
  `enable='between(t,${s.start},${s.end})'`
);

const args = [
  "-y", "-v", "error", "-i", input,
  "-vf", filters.join(","),
  "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
  "-c:a", "copy",          // 音声はそのまま(再エンコードで劣化させない)
  "-movflags", "+faststart",
  output,
];

console.log(`テキスト焼き込み: ${input} → ${output} (${segs.length}区間)`);
segs.forEach(s => console.log(`  ${s.start}s〜${s.end}s [${s.pos}] ${s.text.replace(/\\n/g, " / ")}`));
try {
  execFileSync(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });
} catch (e) {
  console.error("ffmpeg 失敗:", e.message);
  process.exit(1);
}
console.log(`完了: ${(statSync(output).size / 1024 / 1024).toFixed(2)} MB`);
