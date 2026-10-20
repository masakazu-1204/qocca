// 2026/10/19 携帯で古い画面のまま更新されない問題 (King「携帯で見たら無い。昔の画面から更新されてない」)
//   原因: サービスワーカー (オフライン用の保存) は新しい版を裏で受け取って即座に切り替わるが、
//         開いている画面そのものは読み直さないので、携帯で開きっぱなし・アプリを再開するだけだと古い版のまま。
//         以前は vite-plugin-pwa が差し込む registerSW.js が登録だけしていて、画面の切り替えは誰もしていなかった。
//   本当の原因 (同日に実機相当で確認): 生成される sw.js に skipWaiting が入っておらず、新しい版は
//         「待機中」で止まっていた。タブ/アプリを全部閉じ切るまで有効にならず、携帯では実質ずっと古い版。
//         → vite.config.ts の workbox に skipWaiting / clientsClaim を明示し、ここでも待機中の版を起こす。
//   方針: 新しい版はすぐ有効にする。画面の読み直しだけを「安全なとき」に行う:
//           1) 別のページへ移動したとき (applyPendingUpdate を App.tsx の画面移動で呼ぶ)
//           2) 10 分以上ほかのアプリに行ってから戻ってきたとき
//         写真を選んでいる最中 (携帯ではファイル選択でいったん画面が隠れる) に読み直すと選択が消えるので、
//         すぐには読み直さない。新しい版の確認は、戻ってきたとき と 30 分ごと。
const AWAY_MS = 10 * 60 * 1000;
const CHECK_MS = 30 * 60 * 1000;

let pending = false;
let reloading = false;
let hiddenAt = 0;

function reloadNow() {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

/** 新しい版が届いていれば、画面を読み直して切り替える。画面移動のたびに呼んでよい。 */
export function applyPendingUpdate(): void {
  if (pending) reloadNow();
}

export function startPwaUpdates(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  // 開発サーバーには sw.js が無い (HTML が返り MIME エラーになる) ので、本番ビルドだけで登録する
  if (!import.meta.env.PROD) return;

  // 初めて入る端末は「前の版」が無いので、切り替えの合図を数えない
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) pending = true;
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      // 古い設定の版が「待機中」で止まっていたら起こす (vite-plugin-pwa の sw.js は SKIP_WAITING を受け付ける)
      const wake = () => { if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" }); };
      wake();
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        nw?.addEventListener("statechange", () => { if (nw.state === "installed") wake(); });
      });
      const check = () => { reg.update().catch(() => { /* オフライン等は無視 */ }); };
      setInterval(() => { if (document.visibilityState === "visible") check(); }, CHECK_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
        const away = hiddenAt ? Date.now() - hiddenAt : 0;
        hiddenAt = 0;
        check();
        if (away >= AWAY_MS) applyPendingUpdate();
      });
    }).catch(() => { /* 登録できない環境では従来どおり普通のサイトとして動く */ });
  });
}
