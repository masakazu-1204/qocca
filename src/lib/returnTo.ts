// 2026/10/18 ログイン後の戻り先 (returnTo)
//   これまで /login?returnTo=... を付けて送っても、ログイン後は必ずホームへ飛んでいた (招待コード受け取り・
//   プロフィール・街だよりの「一枚、置きに行く」が途中で途切れていた)。
//   - URL の returnTo はサイト内の住所 ("/" 始まり・"//" や "\" を含まない) だけ受け付ける (外部への誘導を防ぐ)。
//   - Google ログインやメール確認は一度サイトの外へ出てトップに戻ってくるので、1 時間だけ端末に覚えておく。
const KEY = "qocca_return_to";
const TTL_MS = 60 * 60 * 1000;

export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.length > 300) return null;
  if (v.startsWith("/login")) return null; // ログイン画面へ戻すと堂々巡りになる
  return v;
}

export function returnToFromSearch(search: string): string | null {
  try { return safeReturnTo(new URLSearchParams(search).get("returnTo")); } catch (_) { return null; }
}

export function rememberReturnTo(path: string): void {
  const p = safeReturnTo(path);
  if (!p) return;
  try { localStorage.setItem(KEY, JSON.stringify({ p, exp: Date.now() + TTL_MS })); } catch (_) { /* no-op */ }
}

/** 覚えている戻り先を 1 回だけ取り出す (取り出したら消す)。期限切れや不正な値は null。 */
export function takeReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { p, exp } = JSON.parse(raw) as { p?: string; exp?: number };
    if (!exp || exp < Date.now()) return null;
    return safeReturnTo(p);
  } catch (_) { return null; }
}

export function clearReturnTo(): void {
  try { localStorage.removeItem(KEY); } catch (_) { /* no-op */ }
}
