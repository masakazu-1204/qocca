// 配信用の書き出し (2026/8/25)
//
//   node scripts/finalize-video.mjs 入力.mp4 出力.mp4 [目標LUFS]
//
// 完成した動画を「そのまま SNS・広告に出せる状態」にする。
// 過去に実際ハマった2つを、ここで必ず潰す。
//
// ⚠️ ビットレートが高すぎると Instagram に弾かれる。
//    2026/8 実測: 10,318 kb/s は container_error で失敗、1,845 kb/s は成功。
//    crf 23 + maxrate 5M で 3,000 kb/s 前後に収め、画質は保ったまま安全圏に入れる。
//
// ⚠️ 音が小さいまま出すと、他の広告に埋もれて飛ばされる。
//    ナレーション + BGM を混ぜただけだと平均 -26dB 程度まで下がることがある。
//    loudnorm の2パスで -15 LUFS 前後に整える。1パスだと音が波打つので使わない。
//    (2パス = まず測ってから、その実測値を使って掛け直す)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const [input, output, lufsArg] = process.argv.slice(2);
if (!input || !output) {
  console.error("使い方: node scripts/finalize-video.mjs 入力.mp4 出力.mp4 [目標LUFS]");
  process.exit(1);
}
if (!existsSync(input)) { console.error(`見つからない: ${input}`); process.exit(1); }

const I = lufsArg !== undefined ? Number(lufsArg) : -15;   // SNS は -14 前後が標準
const TP = -1.5;                                            // 真のピーク上限
const LRA = 11;

const run = (args) => execFileSync(ffmpegPath, args, { encoding: "buffer" });

// ── 1パス目: 今の音量を測る ────────────────────────────────
// ⚠️ loudnorm の測定結果は stdout ではなく stderr に出る。しかも ffmpeg 自体は
//    正常終了するため、execFileSync では stderr を取り逃がして必ず測定失敗になる。
//    spawnSync なら成功時も stderr が受け取れる。
let measured = null;
{
  const r = spawnSync(ffmpegPath, [
    "-hide_banner", "-i", input,
    "-af", `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`,
    "-f", "null", "-",
  ], { encoding: "utf8" });
  const text = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const open = text.lastIndexOf("{");
  const close = text.indexOf("}", open);
  if (open >= 0 && close > open) {
    try { measured = JSON.parse(text.slice(open, close + 1)); } catch (_) { /* 下で1パスに落ちる */ }
  }
}

let af;
if (measured?.input_i) {
  af = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}` +
       `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}` +
       `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}` +
       `:offset=${measured.target_offset ?? 0}:linear=true`;
  console.log(`  測定: ${measured.input_i} LUFS / ピーク ${measured.input_tp} dBTP → 目標 ${I} LUFS`);
} else {
  // 測れなかったときは1パスで掛ける。音が波打つ可能性があるぶん、劣る。
  af = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}`;
  console.warn("  ⚠️ 音量の測定に失敗。1パスで整えるため、音が少し波打つことがある");
}

// ── 2パス目: 映像も音も配信用に書き出す ─────────────────────
run([
  "-y", "-v", "error", "-i", input,
  "-c:v", "libx264", "-preset", "slow", "-crf", "23",
  "-maxrate", "5M", "-bufsize", "10M",
  "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.0",
  "-af", af,
  "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
  "-movflags", "+faststart",
  output,
]);

// 仕上がりの確認 (数字で残す。目視・耳で気づけない事故を防ぐ)
const info = (() => {
  try {
    execFileSync(ffmpegPath, ["-hide_banner", "-i", output], { stdio: ["ignore", "pipe", "pipe"] });
    return "";
  } catch (e) { return (e.stderr ?? "").toString(); }
})();
const br = info.match(/bitrate: (\d+) kb\/s/)?.[1];
const dur = info.match(/Duration: ([\d:.]+)/)?.[1];

console.log(`できた: ${output}`);
console.log(`  ${dur} / ${br} kb/s  (Instagram が弾く水準は 10,000 kb/s 前後・実測)`);
