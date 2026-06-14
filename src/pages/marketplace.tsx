// マーケットプレイス ページ群 (App.tsx 分割 Phase6 6a・低リスク先行)
// SearchPage / UserProfilePage
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ 決済本丸 (DetailPage/SellPage/submitListing/DetailPageWrapper) は 6b で別途移動。

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { CATS } from "../constants/data";
import { sortByPopularity } from "../utils/format";
import { Card } from "../components/ui";
import { resolveFontFamily } from "../constants/fonts";
import { petIcon, petLabelShort } from "../constants/pets";
import { supabase } from "../supabaseClient";

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
// Phase D: 認証ガード + うちの子 state
const [authChecked, setAuthChecked] = useState(false);
const [pets, setPets] = useState<Array<{ id: string; name: string; species: string; breed?: string | null; birthday?: string | null; bio?: string | null; avatar_url?: string | null; gender?: string | null; status: string; display_order: number }>>([]);
const [petPhotos, setPetPhotos] = useState<Record<string, Array<{ id: string; photo_url: string; caption?: string | null }>>>({});
// Phase D Phase 2 (5/22 夜): 公開プロフィールにギャラリー + ブログ表示
const [userGallery, setUserGallery] = useState<Array<{ id: string; image_url: string; caption?: string | null }>>([]);
const [userBlogPosts, setUserBlogPosts] = useState<Array<{ id: string; title: string; cover_image_url?: string | null; category?: string | null; created_at: string }>>([]);

  // Phase D: 認証ガード (King 判断: ログイン必要)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/login?returnTo=${returnTo}`, { replace: true });
        return;
      }
      setAuthChecked(true);
    })();
  }, [navigate]);

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

  if (!authChecked || loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>読み込み中...</div>;
  if (!profile) return <div style={{ padding:40, textAlign:"center", color:C.warmGray }}>ユーザーが見つかりません</div>;

  const displayName = profile.display_name || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth:600, margin:"0 auto" }}>
      <div style={{ background:C.white, borderRadius:20, padding:"28px 20px", border:`1px solid ${C.border}`, textAlign:"center", marginBottom:16 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background: profile.avatar_url ? `url(${profile.avatar_url}) center/cover` : C.orange, margin:"0 auto 16px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:800, color:"#fff" }}>{!profile.avatar_url && initial}</div>
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
          {isFollowing && (
            <button onClick={()=>{ navigate("/mypage"); setTimeout(()=>{ const evt = new CustomEvent("openDM", { detail: { partnerId: userId } }); window.dispatchEvent(evt); }, 100); }} style={{ padding:"8px 20px", background:C.white, border:`1.5px solid ${C.orange}`, borderRadius:20, color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
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

