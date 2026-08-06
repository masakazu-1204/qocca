// ============================================================================
// 動画にQoccaロゴを重ねる (2026/8/4 King要望)
//
// 使い方:
//   node scripts/add-logo.mjs 入力.mp4 出力.mp4 [位置] [開始秒] [終了秒]
//     位置    : br(右下・既定) / bl(左下) / tr(右上) / tl(左上) / center
//     開始/終了: 省略時は全編表示。広告なら終盤だけ出すのも有効
//
//   例) 終盤3秒だけ中央に大きく出す:
//       node scripts/add-logo.mjs in.mp4 out.mp4 center 7 10
//
// 設計メモ:
//   - ロゴは public/qocca_logo.png (585x585・透過PNG)
//   - 画面幅の18%に縮小。小さすぎると読めず、大きすぎると本編を邪魔する
//   - 端から画面幅の5%を余白として空ける(SNSのUIに隠れないように)
// ============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const [input, output, pos = "br", start, end] = process.argv.slice(2);
const LOGO = "public/qocca_logo.png";

if (!input || !output) {
  console.error("使い方: node scripts/add-logo.mjs 入力.mp4 出力.mp4 [br|bl|tr|tl|center] [開始秒] [終了秒]");
  process.exit(1);
}
for (const f of [input, LOGO]) {
  if (!existsSync(f)) { console.error(`見つからない: ${f}`); process.exit(1); }
}

// 動画の実寸を取る(ロゴの大きさを画面比で決めるため)
const sizeOf = (file) => {
  try { execFileSync(ffmpegPath, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) {
    const m = String(e.stderr || "").match(/Stream #\d+:\d+.*: Video:.*?(\d{2,5})x(\d{2,5})/);
    if (m) return { w: Number(m[1]), h: Number(m[2]) };
  }
  return { w: 720, h: 1280 };
};
const { w: VW } = sizeOf(input);

const LOGO_W = Math.round(VW * (pos === "center" ? 0.34 : 0.18));
const M = Math.round(VW * 0.05); // 余白

const xy = {
  br: `x=W-w-${M}:y=H-h-${M}`,
  bl: `x=${M}:y=H-h-${M}`,
  tr: `x=W-w-${M}:y=${M}`,
  tl: `x=${M}:y=${M}`,
  center: `x=(W-w)/2:y=(H-h)/2`,
}[pos] || `x=W-w-${M}:y=H-h-${M}`;

// 時間指定があればその区間だけ表示
const enable = (start !== undefined && end !== undefined)
  ? `:enable='between(t,${start},${end})'` : "";

const filter =
  `[1:v]scale=${LOGO_W}:-1[lg];[0:v][lg]overlay=${xy}${enable}[v]`;

const args = [
  "-y", "-v", "error", "-i", input, "-i", LOGO,
  "-filter_complex", filter, "-map", "[v]",
];
// 音声があればそのまま引き継ぐ(無い動画でも落ちないよう ? を付ける)
args.push("-map", "0:a?", "-c:a", "copy");
args.push("-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
  "-movflags", "+faststart", output);

console.log(`ロゴ合成: ${input} → ${output}`);
console.log(`  位置=${pos} / 幅=${LOGO_W}px / ${enable ? `${start}s〜${end}s` : "全編"}`);
try {
  execFileSync(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });
} catch (e) {
  console.error("ffmpeg 失敗:", e.message);
  process.exit(1);
}
console.log(`完了: ${(statSync(output).size / 1024 / 1024).toFixed(2)} MB`);
