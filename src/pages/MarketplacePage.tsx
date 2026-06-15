// src/pages/MarketplacePage.tsx
// ─────────────────────────────────────────────────────────────────
// 依頼書 #110 (2026/6/4): 商店街 v2.0 (ナビ修正 + TOP リッチ化)
//
// 永続記録 #15「街」哲学体現。CAMPFIRE 公開後の集客導線。
// 各セクションは MarketplaceSection コンポーネントで dataSource 注入型。
// 将来 (Phase 4) AI レコメンド導入時は dataSource を AI 版に差し替えるだけ。
//
// 構造:
//   1. 🔥 今週の人気作品 (popularity_score 上位)
//   2. ✨ 新着商品 (直近 7日)
//   3. 🎨 カテゴリ別ランキング (実在カテゴリのみ動的表示)
//   4. 🏠 新しいお店 (直近 30日 stripe_onboarded)
//   5. 🐾 創業期メンバー (founding creator)
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const CREAM_DARK = "#FFF2DF";
const TEXT_DARK = "#2C2C2A";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";
const BORDER_WARM = "#F5E6D0";
const WHITE = "#FFFFFF";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://qufrqkuipzuqeqkvuhkx.supabase.co";
const SUPABASE_ANON =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

// カテゴリ表示マッピング (DB の category 値 → 表示名 + emoji)
// 実在カテゴリ (goods/food/illust) + 将来想定カテゴリも準備
const CATEGORY_MAP: { [key: string]: { label: string; emoji: string } } = {
  illust: { label: "似顔絵・イラスト", emoji: "🎨" },
  goods: { label: "ペット用品", emoji: "🛍️" },
  clothes: { label: "ハンドメイド服", emoji: "✂️" },
  photo: { label: "写真・データ", emoji: "📸" },
  food: { label: "フード・おやつ", emoji: "🍪" },
  service: { label: "サービス・しつけ", emoji: "🎓" },
  craft: { label: "ハンドメイド作品", emoji: "✨" },
  memorial: { label: "メモリアル", emoji: "🕊️" },
};

type Listing = {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  category: string;
  image_urls: string[] | null;
  status: string;
  created_at: string;
  popularity_score?: number;
  sales_count?: number;
  view_count?: number;
  favorite_count?: number;
};

type Creator = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username?: string | null;
  is_founding_creator?: boolean;
  stripe_onboarded?: boolean;
  created_at: string;
};

// ────────────────────────────────────────────────
// dataSource 関数群 (Phase D: 将来 AI 版に差替可能)
// ────────────────────────────────────────────────
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

async function fetchWeeklyRanking(): Promise<Listing[]> {
  const { data } = await sb
    .from("listings_with_popularity")
    .select("id, seller_id, title, price, category, image_urls, status, created_at, popularity_score, sales_count, view_count, favorite_count")
    .eq("status", "approved")
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(6);
  return (data as Listing[]) || [];
}

async function fetchNewest(): Promise<Listing[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("listings")
    .select("id, seller_id, title, price, category, image_urls, status, created_at")
    .eq("status", "approved")
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data as Listing[]) || [];
}

async function fetchByCategory(category: string): Promise<Listing[]> {
  const { data } = await sb
    .from("listings_with_popularity")
    .select("id, seller_id, title, price, category, image_urls, status, created_at, popularity_score")
    .eq("status", "approved")
    .eq("category", category)
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(6);
  return (data as Listing[]) || [];
}

async function fetchActiveCategories(): Promise<string[]> {
  // listings の実在カテゴリだけ取得 → 空カテゴリは表示しない
  const { data } = await sb
    .from("listings")
    .select("category")
    .eq("status", "approved");
  const set = new Set<string>((data || []).map((r: any) => r.category).filter(Boolean));
  return Array.from(set);
}

async function fetchNewShops(): Promise<Creator[]> {
  // 「直近30日 stripe_onboarded 完了」想定列 stripe_onboarded_at は不在のため、
  // 現状は stripe_onboarded=true & profiles.created_at 直近で代替
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("profiles")
    .select("id, display_name, avatar_url, is_founding_creator, stripe_onboarded, created_at")
    .eq("stripe_onboarded", true)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data as Creator[]) || [];
}

async function fetchFoundingCreators(): Promise<Creator[]> {
  const { data } = await sb
    .from("profiles")
    .select("id, display_name, avatar_url, is_founding_creator, stripe_onboarded, created_at")
    .eq("is_founding_creator", true)
    .order("created_at", { ascending: false })
    .limit(6);
  return (data as Creator[]) || [];
}

