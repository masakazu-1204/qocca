import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs3lJg_J3yYZqou"
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

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  onSaved?: () => void;
};

export default function ProfileEditModal({ open, onClose, userId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, bio, avatar_url")
        .eq("id", userId)
        .single();
      if (error) {
        setError("プロフィールの読み込みに失敗しました");
      } else if (data) {
        setDisplayName(data.display_name || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
        setAvatarPreview(data.avatar_url || "");
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
    setError("");
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    setSaving(false);
    if (updateError) {
      setError("保存に失敗しました: " + updateError.message);
      return;
    }
    onSaved?.();
    onClose();
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
