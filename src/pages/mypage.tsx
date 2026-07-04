// マイページ ページ群 (App.tsx 分割 Phase7・最大塊)
// MyPage(ハブ) + 10タブ(Posts/Listings/Sales/Orders/Earnings/Addresses/Messages(Order/Direct)/Notifications/Support)
//   + ActivityDetailModal/DisputeModal + GalleryComposeForm/BlogComposeForm + PetCategory型
// ⚠️ ロジック・参照名は App.tsx 時点から1文字も改変なし (切り取って移動)。
// ⚠️ EarningsTab の SUPABASE_URL/ANON ローカル定義 + createClient(独自client) は verbatim (Multiple GoTrueClient警告は既存)。
// ⚠️ detectContacts(DM防御・決済防御の心臓部) は utils/moderation 参照のみ。openDM リスナー3箇所(MyPage/MessagesTab/DirectMessagesTab)は本ファイル内で連携保全。
// export: MyPage のみ (他14部品 + PetCategory型 は module-private intra)。

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../constants/theme";
import { DISPUTE_REASONS, PREFS, MOOD_TAGS, REDEEM_TIER_THEME } from "../constants/data";
import { miniBtnStyle, orderStatusKey } from "../utils/format";
import { detectContacts, checkFacilityNGWords } from "../utils/moderation";
import { resolveFontFamily } from "../constants/fonts";
// 2026/7/4 あしあとUI第1弾: 残高カード (プロフィールタブに配置)
import { AshiatoBalanceCard } from "../components/AshiatoBalanceCard";
import { petLabelShort, petIcon } from "../constants/pets";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { OrderStatusBar } from "../components/ui";
import { ReviewModal } from "../components/ReviewModal";
import ProfileEditModal from "../components/ProfileEditModal";
import PetEditModal from "../components/PetEditModal";
import { ListingEditModal } from "../components/ListingEditModal";

// ── 暮らしの空気 (v3.2 第23章: "設定" でなく "模様替え") ──────────────────
// MyPage 内だけ色が変わる。5 プリセット。保存ボタンなし、即タップ反映。
// ⚠️ App.tsx から移動 (Phase7: MyPage 専用ヘルパー / App.tsx 残留側では未使用)。
type AtmospherePreset = {
  id: "asa" | "yuugata" | "yoru" | "kokage" | "atatakai";
  icon: string;
  label: string;
  bg: string;
  accent: string;
  cardBorder: string;
};

const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  { id: "asa",      icon: "☀️", label: "朝",        bg: "#FAFAF7", accent: "#FFB47A", cardBorder: "#E8C99A" },
  { id: "yuugata",  icon: "🌆", label: "夕方",      bg: "#FCF5ED", accent: "#F5A94A", cardBorder: "#D87B5A" },
  { id: "yoru",     icon: "🌙", label: "夜",        bg: "#ECEFF2", accent: "#4A6FA5", cardBorder: "#8DAEC9" },
  { id: "kokage",   icon: "🌿", label: "木陰",      bg: "#F2F5EC", accent: "#7A9968", cardBorder: "#A8C09A" },
  { id: "atatakai", icon: "🕯", label: "あたたかい", bg: "#FAF3E8", accent: "#C9925E", cardBorder: "#E0B788" },
];
const DEFAULT_ATMOSPHERE = ATMOSPHERE_PRESETS[4]; // atatakai
const findAtmosphere = (id?: string | null): AtmospherePreset =>
  ATMOSPHERE_PRESETS.find(a => a.id === id) || DEFAULT_ATMOSPHERE;

type PetCategory = { slug: string; label_jp: string; icon: string };

