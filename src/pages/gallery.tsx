// ギャラリー/ブログ ページ群 (App.tsx 分割 Phase5 ②gallery)
// BlogPage / GalleryPage
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ CommentModal(SNS防御) は外部モジュールを相対パスで import。CrowdfundingBanner は Step A で components/ へ抽出済。

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { BLOG_CATS } from "../constants/data";
import CommentModal from "../components/CommentModal";
import { CrowdfundingBanner } from "../components/CrowdfundingBanner";
import type { CommentTargetType } from "../types";

export const BlogPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const { postId } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [showWrite, setShowWrite] = useState(false);
  const [viewPost, setViewPost] = useState(null);
  const [likedPosts, setLikedPosts] = useState({});
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ type: CommentTargetType; id: string; ownerId: string } | null>(null);
  const [form, setForm] = useState({ title:"", content:"", category:"general", tags:"" });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const coverRef = useRef(null);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (!error && data) {
      const authorIds = [...new Set(data.map(p => p.author_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", authorIds);
      const profMap = {};
      (profiles || []).forEach(p => { profMap[p.id] = p; });
      setPosts(data.map(p => ({
        ...p,
        authorName: profMap[p.author_id]?.display_name || "ユーザー",
        authorAvatar: profMap[p.author_id]?.avatar_url || "",
      })));
    }
    if (user) {
      const { data: likes } = await supabase.from("blog_likes").select("post_id").eq("user_id", user.id);
      const likeMap = {};
      (likes || []).forEach(l => { likeMap[l.post_id] = true; });
      setLikedPosts(likeMap);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  // URL から postId を取得して、該当記事を自動的に詳細表示
  useEffect(() => {
    if (!postId) {
      setViewPost(null);
      return;
    }
    if (posts.length === 0) return;
    const target = posts.find(p => p.id === postId);
    if (target) {
      setViewPost(target);
      // 閲覧数 +1
      supabase.from("blog_posts").update({ views_count: (target.views_count || 0) + 1 }).eq("id", target.id).then(()=>{});
    } else {
      // 一覧に無い記事 → 単独取得
      supabase.from("blog_posts").select("*").eq("id", postId).eq("published", true).single().then(async ({ data }) => {
        if (data) {
          const { data: prof } = await supabase.from("profiles").select("id, display_name, avatar_url").eq("id", data.author_id).single();
          setViewPost({
            ...data,
            authorName: prof?.display_name || "ユーザー",
            authorAvatar: prof?.avatar_url || "",
          });
          await supabase.from("blog_posts").update({ views_count: (data.views_count || 0) + 1 }).eq("id", data.id);
        }
      });
    }
  }, [postId, posts]);

  // 詳細表示を閉じた時に URL を /blog に戻す
  const closeViewPost = () => {
    setViewPost(null);
    if (postId) navigate("/blog");
  };

  // 一覧記事クリック時に URL を /blog/:id にする
  const openViewPost = (post) => {
    setViewPost(post);
    navigate(`/blog/${post.id}`);
    // 閲覧数 +1
    supabase.from("blog_posts").update({ views_count: (post.views_count || 0) + 1 }).eq("id", post.id).then(()=>{});
  };

  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) { setCoverFile(file); setCoverPreview(URL.createObjectURL(file)); }
  };

  const handlePublish = async () => {
    if (!user || !form.title || !form.content) return;
    setSubmitting(true);
    let coverUrl = "";
    if (coverFile) {
      const ext = coverFile.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("blog-images").upload(path, coverFile);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("blog-images").getPublicUrl(path);
        coverUrl = urlData.publicUrl;
      }
    }
    await supabase.from("blog_posts").insert({
      author_id: user.id,
      title: form.title,
      content: form.content,
      category: form.category,
      cover_image_url: coverUrl,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      published: true,
    });
    setShowWrite(false);
    setForm({ title:"", content:"", category:"general", tags:"" });
    setCoverFile(null);
    setCoverPreview("");
    setSubmitting(false);
    fetchPosts();
  };

  const toggleLike = async (postId) => {
    if (!user) { setPage("signup"); return; }
    if (likedPosts[postId]) {
      await supabase.from("blog_likes").delete().eq("user_id", user.id).eq("post_id", postId);
      setLikedPosts(prev => { const n = {...prev}; delete n[postId]; return n; });
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: Math.max(0,(p.likes_count||0)-1)} : p));
    } else {
      await supabase.from("blog_likes").insert({ user_id: user.id, post_id: postId });
      setLikedPosts(prev => ({...prev, [postId]: true}));
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: (p.likes_count||0)+1} : p));
    }
  };

  const openPost = openViewPost;

  const filtered = posts.filter(p => cat === "all" || p.category === cat);
  const blogCatLabel = (c) => BLOG_CATS.find(bc => bc.id === c)?.label || c;
  const blogCatIcon = (c) => BLOG_CATS.find(bc => bc.id === c)?.icon || "📝";

  // 記事詳細ビュー
  if (viewPost) return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      <div style={{ padding:"12px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={closeViewPost} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20, color:C.orange, fontWeight:700 }}>←</button>
        <span style={{ fontSize:14, fontWeight:700, color:C.dark }}>ブログ</span>
      </div>
      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 16px 80px" }}>
        {viewPost.cover_image_url && (
          <div style={{ borderRadius:16, overflow:"hidden", marginBottom:20, maxHeight:300 }}>
            <img src={viewPost.cover_image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
          </div>
        )}
        <div style={{ display:"flex", gap:6, marginBottom:12 }}>
          <span style={{ fontSize:11, padding:"3px 10px", borderRadius:8, background:C.orangePale, color:C.orange, fontWeight:700 }}>{blogCatIcon(viewPost.category)} {blogCatLabel(viewPost.category)}</span>
        </div>
        <h1 style={{ fontSize:24, fontWeight:900, color:C.dark, lineHeight:1.4, marginBottom:12 }}>{viewPost.title}</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", fontSize:14 }}>
            {viewPost.authorAvatar ? <img src={viewPost.authorAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{viewPost.authorName}</div>
            <div style={{ fontSize:11, color:C.warmGray }}>{new Date(viewPost.created_at).toLocaleDateString("ja-JP")} · 👁 {viewPost.views_count||0}</div>
          </div>
        </div>
        <div style={{ fontSize:15, color:"#333", lineHeight:2, whiteSpace:"pre-wrap" }}>{viewPost.content}</div>
        {viewPost.tags?.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:20 }}>
            {viewPost.tags.map(t => <span key={t} style={{ fontSize:11, padding:"3px 10px", borderRadius:8, background:C.lightGray, color:C.warmGray }}>#{t}</span>)}
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
          <button onClick={()=>toggleLike(viewPost.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:20 }}>{likedPosts[viewPost.id]?"❤️":"🤍"}</button>
          <span style={{ fontSize:13, color:C.warmGray }}>{viewPost.likes_count||0} いいね</span>
          <button onClick={()=>{ setCommentTarget({ type:"blog", id: viewPost.id, ownerId: viewPost.author_id }); setCommentOpen(true); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.warmGray, marginLeft:8, fontFamily:"inherit" }}>💬 コメント</button>
        </div>
      </div>
    {commentTarget && (
        <CommentModal
          open={commentOpen}
          onClose={()=>setCommentOpen(false)}
          targetType={commentTarget.type}
          targetId={commentTarget.id}
          postOwnerId={commentTarget.ownerId}
          currentUserId={user?.id}
          onRequireLogin={()=>{ setCommentOpen(false); setPage("login"); }}
          title="コメント"
        />
      )}
          </div>
  );

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {/* ヘッダー */}
      <div style={{ padding:"20px 16px 12px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>📝 ペットブログ</h1>
            <p style={{ fontSize:12, color:C.warmGray }}>ペットの豆知識やクリエイターの裏側をチェック</p>
          </div>
          {user && (
            <button onClick={()=>setShowWrite(true)} style={{
              padding:"10px 14px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:12, cursor:"pointer"
            }}>✍️ 書く</button>
          )}
        </div>
      </div>

      {/* カテゴリフィルター */}
      <div style={{ padding:"10px 16px", background:C.white, borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, overflowX:"auto" }}>
        {BLOG_CATS.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)} style={{
            flexShrink:0, padding:"6px 12px", display:"flex", alignItems:"center", gap:4,
            background:cat===c.id?C.orange:C.white, color:cat===c.id?"#fff":C.warmGray,
            border:`1.5px solid ${cat===c.id?C.orange:C.border}`, borderRadius:20,
            fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}><span>{c.icon}</span><span style={{ whiteSpace:"nowrap" }}>{c.label}</span></button>
        ))}
      </div>

      {/* 執筆モーダル */}
      {showWrite && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:520, width:"100%", maxHeight:"88vh", overflow:"auto", WebkitOverflowScrolling:"touch" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>✍️ ブログを書く</h2>
              <button onClick={()=>setShowWrite(false)} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverSelect} style={{ display:"none" }}/>
            {coverPreview ? (
              <div style={{ marginBottom:14 }}>
                <img src={coverPreview} alt="" style={{ width:"100%", borderRadius:12, maxHeight:200, objectFit:"cover" }}/>
                <button onClick={()=>{setCoverFile(null);setCoverPreview("");}} style={{ marginTop:6, fontSize:11, color:C.red, background:"none", border:"none", cursor:"pointer" }}>画像を変更</button>
              </div>
            ) : (
              <button onClick={()=>coverRef.current?.click()} style={{
                width:"100%", padding:"24px", border:`2px dashed ${C.border}`, borderRadius:12,
                background:C.lightGray, cursor:"pointer", marginBottom:14, textAlign:"center"
              }}>
                <div style={{ fontSize:28, marginBottom:4 }}>🖼</div>
                <div style={{ fontSize:12, color:C.warmGray }}>カバー画像を追加（任意）</div>
              </button>
            )}
            <div style={{ marginBottom:12 }}>
              <input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} placeholder="タイトル"
                style={{ width:"100%", padding:"12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:16, fontWeight:700, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", background:C.white }}>
                {BLOG_CATS.filter(c=>c.id!=="all").map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              <input value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))} placeholder="タグ（カンマ区切り）"
                style={{ padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            </div>
            <div style={{ marginBottom:16 }}>
              <textarea value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} rows={10} placeholder="記事の内容を書いてください..."
                style={{ width:"100%", padding:"12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.8 }}/>
            </div>
            <button disabled={!form.title||!form.content||submitting} onClick={handlePublish} style={{
              width:"100%", padding:"14px", background:(!form.title||!form.content||submitting)?C.warmGray:C.orange,
              border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:(!form.title||!form.content||submitting)?"not-allowed":"pointer"
            }}>{submitting ? "投稿中..." : "📝 公開する"}</button>
          </div>
        </div>
      )}

      {/* 記事リスト */}
      <div style={{ padding:"16px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontSize:64, marginBottom:12 }}>📝</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>まだ記事がありません</div>
            <p style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>最初のブロガーになりませんか？</p>
            {user && <button onClick={()=>setShowWrite(true)} style={{ padding:"12px 24px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer" }}>✍️ 記事を書く</button>}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(2, 1fr)" : "1fr", gap:16 }}>
            {filtered.map(post => (
              <div key={post.id} onClick={()=>openPost(post)} style={{
                background:C.white, borderRadius:16, overflow:"hidden", border:`1px solid ${C.border}`,
                cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,0.04)"
              }}>
                {post.cover_image_url && (
                  <div style={{ width:"100%", height:160, overflow:"hidden" }}>
                    <img src={post.cover_image_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                  </div>
                )}
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex", gap:6, marginBottom:8 }}>
                    <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.orangePale, color:C.orange, fontWeight:700 }}>{blogCatIcon(post.category)} {blogCatLabel(post.category)}</span>
                  </div>
                  <h3 style={{ fontSize:16, fontWeight:800, color:C.dark, lineHeight:1.4, marginBottom:8, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{post.title}</h3>
                  <div style={{ fontSize:12, color:"#666", lineHeight:1.6, marginBottom:10, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{post.content}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", fontSize:10 }}>
                        {post.authorAvatar ? <img src={post.authorAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : "🐾"}
                      </div>
                      <span style={{ fontSize:11, fontWeight:600, color:C.dark }}>{post.authorName}</span>
                      <span style={{ fontSize:10, color:C.warmGray }}>{new Date(post.created_at).toLocaleDateString("ja-JP")}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, color:C.warmGray }}>
                      <span>❤️ {post.likes_count||0}</span>
                      <span>👁 {post.views_count||0}</span>
                      <button onClick={(e)=>{ e.stopPropagation(); setCommentTarget({ type:"blog", id: post.id, ownerId: post.author_id }); setCommentOpen(true); }} style={{ background:"none", border:"none", cursor:"pointer", fontSize:11, padding:0, color:C.warmGray }}>💬 コメント</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    {commentTarget && (
        <CommentModal
          open={commentOpen}
          onClose={()=>setCommentOpen(false)}
          targetType={commentTarget.type}
          targetId={commentTarget.id}
          postOwnerId={commentTarget.ownerId}
          currentUserId={user?.id}
          onRequireLogin={()=>{ setCommentOpen(false); setPage("login"); }}
          title="コメント"
        />
      )}
      </div>
  );
};

export const GalleryPage = ({ setPage, isPC }) => {
  const { user } = useAuth();
  const { itemId: galleryItemId } = useParams();
  const galleryNavigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [likedPosts, setLikedPosts] = useState({});
  const fileRef = useRef(null);
  const [commentOpen, setCommentOpen] = useState(false);
const [commentTarget, setCommentTarget] = useState<{ type: CommentTargetType; id: string; ownerId: string } | null>(null);

  // 依頼書 #30: Instagram ライクグリッド + 検索バー
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [petTypeFilter, setPetTypeFilter] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  // 依頼書 #34 緊急修正: viewportWidth JS 計算を撤去し CSS @media に切替
  // 理由: PWA / CSR 初期 render / iOS Safari standalone 等で window.innerWidth
  //      ベース判定が反映されないケースを完全回避するため、ブラウザネイティブ
  //      の @media query で直接判定する (CSS は SSR/CSR/PWA 全環境で確実動作)
  // 大判タイル判定は index のみに依存 (display_priority + 7投稿に1回)

  // localStorage から検索履歴ロード
  useEffect(() => {
    try {
      const raw = localStorage.getItem("qocca_gallery_search_history");
      if (raw) setSearchHistory(JSON.parse(raw).slice(0, 8));
    } catch (_) {}
  }, []);

  // デバウンス 300ms
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const pushHistory = (q: string) => {
    if (!q) return;
    setSearchHistory(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 8);
      try { localStorage.setItem("qocca_gallery_search_history", JSON.stringify(next)); } catch (_) {}
      return next;
    });
  };

  // 依頼書 #30: search_gallery RPC を活用 (検索クエリ or pet_type フィルタある時)
  const runRpcSearch = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("search_gallery", {
      query_text: searchQuery || null,
      filter_pet_type: petTypeFilter.length > 0 ? petTypeFilter : null,
      sort_mode: "newest",
      result_limit: 200,
    });
    if (!error && data) {
      const userIds = [...new Set(data.map((p: any) => p.user_id).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds)
        : { data: [] };
      const profMap: any = {};
      (profiles || []).forEach((p: any) => { profMap[p.id] = p; });

      const petIds = [...new Set(data.filter((p: any) => p.pet_id).map((p: any) => p.pet_id))];
      let petMap: any = {};
      if (petIds.length > 0) {
        const { data: pets } = await supabase.from("pets").select("id, name, species").in("id", petIds);
        (pets || []).forEach((p: any) => { petMap[p.id] = p; });
      }

      setPosts(data.map((p: any) => ({
        ...p,
        userName: profMap[p.user_id]?.display_name || "ユーザー",
        userAvatar: profMap[p.user_id]?.avatar_url || "",
        petName: petMap[p.pet_id]?.name || "",
        petSpecies: petMap[p.pet_id]?.species || "",
      })));
      if (searchQuery) pushHistory(searchQuery);
    }
    if (user) {
      const { data: likes } = await supabase.from("gallery_likes").select("post_id").eq("user_id", user.id);
      const likeMap: any = {};
      (likes || []).forEach((l: any) => { likeMap[l.post_id] = true; });
      setLikedPosts(likeMap);
    }
    setLoading(false);
  };

  // フィルタ・検索 state 変動時に検索 / 何も無ければ通常 fetch
  useEffect(() => {
    if (searchQuery || petTypeFilter.length > 0) {
      runRpcSearch();
    } else {
      fetchPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, petTypeFilter.join(",")]);

  // pet_type のユニーク値を抽出 (chip 表示用)
  const petTypes = Array.from(new Set(posts.map((p: any) => p.pet_type).filter(Boolean))).sort() as string[];

  const togglePetType = (t: string) => {
    setPetTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gallery_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) {
      const userIds = [...new Set(data.map(p => p.user_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
      const profMap = {};
      (profiles || []).forEach(p => { profMap[p.id] = p; });

      const petIds = [...new Set(data.filter(p => p.pet_id).map(p => p.pet_id))];
      let petMap = {};
      if (petIds.length > 0) {
        const { data: pets } = await supabase.from("pets").select("id, name, species").in("id", petIds);
        (pets || []).forEach(p => { petMap[p.id] = p; });
      }

      setPosts(data.map(p => ({
        ...p,
        userName: profMap[p.user_id]?.display_name || "ユーザー",
        userAvatar: profMap[p.user_id]?.avatar_url || "",
        petName: petMap[p.pet_id]?.name || "",
        petSpecies: petMap[p.pet_id]?.species || "",
      })));
    }
    // いいね状態を取得
    if (user) {
      const { data: likes } = await supabase.from("gallery_likes").select("post_id").eq("user_id", user.id);
      const likeMap = {};
      (likes || []).forEach(l => { likeMap[l.post_id] = true; });
      setLikedPosts(likeMap);
    }
    setLoading(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    setUploading(true);
    const ext = selectedFile.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("gallery-images").upload(path, selectedFile);
    if (upErr) { alert("アップロードに失敗しました"); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("gallery-images").getPublicUrl(path);

    await supabase.from("gallery_posts").insert({
      user_id: user.id,
      image_url: urlData.publicUrl,
      caption: caption,
    });

    setShowUpload(false);
    setSelectedFile(null);
    setPreview("");
    setCaption("");
    setUploading(false);
    fetchPosts();
  };

  const toggleLike = async (postId) => {
    if (!user) { setPage("signup"); return; }
    if (likedPosts[postId]) {
      await supabase.from("gallery_likes").delete().eq("user_id", user.id).eq("post_id", postId);
      setLikedPosts(prev => { const n = {...prev}; delete n[postId]; return n; });
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: Math.max(0, (p.likes_count||0)-1)} : p));
    } else {
      await supabase.from("gallery_likes").insert({ user_id: user.id, post_id: postId });
      setLikedPosts(prev => ({...prev, [postId]: true}));
      setPosts(prev => prev.map(p => p.id === postId ? {...p, likes_count: (p.likes_count||0)+1} : p));
    }
  };

  // 依頼書 #30: 大判タイル判定 (display_priority>0 || 7投稿に1回パターン or top-liked)
  const isBigTile = (post: any, index: number) => {
    if (post.display_priority && post.display_priority > 0) return true;
    // 0番目と7番目 (index % 7 === 0 で index !== 0) を大判に / トップは大判で目を引く
    return index === 0 || (index > 0 && index % 7 === 0);
  };

  return (
    <div style={{ paddingTop: isPC ? 0 : 60, minHeight:"100vh", background:C.cream }}>
      {/* ヘッダー */}
      <div style={{ padding:"20px 16px 12px", background:C.white, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:900, color:C.dark, marginBottom:4 }}>🐾 うちの子ギャラリー</h1>
            <p style={{ fontSize:12, color:C.warmGray }}>街の住民の景色がぎっしり集まる場所</p>
          </div>
          {user && (
            <button onClick={()=>setShowUpload(true)} style={{
              padding:"10px 18px", background:C.orange, border:"none", borderRadius:12,
              color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer"
            }}>📸 投稿する</button>
          )}
        </div>

        {/* 依頼書 #30 Phase 2: 検索バー */}
        <div style={{ marginTop:12, position:"relative" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:8,
            padding:"10px 14px", background:C.cream, borderRadius:14,
            border:`1.5px solid ${searchInput ? C.orange : C.border}`,
            transition:"border-color 0.2s"
          }}>
            <span style={{ fontSize:16, color:C.warmGray, flexShrink:0 }}>🔍</span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onBlur={() => setTimeout(() => setShowHistory(false), 200)}
              placeholder={'うちの子・キャプション・種類で検索...'}
              style={{
                flex:1, border:"none", outline:"none", background:"transparent",
                fontSize:14, fontFamily:"inherit", color:C.dark, minWidth:0
              }}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(""); setSearchQuery(""); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:C.warmGray, fontSize:16, padding:"0 4px", lineHeight:1, fontFamily:"inherit" }}
                aria-label="クリア"
              >✕</button>
            )}
          </div>

          {/* 検索履歴 dropdown */}
          {showHistory && !searchInput && searchHistory.length > 0 && (
            <div style={{
              position:"absolute", top:"100%", left:0, right:0, marginTop:6,
              background:C.white, borderRadius:12, border:`1px solid ${C.border}`,
              boxShadow:"0 4px 16px rgba(0,0,0,0.08)", zIndex:50,
              padding:"6px 0", maxHeight:240, overflowY:"auto"
            }}>
              <div style={{ padding:"4px 14px", fontSize:11, color:C.warmGray, fontWeight:700 }}>最近の検索</div>
              {searchHistory.map((h) => (
                <button
                  key={h}
                  onMouseDown={(e) => { e.preventDefault(); setSearchInput(h); }}
                  style={{ width:"100%", padding:"8px 14px", background:"transparent", border:"none", textAlign:"left", cursor:"pointer", fontSize:13, color:C.dark, fontFamily:"inherit", display:"flex", alignItems:"center", gap:8 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = C.cream)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ color:C.warmGray, fontSize:12 }}>🕐</span><span>{h}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 依頼書 #30 Phase 2: pet_type フィルタ chip */}
        {petTypes.length > 0 && (
          <div style={{ marginTop:10, display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
            <button
              onClick={() => setPetTypeFilter([])}
              style={{
                flexShrink:0, padding:"5px 12px", borderRadius:16,
                background: petTypeFilter.length === 0 ? C.orange : C.white,
                color: petTypeFilter.length === 0 ? "#fff" : C.warmGray,
                border:`1.5px solid ${petTypeFilter.length === 0 ? C.orange : C.border}`,
                fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap"
              }}
            >すべて</button>
            {petTypes.map((t) => (
              <button
                key={t}
                onClick={() => togglePetType(t)}
                style={{
                  flexShrink:0, padding:"5px 12px", borderRadius:16,
                  background: petTypeFilter.includes(t) ? C.orange : C.white,
                  color: petTypeFilter.includes(t) ? "#fff" : C.warmGray,
                  border:`1.5px solid ${petTypeFilter.includes(t) ? C.orange : C.border}`,
                  fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap"
                }}
              >{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* 投稿モーダル */}
      {showUpload && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:400, width:"100%", maxHeight:"88vh", overflow:"auto", WebkitOverflowScrolling:"touch" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <h2 style={{ fontSize:18, fontWeight:900, color:C.dark }}>📸 写真を投稿</h2>
              <button onClick={()=>{setShowUpload(false);setSelectedFile(null);setPreview("");setCaption("");}} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display:"none" }}/>
            {preview ? (
              <div style={{ marginBottom:16 }}>
                <img src={preview} alt="" style={{ width:"100%", borderRadius:14, maxHeight:300, objectFit:"cover" }}/>
                <button onClick={()=>{setSelectedFile(null);setPreview("");}} style={{ marginTop:8, fontSize:12, color:C.red, background:"none", border:"none", cursor:"pointer" }}>写真を変更</button>
              </div>
            ) : (
              <button onClick={()=>fileRef.current?.click()} style={{
                width:"100%", padding:"40px 20px", border:`2px dashed ${C.border}`, borderRadius:14,
                background:C.lightGray, cursor:"pointer", marginBottom:16, textAlign:"center"
              }}>
                <div style={{ fontSize:40, marginBottom:8 }}>📷</div>
                <div style={{ fontSize:13, color:C.warmGray }}>タップして写真を選ぶ</div>
              </button>
            )}
            <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="うちの子の紹介やエピソードを書いてね🐾" rows={3}
              style={{ width:"100%", padding:"11px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:16 }}/>
            <button disabled={!selectedFile||uploading} onClick={handleUpload} style={{
              width:"100%", padding:"14px", background:(!selectedFile||uploading)?C.warmGray:C.orange,
              border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:(!selectedFile||uploading)?"not-allowed":"pointer"
            }}>{uploading ? "投稿中..." : "🐾 投稿する"}</button>
          </div>
        </div>
      )}

      {/* 依頼書 #11 #2 (5/25): CrowdfundingBanner 再利用 (期限制御内蔵・7/1 自動非表示) */}
      <CrowdfundingBanner />

      {/* 投稿グリッド */}
      <div style={{ padding:"16px" }}>
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:C.warmGray }}>読み込み中...</div>
        ) : posts.length === 0 ? (
          /* 依頼書 #11 #1 (5/25): 空状態 温度感UP - 「住める速度」哲学準拠 */
          <div style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:56, marginBottom:14, opacity:0.85 }}>🐾</div>
            <div style={{ fontSize:17, fontWeight:700, color:C.dark, marginBottom:10, letterSpacing:0.2 }}>
              街の最初の写真を、そっと置いてみませんか
            </div>
            <p style={{ fontSize:12.5, color:C.warmGray, lineHeight:1.9, marginBottom:24, maxWidth:380, margin:"0 auto 24px" }}>
              急がなくて大丈夫。<br/>
              うちの子の小さな一枚から、街は少しずつ深くなっていきます。
            </p>
            {user && (
              <button
                onClick={()=>setShowUpload(true)}
                style={{ padding:"11px 26px", background:"transparent", border:`1.5px solid ${C.orange}`, borderRadius:22, color:C.orange, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", transition:"all 0.2s" }}
                onMouseEnter={(e)=>{(e.target as HTMLButtonElement).style.background = C.orangePale;}}
                onMouseLeave={(e)=>{(e.target as HTMLButtonElement).style.background = "transparent";}}
              >
                📸 写真を置く →
              </button>
            )}
          </div>
        ) : (
          // 依頼書 #38 Phase A: Instagram Explore 完全再現
          // - inline style に display:grid + gridTemplateColumns を直書き (CSS class より確実)
          // - PC は index.css の !important media query で 4列/5列に上書き
          // - 大判タイル機能 OFF (まず 3列均一)
          // - 各タイル: div role=button + width:100% + minWidth:0 + aspectRatio:1
          // - img: width/height 100% + object-fit:cover
          <div
            className="qocca-gallery-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 2,
              width: "100%",
              margin: 0,
              padding: 0,
            }}
          >
            {posts.map((post) => (
              <div
                key={post.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPost(post)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedPost(post); } }}
                aria-label={`${post.userName || "投稿"} - ${post.petName || ""}`}
                style={{
                  position: "relative",
                  width: "100%",
                  minWidth: 0,
                  aspectRatio: "1 / 1",
                  overflow: "hidden",
                  cursor: "pointer",
                  margin: 0,
                  padding: 0,
                  background: C.cream,
                  display: "block",
                }}
                onMouseEnter={(e) => {
                  const overlay = e.currentTarget.querySelector("[data-overlay]") as HTMLElement | null;
                  if (overlay) overlay.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const overlay = e.currentTarget.querySelector("[data-overlay]") as HTMLElement | null;
                  if (overlay) overlay.style.opacity = "0";
                }}
              >
                <img
                  src={post.image_url}
                  alt=""
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {/* ホバーで lighten + メタ情報 (オーバーレイ) */}
                <div
                  data-overlay
                  style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(245,169,74,0.7) 100%)",
                    opacity: 0, transition: "opacity 0.2s",
                    display: "flex", flexDirection: "column", justifyContent: "flex-end",
                    padding: "6px 8px", color: "#fff",
                    textAlign: "left", pointerEvents: "none",
                  }}
                >
                  {post.petName && (
                    <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 2, textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>
                      🐾 {post.petName}
                    </div>
                  )}
                  <div style={{ fontSize: 9, opacity: 0.95 }}>
                    ❤️ {post.likes_count || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 依頼書 #30: 投稿詳細モーダル (画像クリック時) */}
        {selectedPost && (
          <div
            onClick={() => setSelectedPost(null)}
            style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:400,
              display:"flex", alignItems:"center", justifyContent:"center", padding:16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background:C.white, borderRadius:20, maxWidth:540, width:"100%",
                maxHeight:"92vh", overflow:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ position:"relative" }}>
                <img src={selectedPost.image_url} alt="" style={{ width:"100%", display:"block", maxHeight:"60vh", objectFit:"contain", background:"#000" }}/>
                <button
                  onClick={() => setSelectedPost(null)}
                  style={{
                    position:"absolute", top:12, right:12,
                    width:36, height:36, borderRadius:"50%",
                    background:"rgba(0,0,0,0.6)", color:"#fff", border:"none",
                    fontSize:18, cursor:"pointer", fontFamily:"inherit",
                  }}
                  aria-label="閉じる"
                >✕</button>
              </div>
              <div style={{ padding:"16px 20px 20px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                    {selectedPost.userAvatar ? <img src={selectedPost.userAvatar} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : <span style={{ fontSize:16 }}>🐾</span>}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{selectedPost.userName}</div>
                    {selectedPost.petName && <div style={{ fontSize:11, color:C.warmGray }}>🐾 {selectedPost.petName}{selectedPost.pet_type ? ` · ${selectedPost.pet_type}` : ""}</div>}
                  </div>
                </div>
                {selectedPost.caption && (
                  <div style={{ fontSize:13, color:"#444", lineHeight:1.7, marginBottom:14, whiteSpace:"pre-wrap" }}>
                    {selectedPost.caption}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                  <button
                    onClick={() => { toggleLike(selectedPost.id); setSelectedPost({ ...selectedPost, likes_count: (selectedPost.likes_count || 0) + (likedPosts[selectedPost.id] ? -1 : 1) }); }}
                    style={{ background:"none", border:"none", cursor:"pointer", fontSize:22, padding:0, lineHeight:1 }}
                  >{likedPosts[selectedPost.id] ? "❤️" : "🤍"}</button>
                  <span style={{ fontSize:13, color:C.warmGray }}>{selectedPost.likes_count || 0} いいね</span>
                  <button
                    onClick={() => { setCommentTarget({ type:"gallery", id: selectedPost.id, ownerId: selectedPost.user_id }); setCommentOpen(true); setSelectedPost(null); }}
                    style={{ marginLeft:"auto", padding:"8px 14px", background:C.cream, border:`1px solid ${C.border}`, borderRadius:10, fontSize:12, fontWeight:700, color:C.dark, cursor:"pointer", fontFamily:"inherit" }}
                  >💬 コメントを見る</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {commentTarget && (
  <CommentModal
    open={commentOpen}
    onClose={()=>setCommentOpen(false)}
    targetType={commentTarget.type}
    targetId={commentTarget.id}
    postOwnerId={commentTarget.ownerId}
    currentUserId={user?.id}
    onRequireLogin={()=>{ setCommentOpen(false); setPage("login"); }}
    title="コメント"
  />
)}
      </div>
    </div>
  );
};

