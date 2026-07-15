// マーケットプレイス ページ群 (App.tsx 分割 Phase6 6a・低リスク先行)
// SearchPage / UserProfilePage
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ 決済本丸 (DetailPage/SellPage/submitListing/DetailPageWrapper) は 6b で別途移動。

import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { CATS, REVIEWS } from "../constants/data";
import { sortByPopularity } from "../utils/format";
import { Card, Tag, Stars } from "../components/ui";
import { resolveFontFamily } from "../constants/fonts";
import { petIcon, petLabelShort, PET_CATEGORIES } from "../constants/pets";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { trackEvent as mpTrackEvent } from "../lib/metaPixel";
import { useNav } from "../hooks";
import { ListingEditModal } from "../components/ListingEditModal";
import { FloatingBackButton } from "../components/FloatingBackButton";
// 2026/7/6 あしあとUI第3弾: 装着装飾つきアバター (公開プロフィール・equipped=trueはRLSで他人も閲覧可)
import { DecoratedAvatar } from "../components/DecoratedAvatar";

export const SearchPage = ({ listings, liked, onLike, onDetail, search, setSearch, isPC }) => {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("popular");
  // "ふらっと" は sort 切替時または filter 変化時にシャッフルし直す (毎レンダーでは変わらない)
  const [randomKey, setRandomKey] = useState(0);
  useEffect(() => {
    if (sort === "random") setRandomKey(k => k + 1);
  }, [sort]);

  const filtered = listings.filter(l => {
    if (cat !== "all" && l.category !== cat) return false;
    if (search && !l.title.includes(search) && !l.seller.includes(search)) return false;
    return true;
  });

  // v3.2 第27章: 5 つの発見経路 (人気/新着/評価/価格/ふらっと)
  const results = React.useMemo(() => {
    if (sort === "popular") return sortByPopularity(filtered);
    if (sort === "new")     return [...filtered].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
    if (sort === "rating")  return [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sort === "cheap")   return [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === "random")  return [...filtered].sort(() => Math.random() - 0.5);
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, listings, cat, search, randomKey]);

  // 空配列時の "別の入り口" 導線: フィルタが効いてる時のみ表示
  const hasFilter = cat !== "all" || !!search;
  const resetFilters = () => { setCat("all"); setSearch(""); };

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {!isPC && (
        <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
          <div style={{ position:"relative" }}>
            <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14 }}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="キーワードで検索..."
              style={{ width:"100%", padding:"12px 12px 12px 34px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, outline:"none", fontFamily:"inherit", background:C.lightGray, boxSizing:"border-box" }}
            />
          </div>
        </div>
      )}
      <div style={{ padding:"10px 0", background: isPC ? "transparent" : C.white, borderBottom: isPC ? "none" : `1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto", paddingLeft: isPC ? 0 : 16, paddingRight: isPC ? 0 : 16 }}>
        {CATS.map(c=>(
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, minHeight:44, padding:"8px 16px",
            background: cat===c.id ? C.orangePale : C.white,
            color: cat===c.id ? C.orange : C.warmGray,
            border:`1.5px solid ${cat===c.id ? C.orange : C.border}`,
            borderRadius:22, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:6,
            transition:"background 0.3s ease, color 0.3s ease, border-color 0.3s ease"
          }}>
            <span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span>
          </button>
        ))}
      </div>
      <div style={{ padding:"10px 0", paddingLeft: isPC ? 0 : 16, paddingRight: isPC ? 0 : 16, display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:13, color:C.warmGray, flexShrink:0 }}>{results.length}件</span>
        <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
          {[["popular","人気"],["new","新着"],["rating","評価"],["cheap","価格"],["random","ふらっと"]].map(([v,l])=>(
            <button key={v} onClick={()=>setSort(v)} style={{
              flexShrink:0, minHeight:36, padding:"8px 14px",
              border:`1.5px solid ${sort===v?C.orange:C.border}`,
              borderRadius:16, background: sort===v ? C.orangePale : C.white,
              color: sort===v ? C.orange : C.warmGray, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
              transition:"background 0.3s ease, color 0.3s ease, border-color 0.3s ease"
            }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ padding: isPC ? "0 0 24px" : "0 16px 24px" }}>
        {results.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🐾</div>
            <div style={{ fontSize:15, fontWeight:600, color:C.dark, marginBottom:16, lineHeight:1.7 }}>
              まだこの街にいないみたいです。
            </div>
            {hasFilter && (
              <button onClick={resetFilters} style={{
                minHeight:44, padding:"10px 20px",
                background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`,
                borderRadius:22, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                transition:"background 0.3s ease, color 0.3s ease"
              }}>
                別の入り口から覗いてみる →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(3,1fr)" : "1fr 1fr", gap: isPC ? 16 : 12 }}>
            {results.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
          </div>
        )}
      </div>
      {/* 🔴 緊急修正 (2026/6/5): #116 で誤って SearchPage 末尾に挿入されていた
          <HomeEventsSection events={homeEvents} ...> を削除。
          SearchPage の props に homeEvents は存在しない → ReferenceError で「さがす」白画面。
          本来の挿入先 = HomePage (L4178 SectionJoinTown 直前) に移動済。 */}
    </div>
  );
};

export const UserProfilePage = ({ setPage }:{ setPage:(p:string)=>void }) => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string } | null>(null);
  const [stats, setStats] = useState<{ listings: number; completed: number; avgRating: number | null }>({ listings: 0, completed: 0, avgRating: null });
  const [loading, setLoading] = useState(true);
  const [userListings, setUserListings] = useState<Array<{ id:string; title:string; price:number; image_urls?:string[] }>>([]);
  const [reviews, setReviews] = useState<Array<{ id:string; rating:number; comment:string; created_at:string; reviewer_id:string; reviewer_name?:string; reviewer_avatar?:string }>>([]);
  const [isFollowing, setIsFollowing] = useState(false);
const [followCount, setFollowCount] = useState(0);
// うちの子 state (2026/6/28: 認証ガードは削除 — 公開プロフィールは未ログインで閲覧可。
//   理由: 集客機会損失の解消。データ層は RLS で公開制限済 (profiles/listings approved/blog published 等)。
//   write系UI(フォロー/購入/送信)はそれぞれの onClick 側で auth.getUser() を見るためここでのgateは不要)。
const [pets, setPets] = useState<Array<{ id: string; name: string; species: string; breed?: string | null; birthday?: string | null; bio?: string | null; avatar_url?: string | null; gender?: string | null; status: string; display_order: number }>>([]);
const [petPhotos, setPetPhotos] = useState<Record<string, Array<{ id: string; photo_url: string; caption?: string | null }>>>({});
// Phase D Phase 2 (5/22 夜): 公開プロフィールにギャラリー + ブログ表示
const [userGallery, setUserGallery] = useState<Array<{ id: string; image_url: string; caption?: string | null }>>([]);
const [userBlogPosts, setUserBlogPosts] = useState<Array<{ id: string; title: string; cover_image_url?: string | null; category?: string | null; created_at: string }>>([]);

  useEffect(()=>{
  if (!userId) return;
  (async ()=>{
    const { data: { user } } = await supabase.auth.getUser();
    const [{ count: fc }, { data: fol }] = await Promise.all([
      supabase.from("follows").select("*", { count:"exact", head:true }).eq("following_id", userId),
      user ? supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", userId).single() : Promise.resolve({ data: null }),
    ]);
    setFollowCount(fc || 0);
    setIsFollowing(!!fol);
  })();
}, [userId]);

