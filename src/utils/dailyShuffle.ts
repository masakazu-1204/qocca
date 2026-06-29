// 2026/6/29 日替わりシャッフル ユーティリティ
// 「その日の中では同じ並び・日付が変わると並びが変わる」を実現するシード付き Fisher-Yates。
// 用途: うちの子ギャラリー / 街で愛されている作品 など、全アイテムに均等な露出を回したいリスト。
//
// ⚠️ 「街のアルバム (SectionTodaysMoments)」が使ってる `Math.random()` 毎回ランダム
//    とは別物。Math.random() は同じ日でもリロードのたびに並びが変わってしまう。
//    本ユーティリティは日付シードなので、同日内は安定 (UX 上ブレない)、翌日は変わる。
//
// 採用 PRNG: mulberry32 — 1関数で完結、種値1個、安定性も十分な広く使われる軽量乱数。

const mulberry32 = (seed: number): (() => number) => {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/** 日付ベースの整数シードを返す (例: 2026/6/29 → 20260629) */
export const todaySeed = (now: Date = new Date()): number => {
  return now.getFullYear() * 10_000 + (now.getMonth() + 1) * 100 + now.getDate();
};

/**
 * 日替わりシード付きシャッフル。
 * - 引数配列は変更しない (純粋関数・新規配列を返す)
 * - 同じ日 (todaySeed) なら何度呼んでも同じ並び
 * - 日付が変わると並びが変わる
 *
 * @example
 *   const items = dailySeededShuffle(listings).slice(0, 6); // 日替わり6件
 */
export const dailySeededShuffle = <T>(arr: readonly T[]): T[] => {
  const rng = mulberry32(todaySeed());
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