const PostsTab = () => {
  const { user } = useAuth();
  const [myGallery, setMyGallery] = useState<any[]>([]);
  const [myBlog, setMyBlog] = useState<any[]>([]);
  const [petCategories, setPetCategories] = useState<PetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "compose-gallery" | "compose-blog" | "edit-gallery" | "edit-blog">("list");
  const [editing, setEditing] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: "gallery" | "blog"; id: string; title: string } | null>(null);
  const [activeSection, setActiveSection] = useState<"gallery" | "blog">("gallery");

  const loadAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    const [galRes, blogRes, catRes] = await Promise.all([
      supabase.from("gallery_posts").select("*").eq("user_id", user.id).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("blog_posts").select("*").eq("author_id", user.id).eq("is_deleted", false).order("created_at", { ascending: false }),
      supabase.from("pet_categories").select("slug, label_jp, icon").eq("is_active", true).order("display_order"),
    ]);
    setMyGallery(galRes.data || []);
    setMyBlog(blogRes.data || []);
    setPetCategories(catRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [user?.id]);

  const handleSoftDelete = async () => {
    if (!confirmDelete) return;
    const table = confirmDelete.type === "gallery" ? "gallery_posts" : "blog_posts";
    await supabase.from(table).update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq("id", confirmDelete.id);
    setConfirmDelete(null);
    loadAll();
  };

  const startEdit = (post: any, type: "gallery" | "blog") => {
    setEditing(post);
    setMode(type === "gallery" ? "edit-gallery" : "edit-blog");
  };

  if (!user) {
    return <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>ログインしてください</div>;
  }

  // ── 投稿モーダル / 編集モーダル ──
  if (mode === "compose-gallery" || mode === "edit-gallery") {
    return (
      <GalleryComposeForm
        user={user}
        petCategories={petCategories}
        editing={mode === "edit-gallery" ? editing : null}
        onClose={() => { setMode("list"); setEditing(null); loadAll(); }}
      />
    );
  }
  if (mode === "compose-blog" || mode === "edit-blog") {
    return (
      <BlogComposeForm
        user={user}
        editing={mode === "edit-blog" ? editing : null}
        onClose={() => { setMode("list"); setEditing(null); loadAll(); }}
      />
    );
  }

  // ── 一覧画面 ──
  const card: React.CSSProperties = { background: C.white, borderRadius: 14, padding: 16, border: `1px solid ${C.border}`, marginBottom: 12 };
  const btn = (bg: string, color = "#fff"): React.CSSProperties => ({
    padding: "10px 16px", background: bg, color, border: "none", borderRadius: 10,
    fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", minHeight: 40,
  });

  return (
    <div>
      {/* 投稿ボタン 2列 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode("compose-gallery")} style={{ ...btn(C.orange), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📸 ギャラリー投稿
        </button>
        <button onClick={() => setMode("compose-blog")} style={{ ...btn("#4A90E2"), display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          📝 ブログ投稿
        </button>
      </div>

      {/* セクション切替 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, borderBottom: `2px solid ${C.border}` }}>
        {[
          { id: "gallery" as const, label: `📸 ギャラリー (${myGallery.length})` },
          { id: "blog" as const,    label: `📝 ブログ (${myBlog.length})` },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding: "10px 14px", background: activeSection === s.id ? C.orange : "transparent",
            color: activeSection === s.id ? "#fff" : C.warmGray, border: "none",
            borderRadius: "10px 10px 0 0", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
            cursor: "pointer", borderBottom: activeSection === s.id ? `3px solid ${C.orange}` : "none", marginBottom: -2,
          }}>{s.label}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: C.warmGray }}>読み込み中…</div>
      ) : activeSection === "gallery" ? (
        myGallery.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 32, color: C.warmGray, fontSize: 13 }}>
            まだギャラリーへの投稿はありません<br/>
            <span style={{ fontSize: 11 }}>上の「📸 ギャラリー投稿」から、うちの子の一枚を置いてください</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {myGallery.map(g => (
              <div key={g.id} style={card}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {g.image_url && (
                    <img src={g.image_url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}/>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: C.warmGray, marginBottom: 2 }}>
                      {g.pet_type && <>🐾 {g.pet_type}</>}
                      {g.pet_name && <> · {g.pet_name}</>}
                      {" "}· {new Date(g.created_at).toLocaleDateString("ja-JP")}
                    </div>
                    <div style={{ fontSize: 13, color: C.dark, lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {g.caption || <span style={{ color: C.warmGray }}>(キャプションなし)</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(g, "gallery")} style={btn(C.cream, C.dark)}>✏️ 編集</button>
                      <button onClick={() => setConfirmDelete({ type: "gallery", id: g.id, title: g.pet_name || "投稿" })}
                        style={btn("#FFEBEE", C.red)}>🗑️ 削除</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        myBlog.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: 32, color: C.warmGray, fontSize: 13 }}>
            まだブログへの投稿はありません<br/>
            <span style={{ fontSize: 11 }}>上の「📝 ブログ投稿」から、書きはじめてください</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {myBlog.map(b => (
              <div key={b.id} style={card}>
                {b.cover_image_url && (
                  <img src={b.cover_image_url} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 8, marginBottom: 10 }}/>
                )}
                <div style={{ fontSize: 14, fontWeight: 800, color: C.dark, marginBottom: 4 }}>
                  {b.title || "(タイトルなし)"}
                </div>
                <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 8 }}>
                  {b.published ? "🌅 公開中" : "📝 下書き"}
                  {b.category && <> · {b.category}</>}
                  {" "}· {new Date(b.created_at).toLocaleDateString("ja-JP")}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(b, "blog")} style={btn(C.cream, C.dark)}>✏️ 編集</button>
                  <button onClick={() => setConfirmDelete({ type: "blog", id: b.id, title: b.title || "ブログ" })}
                    style={btn("#FFEBEE", C.red)}>🗑️ 削除</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 削除確認ダイアログ (急かさない・取り消せない旨を明示) */}
      {confirmDelete && (
        <div onClick={() => setConfirmDelete(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: C.white, borderRadius: 18, padding: 24, maxWidth: 380, width: "100%",
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: C.dark, marginBottom: 10 }}>
              本当に削除しますか?
            </div>
            <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>
              「{confirmDelete.title}」を削除します。<br/>
              <span style={{ color: C.red, fontWeight: 700 }}>削除すると元に戻せません。</span><br/>
              <span style={{ fontSize: 11, color: C.warmGray }}>急ぐ必要はないので、もう一度ゆっくり考えてください。</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ ...btn(C.cream, C.dark), flex: 1 }}>キャンセル</button>
              <button onClick={handleSoftDelete} style={{ ...btn(C.red), flex: 1 }}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// === ギャラリー投稿/編集フォーム ===
const GalleryComposeForm = ({ user, petCategories, editing, onClose }: any) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(editing?.image_url || "");
  const [caption, setCaption] = useState<string>(editing?.caption || "");
  const [petType, setPetType] = useState<string>(editing?.pet_type || "");
  const [petName, setPetName] = useState<string>(editing?.pet_name || "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editing;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setImageFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!isEdit && !imageFile) { alert("画像を選んでください"); return; }
    setBusy(true);
    let imageUrl = editing?.image_url || "";
    if (imageFile) {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("gallery-images").upload(path, imageFile);
      if (upErr) { alert("画像アップロード失敗: " + upErr.message); setBusy(false); return; }
      const { data } = supabase.storage.from("gallery-images").getPublicUrl(path);
      imageUrl = data.publicUrl;
    }

    if (isEdit) {
      await supabase.from("gallery_posts").update({
        caption, pet_type: petType || null, pet_name: petName || null,
        ...(imageFile ? { image_url: imageUrl } : {}),
      }).eq("id", editing.id);
    } else {
      await supabase.from("gallery_posts").insert({
        user_id: user.id, image_url: imageUrl, caption,
        pet_type: petType || null, pet_name: petName || null,
      });
    }
    setBusy(false);
    onClose();
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 14, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>← キャンセル</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.dark }}>{isEdit ? "📸 ギャラリーを編集" : "📸 ギャラリーに投稿"}</div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }}/>
      {preview ? (
        <div style={{ marginBottom: 14 }}>
          <img src={preview} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 320, objectFit: "cover", background: "#000" }}/>
          <button onClick={() => fileRef.current?.click()} style={{ marginTop: 6, fontSize: 12, color: C.orange, background: "none", border: "none", cursor: "pointer" }}>📷 画像を変更</button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} style={{
          width: "100%", padding: "40px 20px", border: `2px dashed ${C.border}`, borderRadius: 14,
          background: C.cream, cursor: "pointer", marginBottom: 14, textAlign: "center", fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📷</div>
          <div style={{ fontSize: 13, color: C.warmGray }}>タップして写真を選ぶ</div>
        </button>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>うちの子の名前 (任意)</label>
        <input value={petName} onChange={e => setPetName(e.target.value)} placeholder="例: まろん"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}/>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>
          うちの子の種類 (任意)
          <span style={{ fontSize: 11, color: C.warmGray, fontWeight: 400 }}> · 13 種類から</span>
        </label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {petCategories.map((c: PetCategory) => (
            <button key={c.slug} onClick={() => setPetType(petType === c.slug ? "" : c.slug)} style={{
              padding: "6px 10px", background: petType === c.slug ? C.orange : C.white,
              color: petType === c.slug ? "#fff" : C.warmGray,
              border: `1.5px solid ${petType === c.slug ? C.orange : C.border}`, borderRadius: 16,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{c.icon} {c.label_jp}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>キャプション</label>
        <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="うちの子のエピソードを書いてね🐾" rows={4} maxLength={500}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}/>
        <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 2 }}>{caption.length} / 500</div>
      </div>

      <button onClick={handleSubmit} disabled={busy || (!isEdit && !imageFile)} style={{
        width: "100%", padding: 14, background: busy ? C.warmGray : C.orange, color: "#fff",
        border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15,
        cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
      }}>{busy ? "送信中…" : isEdit ? "💾 変更を保存" : "🐾 投稿する"}</button>
    </div>
  );
};

// === ブログ投稿/編集フォーム ===
const BlogComposeForm = ({ user, editing, onClose }: any) => {
  const [title, setTitle] = useState<string>(editing?.title || "");
  const [content, setContent] = useState<string>(editing?.content || "");
  const [category, setCategory] = useState<string>(editing?.category || "diary");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>(editing?.cover_image_url || "");
  const [published, setPublished] = useState<boolean>(editing?.published ?? false);
  const [busy, setBusy] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);
  const isEdit = !!editing;

  const handleCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setCoverFile(f); setCoverPreview(URL.createObjectURL(f)); }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!title.trim()) { alert("タイトルを入力してください"); return; }
    if (!content.trim()) { alert("本文を入力してください"); return; }
    setBusy(true);
    let coverUrl = editing?.cover_image_url || "";
    if (coverFile) {
      const ext = coverFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("blog-images").upload(path, coverFile);
      if (upErr) { alert("画像アップロード失敗: " + upErr.message); setBusy(false); return; }
      const { data } = supabase.storage.from("blog-images").getPublicUrl(path);
      coverUrl = data.publicUrl;
    }
    if (isEdit) {
      await supabase.from("blog_posts").update({
        title, content, category, published,
        ...(coverFile ? { cover_image_url: coverUrl } : {}),
        updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
    } else {
      await supabase.from("blog_posts").insert({
        author_id: user.id, title, content, category, published,
        cover_image_url: coverUrl, ai_generated: false,
      });
    }
    setBusy(false);
    onClose();
  };

  const BLOG_CATEGORIES = [
    { slug: "diary",     icon: "📔", label: "うちの子日記" },
    { slug: "tips",      icon: "💡", label: "暮らしのコツ" },
    { slug: "review",    icon: "⭐", label: "レビュー" },
    { slug: "memorial",  icon: "🌸", label: "そらの子へ" },
    { slug: "other",     icon: "📝", label: "その他" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, gap: 8 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 14, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>← キャンセル</button>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.dark }}>{isEdit ? "📝 ブログを編集" : "📝 ブログに投稿"}</div>
      </div>

      <input ref={coverRef} type="file" accept="image/*" onChange={handleCover} style={{ display: "none" }}/>
      {coverPreview ? (
        <div style={{ marginBottom: 14 }}>
          <img src={coverPreview} alt="" style={{ width: "100%", borderRadius: 12, maxHeight: 220, objectFit: "cover" }}/>
          <button onClick={() => coverRef.current?.click()} style={{ marginTop: 6, fontSize: 12, color: C.orange, background: "none", border: "none", cursor: "pointer" }}>📷 カバー画像を変更</button>
        </div>
      ) : (
        <button onClick={() => coverRef.current?.click()} style={{
          width: "100%", padding: "32px 20px", border: `2px dashed ${C.border}`, borderRadius: 14,
          background: C.cream, cursor: "pointer", marginBottom: 14, textAlign: "center", fontFamily: "inherit",
        }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>🖼️</div>
          <div style={{ fontSize: 12, color: C.warmGray }}>カバー画像を選ぶ (任意)</div>
        </button>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>タイトル *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例: 雨の日のまろん"
          style={{ width: "100%", padding: 10, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }}/>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 6 }}>カテゴリ</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {BLOG_CATEGORIES.map(c => (
            <button key={c.slug} onClick={() => setCategory(c.slug)} style={{
              padding: "6px 10px", background: category === c.slug ? C.orange : C.white,
              color: category === c.slug ? "#fff" : C.warmGray,
              border: `1.5px solid ${category === c.slug ? C.orange : C.border}`, borderRadius: 16,
              fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            }}>{c.icon} {c.label}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.dark, display: "block", marginBottom: 4 }}>本文 *</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="思いを書いてね…" rows={10}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7 }}/>
      </div>

      <div style={{ marginBottom: 18, padding: 12, background: C.cream, borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" id="blog-published" checked={published} onChange={e => setPublished(e.target.checked)} style={{ width: 18, height: 18, cursor: "pointer" }}/>
        <label htmlFor="blog-published" style={{ fontSize: 13, color: C.dark, cursor: "pointer" }}>
          🌅 すぐ公開する {!published && <span style={{ fontSize: 11, color: C.warmGray }}>(チェックを外すと下書き保存)</span>}
        </label>
      </div>

      <button onClick={handleSubmit} disabled={busy} style={{
        width: "100%", padding: 14, background: busy ? C.warmGray : "#4A90E2", color: "#fff",
        border: "none", borderRadius: 12, fontWeight: 800, fontSize: 15,
        cursor: busy ? "wait" : "pointer", fontFamily: "inherit",
      }}>{busy ? "送信中…" : isEdit ? "💾 変更を保存" : (published ? "🌅 公開する" : "📝 下書き保存")}</button>
    </div>
  );
};

export const MyPage = ({ setPage }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("profile");
  const [isPC, setIsPC] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsPC(window.innerWidth >= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleOpenDM = () => setTab("messages");
    window.addEventListener("openDM", handleOpenDM);
    return () => window.removeEventListener("openDM", handleOpenDM);
  }, []);
  useEffect(() => {
    // Sidebar の「管理する」等から特定タブを強制で開く汎用イベント
    const handleOpenTab = (e: any) => {
      const t = e?.detail?.tab;
      if (typeof t === "string" && t.length > 0) setTab(t);
    };
    window.addEventListener("openMyPageTab", handleOpenTab);
    return () => window.removeEventListener("openMyPageTab", handleOpenTab);
  }, []);
  // 暮らしの空気 (v3.2 第23章): MyPage 内だけの "模様替え"
  // - 初回ログイン時に DB から読み込み (default: atatakai)
  // - 切替時に即反映 (保存ボタンなし)、DB は非同期で更新
  const [atmosphereId, setAtmosphereId] = useState<string>("atatakai");
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("home_atmosphere")
        .eq("id", user.id)
        .single();
      if (data?.home_atmosphere) setAtmosphereId(data.home_atmosphere);
    })();
  }, [user?.id]);
  const atmosphere = findAtmosphere(atmosphereId);
  const changeAtmosphere = async (id: string) => {
    setAtmosphereId(id); // 即反映 (optimistic)
    if (!user?.id) return;
    // DB は非同期で更新 (失敗してもUIは戻さない、次回ログイン時に正しい値が読まれる)
    await supabase.from("profiles").update({ home_atmosphere: id }).eq("id", user.id);
  };
  const [editOpen, setEditOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // Phase D Phase 2 (5/22): うちの子セクション state
  const [petEditOpen, setPetEditOpen] = useState(false);
  const [editingPetId, setEditingPetId] = useState<string | null>(null);
  const [myPets, setMyPets] = useState<Array<{
    id: string; name: string; species: string; breed?: string | null;
    birthday?: string | null; bio?: string | null; avatar_url?: string | null;
    gender?: string | null; status: string;
  }>>([]);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string; bio?: string; created_at?: string; early_supporter_expires_at?: string | null; is_founding_creator?: boolean; is_founding_mayor?: boolean; founding_creator_fee_rate?: number | null; font_display_name?: string | null; font_bio?: string | null; font_one_word?: string | null; font_pet_name?: string | null; font_blog_title?: string | null } | null>(null);
  // 依頼書 #7 Phase A.2: クラファン引き換え済みコード + 未受け取りバッカー
  const [crowdfundCodes, setCrowdfundCodes] = useState<any[]>([]);
  const [crowdfundPendingBackers, setCrowdfundPendingBackers] = useState<any[]>([]);
  const [stats, setStats] = useState<{ listings: number; completed: number; avgRating: number | null }>({ listings: 0, completed: 0, avgRating: null });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, bio, created_at, early_supporter_expires_at, is_founding_creator, is_founding_mayor, founding_creator_fee_rate, font_display_name, font_bio, font_one_word, font_pet_name, font_blog_title")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    })();
  }, [user?.id, refreshKey]);
  // 依頼書 #7 Phase A.2 (5/25): クラファン引き換え済みコード + 未受け取り backers 取得
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const [codesRes, pendingRes] = await Promise.all([
        // 引き換え済み: redeemed_by_user_id = user.id
        supabase
          .from("crowdfunding_codes")
          .select("id, code, reward_id, redeemed_at, backer_id, crowdfunding_rewards (id, name, price_jpy, benefits)")
          .eq("redeemed_by_user_id", user.id)
          .order("redeemed_at", { ascending: false }),
        // 未受け取り: backers.user_id = user.id AND status='pending' (Admin が紐付け済の場合のみ)
        supabase
          .from("crowdfunding_backers")
          .select("id, tier, amount, status, email")
          .eq("user_id", user.id)
          .eq("status", "pending"),
      ]);
      setCrowdfundCodes(codesRes.data || []);
      setCrowdfundPendingBackers(pendingRes.data || []);
    })();
  }, [user?.id, refreshKey]);
  // Phase D Phase 2 (5/22): 自分の pets を取得 (active → memorial 順)
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, species, breed, birthday, bio, avatar_url, gender, status, display_order")
        .eq("owner_id", user.id)
        .order("status", { ascending: true })
        .order("display_order", { ascending: true });
      setMyPets(data || []);
    })();
  }, [user?.id, refreshKey, petEditOpen]);
  useEffect(()=>{
    if (!user?.id) return;
    (async ()=>{
      const [listingsRes, ordersRes, reviewsRes] = await Promise.all([
        supabase.from("listings").select("id", { count:"exact", head:true }).eq("seller_id", user.id),
        supabase.from("orders").select("id", { count:"exact", head:true }).eq("seller_id", user.id).eq("status", "completed"),
        supabase.from("reviews").select("rating").eq("seller_id", user.id),
      ]);
      const ratings = (reviewsRes.data || []).map((r:{rating:number})=>r.rating);
      const avg = ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null;
      setStats({
        listings: listingsRes.count || 0,
        completed: ordersRes.count || 0,
        avgRating: avg,
      });
    })();
  }, [user?.id, refreshKey]);

  // マイ活動カウント
  const [activity, setActivity] = useState<{ communities:number; events:number; gallery:number; blog:number; following:number; followers:number }>({ communities:0, events:0, gallery:0, blog:0, following:0, followers:0 });
  useEffect(()=>{
    if (!user?.id) return;
    (async ()=>{
      const [comm, ev, gal, bl, fwing, fwer] = await Promise.all([
        supabase.from("community_members").select("community_id", { count:"exact", head:true }).eq("user_id", user.id),
        supabase.from("events").select("id", { count:"exact", head:true }).eq("organizer_id", user.id),
        supabase.from("gallery_posts").select("id", { count:"exact", head:true }).eq("user_id", user.id),
        supabase.from("blog_posts").select("id", { count:"exact", head:true }).eq("author_id", user.id),
        supabase.from("follows").select("following_id", { count:"exact", head:true }).eq("follower_id", user.id),
        supabase.from("follows").select("follower_id", { count:"exact", head:true }).eq("following_id", user.id),
      ]);
      setActivity({
        communities: comm.count || 0,
        events: ev.count || 0,
        gallery: gal.count || 0,
        blog: bl.count || 0,
        following: fwing.count || 0,
        followers: fwer.count || 0,
      });
    })();
  }, [user?.id, refreshKey]);

  const [activityModal, setActivityModal] = useState<string | null>(null);

  // 2026/6/28 軽傷UX-④: モーダル表示中の右スワイプ/戻る で 別ページに飛ばずモーダルだけ閉じる。
  //   pushState で履歴に印を積み、popstate で印を見て closeModal。React Router 設定不変。
  const MYPAGE_MODAL_MARK = "mypage_activity_modal";
  const openActivityModal = (type: string) => {
    setActivityModal(type);
    window.history.pushState({ [MYPAGE_MODAL_MARK]: type }, "");
  };
  const closeActivityModal = () => {
    const marker = (window.history.state as { [k: string]: unknown } | null)?.[MYPAGE_MODAL_MARK];
    if (marker) {
      window.history.back(); // popstate ハンドラで activityModal=null
    } else {
      setActivityModal(null);
    }
  };
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const marker = (e.state as { [k: string]: unknown } | null)?.[MYPAGE_MODAL_MARK];
      if (!marker) setActivityModal(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 依頼書 #138 タスク1 (2026/6/9): 公開ページ URL 共有 (8eighty8eight さん DM 起点)
  // 出品クリエイターが Instagram に貼るための URL。/user/:userId 形式 (依頼書指定)。
  const publicProfileUrl = user?.id ? `https://www.qocca.pet/user/${user.id}` : "";
  const [copyToast, setCopyToast] = useState<"" | "ok" | "fail">("");
  const handleCopyPublicUrl = async () => {
    if (!publicProfileUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicProfileUrl);
        setCopyToast("ok");
      } else {
        // フォールバック (古い Safari 等): textarea + execCommand
        const ta = document.createElement("textarea");
        ta.value = publicProfileUrl;
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        setCopyToast(ok ? "ok" : "fail");
      }
    } catch (_) {
      setCopyToast("fail");
    }
    setTimeout(() => setCopyToast(""), 2400);
  };
  const openPublicProfile = () => {
    if (publicProfileUrl && typeof window !== "undefined") {
      window.open(publicProfileUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (!user) return null;

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "ユーザー";
  const initial = displayName.charAt(0).toUpperCase();
  const provider = user?.app_metadata?.provider;
  const providerLabel = provider === "google" ? "Google" : provider === "twitter" ? "X" : "メール";

  const handleSignOut = async () => { await signOut(); setPage("home"); };

  // バッジ用の未読数（DBから取得、初期値0）
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0); // 受取確認待ちの注文数（購入者として）
  const [pendingSalesCount, setPendingSalesCount] = useState(0); // 対応待ちの販売（出品者として）

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      // 受取確認待ち（自分が購入者・決済済かつ納品済 / Phase3: 2軸読み）
      const { count: ordersCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", user.id)
        .eq("payment_status", "paid")
        .eq("fulfillment_status", "delivered");
      setPendingOrdersCount(ordersCount || 0);

      // 対応待ちの販売（自分が出品者・決済済かつ作業中 / Phase3: 2軸読み・未払いは除外=S2バッジ問題も解消）
      const { count: salesCount } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .eq("payment_status", "paid")
        .eq("fulfillment_status", "working");
      setPendingSalesCount(salesCount || 0);

      // 未読DM数（recipient_idが自分でis_read=false）
      const { count: dmCount } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);
      setUnreadMsgs(dmCount || 0);
    })();
  }, [user?.id, refreshKey]);

  const tabs = [
    { id:"profile", icon:"👤", label:"プロフィール" },
    { id:"posts", icon:"📸", label:"投稿管理" }, // 依頼書 #38 Phase C-E
    { id:"listings", icon:"🐾", label:"マイ出品" },
    { id:"sales", icon:"🛍️", label:"販売管理", badge:pendingSalesCount },
    { id:"orders", icon:"📦", label:"注文履歴", badge:pendingOrdersCount },
    { id:"earnings", icon:"💰", label:"売上" },
    { id:"addresses", icon:"🏠", label:"配送先" },
    { id:"messages", icon:"💬", label:"メッセージ", badge:unreadMsgs },
    { id:"notifications", icon:"🔔", label:"通知", badge:unreadNotifs },
    { id:"support", icon:"🎧", label:"サポート" },
  ];

  return (
    <div style={{ paddingTop:60, minHeight:"100vh", background:atmosphere.bg, padding:"80px 16px 40px", transition:"background 0.6s ease" }}>
      {/* 依頼書 #138 タスク1 (2026/6/9): コピー結果トースト (Editorial / fade in-out / 2.4s) */}
      {copyToast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          padding: "12px 22px", borderRadius: 24, fontSize: 13, fontWeight: 700,
          fontFamily: "inherit", zIndex: 9999,
          background: copyToast === "ok" ? "#FFF8E7" : "#FFE4E1",
          color: copyToast === "ok" ? "#7A5C00" : "#A33C2E",
          border: `1px solid ${copyToast === "ok" ? "#F5D680" : "#D9888C"}`,
          boxShadow: "0 4px 18px rgba(0,0,0,0.08)",
          opacity: 0.98,
          maxWidth: "90vw", textAlign: "center", lineHeight: 1.5,
        }}>
          {copyToast === "ok" ? "🔗 公開ページのリンクをコピーしました。SNS にどうぞ。" : "コピーできませんでした。手動で URL をコピーしてください。"}
        </div>
      )}
      <div style={{ maxWidth:600, margin:"0 auto" }}>
        {/* 依頼書 #138 タスク1 (2026/6/9): SNS 宣伝用 公開ページ共有導線 (8eighty8eight さん DM 起点)
            - 「自分の公開ページを見る」: 新規タブで /user/:userId を開く
            - 「リンクをコピー」: https://www.qocca.pet/user/:userId をクリップボードへ */}
        <div style={{ marginBottom: 16, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button
            onClick={openPublicProfile}
            title={publicProfileUrl}
            style={{
              padding: "10px 16px",
              background: C.white,
              border: `1.5px solid ${C.orange}`,
              borderRadius: 22,
              color: C.orange,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
            }}
          >
            🔗 自分の公開ページを見る
          </button>
          <button
            onClick={handleCopyPublicUrl}
            title={publicProfileUrl}
            style={{
              padding: "10px 16px",
              background: C.orange,
              border: `1.5px solid ${C.orange}`,
              borderRadius: 22,
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
            }}
          >
            📋 リンクをコピー
          </button>
        </div>
        {/* Tab Navigation - レスポンシブ：スマホ2列(4行) / PC4列(2行) */}
        <div style={{ display:"grid", gridTemplateColumns: isPC ? "repeat(4, 1fr)" : "repeat(2, 1fr)", gap:6, marginBottom:20 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"10px 8px", border:`1.5px solid ${tab===t.id?C.orange:C.border}`,
              borderRadius:12, background:tab===t.id?C.orangePale:C.white,
              color:tab===t.id?C.orange:C.warmGray, fontSize:12, fontWeight:700,
              cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:5, position:"relative", minHeight:42
            }}>
              <span style={{ fontSize:14 }}>{t.icon}</span>
              <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{t.label}</span>
              {t.badge > 0 && <span style={{ background:C.orange, color:"#fff", fontSize:9, fontWeight:800, padding:"1px 5px", borderRadius:8, minWidth:14, textAlign:"center", flexShrink:0 }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {tab==="profile" && (
          <>
            <div style={{ background:C.white, borderRadius:20, padding:"28px 20px", border:`1px solid ${C.border}`, textAlign:"center", marginBottom:20 }}>
              <div style={{ width:72, height:72, borderRadius:"50%", background: profile?.avatar_url ? `url(${profile.avatar_url}) center/cover` : C.orange, display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, fontWeight:900, color:"#fff", margin:"0 auto 12px" }}>{!profile?.avatar_url && initial}</div>
              <div style={{ fontSize:18, fontWeight:700, color:C.dark, marginBottom:4, fontFamily: resolveFontFamily(profile?.font_display_name) }}>{displayName}</div>
              <div style={{ fontSize:13, color:C.warmGray, marginBottom:8 }}>{user?.email}</div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 12px", background:C.orangePale, borderRadius:20, fontSize:11, fontWeight:700, color:C.orange }}>{providerLabel}でログイン中</div>
              {/* Phase D Phase 2: プロフィール情報セクション「編集」+「公開で見る」 */}
              <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setEditOpen(true)}
                  style={{
                    padding: "8px 16px",
                    background: C.orange,
                    border: "none",
                    borderRadius: 18,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 36,
                  }}
                >
                  ✏️ 編集
                </button>
                <button
                  onClick={openPublicProfile}
                  title={publicProfileUrl}
                  style={{
                    padding: "8px 16px",
                    background: C.white,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 18,
                    color: C.dark,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 36,
                  }}
                >
                  🔗 公開ページを見る
                </button>
                <button
                  onClick={handleCopyPublicUrl}
                  title={publicProfileUrl}
                  style={{
                    padding: "8px 16px",
                    background: C.orangePale,
                    border: `1.5px solid ${C.orange}`,
                    borderRadius: 18,
                    color: C.orange,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    minHeight: 36,
                  }}
                >
                  📋 リンクをコピー
                </button>
              </div>
            </div>
            {/* 2026/7/4 あしあとUI第1弾: 残高カード (本人のみ・プロフィールカード直下) */}
            <AshiatoBalanceCard userId={user?.id} />
            {/* 創業期出品者バッジ (King 哲学: 本人のみ見える、公開プロフィールには出さない) */}
            {profile?.early_supporter_expires_at && (() => {
              const expiresAt = new Date(profile.early_supporter_expires_at!);
              const now = new Date();
              if (expiresAt <= now) return null;
              const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "linear-gradient(135deg, #FFF3E0 0%, #FFE8D6 100%)",
                  borderRadius: 12,
                  border: `1px solid ${C.orange}`,
                  fontSize: 13,
                  color: C.dark,
                  textAlign: "center",
                  lineHeight: 1.7,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.orange, marginBottom: 4 }}>
                    ⭐ 創業期出品者
                  </div>
                  <div style={{ fontSize: 12, color: C.warmGray }}>
                    手数料 5%・残り {daysLeft} 日 (〜{expiresAt.toLocaleDateString("ja-JP")})
                  </div>
                </div>
              );
            })()}
            {profile?.bio && (
                <div style={{ background:C.orangePale, borderRadius:12, padding:"12px 16px", marginTop:16, marginBottom:4, textAlign:"left", fontSize:14, color:C.dark, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{profile.bio}</div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 👑 Founding Mayor 2026 称号バッジ */}
              {profile?.is_founding_mayor && (
                <div style={{
                  marginTop: 16, padding: "14px 18px",
                  background: "linear-gradient(135deg, #FFF8E1 0%, #FFE082 100%)",
                  borderRadius: 14, border: `2px solid #FFA000`,
                  textAlign: "center", boxShadow: "0 4px 12px rgba(255,160,0,0.15)",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#E65100", marginBottom: 2, letterSpacing: 0.5 }}>
                    👑 Founding Mayor 2026
                  </div>
                  <div style={{ fontSize: 11, color: "#8B6F00", lineHeight: 1.6 }}>
                    Qocca の街の首長として、創業期から街を支える方
                  </div>
                </div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 🎨 Founding Creator バッジ + 事業が存続する限り3% 手数料 */}
              {profile?.is_founding_creator && (
                <div style={{
                  marginTop: 12, padding: "14px 18px",
                  background: "linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)",
                  borderRadius: 14, border: `2px solid #AB47BC`,
                  textAlign: "center", boxShadow: "0 4px 12px rgba(171,71,188,0.12)",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#6A1B9A", marginBottom: 2 }}>
                    🎨 Founding Creator
                  </div>
                  <div style={{ fontSize: 11, color: "#7B1FA2", lineHeight: 1.6 }}>
                    事業が存続する限り手数料 <strong style={{ fontSize: 14 }}>{profile.founding_creator_fee_rate ?? 3}%</strong> (通常10% → 創業特典)
                  </div>
                </div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 🎁 未受け取り特典あり → /redeem 誘導 */}
              {crowdfundPendingBackers.length > 0 && (
                <div
                  onClick={() => navigate("/redeem")}
                  style={{
                    marginTop: 16, padding: "14px 18px", cursor: "pointer",
                    background: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)",
                    borderRadius: 14, border: `2px dashed #4CAF50`,
                    textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                  }}
                >
                  <div style={{ fontSize: 28 }}>🎁</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#2E7D32", marginBottom: 2 }}>
                      未受け取りの特典が {crowdfundPendingBackers.length} 件あります
                    </div>
                    <div style={{ fontSize: 11, color: "#388E3C" }}>
                      タップして引き換えコードを入力してや 🌅
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: "#2E7D32" }}>→</div>
                </div>
              )}
              {/* 依頼書 #7 Phase A.2 (5/25): 🎁 私の特典 (引き換え済みコード一覧) */}
              {crowdfundCodes.length > 0 && (
                <div style={{ marginTop: 20, background: C.white, borderRadius: 16, padding: "16px 16px 14px", border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 18 }}>🎁</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>私のクラファン特典</span>
                    <span style={{ fontSize: 10, color: C.warmGray, marginLeft: "auto" }}>{crowdfundCodes.length} 件</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {crowdfundCodes.map((c: any) => {
                      const tierId = c.reward_id || c.crowdfunding_rewards?.id;
                      const theme = REDEEM_TIER_THEME[tierId] || { color: C.orange, bg: C.orangePale, icon: "🎁", label: c.crowdfunding_rewards?.name || tierId };
                      const redeemedDate = c.redeemed_at ? new Date(c.redeemed_at).toLocaleDateString("ja-JP") : "-";
                      return (
                        <div key={c.id} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 12px", background: theme.bg, borderRadius: 12, border: `1px solid ${theme.color}40`,
                        }}>
                          <div style={{ fontSize: 22 }}>{theme.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: theme.color, marginBottom: 2 }}>
                              {theme.label}
                            </div>
                            <div style={{ fontSize: 10, color: C.warmGray }}>
                              受け取り日 {redeemedDate}
                              {c.crowdfunding_rewards?.price_jpy ? ` ・ ¥${c.crowdfunding_rewards.price_jpy.toLocaleString()}` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: C.warmGray, marginTop: 10, textAlign: "center", lineHeight: 1.6 }}>
                    ありがとうございます。Qocca の街は、あなたの想いで一歩深くなりました🌅
                  </div>
                </div>
              )}
              {/* Phase D Phase 2 (5/22): 🐾 うちの子セクション */}
              <div style={{ marginTop: 20, background: C.white, borderRadius: 16, padding: "16px 16px 14px", border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>
                    🐾 うちの子 ({myPets.length})
                  </div>
                  <button
                    onClick={() => { setEditingPetId(null); setPetEditOpen(true); }}
                    style={{
                      padding: "6px 14px",
                      background: C.orange,
                      color: "#fff",
                      border: "none",
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      minHeight: 32,
                    }}
                  >
                    + 追加
                  </button>
                </div>
                {myPets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 12px", color: C.warmGray, fontSize: 12, lineHeight: 1.8, border: `1px dashed ${C.border}`, borderRadius: 10, background: "#FAFAFA" }}>
                    まだ うちの子 を追加していません。<br/>
                    「+ 追加」から、ペットの情報を残せます。
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                    {myPets.map((p) => {
                      const isMemorial = p.status === "memorial";
                      const genderIcon = p.gender === "male" ? "♂" : p.gender === "female" ? "♀" : "";
                      const speciesEmoji = petIcon(p.species);
                      const heroPhoto = p.avatar_url || "";
                      return (
                        <div
                          key={p.id}
                          style={{
                            background: isMemorial ? "#F8F6F2" : C.white,
                            borderRadius: 12,
                            border: `1px solid ${C.border}`,
                            overflow: "hidden",
                            opacity: isMemorial ? 0.92 : 1,
                          }}
                        >
                          <div style={{
                            width: "100%",
                            aspectRatio: "1",
                            background: "#FFF5EB",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 40,
                            position: "relative",
                            overflow: "hidden",
                          }}>
                            {heroPhoto ? (
                              <img src={heroPhoto} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                            ) : speciesEmoji}
                            {isMemorial && (
                              <div style={{
                                position: "absolute",
                                top: 4,
                                right: 4,
                                background: "rgba(255,255,255,0.92)",
                                color: "#8B6F4E",
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 6px",
                                borderRadius: 8,
                              }}>
                                🌈 虹の橋
                              </div>
                            )}
                          </div>
                          <div style={{ padding: "8px 10px" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                              {genderIcon && <span style={{ color: C.warmGray, fontSize: 11, fontWeight: 600 }}>{genderIcon}</span>}
                            </div>
                            <div style={{ fontSize: 10, color: C.warmGray, marginBottom: 8, lineHeight: 1.4, height: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {speciesEmoji} {p.breed || petLabelShort(p.species)}
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                onClick={() => { setEditingPetId(p.id); setPetEditOpen(true); }}
                                style={{
                                  flex: 1, padding: "5px 8px",
                                  background: C.orangePale, color: C.orange,
                                  border: "none", borderRadius: 6,
                                  fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", fontFamily: "inherit",
                                  minHeight: 28,
                                }}
                              >
                                ✏️ 編集
                              </button>
                              <button
                                onClick={() => navigate(`/pet/${p.id}`)}
                                style={{
                                  flex: 1, padding: "5px 8px",
                                  background: C.white, color: C.dark,
                                  border: `1px solid ${C.border}`, borderRadius: 6,
                                  fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", fontFamily: "inherit",
                                  minHeight: 28,
                                }}
                              >
                                👁️ 公開で見る
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            <div style={{ display:"flex", gap:0, marginTop:16, background:C.white, borderRadius:12, padding:"12px 0", border:`1px solid ${C.border}` }}>
                <button onClick={()=>openActivityModal("listings")} style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}`, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:18, fontWeight:600, color:C.dark }}>{stats.listings}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>出品</div>
                </button>
                <button onClick={()=>openActivityModal("completed")} style={{ flex:1, textAlign:"center", borderRight:`1px solid ${C.border}`, background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:18, fontWeight:600, color:C.dark }}>{stats.completed}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>取引完了</div>
                </button>
                <button onClick={()=>openActivityModal("reviews")} style={{ flex:1, textAlign:"center", background:"transparent", border:"none", cursor:"pointer", fontFamily:"inherit", padding:0 }}>
                  <div style={{ fontSize:18, fontWeight:600, color:C.dark }}>{stats.avgRating !== null ? stats.avgRating.toFixed(1) : "-"}</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>⭐ 評価</div>
                </button>
              </div>

            {/* フォロー・フォロワー */}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={()=>openActivityModal("following")} style={{ flex:1, padding:"10px", background:C.white, border:`1px solid ${C.border}`, borderRadius:10, cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ fontSize:15, fontWeight:800, color:C.dark }}>{activity.following}</span>
                <span style={{ fontSize:11, color:C.warmGray, marginLeft:6 }}>フォロー中</span>
              </button>
              <button onClick={()=>openActivityModal("followers")} style={{ flex:1, padding:"10px", background:C.white, border:`1px solid ${C.border}`, borderRadius:10, cursor:"pointer", fontFamily:"inherit" }}>
                <span style={{ fontSize:15, fontWeight:800, color:C.dark }}>{activity.followers}</span>
                <span style={{ fontSize:11, color:C.warmGray, marginLeft:6 }}>フォロワー</span>
              </button>
            </div>

            {/* マイ活動セクション (v3.1: 4色違い → C.cream 統一、識別性はアイコン絵文字で維持) */}
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.warmGray, marginBottom:8, paddingLeft:4 }}>マイ活動</div>
              <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                {[
                  { id:"communities", icon:"💬", label:"参加中のコミュニティ", count:activity.communities },
                  { id:"events", icon:"📅", label:"投稿したイベント", count:activity.events },
                  { id:"gallery", icon:"🐾", label:"投稿したギャラリー", count:activity.gallery },
                  { id:"blog", icon:"📝", label:"投稿したブログ", count:activity.blog },
                ].map((item, i) => (
                  <button key={item.id} onClick={()=>openActivityModal(item.id)} style={{
                    width:"100%", padding:"14px 16px", border:"none", borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
                    background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", gap:12, fontFamily:"inherit", textAlign:"left"
                  }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{item.icon}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>{item.label}</div>
                    </div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginRight:6 }}>{item.count}</div>
                    <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
       
            <button onClick={()=>setEditOpen(true)} style={{ marginTop:16, background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:20, padding:"10px 20px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"background 0.3s ease, color 0.3s ease" }}>✏️ プロフィールを編集</button>
            <div style={{ background:C.white, borderRadius:20, border:`1px solid ${C.border}`, overflow:"hidden" }}>
              {[
                { icon:"❤️", label:"お気に入り", desc:"気になる出品", action:()=>setPage("liked") },
                { icon:"📦", label:"注文履歴", desc:"過去の注文を確認", action:()=>setTab("orders") },
                { icon:"💰", label:"売上", desc:"売上・出金管理", action:()=>setTab("earnings") },
                { icon:"🏠", label:"配送先住所", desc:"住所の管理", action:()=>setTab("addresses") },
                { icon:"💬", label:"メッセージ", desc:"取引メッセージ", action:()=>setTab("messages") },
                { icon:"🔔", label:"通知", desc:`${unreadNotifs}件の未読`, action:()=>setTab("notifications") },
                { icon:"🎧", label:"サポート", desc:"お問い合わせ", action:()=>setTab("support") },
              ].map((item, i) => (
                <button key={item.label} onClick={item.action} style={{
                  width:"100%", padding:"16px 20px", border:"none", borderBottom: i < 6 ? `1px solid ${C.border}` : "none",
                  background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", gap:14, fontFamily:"inherit", textAlign:"left"
                }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{item.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:C.dark }}>{item.label}</div>
                    <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>{item.desc}</div>
                  </div>
                  <span style={{ color:C.warmGray, fontSize:14 }}>→</span>
                </button>
              ))}
            </div>
            {/* 電話番号認証への導線 (v3.2 第29-30章: 任意機能、出品者推奨) */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.warmGray, marginBottom:10, paddingLeft:4 }}>
                安心の準備
              </div>
              <button
                onClick={() => navigate("/settings/phone-verification")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px",
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:C.cream, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>📱</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>電話番号の認証</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>出品をはじめる方におすすめ</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
            </div>

            {/* Phase X (5/24, 案C 移植 5/26): 外部サービス連携 — X */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.warmGray, marginBottom:10, paddingLeft:4 }}>
                外部サービス連携
              </div>
              <button
                onClick={() => navigate("/settings/x")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px",
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, color:"#fff" }}>🐦</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>X 連携</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>Qocca から X (Twitter) に投稿できます</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
              {/* Phase Threads (5/23, 案C 移植 5/27): Threads 連携ボタン */}
              <button
                onClick={() => navigate("/settings/threads")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px", marginTop:8,
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, color:"#fff" }}>🧵</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>Threads 連携</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>Qocca から Threads に投稿できます</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
              {/* Phase Instagram (5/28 #25 Step 2): Instagram 連携ボタン */}
              <button
                onClick={() => navigate("/settings/instagram")}
                style={{
                  width:"100%", minHeight:44, padding:"14px 16px", marginTop:8,
                  background:C.white, border:`1px solid ${C.border}`, borderRadius:14,
                  display:"flex", alignItems:"center", gap:12,
                  cursor:"pointer", fontFamily:"inherit", textAlign:"left",
                  transition:"border-color 0.3s ease",
                }}
              >
                <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, color:"#fff" }}>📷</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.dark }}>Instagram 連携</div>
                  <div style={{ fontSize:11, color:C.warmGray, marginTop:2, lineHeight:1.5 }}>Qocca から Instagram に投稿できます (Business Account 必須)</div>
                </div>
                <span style={{ color:C.warmGray, fontSize:12 }}>→</span>
              </button>
            </div>

            {/* 暮らしの空気 (v3.2 第23章): "設定" でなく "模様替え" */}
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.warmGray, marginBottom:10, paddingLeft:4 }}>
                🏠 暮らしの空気
              </div>
              <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, WebkitOverflowScrolling:"touch" }}>
                {ATMOSPHERE_PRESETS.map(preset => {
                  const selected = atmosphereId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => changeAtmosphere(preset.id)}
                      style={{
                        flexShrink: 0,
                        minHeight: 44,
                        padding: "8px 14px",
                        background: selected ? preset.bg : C.white,
                        color: selected ? C.dark : C.warmGray,
                        border: `1.5px solid ${selected ? preset.cardBorder : C.border}`,
                        borderRadius: 22,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        whiteSpace: "nowrap",
                        transition: "background 0.4s ease, color 0.4s ease, border-color 0.4s ease",
                      }}
                    >
                      <span style={{ fontSize: 15 }}>{preset.icon}</span>
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:11, color:C.warmGray, marginTop:8, paddingLeft:4, opacity:0.7 }}>
                自分の家だけの空気。いつでも気分で。
              </div>
            </div>

            <button onClick={handleSignOut} style={{ width:"100%", padding:"14px", marginTop:20, background:C.white, border:`1.5px solid ${C.red}`, borderRadius:14, color:C.red, fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>🚪 ログアウト</button>
          </>
        )}

        {/* My Listings Tab (マイ出品 - 出品者向け) */}
        {tab==="listings" && <MyListingsTab setPage={setPage}/>}

        {/* Sales Tab (販売管理 - 出品者向け) */}
        {tab==="sales" && <SalesTab/>}

        {/* Orders Tab */}
        {tab==="orders" && <OrdersTab/>}

        {/* Earnings Tab */}
        {tab==="earnings" && <EarningsTab/>}

        {/* Addresses Tab */}
        {tab==="addresses" && <AddressesTab/>}

        {/* Messages Tab */}
        {tab==="messages" && <MessagesTab/>}

        {/* Notifications Tab */}
        {tab==="notifications" && <NotificationsTab/>}

        {/* Support Tab */}
        {tab==="support" && <SupportTab/>}

        {/* 依頼書 #38 Phase C-E: 投稿管理 (新規投稿/編集/削除) */}
        {tab==="posts" && <PostsTab/>}
      </div>
          <ProfileEditModal
        open={editOpen}
        onClose={()=>setEditOpen(false)}
        userId={user?.id}
        onSaved={()=>setRefreshKey(k=>k+1)}
      />
      {/* Phase D Phase 2 (5/22): PetEditModal (追加/編集モード、petId=null で追加) */}
      {user?.id && (
        <PetEditModal
          open={petEditOpen}
          onClose={() => { setPetEditOpen(false); setEditingPetId(null); }}
          userId={user.id}
          petId={editingPetId}
          onSaved={() => setRefreshKey(k => k + 1)}
        />
      )}
      {activityModal && <ActivityDetailModal type={activityModal} userId={user?.id} onClose={closeActivityModal} setPage={setPage}/>}
    </div>
  );
};

// ── マイ活動詳細モーダル ──────────────────────────────────────────────────
const ActivityDetailModal = ({ type, userId, onClose, setPage }: { type:string; userId:string; onClose:()=>void; setPage:(p:string,d?:any)=>void }) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (!userId) return;
    (async ()=>{
      setLoading(true);
      let data:any[] = [];
      if (type === "listings") {
        const { data: d } = await supabase.from("listings").select("id, title, price, image_urls, created_at").eq("seller_id", userId).order("created_at", { ascending: false });
        data = d || [];
      } else if (type === "completed") {
        const { data: d } = await supabase.from("orders").select("id, listing_id, created_at, status, buyer_id").eq("seller_id", userId).eq("status", "completed").order("created_at", { ascending: false });
        if (d && d.length > 0) {
          const listingIds = [...new Set(d.map((o:any)=>o.listing_id).filter(Boolean))];
          const { data: lists } = listingIds.length ? await supabase.from("listings").select("id, title, image_urls").in("id", listingIds) : { data: [] };
          const listMap = Object.fromEntries((lists||[]).map((l:any)=>[l.id, l]));
          data = d.map((o:any) => ({ ...o, listing: listMap[o.listing_id] }));
        }
      } else if (type === "reviews") {
        const { data: d } = await supabase.from("reviews").select("id, rating, comment, created_at, reviewer_id").eq("seller_id", userId).order("created_at", { ascending: false });
        if (d && d.length > 0) {
          const ids = [...new Set(d.map((r:any)=>r.reviewer_id))];
          const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids);
          const profMap = Object.fromEntries((profs||[]).map((p:any)=>[p.id, p]));
          data = d.map((r:any) => ({ ...r, reviewer_name: profMap[r.reviewer_id]?.display_name || "ユーザー", reviewer_avatar: profMap[r.reviewer_id]?.avatar_url }));
        }
      } else if (type === "communities") {
        const { data: mems } = await supabase.from("community_members").select("community_id").eq("user_id", userId);
        const ids = (mems||[]).map((m:any)=>m.community_id);
        if (ids.length) {
          const { data: comms } = await supabase.from("communities").select("id, name, icon, category, member_count").in("id", ids);
          data = comms || [];
        }
      } else if (type === "events") {
        const { data: d } = await supabase.from("events").select("id, title, event_date, prefecture, status, image_url").eq("organizer_id", userId).order("event_date", { ascending: false });
        data = d || [];
      } else if (type === "gallery") {
        const { data: d } = await supabase.from("gallery_posts").select("id, image_url, caption, created_at").eq("user_id", userId).eq("is_deleted", false).order("created_at", { ascending: false });
        data = d || [];
      } else if (type === "blog") {
        const { data: d } = await supabase.from("blog_posts").select("id, title, category, cover_image_url, created_at").eq("author_id", userId).order("created_at", { ascending: false });
        data = d || [];
      } else if (type === "following") {
        const { data: f } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
        const ids = (f||[]).map((x:any)=>x.following_id);
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url, bio").in("id", ids);
          data = profs || [];
        }
      } else if (type === "followers") {
        const { data: f } = await supabase.from("follows").select("follower_id").eq("following_id", userId);
        const ids = (f||[]).map((x:any)=>x.follower_id);
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url, bio").in("id", ids);
          data = profs || [];
        }
      }
      setItems(data);
      setLoading(false);
    })();
  }, [type, userId]);

  const titles: Record<string, string> = {
    listings: "📦 出品中の商品", completed: "✅ 取引完了履歴", reviews: "⭐ もらったレビュー",
    communities: "💬 参加中のコミュニティ", events: "📅 投稿したイベント",
    gallery: "🐾 投稿したギャラリー", blog: "📝 投稿したブログ",
    following: "👥 フォロー中", followers: "👥 フォロワー",
  };

  const handleNavigate = (path:string) => { onClose(); setPage(path); };

  const renderItem = (item:any) => {
    if (type === "listings") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`listing/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.image_urls?.[0] ? `url(${item.image_urls[0]}) center/cover` : C.orangePale, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
            <div style={{ fontSize:14, fontWeight:800, color:C.orange, marginTop:2 }}>¥{item.price?.toLocaleString()}</div>
          </div>
        </button>
      );
    }
    if (type === "completed") {
      return (
        <div key={item.id} style={{ display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.listing?.image_urls?.[0] ? `url(${item.listing.image_urls[0]}) center/cover` : C.orangePale, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.listing?.title || "商品"}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>✅ {new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
          </div>
        </div>
      );
    }
    if (type === "reviews") {
      return (
        <div key={item.id} style={{ padding:"12px 14px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background: item.reviewer_avatar ? `url(${item.reviewer_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:C.orange }}>{!item.reviewer_avatar && (item.reviewer_name||"?").charAt(0).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:C.dark }}>{item.reviewer_name}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{"⭐".repeat(item.rating)} ・ {new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
            </div>
          </div>
          {item.comment && <div style={{ fontSize:12, color:C.dark, lineHeight:1.5 }}>{item.comment}</div>}
        </div>
      );
    }
    if (type === "communities") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`community/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center" }}>
          <div style={{ width:44, height:44, borderRadius:10, background:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{item.icon || "🐾"}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>{item.category} · 👥 {item.member_count || 0}人</div>
          </div>
        </button>
      );
    }
    if (type === "events") {
      const statusBadge: Record<string, {bg:string;color:string;label:string}> = {
        approved: { bg:"#E8F5E9", color:"#4CAF50", label:"公開中" },
        pending: { bg:"#FFF8E1", color:"#996200", label:"審査中" },
        rejected: { bg:"#FFEBEE", color:"#C62828", label:"却下" },
      };
      const sb = statusBadge[item.status] || statusBadge.pending;
      return (
        <div key={item.id} style={{ display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.image_url?.startsWith("http") ? `url(${item.image_url}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{!item.image_url?.startsWith("http") && (item.image_url || "🐾")}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>📅 {item.event_date} · 📍 {item.prefecture}</div>
          </div>
          <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:sb.bg, color:sb.color, fontWeight:700, flexShrink:0 }}>{sb.label}</span>
        </div>
      );
    }
    if (type === "gallery") {
      // 依頼書 #12 (5/26): CSS background:url() のカッコ問題 → img タグ統一 (タスク #23 同様のリグレッション修正)
      return (
        <button key={item.id} onClick={()=>handleNavigate(`gallery/${item.id}`)} style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", cursor:"pointer", padding:0, fontFamily:"inherit", textAlign:"left" }}>
          <div style={{ width:"100%", aspectRatio:"1", overflow:"hidden", background:C.cream }}>
            {item.image_url && (
              <img src={item.image_url} alt={item.caption || ""} loading="lazy" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
            )}
          </div>
          {item.caption && <div style={{ padding:"8px 12px", fontSize:11, color:C.dark, lineHeight:1.5, overflow:"hidden", textOverflow:"ellipsis", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{item.caption}</div>}
        </button>
      );
    }
    if (type === "blog") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`blog/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, alignItems:"center", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
          <div style={{ width:50, height:50, borderRadius:8, background: item.cover_image_url ? `url(${item.cover_image_url}) center/cover` : C.orangePale, flexShrink:0 }}/>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.title}</div>
            <div style={{ fontSize:11, color:C.warmGray, marginTop:2 }}>{item.category} · {new Date(item.created_at).toLocaleDateString("ja-JP")}</div>
          </div>
          <span style={{ fontSize:14, color:C.orange }}>›</span>
        </button>
      );
    }
    if (type === "following" || type === "followers") {
      return (
        <button key={item.id} onClick={()=>handleNavigate(`user/${item.id}`)} style={{ width:"100%", display:"flex", gap:12, padding:"12px", background:C.white, border:`1px solid ${C.border}`, borderRadius:12, cursor:"pointer", textAlign:"left", fontFamily:"inherit", alignItems:"center" }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background: item.avatar_url ? `url(${item.avatar_url}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0 }}>{!item.avatar_url && (item.display_name||"?").charAt(0).toUpperCase()}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:C.dark }}>{item.display_name || "ユーザー"}</div>
            {item.bio && <div style={{ fontSize:11, color:C.warmGray, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.bio}</div>}
          </div>
        </button>
      );
    }
    return null;
  };

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:C.white, borderRadius:20, padding:"20px", width:"100%", maxWidth:480, maxHeight:"85vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:900, color:C.dark }}>{titles[type] || "詳細"}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.warmGray }}>×</button>
        </div>
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:8 }}>
          {loading ? (
            <div style={{ padding:30, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>
          ) : items.length === 0 ? (
            <div style={{ padding:30, textAlign:"center", color:C.warmGray, fontSize:13 }}>まだありません</div>
          ) : type === "gallery" ? (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:8 }}>{items.map(renderItem)}</div>
          ) : (
            items.map(renderItem)
          )}
        </div>
      </div>
    </div>
  );
};

// ── Order Status Bar ──────────────────────────────────────────────────────
// OrderStatusBar は components/ui.tsx へ移動 (Phase 4-b)

// ── Earnings Tab (売上・出金管理) ──────────────────────────────────────
const EarningsTab = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<any>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [connectStatus, setConnectStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showInstantModal, setShowInstantModal] = useState(false);
  const [instantAmount, setInstantAmount] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({});
  // 依頼書 #7 Phase A.2 (5/25): 創業クリエイター事業が存続する限り3%手数料表示用
  const [foundingCreatorFeeRate, setFoundingCreatorFeeRate] = useState<number | null>(null);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qufrqkuipzuqeqkvuhkx.supabase.co";
  const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou";

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

      // 残高サマリー
      const { data: bal } = await sb
        .from("seller_balances")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setBalance(bal);

      // 出金履歴
      const { data: payoutData } = await sb
        .from("payouts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setPayouts(payoutData || []);

      // platform_settings
      const { data: settingsData } = await sb
        .from("platform_settings")
        .select("key, value")
        .in("key", ["instant_payout_fee_rate", "instant_payout_fee_min", "monthly_payout_threshold"]);
      const settingsMap: Record<string, string> = {};
      for (const s of settingsData || []) settingsMap[s.key] = s.value;
      setSettings(settingsMap);

      // 依頼書 #7 Phase A.2: 創業クリエイター情報取得 (事業が存続する限り3%手数料表示用)
      const { data: prof } = await sb
        .from("profiles")
        .select("is_founding_creator, founding_creator_fee_rate")
        .eq("id", user.id)
        .single();
      if (prof?.is_founding_creator) {
        setFoundingCreatorFeeRate(prof.founding_creator_fee_rate ?? 3);
      } else {
        setFoundingCreatorFeeRate(null);
      }

      // Stripe Connect ステータス確認
      const statusRes = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id }),
      });
      const statusData = await statusRes.json();
      setConnectStatus(statusData);
    } catch (e) {
      console.error("Load earnings failed:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [user?.id]);

  const handleStartOnboarding = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("オンボーディング URL の取得に失敗しました: " + (data.error || ""));
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };
const handleOpenDashboard = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-connect-dashboard-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("ダッシュボードへのリンク取得に失敗しました: " + (data.error || ""));
      }
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };
  const handleInstantPayout = async () => {
    if (!user?.id) return;
    const amount = parseInt(instantAmount);
    if (!amount || amount < 100) { alert("100円以上の金額を入力してください"); return; }
    
    const fee = parseInt(settings.instant_payout_fee_min || "250"); // 一律¥250(税抜・税込¥275)
    const net = amount - fee;
    
    if (!confirm(`即時受け取りを実行しますか？\n\n出金額: ¥${amount.toLocaleString()}\n手数料: ¥${fee.toLocaleString()} (一律)\n受取額: ¥${net.toLocaleString()}\n\n数分以内に銀行口座へ振込されます。`)) return;
    
    setActionLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-instant-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON}`, "apikey": SUPABASE_ANON },
        body: JSON.stringify({ user_id: user.id, amount }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ 即時受け取りが完了しました！\n\n出金額: ¥${data.breakdown.gross.toLocaleString()}\n手数料: ¥${data.breakdown.fee.toLocaleString()}\n受取額: ¥${data.breakdown.net.toLocaleString()}`);
        setShowInstantModal(false);
        setInstantAmount("");
        loadData();
      } else {
        alert("エラー: " + (data.message || data.error || "不明"));
      }
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding:40, textAlign:"center", color:C.textMuted }}>読み込み中...</div>;
  }

  const isConnected = connectStatus?.connected && connectStatus?.payouts_enabled;
  const monthlyThreshold = parseInt(settings.monthly_payout_threshold || "30000");
  // 未連携バナーの動機づけ用: 完了した取引数 (既存フィールド・追加クエリなし)。0 のときは汎用文。
  const completedCount = balance?.completed_orders_count || 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Stripe Connect 連携状況 (v3.1: 2px ボーダー + orange solid CTA → line CTA に控えめ化) */}
      {!isConnected && (
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ fontSize:20 }}>{completedCount > 0 ? "💰" : "🏦"}</span>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:C.dark }}>
              {completedCount > 0
                ? `完了した取引が ${completedCount}件 あります`
                : "銀行口座を設定してください"}
            </h3>
          </div>
          <p style={{ margin:"8px 0 12px", fontSize:13, color:C.text, lineHeight:1.6 }}>
            {completedCount > 0
              ? <>売上を受け取るには、Stripe で銀行口座の連携が必要です🐾<br/>セキュアな本人確認を経て、安全に振込が可能になります。</>
              : <>売上を受け取るには、Stripe で銀行口座を連携する必要があります。<br/>セキュアな本人確認を経て、安全に振込が可能になります。</>}
          </p>
          <button
            onClick={handleStartOnboarding}
            disabled={actionLoading}
            style={{ background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:12, padding:"12px 24px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity: actionLoading ? 0.6 : 1, transition:"background 0.3s ease, color 0.3s ease" }}
          >
            {actionLoading ? "処理中..." : "銀行口座を設定する →"}
          </button>
        </div>
      )}

      {/* 依頼書 #7 Phase A.2 (5/25): 🎨 創業クリエイター事業が存続する限り3%手数料バナー */}
      {foundingCreatorFeeRate !== null && (
        <div style={{
          background: "linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)",
          border: `2px solid #AB47BC`,
          borderRadius: 16,
          padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 12px rgba(171,71,188,0.12)",
        }}>
          <div style={{ fontSize: 32 }}>🎨</div>
          <div style={{ flex: 1, lineHeight: 1.6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#6A1B9A", marginBottom: 2 }}>
              あなたは創業クリエイター
            </div>
            <div style={{ fontSize: 12, color: "#7B1FA2" }}>
              事業が存続する限り販売手数料 <strong style={{ fontSize: 16 }}>{foundingCreatorFeeRate}%</strong> (通常 10% → 創業特典)
            </div>
          </div>
        </div>
      )}

      {/* 残高サマリー (v3.1: 3つ並ぶうち1つだけ強調する EC的設計を排除、統一スタイル) */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
        <h3 style={{ margin:"0 0 16px", fontSize:14, fontWeight:700, color:C.text }}>残高サマリー</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div style={{ background:C.cream, padding:14, borderRadius:12, textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:4 }}>取引中</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark }}>¥{(balance?.in_escrow || 0).toLocaleString()}</div>
          </div>
          <div style={{ background:C.cream, padding:14, borderRadius:12, textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:4 }}>受取可能</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark }}>¥{(balance?.pending_balance || 0).toLocaleString()}</div>
          </div>
          <div style={{ background:C.cream, padding:14, borderRadius:12, textAlign:"center", border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:11, color:C.warmGray, marginBottom:4 }}>累計売上</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.dark }}>¥{(balance?.total_earned || 0).toLocaleString()}</div>
          </div>
        </div>
        <div style={{ marginTop:12, fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
          完了取引数: {balance?.completed_orders_count || 0}件
        </div>
      </div>

      {/* 振込スケジュール案内 */}
      <div style={{ background:"#F8F9FA", borderRadius:16, padding:16, fontSize:12, lineHeight:1.7, color:C.text }}>
        <div style={{ fontWeight:800, marginBottom:6 }}>📅 振込について</div>
        <div>• <strong>月末自動振込</strong>: ¥{monthlyThreshold.toLocaleString()}以上は手数料無料、未満は¥275(税込)</div>
        <div>• <strong>即時受け取り</strong>: 一律¥275(税込) / 数分で着金</div>
      </div>

      {/* 即時受け取りボタン (v3.1: 巨大 orange solid + ⚡絵文字 → line CTA + 矢印) */}
      {isConnected && (balance?.pending_balance || 0) > 0 && (
        <button
          onClick={() => setShowInstantModal(true)}
          style={{ background:"transparent", color:C.orange, border:`1.5px solid ${C.orange}`, borderRadius:14, padding:"14px 24px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", transition:"background 0.3s ease, color 0.3s ease" }}
        >
          今すぐ受け取る →
        </button>
      )}
{/* 銀行口座・支払い設定を変更（Stripe Express ダッシュボード） */}
      {isConnected && (
        <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:16 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:200 }}>
              <div style={{ fontSize:13, fontWeight:800, color:C.text, marginBottom:4 }}>🏦 銀行口座・支払い設定</div>
              <div style={{ fontSize:11, color:C.textMuted, lineHeight:1.5 }}>
                銀行口座の変更、住所変更、税情報の更新などはStripeのページから安全に行えます。
              </div>
            </div>
            <button
              onClick={handleOpenDashboard}
              disabled={actionLoading}
              style={{ background:C.white, color:C.orange, border:`2px solid ${C.orange}`, borderRadius:10, padding:"10px 18px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity: actionLoading ? 0.6 : 1, whiteSpace:"nowrap" }}
            >
              {actionLoading ? "処理中..." : "設定を変更する ↗"}
            </button>
          </div>
        </div>
      )}
      {/* 出金履歴 */}
      <div style={{ background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:20 }}>
        <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:800, color:C.text }}>📜 出金履歴</h3>
        {payouts.length === 0 ? (
          <div style={{ padding:20, textAlign:"center", color:C.textMuted, fontSize:13 }}>まだ出金履歴はありません</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {payouts.map(p => (
              <div key={p.id} style={{ padding:12, border:`1px solid ${C.border}`, borderRadius:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, color:C.textMuted }}>
                    {new Date(p.created_at).toLocaleDateString("ja-JP")} - {p.payout_type === "instant" ? "⚡即時" : p.payout_type === "monthly_auto" ? "📅月末" : "🖱️手動"}
                  </div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>¥{p.net_amount.toLocaleString()}</div>
                  {p.fee > 0 && <div style={{ fontSize:11, color:C.textMuted }}>手数料 ¥{p.fee.toLocaleString()}</div>}
                </div>
                <span style={{ 
                  fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:8,
                  background: p.status === "paid" ? "#E8F5E9" : p.status === "in_transit" ? "#FFF3E0" : p.status === "failed" ? "#FFEBEE" : "#F5F5F5",
                  color: p.status === "paid" ? "#2E7D32" : p.status === "in_transit" ? "#EF6C00" : p.status === "failed" ? "#C62828" : "#666"
                }}>
                  {p.status === "paid" ? "✅完了" : p.status === "in_transit" ? "🚀 振込中" : p.status === "failed" ? "❌失敗" : "保留中"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 即時受け取りモーダル */}
      {showInstantModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
          <div style={{ background:C.white, borderRadius:16, padding:24, maxWidth:400, width:"90%", maxHeight:"88vh", overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:16, fontWeight:800 }}>⚡ 即時受け取り</h3>
            <p style={{ fontSize:13, color:C.text, lineHeight:1.6, margin:"0 0 16px" }}>
              手数料: 一律¥275(税込)<br/>
              受取可能残高: <strong>¥{(balance?.pending_balance || 0).toLocaleString()}</strong>
            </p>
            <div style={{ marginBottom:16 }}>
              <label style={{ display:"block", fontSize:12, fontWeight:700, marginBottom:6 }}>出金額（円）</label>
              <input
                type="number"
                value={instantAmount}
                onChange={e => setInstantAmount(e.target.value)}
                placeholder="例: 10000"
                style={{ width:"100%", padding:12, border:`1px solid ${C.border}`, borderRadius:10, fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }}
              />
              {instantAmount && (
                <div style={{ marginTop:8, padding:10, background:C.orangePale, borderRadius:10, fontSize:12, lineHeight:1.6 }}>
                  手数料: ¥250 (税込¥275)<br/>
                  受取額: ¥{Math.max(0, parseInt(instantAmount||"0") - 250).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => { setShowInstantModal(false); setInstantAmount(""); }} style={{ flex:1, padding:12, border:`1px solid ${C.border}`, background:C.white, borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={handleInstantPayout} disabled={actionLoading || !instantAmount} style={{ flex:1, padding:12, border:"none", background:C.orange, color:C.white, borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity: (actionLoading || !instantAmount) ? 0.5 : 1 }}>
                {actionLoading ? "処理中..." : "実行"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Addresses Tab (配送先住所管理) ──────────────────────────────────────
const AddressesTab = () => {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm] = useState({ recipient_name:"", postal_code:"", prefecture:"", city:"", address_line:"", phone:"", label:"自宅", is_default:false });

  const fetchAddresses = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("user_id", user.id)
      .is("delete_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setAddresses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAddresses(); }, [user?.id]);

  const resetForm = () => {
    setForm({ recipient_name:"", postal_code:"", prefecture:"", city:"", address_line:"", phone:"", label:"自宅", is_default:false });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async () => {
    if (!form.recipient_name || !form.postal_code || !form.prefecture || !form.city || !form.address_line || !form.phone) {
      alert("必須項目をすべて入力してください");
      return;
    }
    if (!user?.id) { alert("ログインしてください"); return; }

    if (form.is_default) {
      await supabase.from("shipping_addresses").update({ is_default: false }).eq("user_id", user.id);
    }

    if (editingId) {
      const { error } = await supabase
        .from("shipping_addresses")
        .update({
          recipient_name: form.recipient_name,
          postal_code: form.postal_code,
          prefecture: form.prefecture,
          city: form.city,
          address_line: form.address_line,
          phone: form.phone,
          label: form.label,
          is_default: form.is_default,
        })
        .eq("id", editingId);
      if (error) { alert("更新失敗: " + error.message); return; }
    } else {
      const { error } = await supabase
        .from("shipping_addresses")
        .insert({
          user_id: user.id,
          recipient_name: form.recipient_name,
          postal_code: form.postal_code,
          prefecture: form.prefecture,
          city: form.city,
          address_line: form.address_line,
          phone: form.phone,
          label: form.label,
          is_default: addresses.length === 0 || form.is_default,
        });
      if (error) { alert("追加失敗: " + error.message); return; }
    }
    resetForm();
    fetchAddresses();
  };

  const handleEdit = (addr:any) => {
    setForm({
      recipient_name: addr.recipient_name,
      postal_code: addr.postal_code,
      prefecture: addr.prefecture,
      city: addr.city,
      address_line: addr.address_line,
      phone: addr.phone,
      label: addr.label || "自宅",
      is_default: addr.is_default,
    });
    setEditingId(addr.id);
    setShowForm(true);
  };

  const handleDelete = async (addr:any) => {
    if (!confirm(`「${addr.label || "住所"}」を削除しますか？`)) return;
    const { error } = await supabase.from("shipping_addresses").delete().eq("id", addr.id);
    if (error) { alert("削除失敗: " + error.message); return; }
    fetchAddresses();
  };

  const handleSetDefault = async (addr:any) => {
    if (!user?.id) return;
    await supabase.from("shipping_addresses").update({ is_default: false }).eq("user_id", user.id);
    await supabase.from("shipping_addresses").update({ is_default: true }).eq("id", addr.id);
    fetchAddresses();
  };

  return (
    <div style={{ padding:"20px 16px", paddingBottom:80 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <h2 style={{ fontSize:20, fontWeight:900, color:C.dark, margin:0 }}>🏠 配送先住所</h2>
        <button onClick={()=>{ resetForm(); setShowForm(true); }} style={{
          padding:"8px 14px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
        }}>+ 追加</button>
      </div>
      <div style={{ background:"#FFF8F0", padding:"12px 14px", borderRadius:10, fontSize:11, color:C.warmGray, marginBottom:14, lineHeight:1.5 }}>
        🔒 配送が必要な取引時に出品者に共有される住所です。取引完了後30日で自動削除されます。
      </div>

      {loading && <div style={{ textAlign:"center", padding:20, color:C.warmGray }}>読み込み中...</div>}

      {!loading && addresses.length === 0 && !showForm && (
        <div style={{ textAlign:"center", padding:"40px 20px", background:C.white, borderRadius:14, border:`1px solid ${C.border}` }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📭</div>
          <div style={{ fontSize:14, color:C.warmGray, marginBottom:14 }}>登録された住所はありません</div>
          <button onClick={()=>setShowForm(true)} style={{ padding:"10px 20px", background:C.orange, border:"none", borderRadius:10, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>+ 住所を追加</button>
        </div>
      )}

      {!loading && addresses.map(addr => (
        <div key={addr.id} style={{ background:C.white, padding:"14px", borderRadius:12, marginBottom:10, border:`1px solid ${C.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <span style={{ fontSize:14, fontWeight:800, color:C.dark }}>{addr.label || "住所"}</span>
            {addr.is_default && <span style={{ fontSize:10, padding:"3px 8px", background:C.orange, color:"#fff", borderRadius:6, fontWeight:700 }}>デフォルト</span>}
          </div>
          <div style={{ fontSize:12, color:C.warmGray, lineHeight:1.6, marginBottom:10 }}>
            <div>{addr.recipient_name} 様</div>
            <div>〒{addr.postal_code} {addr.prefecture}{addr.city}</div>
            <div>{addr.address_line}</div>
            <div>📱 {addr.phone}</div>
          </div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {!addr.is_default && (
              <button onClick={()=>handleSetDefault(addr)} style={{ padding:"6px 10px", background:C.white, border:`1px solid ${C.orange}`, borderRadius:8, color:C.orange, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>デフォルトに設定</button>
            )}
            <button onClick={()=>handleEdit(addr)} style={{ padding:"6px 10px", background:C.white, border:`1px solid ${C.border}`, borderRadius:8, color:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✏️ 編集</button>
            <button onClick={()=>handleDelete(addr)} style={{ padding:"6px 10px", background:C.white, border:`1px solid ${C.red}`, borderRadius:8, color:C.red, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑️ 削除</button>
          </div>
        </div>
      ))}

      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end" }} onClick={resetForm}>
          <div style={{ background:"#fff", borderRadius:"24px 24px 0 0", padding:"24px 20px", width:"100%", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>{editingId ? "✏️ 住所を編集" : "+ 住所を追加"}</div>
              <button onClick={resetForm} style={{ background:"none", border:"none", fontSize:20, color:C.warmGray, cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
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
                    value={form[f.k as keyof typeof form] as string}
                    onChange={e=>setForm({...form, [f.k]:e.target.value})}
                    placeholder={f.placeholder}
                    maxLength={f.maxLength}
                    style={{ width:"100%", padding:"10px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}
                  />
                </div>
              ))}
              <label style={{ display:"flex", alignItems:"center", gap:8, padding:"10px", background:C.lightGray, borderRadius:8, cursor:"pointer" }}>
                <input type="checkbox" checked={form.is_default} onChange={e=>setForm({...form, is_default:e.target.checked})} />
                <span style={{ fontSize:13, color:C.dark }}>デフォルト住所として設定</span>
              </label>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={resetForm} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={handleSubmit} style={{ flex:2, padding:"13px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", fontFamily:"inherit" }}>{editingId ? "更新する" : "追加する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Orders Tab（購入者向け：自分が買った注文一覧） ─────────────────────────
const OrdersTab = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showDispute, setShowDispute] = useState<any>(null);
  const [showReview, setShowReview] = useState<any>(null);
  const [filter, setFilter] = useState("all");
  // 依頼書 #143 TOP1 Step 3 (2026/6/10): 受取確認の連打防止 (二重送金 多層防御のフロント側)
  const [confirming, setConfirming] = useState(false);
  // Phase7分割時の import 漏れ修正: handleConfirm(complete-order呼び出し) が参照する SUPABASE_URL を OrdersTab スコープに定義 (EarningsTab と同パターン)
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://qufrqkuipzuqeqkvuhkx.supabase.co";

  const loadOrders = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment_status, fulfillment_status, escrow_status, amount, created_at, delivered_at, completed_at, listing_id, seller_id")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { console.error("orders fetch error:", error); setLoading(false); return; }

    // listing と seller profile を別途取得して付与
    const listingIds = Array.from(new Set((data || []).map(o => o.listing_id).filter(Boolean)));
    const sellerIds = Array.from(new Set((data || []).map(o => o.seller_id).filter(Boolean)));

    const [{ data: listings }, { data: sellers }] = await Promise.all([
      listingIds.length ? supabase.from("listings").select("id, title, image_urls, category").in("id", listingIds) : Promise.resolve({ data: [] }),
      sellerIds.length ? supabase.from("profiles").select("id, display_name").in("id", sellerIds) : Promise.resolve({ data: [] }),
    ]);

    const listingMap = new Map((listings || []).map(l => [l.id, l]));
    const sellerMap = new Map((sellers || []).map(s => [s.id, s]));

    const enriched = (data || []).map(o => ({
      ...o,
      listing: listingMap.get(o.listing_id),
      seller: sellerMap.get(o.seller_id),
    }));

    setOrders(enriched);
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, [user?.id]);

  const filtered = orders.filter(o => filter==="all" || orderStatusKey(o)===filter);

  const statusLabel = (s) => {
    const map = { pending:{text:"決済待ち",bg:C.lightGray,color:C.warmGray}, working:{text:"作業中",bg:"#E3F2FD",color:C.blue}, delivered:{text:"納品済み",bg:"#FFF3E0",color:C.orange}, completed:{text:"取引完了",bg:C.greenPale,color:C.green}, disputed:{text:"異議中",bg:"#FFEBEE",color:C.red}, refunded:{text:"返金済み",bg:"#FFEBEE",color:C.red}, cancelled:{text:"キャンセル",bg:C.lightGray,color:C.warmGray} };
    return map[s] || {text:s,bg:C.lightGray,color:C.warmGray};
  };

  const handleConfirm = async (orderId: string) => {
    // 依頼書 #143 TOP1 Step 3: 再入ガード (await 中の連打を物理的に防ぐ)
    if (confirming) return;
    if (!confirm("受取を確定しますか？\nこの操作で出品者へ売上が支払われます。")) return;
    setConfirming(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/complete-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "受取確認に失敗しました");
      alert("受取を確定しました。出品者へ売上が支払われます。");
      setSelected(null);
      await loadOrders();
    } catch (e: any) {
      alert(`エラー: ${e.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const formatDate = (s?: string) => s ? new Date(s).toLocaleDateString("ja-JP").replace(/\//g, ".") : "";
  const photoUrl = (l?: any) => Array.isArray(l?.image_urls) && l.image_urls.length ? l.image_urls[0] : null;

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {[["all","すべて"],["working","作業中"],["delivered","納品済み"],["completed","完了"],["disputed","異議中"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            flexShrink:0, padding:"6px 14px", border:`1.5px solid ${filter===v?C.orange:C.border}`,
            borderRadius:10, background:filter===v?C.orangePale:C.white,
            color:filter===v?C.orange:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:C.warmGray, fontSize:13 }}>読み込み中…</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:40, marginBottom:8 }}>📦</div>
          <div style={{ fontWeight:700, color:C.warmGray }}>注文がありません</div>
          <div style={{ fontSize:11, color:C.warmGray, marginTop:6 }}>気になる商品を購入してみましょう</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(order => {
            const st = statusLabel(orderStatusKey(order));
            const title = order.listing?.title || "（削除された商品）";
            const sellerName = order.seller?.display_name || "—";
            const img = photoUrl(order.listing);
            return (
              <div key={order.id} onClick={()=>setSelected(selected?.id===order.id?null:order)} style={{
                background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer"
              }}>
                <div style={{ padding:"16px", display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:img?`url(${img}) center/cover`:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                    {!img && "📦"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
                      <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, flexShrink:0 }}>{st.text}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.warmGray }}>{sellerName} · {formatDate(order.created_at)}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginTop:4 }}>¥{Number(order.amount || 0).toLocaleString()}</div>
                  </div>
                </div>

                {selected?.id===order.id && (
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px", background:C.lightGray }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.warmGray, marginBottom:4 }}>注文番号: {order.id.slice(0, 8)}</div>
                    <OrderStatusBar status={orderStatusKey(order)}/>

                    {orderStatusKey(order)==="disputed" && (
                      <div style={{ background:"#FFEBEE", borderRadius:12, padding:"12px", marginTop:8, fontSize:12, color:C.red }}>
                        <div style={{ fontWeight:700, marginBottom:4 }}>⚠️ 異議申し立て中</div>
                        <div style={{ fontSize:11, color:C.warmGray }}>運営にて対応中です</div>
                      </div>
                    )}

                    {orderStatusKey(order)==="refunded" && (
                      <div style={{ background:"#FFEBEE", borderRadius:12, padding:"12px", marginTop:8, fontSize:12, color:C.red }}>
                        <div style={{ fontWeight:700 }}>💸 返金済み</div>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:8, marginTop:12 }}>
                      {orderStatusKey(order)==="delivered" && (
                        <>
                          <button disabled={confirming} onClick={(e)=>{e.stopPropagation();handleConfirm(order.id);}} style={{
                            flex:2, padding:"11px", background:confirming?C.warmGray:C.green, border:"none", borderRadius:10,
                            color:"#fff", fontWeight:800, fontSize:13, cursor:confirming?"not-allowed":"pointer", fontFamily:"inherit"
                          }}>{confirming ? "処理中..." : "✅ 受取完了"}</button>
                          <button onClick={(e)=>{e.stopPropagation();setShowDispute(order);}} style={{
                            flex:1, padding:"11px", background:C.white, border:`1.5px solid ${C.red}`,
                            borderRadius:10, color:C.red, fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit"
                          }}>問題を報告</button>
                        </>
                      )}
                      {orderStatusKey(order)==="completed" && (
                        <button onClick={(e)=>{e.stopPropagation();setShowReview({...order, item:title, seller:sellerName});}} style={{
                          flex:1, padding:"11px", background:C.orange, border:"none", borderRadius:10,
                          color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit"
                        }}>⭐ レビューを書く</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dispute Modal */}
      {showDispute && <DisputeModal order={{...showDispute, item: showDispute.listing?.title || ""}} onClose={()=>setShowDispute(null)} onSubmit={async (orderId, reason, desc)=>{
        try {
          // status のみ更新（dispute_reason/dispute_status カラムは未実装）
          await supabase.from("orders").update({ status:"disputed", updated_at: new Date().toISOString() }).eq("id", orderId);
          alert("問題を報告しました。運営が確認次第対応いたします。");
          await loadOrders();
        } catch(e: any) { alert("エラー: "+e.message); }
        setShowDispute(null);
      }}/>}
      {showReview && <ReviewModal order={showReview} onClose={()=>setShowReview(null)} onSubmit={()=>setShowReview(null)} />}
    </div>
  );
};

// ── Sales Tab（出品者向け：自分が売った注文一覧、対応操作可） ──────────────
const MyListingsTab = ({ setPage }) => {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadListings = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (!error) setListings(data || []);
    setLoading(false);
  };

  useEffect(() => { loadListings(); }, [user?.id]);

  const filtered = listings.filter(l => {
    if (filter === "all") return true;
    if (filter === "draft") return l.status === "draft";
    if (filter === "pending") return l.status === "pending";
    if (filter === "approved") return l.status === "approved";
    if (filter === "sold_out") return l.status === "sold_out";
    if (filter === "rejected") return l.status === "rejected";
    return true;
  });

  const statusBadge = (s) => {
    const map = {
      draft:    { text:"💾 下書き",    bg:C.lightGray,    color:C.warmGray },
      pending:  { text:"⏳ 審査中",    bg:C.orangePale,   color:C.orange },
      approved: { text:"✅ 公開中",    bg:"#E8F5E9",      color:C.green },
      sold_out: { text:"🔴 売り切れ",  bg:"#FFEBEE",      color:C.red },
      rejected: { text:"❌ 非承認",    bg:"#FFEBEE",      color:C.red },
    };
    return map[s] || { text:s, bg:C.lightGray, color:C.warmGray };
  };

  const handleStockChange = async (listing, delta) => {
    if (busy) return;
    const current = listing.stock_quantity ?? 0;
    const newStock = Math.max(0, current + delta);
    setBusy(true);
    const { error } = await supabase.from("listings").update({ stock_quantity: newStock }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("在庫数変更に失敗: " + error.message); return; }
    await loadListings();
  };

  const handleEnableStock = async (listing) => {
    if (busy) return;
    const value = prompt("在庫数を入力してください（数字）", "10");
    if (value === null) return;
    const n = parseInt(value);
    if (isNaN(n) || n < 0) { alert("0以上の数字を入力してください"); return; }
    setBusy(true);
    const { error } = await supabase.from("listings").update({ stock_quantity: n }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("在庫管理開始に失敗: " + error.message); return; }
    await loadListings();
  };

  const handleDisableStock = async (listing) => {
    if (busy) return;
    if (!confirm("在庫管理を停止します。\n以降「在庫無制限（オーダーメイド型）」として扱われます。よろしいですか？")) return;
    setBusy(true);
    const { error } = await supabase.from("listings").update({ stock_quantity: null }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("在庫管理停止に失敗: " + error.message); return; }
    await loadListings();
  };

  const handlePublishDraft = async (listing) => {
    if (busy) return;
    if (!confirm("この下書きを公開申請しますか？\n（NGワードチェック・信頼度判定の上で、即時公開 or 審査待ちになります）")) return;
    setBusy(true);
    // status を pending に変更すると、auto_approve_listing トリガーが UPDATE では発火しないため
    // 一度 INSERT 用の関数を再利用するために、ここでは直接 status を pending にする
    const { error } = await supabase.from("listings").update({ status: "pending" }).eq("id", listing.id);
    setBusy(false);
    if (error) { alert("公開申請に失敗: " + error.message); return; }
    alert("公開申請しました。NGワードチェックや信頼度判定の上、近日中に公開されます。");
    await loadListings();
  };

  const handleDelete = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    const { error } = await supabase.from("listings").delete().eq("id", deleteTarget.id);
    setBusy(false);
    if (error) { alert("削除に失敗: " + error.message); return; }
    setDeleteTarget(null);
    await loadListings();
  };

  const counts = {
    all: listings.length,
    draft: listings.filter(l=>l.status==="draft").length,
    pending: listings.filter(l=>l.status==="pending").length,
    approved: listings.filter(l=>l.status==="approved").length,
    sold_out: listings.filter(l=>l.status==="sold_out").length,
    rejected: listings.filter(l=>l.status==="rejected").length,
  };

  return (
    <div>
      <div style={{ background:C.orangePale, borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:11, color:C.dark, lineHeight:1.6 }}>
        🐾 出品した商品の一覧です。下書きの編集・公開、在庫管理、削除ができます。
      </div>

      {/* フィルター */}
      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {[
          ["all","すべて",counts.all],
          ["draft","💾 下書き",counts.draft],
          ["pending","⏳ 審査中",counts.pending],
          ["approved","✅ 公開中",counts.approved],
          ["sold_out","🔴 売切",counts.sold_out],
          ["rejected","❌ 非承認",counts.rejected],
        ].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            flexShrink:0, padding:"6px 12px", border:`1.5px solid ${filter===v?C.orange:C.border}`,
            borderRadius:10, background:filter===v?C.orangePale:C.white,
            color:filter===v?C.orange:C.warmGray, fontSize:12, fontWeight:700,
            cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:4
          }}>{l} <span style={{ fontSize:10, opacity:0.7 }}>({c})</span></button>
        ))}
      </div>

      {/* リスト */}
      {loading ? (
        <div style={{ textAlign:"center", padding:40, color:C.warmGray, fontSize:13 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background:C.white, borderRadius:16, padding:"40px 20px", textAlign:"center", border:`1px dashed ${C.border}` }}>
          <div style={{ fontSize:48, marginBottom:8 }}>🐾</div>
          <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:6 }}>
            {filter === "all" ? "まだ出品がありません" : "該当する出品がありません"}
          </div>
          {filter === "all" && (
            <button onClick={()=>setPage("sell")} style={{
              marginTop:14, padding:"10px 24px", background:C.orange, border:"none", borderRadius:10,
              color:"#fff", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit"
            }}>＋ 出品する</button>
          )}
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(l => {
            const badge = statusBadge(l.status);
            const photo = Array.isArray(l.image_urls) && l.image_urls.length ? l.image_urls[0] : null;
            const stock = l.stock_quantity;
            const stockManaged = stock !== null && stock !== undefined;
            return (
              <div key={l.id} style={{ background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", gap:12 }}>
                  {photo ? (
                    <img src={photo} alt="" style={{ width:64, height:64, borderRadius:10, objectFit:"cover", flexShrink:0 }}/>
                  ) : (
                    <div style={{ width:64, height:64, borderRadius:10, background:C.lightGray, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>🐾</div>
                  )}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", gap:6, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:badge.bg, color:badge.color, fontWeight:800 }}>{badge.text}</span>
                      {stockManaged && (
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:stock===0?"#FFEBEE":"#E3F2FD", color:stock===0?C.red:C.blue, fontWeight:800 }}>
                          📦 在庫{stock}
                        </span>
                      )}
                      {!stockManaged && (
                        <span style={{ fontSize:10, padding:"2px 8px", borderRadius:6, background:C.lightGray, color:C.warmGray, fontWeight:700 }}>
                          ♾ 在庫管理なし
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:14, fontWeight:800, color:C.dark, marginBottom:4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.title}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:C.orange }}>¥{Number(l.price).toLocaleString()}</div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:12, paddingTop:10, borderTop:`1px solid ${C.border}` }}>
                  {/* 在庫管理 */}
                  {stockManaged ? (
                    <>
                      <button disabled={busy} onClick={()=>handleStockChange(l, -1)} style={miniBtnStyle(C.white, C.warmGray, busy)}>📦 在庫 −1</button>
                      <button disabled={busy} onClick={()=>handleStockChange(l, +1)} style={miniBtnStyle(C.white, C.green, busy)}>📦 在庫 +1</button>
                      <button disabled={busy} onClick={()=>handleDisableStock(l)} style={miniBtnStyle(C.white, C.warmGray, busy)}>♾ 在庫管理OFF</button>
                    </>
                  ) : (
                    <button disabled={busy} onClick={()=>handleEnableStock(l)} style={miniBtnStyle(C.white, C.blue, busy)}>📦 在庫管理ON</button>
                  )}
                  {/* 下書きの公開申請 (v3.1: 🚀 絵文字 + orange solid → 普通の line CTA) */}
                  {l.status === "draft" && (
                    <button disabled={busy} onClick={()=>handlePublishDraft(l)} style={miniBtnStyle(C.white, C.orange, busy)}>公開申請</button>
                  )}
                  {/* 編集 */}
                  <button disabled={busy} onClick={()=>setEditTarget(l)} style={miniBtnStyle(C.white, C.blue, busy)}>✏️ 編集</button>
                  {/* 削除 */}
                  <button disabled={busy} onClick={()=>setDeleteTarget(l)} style={miniBtnStyle(C.white, C.red, busy)}>🗑 削除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 編集モーダル */}
      {editTarget && (
        <ListingEditModal
          listing={editTarget}
          onClose={()=>setEditTarget(null)}
          onSaved={()=>{ setEditTarget(null); loadListings(); }}
        />
      )}

      {/* 削除確認モーダル */}
      {deleteTarget && (
        <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.5)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.white, borderRadius:20, padding:24, maxWidth:380, width:"100%" }}>
            <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>🗑</div>
            <h2 style={{ fontSize:16, fontWeight:900, color:C.dark, textAlign:"center", marginBottom:8 }}>本当に削除しますか？</h2>
            <p style={{ fontSize:12, color:C.warmGray, textAlign:"center", marginBottom:14, lineHeight:1.7 }}>
              「{deleteTarget.title}」<br/>
              ⚠️ この操作は取り消せません
            </p>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setDeleteTarget(null)} disabled={busy} style={{ flex:1, padding:"12px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit" }}>キャンセル</button>
              <button onClick={handleDelete} disabled={busy} style={{ flex:2, padding:"12px", background:busy?C.warmGray:C.red, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit" }}>{busy ? "削除中..." : "🗑 削除する"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── 小さなボタン用スタイル ──
// miniBtnStyle は utils/format.ts へ移動 (Phase 1 ③)

// ── 出品編集モーダル ─────────────────────────────────────────────────
// ListingEditModal は components/ListingEditModal.tsx へ移動 (Phase6 6b Step A 循環import回避)

const SalesTab = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState(false);

  const loadSales = async () => {
    if (!user?.id) return;
    setLoading(true);
    // 依頼書 #104 Phase B-2 (2026/6/3): shipping_fee / shipping_region / shipping_total 追加 (Phase A DDL 完了済)
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, fulfillment_status, escrow_status, transfer_status, amount, shipping_fee, shipping_region, shipping_total, created_at, delivered_at, completed_at, listing_id, buyer_id, shipping_address_id")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) { console.error("sales fetch error:", error); setLoading(false); return; }

    const listingIds = Array.from(new Set((data || []).map(o => o.listing_id).filter(Boolean)));
    const buyerIds = Array.from(new Set((data || []).map(o => o.buyer_id).filter(Boolean)));

    const [{ data: listings }, { data: buyers }] = await Promise.all([
      listingIds.length ? supabase.from("listings").select("id, title, image_urls, delivery_type").in("id", listingIds) : Promise.resolve({ data: [] }),
      buyerIds.length ? supabase.from("profiles").select("id, display_name").in("id", buyerIds) : Promise.resolve({ data: [] }),
    ]);

    const listingMap = new Map((listings || []).map(l => [l.id, l]));
    const buyerMap = new Map((buyers || []).map(b => [b.id, b]));

    const enriched = (data || []).map(o => ({
      ...o,
      listing: listingMap.get(o.listing_id),
      buyer: buyerMap.get(o.buyer_id),
    }));

    setSales(enriched);
    setLoading(false);
  };

  useEffect(() => { loadSales(); }, [user?.id]);

  // フィルタ：active=対応中(pending+working+delivered+disputed) / completed=完了 / cancelled=キャンセル系
  const filtered = sales.filter(o => {
    const k = orderStatusKey(o);
    if (filter === "active") return ["working", "delivered", "disputed"].includes(k);
    if (filter === "completed") return k === "completed";
    if (filter === "cancelled") return ["cancelled", "refunded"].includes(k);
    return true;
  });

  const statusLabel = (s) => {
    const map = { pending:{text:"決済待ち",bg:C.lightGray,color:C.warmGray}, working:{text:"作業中",bg:"#E3F2FD",color:C.blue}, delivered:{text:"納品済み",bg:"#FFF3E0",color:C.orange}, completed:{text:"取引完了",bg:C.greenPale,color:C.green}, disputed:{text:"異議中",bg:"#FFEBEE",color:C.red}, refunded:{text:"返金済み",bg:"#FFEBEE",color:C.red}, cancelled:{text:"キャンセル",bg:C.lightGray,color:C.warmGray} };
    return map[s] || {text:s,bg:C.lightGray,color:C.warmGray};
  };

  const startWork = async (orderId: string) => {
    if (!confirm("作業を開始しますか？")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("orders").update({ status: "working", updated_at: new Date().toISOString() }).eq("id", orderId);
      if (error) throw error;
      await loadSales();
    } catch(e: any) { alert("エラー: "+e.message); }
    finally { setBusy(false); }
  };

  const markDelivered = async (sale: any) => {
    if (!confirm("納品完了として通知しますか？\n購入者が受取確認したら売上が支払われます。")) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      // ②-1(A): 納品時に自動完了時刻をセット (設定値 auto_complete_hours / default 72h)。
      // ⚠️ 値は配信時点で確定 (買い手の確認期限を後から動かさない)。送金本体には触れない。
      const { data: acRow } = await supabase.from("platform_settings").select("value").eq("key", "auto_complete_hours").maybeSingle();
      const acHours = parseInt(acRow?.value || "72", 10) || 72;
      const autoCompleteAt = new Date(Date.now() + acHours * 3600 * 1000).toISOString();
      const { error } = await supabase.from("orders").update({ status: "delivered", fulfillment_status: "delivered", delivered_at: now, auto_complete_at: autoCompleteAt, updated_at: now }).eq("id", sale.id);
      if (error) throw error;
      // ②-2: 買い手へ納品通知メール (既存 delivery_notice テンプレ再利用 / best-effort=失敗してもステータス更新は成立)
      // ⚠️ 送金ロジックには一切触れない。通知のみ。
      try {
        const { data: me } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
        await supabase.functions.invoke("send-email", {
          body: {
            type: "delivery_notice",
            user_id: sale.buyer_id,
            data: {
              user_name: sale.buyer?.display_name || "ご購入者",
              seller_name: me?.display_name || "出品者",
              order_number: sale.order_number || "",
              listing_title: sale.listing?.title || "(商品)",
              order_url: "https://qocca.pet/mypage",
            },
          },
        });
      } catch (mailErr) { console.error("delivery notice email failed (非致命):", mailErr); }
      await loadSales();
    } catch(e: any) { alert("エラー: "+e.message); }
    finally { setBusy(false); }
  };

  const formatDate = (s?: string) => s ? new Date(s).toLocaleDateString("ja-JP").replace(/\//g, ".") : "";
  const photoUrl = (l?: any) => Array.isArray(l?.image_urls) && l.image_urls.length ? l.image_urls[0] : null;

  return (
    <div>
      <div style={{ background:C.orangePale, borderRadius:12, padding:"10px 14px", marginBottom:14, fontSize:11, color:C.dark, lineHeight:1.6 }}>
        💡 受けた注文の管理画面です。作業状況を更新すると購入者に通知されます。
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto" }}>
        {[["active","対応中"],["completed","完了"],["cancelled","キャンセル"],["all","すべて"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            flexShrink:0, padding:"6px 14px", border:`1.5px solid ${filter===v?C.orange:C.border}`,
            borderRadius:10, background:filter===v?C.orangePale:C.white,
            color:filter===v?C.orange:C.warmGray, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit"
          }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center", padding:"48px 20px", color:C.warmGray, fontSize:13 }}>読み込み中…</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px" }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🛍️</div>
          <div style={{ fontWeight:700, color:C.warmGray }}>該当する販売がありません</div>
          <div style={{ fontSize:11, color:C.warmGray, marginTop:6 }}>注文が入るとここに表示されます</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filtered.map(sale => {
            const st = statusLabel(orderStatusKey(sale));
            const title = sale.listing?.title || "（削除された商品）";
            const buyerName = sale.buyer?.display_name || "—";
            const img = photoUrl(sale.listing);
            const isShipping = sale.listing?.delivery_type === "shipping";
            return (
              <div key={sale.id} onClick={()=>setSelected(selected?.id===sale.id?null:sale)} style={{
                background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", cursor:"pointer"
              }}>
                <div style={{ padding:"16px", display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ width:48, height:48, borderRadius:12, background:img?`url(${img}) center/cover`:C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>
                    {!img && "🛍️"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:C.dark, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</span>
                      <span style={{ background:st.bg, color:st.color, fontSize:10, fontWeight:700, padding:"3px 8px", borderRadius:6, flexShrink:0 }}>{st.text}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.warmGray }}>
                      購入者: {buyerName} · {formatDate(sale.created_at)}
                      {sale.shipping_region && <span style={{ marginLeft:6, color:C.orange, fontWeight:700 }}>· 📍 {sale.shipping_region}</span>}
                    </div>
                    {/* 依頼書 #104 Phase B-2 (2026/6/3): 送料込み売上 (shipping_total > 0 なら shipping_fee 内訳表示) */}
                    <div style={{ fontSize:15, fontWeight:700, color:C.dark, marginTop:4 }}>
                      ¥{Number(sale.shipping_total || sale.amount || 0).toLocaleString()}
                      {(sale.shipping_fee || 0) > 0 && (
                        <span style={{ fontSize:11, fontWeight:400, color:C.warmGray, marginLeft:6 }}>(うち送料 ¥{Number(sale.shipping_fee).toLocaleString()})</span>
                      )}
                    </div>
                  </div>
                </div>

                {selected?.id===sale.id && (
                  <div style={{ borderTop:`1px solid ${C.border}`, padding:"16px", background:C.lightGray }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.warmGray, marginBottom:4 }}>注文番号: {sale.id.slice(0, 8)}</div>
                    <OrderStatusBar status={orderStatusKey(sale)}/>

                    {isShipping && sale.shipping_address_id && (
                      <div style={{ background:C.orangePale, borderRadius:12, padding:"10px 14px", marginTop:10, fontSize:11, color:C.dark, lineHeight:1.6 }}>
                        🔒 配送先住所が登録されています。<br/>
                        メッセージタブの取引メッセージから詳細を確認できます。<br/>
                        <span style={{ fontSize:10, color:C.warmGray }}>※ 取引完了後30日で自動削除されます</span>
                      </div>
                    )}

                    <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                      {sale.payment_status==="awaiting_payment" && (
                        <div style={{
                          flex:1, minWidth:140, padding:"11px", background:C.lightGray, borderRadius:10,
                          color:C.warmGray, fontWeight:700, fontSize:12, textAlign:"center", fontFamily:"inherit"
                        }}>⏳ 購入者の決済待ち（決済完了後に作業を開始できます）</div>
                      )}
                      {orderStatusKey(sale)==="working" && (
                        <button disabled={busy} onClick={(e)=>{e.stopPropagation();markDelivered(sale);}} style={{
                          flex:1, minWidth:140, padding:"11px", background:C.orange, border:"none", borderRadius:10,
                          color:"#fff", fontWeight:800, fontSize:13, cursor:busy?"not-allowed":"pointer", fontFamily:"inherit", opacity:busy?0.6:1
                        }}>📦 納品完了として通知</button>
                      )}
                      {orderStatusKey(sale)==="delivered" && (
                        <div style={{ flex:1, padding:"11px", background:"#FFF3E0", borderRadius:10, color:C.orange, fontWeight:700, fontSize:12, textAlign:"center" }}>
                          購入者の受取確認待ち（72時間後に自動完了）
                        </div>
                      )}
                      {orderStatusKey(sale)==="completed" && (
                        <div style={{ flex:1, padding:"11px", background:C.greenPale, borderRadius:10, color:C.green, fontWeight:700, fontSize:12, textAlign:"center" }}>
                          ✅ 取引完了 · 売上反映済み
                        </div>
                      )}
                      {orderStatusKey(sale)==="disputed" && (
                        <div style={{ flex:1, padding:"11px", background:"#FFEBEE", borderRadius:10, color:C.red, fontWeight:700, fontSize:12, textAlign:"center" }}>
                          ⚠️ 異議申し立て中（運営にて対応中）
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Dispute Modal ─────────────────────────────────────────────────────────
const DisputeModal = ({ order, onClose, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [desc, setDesc] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = () => {
    onSubmit(order.id, reason, desc || DISPUTE_REASONS.find(r=>r.id===reason)?.label);
    setDone(true);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:C.white, borderRadius:"24px 24px 0 0", padding:"28px 20px", width:"100%", maxWidth:500, maxHeight:"80vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        {done ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>異議を受け付けました</div>
            <div style={{ fontSize:13, color:C.warmGray, marginBottom:4 }}>エスクローは保留中です。48時間以内にサポートからご連絡いたします。</div>
            <div style={{ background:C.orangePale, borderRadius:10, padding:"10px", margin:"12px 0", fontSize:12, color:C.orange }}>自動メッセージ: 出品者にも通知が送信されました。</div>
            <button onClick={onClose} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>閉じる</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.dark }}>⚠️ 問題を報告</div>
              <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:C.warmGray }}>✕</button>
            </div>
            <div style={{ background:C.lightGray, borderRadius:12, padding:"12px", marginBottom:16, fontSize:12, color:C.dark }}>
              <div style={{ fontWeight:700 }}>{order.item}</div>
              <div style={{ color:C.warmGray, marginTop:2 }}>{order.id} · ¥{order.price.toLocaleString()}</div>
            </div>

            {step===1 && (
              <>
                <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:12 }}>理由を選択してください</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {DISPUTE_REASONS.map(r=>(
                    <button key={r.id} onClick={()=>setReason(r.id)} style={{
                      padding:"12px 14px", border:`2px solid ${reason===r.id?C.orange:C.border}`,
                      borderRadius:12, background:reason===r.id?C.orangePale:C.white,
                      color:reason===r.id?C.orange:C.dark, fontWeight:700, fontSize:13,
                      cursor:"pointer", textAlign:"left", fontFamily:"inherit",
                      display:"flex", alignItems:"center", gap:10
                    }}><span style={{ fontSize:18 }}>{r.icon}</span>{r.label}</button>
                  ))}
                </div>
                <button onClick={()=>reason&&setStep(2)} disabled={!reason} style={{
                  width:"100%", padding:"13px", background:reason?C.orange:C.border,
                  border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14,
                  cursor:reason?"pointer":"not-allowed", fontFamily:"inherit"
                }}>次へ →</button>
              </>
            )}

            {step===2 && (
              <>
                <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:12 }}>詳細を教えてください</div>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={4}
                  placeholder="具体的にどのような問題がありましたか？（写真があれば添付してください）"
                  style={{ width:"100%", padding:"12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", resize:"vertical", boxSizing:"border-box", marginBottom:12 }}
                />
                <div style={{ background:C.orangePale, borderRadius:10, padding:"10px", marginBottom:16, fontSize:11, color:C.orange, lineHeight:1.6 }}>
                  🔒 エスクローは自動的に保留されます。出品者に48時間の回答期限が設定されます。回答がない場合は自動的に返金されます。
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={()=>setStep(1)} style={{ flex:1, padding:"13px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:12, color:C.warmGray, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>← 戻る</button>
                  <button onClick={handleSubmit} style={{ flex:2, padding:"13px", background:C.red, border:"none", borderRadius:12, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>⚠️ 異議を申し立てる</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ── Messages Tab ──────────────────────────────────────────────────────────
// ── 連絡先検出フィルター ──────────────────────────────────────────────────
// 取引前のメッセージで連絡先交換を防ぐ
// detectContacts / detectNGWords は utils/moderation.ts へ移動 (Phase 1 ④) ※決済防御の心臓部

// ── 取引メッセージタブ（OrderMessagesTab） ────────────────────────────────
const OrderMessagesTab = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [shippingAddr, setShippingAddr] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<{ types: string[]; original: string; masked: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConvos = async () => {
    if (!user) return;
    setLoading(true);
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, buyer_id, seller_id, listing_id, created_at")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (!orders) { setLoading(false); return; }
    const partnerIds = [...new Set(orders.map(o => o.buyer_id === user.id ? o.seller_id : o.buyer_id))];
    const listingIds = [...new Set(orders.map(o => o.listing_id).filter(Boolean))];
    const [{ data: profs }, { data: lists }, { data: lastMsgs }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, avatar_url").in("id", partnerIds),
      listingIds.length ? supabase.from("listings").select("id, title").in("id", listingIds) : Promise.resolve({ data: [] }),
      supabase.from("order_messages").select("order_id, content, created_at, recipient_id, is_read").in("order_id", orders.map(o=>o.id)).order("created_at", { ascending: false }),
    ]);
    const profMap = Object.fromEntries((profs||[]).map(p=>[p.id, p]));
    const listMap = Object.fromEntries((lists||[]).map(l=>[l.id, l]));
    const lastMsgMap: Record<string, any> = {};
    const unreadMap: Record<string, number> = {};
    (lastMsgs || []).forEach((m:any) => {
      if (!lastMsgMap[m.order_id]) lastMsgMap[m.order_id] = m;
      if (m.recipient_id === user.id && !m.is_read) {
        unreadMap[m.order_id] = (unreadMap[m.order_id] || 0) + 1;
      }
    });
    const list = orders.map(o => {
      const partnerId = o.buyer_id === user.id ? o.seller_id : o.buyer_id;
      const partner = profMap[partnerId];
      const listing = listMap[o.listing_id];
      const lastMsg = lastMsgMap[o.id];
      return {
        order_id: o.id,
        status: o.status,
        seller_id: o.seller_id,
        buyer_id: o.buyer_id,
        partner_id: partnerId,
        partner_name: partner?.display_name || "ユーザー",
        partner_avatar: partner?.avatar_url,
        listing_title: listing?.title || "(商品名なし)",
        last_msg: lastMsg?.content || "まだメッセージがありません",
        last_msg_date: lastMsg?.created_at,
        unread: unreadMap[o.id] || 0,
      };
    });
    setConvos(list);
    setLoading(false);
  };

  useEffect(() => { fetchConvos(); }, [user?.id]);

  const fetchMessages = async (orderId:string) => {
    const { data } = await supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at", { ascending: true });
    setMessages(data || []);
    // 配送先住所を取得（出品者向けに表示するため）
    const { data: addr } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("order_id", orderId)
      .is("delete_at", null)
      .maybeSingle();
    if (!addr) {
      // 削除予定があるかも確認（30日以内なら表示）
      const { data: addrWithDelete } = await supabase
        .from("shipping_addresses")
        .select("*")
        .eq("order_id", orderId)
        .gt("delete_at", new Date().toISOString())
        .maybeSingle();
      setShippingAddr(addrWithDelete);
    } else {
      setShippingAddr(addr);
    }
    if (user) {
      await supabase.from("order_messages").update({ is_read: true }).eq("order_id", orderId).eq("recipient_id", user.id).eq("is_read", false);
    }
  };

  useEffect(() => { if (selected) fetchMessages(selected.order_id); }, [selected?.order_id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !selected || sending) return;
    const detection = detectContacts(input);
    const isCompleted = selected.status === "completed";
    if (detection.found && !isCompleted) {
      if (warning && warning.original === input) {
        setSending(true);
        await supabase.from("order_messages").insert({
          order_id: selected.order_id, sender_id: user.id, recipient_id: selected.partner_id,
          content: warning.masked, has_warning: true,
        });
        setInput(""); setWarning(null);
        await fetchMessages(selected.order_id);
        setSending(false);
        return;
      }
      setWarning({ types: detection.types, original: input, masked: detection.masked });
      return;
    }
    setSending(true);
    await supabase.from("order_messages").insert({
      order_id: selected.order_id, sender_id: user.id, recipient_id: selected.partner_id,
      content: input, has_warning: false,
    });
    setInput(""); setWarning(null);
    await fetchMessages(selected.order_id);
    setSending(false);
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>;

  return (
    <div>
      {!selected ? (
        convos.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>💬</div>
            <div>取引メッセージはまだありません</div>
            <div style={{ fontSize:11, marginTop:6 }}>商品を購入すると、ここに取引相手とのメッセージが表示されます</div>
          </div>
        ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {convos.map(c=>(
            <button key={c.order_id} onClick={()=>setSelected(c)} style={{
              background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}`,
              cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12, width:"100%"
            }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background: c.partner_avatar ? `url(${c.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:C.orange, flexShrink:0 }}>{!c.partner_avatar && (c.partner_name||"?").charAt(0).toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{c.partner_name}</span>
                  <span style={{ fontSize:10, color:C.warmGray }}>{c.last_msg_date ? new Date(c.last_msg_date).toLocaleDateString("ja-JP") : ""}</span>
                </div>
                <div style={{ fontSize:11, color:C.warmGray, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.listing_title} · {c.status === "completed" ? "✅ 取引完了" : c.status === "working" ? "🔧 作業中" : c.status === "delivered" ? "📦 納品済み" : "🛒 取引中"}</div>
                <div style={{ fontSize:12, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.last_msg}</div>
              </div>
              {c.unread>0 && <div style={{ width:20, height:20, borderRadius:"50%", background:C.orange, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.unread}</div>}
            </button>
          ))}
        </div>
        )
      ) : (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>{setSelected(null); setShippingAddr(null); setWarning(null); setInput("");}} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.orange }}>←</button>
            <div style={{ width:32, height:32, borderRadius:"50%", background: selected.partner_avatar ? `url(${selected.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0 }}>{!selected.partner_avatar && (selected.partner_name||"?").charAt(0).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{selected.partner_name}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{selected.listing_title}</div>
            </div>
          </div>

          {/* 配送先住所バナー（出品者にのみ表示） */}
          {shippingAddr && selected.seller_id === user?.id && (
            <div style={{ padding:"12px 16px", background:"#FFF8F0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>📦 配送先住所</span>
                {shippingAddr.delete_at && (
                  <span style={{ fontSize:9, padding:"2px 6px", background:"#FFE0B2", color:"#E65100", borderRadius:4, fontWeight:700 }}>
                    {Math.ceil((new Date(shippingAddr.delete_at).getTime() - Date.now()) / (1000*60*60*24))}日後に自動削除
                  </span>
                )}
              </div>
              <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
                <div><strong style={{ color:C.dark }}>{shippingAddr.recipient_name}</strong> 様</div>
                <div>〒{shippingAddr.postal_code}</div>
                <div>{shippingAddr.prefecture}{shippingAddr.city}{shippingAddr.address_line}</div>
                <div>📱 {shippingAddr.phone}</div>
              </div>
              <div style={{ fontSize:10, color:C.warmGray, marginTop:6, padding:"6px 8px", background:"#FFF", borderRadius:6 }}>
                ⚠️ この情報は配送目的のみに使用してください。第三者への漏洩は規約違反となります。
              </div>
            </div>
          )}

          {selected.status !== "completed" && (
            <div style={{ padding:"8px 16px", background:"#FFF8E1", borderBottom:`1px solid ${C.border}`, fontSize:11, color:"#996200", display:"flex", alignItems:"center", gap:6 }}>
              ⚠️ 取引完了前は外部連絡先（電話・メール・SNS等）の交換は禁止されています
            </div>
          )}

          <div style={{ padding:"16px", minHeight:250, maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, background:"#FAFAF8" }}>
            {messages.length === 0 && (
              <div style={{ textAlign:"center", color:C.warmGray, fontSize:12, padding:"20px 0" }}>まだメッセージがありません<br/>最初のメッセージを送ってみましょう</div>
            )}
            {messages.map((m)=>(
              <div key={m.id} style={{ display:"flex", justifyContent:m.sender_id===user?.id?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"75%", padding:"10px 14px", borderRadius:14,
                  background:m.sender_id===user?.id?C.orange:"#F0EFEC",
                  color:m.sender_id===user?.id?"#fff":C.dark,
                  borderBottomRightRadius:m.sender_id===user?.id?4:14,
                  borderBottomLeftRadius:m.sender_id===user?.id?14:4,
                }}>
                  <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.content}</div>
                  <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{new Date(m.created_at).toLocaleString("ja-JP", { hour:"2-digit", minute:"2-digit", month:"numeric", day:"numeric" })}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {warning && (
            <div style={{ padding:"12px 16px", background:"#FFE5E5", borderTop:`1px solid #FFB3B3` }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#C62828", marginBottom:6 }}>⚠️ 連絡先が含まれています ({warning.types.join(", ")})</div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>取引完了前のサイト外連絡は規約違反です。<br/>取引完了後はそのまま送信できます。</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setWarning(null)} style={{ flex:1, padding:"8px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.dark }}>修正する</button>
                <button onClick={handleSend} style={{ flex:1, padding:"8px", background:"#FFB3B3", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>***でマスク送信</button>
              </div>
            </div>
          )}

          <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
            <input
              value={input}
              onChange={e=>{setInput(e.target.value); if (warning) setWarning(null);}}
              onKeyDown={e=>{ if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); handleSend(); } }}
              placeholder="メッセージを入力..."
              disabled={sending}
              style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
            <button onClick={handleSend} disabled={!input.trim() || sending} style={{ padding:"10px 16px", background: !input.trim() || sending ? "#ccc" : C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor: !input.trim() || sending ? "not-allowed" : "pointer", fontFamily:"inherit" }}>{sending ? "..." : "送信"}</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── DMタブ（DirectMessagesTab） ─────────────────────────────────────────
const DirectMessagesTab = () => {
  const { user } = useAuth();
  const [convos, setConvos] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<{ types: string[]; original: string; masked: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // DM会話一覧を取得（自分が関わるDM）
  const fetchConvos = async () => {
    if (!user) return;
    setLoading(true);
    // 自分が関わるDMをすべて取得
    const { data: dms } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    if (!dms) { setLoading(false); return; }

    // 会話相手ごとにグループ化（最新のメッセージだけ残す）
    const convoMap: Record<string, any> = {};
    for (const m of dms) {
      const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      if (!convoMap[partnerId]) {
        convoMap[partnerId] = { partner_id: partnerId, last_msg: m.content, last_msg_date: m.created_at, unread: 0 };
      }
      if (m.recipient_id === user.id && !m.is_read) convoMap[partnerId].unread++;
    }
    const partnerIds = Object.keys(convoMap);
    if (partnerIds.length === 0) { setConvos([]); setLoading(false); return; }

    const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", partnerIds);
    const profMap = Object.fromEntries((profs||[]).map(p=>[p.id, p]));

    // 自分が誰をフォローしているか
    const { data: myFollowing } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
    const followingSet = new Set((myFollowing||[]).map((f:any)=>f.following_id));

    const list = partnerIds.map(pid => ({
      ...convoMap[pid],
      partner_name: profMap[pid]?.display_name || "ユーザー",
      partner_avatar: profMap[pid]?.avatar_url,
      is_following: followingSet.has(pid),
    })).sort((a,b) => new Date(b.last_msg_date).getTime() - new Date(a.last_msg_date).getTime());

    setConvos(list);
    setLoading(false);
  };

  useEffect(() => { fetchConvos(); }, [user?.id]);

  // プロフィールページからの「💬 メッセージ」イベントを受信
  useEffect(() => {
    const handleOpenDM = async (e: any) => {
      const partnerId = e.detail?.partnerId;
      if (!partnerId || !user) return;
      // プロフィール取得
      const { data: prof } = await supabase.from("profiles").select("id, display_name, avatar_url").eq("id", partnerId).single();
      // フォロー状況確認
      const { data: fol } = await supabase.from("follows").select("id").eq("follower_id", user.id).eq("following_id", partnerId).maybeSingle();
      setSelected({
        partner_id: partnerId,
        partner_name: prof?.display_name || "ユーザー",
        partner_avatar: prof?.avatar_url,
        is_following: !!fol,
        last_msg: "",
        last_msg_date: new Date().toISOString(),
        unread: 0,
      });
    };
    window.addEventListener("openDM", handleOpenDM);
    return () => window.removeEventListener("openDM", handleOpenDM);
  }, [user?.id]);

  const fetchMessages = async (partnerId:string) => {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},recipient_id.eq.${partnerId}),and(sender_id.eq.${partnerId},recipient_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages(data || []);
    await supabase.from("direct_messages").update({ is_read: true }).eq("sender_id", partnerId).eq("recipient_id", user.id).eq("is_read", false);
  };

  useEffect(() => { if (selected) fetchMessages(selected.partner_id); }, [selected?.partner_id]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !user || !selected || sending) return;
    if (!selected.is_following) {
      alert("メッセージを送るには、まず相手をフォローしてください");
      return;
    }
    // 相互フォローか確認
    const { data: mutual } = await supabase.from("follows").select("id").eq("follower_id", selected.partner_id).eq("following_id", user.id).maybeSingle();
    const isMutual = !!mutual;

    const detection = detectContacts(input);
    // 一方フォローのみで連絡先検出 → 警告
    if (detection.found && !isMutual) {
      if (warning && warning.original === input) {
        setSending(true);
        const { error } = await supabase.from("direct_messages").insert({
          sender_id: user.id, recipient_id: selected.partner_id,
          content: warning.masked, has_warning: true, is_mutual: false,
        });
        if (error) alert("送信に失敗しました: " + error.message);
        setInput(""); setWarning(null);
        await fetchMessages(selected.partner_id);
        setSending(false);
        return;
      }
      setWarning({ types: detection.types, original: input, masked: detection.masked });
      return;
    }

    // 通常送信（相互フォローなら連絡先OK）
    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({
      sender_id: user.id, recipient_id: selected.partner_id,
      content: input, has_warning: false, is_mutual: isMutual,
    });
    if (error) alert("送信に失敗しました: " + error.message);
    setInput(""); setWarning(null);
    await fetchMessages(selected.partner_id);
    setSending(false);
  };

  if (loading) return <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>読み込み中...</div>;

  return (
    <div>
      {!selected ? (
        convos.length === 0 ? (
          <div style={{ padding:40, textAlign:"center", color:C.warmGray, fontSize:13 }}>
            <div style={{ fontSize:36, marginBottom:12 }}>✉️</div>
            <div>DMはまだありません</div>
            <div style={{ fontSize:11, marginTop:6 }}>気になる出品者のプロフィールから<br/>「💬 メッセージ」でDMを送れます</div>
          </div>
        ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {convos.map(c=>(
            <button key={c.partner_id} onClick={()=>setSelected(c)} style={{
              background:C.white, borderRadius:14, padding:"14px", border:`1px solid ${C.border}`,
              cursor:"pointer", textAlign:"left", fontFamily:"inherit", display:"flex", alignItems:"center", gap:12, width:"100%"
            }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background: c.partner_avatar ? `url(${c.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:C.orange, flexShrink:0 }}>{!c.partner_avatar && (c.partner_name||"?").charAt(0).toUpperCase()}</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:800, color:C.dark }}>{c.partner_name}</span>
                  <span style={{ fontSize:10, color:C.warmGray }}>{new Date(c.last_msg_date).toLocaleDateString("ja-JP")}</span>
                </div>
                <div style={{ fontSize:12, color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.last_msg}</div>
              </div>
              {c.unread>0 && <div style={{ width:20, height:20, borderRadius:"50%", background:C.orange, color:"#fff", fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.unread}</div>}
            </button>
          ))}
        </div>
        )
      ) : (
        <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={()=>{setSelected(null); setWarning(null); setInput("");}} style={{ background:"none", border:"none", cursor:"pointer", fontSize:18, color:C.orange }}>←</button>
            <div style={{ width:32, height:32, borderRadius:"50%", background: selected.partner_avatar ? `url(${selected.partner_avatar}) center/cover` : C.orangePale, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:C.orange, flexShrink:0 }}>{!selected.partner_avatar && (selected.partner_name||"?").charAt(0).toUpperCase()}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:14, fontWeight:800, color:C.dark }}>{selected.partner_name}</div>
              <div style={{ fontSize:10, color:C.warmGray }}>{selected.is_following ? "フォロー中" : "未フォロー"}</div>
            </div>
          </div>

          <div style={{ padding:"16px", minHeight:250, maxHeight:400, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, background:"#FAFAF8" }}>
            {messages.length === 0 && (
              <div style={{ textAlign:"center", color:C.warmGray, fontSize:12, padding:"20px 0" }}>まだメッセージがありません</div>
            )}
            {messages.map((m)=>(
              <div key={m.id} style={{ display:"flex", justifyContent:m.sender_id===user?.id?"flex-end":"flex-start" }}>
                <div style={{
                  maxWidth:"75%", padding:"10px 14px", borderRadius:14,
                  background:m.sender_id===user?.id?C.orange:"#F0EFEC",
                  color:m.sender_id===user?.id?"#fff":C.dark,
                  borderBottomRightRadius:m.sender_id===user?.id?4:14,
                  borderBottomLeftRadius:m.sender_id===user?.id?14:4,
                }}>
                  <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{m.content}</div>
                  <div style={{ fontSize:9, marginTop:4, opacity:0.5, textAlign:"right" }}>{new Date(m.created_at).toLocaleString("ja-JP", { hour:"2-digit", minute:"2-digit", month:"numeric", day:"numeric" })}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef}/>
          </div>

          {warning && (
            <div style={{ padding:"12px 16px", background:"#FFE5E5", borderTop:`1px solid #FFB3B3` }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#C62828", marginBottom:6 }}>⚠️ 連絡先が含まれています ({warning.types.join(", ")})</div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8, lineHeight:1.5 }}>相互フォロー（お互いをフォロー）すれば連絡先交換できます。<br/>今は一方フォローなのでマスク送信になります。</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>setWarning(null)} style={{ flex:1, padding:"8px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.dark }}>修正する</button>
                <button onClick={handleSend} style={{ flex:1, padding:"8px", background:"#FFB3B3", border:"none", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#fff" }}>***でマスク送信</button>
              </div>
            </div>
          )}

          {!selected.is_following ? (
            <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, background:"#FFF8E1", textAlign:"center" }}>
              <div style={{ fontSize:12, color:"#996200" }}>このユーザーをフォローするとメッセージを送信できます</div>
            </div>
          ) : (
            <div style={{ padding:"12px 16px", borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input
                value={input}
                onChange={e=>{setInput(e.target.value); if (warning) setWarning(null);}}
                onKeyDown={e=>{ if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); handleSend(); } }}
                placeholder="メッセージを入力..."
                disabled={sending}
                style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }}/>
              <button onClick={handleSend} disabled={!input.trim() || sending} style={{ padding:"10px 16px", background: !input.trim() || sending ? "#ccc" : C.orange, border:"none", borderRadius:10, color:"#fff", fontWeight:800, fontSize:13, cursor: !input.trim() || sending ? "not-allowed" : "pointer", fontFamily:"inherit" }}>{sending ? "..." : "送信"}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── メッセージタブ（取引メッセージ + DMの切り替え） ──────────────────────
const MessagesTab = () => {
  const [subTab, setSubTab] = useState<"order" | "dm">("order");
  useEffect(() => {
    const handleOpenDM = () => setSubTab("dm");
    window.addEventListener("openDM", handleOpenDM);
    return () => window.removeEventListener("openDM", handleOpenDM);
  }, []);
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:14, background:C.lightGray, borderRadius:12, padding:4 }}>
        <button onClick={()=>setSubTab("order")} style={{ flex:1, padding:"8px", background: subTab === "order" ? C.white : "transparent", border:"none", borderRadius:8, fontSize:12, fontWeight:800, color: subTab === "order" ? C.orange : C.warmGray, cursor:"pointer", fontFamily:"inherit", boxShadow: subTab === "order" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>📦 取引</button>
        <button onClick={()=>setSubTab("dm")} style={{ flex:1, padding:"8px", background: subTab === "dm" ? C.white : "transparent", border:"none", borderRadius:8, fontSize:12, fontWeight:800, color: subTab === "dm" ? C.orange : C.warmGray, cursor:"pointer", fontFamily:"inherit", boxShadow: subTab === "dm" ? "0 2px 4px rgba(0,0,0,0.05)" : "none" }}>✉️ DM</button>
      </div>
      {subTab === "order" ? <OrderMessagesTab/> : <DirectMessagesTab/>}
    </div>
  );
};


// ── Notifications Tab ─────────────────────────────────────────────────────
const NotificationsTab = () => {
  // 通知DBは未実装。実装までは空状態で運用。
  return (
    <div style={{ textAlign:"center", padding:"48px 20px" }}>
      <div style={{ fontSize:40, marginBottom:8 }}>🔔</div>
      <div style={{ fontWeight:700, color:C.warmGray, marginBottom:6 }}>新しい通知はありません</div>
      <div style={{ fontSize:11, color:C.warmGray, lineHeight:1.6 }}>
        重要なお知らせは登録メールアドレス宛にお送りしています。<br/>
        メッセージタブの取引メッセージ・DMもご確認ください。
      </div>
    </div>
  );
};

// ── Support Tab ───────────────────────────────────────────────────────────
const SupportTab = () => {
  // お問い合わせ表記との整合性確保のためのサポートタブ
  const supportEmail = "support@qocca.pet";
  return (
    <div>
      <div style={{ fontSize:14, fontWeight:700, color:C.dark, marginBottom:14 }}>🎧 サポート</div>

      {/* ヘルプセンター */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>📚 ヘルプセンター</div>
        <div style={{ fontSize:12, color:"#555", lineHeight:1.7, marginBottom:14 }}>
          よくあるご質問や使い方をまとめています。お問い合わせの前にご確認ください。
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:8 }}>
          <a href="/help/getting-started" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.cream, borderRadius:10, textDecoration:"none", color:C.dark, fontSize:12, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>📝</span>
            <span style={{ flex:1 }}>出品の始め方</span>
            <span style={{ color:C.orange }}>→</span>
          </a>
          <a href="/help/stripe-connect" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.cream, borderRadius:10, textDecoration:"none", color:C.dark, fontSize:12, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>💳</span>
            <span style={{ flex:1 }}>Stripe Connect 登録ガイド</span>
            <span style={{ color:C.orange }}>→</span>
          </a>
          <a href="/help/buying" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", background:C.cream, borderRadius:10, textDecoration:"none", color:C.dark, fontSize:12, fontWeight:700 }}>
            <span style={{ fontSize:18 }}>🛒</span>
            <span style={{ flex:1 }}>購入ガイド</span>
            <span style={{ color:C.orange }}>→</span>
          </a>
          <a href="/help" style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"8px 14px", color:C.warmGray, fontSize:11, fontWeight:700, textDecoration:"none" }}>
            ヘルプ一覧を見る →
          </a>
        </div>
      </div>

      {/* メッセージ機能（準備中） */}
      <div style={{ background:"#FFF8E7", borderRadius:16, border:`1px solid #F0D898`, padding:"16px 20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:"#8B6914", marginBottom:6 }}>💬 アプリ内サポートメッセージ</div>
        <div style={{ fontSize:12, color:"#8B6914", lineHeight:1.7 }}>
          現在、こちらの機能は準備中です。<br/>
          お問い合わせは下記の方法でお願いいたします。
        </div>
      </div>

      {/* メールでお問い合わせ */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>📧 メールでお問い合わせ</div>
        <div style={{ fontSize:12, color:"#555", lineHeight:1.7, marginBottom:14 }}>
          ヘルプで解決しない場合はメールでお問い合わせください。<br/>
          件名に「お問い合わせ」と注文番号（お持ちの場合）をご記入ください。
        </div>
        <a href={`mailto:${supportEmail}?subject=Qocca%20%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B`}
          style={{ display:"inline-block", padding:"10px 18px", background:C.orange, color:"#fff", borderRadius:10, fontWeight:800, fontSize:13, textDecoration:"none" }}>
          {supportEmail}
        </a>
      </div>

      {/* Instagram DM */}
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"20px", marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.dark, marginBottom:10 }}>📷 Instagram DM</div>
        <div style={{ fontSize:12, color:"#555", lineHeight:1.7, marginBottom:14 }}>
          Instagram からもお問い合わせいただけます。
        </div>
        <a href="https://www.instagram.com/qocca_pet/" target="_blank" rel="noopener noreferrer"
          style={{ display:"inline-block", padding:"10px 18px", background:"#E4405F", color:"#fff", borderRadius:10, fontWeight:800, fontSize:13, textDecoration:"none" }}>
          @qocca_pet
        </a>
      </div>

      {/* 対応時間 */}
      <div style={{ background:C.cream, borderRadius:12, padding:"14px 18px", fontSize:12, color:C.warmGray, lineHeight:1.7 }}>
        <strong style={{ color:C.dark }}>📅 対応時間</strong><br/>
        平日 10:00〜18:00（土日祝休み）<br/>
        通常 48 時間以内にご返信いたします。<br/>
        ※ 緊急の不正利用報告は 24 時間受付
      </div>
    </div>
  );
};