const handleFollow = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (isFollowing) {
    await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId);
    setIsFollowing(false);
    setFollowCount(c => c - 1);
  } else {
    await supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
    setIsFollowing(true);
    setFollowCount(c => c + 1);
  }
};
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      setLoading(true);
      const { data } = await supabase.from("profiles").select("display_name, avatar_url, bio, created_at, font_display_name, font_bio, font_one_word, font_pet_name, font_blog_title, creator_intro").eq("id", userId).single();
      if (data) setProfile(data);
      setLoading(false);
    })();
  }, [userId]);

  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const [listingsRes, ordersRes, reviewsRes] = await Promise.all([
        supabase.from("listings").select("id", { count:"exact", head:true }).eq("seller_id", userId),
        supabase.from("orders").select("id", { count:"exact", head:true }).eq("seller_id", userId).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("seller_id", userId),
      ]);
      const ratings = (reviewsRes.data || []).map((r:{rating:number})=>r.rating);
      const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
      setStats({
        listings: listingsRes.count || 0,
        completed: ordersRes.count || 0,
        avgRating: avg,
      });
    })();
  }, [userId]);
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const { data } = await supabase
        .from("listings")
        .select("id, title, price, image_urls")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      setUserListings(data || []);
    })();
  }, [userId]);
  // Phase D Phase 2 (5/22 夜): ギャラリー + ブログ取得 (公開プロフィール用)
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const [galRes, blogRes] = await Promise.all([
        supabase.from("gallery_posts")
          .select("id, image_url, caption")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("blog_posts")
          .select("id, title, cover_image_url, category, created_at")
          .eq("author_id", userId)
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);
      setUserGallery(galRes.data || []);
      setUserBlogPosts(blogRes.data || []);
    })();
  }, [userId]);
  // Phase D: pets + pet_photos 取得 (active 優先 → memorial)
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const { data: petData } = await supabase
        .from("pets")
        .select("id, name, species, breed, birthday, bio, avatar_url, gender, status, display_order")
        .eq("owner_id", userId)
        .order("status", { ascending: true })
        .order("display_order", { ascending: true });
      setPets(petData || []);
      if (petData && petData.length > 0) {
        const petIds = petData.map((p: { id: string }) => p.id);
        const { data: photoData } = await supabase
          .from("pet_photos")
          .select("id, pet_id, photo_url, caption")
          .in("pet_id", petIds)
          .order("display_order", { ascending: true });
        const grouped: Record<string, Array<{ id: string; photo_url: string; caption?: string | null }>> = {};
        (photoData || []).forEach((ph: { id: string; pet_id: string; photo_url: string; caption?: string | null }) => {
          if (!grouped[ph.pet_id]) grouped[ph.pet_id] = [];
          grouped[ph.pet_id].push({ id: ph.id, photo_url: ph.photo_url, caption: ph.caption });
        });
        setPetPhotos(grouped);
      }
    })();
  }, [userId]);
  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      const { data: revs } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer_id")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (!revs) return setReviews([]);
      const ids = [...new Set(revs.map(r=>r.reviewer_id))];
      const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
      const profMap = Object.fromEntries((profs||[]).map(p=>[p.id, p]));
      setReviews(revs.map(r=>({ ...r, reviewer_name: profMap[r.reviewer_id]?.display_name || "ユーザー", reviewer_avatar: profMap[r.reviewer_id]?.avatar_url })));
    })();
  }, [userId]);

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>読み込み中...</div>;
  if (!profile) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>ユーザーが見つかりません</div>;

  const displayName = profile.display_name || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <div style={{ background:C.white, borderRadius:20, padding:"28px 20px", border:`1px solid ${C.border}`, textAlign:"center", marginBottom:16 }}>
        {/* 2026/7/6 あしあとUI第3弾: 装着装飾つきアバター (装飾なしなら既存と同一表示) */}
        <DecoratedAvatar userId={userId} avatarUrl={profile.avatar_url} initial={initial} margin="0 auto 16px" fontWeight={800} />
        <div style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:4, fontFamily: resolveFontFamily(profile.font_display_name) }}>{displayName}</div>
        {profile.bio && (
          <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 16px", marginTop:16, marginBottom:4, textAlign:"left", fontSize:14, color:C.dark, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily: resolveFontFamily(profile.font_bio) }}>{profile.bio}</div>
        )}
        <div style={{ display:"flex", gap:0, marginTop:16, background:"#FFF9F0", borderRadius:12, padding:"12px 0", border:`1px solid ${C.border}` }}>
          <div style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.listings}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>出品</div>
          </div>
          <div style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}` }}>
            <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.completed}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>取引完了</div>
          </div>
          <div style={{ flex:1, textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:800, color:C.orange }}>{stats.avgRating !== null ? stats.avgRating.toFixed(1) : "-"}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>⭐ 評価</div>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:16, justifyContent:"center", flexWrap:"wrap" }}>
          <div style={{ fontSize:13, color:C.warmGray }}><span style={{ fontWeight:800, color:C.dark }}>{followCount}</span> フォロワー</div>
          <button onClick={handleFollow} style={{ padding:"8px 20px", background: isFollowing ? C.white : C.orange, border: isFollowing ? `1.5px solid ${C.orange}` : "none", borderRadius:20, color: isFollowing ? C.orange : C.white, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {isFollowing ? "フォロー中" : "フォローする"}
          </button>
          {/* 2026/7/13 週次点検バグ1修正: setTimeout+CustomEvent の取りこぼしレース(設定バグPR#107と同型)を廃し、
              navigate state で messages タブ + DM相手をマウント時に確実に渡す。CustomEvent 経路は mypage 側で後方互換温存。 */}
          {isFollowing && (
            <button onClick={()=>{ navigate("/mypage", { state: { tab: "messages", dm: userId } }); }} style={{ padding:"8px 20px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:20, color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              💬 メッセージ
            </button>
          )}
        </div>
      {/* Phase D: 🐾 うちの子セクション (pets + pet_photos) */}
      {pets.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.dark, marginBottom: 12, paddingLeft: 4 }}>
            🐾 うちの子 ({pets.length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
            {pets.map((p) => {
              const isMemorial = p.status === "memorial";
              const genderIcon = p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : "";
              const speciesEmoji = petIcon(p.species);
              const photos = petPhotos[p.id] || [];
              const firstPhoto = photos[0]?.photo_url || p.avatar_url || "";
              const showBio = !!p.bio && !p.bio.startsWith("(Phase D サンプル");
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/pet/${p.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/pet/${p.id}`); } }}
                  style={{
                    background: isMemorial ? "#F8F6F2" : C.white,
                    borderRadius: 14,
                    border: `1px solid ${C.border}`,
                    overflow: "hidden",
                    opacity: isMemorial ? 0.85 : 1,
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                >
                  <div style={{
                    width: "100%",
                    aspectRatio: "1",
                    background: "#FFF5EB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 48,
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    {firstPhoto ? (
                      <img src={firstPhoto} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : speciesEmoji}
                    {isMemorial && (
                      <div style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        background: "rgba(255,255,255,0.92)",
                        color: "#8B6F4E",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 10,
                      }}>
                        🌈 虹の橋
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 4 }}>
                      {p.name}
                      {genderIcon && <span style={{ color: C.warmGray, fontSize: 12, fontWeight: 600, marginLeft: 6 }}>{genderIcon}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: C.warmGray, lineHeight: 1.5 }}>
                      {speciesEmoji} {p.breed || petLabelShort(p.species)}
                      {p.birthday && (
                        <><br/>{new Date(p.birthday).getFullYear()}年生まれ</>
                      )}
                    </div>
                    {showBio && (
                      <div style={{ fontSize: 11, color: "#666", marginTop: 6, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.bio}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Phase D Phase 2 (5/22 夜): 🖼️ ギャラリー (最新6件) */}
      {userGallery.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.dark, marginBottom: 12, paddingLeft: 4 }}>
            🖼️ ギャラリー ({userGallery.length})
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16, scrollbarWidth: "thin" }}>
            {userGallery.map((g) => (
              <div
                key={g.id}
                onClick={() => navigate(`/gallery/${g.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/gallery/${g.id}`); } }}
                style={{
                  flexShrink: 0,
                  width: 120,
                  height: 120,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: C.orangePale,
                  cursor: "pointer",
                  border: `1px solid ${C.border}`,
                  transition: "transform 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.03)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
              >
                {g.image_url ? (
                  <img
                    src={g.image_url}
                    alt={g.caption || "ギャラリー画像"}
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🖼️</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Phase D Phase 2 (5/22 夜): 📝 ブログ (公開済 最新3件) */}
      {userBlogPosts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.dark, marginBottom: 12, paddingLeft: 4 }}>
            📝 ブログ ({userBlogPosts.length})
          </div>
          <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
            {userBlogPosts.map((b) => (
              <div
                key={b.id}
                onClick={() => navigate(`/blog/${b.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/blog/${b.id}`); } }}
                style={{
                  display: "flex",
                  gap: 12,
                  background: C.white,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  padding: 10,
                  cursor: "pointer",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
              >
                <div style={{
                  flexShrink: 0,
                  width: 72,
                  height: 72,
                  borderRadius: 8,
                  overflow: "hidden",
                  background: C.orangePale,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}>
                  {b.cover_image_url ? (
                    <img src={b.cover_image_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : "📝"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.dark, lineHeight: 1.4, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.warmGray }}>
                    {b.category && <span style={{ background: C.orangePale, color: C.orange, padding: "2px 8px", borderRadius: 8, marginRight: 8, fontSize: 10, fontWeight: 700 }}>{b.category}</span>}
                    {new Date(b.created_at).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {userListings.length > 0 && (
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:C.dark, marginBottom:12, paddingLeft:4 }}>出品中の商品 ({userListings.length})</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))", gap:12 }}>
            {userListings.map((item)=>(
              <div key={item.id} onClick={()=>navigate(`/listing/${item.id}`)} style={{ background:C.white, borderRadius:12, overflow:"hidden", border:`1px solid ${C.border}`, cursor:"pointer", transition:"transform 0.2s" }}>
                <div style={{ width:"100%", aspectRatio:"1", background: item.image_urls && item.image_urls[0] ? `url(${item.image_urls[0]}) center/cover` : C.orangePale }}/>
                <div style={{ padding:"8px 10px" }}>
                  <div style={{ fontSize:12, color:C.dark, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:4 }}>{item.title}</div>
                  <div style={{ fontSize:14, color:C.orange, fontWeight:800 }}>¥{item.price.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// ── 決済本丸 (App.tsx 分割 Phase6 6b) ──────────────────────────────────────
// submitListing / DetailPage / SellPage / DetailPageWrapper
// ⚠️ 決済ロジック・BP計算(Math.floor*0.04)・送料合計(grand)・購入確認モーダルJSX・create-checkout・Stripe文字列 全て無改変。
// export: SellPage / DetailPageWrapper (App routes 用) / DetailPage・submitListing は intra (module-private)。

const submitListing = async (userId, form, imageFiles, options = [], isDraft = false, variants = []) => {
  const imageUrls = [];
  for (const file of imageFiles) {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("listing-images").upload(path, file);
    if (!upErr) {
      const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
      imageUrls.push(urlData.publicUrl);
    }
  }

  const stockValue = form.stock !== "" && form.stock !== null && form.stock !== undefined
    ? parseInt(form.stock)
    : null;

  // variants が指定されていれば has_variants = true (Phase A の列を活用)
  const hasVariants = Array.isArray(variants) && variants.length > 0;

  const { data: listing, error: listingErr } = await supabase.from("listings").insert({
    seller_id: userId,
    title: form.title,
    description: form.desc,
    price: parseInt(form.price),
    category: form.cat,
    pet_type: form.pet,
    delivery_days: form.delivery,
    delivery_type: form.delivery_type || 'data_only',
    creation_story: form.creation_story?.trim() || null,
    image_urls: imageUrls,
    options: options.filter(o => o.name && o.price > 0),
    stock_quantity: isNaN(stockValue) ? null : stockValue,
    status: isDraft ? "draft" : "pending",
    has_variants: hasVariants,
    // 依頼書 #104 Phase B (2026/6/3): 送料設定 4タイプ
    shipping_type: form.shipping_type || 'included',
    shipping_fee: form.shipping_type === 'flat_rate' ? (parseInt(form.shipping_fee) || 0) : 0,
    shipping_rates: form.shipping_type === 'regional' ? (form.shipping_rates || []) : [],
    shipping_note: form.shipping_note?.trim() || '',
    // 依頼書 #127 Phase B (2026/6/5): 配送方法選択 (5タイプ目 'methods')
    //   保存形式: { id, name, fee, note } の配列 (最大5件 / name 必須 / fee >= 0 / id クライアント生成・listing 内 unique)
    //   他タイプ選択時は [] で保存 (後方互換)
    shipping_methods: form.shipping_type === 'methods'
      ? (form.shipping_methods || [])
          .filter((m: any) => m?.name?.trim())
          .slice(0, 5)
          .map((m: any, i: number) => ({
            id: String(m.id || `m${i + 1}_${Date.now().toString(36)}`),
            name: String(m.name).trim().slice(0, 40),
            fee: Math.max(0, parseInt(m.fee) || 0),
            note: String(m.note || '').trim().slice(0, 60),
          }))
      : [],
  }).select().single();

  if (listingErr || !listing) {
    return { data: null, error: listingErr };
  }

  // variants INSERT (hasVariants = true の時のみ)
  if (hasVariants) {
    const variantInserts = variants
      .filter(v => v.variant_name && v.price && parseInt(v.price) > 0)
      .map((v, idx) => ({
        listing_id: listing.id,
        variant_name: v.variant_name,
        attributes: v.attributes || {},
        price: parseInt(v.price),
        stock: parseInt(v.stock) || 0,
        image_url: v.image_url || null,
        display_order: idx,
        is_active: true,
      }));

    if (variantInserts.length > 0) {
      const { error: variantErr } = await supabase
        .from("listing_variants")
        .insert(variantInserts);

      if (variantErr) {
        // variant INSERT 失敗時は listing も削除 (整合性保持)
        await supabase.from("listings").delete().eq("id", listing.id);
        return { data: null, error: variantErr };
      }
    }
  }

  return { data: listing, error: null };
};

const DetailPage = ({ item, onBack, liked, onLike, setPage }) => {
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [showAddressStep, setShowAddressStep] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string|null>(null);
  const [addressForm, setAddressForm] = useState({ recipient_name:"", postal_code:"", prefecture:"", city:"", address_line:"", phone:"", label:"自宅" });
  const [addressMode, setAddressMode] = useState<"select"|"new">("select");
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState("");
  // 依頼書 #104 Phase B-2 (2026/6/3): regional 動的計算 - 購入者が選択する配送先地域
  const [selectedShippingRegion, setSelectedShippingRegion] = useState<string>("");
  // 依頼書 #127 Phase C (2026/6/5): methods - 購入者が選択する配送方法 (デフォルト先頭 method)
  const [selectedShippingMethodId, setSelectedShippingMethodId] = useState<string>("");
  // 依頼書 #113 (緊急) (2026/6/4): 出品者が自分の出品ページから直接編集できるよう ListingEditModal を呼出
  const [showMyEditModal, setShowMyEditModal] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  // Phase B: Variant 選択 state
  // - selectedAttrs: 軸ごとの選択値 (例: { 構図: "マズルアップ", サイズ: "小" })
  // - selectedVariant: selectedAttrs に完全一致する listing_variants の row
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  // 依頼書 #143 TOP2 方式B (2026/6/10): 出品者の送金準備状態 (購入は止めず警告のみ)
  // null=取得中 / true=送金可 / false=未連携(警告表示)。判定軸=stripe_payouts_enabled
  const [sellerPayoutsEnabled, setSellerPayoutsEnabled] = useState<boolean | null>(null);

  // 依頼書 #121 (2026/6/5): Meta Pixel ViewContent (個人情報なし: listing_id + 価格 + 通貨のみ)
  useEffect(() => {
    if (!item?.id) return;
    mpTrackEvent("ViewContent", {
      content_ids: [item.id],
      content_type: "product",
      value: Number(item.price) || 0,
      currency: "JPY",
    });
  }, [item?.id]);

  // 依頼書 #143 TOP2 方式B: 出品者の stripe_payouts_enabled を取得 (購入確認モーダルの警告バナー用)
  useEffect(() => {
    if (!item?.seller_id) { setSellerPayoutsEnabled(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles").select("stripe_payouts_enabled").eq("id", item.seller_id).maybeSingle();
      if (!cancelled) setSellerPayoutsEnabled(data?.stripe_payouts_enabled === true);
    })();
    return () => { cancelled = true; };
  }, [item?.seller_id]);

  if (!item) return null;

  // Phase B: variant 導出ロジック
  const hasVariants = item.has_variants === true;
  const variants = Array.isArray(item.listing_variants) ? item.listing_variants : [];
  // 軸キーを variants から抽出 (例: ["構図", "サイズ"])
  const variantOptionKeys = hasVariants && variants.length > 0
    ? Array.from(new Set(variants.flatMap(v => Object.keys(v.attributes || {}))))
    : [];
  // 各軸の選択肢一覧
  const variantOptionValues: Record<string, string[]> = variantOptionKeys.reduce((acc, key) => {
    acc[key] = Array.from(new Set(variants.map(v => v.attributes?.[key]).filter(Boolean)));
    return acc;
  }, {} as Record<string, string[]>);

  // selectedAttrs が変化したら一致する variant を探す
  useEffect(() => {
    if (!hasVariants || variantOptionKeys.length === 0) return;
    const allSelected = variantOptionKeys.every(key => selectedAttrs[key]);
    if (!allSelected) {
      setSelectedVariant(null);
      return;
    }
    const matched = variants.find(v =>
      variantOptionKeys.every(key => v.attributes?.[key] === selectedAttrs[key])
    );
    setSelectedVariant(matched || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAttrs, hasVariants]);

  const itemOptions = item.options || [];
  const optionsTotal = itemOptions.reduce((sum, o, i) => sum + (selectedOptions[i] ? (o.price||0) : 0), 0);
  // Phase B: variant 優先の価格計算 (variant 未選択時は item.price)
  const basePrice = hasVariants ? (selectedVariant?.price || 0) : (item.price || 0);
  const totalPrice = basePrice + optionsTotal;

  const toggleOption = (idx) => setSelectedOptions(prev => ({...prev, [idx]: !prev[idx]}));

  const handleOrder = async () => {
    if (!user) { setPage("signup"); return; }
    // Phase B: variant 必須チェック (種類のある商品で未選択時はブロック)
    if (hasVariants && !selectedVariant) {
      alert("種類を選んでください");
      return;
    }
    if (item.delivery_type === "shipping") {
      const { data } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("user_id", user.id)
        .is("delete_at", null)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      const addrs = data || [];
      setSavedAddresses(addrs);
      if (addrs.length > 0) {
        setSelectedAddressId(addrs[0].id);
        setAddressMode("select");
      } else {
        setAddressMode("new");
      }
      setShowAddressStep(true);
      return;
    }
    setShowConfirm(true);
  };

 const handleConfirmOrder = async () => {
    if (!user?.id) { alert("ログインしてください"); setPage("signup"); return; }
    if (!item.seller_id) { alert("商品情報に問題があります"); return; }

    setOrdering(true);
    try {
      const selectedOpts = itemOptions.filter((_, i) => selectedOptions[i]).map(o => ({ name: o.name, price: o.price }));

      let shippingAddressId = null;
      if (item.delivery_type === "shipping") {
        if (addressMode === "new") {
          const { data: newAddr, error: addrErr } = await supabase
            .from("shipping_addresses")
            .insert({
              user_id: user.id,
              recipient_name: addressForm.recipient_name,
              postal_code: addressForm.postal_code,
              prefecture: addressForm.prefecture,
              city: addressForm.city,
              address_line: addressForm.address_line,
              phone: addressForm.phone,
              label: addressForm.label || "自宅",
              is_default: savedAddresses.length === 0,
            })
            .select()
            .single();
          if (addrErr) {
            alert("住所の保存に失敗: " + addrErr.message);
            setOrdering(false);
            return;
          }
          shippingAddressId = newAddr.id;
        } else {
          shippingAddressId = selectedAddressId;
        }
      }

      // 依頼書 #104 Phase B-2 (2026/6/3): 送料動的計算 (Edge Function は Phase C で受信処理 / クライアント値は参考のみ)
      // 依頼書 #127 Phase C (2026/6/5): methods 対応 + サーバー側 listing 再取得が大前提 (クライアント値は Meta Pixel 用)
      let shippingFeeForOrder = 0;
      let shippingRegionForOrder: string | null = null;
      let shippingMethodIdForOrder: string | null = null;
      const shipType = item.shipping_type || "included";
      if (shipType === "flat_rate") {
        shippingFeeForOrder = item.shipping_fee || 0;
      } else if (shipType === "regional") {
        if (!selectedShippingRegion) {
          alert("配送先地域を選択してください");
          setOrdering(false);
          return;
        }
        const rate = (item.shipping_rates || []).find((r: any) => r.region === selectedShippingRegion);
        shippingFeeForOrder = rate?.fee || 0;
        shippingRegionForOrder = selectedShippingRegion;
      } else if (shipType === "methods") {
        // 依頼書 #127 Phase C (2026/6/5): 配送方法選択
        const methods = Array.isArray(item.shipping_methods) ? item.shipping_methods : [];
        const chosenId = selectedShippingMethodId || methods[0]?.id;
        const method = methods.find((m: any) => m.id === chosenId);
        if (!method) {
          alert("配送方法を選択してください");
          setOrdering(false);
          return;
        }
        shippingFeeForOrder = method.fee || 0;
        shippingMethodIdForOrder = method.id;
      }
      // included / consultation は shipping_fee=0

      // 依頼書 #121 (2026/6/5): Meta Pixel InitiateCheckout (Edge Function 呼出直前 / 個人情報なし)
      // クライアント値は参考 (サーバー側で再計算するが、Pixel 計測は購入意図検出が目的)
      try {
        const clientTotal =
          (hasVariants && selectedVariant ? selectedVariant.price : item.price) +
          (Array.isArray(selectedOpts) ? selectedOpts.reduce((s: number, o: any) => s + (o?.price || 0), 0) : 0) +
          shippingFeeForOrder;
        mpTrackEvent("InitiateCheckout", {
          value: Number(clientTotal) || 0,
          currency: "JPY",
          content_ids: item?.id ? [item.id] : [],
          content_type: "product",
        });
      } catch (_) { /* 計測失敗で購入フローを妨げない */ }

      const res = await fetch("https://qufrqkuipzuqeqkvuhkx.supabase.co/functions/v1/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: item.id,
          listing_title: item.title,
          // Phase B: variant 選択時はその価格、未選択時 (単品) は listing.price
          // ⚠️ Edge Function (Phase C) でサーバー側再計算が前提、クライアント値は参考のみ
          price: hasVariants && selectedVariant ? selectedVariant.price : item.price,
          options: selectedOpts,
          buyer_id: user.id,
          seller_id: item.seller_id,
          shipping_address_id: shippingAddressId,
          // Phase B: variant_id を Edge Function に渡す (Phase C で受信処理)
          variant_id: hasVariants && selectedVariant ? selectedVariant.id : null,
          // 依頼書 #104 Phase B-2 (2026/6/3): 送料情報 (#127 Phase C で line_items / orders.shipping_* 反映完了)
          shipping_fee: shippingFeeForOrder,
          shipping_region: shippingRegionForOrder,
          // 依頼書 #127 Phase C (2026/6/5): methods 用 ID (サーバー側で listing から fee 再取得)
          selected_shipping_method_id: shippingMethodIdForOrder,
        })
      });

      const result = await res.json();
      console.log("Checkout result:", result);

      if (!res.ok) {
        alert("エラー: " + (result.error || result.insertError_message || "不明なエラー"));
        setOrdering(false);
        return;
      }

      if (result.url) {
        window.location.href = result.url;
      } else {
        alert("決済URLが取得できませんでした");
      }
    } catch (e) {
      console.error("Checkout error:", e);
      alert("エラーが発生しました: " + e.message);
    }
    setOrdering(false);
  };

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</span>
      </div>
      <div style={{ height:240, background:item.bg || "#FFF3E0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:100, position:"relative", overflow:"hidden" }}>
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.title} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          : item.emoji
        }
        <button onClick={() => onLike(item.id)} style={{
          position:"absolute", top:12, right:12, width:40, height:40, borderRadius:"50%",
          background:"rgba(255,255,255,0.92)", border:"none", cursor:"pointer", fontSize:20,
          display:"flex", alignItems:"center", justifyContent:"center"
        }}>{liked ? "❤️" : "🤍"}</button>
      </div>
      <div style={{ padding:"16px" }}>
        {item.tag && <div style={{ marginBottom:8 }}><Tag text={item.tag}/></div>}
        <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:8, lineHeight:1.3 }}>{item.title}</h1>

        {/* 依頼書 #113 緊急 (2026/6/4): 自分の出品なら編集 banner を表示 (クリエイター動線改善) */}
        {user?.id && item.seller_id === user.id && (
          <div onClick={() => setShowMyEditModal(true)} style={{
            background:"linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
            border:`1.5px solid ${C.orange}`, borderRadius:12, padding:"12px 16px",
            marginBottom:14, cursor:"pointer", display:"flex", alignItems:"center", gap:12,
          }}>
            <div style={{ fontSize:26, lineHeight:1 }}>✏️</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.orange, marginBottom:2 }}>あなたの出品です</div>
              <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.5 }}>
                タップして編集 (タイトル / 価格 / 説明 / 納期 / 🚚 送料設定)
              </div>
            </div>
            <div style={{ fontSize:13, color:C.orange, fontWeight:700, flexShrink:0 }}>編集する →</div>
          </div>
        )}
        {item.reviews > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <Stars rating={item.rating} size={14}/>
            <span style={{ color:C.warmGray, fontSize:13 }}>{item.rating} ({item.reviews}件)</span>
          </div>
        )}
        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{item.sellerIcon}</div>
          <div>
            <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>{item.seller}</div>
            {item.reviews > 0 && (
              <div style={{ fontSize:12, color:C.warmGray }}>評価 {item.rating} · {item.reviews}件</div>
            )}
          </div>
        </div>
        {item.seller_id && (
          <button onClick={()=>setPage(`user/${item.seller_id}`)} style={{ width:"100%", padding:"12px", marginBottom:14, background:C.white, color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:12, fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            👤 出品者のプロフィールを見る
          </button>
        )}
        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:8 }}>サービス詳細</div>
          <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>{item.desc}</div>
        </div>

        {/* 依頼書 #8 Phase E (5/25) 機能 #2: 💝 この作品が生まれたストーリー */}
        {item.creation_story && (
          <div style={{
            background: "linear-gradient(135deg, #FFF9F0 0%, #FFF4E1 100%)",
            borderRadius: 14,
            padding: "18px 18px 16px",
            marginBottom: 14,
            border: "1px solid #F0E0C0",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <span style={{ fontSize: 16 }}>💝</span>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#7A5A2E", letterSpacing: 0.3 }}>
                この作品が生まれたストーリー
              </div>
            </div>
            <div style={{
              fontSize: 13.5,
              color: "#5A4A2C",
              lineHeight: 2,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              fontStyle: "normal",
              paddingLeft: 6,
              borderLeft: "2px solid #E8C089",
              marginLeft: 4,
            }}>
              {item.creation_story}
            </div>
          </div>
        )}

        {/* Phase B: 種類 (Variant) 選択 UI
            ブランド v3 第7章: "翻訳しすぎない"。「種類を選ぶ」普通の言葉、控えめ。
            ブランド v3 第6章: NG "在庫切れ" → "売り切れ"、"残り○点" は controlled 表示OK */}
        {hasVariants && variantOptionKeys.length > 0 && (
          <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:12 }}>
              種類を選ぶ
            </div>
            {variantOptionKeys.map(key => (
              <div key={key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, marginBottom:6 }}>
                  {key}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {variantOptionValues[key].map(val => {
                    // この値を含む variants で、在庫があるものがあるか
                    const hasStock = variants.some(v =>
                      v.attributes?.[key] === val && v.stock > 0 && v.is_active
                    );
                    const isSelected = selectedAttrs[key] === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setSelectedAttrs(prev => ({ ...prev, [key]: val }))}
                        disabled={!hasStock}
                        style={{
                          padding:"8px 14px",
                          borderRadius:10,
                          border: isSelected
                            ? `2px solid ${C.orange}`
                            : `1.5px solid ${hasStock ? C.border : "#E0E0E0"}`,
                          background: isSelected
                            ? C.orangePale
                            : hasStock ? C.white : "#F5F5F5",
                          color: isSelected
                            ? C.orange
                            : hasStock ? C.dark : "#BDBDBD",
                          cursor: hasStock ? "pointer" : "not-allowed",
                          fontSize: 13,
                          fontWeight: 700,
                          fontFamily: "inherit",
                          textDecoration: hasStock ? "none" : "line-through",
                        }}
                      >
                        {val}
                        {!hasStock && "（売り切れ）"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* 選択結果表示 (全軸選択済みで variant が確定した時) */}
            {selectedVariant && (
              <div style={{ marginTop:12, padding:"10px 12px", background:C.cream, borderRadius:10 }}>
                <div style={{ fontSize:12, color:C.warmGray, marginBottom:4 }}>
                  選んだ種類
                </div>
                <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4 }}>
                  {selectedVariant.variant_name}
                </div>
                <div style={{ fontSize:13, color:C.orange, fontWeight:700 }}>
                  ¥{(selectedVariant.price || 0).toLocaleString()}
                  {selectedVariant.stock > 0 && selectedVariant.stock <= 3 && (
                    <span style={{ fontSize:11, color:C.warmGray, marginLeft:8, fontWeight:500 }}>
                      （残り{selectedVariant.stock}点）
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* 未選択時のヒント */}
            {!selectedVariant && (
              <div style={{ marginTop:8, fontSize:11, color:C.warmGray }}>
                {variantOptionKeys.filter(k => !selectedAttrs[k]).join("、")} を選んでください
              </div>
            )}
          </div>
        )}

        {/* 有料オプション */}
        {itemOptions.length > 0 && (
          <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:10 }}>🔧 有料オプション</div>
            {itemOptions.map((opt, i) => (
              <div key={i} onClick={()=>toggleOption(i)} style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px", marginBottom:6,
                background:selectedOptions[i]?C.orangePale:C.lightGray, borderRadius:10, cursor:"pointer",
                border:`1.5px solid ${selectedOptions[i]?C.orange:C.border}`
              }}>
                <div style={{
                  width:22, height:22, borderRadius:6, border:`2px solid ${selectedOptions[i]?C.orange:C.border}`,
                  background:selectedOptions[i]?C.orange:"transparent", display:"flex", alignItems:"center", justifyContent:"center",
                  flexShrink:0
                }}>
                  {selectedOptions[i] && <span style={{ color:"#fff", fontSize:14, fontWeight:900 }}>✓</span>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{opt.name}</div>
                </div>
                <div style={{ fontSize:14, fontWeight:900, color:C.orange, flexShrink:0 }}>+¥{opt.price?.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          {(() => {
            // 依頼書 #104 Phase B (2026/6/3): 送料表示 4タイプ別
            const st = item.shipping_type || "included";
            let shipLabel: string = "";
            if (st === "included") shipLabel = "✅ 送料込み";
            else if (st === "flat_rate") shipLabel = `📮 全国一律 ¥${(item.shipping_fee || 0).toLocaleString()}`;
            else if (st === "regional") shipLabel = "🗾 地域により異なる";
            else if (st === "methods") shipLabel = "📦 配送方法から選択 (下で選んでください)";
            else if (st === "consultation") shipLabel = "💬 出品者にお問い合わせ";
            const rows: Array<[string, string]> = [
              ["⏱️ 納期", item.delivery],
              ["📬 受け渡し", item.delivery_type === "shipping" ? "📦 配送" : item.delivery_type === "visit" ? "📍 訪問" : "💻 データ"],
              ["🚚 送料", shipLabel],
              ["🐾 対象", item.pet === "both" ? "🐾 両対応" : `${petIcon(item.pet)} ${petLabelShort(item.pet)}向け`],
              ["🔒 保証", "エスクロー決済"],
            ];
            return rows.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13, color: C.warmGray }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{v}</span>
              </div>
            ));
          })()}
          {/* regional 時の地域別送料 - 依頼書 #104 Phase B-2 (2026/6/3) で選択可能ラジオ化 */}
          {item.shipping_type === "regional" && Array.isArray(item.shipping_rates) && item.shipping_rates.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: C.cream, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, marginBottom: 6 }}>📍 配送先地域を選択</div>
              {item.shipping_rates.map((r: any, i: number) => {
                const isSelected = selectedShippingRegion === r.region;
                return (
                  <div key={i} onClick={()=>setSelectedShippingRegion(r.region)} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"8px 10px", fontSize:12, cursor:"pointer", marginBottom:4,
                    background:isSelected ? C.white : "transparent",
                    border:isSelected ? `1.5px solid ${C.orange}` : `1.5px solid transparent`,
                    borderRadius:6
                  }}>
                    <span style={{ color:C.dark, display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${isSelected?C.orange:C.border}`, display:"inline-block", position:"relative", flexShrink:0 }}>
                        {isSelected && <span style={{ position:"absolute", top:2, left:2, right:2, bottom:2, borderRadius:"50%", background:C.orange, display:"block" }}></span>}
                      </span>
                      {r.region}
                    </span>
                    <span style={{ fontWeight:700, color:C.orange }}>¥{(r.fee || 0).toLocaleString()}</span>
                  </div>
                );
              })}
              {selectedShippingRegion && (
                <div style={{ marginTop:6, padding:"6px 10px", background:C.orangePale, borderRadius:6, fontSize:11, color:C.orange, fontWeight:700, textAlign:"center" }}>
                  ✓ {selectedShippingRegion} を選択中
                </div>
              )}
            </div>
          )}
          {/* 依頼書 #127 Phase C (2026/6/5): methods 時の配送方法選択ラジオ (購入者) */}
          {item.shipping_type === "methods" && Array.isArray(item.shipping_methods) && item.shipping_methods.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, background: C.cream, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.warmGray, marginBottom: 6 }}>📦 配送方法を選択</div>
              {item.shipping_methods.map((m: any, i: number) => {
                const isSelected = selectedShippingMethodId === m.id || (!selectedShippingMethodId && i === 0);
                return (
                  <div key={m.id || i} onClick={()=>setSelectedShippingMethodId(m.id)} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"8px 10px", fontSize:12, cursor:"pointer", marginBottom:4,
                    background:isSelected ? C.white : "transparent",
                    border:isSelected ? `1.5px solid ${C.orange}` : `1.5px solid transparent`,
                    borderRadius:6
                  }}>
                    <span style={{ color:C.dark, display:"flex", alignItems:"center", gap:8, flex:1, minWidth:0 }}>
                      <span style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${isSelected?C.orange:C.border}`, display:"inline-block", position:"relative", flexShrink:0 }}>
                        {isSelected && <span style={{ position:"absolute", top:2, left:2, right:2, bottom:2, borderRadius:"50%", background:C.orange, display:"block" }}></span>}
                      </span>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {m.name}
                        {m.note && <span style={{ color:C.warmGray, fontSize:10, marginLeft:6 }}>({m.note})</span>}
                      </span>
                    </span>
                    <span style={{ fontWeight:700, color:C.orange, flexShrink:0, marginLeft:8 }}>¥{(m.fee || 0).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
          {/* shipping_note 補足説明 */}
          {item.shipping_note && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: C.cream, borderRadius: 6, fontSize: 11, color: C.warmGray, lineHeight: 1.5 }}>
              💡 {item.shipping_note}
            </div>
          )}
        </div>

        {/* エスクロー説明 */}
        <div style={{ background:"#E3F2FD", borderRadius:14, padding:"14px", marginBottom:14, border:"1px solid #BBDEFB" }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.blue, marginBottom:6 }}>🔒 安心のエスクロー決済</div>
          <div style={{ fontSize:12, color:"#555", lineHeight:1.7 }}>
            お支払いはQoccaが一時お預かりし、取引完了後に出品者へ支払われます。万が一トラブルがあった場合も返金対応いたします。
          </div>
        </div>

        {/* キャンセルポリシー */}
        <div style={{ background:C.lightGray, borderRadius:14, padding:"14px", marginBottom:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:6 }}>📋 キャンセルポリシー</div>
          <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.7 }}>
            ・作業開始前（購入者都合）：決済手数料を差し引いて返金{"\n"}
            ・作業開始前（出品者都合）：全額返金{"\n"}
            ・納品後72時間以内：異議申し立て可能{"\n"}
            ・納品後72時間経過：自動的に取引完了（返金不可）
          </div>
        </div>

        {REVIEWS.length > 0 && (
          <div style={{ background:C.white, borderRadius:14, padding:"14px", marginBottom:80, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:12 }}>レビュー ({item.reviews}件)</div>
            {REVIEWS.map((r,i)=>(
              <div key={i} style={{ marginBottom:12, paddingBottom:12, borderBottom:i<REVIEWS.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ width:30, height:30, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>{r.pet}</div>
                  <div>
                    <div style={{ fontWeight:700, fontSize:13, color:C.dark }}>{r.user}</div>
                    <Stars rating={r.rating} size={11}/>
                  </div>
                  <span style={{ marginLeft:"auto", fontSize:11, color:C.warmGray }}>{r.date}</span>
                </div>
                <div style={{ fontSize:13, color:"#555", lineHeight:1.6 }}>{r.comment}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ textAlign:"center", marginBottom:80 }}>
          <button onClick={()=>setShowReport(true)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:12, color:"#ccc", textDecoration:"underline", fontFamily:"inherit" }}>🚨 このサービスを通報する</button>
        </div>
      </div>

      {/* 通報モーダル */}
      {showReport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowReport(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%" }} onClick={e=>e.stopPropagation()}>
            {reportDone ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
                <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>通報を受け付けました</div>
                <div style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>管理者が確認次第、対応いたします。</div>
                <button onClick={()=>{setShowReport(false);setReportDone(false);}} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>閉じる</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:4 }}>🚨 通報する</div>
                <div style={{ fontSize:12, color:C.warmGray, marginBottom:20 }}>通報内容を選択してください</div>
                <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
                  {["🐾 生体動物の売買","💬 プラットフォーム外への誘導","🎭 なりすまし・偽サービス","⚠️ 著作権侵害","🔞 不適切なコンテンツ","💰 詐欺・虚偽の内容","その他"].map(type => (
                    <button key={type} onClick={()=>setReportType(type)} style={{
                      padding:"12px 16px", border:`2px solid ${reportType===type?C.red:C.border}`,
                      borderRadius:12, background:reportType===type?C.redPale:"#fff",
                      color:reportType===type?C.red:"#3D3B38",
                      fontWeight:700, fontSize:14, cursor:"pointer", textAlign:"left", fontFamily:"inherit"
                    }}>{type}</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setShowReport(false)} style={{ flex:1, padding:"13px", background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                  <button onClick={()=>reportType&&setReportDone(true)} disabled={!reportType} style={{ flex:2, padding:"13px", background:reportType?C.red:C.border, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:reportType?"pointer":"not-allowed", fontFamily:"inherit" }}>通報する</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 配送先住所選択モーダル */}
      {showAddressStep && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:201, display:"flex", alignItems:"flex-end" }} onClick={()=>setShowAddressStep(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px", width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>📦 配送先を選択</div>
              <button onClick={()=>setShowAddressStep(false)} style={{ background:"none", border:"none", fontSize:20, color:C.warmGray, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ background:"#FFF8F0", padding:"10px 12px", borderRadius:10, fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.5 }}>
              🔒 配送先情報は出品者に共有され、配送目的のみに使用されます。取引完了後30日で自動削除されます。
            </div>

            {savedAddresses.length > 0 && (
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button onClick={()=>setAddressMode("select")} style={{
                  flex:1, padding:"10px", border:`1.5px solid ${addressMode==="select"?C.orange:C.border}`,
                  borderRadius:10, background:addressMode==="select"?C.orangePale:C.white,
                  color:addressMode==="select"?C.orange:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                }}>📋 保存済みから選択</button>
                <button onClick={()=>setAddressMode("new")} style={{
                  flex:1, padding:"10px", border:`1.5px solid ${addressMode==="new"?C.orange:C.border}`,
                  borderRadius:10, background:addressMode==="new"?C.orangePale:C.white,
                  color:addressMode==="new"?C.orange:C.warmGray, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
                }}>➕ 新規入力</button>
              </div>
            )}

            {addressMode === "select" && savedAddresses.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                {savedAddresses.map(addr => (
                  <button key={addr.id} onClick={()=>setSelectedAddressId(addr.id)} style={{
                    padding:"12px 14px", border:`2px solid ${selectedAddressId===addr.id?C.orange:C.border}`,
                    borderRadius:10, background:selectedAddressId===addr.id?C.orangePale:C.white,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left"
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{addr.label || "住所"}</span>
                      {addr.is_default && <span style={{ fontSize:10, padding:"2px 8px", background:C.orange, color:"#fff", borderRadius:6, fontWeight:700 }}>デフォルト</span>}
                      {selectedAddressId===addr.id && <span style={{ marginLeft:"auto", color:C.orange, fontSize:18 }}>✓</span>}
                    </div>
                    <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.5 }}>
                      <div>{addr.recipient_name} 様</div>
                      <div>〒{addr.postal_code} {addr.prefecture}{addr.city}</div>
                      <div>{addr.address_line}</div>
                      <div>📱 {addr.phone}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {addressMode === "new" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
                {[
                  { k:"label", label:"ラベル", placeholder:"自宅", maxLength:20 },
                  { k:"recipient_name", label:"受取人名（本名）*", placeholder:"山田 太郎" },
                  { k:"postal_code", label:"郵便番号 *", placeholder:"530-0001", maxLength:8 },
                  { k:"prefecture", label:"都道府県 *", placeholder:"大阪府" },
                  { k:"city", label:"市区町村 *", placeholder:"大阪市北区梅田" },
                  { k:"address_line", label:"番地・建物名 *", placeholder:"1-1-1 〇〇マンション101" },
                  { k:"phone", label:"電話番号 *", placeholder:"090-1234-5678", maxLength:13 },
                ].map(f => (
                  <div key={f.k}>
                    <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:4 }}>{f.label}</label>
                    <input
                      value={addressForm[f.k as keyof typeof addressForm] as string}
                      onChange={e=>setAddressForm({...addressForm, [f.k]:e.target.value})}
                      placeholder={f.placeholder}
                      maxLength={f.maxLength}
                      style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setShowAddressStep(false)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={()=>{
                if (addressMode === "new") {
                  if (!addressForm.recipient_name || !addressForm.postal_code || !addressForm.prefecture || !addressForm.city || !addressForm.address_line || !addressForm.phone) {
                    alert("必須項目をすべて入力してください");
                    return;
                  }
                } else {
                  if (!selectedAddressId) { alert("住所を選択してください"); return; }
                }
                // 🔴 緊急修正 (2026/6/5 King テスト後追い): methods 出品で配送方法未選択のまま決済モーダルに進めないガード
                if (item.shipping_type === "methods") {
                  const methods = Array.isArray(item.shipping_methods) ? item.shipping_methods : [];
                  if (methods.length > 0 && !selectedShippingMethodId && !methods[0]?.id) {
                    alert("配送方法を選択してください");
                    return;
                  }
                }
                if (item.shipping_type === "regional" && !selectedShippingRegion) {
                  alert("配送先地域を選択してください");
                  return;
                }
                setShowAddressStep(false);
                setShowConfirm(true);
              }} style={{ flex:2, padding:"13px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>
                次へ進む →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 購入確認モーダル */}
      {/* 依頼書 #113 緊急 (2026/6/4): 自分の出品編集モーダル (DetailPage から起動) */}
      {showMyEditModal && (
        <ListingEditModal
          listing={item}
          onClose={() => setShowMyEditModal(false)}
          onSaved={() => { setShowMyEditModal(false); /* 編集後ページリロードで反映 */ window.location.reload(); }}
        />
      )}

      {showConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"flex-end" }} onClick={()=>!ordering&&setShowConfirm(false)}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%" }} onClick={e=>e.stopPropagation()}>
            <>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:16 }}>🛒 注文内容の確認</div>
              <div style={{ background:C.lightGray, borderRadius:14, padding:"14px", marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4 }}>{item.title}</div>
                <div style={{ fontSize:12, color:C.warmGray, marginBottom:8 }}>{item.seller} · 納期 {item.delivery}</div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray }}>基本料金</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>¥{item.price.toLocaleString()}</span>
                </div>
                {itemOptions.filter((_, i) => selectedOptions[i]).map((o, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                    <span style={{ fontSize:12, color:C.warmGray }}>🔧 {o.name}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:C.orange }}>+¥{o.price.toLocaleString()}</span>
                  </div>
                ))}
                {/* 🔴 緊急修正 (2026/6/5 King テスト後追い): 送料行表示 (flat_rate / regional / methods 選択時) */}
                {(() => {
                  const st = item.shipping_type || "included";
                  let shipFeeConfirm = 0;
                  let shipLabel = "";
                  if (st === "flat_rate") { shipFeeConfirm = item.shipping_fee || 0; shipLabel = "📮 送料 (全国一律)"; }
                  else if (st === "regional" && selectedShippingRegion) {
                    const rate = (item.shipping_rates || []).find((r: any) => r.region === selectedShippingRegion);
                    shipFeeConfirm = rate?.fee || 0; shipLabel = `🗾 送料 (${selectedShippingRegion})`;
                  } else if (st === "methods") {
                    const methods = Array.isArray(item.shipping_methods) ? item.shipping_methods : [];
                    const chosen = methods.find((m: any) => m.id === selectedShippingMethodId) || methods[0];
                    if (chosen) { shipFeeConfirm = chosen.fee || 0; shipLabel = `📦 送料 (${chosen.name})`; }
                  }
                  return shipFeeConfirm > 0 ? (
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:12, color:C.warmGray }}>{shipLabel}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:C.dark }}>+¥{shipFeeConfirm.toLocaleString()}</span>
                    </div>
                  ) : null;
                })()}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderTop:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:12, color:C.warmGray }}>🛡️ バイヤープロテクション(4%)</span>
                  <span style={{ fontSize:12, fontWeight:700, color:C.warmGray }}>+¥{Math.floor(totalPrice * 0.04).toLocaleString()}</span>
                </div>
                {/* 🔴 緊急修正 (2026/6/5): 合計に送料を加算 (Stripe 側 ¥1,589 と一致させる / 旧: 商品+BP のみで Stripe と不整合) */}
                {(() => {
                  const st = item.shipping_type || "included";
                  let shipFeeConfirm = 0;
                  if (st === "flat_rate") shipFeeConfirm = item.shipping_fee || 0;
                  else if (st === "regional" && selectedShippingRegion) {
                    const rate = (item.shipping_rates || []).find((r: any) => r.region === selectedShippingRegion);
                    shipFeeConfirm = rate?.fee || 0;
                  } else if (st === "methods") {
                    const methods = Array.isArray(item.shipping_methods) ? item.shipping_methods : [];
                    const chosen = methods.find((m: any) => m.id === selectedShippingMethodId) || methods[0];
                    if (chosen) shipFeeConfirm = chosen.fee || 0;
                  }
                  const bp = Math.floor(totalPrice * 0.04);
                  const grand = totalPrice + shipFeeConfirm + bp;
                  return (
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0", borderTop:`2px solid ${C.dark}`, marginTop:4 }}>
                      <span style={{ fontSize:14, fontWeight:800, color:C.dark }}>お支払い合計</span>
                      <span style={{ fontSize:20, fontWeight:900, color:C.orange }}>¥{grand.toLocaleString()}</span>
                    </div>
                  );
                })()}
              </div>
              {/* 依頼書 #143 TOP2 方式B (2026/6/10): 出品者が送金未連携の場合の警告 (購入は止めない / 同意の上で進める) */}
              {sellerPayoutsEnabled === false && (
                <div style={{ background:"#FFF8E1", border:"1px solid #F5D680", borderRadius:10, padding:"10px 12px", marginBottom:12, fontSize:11.5, color:"#7A5C00", lineHeight:1.7 }}>
                  ⚠️ この出品者はまだ売上の受け取り準備中です。発送・対応が遅れる場合があります。ご了承の上でお進みください。
                </div>
              )}
              <div style={{ background:"#E3F2FD", borderRadius:10, padding:"10px", marginBottom:12, fontSize:11, color:C.blue, lineHeight:1.6 }}>
                🔒 Stripe安全決済：クレジットカード情報はStripeが安全に処理します。Qoccaにカード情報は保存されません。
              </div>
              <div style={{ fontSize:10, color:C.warmGray, lineHeight:1.6, marginBottom:16 }}>
                「決済に進む」をクリックすると、Stripeの決済ページに移動します。<span style={{ color:C.orange, fontWeight:700 }}>利用規約</span>・<span style={{ color:C.orange, fontWeight:700 }}>キャンセルポリシー</span>に同意したものとみなされます。
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button disabled={ordering} onClick={()=>setShowConfirm(false)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
                <button disabled={ordering} onClick={handleConfirmOrder} style={{ flex:2, padding:"13px", background:ordering?C.warmGray:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:ordering?"not-allowed":"pointer", fontFamily:"inherit" }}>
                  {ordering ? "処理中..." : "💳 決済に進む"}
                </button>
              </div>
            </>
          </div>
        </div>
      )}

      {/* Fixed bottom order bar */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:C.white, borderTop:`1px solid ${C.border}`,
        // safe-area 対応(レイアウトのみ): ホームインジケータ機で購入ボタンが潜らないよう下paddingにsafe-areaを加算
        padding:"12px 16px calc(12px + env(safe-area-inset-bottom, 0px))", display:"flex", alignItems:"center", gap:12,
        boxShadow:"0 -4px 20px rgba(0,0,0,0.08)"
      }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:C.warmGray }}>お支払い金額(BP込)</div>
          <div style={{ fontSize:24, fontWeight:900, color:C.orange }}>¥{(totalPrice + Math.floor(totalPrice * 0.04)).toLocaleString()}</div>
          <div style={{ fontSize:10, color:C.warmGray }}>
            {/* Phase B: variant 選択時はその価格、未選択時 (単品 or variant 未確定) は item.price */}
            商品 ¥{(basePrice || item.price || 0).toLocaleString()}{optionsTotal > 0 ? ` + オプション ¥${optionsTotal.toLocaleString()}` : ""} + BP ¥{Math.floor(totalPrice * 0.04).toLocaleString()}
          </div>
        </div>
        {ordered ? (
          <div style={{ flex:2, textAlign:"center", padding:"12px", background:C.green, borderRadius:12, color:"#fff", fontWeight:800 }}>🎉 注文完了！</div>
        ) : (
          /* Phase B: hasVariants で variant 未選択時は無効化、ラベルも変化 */
          <button
            onClick={handleOrder}
            disabled={hasVariants && !selectedVariant}
            style={{
              flex:2,
              padding:"14px",
              background: (hasVariants && !selectedVariant) ? C.warmGray : C.orange,
              border:"none",
              borderRadius:12,
              color:"#fff",
              fontWeight:800,
              fontSize:16,
              cursor: (hasVariants && !selectedVariant) ? "not-allowed" : "pointer",
              fontFamily: "inherit"
            }}
          >
            {hasVariants && !selectedVariant
              ? "種類を選んでください"
              : (user ? "🐾 注文する" : "🔒 ログインして注文")}
          </button>
        )}
      </div>
      {/* 2026/6/29 案① B案: フローティング戻るボタン (スクロール中も常に押せる)。
          DetailPage は TabBar 非表示 (showTabBar=false in App.tsx:174) だが、下部に注文バー
          (position:fixed L1444・高さ ~90px + safe-area) があるため、その上に逃がす。
          bottomOffset=120: 注文バー上端から 12px ほど余白を取って円形48px ボタンを置く位置。 */}
      <FloatingBackButton onClick={onBack} bottomOffset={120} />
    </div>
  );
};

// ── SELL ───────────────────────────────────────────────────────────────────
export const SellPage = ({ setPage }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // 依頼書 #104 Phase B: form に shipping_* 4項目追加 (デフォルト included)
  // shipping_rates は地域別配列 [{ region: '本州', fee: 0 }, ...]
  const [form, setForm] = useState<any>({
    cat:"", pet:"both", title:"", desc:"", price:"", delivery:"", delivery_type:"data_only", stock:"", creation_story:"",
    shipping_type:"included", shipping_fee:"", shipping_rates: [
      { region: "本州", fee: 0 },
      { region: "北海道", fee: 0 },
      { region: "沖縄・離島", fee: 0 },
    ], shipping_note:"",
    // 依頼書 #127 Phase B (2026/6/5): minne 型 配送方法選択 (購入者が選ぶ)
    //   id は uuid 風 (送信時に確定) / name 必須 / fee >= 0 / note 任意 / 最大 5 件
    shipping_methods: [
      { id: "m1", name: "クリックポスト", fee: 185, note: "" },
      { id: "m2", name: "宅急便60サイズ", fee: 750, note: "" },
    ],
  });
  const [images, setImages] = useState([]);
  const [options, setOptions] = useState([]);
  // Phase B: Variant (種類) state
  // - hasVariants: チェックON で variant モード
  // - variantOptions: 軸の定義 (例: [{name: "構図", values: ["マズルアップ", "全身"]}]) max 2 項目
  // - variants: 組合せの実体 [{variant_name, attributes, price, stock, image_url}]
  const [hasVariants, setHasVariants] = useState(false);
  const [variantOptions, setVariantOptions] = useState<Array<{ name: string; values: string[] }>>([]);
  const [variants, setVariants] = useState<Array<any>>([]);
  // 依頼書 #9 (5/25): 創業クリエイターフラグ + カテゴリ別価格統計
  const [isFoundingCreator, setIsFoundingCreator] = useState(false);
  const [foundingFeeRate, setFoundingFeeRate] = useState<number | null>(null);
  const [categoryPriceStats, setCategoryPriceStats] = useState<Record<string, { avg: number; min: number; max: number; count: number }>>({});
  const [priceHelpOpen, setPriceHelpOpen] = useState(false);
  const up = (k,v) => setForm(p=>({...p,[k]:v}));
  const fileRef = useRef(null);
  const addOption = () => setOptions(prev => [...prev, { name:"", price:"" }]);
  const updateOption = (idx, key, val) => setOptions(prev => prev.map((o,i) => i===idx ? {...o, [key]:val} : o));
  const removeOption = (idx) => setOptions(prev => prev.filter((_,i) => i!==idx));

  // Phase B: Variant 操作関数群
  const addVariantOption = () => {
    if (variantOptions.length >= 2) return; // 最大2項目 (例: 色 × サイズ)
    setVariantOptions(prev => [...prev, { name: "", values: [""] }]);
  };
  const removeVariantOption = (idx) => {
    setVariantOptions(prev => prev.filter((_, i) => i !== idx));
  };
  const updateVariantOptionName = (idx, name) => {
    setVariantOptions(prev => prev.map((o, i) => i === idx ? { ...o, name } : o));
  };
  const addVariantOptionValue = (optIdx) => {
    setVariantOptions(prev => prev.map((o, i) =>
      i === optIdx ? { ...o, values: [...o.values, ""] } : o
    ));
  };
  const updateVariantOptionValue = (optIdx, valIdx, value) => {
    setVariantOptions(prev => prev.map((o, i) =>
      i === optIdx ? { ...o, values: o.values.map((v, j) => j === valIdx ? value : v) } : o
    ));
  };
  const removeVariantOptionValue = (optIdx, valIdx) => {
    setVariantOptions(prev => prev.map((o, i) =>
      i === optIdx ? { ...o, values: o.values.filter((_, j) => j !== valIdx) } : o
    ));
  };

  // 組合せ自動生成 (variantOptions の値リストからすべての組合せを生成)
  // 既存 variant の価格・在庫・画像情報は保持 (attributes 完全一致で照合)
  const regenerateVariants = React.useCallback(() => {
    if (variantOptions.length === 0) {
      setVariants([]);
      return;
    }
    const combinations: any[] = [];
    const generate = (currentIdx: number, currentAttrs: any, currentName: string) => {
      if (currentIdx >= variantOptions.length) {
        combinations.push({
          variant_name: currentName.trim() || "デフォルト",
          attributes: currentAttrs,
          price: form.price || "",
          stock: 1,
          image_url: null,
        });
        return;
      }
      const opt = variantOptions[currentIdx];
      const validValues = opt.values.filter(v => v && v.trim());
      for (const val of validValues) {
        const newAttrs = { ...currentAttrs, [opt.name]: val };
        const separator = currentName ? " × " : "";
        generate(currentIdx + 1, newAttrs, currentName + separator + val);
      }
    };
    generate(0, {}, "");
    // 既存の variant 情報を保持
    setVariants(prev => {
      return combinations.map(c => {
        const existing = prev.find(p =>
          JSON.stringify(p.attributes) === JSON.stringify(c.attributes)
        );
        return existing
          ? { ...c, price: existing.price, stock: existing.stock, image_url: existing.image_url }
          : c;
      });
    });
  }, [variantOptions, form.price]);

  const updateVariant = (idx, key, value) => {
    setVariants(prev => prev.map((v, i) => i === idx ? { ...v, [key]: value } : v));
  };

  // variantOptions が変更されたら variants を再生成
  useEffect(() => {
    if (hasVariants) {
      regenerateVariants();
    }
  }, [variantOptions, hasVariants, regenerateVariants]);

  // 依頼書 #9 (5/25): 創業クリエイター情報取得 (事業が存続する限り3% バナー表示用)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_founding_creator, founding_creator_fee_rate")
        .eq("id", user.id)
        .single();
      if (data?.is_founding_creator) {
        setIsFoundingCreator(true);
        setFoundingFeeRate(data.founding_creator_fee_rate ?? 3);
      }
    })();
  }, [user?.id]);

  // 依頼書 #9 (5/25): カテゴリ別価格統計 (1 回のみ取得)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("listings")
        .select("category, price")
        .eq("status", "approved");
      if (!data) return;
      const stats: Record<string, { avg: number; min: number; max: number; count: number; sum: number }> = {};
      data.forEach((r: { category: string; price: number }) => {
        if (!r.category || typeof r.price !== "number") return;
        if (!stats[r.category]) stats[r.category] = { avg: 0, min: r.price, max: r.price, count: 0, sum: 0 };
        stats[r.category].sum += r.price;
        stats[r.category].count++;
        if (r.price < stats[r.category].min) stats[r.category].min = r.price;
        if (r.price > stats[r.category].max) stats[r.category].max = r.price;
      });
      const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
      for (const k of Object.keys(stats)) {
        result[k] = {
          avg: Math.round(stats[k].sum / stats[k].count),
          min: stats[k].min, max: stats[k].max, count: stats[k].count,
        };
      }
      setCategoryPriceStats(result);
    })();
  }, []);

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 5) { setError("画像は最大5枚までです"); return; }
    setImages(prev => [...prev, ...files].slice(0, 5));
    setError("");
  };
  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (isDraft = false) => {
    setSubmitting(true);
    setError("");
    // Phase B: variants が有効な時のみ price>0 のものを採用 (バリデーション)
    const validVariants = hasVariants
      ? variants.filter(v => v.price && parseInt(v.price) > 0)
      : [];
    const { error: err } = await submitListing(
      user.id,
      form,
      images,
      options.map(o => ({ name:o.name, price:parseInt(o.price)||0 })),
      isDraft,
      validVariants
    );
    setSubmitting(false);
    if (err) { setError((isDraft ? "下書き保存" : "出品") + "に失敗しました: " + err.message); return; }
    setDone({ isDraft });
  };

  // 依頼書 #9 (5/25) P1 改善: ログイン未済画面に温度感 + クラファン期間の特典告知
  if (!user) return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:32, maxWidth:420 }}>
        <div style={{ fontSize:56, marginBottom:12 }}>🐾</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:8 }}>あなたの想いを、街に置きにきませんか</h2>
        <p style={{ color:C.warmGray, fontSize:13, lineHeight:1.8, marginBottom:20 }}>
          Qocca は、ペット作家さんの作品を<br />
          「想いごと」街に置く場所です🌅
        </p>
        <div style={{
          background:"linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
          border:`2px solid ${C.orange}`,
          borderRadius:14, padding:"14px 16px", marginBottom:20,
          textAlign:"left", lineHeight:1.7,
        }}>
          <div style={{ fontSize:13, fontWeight:800, color:"#D84315", marginBottom:4 }}>
            ⭐ 今だけ：テスマケ期間中は出品手数料 0%
          </div>
          <div style={{ fontSize:11, color:"#BF360C" }}>
            2026/7/31 までに出品 → 通常 10% の手数料が無料に🌸
          </div>
        </div>
        <button onClick={()=>setPage("signup")} style={{ width:"100%", padding:"14px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", marginBottom:8 }}>ログイン / 新規登録して出品する</button>
        <div style={{ fontSize:10, color:C.warmGray, lineHeight:1.7 }}>
          30 秒で街の住民になれます · 機械的な事務処理なし
        </div>
      </div>
    </div>
  );

  // 依頼書 #9 (5/25) P5 改善: 完了画面の温度感アップ + SNS シェア
  if (done) {
    const isDraftDone = done && done.isDraft;
    const productTitle = form.title || "あなたの作品";
    const shareText = encodeURIComponent(`🐾 「${productTitle}」を Qocca の街に置いてきました🌅\n#Qocca #ペットクリエイター`);
    const shareUrl = encodeURIComponent("https://qocca.pet");
    return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", padding:32, maxWidth:440 }}>
        <div style={{ fontSize:56, marginBottom:12, animation:"qoccaSellFloat 1.4s ease infinite" }}>{isDraftDone ? "💾" : "🐾"}</div>
        <h2 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:10 }}>
          {isDraftDone ? "下書き保存しました！" : "ありがとうございます！"}
        </h2>
        {!isDraftDone && (
          <p style={{ color:C.dark, fontSize:14, lineHeight:1.9, marginBottom:16 }}>
            「<strong style={{ color:C.orange }}>{productTitle}</strong>」が<br />
            Qocca の街に届きました。<br />
            <span style={{ fontSize:12, color:C.warmGray }}>今、運営事務局がやさしく確認しています。</span>
          </p>
        )}
        {isDraftDone && (
          <p style={{ color:C.warmGray, fontSize:13, lineHeight:1.8, marginBottom:20 }}>
            マイページの「下書き一覧」から、いつでも編集して投稿できます🐾
          </p>
        )}
        {!isDraftDone && (
          <>
            <div style={{ background:"#FFF8E1", border:`1px solid #FFC107`, borderRadius:12, padding:"10px 14px", marginBottom:16, fontSize:11, color:"#7B5E00", lineHeight:1.7 }}>
              ⏱ テスマケ期間中は <strong>通常数時間以内</strong> に公開されます<br />
              <span style={{ opacity:0.7 }}>(最大24時間以内。審査基準: ① ペットの安全 ② 著作権 ③ 価格妥当性)</span>
            </div>
            <p style={{ color:C.warmGray, fontSize:12, lineHeight:1.8, marginBottom:20 }}>
              ✨ 街であなたの想いが届きますように
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", justifyContent:"center" }}>
              <a href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer"
                 style={{ flex:1, minWidth:130, padding:"10px 14px", background:"#000", color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", textDecoration:"none", display:"inline-block" }}>
                𝕏 でシェア
              </a>
              <a href={`https://www.threads.net/intent/post?text=${shareText}`} target="_blank" rel="noopener noreferrer"
                 style={{ flex:1, minWidth:130, padding:"10px 14px", background:"#101010", color:"#fff", border:"none", borderRadius:10, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", textDecoration:"none", display:"inline-block" }}>
                @ Threads でシェア
              </a>
            </div>
          </>
        )}
        <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={()=>setPage("mypage")} style={{ flex:1, minWidth:140, padding:"12px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>マイページで確認</button>
          <button onClick={()=>{setDone(false);setStep(1);setForm({cat:"",pet:"both",title:"",desc:"",price:"",delivery:"",delivery_type:"data_only",stock:""});setImages([]);setOptions([]);setHasVariants(false);setVariantOptions([]);setVariants([]);}} style={{ flex:1, minWidth:140, padding:"12px 24px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:12, color:C.orange, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>続けて出品</button>
        </div>
        <style>{`@keyframes qoccaSellFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`}</style>
      </div>
    </div>
    );
  }

  // 依頼書 #9 (5/25) P1: テスマケ期間カウントダウン
  const testmakeEndDate = new Date("2026-07-31T23:59:59+09:00");
  const testmakeDaysLeft = Math.max(0, Math.ceil((testmakeEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const testmakeActive = testmakeDaysLeft > 0;

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:C.cream }}>
      {/* 依頼書 #114 (2026/6/5): 最下部に TabBar(70px) + safe-area 分の paddingBottom 追加 / 「次へ・戻る」ボタン露出担保 */}
      <div style={{ maxWidth:500, margin:"0 auto", padding:"20px 16px calc(env(safe-area-inset-bottom, 8px) + 88px)" }}>
        {/* 依頼書 #9 (5/25) P1: ウェルカムバナー (テスマケ期間 0% + 創業者特典) */}
        {step === 1 && (
          <>
            {testmakeActive && !isFoundingCreator && (
              <div style={{
                background:"linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
                border:`2px solid ${C.orange}`, borderRadius:14,
                padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12,
              }}>
                <div style={{ fontSize:28 }}>🌅</div>
                <div style={{ flex:1, lineHeight:1.6 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#D84315" }}>
                    テスマケ期間中 — 出品手数料 <strong style={{ fontSize:16 }}>0%</strong>
                  </div>
                  <div style={{ fontSize:11, color:"#BF360C" }}>
                    残り <strong>{testmakeDaysLeft}日</strong> (〜2026/7/31 まで)
                  </div>
                </div>
              </div>
            )}
            {isFoundingCreator && (
              <div style={{
                background:"linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)",
                border:`2px solid #AB47BC`, borderRadius:14,
                padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12,
              }}>
                <div style={{ fontSize:28 }}>🎨</div>
                <div style={{ flex:1, lineHeight:1.6 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#6A1B9A" }}>
                    創業クリエイター事業が存続する限り {foundingFeeRate ?? 3}% 手数料
                  </div>
                  <div style={{ fontSize:11, color:"#7B1FA2" }}>
                    出品し続けても事業が存続する限りに優遇率で支えますで🌸
                  </div>
                </div>
              </div>
            )}
            {testmakeActive && !isFoundingCreator && (
              <div onClick={()=>{ window.location.href = "/redeem"; }} style={{
                background:"#E8F5E9", border:`1px dashed #66BB6A`, borderRadius:12,
                padding:"10px 14px", marginBottom:14, cursor:"pointer",
                display:"flex", alignItems:"center", gap:10,
              }}>
                <div style={{ fontSize:18 }}>🎁</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#2E7D32" }}>
                    クラファン参加で 事業が存続する限り 3% 手数料に
                  </div>
                  <div style={{ fontSize:10, color:"#388E3C" }}>
                    創業クリエイター枠 (¥8,000) → 引換コードを入力
                  </div>
                </div>
                <div style={{ fontSize:14, color:"#2E7D32" }}>→</div>
              </div>
            )}
          </>
        )}
        <div style={{ display:"flex", gap:6, marginBottom:6 }}>
          {[1,2,3].map(s=>(<div key={s} style={{ flex:1, height:4, borderRadius:2, background:step>=s?C.orange:C.border }}/>))}
        </div>
        <div style={{ fontSize:12, color:C.warmGray, marginBottom:20 }}>STEP {step} / 3</div>
        {error && <div style={{ background:C.redPale, color:C.red, padding:"10px 14px", borderRadius:10, fontSize:13, marginBottom:16, fontWeight:700 }}>{error}</div>}
        <div style={{ background:C.white, borderRadius:20, padding:"24px 16px", border:`1px solid ${C.border}` }}>
          {step===1&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>カテゴリを選ぶ</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {CATS.filter(c=>c.id!=="all").map(c=>(
                <button key={c.id} onClick={()=>up("cat",c.id)} style={{
                  padding:"14px 10px", border:`2px solid ${form.cat===c.id?C.orange:C.border}`,
                  borderRadius:12, background:form.cat===c.id?C.orangePale:C.white,
                  cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontFamily:"inherit"
                }}>
                  <span style={{ fontSize:24 }}>{c.icon}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:form.cat===c.id?C.orange:C.dark }}>{c.label}</span>
                </button>
              ))}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:10 }}>対象ペット</div>
              {/* 依頼書 #19 (5/27): 動物カテゴリ 17種 (16 動物 + 両方) - グリッド表示 */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(86px, 1fr))", gap:6 }}>
                {/* 両方を先頭に (汎用商品用) */}
                {[{id:"both", icon:"🐾", label:"両方"}, ...PET_CATEGORIES].map(c=>(
                  <button key={c.id} onClick={()=>up("pet",c.id)} style={{
                    padding:"10px 4px", border:`2px solid ${form.pet===c.id?C.orange:C.border}`,
                    borderRadius:10, background:form.pet===c.id?C.orangePale:C.white,
                    cursor:"pointer", fontSize:11, fontWeight:700, color:form.pet===c.id?C.orange:C.warmGray, fontFamily:"inherit",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:2, minHeight:54
                  }}>
                    <span style={{ fontSize:18 }}>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize:10, color:C.warmGray, marginTop:6, lineHeight:1.5 }}>
                💡 「両方」は犬猫どちらにも使える汎用商品 / 該当する種類が見当たらない場合は「その他」を選択してや
              </div>
            </div>
          </>}
          {step===2&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>サービス内容</h2>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>タイトル</label>
              <input value={form.title} onChange={e=>up("title",e.target.value)} placeholder="例：愛犬の水彩似顔絵を描きます"
                style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>詳細説明</label>
              <textarea value={form.desc} onChange={e=>up("desc",e.target.value)} rows={4} placeholder="サービスの内容、こだわり、注意事項など..."
                style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
            </div>
            {/* 依頼書 #8 Phase E (5/25) 機能 #2: 💝 この作品が生まれたストーリー (任意) */}
            <div style={{ marginBottom:14, padding:"14px 14px 12px", background:"#FFF9F0", borderRadius:12, border:`1px dashed #E8C089` }}>
              <label style={{ fontSize:13, fontWeight:700, color:"#7A5A2E", display:"block", marginBottom:4 }}>
                💝 この作品が生まれたストーリー <span style={{ fontSize:11, color:C.warmGray, fontWeight:500 }}>(任意)</span>
              </label>
              <div style={{ fontSize:11, color:"#8B7355", lineHeight:1.6, marginBottom:8 }}>
                作品を生んだきっかけ・想い・温度感を、自由に書いてや🌸<br/>
                <span style={{ fontSize:10, opacity:0.8 }}>記入は任意。書かれた言葉はそのまま街に残り、購入者だけでなく未来の住民にも伝わります。</span>
              </div>
              <textarea
                value={form.creation_story || ""}
                onChange={e=>up("creation_story", e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="例: お散歩で見つけた風景がきっかけで描き始めた。うちの子の表情に近づけたくて..."
                style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:`1.5px solid #F0E0C0`, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", background:"#FFFDF8" }}
              />
              <div style={{ textAlign:"right", fontSize:10, color:C.warmGray, marginTop:4 }}>
                {(form.creation_story || "").length} / 500
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>料金（円）</label>
                <input type="number" value={form.price} onChange={e=>up("price",e.target.value)} placeholder="3000"
                  style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                {/* 依頼書 #9 (5/25) P2: カテゴリ別価格レンジ */}
                {form.cat && (() => {
                  const s = categoryPriceStats[form.cat];
                  if (!s || s.count < 3) {
                    return (
                      <div style={{ marginTop:6, padding:"6px 8px", background:C.cream, borderRadius:6, fontSize:10, color:C.warmGray, lineHeight:1.5 }}>
                        💭 このカテゴリはまだ出品が少ない。<strong style={{ color:C.dark }}>自由に価格を決めてや</strong>🌸
                      </div>
                    );
                  }
                  return (
                    <div style={{ marginTop:6, padding:"6px 8px", background:"#FFF8E1", borderRadius:6, fontSize:10, color:"#6D4C00", lineHeight:1.5 }}>
                      📊 このカテゴリの相場: 平均 <strong>¥{s.avg.toLocaleString()}</strong> ({s.min.toLocaleString()}〜{s.max.toLocaleString()}円 · {s.count}件)
                    </div>
                  );
                })()}
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>納期</label>
                <select value={form.delivery} onChange={e=>up("delivery",e.target.value)}
                  style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", background:C.white, boxSizing:"border-box" }}>
                  <option value="">選択</option>
                  {["即日","3日以内","1週間以内","2週間以内","要相談"].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            {/* 配送タイプ選択 */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>受け渡し方法</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:8 }}>サービスの提供方法を選択してください（プライバシー保護のため正確に選んでください）</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { v:"data_only", icon:"💻", label:"データのみ", desc:"似顔絵・写真データなど、メッセージで納品（住所不要・ペット情報も渡さず安心）", recommend:"🌸 初心者おすすめ", example:"例: ペット似顔絵 / 写真加工 / 動画編集" },
                  { v:"shipping", icon:"📦", label:"配送あり", desc:"洋服・グッズ・フードなど、購入者の住所へ郵送", safety:"🔒 住所は 30 日で自動削除・購入者と出品者のみ閲覧・Qoccaが守ります", example:"例: ハンドメイド服 / オーダー耳タグ / おやつ" },
                  { v:"visit", icon:"📍", label:"訪問あり", desc:"しつけ・撮影など、対面で提供", safety:"📍 場所は取引メッセージで個別調整・公開されません", example:"例: しつけ教室 / 出張撮影 / 訪問トリミング" },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={()=>up("delivery_type", opt.v)} style={{
                    padding:"12px 14px", border:`2px solid ${form.delivery_type===opt.v ? C.orange : C.border}`,
                    borderRadius:10, background:form.delivery_type===opt.v ? C.orangePale : C.white,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", gap:12, alignItems:"flex-start"
                  }}>
                    <span style={{ fontSize:24, flexShrink:0, marginTop:2 }}>{opt.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:2, display:"flex", alignItems:"center", gap:6 }}>
                        {opt.label}
                        {(opt as any).recommend && <span style={{ fontSize:10, fontWeight:700, color:"#2E7D32", background:"#E8F5E9", padding:"2px 6px", borderRadius:10 }}>{(opt as any).recommend}</span>}
                      </div>
                      <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.5, marginBottom:4 }}>{opt.desc}</div>
                      {(opt as any).safety && (
                        <div style={{ fontSize:10, color:"#1565C0", background:"#E3F2FD", padding:"4px 8px", borderRadius:6, marginBottom:3, lineHeight:1.5 }}>
                          {(opt as any).safety}
                        </div>
                      )}
                      {(opt as any).example && (
                        <div style={{ fontSize:10, color:C.warmGray, fontStyle:"italic", lineHeight:1.5 }}>
                          {(opt as any).example}
                        </div>
                      )}
                    </div>
                    {form.delivery_type===opt.v && <span style={{ color:C.orange, fontSize:18, marginTop:2 }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
            {/* 依頼書 #104 Phase B (2026/6/3): 送料設定 4タイプ (delivery_type=shipping 時のみ詳細表示) */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>送料設定</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:8 }}>配送方法を選択してください (海外展開・地域別対応)</p>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {[
                  { v:"included", icon:"✅", label:"送料込み (無料配送)", desc:"商品代金に送料を含めます" },
                  { v:"flat_rate", icon:"📮", label:"全国一律", desc:"日本全国どこでも同じ送料" },
                  { v:"regional", icon:"🗾", label:"地域別", desc:"地域ごとに送料を設定 (本州・北海道・沖縄等)" },
                  { v:"methods", icon:"📦", label:"配送方法から選ぶ (購入者が選択)", desc:"クリックポスト ¥185 / 宅急便 ¥750 等を登録 → 購入者が選びます" },
                  { v:"consultation", icon:"💬", label:"要相談 (個別連絡)", desc:"取引後にメッセージで送料を相談" },
                ].map(opt => (
                  <button key={opt.v} type="button" onClick={()=>up("shipping_type", opt.v)} style={{
                    padding:"10px 14px", border:`2px solid ${form.shipping_type===opt.v ? C.orange : C.border}`,
                    borderRadius:10, background:form.shipping_type===opt.v ? C.orangePale : C.white,
                    cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", gap:10, alignItems:"flex-start"
                  }}>
                    <span style={{ fontSize:20, flexShrink:0 }}>{opt.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:C.dark }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.5 }}>{opt.desc}</div>
                    </div>
                    {form.shipping_type===opt.v && <span style={{ color:C.orange, fontSize:16 }}>✓</span>}
                  </button>
                ))}
              </div>
              {/* flat_rate: 金額入力 */}
              {form.shipping_type === "flat_rate" && (
                <div style={{ marginTop:10, padding:12, background:C.cream, borderRadius:10 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>全国一律送料 (¥)</label>
                  <input type="number" min="0" value={form.shipping_fee} onChange={(e)=>up("shipping_fee", e.target.value)} placeholder="例: 800" style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} />
                </div>
              )}
              {/* regional: 地域別 動的リスト */}
              {form.shipping_type === "regional" && (
                <div style={{ marginTop:10, padding:12, background:C.cream, borderRadius:10 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:8 }}>地域別送料 (海外展開可)</label>
                  {(form.shipping_rates || []).map((rate: any, idx: number) => (
                    <div key={idx} style={{ display:"flex", gap:8, marginBottom:6, alignItems:"center" }}>
                      <input type="text" value={rate.region} onChange={(e) => {
                        const next = [...form.shipping_rates]; next[idx] = { ...next[idx], region: e.target.value }; up("shipping_rates", next);
                      }} placeholder="地域名" style={{ flex:1, padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }} />
                      <input type="number" min="0" value={rate.fee} onChange={(e) => {
                        const next = [...form.shipping_rates]; next[idx] = { ...next[idx], fee: parseInt(e.target.value) || 0 }; up("shipping_rates", next);
                      }} placeholder="送料 ¥" style={{ width:100, padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }} />
                      <button type="button" onClick={() => { const next = form.shipping_rates.filter((_:any, i:number) => i !== idx); up("shipping_rates", next); }} style={{ width:30, height:30, border:"none", background:"transparent", color:"#E57373", fontSize:18, cursor:"pointer" }}>×</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => { up("shipping_rates", [...(form.shipping_rates || []), { region: "", fee: 0 }]); }} style={{ padding:"6px 12px", background:"transparent", border:`1px dashed ${C.border}`, borderRadius:8, color:C.warmGray, fontSize:12, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>+ 地域を追加</button>
                </div>
              )}
              {/* consultation: 補足説明 */}
              {form.shipping_type === "consultation" && (
                <div style={{ marginTop:10, padding:12, background:C.cream, borderRadius:10, fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
                  💬 購入後、取引メッセージで配送先・送料を個別相談します。送料は購入者・出品者間で合意の上、別途お支払いください。
                </div>
              )}
              {/* 依頼書 #127 Phase B (2026/6/5): methods - 配送方法選択 (購入者がラジオで選ぶ / 最大 5件) */}
              {form.shipping_type === "methods" && (
                <div style={{ marginTop:10, padding:12, background:C.cream, borderRadius:10 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>配送方法 (最大 5件・購入者が選択)</label>
                  <p style={{ fontSize:11, color:C.warmGray, marginBottom:8, lineHeight:1.6 }}>例: クリックポスト ¥185 / 宅急便60サイズ ¥750 / レターパックライト ¥430</p>
                  {(form.shipping_methods || []).map((m: any, idx: number) => (
                    <div key={idx} style={{ display:"flex", gap:6, marginBottom:6, alignItems:"flex-start", flexWrap:"wrap" }}>
                      <input type="text" maxLength={40} value={m.name || ""} onChange={(e) => {
                        const next = [...(form.shipping_methods || [])]; next[idx] = { ...next[idx], name: e.target.value }; up("shipping_methods", next);
                      }} placeholder="配送方法名 (40字以内)" style={{ flex:"1 1 160px", minWidth:120, padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }} />
                      <input type="number" min="0" value={m.fee ?? 0} onChange={(e) => {
                        const next = [...(form.shipping_methods || [])]; next[idx] = { ...next[idx], fee: Math.max(0, parseInt(e.target.value) || 0) }; up("shipping_methods", next);
                      }} placeholder="送料 ¥" style={{ width:100, padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, fontFamily:"inherit", boxSizing:"border-box" }} />
                      <input type="text" maxLength={60} value={m.note || ""} onChange={(e) => {
                        const next = [...(form.shipping_methods || [])]; next[idx] = { ...next[idx], note: e.target.value }; up("shipping_methods", next);
                      }} placeholder="補足 (任意)" style={{ flex:"1 1 140px", minWidth:120, padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }} />
                      <button type="button" onClick={() => { const next = (form.shipping_methods || []).filter((_:any, i:number) => i !== idx); up("shipping_methods", next); }} style={{ width:30, height:30, border:"none", background:"transparent", color:"#E57373", fontSize:18, cursor:"pointer" }}>×</button>
                    </div>
                  ))}
                  {((form.shipping_methods || []).length < 5) && (
                    <button type="button" onClick={() => { up("shipping_methods", [ ...(form.shipping_methods || []), { id: `m${(form.shipping_methods?.length || 0) + 1}_${Date.now().toString(36)}`, name: "", fee: 0, note: "" } ]); }} style={{ padding:"6px 12px", background:"transparent", border:`1px dashed ${C.border}`, borderRadius:8, color:C.warmGray, fontSize:12, cursor:"pointer", fontFamily:"inherit", marginTop:4 }}>+ 配送方法を追加 ({(form.shipping_methods || []).length}/5)</button>
                  )}
                  {((form.shipping_methods || []).filter((m:any)=>m?.name?.trim()).length === 0) && (
                    <div style={{ marginTop:8, fontSize:11, color:"#E57373" }}>⚠️ 配送方法は最低 1件 必要です (名前を入力)</div>
                  )}
                </div>
              )}
              {/* shipping_note: 補足説明欄 (全タイプ共通) */}
              <div style={{ marginTop:10 }}>
                <label style={{ fontSize:11, fontWeight:700, color:C.warmGray, display:"block", marginBottom:4 }}>送料の補足説明 (任意)</label>
                <input type="text" value={form.shipping_note} onChange={(e)=>up("shipping_note", e.target.value)} placeholder="例: 同梱対応可 / 速達+500円 等" style={{ width:"100%", padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, fontFamily:"inherit", boxSizing:"border-box" }} />
              </div>
            </div>
            {/* 画像アップロード */}
            <div>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>画像（最大5枚）</label>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleImageSelect} style={{ display:"none" }}/>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {images.map((img, i) => (
                  <div key={i} style={{ width:72, height:72, borderRadius:10, overflow:"hidden", position:"relative", border:`1px solid ${C.border}` }}>
                    <img src={URL.createObjectURL(img)} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    <button onClick={()=>removeImage(i)} style={{ position:"absolute", top:2, right:2, width:20, height:20, borderRadius:"50%", background:"rgba(0,0,0,0.5)", border:"none", color:"#fff", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button onClick={()=>fileRef.current?.click()} style={{ width:72, height:72, borderRadius:10, border:`2px dashed ${C.border}`, background:C.lightGray, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color:C.warmGray }}>+</button>
                )}
              </div>
            </div>
            {/* 在庫数 */}
            <div style={{ marginTop:16 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>在庫数（任意）</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:8, lineHeight:1.6 }}>
                物販で在庫管理が必要な場合のみ入力してください。<br/>
                未入力（オーダーメイド・受注生産など）= 在庫管理しない<br/>
                数字を入力すると、売れるたびに自動で減算され、0になると「売り切れ」表示になります。
              </p>
              <div style={{ position:"relative", maxWidth:160 }}>
                <input type="number" value={form.stock} onChange={e=>up("stock", e.target.value)} placeholder="例: 10" min="0"
                  style={{ width:"100%", padding:"10px 32px 10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                <span style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:C.warmGray }}>個</span>
              </div>
            </div>
            {/* 有料オプション */}
            <div style={{ marginTop:16 }}>
              <label style={{ fontSize:13, fontWeight:700, color:C.dark, display:"block", marginBottom:6 }}>有料オプション（任意）</label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:10 }}>購入者が注文時に追加できるオプションを設定できます</p>
              {options.map((opt, i) => (
                <div key={i} style={{ display:"flex", gap:6, marginBottom:8, alignItems:"center" }}>
                  <input value={opt.name} onChange={e=>updateOption(i,"name",e.target.value)} placeholder="例：急ぎ対応（3日以内）"
                    style={{ flex:2, padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                  <div style={{ position:"relative", flex:1 }}>
                    <input type="number" value={opt.price} onChange={e=>updateOption(i,"price",e.target.value)} placeholder="500"
                      style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
                    <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:11, color:C.warmGray }}>円</span>
                  </div>
                  <button onClick={()=>removeOption(i)} style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.lightGray, cursor:"pointer", fontSize:14, color:C.warmGray, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>×</button>
                </div>
              ))}
              {/* 2026/6/29 案A: オプション上限 5→15 (Tails Up「選べる5個セット」要望対応・全出品者に開放)
                  DB変更/決済影響 0。create-checkout は配列長制限なし (Stripe line_items 上限 250)。
                  0円オプションの解禁は別案D で検証後 → 今回は有料オプションのまま上限のみ拡張。 */}
              {options.length < 15 && (
                <button onClick={addOption} style={{ padding:"8px 14px", background:C.orangePale, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit" }}>＋ オプションを追加</button>
              )}
            </div>

            {/* Phase B: 種類 (Variant) セクション
                ブランド v3「翻訳しすぎない」原則: 機能ラベルは普通の言葉でOK
                NG 語彙 (バリエーション/オプション/選択肢) を回避し「種類」で統一 */}
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px dashed ${C.border}` }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, fontWeight:700, color:C.dark, cursor:"pointer", marginBottom:6 }}>
                <input
                  type="checkbox"
                  checked={hasVariants}
                  onChange={e => {
                    setHasVariants(e.target.checked);
                    if (!e.target.checked) {
                      setVariantOptions([]);
                      setVariants([]);
                    } else if (variantOptions.length === 0) {
                      setVariantOptions([{ name: "", values: [""] }]);
                    }
                  }}
                  style={{ width:16, height:16, accentColor:C.orange }}
                />
                <span>種類を増やす（色違い・サイズ違いなど）</span>
              </label>
              <p style={{ fontSize:11, color:C.warmGray, marginBottom:10, paddingLeft:24, lineHeight:1.6 }}>
                1つの作品で、構図やサイズの種類を選んでもらえます。<br/>
                それぞれに価格と在庫を設定できます。
              </p>

              {hasVariants && (
                <div>
                  {/* 軸 (オプション項目) max 2 */}
                  {variantOptions.map((opt, optIdx) => (
                    <div key={optIdx} style={{ marginBottom:12, padding:12, background:C.lightGray, borderRadius:10 }}>
                      <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
                        <input
                          value={opt.name}
                          onChange={e => updateVariantOptionName(optIdx, e.target.value)}
                          placeholder={optIdx === 0 ? "例：構図" : "例：サイズ"}
                          style={{ flex:1, padding:"8px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                        />
                        <button
                          onClick={() => removeVariantOption(optIdx)}
                          style={{ width:28, height:28, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.white, cursor:"pointer", fontSize:14, color:C.warmGray }}
                        >×</button>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                        {opt.values.map((val, valIdx) => (
                          <div key={valIdx} style={{ display:"flex", alignItems:"center", gap:4, background:C.white, borderRadius:8, padding:"4px 4px 4px 8px", border:`1px solid ${C.border}` }}>
                            <input
                              value={val}
                              onChange={e => updateVariantOptionValue(optIdx, valIdx, e.target.value)}
                              placeholder={optIdx === 0 ? "マズルアップ" : "小"}
                              style={{ width:90, padding:"4px 6px", borderRadius:6, border:"none", fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                            />
                            {opt.values.length > 1 && (
                              <button
                                onClick={() => removeVariantOptionValue(optIdx, valIdx)}
                                style={{ width:18, height:18, borderRadius:"50%", border:"none", background:C.lightGray, cursor:"pointer", fontSize:10, color:C.warmGray }}
                              >×</button>
                            )}
                          </div>
                        ))}
                        {opt.values.length < 10 && (
                          <button
                            onClick={() => addVariantOptionValue(optIdx)}
                            style={{ padding:"4px 10px", background:C.orangePale, border:`1px dashed ${C.orange}`, borderRadius:6, fontSize:11, color:C.orange, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}
                          >＋ 追加</button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 軸追加ボタン (max 2) */}
                  {variantOptions.length < 2 && (
                    <button
                      onClick={addVariantOption}
                      style={{ padding:"8px 14px", background:C.white, border:`1.5px dashed ${C.orange}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.orange, cursor:"pointer", fontFamily:"inherit", marginBottom:12 }}
                    >＋ {variantOptions.length === 0 ? "種類の項目を追加" : "もう1項目（サイズなど）"}</button>
                  )}

                  {/* 自動生成された variants の価格・在庫入力 */}
                  {variants.length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.dark, marginBottom:8 }}>
                        それぞれの種類（{variants.length}通り）
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {variants.map((v, idx) => (
                          <div key={idx} style={{ padding:10, background:C.white, border:`1px solid ${C.border}`, borderRadius:10 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.dark, marginBottom:6 }}>
                              {v.variant_name}
                            </div>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                              <div style={{ position:"relative" }}>
                                <input
                                  type="number"
                                  value={v.price}
                                  onChange={e => updateVariant(idx, "price", e.target.value)}
                                  placeholder="3000"
                                  style={{ width:"100%", padding:"7px 26px 7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                                />
                                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>円</span>
                              </div>
                              <div style={{ position:"relative" }}>
                                <input
                                  type="number"
                                  value={v.stock}
                                  onChange={e => updateVariant(idx, "stock", e.target.value)}
                                  placeholder="1"
                                  min="0"
                                  style={{ width:"100%", padding:"7px 26px 7px 10px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:12, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                                />
                                <span style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", fontSize:10, color:C.warmGray }}>個</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>}
          {step===3&&<>
            <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, marginBottom:20 }}>確認して出品</h2>
            <div style={{ background:C.lightGray, borderRadius:14, padding:"16px", marginBottom:20 }}>
              {[
                ["カテゴリ", CATS.find(c=>c.id===form.cat)?.label||"未設定"],
                ["タイトル", form.title||"未入力"],
                ["料金", form.price?`¥${Number(form.price).toLocaleString()}`:"未設定"],
                ["納期", form.delivery||"未設定"],
                ["受け渡し方法", form.delivery_type==="shipping"?"📦 配送あり":form.delivery_type==="visit"?"📍 訪問あり":"💻 データのみ"],
                ["在庫数", form.stock!==""&&form.stock!==null?`${form.stock}個`:"管理しない"],
                ["画像", `${images.length}枚`],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:13, color:C.warmGray }}>{k}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.dark }}>{v}</span>
                </div>
              ))}
              {options.filter(o=>o.name&&o.price).length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.warmGray, marginBottom:6 }}>有料オプション</div>
                  {options.filter(o=>o.name&&o.price).map((o,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontSize:12, color:C.dark }}>🔧 {o.name}</span>
                      <span style={{ fontSize:12, fontWeight:700, color:C.orange }}>+¥{Number(o.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* 依頼書 #9 (5/25) P4: 公開までの流れ・審査基準明示 */}
            <div style={{ background:"#FFF8E1", border:`1px solid #FFC107`, borderRadius:14, padding:"14px 16px", marginBottom:16, lineHeight:1.7 }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#7B5E00", marginBottom:6 }}>
                ⏱ 公開までの流れ
              </div>
              <div style={{ fontSize:11, color:"#6D4C00", marginBottom:8 }}>
                {testmakeActive
                  ? "テスマケ期間中は通常 数時間以内 に公開されます (最大24時間)。"
                  : "投稿後、最大24時間以内に運営事務局が確認して公開します。"}
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:"#7B5E00", marginBottom:4 }}>
                審査では以下の3点だけ見ています:
              </div>
              <div style={{ fontSize:11, color:"#6D4C00", lineHeight:1.8 }}>
                ① <strong>ペットの安全</strong> (健康・年齢に無理がない内容か)<br />
                ② <strong>著作権</strong> (オリジナル作品か / 引用が適切か)<br />
                ③ <strong>価格妥当性</strong> (相場と極端に離れていないか)
              </div>
              <div style={{ fontSize:10, color:C.warmGray, marginTop:8, lineHeight:1.6 }}>
                🚫 NG 例: 不安を煽る表現 / 医療診断を断定する内容 / 第三者作品の無断使用<br />
                ➡️ 詳しい審査基準は <a href="/help/fees" style={{ color:"#7B5E00", textDecoration:"underline" }}>/help/fees</a> に書いてあるで
              </div>
            </div>
            {form.price && Number(form.price) > 0 && (
              <div style={{ background:C.orangePale, borderRadius:14, padding:"14px", marginBottom:16, border:`1px solid ${C.orange}` }}>
                <div style={{ fontSize:13, fontWeight:800, color:C.orange, marginBottom:8 }}>💰 あなたの手取り目安</div>
                {(() => {
                  const basePrice = Number(form.price) + options.filter(o=>o.name&&o.price).reduce((sum, o) => sum + Number(o.price||0), 0);
                  const firstNet = basePrice;
                  const within3M = basePrice - Math.floor(basePrice * 0.05);
                  const stdNet = basePrice - Math.floor(basePrice * 0.10);
                  return (
                    <>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:C.dark }}>初回取引(0%)</span>
                        <span style={{ fontWeight:700, color:C.green }}>¥{firstNet.toLocaleString()}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:C.dark }}>3ヶ月以内(5%)</span>
                        <span style={{ fontWeight:700, color:C.dark }}>¥{within3M.toLocaleString()}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:12 }}>
                        <span style={{ color:C.dark }}>通常期(10%)</span>
                        <span style={{ fontWeight:700, color:C.dark }}>¥{stdNet.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize:10, color:C.warmGray, marginTop:6, lineHeight:1.5 }}>
                        ※出品価格がそのまま手取りとして反映されます
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            {images.length > 0 && (
              <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
                {images.map((img, i) => (
                  <img key={i} src={URL.createObjectURL(img)} alt="" style={{ width:60, height:60, borderRadius:8, objectFit:"cover" }}/>
                ))}
              </div>
            )}
            <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 14px", fontSize:12, color:C.orange, lineHeight:1.6, fontWeight:600 }}>
              🐾 出品後、審査（最大24時間）を経て公開されます。
            </div>
          </>}
          <div style={{ display:"flex", gap:10, marginTop:24 }}>
            {step>1&&<button onClick={()=>setStep(s=>s-1)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, fontWeight:800, fontSize:14, cursor:"pointer", color:C.warmGray, fontFamily:"inherit" }}>← 戻る</button>}
            <button disabled={submitting} onClick={()=>step<3?setStep(s=>s+1):handleSubmit(false)} style={{ flex:2, padding:"13px", background:submitting?C.warmGray:C.orange, border:"none", borderRadius:12, fontWeight:800, fontSize:14, cursor:submitting?"not-allowed":"pointer", color:"#fff", fontFamily:"inherit" }}>
              {submitting ? "送信中..." : step<3 ? "次へ →" : "🐾 出品する！"}
            </button>
          </div>
          {step===3 && (
            <button disabled={submitting} onClick={()=>handleSubmit(true)} style={{
              width:"100%", marginTop:10, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`,
              borderRadius:12, fontWeight:700, fontSize:13, cursor:submitting?"not-allowed":"pointer",
              color:C.warmGray, fontFamily:"inherit"
            }}>💾 下書き保存（後で編集して投稿できます）</button>
          )}
        </div>
      </div>
    </div>
  );
};

export const DetailPageWrapper = ({ listings, liked, onLike }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setPage } = useNav();
  const [item, setItem] = useState(location.state?.item || null);

  // 🔴 緊急修正 (依頼書 #127 後追い / 2026/6/5):
  //   listings.find で見つからない場合に DB 直 fetch する fallback を追加
  //   - 新規 approved 出品が useListings refetch 前 → 「読み込み中...」のまま固まる問題を解消
  //   - InPrivate / 別タブで直接 URL 叩き でも詳細が見られる
  const [fetchTried, setFetchTried] = useState(false);
  useEffect(() => {
    if (!item && id) {
      const found = listings.find(l => l.id === id);
      if (found) { setItem(found); return; }
      // listings 取得直後 (空) の瞬間にも空 fetch しないよう、listings が "戻ってきている" 状態でのみ DB fallback 試行
      if (!fetchTried && listings.length >= 0) {
        setFetchTried(true);
        (async () => {
          const { data } = await supabase
            .from("listings")
            .select("*, listing_variants(*)")
            .eq("id", id)
            .in("status", ["approved", "sold_out"])
            .maybeSingle();
          if (data) {
            setItem({
              ...data,
              imageUrl: data.image_urls?.[0] || "",
              imageUrls: data.image_urls || [],
              listing_variants: Array.isArray(data.listing_variants) ? data.listing_variants : [],
              shipping_type: data.shipping_type || "included",
              shipping_fee: data.shipping_fee || 0,
              shipping_rates: Array.isArray(data.shipping_rates) ? data.shipping_rates : [],
              shipping_methods: Array.isArray(data.shipping_methods) ? data.shipping_methods : [],
              shipping_note: data.shipping_note || "",
              options: data.options || [],
              has_variants: data.has_variants === true,
              pet: data.pet_type,
              delivery: data.delivery_days || "要相談",
              delivery_type: data.delivery_type || "data_only",
              emoji: "🐾",
              bg: "#FFF3E0",
            });
          }
        })();
      }
    }
  }, [id, listings, item, fetchTried]);

  if (!item) return (
    <div style={{ paddingTop:80, textAlign:"center", color:C.warmGray }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🔍</div>
      <div>{fetchTried ? "出品が見つかりません" : "読み込み中..."}</div>
    </div>
  );

  return <DetailPage item={item} onBack={() => navigate(-1)} liked={liked[item?.id]} onLike={onLike} setPage={setPage}/>;
};

// Phase8 8b: LikedPage を App.tsx から移動 (元 App.tsx 2343-2361 / C・Card は既import)
// 2026/7/13 お気に入り Phase3: 横断お気に入り一覧をタブ化 (作品 / おでかけ)。イベントは将来枠。
//   スポットは自前で favorites(item_type='spot') → pet_walker_spots を引く (App.tsx を肥大させない)。
export const LikedPage = ({ listings, liked, onLike, onDetail, isPC }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"listing" | "spot">("listing");
  const [spots, setSpots] = useState<any[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);

  const items = listings.filter(l => liked[l.id]);

  useEffect(() => {
    if (!user?.id) { setSpots([]); return; }
    let alive = true;
    (async () => {
      setSpotsLoading(true);
      const { data: favs } = await supabase.from("favorites")
        .select("item_id").eq("user_id", user.id).eq("item_type", "spot");
      const ids = (favs || []).map((f: any) => f.item_id);
      if (ids.length === 0) { if (alive) { setSpots([]); setSpotsLoading(false); } return; }
      const { data } = await supabase.from("pet_walker_spots")
        .select("id,name,pref,city,area_tag,image_urls").in("id", ids);
      if (alive) { setSpots(data || []); setSpotsLoading(false); }
    })();
    return () => { alive = false; };
  }, [user?.id]);

  const tabs: { key: "listing" | "spot"; label: string; count: number }[] = [
    { key: "listing", label: "作品", count: items.length },
    { key: "spot", label: "おでかけ", count: spots.length },
  ];

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream, padding: isPC ? "0 0 40px" : "80px 16px 40px" }}>
      <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:14 }}>❤️ お気に入り</h1>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"8px 18px", borderRadius:999, cursor:"pointer", fontFamily:"inherit",
            fontSize:13, fontWeight:800,
            border:`1.5px solid ${tab===t.key ? C.orange : C.border}`,
            background: tab===t.key ? C.orange : C.white,
            color: tab===t.key ? C.white : C.warmGray,
          }}>
            {t.label} <span style={{ fontSize:11, opacity:0.8 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "listing" && (
        items.length===0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.dark }}>まだお気に入りがありません</div>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(3,1fr)" : "1fr 1fr", gap: isPC ? 16 : 12 }}>
            {items.map(item=><Card key={item.id} item={item} onClick={onDetail} liked={liked[item.id]} onLike={onLike}/>)}
          </div>
        )
      )}

      {tab === "spot" && (
        spotsLoading ? (
          <p style={{ color:C.warmGray, fontSize:14, padding:"40px 0", textAlign:"center" }}>読み込んでいます。</p>
        ) : spots.length===0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🤍</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.dark, marginBottom:8 }}>まだ保存した場所がありません</div>
            <button onClick={()=>navigate("/petwalker")} style={{ marginTop:10, padding:"10px 24px", borderRadius:999, border:`1.5px solid ${C.orange}`, background:C.white, color:C.orange, fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              おでかけ先をさがす →
            </button>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(3,1fr)" : "1fr", gap: isPC ? 16 : 12 }}>
            {spots.map((s:any)=>(
              <button key={s.id} onClick={()=>navigate("/petwalker")} style={{ textAlign:"left", background:C.white, border:`1px solid ${C.border}`, borderRadius:14, padding:0, overflow:"hidden", cursor:"pointer", fontFamily:"inherit", width:"100%", display:"block" }}>
                {Array.isArray(s.image_urls) && s.image_urls[0] && (
                  <div style={{ width:"100%", aspectRatio:"16 / 9", overflow:"hidden", background:C.lightGray }}>
                    <img src={s.image_urls[0]} alt="" loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                  </div>
                )}
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:15, fontWeight:800, color:C.dark, marginBottom:6, lineHeight:1.5 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:C.warmGray }}>{[s.pref, s.city].filter(Boolean).join(" ")}</div>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
};
