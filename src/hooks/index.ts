// カスタムフック集 (App.tsx 分割 Phase 3)
// useListings / useFavorites / useIsPC / useHeroStats / useNav
// ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ useNav は react-router の useNavigate に依存 → Router の内側でのみ呼び出し可 (呼び出し位置は不変)。

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { CATS } from "../constants/data";
import { CAT_COLORS } from "../constants/theme";
import { formatStat } from "../utils/format";

// 出品データをSupabaseから取得（承認済みのみ）
export const useListings = () => {
  const [listings, setListings] = useState([]);
  const [dbLoading, setDbLoading] = useState(true);

  const fetchListings = async () => {
    setDbLoading(true);
    // Phase B: listing_variants を join で取得 (1:N、has_variants=true の listing のみ持つ)
    // 単品出品 (has_variants=false) は listing_variants が空配列のままで挙動完全互換
    const { data, error } = await supabase
      .from("listings")
      .select("*, listing_variants(*)")
      .in("status", ["approved", "sold_out"])
      .order("created_at", { ascending: false });
    if (!error && data && data.length > 0) {
      // 出品者名を取得
      const sellerIds = [...new Set(data.map(l => l.seller_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", sellerIds);
      const profileMap = {};
      (profiles || []).forEach(p => { profileMap[p.id] = p; });

      setListings(data.map(l => {
        const prof = profileMap[l.seller_id] || {};
        return {
          id: l.id,
          title: l.title,
          seller: prof.display_name || "出品者",
          sellerIcon: "🐾",
          sellerAvatar: prof.avatar_url || "",
          price: l.price,
          rating: 0,
          reviews: 0,
          tag: "",
          category: l.category,
          emoji: CATS.find(c => c.id === l.category)?.icon || "🐾",
          pet: l.pet_type,
          desc: l.description,
          delivery: l.delivery_days || "要相談",
          delivery_type: l.delivery_type || "data_only",
          bg: CAT_COLORS[l.category] || "#FFF3E0",
          imageUrl: l.image_urls?.[0] || "",
          imageUrls: l.image_urls || [],
          seller_id: l.seller_id,
          created_at: l.created_at,
          favorite_count: l.favorite_count || 0,
          options: l.options || [],
          // Phase B: variant 関連 (DetailPage で参照)
          has_variants: l.has_variants === true,
          listing_variants: Array.isArray(l.listing_variants) ? l.listing_variants : [],
          // 🔴 緊急修正 (依頼書 #127 後追い / 2026/6/5):
          //   useListings の map が shipping_* を欠落 → DetailPage / 購入処理で undefined → methods 出品が動かない原因
          //   全タイプ (included/flat_rate/regional/methods/consultation) で必要
          shipping_type: l.shipping_type || "included",
          shipping_fee: l.shipping_fee || 0,
          shipping_rates: Array.isArray(l.shipping_rates) ? l.shipping_rates : [],
          shipping_methods: Array.isArray(l.shipping_methods) ? l.shipping_methods : [],
          shipping_note: l.shipping_note || "",
        };
      }));
    }
    setDbLoading(false);
  };

  useEffect(() => { fetchListings(); }, []);
  return { listings, dbLoading, refetch: fetchListings };
};

// お気に入りをSupabaseで管理
export const useFavorites = (userId) => {
  const [liked, setLiked] = useState({});

  useEffect(() => {
    if (!userId) { setLiked({}); return; }
    const fetchFavs = async () => {
      const { data } = await supabase.from("favorites").select("listing_id").eq("user_id", userId);
      if (data) {
        const map = {};
        data.forEach(f => { map[f.listing_id] = true; });
        setLiked(map);
      }
    };
    fetchFavs();
  }, [userId]);

  const toggleLike = async (listingId) => {
    if (!userId) return;
    const isLiked = liked[listingId];
    setLiked(p => ({ ...p, [listingId]: !isLiked }));
    if (isLiked) {
      await supabase.from("favorites").delete().eq("user_id", userId).eq("listing_id", listingId);
    } else {
      await supabase.from("favorites").insert({ user_id: userId, listing_id: listingId });
    }
  };

  return { liked, toggleLike };
};

export const useIsPC = () => {
  const [isPC, setIsPC] = useState(window.innerWidth >= 768);
  useEffect(() => {
    const h = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isPC;
};

export const useHeroStats = () => {
  const [stats, setStats] = useState<{ listings:string; users:string; communities:string }>({ listings: "0", users: "0", communities: "0" });
  useEffect(()=>{
    (async ()=>{
      const [listingsRes, usersRes, commsRes] = await Promise.all([
        supabase.from("listings").select("id", { count:"exact", head:true }),
        supabase.from("profiles").select("id", { count:"exact", head:true }),
        supabase.from("communities").select("id", { count:"exact", head:true }).eq("is_archived", false),
      ]);
      setStats({
        listings: formatStat(listingsRes.count || 0),
        users: formatStat(usersRes.count || 0),
        communities: formatStat(commsRes.count || 0, 50),
      });
    })();
  }, []);
  return stats;
};

export const useNav = () => {
  const navigate = useNavigate();
  const setPage = (page, data) => {
    if (page === "detail" && data) {
      navigate(`/listing/${data.id}`, { state: { item: data } });
    } else if (page === "home") navigate("/");
    else if (page === "search") navigate("/search");
    // 依頼書 #110 (2026/6/4): 商店街 v2.0 (リッチ TOP)
    else if (page === "marketplace") navigate("/marketplace");
    else if (page === "sell") navigate("/sell");
    else if (page === "signup") navigate("/login");
    else if (page === "mypage") navigate("/mypage");
    else if (page === "liked") navigate("/favorites");
    else if (page === "events") navigate("/events");
    else if (page === "gallery") navigate("/gallery");
    else if (typeof page === "string" && page.startsWith("gallery/")) navigate("/" + page);
    else if (page === "facilities") navigate("/facilities");
    else if (page === "blog") navigate("/blog");
    else if (typeof page === "string" && page.startsWith("blog/")) navigate("/" + page);
    else if (page === "communities") navigate("/communities");
    else if (typeof page === "string" && page.startsWith("community/")) navigate("/" + page);
    else if (page === "tokusho") navigate("/tokusho");
    else if (page === "terms") navigate("/terms");
    else if (page === "privacy") navigate("/privacy");
    else if (page === "contact") navigate("/contact");
    else if (page === "terms") navigate("/terms");
    else if (page === "privacy") navigate("/privacy");
    else if (page === "tokusho") navigate("/tokusho");
    else if (page === "contact") navigate("/contact");
    else if (page === "faq") navigate("/faq");
    else if (page === "help") navigate("/help");
    else navigate("/" + page);
  };
  return { setPage, navigate };
};
