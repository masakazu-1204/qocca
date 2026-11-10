// 商店街の特集ページ /feature/:slug (2026/11/10 冬の贈りもの)
//
// 並べる作品は constants/features.ts に書いた id から、App が持っている公開中の一覧 (useListings) を引いて出す。
// 新しく DB を読まないので、一覧に無い (= 非公開・取り下げ) 作品は自然に出ない。
// 作品を押すと通常の作品ページ /listing/:id へ。購入の流れには一切触らない。

import { useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_FONT_DISPLAY, QC_TIMING } from "../constants/theme";
import { findFeature, type FeatureSection } from "../constants/features";
import { useSEO } from "../hooks/useSEO";

type ListingLike = {
  id: string;
  title?: string;
  seller?: string;
  price?: number;
  imageUrl?: string;
  delivery?: string;
};

const yen = (n?: number) => (typeof n === "number" ? `¥${n.toLocaleString("ja-JP")}` : "");

const FeatureCard = ({ item }: { item: ListingLike }) => {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={`/listing/${item.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ textDecoration: "none", color: QC.charcoal, display: "block" }}
    >
      <div style={{ aspectRatio: "1 / 1", overflow: "hidden", background: QC.cream, borderRadius: 2 }}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.title || ""}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transform: hover ? "scale(1.03)" : "scale(1)",
              transition: `transform ${QC_TIMING.hoverDuration} ${QC_TIMING.hoverEasing}`,
            }}
          />
        ) : null}
      </div>
      <p style={{ fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 400, lineHeight: 1.8, margin: "14px 0 4px 0", letterSpacing: 0.3 }}>
        {item.title}
      </p>
      <p style={{ fontFamily: QC_FONT_JP, fontSize: 11, fontWeight: 300, color: QC.warmGray, margin: "0 0 6px 0", letterSpacing: 0.3 }}>
        {item.seller}
      </p>
      <p style={{ fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 400, color: QC.softBrown, margin: 0 }}>
        {yen(item.price)}
        {item.delivery ? (
          <span style={{ fontSize: 11, fontWeight: 300, color: QC.warmGray, marginLeft: 10 }}>お届け {item.delivery}</span>
        ) : null}
      </p>
    </Link>
  );
};

const Section = ({ section, items }: { section: FeatureSection; items: ListingLike[] }) => {
  if (items.length === 0) return null;
  return (
    <section style={{ margin: "0 0 clamp(80px, 12vw, 140px) 0" }}>
      <h2 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: "clamp(18px, 2.6vw, 22px)", fontWeight: 500, color: QC.softBrown, letterSpacing: "0.06em", lineHeight: 1.8, margin: "0 0 12px 0" }}>
        {section.title}
      </h2>
      <p style={{ fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 300, color: QC.warmGray, lineHeight: 2, margin: "0 0 36px 0", maxWidth: 560, letterSpacing: 0.3 }}>
        {section.note}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "40px 20px" }}>
        {items.map((it) => (
          <FeatureCard key={it.id} item={it} />
        ))}
      </div>
    </section>
  );
};

export const FeaturePage = ({ listings, isPC }: { listings: ListingLike[]; isPC: boolean }) => {
  const { slug } = useParams();
  const feature = findFeature(slug);
  const byId = new Map(listings.map((l) => [l.id, l]));

  useSEO({
    title: feature ? `${feature.title} | Qocca` : "特集 | Qocca",
    description: feature?.description,
    path: `/feature/${slug ?? ""}`,
    noindex: !feature,
  });

  const wrap: CSSProperties = {
    maxWidth: 960,
    margin: "0 auto",
    padding: isPC ? "clamp(48px, 8vw, 96px) 0 80px" : "56px 16px 96px",
    background: QC.warmWhite,
  };

  if (!feature) {
    return (
      <div style={wrap}>
        <p style={{ fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 300, color: QC.warmGray, textAlign: "center", lineHeight: 2 }}>
          この特集は見つかりませんでした。
          <br />
          <Link to="/marketplace" style={{ color: QC.terracotta }}>商店街へ戻る</Link>
        </p>
      </div>
    );
  }

  const sections = feature.sections.map((s) => ({
    section: s,
    items: s.listingIds.map((id) => byId.get(id)).filter((x): x is ListingLike => !!x),
  }));
  const loading = listings.length === 0;

  return (
    <div style={wrap}>
      <header style={{ textAlign: "center", margin: "0 0 clamp(80px, 12vw, 140px) 0" }}>
        <p style={{ fontFamily: QC_FONT_EN, fontSize: 14, fontStyle: "italic", color: QC.warmGray, letterSpacing: 1, margin: "0 0 24px 0", opacity: 0.8, fontWeight: 300 }}>
          {feature.label}
        </p>
        <h1 style={{ fontFamily: QC_FONT_DISPLAY, fontSize: "clamp(26px, 4.4vw, 36px)", fontWeight: 500, color: QC.softBrown, letterSpacing: "0.08em", lineHeight: 1.7, margin: "0 0 32px 0" }}>
          {feature.title}
        </h1>
        <p style={{ fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 300, color: QC.charcoal, lineHeight: 2.2, margin: "0 auto", maxWidth: 520, letterSpacing: 0.4 }}>
          {feature.lead}
        </p>
      </header>

      {loading ? (
        <p style={{ fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 300, color: QC.warmGray, textAlign: "center" }}>読み込んでいます。</p>
      ) : (
        sections.map(({ section, items }) => <Section key={section.title} section={section} items={items} />)
      )}

      <footer style={{ borderTop: `1px solid ${QC.lightSand}`, paddingTop: 48, textAlign: "center" }}>
        <p style={{ fontFamily: QC_FONT_JP, fontSize: 12, fontWeight: 300, color: QC.warmGray, lineHeight: 2.2, margin: "0 auto 32px", maxWidth: 560, letterSpacing: 0.3 }}>
          {feature.closingNote}
        </p>
        <Link
          to="/marketplace"
          style={{ fontFamily: QC_FONT_JP, fontSize: 13, fontWeight: 300, color: QC.terracotta, letterSpacing: 1.2, textDecoration: "none", borderBottom: `1px solid ${QC.terracotta}`, paddingBottom: 4 }}
        >
          商店街をもっと歩く
        </Link>
      </footer>
    </div>
  );
};
