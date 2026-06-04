// ============================================
// Meta Pixel ラッパー (依頼書 #121, 2026/6/5)
//
// 🛡️ 安全設計 3 原則:
//   1. VITE_META_PIXEL_ID 未設定 / 空 → 全関数 完全 no-op (ID 投入前 deploy でもエラーゼロ・通信ゼロ)
//   2. localhost / 127.0.0.1 / 0.0.0.0 では発火しない (開発ノイズ防止)
//   3. 個人情報 (email / 氏名 / 住所) は一切 params に含めない
//
// 標準イベント (Qocca マッピング):
//   - PageView             : 全ルート遷移
//   - CompleteRegistration : 新規登録完了 (signUp 成功直後)
//   - ViewContent          : 商品詳細ページ表示
//   - InitiateCheckout     : 購入ボタン押下 (create-checkout 呼出直前)
//   - Purchase             : 決済成功画面表示 (order_id 単位で重複ガード)
// ============================================

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

// Vite ビルド時に注入される環境変数 (未設定なら undefined)
const PIXEL_ID: string | undefined = (import.meta as any)?.env?.VITE_META_PIXEL_ID;

// 開発環境判定 (SSR 安全)
function isDev(): boolean {
  if (typeof window === "undefined") return true;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h.endsWith(".local");
}

// 有効状態判定: ID 設定済み & 本番環境 & ブラウザ
function isEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof PIXEL_ID === "string" &&
    PIXEL_ID.trim() !== "" &&
    !isDev()
  );
}

let initialized = false;

/**
 * Meta Pixel 初期化 (アプリ起動時 1 回呼ぶ)
 * - fbevents.js を非同期ロード
 * - fbq('init', PIXEL_ID) で Pixel 紐付け
 * - fbq('track', 'PageView') で初回 PageView 発火
 * - 二重 init ガード済
 */
export function initMetaPixel(): void {
  if (!isEnabled() || initialized) return;
  try {
    // Meta 公式 fbq ベースコード (Anthropic レビュー済 公式パターン)
    /* eslint-disable */
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s && s.parentNode && s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    /* eslint-enable */
    window.fbq("init", PIXEL_ID);
    window.fbq("track", "PageView");
    initialized = true;
  } catch (e) {
    // 失敗しても他機能に影響させない
    // eslint-disable-next-line no-console
    console.warn("[metaPixel] init failed", e);
  }
}

/**
 * 追加 PageView (SPA ルート遷移時)
 * - 初回は init() 内で発火済のため、ルート変更時のみ呼ぶ側で制御する
 */
export function trackPageView(): void {
  if (!isEnabled() || !initialized || !window.fbq) return;
  try {
    window.fbq("track", "PageView");
  } catch (_) {
    /* no-op */
  }
}

/**
 * 標準イベント発火
 * @param name Meta 標準イベント名 (CompleteRegistration / ViewContent / InitiateCheckout etc.)
 * @param params value / currency / content_ids など (個人情報禁止)
 */
export function trackEvent(name: string, params?: Record<string, any>): void {
  if (!isEnabled() || !initialized || !window.fbq) return;
  try {
    if (params && Object.keys(params).length > 0) {
      window.fbq("track", name, params);
    } else {
      window.fbq("track", name);
    }
  } catch (_) {
    /* no-op */
  }
}

/**
 * Purchase 専用: order_id 単位の重複発火ガード
 * 成功画面リロードで二重計上しないよう sessionStorage で記録
 */
export function trackPurchaseOnce(
  orderId: string,
  params: { value: number; currency: string; content_ids?: string[] }
): void {
  if (!isEnabled() || !initialized || !window.fbq || !orderId) return;
  const key = `qocca_mp_purchase_${orderId}`;
  try {
    if (sessionStorage.getItem(key)) return;
    window.fbq("track", "Purchase", params);
    sessionStorage.setItem(key, "1");
  } catch (_) {
    // sessionStorage 不可環境 (Safari Private 等) でも 1 回は発火させる
    try {
      window.fbq("track", "Purchase", params);
    } catch (__) {
      /* no-op */
    }
  }
}

/**
 * デバッグ用: 現在の有効状態を返す (テスト/動作確認のみ。production 利用想定なし)
 */
export function _metaPixelStatus(): { enabled: boolean; initialized: boolean; pixelIdSet: boolean; dev: boolean } {
  return {
    enabled: isEnabled(),
    initialized,
    pixelIdSet: typeof PIXEL_ID === "string" && PIXEL_ID.trim() !== "",
    dev: isDev(),
  };
}