// ────────────────────────────────────────────────
// メインページ
// ────────────────────────────────────────────────
export default function MarketplacePage() {
  const navigate = useNavigate();
  const [searchQ, setSearchQ] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQ.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div style={{ minHeight: "100vh", background: CREAM, paddingBottom: 80, fontFamily: "system-ui, -apple-system, sans-serif", color: TEXT_DARK }}>
      {/* ヘッダ */}
      <header
        style={{
          background: `linear-gradient(180deg, ${CREAM_DARK} 0%, ${CREAM} 100%)`,
          padding: "48px 16px 32px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 12, letterSpacing: "0.2em", color: BRAND, marginBottom: 8 }}>QOCCA MARKETPLACE</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", color: TEXT_DARK }}>🏪 Qocca 商店街</h1>
        <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.7 }}>
          ペット好きクリエイターの一点物が並ぶ街<br />
          似顔絵・ハンドメイド服・写真撮影・しつけ等
        </p>

        {/* 検索バー */}
        <form
          onSubmit={handleSearch}
          style={{
            maxWidth: 480,
            margin: "20px auto 0",
            display: "flex",
            gap: 8,
            padding: "0 8px",
          }}
        >
          <input
            type="text"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="🔍 作品名・クリエイター名で検索..."
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: 999,
              border: `1.5px solid ${BORDER_WARM}`,
              fontSize: 14,
              fontFamily: "inherit",
              background: WHITE,
              boxSizing: "border-box",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: "none",
              background: BRAND,
              color: WHITE,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
            }}
          >
            検索
          </button>
        </form>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 12px" }}>
        {/* ペットウォーカー入口 (ペットと行きたくなる場所: 宿/カフェ/観光) */}
        <Link
          to="/petwalker"
          style={{
            display: "block",
            margin: "24px 0 8px",
            padding: "22px 24px",
            borderRadius: 16,
            background: `linear-gradient(135deg, ${CREAM_DARK} 0%, ${WHITE} 100%)`,
            border: `1.5px solid ${BORDER_WARM}`,
            textDecoration: "none",
            color: TEXT_DARK,
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: BRAND, marginBottom: 6 }}>PET WALKER</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>うちの子と、出かける。</div>
          <div style={{ fontSize: 13, color: TEXT_MUTED, lineHeight: 1.7 }}>
            泊まれる宿、一緒に入れるカフェ、歩きたくなる場所を、エリアごとに。 →
          </div>
        </Link>

        {/* 1. 今週の人気作品 */}
        <MarketplaceSection
          title="🔥 今週の人気作品"
          subtitle="販売・お気に入り・閲覧から自動算出"
          dataSource={fetchWeeklyRanking}
          renderItem={l => <ListingCard key={l.id} l={l} />}
          moreHref="/search?sort=popular"
          itemKey="ranking"
        />

        {/* 2. 新着商品 */}
        <MarketplaceSection
          title="✨ 新着商品"
          subtitle="直近 7日以内に出品された作品"
          dataSource={fetchNewest}
          renderItem={l => <ListingCard key={l.id} l={l} />}
          moreHref="/search?sort=newest"
          itemKey="newest"
        />

        {/* 3. カテゴリ別ランキング (動的) */}
        <CategoriesSection />

        {/* 4. 新しいお店 */}
        <MarketplaceSection
          title="🏠 新しいお店"
          subtitle="直近 30日以内に活動を始めたクリエイター"
          dataSource={fetchNewShops}
          renderItem={c => <CreatorCard key={c.id} c={c} />}
          moreHref="/founding-creators"
          itemKey="new-shops"
          emptyMessage="まだ新しいお店はありません。クリエイター募集中🐾"
        />

        {/* 5. 創業期メンバー */}
        <MarketplaceSection
          title="🐾 創業期メンバーをチェック"
          subtitle="クラウドファンディングで Qocca の街を立ち上げる仲間たち"
          dataSource={fetchFoundingCreators}
          renderItem={c => <CreatorCard key={c.id} c={c} founding />}
          moreHref="/founding-creators"
          itemKey="founding"
          emptyMessage="2026年7月1日のグランドオープン後、創業期メンバーが続々と参加予定です。"
        />

        {/* CTA */}
        <div style={{ textAlign: "center", padding: "40px 20px 20px" }}>
          <Link
            to="/sell"
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: BRAND,
              color: WHITE,
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            🐾 あなたも商店街に出店する →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// MarketplaceSection: 共通セクションコンポーネント
// dataSource を関数として受け取り、Phase D で AI 版に差替可能
// ────────────────────────────────────────────────
function MarketplaceSection<T>({
  title,
  subtitle,
  dataSource,
  renderItem,
  moreHref,
  itemKey,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  dataSource: () => Promise<T[]>;
  renderItem: (item: T) => React.ReactNode;
  moreHref?: string;
  itemKey: string;
  emptyMessage?: string;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dataSource();
      setItems(data);
    } catch (e) {
      console.warn(`MarketplaceSection[${itemKey}] fetch failed`, e);
    } finally {
      setLoading(false);
    }
  }, [dataSource, itemKey]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section style={{ marginTop: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 8px 12px" }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: TEXT_DARK, margin: 0 }}>{title}</h2>
          {subtitle && <p style={{ fontSize: 11, color: TEXT_MUTED, margin: "4px 0 0" }}>{subtitle}</p>}
        </div>
        {moreHref && items.length > 0 && (
          <Link to={moreHref} style={{ fontSize: 12, color: BRAND_DEEP, textDecoration: "none", flexShrink: 0 }}>もっと見る →</Link>
        )}
      </div>

      {loading ? (
        <div style={{ background: WHITE, borderRadius: 14, padding: 32, textAlign: "center", fontSize: 12, color: TEXT_MUTED }}>読み込み中…</div>
      ) : items.length === 0 ? (
        <div style={{ background: WHITE, borderRadius: 14, padding: 32, textAlign: "center", fontSize: 13, color: TEXT_MUTED, lineHeight: 1.8, border: `1px dashed ${BORDER_WARM}` }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🌱</div>
          {emptyMessage || "もうすぐ商品が増えます🐾 2026年7月1日のグランドオープンをお楽しみに。"}
        </div>
      ) : (
        <HorizontalScroller>
          {items.map(renderItem)}
        </HorizontalScroller>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────
// CategoriesSection: 動的にカテゴリ別ランキング展開
// ────────────────────────────────────────────────
function CategoriesSection() {
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const cats = await fetchActiveCategories();
      setActiveCategories(cats.filter(c => CATEGORY_MAP[c]));
      setLoading(false);
    })();
  }, []);

  if (loading) return null;
  if (activeCategories.length === 0) {
    return (
      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 8px 12px" }}>🎨 カテゴリ別ランキング</h2>
        <div style={{ background: WHITE, borderRadius: 14, padding: 32, textAlign: "center", fontSize: 13, color: TEXT_MUTED, border: `1px dashed ${BORDER_WARM}` }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>🌱</div>
          まだカテゴリ別の作品が揃っていません。クリエイター募集中🐾
        </div>
      </section>
    );
  }

  return (
    <>
      {activeCategories.map(cat => (
        <MarketplaceSection
          key={cat}
          title={`${CATEGORY_MAP[cat].emoji} ${CATEGORY_MAP[cat].label}`}
          subtitle={`カテゴリ TOP6`}
          dataSource={() => fetchByCategory(cat)}
          renderItem={l => <ListingCard key={l.id} l={l} />}
          moreHref={`/search?category=${encodeURIComponent(cat)}`}
          itemKey={`cat-${cat}`}
        />
      ))}
    </>
  );
}

// ────────────────────────────────────────────────
// HorizontalScroller: mobile 横スクロール / PC グリッド
// ────────────────────────────────────────────────
function HorizontalScroller({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        WebkitOverflowScrolling: "touch",
        padding: "4px 8px 16px",
      }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────
// ListingCard: 作品カード
// ────────────────────────────────────────────────
function ListingCard({ l }: { l: Listing }) {
  const img = Array.isArray(l.image_urls) && l.image_urls.length > 0 ? l.image_urls[0] : null;
  const catMeta = CATEGORY_MAP[l.category] || { label: l.category, emoji: "📦" };

  return (
    <Link
      to={`/listing/${l.id}`}
      style={{
        flexShrink: 0,
        width: 168,
        background: WHITE,
        borderRadius: 14,
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
        border: `1px solid ${BORDER}`,
        scrollSnapAlign: "start",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: "100%",
          height: 168,
          background: img ? `url(${img}) center/cover` : CREAM_DARK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
        }}
      >
        {!img && catMeta.emoji}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 10, color: BRAND_DEEP, marginBottom: 3, letterSpacing: "0.05em" }}>
          {catMeta.emoji} {catMeta.label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TEXT_DARK,
            marginBottom: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: 1.4,
            minHeight: 36,
          }}
        >
          {l.title}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND_DEEP, fontFamily: "Georgia, serif" }}>
          ¥{Number(l.price || 0).toLocaleString()}
        </div>
        {(l.sales_count || l.favorite_count) ? (
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4, display: "flex", gap: 6 }}>
            {l.sales_count ? <span>🛍 {l.sales_count}</span> : null}
            {l.favorite_count ? <span>❤ {l.favorite_count}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

// ────────────────────────────────────────────────
// CreatorCard: クリエイターカード
// ────────────────────────────────────────────────
function CreatorCard({ c, founding }: { c: Creator; founding?: boolean }) {
  return (
    <Link
      to={`/profile/${c.id}`}
      style={{
        flexShrink: 0,
        width: 140,
        background: WHITE,
        borderRadius: 14,
        padding: 14,
        textAlign: "center",
        textDecoration: "none",
        color: "inherit",
        border: `1px solid ${BORDER}`,
        scrollSnapAlign: "start",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          margin: "0 auto 8px",
          borderRadius: "50%",
          background: c.avatar_url ? `url(${c.avatar_url}) center/cover` : CREAM_DARK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          border: founding ? `2px solid ${BRAND}` : "none",
        }}
      >
        {!c.avatar_url && "🐾"}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_DARK, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {c.display_name || "(名称未設定)"}
      </div>
      {founding && (
        <div style={{ fontSize: 9, color: BRAND_DEEP, fontWeight: 700, letterSpacing: "0.05em" }}>FOUNDING</div>
      )}
    </Link>
  );
}
