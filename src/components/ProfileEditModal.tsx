import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

const C = {
  orange: "#F5A94A",
  orangePale: "#FFF3E0",
  dark: "#333",
  warmGray: "#888",
  border: "#E8E8E8",
  white: "#fff",
  cream: "#FFF9F0",
  danger: "#E57373",
};

// 依頼書 #133 Phase A2 (2026/6/6): フォント装飾
const FONT_FAMILIES_LOCAL: Record<string, string> = {
  system: 'system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif',
  serif: 'Georgia, "Yu Mincho", "游明朝", serif',
  mincho: '"Hiragino Mincho ProN", "Yu Mincho", "游明朝", "MS Mincho", serif',
  round: '"M PLUS Rounded 1c", "Hiragino Maru Gothic Pro", "Yu Gothic UI", sans-serif',
  handwriting: '"Caveat", "Klee One", "Yu Mincho", cursive',
};
const FONT_OPTIONS_LOCAL = [
  { key: "system", label: "システム標準" },
  { key: "serif", label: "セリフ" },
  { key: "mincho", label: "明朝" },
  { key: "round", label: "丸ゴシック" },
  { key: "handwriting", label: "手書き風" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved?: () => void;
};

export default function ProfileEditModal({ open, onClose, userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  // 依頼書 #133 Phase A2: フォント装飾 (5箇所: display_name / bio / one_word / pet_name / blog_title)
  const [fontDisplayName, setFontDisplayName] = useState("system");
  const [fontBio, setFontBio] = useState("system");
  const [fontOneWord, setFontOneWord] = useState("system");
  const [fontPetName, setFontPetName] = useState("system");
  const [fontBlogTitle, setFontBlogTitle] = useState("system");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url, location, font_display_name, font_bio, font_one_word, font_pet_name, font_blog_title")
        .eq("id", userId)
        .single();
      if (error) {
        setError("プロフィールの読み込みに失敗しました");
      } else if (data) {
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
        setAvatarPreview(data.avatar_url || "");
        setLocation(data.location || "");
        setFontDisplayName(data.font_display_name || "system");
        setFontBio(data.font_bio || "system");
        setFontOneWord(data.font_one_word || "system");
        setFontPetName(data.font_pet_name || "system");
        setFontBlogTitle(data.font_blog_title || "system");
      }
      setLoading(false);
    })();
  }, [open, userId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("画像サイズは5MB以下にしてください");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    setError("");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) {
        setError("アップロードに失敗しました: " + uploadError.message);
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setAvatarUrl(urlData.publicUrl);
      setAvatarPreview(urlData.publicUrl);
    } catch (err) {
      setError("アップロード中にエラーが発生しました");
    }
    setUploading(false);
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError("表示名を入力してください");
      return;
    }
    if (displayName.length > 30) {
      setError("表示名は30文字以内にしてください");
      return;
    }
    if (bio.length > 200) {
      setError("自己紹介は200文字以内にしてください");
      return;
    }
    if (location.length > 50) {
      setError("場所は50文字以内にしてください");
      return;
    }
    setError("");
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
        location: location.trim(),
        font_display_name: fontDisplayName,
        font_bio: fontBio,
        font_one_word: fontOneWord,
        font_pet_name: fontPetName,
        font_blog_title: fontBlogTitle,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError("保存に失敗しました: " + updateError.message);
      return;
    }
    window.location.reload();
  };

  if (!open) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>✏️ プロフィールを編集</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: C.warmGray, padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 100, height: 100, borderRadius: "50%", background: avatarPreview ? `url(${avatarPreview}) center/cover` : C.orange, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", color: C.white, fontSize: 36, fontWeight: 700, border: `3px solid ${C.orangePale}` }}>
                  {!avatarPreview && (displayName.charAt(0).toUpperCase() || "?")}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: C.orangePale, border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.orange, cursor: uploading ? "wait" : "pointer", fontFamily: "inherit" }}>
                  {uploading ? "📤 アップロード中..." : "🖼️ 画像を変更"}
                </button>
                {avatarPreview && !uploading && (
                  <button onClick={() => { setAvatarUrl(""); setAvatarPreview(""); }} style={{ background: "none", border: "none", fontSize: 11, color: C.danger, marginLeft: 8, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  表示名 <span style={{ color: C.danger }}>*</span>
                </label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={30} placeholder="例: ポチのママ" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{displayName.length} / 30</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>自己紹介</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} placeholder="ペットのことや、得意なことなどを書いてみましょう🐾" rows={4} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 80, boxSizing: "border-box", outline: "none" }} />
                <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{bio.length} / 200</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  場所 <span style={{ color: C.warmGray, fontWeight: 400, fontSize: 11 }}>(任意)</span>
                </label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={50} placeholder="例: 東京・中野区 / 朝の散歩は新宿御苑" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{location.length} / 50</div>
              </div>

              {/* 依頼書 #133 Phase A2 (2026/6/6): フォント装飾 (無料5本 / 既存住民は DEFAULT='system' で見た目変化なし) */}
              <div style={{ marginBottom: 20, padding: "14px 12px", background: C.cream, borderRadius: 10, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 4 }}>🎨 フォント装飾</div>
                <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 12 }}>5 箇所のフォントを別々に選べます (無料 5 種)</div>

                {([
                  { state: fontDisplayName, setter: setFontDisplayName, label: "表示名", sample: displayName || "ユーザー" },
                  { state: fontBio, setter: setFontBio, label: "自己紹介", sample: bio.slice(0, 16) || "ペットと暮らす毎日を…" },
                  { state: fontOneWord, setter: setFontOneWord, label: "ひとこと", sample: "うちの子の物語をそっと…" },
                  { state: fontPetName, setter: setFontPetName, label: "うちの子の名前", sample: "ポチ / ミケ" },
                  { state: fontBlogTitle, setter: setFontBlogTitle, label: "ブログタイトル", sample: "うちの子と暮らす日々" },
                ] as const).map((row) => (
                  <div key={row.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: C.warmGray, marginBottom: 4 }}>{row.label}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {FONT_OPTIONS_LOCAL.map((opt) => {
                        const selected = row.state === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => row.setter(opt.key)}
                            style={{
                              padding: "6px 10px",
                              border: `1.5px solid ${selected ? C.orange : C.border}`,
                              borderRadius: 8,
                              background: selected ? C.orangePale : C.white,
                              color: selected ? C.orange : C.warmGray,
                              fontSize: 11,
                              fontWeight: selected ? 700 : 500,
                              cursor: "pointer",
                              fontFamily: FONT_FAMILIES_LOCAL[opt.key],
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        padding: "6px 10px",
                        background: C.white,
                        borderRadius: 6,
                        fontSize: 13,
                        color: C.dark,
                        fontFamily: FONT_FAMILIES_LOCAL[row.state],
                        border: `1px dashed ${C.border}`,
                      }}
                    >
                      {row.sample}
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ background: "#FFEBEE", color: C.danger, padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} disabled={saving || uploading} style={{ flex: 1, padding: "12px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>キャンセル</button>
                <button onClick={handleSave} disabled={saving || uploading || !displayName.trim()} style={{ flex: 1, padding: "12px", background: saving || !displayName.trim() ? C.warmGray : C.orange, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, color: C.white, cursor: saving || !displayName.trim() ? "wait" : "pointer", fontFamily: "inherit" }}>
                  {saving ? "保存中..." : "💾 保存する"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
