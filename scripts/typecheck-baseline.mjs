// 型エラーの「基準線」チェック
//
//   背景: この repo の tsc は 2026/9/7 時点で 106 件のエラーがあり、赤のまま運用されてきた。
//   vite build は型を検査しないため緑に見え、誰も型を見ていない状態だった。
//   全部を一度に直すのは大仕事なので、まず「これ以上増やさない」を機械的に守る。
//
//   使い方:
//     node scripts/typecheck-baseline.mjs            現在のエラーを基準線と比べる。増えていたら exit 1
//     node scripts/typecheck-baseline.mjs --update   現在のエラーを基準線として typecheck-baseline.json に保存
//
//   比較の単位は「ファイル | TSコード | メッセージ」。行番号は含めない。
//   行番号は編集でズレるので、それで比べると無関係な差分が出て信用できなくなる。
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const BASELINE = resolve(ROOT, "typecheck-baseline.json");
const update = process.argv.includes("--update");

// ---- tsc を回して、エラー行だけ取り出す ----
const run = spawnSync("npx tsc -p tsconfig.app.json --noEmit --pretty false", {
  cwd: ROOT, shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
});
const lines = `${run.stdout ?? ""}\n${run.stderr ?? ""}`.split(/\r?\n/);
// 例: src/pages/mypage.tsx(2936,77): error TS18048: 'order.price' is possibly 'undefined'.
const RE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const errors = [];
for (const l of lines) {
  const m = RE.exec(l.trim());
  if (m) errors.push({ file: m[1].replace(/\\/g, "/"), line: +m[2], code: m[4], msg: m[5] });
}
const sig = (e) => `${e.file} | ${e.code} | ${e.msg}`;

// 多重集合として数える (同じエラーが同じファイルに複数あることは普通にある)
const count = (arr) => arr.reduce((m, s) => m.set(s, (m.get(s) ?? 0) + 1), new Map());
const current = count(errors.map(sig));

if (update) {
  const list = [...current.entries()].flatMap(([s, n]) => Array(n).fill(s)).sort();
  writeFileSync(BASELINE, JSON.stringify({ updated_at: new Date().toISOString(), total: list.length, errors: list }, null, 2) + "\n");
  console.log(`基準線を保存した: ${list.length} 件 → typecheck-baseline.json`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("基準線がない。まず --update で作る。");
  process.exit(2);
}
const base = count(JSON.parse(readFileSync(BASELINE, "utf8")).errors);

// 増えたもの / 減ったもの
const added = [], removed = [];
for (const [s, n] of current) { const d = n - (base.get(s) ?? 0); if (d > 0) added.push([s, d]); }
for (const [s, n] of base)    { const d = n - (current.get(s) ?? 0); if (d > 0) removed.push([s, d]); }

const total = errors.length, baseTotal = [...base.values()].reduce((a, b) => a + b, 0);
console.log(`型エラー ${total} 件 / 基準線 ${baseTotal} 件 (${total - baseTotal >= 0 ? "+" : ""}${total - baseTotal})`);

if (removed.length) {
  console.log(`\n減った (${removed.reduce((a, [, n]) => a + n, 0)} 件):`);
  for (const [s, n] of removed) console.log(`  −${n}  ${s}`);
}
if (added.length) {
  console.log(`\n❌ 増えた (${added.reduce((a, [, n]) => a + n, 0)} 件) — 今回の変更で新しく出た型エラー:`);
  for (const [s, n] of added) {
    console.log(`  +${n}  ${s}`);
    // どの行か分かるように、該当する現在のエラーの行番号も出す
    for (const e of errors) if (sig(e) === s) console.log(`         ${e.file}:${e.line}`);
  }
  process.exit(1);
}
if (removed.length) console.log("\n減っただけなら --update で基準線を下げておく。");
console.log("✅ 新しい型エラーは無い");
