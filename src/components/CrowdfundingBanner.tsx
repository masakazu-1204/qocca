// クラファン誘導バナー (App.tsx 分割 Phase5 ②gallery / 循環import回避のため抽出)
// HomePage・FacilitiesPage(App.tsx 残留) と GalleryPage(pages/gallery.tsx) の両方が参照するため中立化。
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。専用定数4個は本モジュール private。

import { useNavigate } from "react-router-dom";
import { QC_FONT_DISPLAY } from "../constants/theme";

const CROWDFUNDING_OPEN_DATE = new Date("2026-06-03T09:00:00+09:00");
const CROWDFUNDING_CLOSE_DATE = new Date("2026-06-30T23:59:59+09:00");
const GRAND_OPENING_DATE = new Date("2026-07-01T00:00:00+09:00");
// 依頼書 #137 (2026/6/8): CAMPFIRE 確定 URL + UTM + 期間フラグ統一管理
// 正式形式: /projects/<ID>/view (旧 /projects/view/<ID> は 6/8 監査でバグ判明 → 全置換)
// 終了後は CROWDFUNDING_ACTIVE を false にすれば全導線が消える設計
// ⚠️ CAMPFIRE_PROJECT_URL_WITH_UTM / CROWDFUNDING_ACTIVE は constants/data.ts へ移管 (Phase5 ①static 循環import回避)
const CAMPFIRE_PROJECT_URL = "https://camp-fire.jp/projects/955666/view";

export const CrowdfundingBanner = () => {
  const navigate = useNavigate();
  const now = new Date();

  // 🌅 グランドオープン (7/1) 以降は完全非表示
  if (now >= GRAND_OPENING_DATE) return null;

  const isOpen = now >= CROWDFUNDING_OPEN_DATE && now <= CROWDFUNDING_CLOSE_DATE;
  const daysUntilOpen = Math.max(0, Math.ceil((CROWDFUNDING_OPEN_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const daysUntilClose = Math.max(0, Math.ceil((CROWDFUNDING_CLOSE_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const ctaLabel = isOpen
    ? (CAMPFIRE_PROJECT_URL ? "CAMPFIRE プロジェクトを見る" : "詳しく知る")
    : "もっと詳しく";
  const handleCtaClick = () => {
    if (isOpen && CAMPFIRE_PROJECT_URL) {
      window.open(CAMPFIRE_PROJECT_URL, "_blank", "noopener,noreferrer");
    } else {
      navigate("/about");
    }
  };

  return (
    <div style={{ padding: "24px 16px", display: "flex", justifyContent: "center" }}>
      <div style={{
        background: "linear-gradient(145deg, #FFF9F0 0%, #FFF2DF 100%)",
        border: "1px solid #F5E6D0",
        borderRadius: 16,
        padding: "24px 24px 22px",
        maxWidth: 560,
        width: "100%",
        textAlign: "center",
        boxShadow: "0 2px 12px rgba(245,169,74,0.06)",
      }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>🌅</div>
        {/* 依頼書 #134 Phase 2 案A改 (2026/6/6): 見出し Shippori Mincho 700 で「号」品位 */}
        <div style={{ fontFamily: QC_FONT_DISPLAY, fontSize: 20, fontWeight: 700, color: "#5A4A2C", lineHeight: 1.6, marginBottom: 12, letterSpacing: "0.04em" }}>
          {isOpen ? "Qocca が街として、立ち上がる月です。" : "Qocca の最初の季節を、一緒に。"}
        </div>
        <div style={{ fontSize: 12.5, color: "#8B7355", lineHeight: 1.85, marginBottom: 14 }}>
          {isOpen ? (
            <>
              <strong style={{ color: "#5A4A2C" }}>クラウドファンディング 実施中</strong>（〜2026/6/30）<br />
              特定非営利活動法人アニマルレフュージ関西【ARK】連携・売上の 3% を寄付しています
            </>
          ) : (
            <>
              <strong style={{ color: "#5A4A2C" }}>2026/6/3（水）クラウドファンディング開始</strong><br />
              特定非営利活動法人アニマルレフュージ関西【ARK】連携・売上の 3% を寄付しています
            </>
          )}
        </div>
        <div style={{ display: "inline-block", padding: "5px 14px", background: "rgba(245,169,74,0.10)", color: "#A07640", fontSize: 11, fontWeight: 700, borderRadius: 14, marginBottom: 14, letterSpacing: 0.3 }}>
          {isOpen ? `残り ${daysUntilClose} 日` : `あと ${daysUntilOpen} 日`}
        </div>
        <div>
          <button
            onClick={handleCtaClick}
            style={{
              background: "transparent",
              color: "#A07640",
              border: "1.5px solid #D9B888",
              borderRadius: 22,
              padding: "9px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "rgba(245,169,74,0.12)"; }}
            onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "transparent"; }}
          >
            📖 {ctaLabel} →
          </button>
        </div>
      </div>
    </div>
  );
};
