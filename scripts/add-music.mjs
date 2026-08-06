// ============================================================================
// 動画に音楽(BGM)を合成する (2026/8/5 King要望: SUNOで作った曲を広告に乗せる)
//
// 使い方:
//   node scripts/add-music.mjs 入力.mp4 曲.mp3 出力.mp4 [音量] [--keep-voice]
//     音量        : 0.0〜1.0 (既定 0.8)。--keep-voice 時は自動で 0.25 に下げる
//     --keep-voice: 元動画の音声(セリフ)を残してBGMを下に敷く
//
//   例) セリフ入り広告にBGMを薄く敷く:
//       node scripts/add-music.mjs ad.mp4 song.mp3 out.mp4 --keep-voice
//
// 設計メモ:
//   - 曲が動画より短ければループ、長ければ動画尺で切る(-shortest では
//     元動画が無音だと尺が壊れるため、明示的に atrim する)
//   - 頭0.3秒/尻1.2秒のフェードを必ず入れる。ブツ切りは安っぽく聞こえる。
//   - ★著作権: 広告で使う曲は商用利用可のものに限る。SUNOは有料プランのみ
//     商用利用が認められる。流行曲の流用は広告では使えない。
// ============================================================================
import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";

const argv = process.argv.slice(2);
const keepVoice = argv.includes("--keep-voice");
const rest = argv.filter(a => a !== "--keep-voice");
const [input, music, output, volArg] = rest;

if (!input || !music || !output) {
  console.error('使い方: node scripts/add-music.mjs 入力.mp4 曲.mp3 出力.mp4 [音量] [--keep-voice]');
  process.exit(1);
}
for (const f of [input, music]) {
  if (!existsSync(f)) { console.error(`見つからない: ${f}`); process.exit(1); }
}

const VOL = volArg !== undefined ? Number(volArg) : (keepVoice ? 0.25 : 0.8);
if (!Number.isFinite(VOL) || VOL < 0 || VOL > 2) {
  console.error(`音量が不正: ${volArg}`); process.exit(1);
}

/** ffmpeg -i は必ず例外を投げるので、stderr から拾う */
const probe = (file) => {
  try { execFileSync(ffmpegPath, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] }); return ""; }
  catch (e) { return String(e.stderr || ""); }
};
const durationOf = (file) => {
  const m = probe(file).match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
};
const hasAudio = (file) => /Stream #\d+:\d+.*: Audio:/.test(probe(file));

const VDUR = durationOf(input);
const MDUR = durationOf(music);
if (VDUR <= 0) { console.error("動画の尺が取れなかった"); process.exit(1); }

const voice = keepVoice && hasAudio(input);
if (keepVoice && !voice) console.log("※ 元動画に音声が無いので BGM のみで書き出す");

// 曲が短ければループさせる (-stream_loop は入力オプションなので -i の前に置く)
const loops = MDUR > 0 ? Math.max(0, Math.ceil(VDUR / MDUR) - 1) : 0;

const FADE_OUT_AT = Math.max(0, VDUR - 1.2).toFixed(2);
const bgm =
  `[1:a]atrim=duration=${VDUR.toFixed(2)},asetpts=N/SR/TB,` +
  `volume=${VOL},afade=t=in:st=0:d=0.3,afade=t=out:st=${FADE_OUT_AT}:d=1.2[bgm]`;

const filter = voice
  // セリフを主役に、BGMを下に敷く。dropout_transition=0 で音量の揺れを防ぐ
  ? `${bgm};[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[voc];` +
    `[voc][bgm]amix=inputs=2:duration=first:dropout_transition=0,alimiter=limit=0.95[a]`
  : `${bgm};[bgm]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a]`;

const args = [
  "-y", "-v", "error",
  "-i", input,
  ...(loops > 0 ? ["-stream_loop", String(loops)] : []), "-i", music,
  "-filter_complex", filter,
  "-map", "0:v:0", "-map", "[a]",
  "-c:v", "copy",              // 映像は無劣化でそのまま
  "-c:a", "aac", "-b:a", "192k",
  "-movflags", "+faststart",
  output,
];

console.log(`BGM合成: ${input} + ${music} → ${output}`);
console.log(`  動画 ${VDUR.toFixed(1)}s / 曲 ${MDUR.toFixed(1)}s${loops ? ` (${loops + 1}回ループ)` : ""}`);
console.log(`  音量 ${VOL} / ${voice ? "元のセリフを残す" : "BGMのみ"}`);
try {
  execFileSync(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });
} catch (e) {
  console.error("ffmpeg 失敗:", e.message);
  process.exit(1);
}
console.log(`完了: ${(statSync(output).size / 1024 / 1024).toFixed(2)} MB`);
