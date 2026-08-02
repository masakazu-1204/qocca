// src/pages/welcome.tsx — 広告の専用着地ページ (2026/7/31)
//
// 背景: Meta のアプリ内ブラウザから外部ブラウザへ遷移すると utm_* もリファラーも失われ、
//   7月の登録21名は全て「直接/不明」に落ちていた (広告の貢献が測定不能)。
//   → 広告の着地先をこの専用パスにすることで「landing_path そのもの」が経路の証拠になる。
//     クエリが消えてもパスは残るため、QRカードと同じ理屈で確実に効く。
//     記録は lib/attribution.ts の captureAttribution() が担当 (このページは何もしない)。
//
// もう一つの狙い: 広告からの訪問をホームに落とすと情報量が多く離脱しやすいため、
//   「Qoccaが何か」と「登録」だけに絞った静かな一枚を用意する。
//
// URL:
//   /welcome            … 汎用 (この着地ページを表示)
//   /welcome/:tag       … 広告別。tag は landing_path として記録される
//   /welcome/petwalker  … 記録だけして そのまま /petwalker へ送る (2026/7/31 King指示)
//                         「広告の約束どおりの画面に着地させる」ため、着地ページを挟まない。
//                         計測は App マウント時の captureAttribution() が済ませているので、
//                         ここで即座に転送しても landing_path は残る。
//
// ⚠️ 静けさ Redesign 準拠: 絵文字なし / 純黒・純白なし / font-weight 最大500 /
//    transition 0.8s / 「今すぐ」等の煽り表現を使わない。

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QC, QC_FONT_JP, QC_FONT_DISPLAY } from "../constants/theme";
import { useSEO } from "../hooks/useSEO";
import { useAuth } from "../contexts/AuthContext";

// 飛び先キー → 実際のルート。着地ページを見せずに目的の画面へ直行させたいとき用。
// ⚠️ 転送先は既存ルートをそのまま使う (PetWalker は /petwalker/* の内部URL制御を持つため、
//    別パスで描画せず通常ルートへ送ることで再マウント等の副作用を避ける)。
const DEST_ROUTE: Record<string, string> = {
  petwalker: "/petwalker",
  facilities: "/facilities",
  marketplace: "/marketplace",
  gallery: "/gallery",
  blog: "/blog",
  events: "/events",
  home: "/",
};

const LINKS: { to: string; label: string; note: string }[] = [
  { to: "/marketplace", label: "商店街をのぞく", note: "ペット専門の作家さんの作品" },
  { to: "/facilities", label: "おでかけ先をさがす", note: "全国のペット関連施設 約3,500件" },
  { to: "/petwalker", label: "散歩コースをさがす", note: "うちの子と歩ける場所 約1,550件" },
];

/** 転送だけを担う。着地ページ側の useSEO を通さないので、
 *  転送先のタブタイトルや noindex を汚さない。 */
const CampaignRedirect = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  // replace で履歴を残さない (戻るで /welcome に戻って再転送されるのを防ぐ)
  useEffect(() => { navigate(to, { replace: true }); }, [to, navigate]);
  return null;
};

export const WelcomePage = () => {
  // /welcome/:tag        … tag が流入元 (threads / x / instagram / adc など)
  // /welcome/:tag/:dest  … dest が飛び先 (petwalker など)。流入元と飛び先を組み合わせられる
  const { tag, dest } = useParams();
  // 飛び先は「第2セグメント優先」。無ければ tag 自体を飛び先として解釈する
  // (/welcome/petwalker のような従来の広告URLをそのまま活かすため)。
  const redirectTo = (dest && DEST_ROUTE[dest]) || (!dest && tag ? DEST_ROUTE[tag] : undefined);
  // 計測は App マウント時の captureAttribution() が済ませているため、
  // ここで即座に転送しても landing_path (= /welcome/threads/petwalker 等) は残る。
  return redirectTo ? <CampaignRedirect to={redirectTo} /> : <WelcomeLanding />;
};

