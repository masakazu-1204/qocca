// ペットウォーカー特集記事 (2026/7/16 Phase1・docs/petwalker-magazine-design.md)
// blog_posts の post_type='magazine' 行を「雑誌の特集」として描画するエディトリアル・レイアウト。
//
// content の構造契約 (半自動生成の型):
//   ・"\n---\n" でセクション分割
//   ・sections[0] = リード文 (見出しなし)
//   ・sections[1..spot_ids.length] = 章。spot_ids と同順対応。先頭行 "## 見出し"
//   ・それ以降 = 結び/モデルコース (スポット非対応の章。先頭行 "## 見出し")
//   ・スポットの写真/ペット可条件/根拠URLは pet_walker_spots から常に最新を表示 (記事に複製しない)
//
// ⚠️ 静けさ世界観: QCトークン・絵文字なし・見出しは Shippori Mincho (QC_FONT_DISPLAY)・
//    weight<=500・transition 0.8s+・本文1段組 maxWidth 640 / 写真は全幅⇄半幅の交互リズム。
import { QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_TIMING } from "../constants/theme";

type MagazineSpot = {
  id: string; name: string; category: string; pref: string; city: string | null;
  description: string | null; source_note: string | null; image_urls: string[] | null;
};

export type MagazineArticle = {
  id: string; title: string; content: string;
  hero_image_url: string | null; spot_ids: string[]; meta_description: string | null;
};

const ease = QC_TIMING.hoverEasing;

// source_note "ペット可根拠: <URL> (<出典名>) | 条件: <条件文>" を分解
function parseSource(note: string | null): { url: string | null; cond: string | null } {
  if (!note) return { url: null, cond: null };
  const url = note.match(/https?:\/\/[^\s)|]+/)?.[0] || null;
  const cond = note.split("条件:")[1]?.trim() || null;
  return { url, cond };
}

// セクション先頭の "## 見出し" を分離
function parseSection(sec: string): { heading: string | null; body: string } {
  const lines = sec.trim().split("\n");
  if (lines[0]?.startsWith("## ")) {
    return { heading: lines[0].slice(3).trim(), body: lines.slice(1).join("\n").trim() };
  }
  return { heading: null, body: sec.trim() };
}