const WelcomeLanding = () => {
  const navigate = useNavigate();
  const { tag } = useParams();
  const { user } = useAuth();
  const [shown, setShown] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 768
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    const t = setTimeout(() => setShown(true), 60);
    return () => { window.removeEventListener("resize", check); clearTimeout(t); };
  }, []);

  useSEO({
    title: "Qocca(クオッカ)へようこそ｜うちの子を愛してる人が集まる街",
    description:
      "Qoccaは、ペットオーナーとクリエイターをつなぐ日本発のマーケットプレイスです。ペット同伴可の施設マップや散歩スポットも収録。登録は無料です。",
    path: tag ? `/welcome/${tag}` : "/welcome",
    // 広告の着地ページは検索結果に出す必要がなく、重複コンテンツ扱いも避けたいので noindex
    noindex: true,
  });

  const fade = (delay: number) => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "translateY(0)" : "translateY(8px)",
    transition: `opacity 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: QC.warmWhite,
      fontFamily: QC_FONT_JP,
      padding: isMobile ? "72px 20px 80px" : "120px 24px 120px",
      display: "flex",
      justifyContent: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        <div style={{ ...fade(0), fontSize: 11, letterSpacing: "0.18em", color: QC.sage, marginBottom: isMobile ? 28 : 36 }}>
          QOCCA
        </div>

        <h1 style={{
          ...fade(0.1),
          fontFamily: QC_FONT_DISPLAY,
          fontSize: isMobile ? 26 : 34,
          fontWeight: 500,
          color: QC.charcoal,
          lineHeight: 1.75,
          letterSpacing: "0.04em",
          margin: 0,
        }}>
          うちの子を愛してる人が、<br />集まる街です。
        </h1>

        <p style={{
          ...fade(0.2),
          fontSize: isMobile ? 13.5 : 14.5,
          fontWeight: 300,
          color: QC.warmGray,
          lineHeight: 2.1,
          marginTop: isMobile ? 26 : 34,
        }}>
          ペットのための作品をつくる人と、<br />
          うちの子を想う人が出会う場所。<br /><br />
          おでかけできる施設や、一緒に歩ける散歩道も、<br />
          この街のなかにあります。
        </p>

        <div style={{ ...fade(0.3), height: 1, background: QC.lightSand, margin: isMobile ? "38px 0" : "48px 0" }} />

        {user ? (
          <div style={{ ...fade(0.35) }}>
            <p style={{ fontSize: 13.5, fontWeight: 300, color: QC.warmGray, lineHeight: 2, marginTop: 0, marginBottom: 24 }}>
              おかえりなさい。街はいつでも開いています。
            </p>
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "15px 34px", background: QC.terracotta, border: "none", borderRadius: 2,
                color: QC.warmWhite, fontSize: 14, fontWeight: 500, letterSpacing: "0.08em",
                cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.8s ease-out",
              }}
            >
              街へ入る
            </button>
          </div>
        ) : (
          <div style={{ ...fade(0.35) }}>
            <p style={{ fontSize: 13.5, fontWeight: 300, color: QC.warmGray, lineHeight: 2, marginTop: 0, marginBottom: 24 }}>
              登録は無料です。<br />
              住民になると、お気に入りの保存や作家さんへの相談ができます。
            </p>
            <button
              onClick={() => navigate("/login")}
              style={{
                padding: "15px 34px", background: QC.terracotta, border: "none", borderRadius: 2,
                color: QC.warmWhite, fontSize: 14, fontWeight: 500, letterSpacing: "0.08em",
                cursor: "pointer", fontFamily: "inherit", transition: "opacity 0.8s ease-out",
              }}
            >
              住民になる
            </button>
          </div>
        )}

        <div style={{ ...fade(0.45), marginTop: isMobile ? 44 : 56 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: QC.sage, marginBottom: 18 }}>
            まずは のぞいてみる
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {LINKS.map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(l.to)}
                style={{
                  background: "transparent", border: "none", borderTop: `1px solid ${QC.lightSand}`,
                  padding: "18px 2px", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                  transition: "opacity 0.8s ease-out",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 400, color: QC.softBrown, letterSpacing: "0.02em" }}>
                  {l.label}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 300, color: QC.warmGray, marginTop: 5, lineHeight: 1.8 }}>
                  {l.note}
                </div>
              </button>
            ))}
          </div>
        </div>

        <p style={{ ...fade(0.55), fontSize: 11, fontWeight: 300, color: QC.sage, lineHeight: 2, marginTop: isMobile ? 40 : 52 }}>
          売上の3%を、特定非営利活動法人アニマルレフュージ関西へ寄付しています。
        </p>

      </div>
    </div>
  );
};