export function PetWalkerMagazine({ article, spots, isPC, onSpotClick, onBack }: {
  article: MagazineArticle;
  spots: MagazineSpot[];              // petwalker.tsx が保持する全スポット (id で引く)
  isPC?: boolean;
  onSpotClick?: (spotId: string) => void;
  onBack: () => void;
}) {
  const spotById = new Map(spots.map((s) => [s.id, s]));
  const sections = article.content.split("\n---\n").map(parseSection);
  const lead = sections[0];
  const chapters = sections.slice(1);

  const bodyStyle: React.CSSProperties = {
    fontFamily: QC_FONT_JP, fontWeight: 300, fontSize: isPC ? 16.5 : 15,
    lineHeight: 2.2, color: QC.charcoal, whiteSpace: "pre-wrap",
    maxWidth: 640, margin: "0 auto",
  };

  return (
    <div style={{ background: QC.warmWhite, minHeight: "60vh" }}>
      {/* 戻る (petwalker 既存の固定戻ると同作法) */}
      <button
        onClick={onBack}
        style={{
          position: "fixed", top: isPC ? 80 : 70, left: isPC ? 32 : 16, zIndex: 20,
          background: "rgba(250, 247, 242, 0.92)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          border: `1px solid ${QC.lightSand}`, borderRadius: 999, color: QC.softBrown,
          fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 400, cursor: "pointer",
          padding: "8px 14px", letterSpacing: 0.3, boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        ← もどる
      </button>

      {/* ヒーロー: 全幅写真の上にタイトル */}
      <div
        style={{
          position: "relative", width: "100%", minHeight: isPC ? 480 : 340,
          display: "flex", flexDirection: "column", justifyContent: "flex-end",
          background: `linear-gradient(180deg, rgba(44,41,38,0.18) 0%, rgba(44,41,38,0.66) 100%), url("${article.hero_image_url || ""}") center / cover no-repeat, ${QC.softBrown}`,
          padding: isPC ? "0 0 72px" : "0 0 44px",
          animation: `qocca-fadeInSlow 1.4s ${ease} both`,
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px", width: "100%", boxSizing: "border-box" }}>
          <p style={{ fontFamily: QC_FONT_EN, fontSize: 13, letterSpacing: 4, color: "rgba(255,255,255,0.88)", margin: "0 0 16px", textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>
            PET WALKER FEATURE
          </p>
          <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 42 : 27, lineHeight: 1.7, margin: 0, color: "#fff", textShadow: "0 2px 16px rgba(0,0,0,0.55)" }}>
            {article.title}
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: isPC ? "88px 24px 140px" : "56px 20px 100px" }}>
        {/* リード文 */}
        <div style={{ ...bodyStyle, fontSize: isPC ? 17.5 : 15.5, animation: `qocca-fadeInSlowUp 1.2s ${ease} both` }}>
          {lead.body}
        </div>

        {/* 章: spot_ids と同順対応。写真は全幅⇄半幅の交互リズム */}
        {chapters.map((ch, i) => {
          const spot = i < article.spot_ids.length ? spotById.get(article.spot_ids[i]) : undefined;
          const img = spot?.image_urls?.[0];
          const { url, cond } = parseSource(spot?.source_note ?? null);
          const wide = i % 2 === 0; // 偶数章=全幅 / 奇数章=半幅 (非対称のリズム)
          return (
            <section key={i} style={{ marginTop: isPC ? 140 : 88 }}>
              {ch.heading && (
                <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontWeight: 500, fontSize: isPC ? 28 : 21, lineHeight: 1.8, color: QC.charcoal, maxWidth: 640, margin: "0 auto 36px", textAlign: wide ? "left" : "right" }}>
                  {ch.heading}
                </h2>
              )}
              {img && (
                <div
                  style={{
                    width: wide ? "100%" : (isPC ? "62%" : "84%"),
                    margin: wide ? "0 0 44px" : (i % 4 === 1 ? "0 0 44px auto" : "0 auto 44px 0"),
                    borderRadius: 18, overflow: "hidden", background: QC.cream,
                    aspectRatio: wide ? "21 / 9" : "4 / 3",
                  }}
                >
                  <img src={img} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              )}
              <div style={bodyStyle}>{ch.body}</div>

              {/* スポットの実用情報 (常にDBの最新: 名前/条件/公式根拠) */}
              {spot && (
                <div style={{ maxWidth: 640, margin: "40px auto 0", borderTop: `1px solid ${QC.lightSand}`, paddingTop: 22 }}>
                  <button
                    onClick={() => onSpotClick && onSpotClick(spot.id)}
                    style={{
                      background: "none", border: "none", padding: 0, cursor: onSpotClick ? "pointer" : "default",
                      fontFamily: QC_FONT_JP, fontWeight: 500, fontSize: 15.5, color: QC.softBrown,
                      letterSpacing: 0.4, textAlign: "left",
                      transition: `opacity ${QC_TIMING.hoverDuration} ${ease}`,
                    }}
                  >
                    {spot.name} {onSpotClick && <span style={{ fontWeight: 300 }}>→</span>}
                  </button>
                  <p style={{ fontSize: 12.5, color: QC.warmGray, fontWeight: 300, margin: "6px 0 0" }}>
                    {[spot.pref, spot.city].filter(Boolean).join(" ")}
                  </p>
                  {cond && (
                    <p style={{ fontSize: 12.5, color: QC.warmGray, fontWeight: 300, lineHeight: 1.9, margin: "10px 0 0" }}>
                      ペット可の条件 — {cond}
                    </p>
                  )}
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: "inline-block", fontSize: 12, color: QC.sage, fontWeight: 300, marginTop: 8, textDecoration: "underline", textUnderlineOffset: 3 }}>
                      公式の案内を確認する
                    </a>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
