// src/components/PetEditModal.tsx
// Phase D Phase 2 (5/22-5/26): うちの子の追加/編集/memorial化/削除モーダル
// ProfileEditModal パターン継承、Phase B の pets + pet_photos テーブル + pet-photos Storage バケット使用
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
  memorial: "#8B6F4E",
};

type Species = "dog" | "cat" | "other";
type Gender = "male" | "female" | "unknown";
type Status = "active" | "memorial";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  petId?: string | null; // null/undefined = 追加モード、uuid = 編集モード
  onSaved?: () => void;
};

export default function PetEditModal({ open, onClose, userId, petId, onSaved }: Props) {
  const isEditMode = !!petId;

  // Loading state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState<Gender>("unknown");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");

  // Confirm dialogs
  const [showMemorialConfirm, setShowMemorialConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Photos (edit mode only) — Phase D2 Step C+D
  const [photos, setPhotos] = useState<Array<{
    id: string;
    photo_url: string;
    caption?: string | null;
    display_order: number;
    taken_at?: string | null;
  }>>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Error
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const photosFileRef = useRef<HTMLInputElement>(null);

  // Reset form (追加モード or close時)
  const resetForm = () => {
    setName("");
    setSpecies("dog");
    setBreed("");
    setBirthday("");
    setGender("unknown");
    setBio("");
    setStatus("active");
    setAvatarUrl("");
    setAvatarPreview("");
    setError("");
    setShowMemorialConfirm(false);
    setShowDeleteConfirm(false);
  };

  // Load existing pet (edit mode)
  useEffect(() => {
    if (!open) return;
    if (!petId) {
      // 追加モード: フォームをリセット
      resetForm();
      return;
    }
    // 編集モード: pet 取得
    (async () => {
      setLoading(true);
      setError("");
      const { data, error: err } = await supabase
        .from("pets")
        .select("name, species, breed, birthday, gender, bio, status, avatar_url")
        .eq("id", petId)
        .single();
      if (err) {
        setError("うちの子の情報を読み込めませんでした");
      } else if (data) {
        setName(data.name || "");
        setSpecies((data.species as Species) || "dog");
        setBreed(data.breed || "");
        setBirthday(data.birthday || "");
        setGender((data.gender as Gender) || "unknown");
        setBio(data.bio || "");
        setStatus((data.status as Status) || "active");
        setAvatarUrl(data.avatar_url || "");
        setAvatarPreview(data.avatar_url || "");
      }
      setLoading(false);
    })();
  }, [open, petId]);

  // Photos fetch (edit mode)
  useEffect(() => {
    if (!open || !petId) {
      setPhotos([]);
      return;
    }
    (async () => {
      setPhotoLoading(true);
      const { data } = await supabase
        .from("pet_photos")
        .select("id, photo_url, caption, display_order, taken_at")
        .eq("pet_id", petId)
        .order("display_order", { ascending: true });
      setPhotos(data || []);
      setPhotoLoading(false);
    })();
  }, [open, petId]);

  // Photos upload (multiple, max 30, Storage: pet-photos)
  const handlePhotosUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!petId) {
      setError("先にうちの子を保存してから写真を追加してください");
      if (photosFileRef.current) photosFileRef.current.value = "";
      return;
    }
    if (photos.length + files.length > 30) {
      setError(`写真は最大30枚まで（あと${30 - photos.length}枚まで追加できます）`);
      if (photosFileRef.current) photosFileRef.current.value = "";
      return;
    }
    setError("");
    setPhotoUploading(true);
    try {
      let nextOrder = photos.length > 0 ? Math.max(...photos.map((p) => p.display_order)) + 1 : 0;
      const inserted: Array<any> = [];
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          setError(`${file.name}: 10MB超のファイルはスキップしました`);
          continue;
        }
        if (!file.type.startsWith("image/")) continue;
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const filePath = `pets/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("pet-photos")
          .upload(filePath, file, { upsert: true, contentType: file.type });
        if (upErr) {
          setError(`${file.name}: アップロード失敗 ${upErr.message}`);
          continue;
        }
        const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(filePath);
        const { data: row, error: insErr } = await supabase
          .from("pet_photos")
          .insert({
            pet_id: petId,
            photo_url: urlData.publicUrl,
            display_order: nextOrder++,
          })
          .select("id, photo_url, caption, display_order, taken_at")
          .single();
        if (insErr) {
          setError(`${file.name}: DB登録失敗 ${insErr.message}`);
          continue;
        }
        if (row) inserted.push(row);
      }
      setPhotos((prev) => [...prev, ...inserted]);
    } catch (err: any) {
      setError("アップロード中エラー: " + (err?.message || String(err)));
    }
    setPhotoUploading(false);
    if (photosFileRef.current) photosFileRef.current.value = "";
  };

  // Photo delete (個別)
  const handlePhotoDelete = async (photoId: string) => {
    const { error: err } = await supabase.from("pet_photos").delete().eq("id", photoId);
    if (err) {
      setError("写真の削除に失敗しました: " + err.message);
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  // Photo reorder (上下ボタン or DnD 共通)
  const persistOrder = async (newPhotos: typeof photos) => {
    const reordered = newPhotos.map((p, i) => ({ ...p, display_order: i }));
    setPhotos(reordered);
    await Promise.all(
      reordered.map((p) =>
        supabase.from("pet_photos").update({ display_order: p.display_order }).eq("id", p.id)
      )
    );
  };

  const handlePhotoMove = async (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= photos.length) return;
    const newPhotos = [...photos];
    [newPhotos[idx], newPhotos[target]] = [newPhotos[target], newPhotos[idx]];
    await persistOrder(newPhotos);
  };

  // DnD ハンドラ (PC)
  const handleDragStart = (idx: number) => setDraggedIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      return;
    }
    const newPhotos = [...photos];
    const [moved] = newPhotos.splice(draggedIdx, 1);
    newPhotos.splice(targetIdx, 0, moved);
    setDraggedIdx(null);
    await persistOrder(newPhotos);
  };

  // Avatar upload (Storage: pet-photos バケット)
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `pets/${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("pet-photos")
        .upload(filePath, file, { upsert: true, contentType: file.type });
      if (uploadError) {
        setError("アップロードに失敗しました: " + uploadError.message);
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("pet-photos").getPublicUrl(filePath);
      setAvatarUrl(urlData.publicUrl);
      setAvatarPreview(urlData.publicUrl);
    } catch (err: any) {
      setError("アップロード中にエラーが発生しました: " + (err?.message || String(err)));
    }
    setUploading(false);
  };

  // Save (INSERT or UPDATE)
  const handleSave = async () => {
    // Validation (CHECK 制約準拠)
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    if (name.length > 30) {
      setError("名前は30文字以内にしてください");
      return;
    }
    if (!["dog", "cat", "other"].includes(species)) {
      setError("種類が不正です");
      return;
    }
    if (!["male", "female", "unknown"].includes(gender)) {
      setError("性別が不正です");
      return;
    }
    if (!["active", "memorial"].includes(status)) {
      setError("状態が不正です");
      return;
    }
    if (breed && breed.length > 50) {
      setError("品種は50文字以内にしてください");
      return;
    }
    if (bio && bio.length > 500) {
      setError("自己紹介は500文字以内にしてください");
      return;
    }
    setError("");
    setSaving(true);

    const payload: any = {
      owner_id: userId,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      birthday: birthday || null,
      gender,
      bio: bio.trim() || null,
      status,
      avatar_url: avatarUrl || null,
      updated_at: new Date().toISOString(),
    };

    let opError: any = null;
    if (isEditMode && petId) {
      const { error: updateError } = await supabase
        .from("pets")
        .update(payload)
        .eq("id", petId);
      opError = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("pets")
        .insert(payload);
      opError = insertError;
    }
    setSaving(false);
    if (opError) {
      setError("保存に失敗しました: " + opError.message);
      return;
    }
    onSaved?.();
    onClose();
  };

  // Memorial 化 (active → memorial、確認後)
  const handleConfirmMemorial = async () => {
    if (!petId) return;
    setSaving(true);
    const { error: err } = await supabase
      .from("pets")
      .update({ status: "memorial", updated_at: new Date().toISOString() })
      .eq("id", petId);
    setSaving(false);
    if (err) {
      setError("保存に失敗しました: " + err.message);
      return;
    }
    setStatus("memorial");
    setShowMemorialConfirm(false);
    onSaved?.();
  };

  // Delete (pets を削除、pet_photos は ON DELETE CASCADE で連動)
  const handleDelete = async () => {
    if (!petId) return;
    setDeleting(true);
    const { error: err } = await supabase.from("pets").delete().eq("id", petId);
    setDeleting(false);
    if (err) {
      setError("削除に失敗しました: " + err.message);
      return;
    }
    setShowDeleteConfirm(false);
    onSaved?.();
    onClose();
  };

  if (!open) return null;

  const speciesEmoji = species === "dog" ? "🐕" : species === "cat" ? "🐈" : "🐾";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.dark }}>
            🐾 {isEditMode ? "うちの子の情報を編集" : "うちの子を追加"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: C.warmGray, padding: 0, lineHeight: 1 }} aria-label="閉じる">×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: C.warmGray }}>読み込み中...</div>
          ) : (
            <>
              {/* Avatar */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 100, height: 100, borderRadius: "50%", overflow: "hidden", margin: "0 auto 12px", background: C.orangePale, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, border: `3px solid ${C.orangePale}` }}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={name || "うちの子"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  ) : (
                    speciesEmoji
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ background: C.orangePale, border: "none", borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.orange, cursor: uploading ? "wait" : "pointer", fontFamily: "inherit" }}>
                  {uploading ? "📤 アップロード中..." : avatarPreview ? "🖼️ 画像を変更" : "🖼️ 画像を選ぶ"}
                </button>
                {avatarPreview && !uploading && (
                  <button onClick={() => { setAvatarUrl(""); setAvatarPreview(""); }} style={{ background: "none", border: "none", fontSize: 11, color: C.danger, marginLeft: 8, cursor: "pointer", fontFamily: "inherit" }}>削除</button>
                )}
              </div>

              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  名前 <span style={{ color: C.danger }}>*</span>
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="例: もも、くう、こてつ" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{name.length} / 30</div>
              </div>

              {/* Species */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  種類 <span style={{ color: C.danger }}>*</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["dog", "cat", "other"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSpecies(s)}
                      style={{
                        flex: 1, padding: "10px 8px",
                        background: species === s ? C.orange : C.white,
                        color: species === s ? "#fff" : C.dark,
                        border: `1.5px solid ${species === s ? C.orange : C.border}`,
                        borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {s === "dog" ? "🐕 犬" : s === "cat" ? "🐈 猫" : "🐾 そのほか"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Breed */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  品種 <span style={{ color: C.warmGray, fontWeight: 400, fontSize: 11 }}>(任意)</span>
                </label>
                <input type="text" value={breed} onChange={(e) => setBreed(e.target.value)} maxLength={50} placeholder="例: 柴犬、ミックス、三毛猫" style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
              </div>

              {/* Birthday */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  誕生日 <span style={{ color: C.warmGray, fontWeight: 400, fontSize: 11 }}>(任意)</span>
                </label>
                <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
              </div>

              {/* Gender */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  性別 <span style={{ color: C.warmGray, fontWeight: 400, fontSize: 11 }}>(任意)</span>
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {(["male", "female", "unknown"] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      style={{
                        flex: 1, padding: "10px 8px",
                        background: gender === g ? C.orange : C.white,
                        color: gender === g ? "#fff" : C.dark,
                        border: `1.5px solid ${gender === g ? C.orange : C.border}`,
                        borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {g === "male" ? "♂ オス" : g === "female" ? "♀ メス" : "❔ 不明"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                  自己紹介 <span style={{ color: C.warmGray, fontWeight: 400, fontSize: 11 }}>(任意)</span>
                </label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="うちの子の物語、好きなこと、いつもの暮らし。" rows={4} style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical", minHeight: 80, boxSizing: "border-box", outline: "none" }} />
                <div style={{ textAlign: "right", fontSize: 11, color: C.warmGray, marginTop: 4 }}>{bio.length} / 500</div>
              </div>

              {/* Photos library (edit mode only) - Phase D2 Step C+D */}
              {isEditMode && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: C.dark }}>
                      📷 写真ライブラリ <span style={{ color: C.warmGray, fontWeight: 400, fontSize: 11 }}>({photos.length} / 30)</span>
                    </label>
                    <button
                      onClick={() => photosFileRef.current?.click()}
                      disabled={photoUploading || photos.length >= 30}
                      style={{
                        background: photos.length >= 30 ? C.warmGray : C.orangePale,
                        border: "none",
                        borderRadius: 16,
                        padding: "6px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: photos.length >= 30 ? "#fff" : C.orange,
                        cursor: photoUploading ? "wait" : photos.length >= 30 ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {photoUploading ? "📤 アップロード中..." : "+ 写真を追加"}
                    </button>
                    <input
                      ref={photosFileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotosUpload}
                      style={{ display: "none" }}
                    />
                  </div>
                  {photoLoading ? (
                    <div style={{ textAlign: "center", padding: 20, color: C.warmGray, fontSize: 12 }}>読み込み中...</div>
                  ) : photos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, background: "#FAFAFA", borderRadius: 10, color: C.warmGray, fontSize: 12, border: `1px dashed ${C.border}` }}>
                      写真がありません。<br/>
                      「+ 写真を追加」から選んでください。
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8 }}>
                      {photos.map((ph, idx) => (
                        <div
                          key={ph.id}
                          draggable
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(idx)}
                          style={{
                            position: "relative",
                            aspectRatio: "1",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: `1px solid ${draggedIdx === idx ? C.orange : C.border}`,
                            background: C.orangePale,
                            cursor: "grab",
                          }}
                        >
                          <img
                            src={ph.photo_url}
                            alt={ph.caption || `写真 ${idx + 1}`}
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                          {/* 削除ボタン */}
                          <button
                            onClick={() => handlePhotoDelete(ph.id)}
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "rgba(0,0,0,0.6)",
                              color: "#fff",
                              border: "none",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                              lineHeight: 1,
                              padding: 0,
                            }}
                            aria-label="削除"
                          >
                            ×
                          </button>
                          {/* 上下ボタン (スマホ向け) */}
                          <div style={{ position: "absolute", bottom: 4, left: 4, display: "flex", gap: 2 }}>
                            {idx > 0 && (
                              <button
                                onClick={() => handlePhotoMove(idx, -1)}
                                style={{
                                  width: 18, height: 18, borderRadius: 4,
                                  background: "rgba(0,0,0,0.6)", color: "#fff",
                                  border: "none", fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", lineHeight: 1, padding: 0,
                                }}
                                aria-label="前に移動"
                              >
                                ←
                              </button>
                            )}
                            {idx < photos.length - 1 && (
                              <button
                                onClick={() => handlePhotoMove(idx, 1)}
                                style={{
                                  width: 18, height: 18, borderRadius: 4,
                                  background: "rgba(0,0,0,0.6)", color: "#fff",
                                  border: "none", fontSize: 10, fontWeight: 700,
                                  cursor: "pointer", lineHeight: 1, padding: 0,
                                }}
                                aria-label="後に移動"
                              >
                                →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: C.warmGray, marginTop: 6, lineHeight: 1.7 }}>
                    💡 PC: ドラッグ&ドロップで並び替え / スマホ: ←→ ボタンで並び替え<br/>
                    💡 1枚 10MB まで、最大 30 枚
                  </div>
                </div>
              )}

              {/* Status (edit mode only) - active/memorial */}
              {isEditMode && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                    状態
                  </label>
                  {status === "active" ? (
                    <div>
                      <div style={{ background: C.orangePale, borderRadius: 8, padding: "10px 12px", marginBottom: 8, fontSize: 13, color: C.dark }}>
                        🌿 今、一緒に暮らしている
                      </div>
                      <button
                        onClick={() => setShowMemorialConfirm(true)}
                        style={{
                          background: "transparent",
                          border: `1px solid ${C.border}`,
                          color: C.warmGray,
                          fontSize: 12,
                          padding: "8px 14px",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        🌈 虹の橋を渡ったことを記録する
                      </button>
                    </div>
                  ) : (
                    <div style={{ background: "#F8F6F2", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: C.memorial, lineHeight: 1.7 }}>
                      🌈 虹の橋を渡った子<br/>
                      <span style={{ fontSize: 11, color: C.warmGray }}>大切な記録として、ずっとここに。</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ background: "#FFEBEE", color: C.danger, padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
              )}

              {/* Buttons (Save + Cancel) */}
              <div style={{ display: "flex", gap: 8, marginBottom: isEditMode ? 16 : 0 }}>
                <button onClick={onClose} disabled={saving || uploading || deleting} style={{ flex: 1, padding: "12px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontWeight: 600, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>キャンセル</button>
                <button onClick={handleSave} disabled={saving || uploading || deleting || !name.trim()} style={{ flex: 1, padding: "12px", background: saving || !name.trim() ? C.warmGray : C.orange, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, color: "#fff", cursor: saving || !name.trim() ? "wait" : "pointer", fontFamily: "inherit" }}>
                  {saving ? "保存中..." : isEditMode ? "💾 更新する" : "💾 追加する"}
                </button>
              </div>

              {/* Delete button (edit mode only) */}
              {isEditMode && (
                <div style={{ borderTop: `1px dashed ${C.border}`, paddingTop: 16, textAlign: "center" }}>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={saving || uploading || deleting}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: C.danger,
                      fontSize: 12,
                      padding: "6px 12px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textDecoration: "underline",
                    }}
                  >
                    🗑️ この記録を削除する
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Memorial 確認ダイアログ */}
      {showMemorialConfirm && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>🌈</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, textAlign: "center", marginBottom: 12 }}>
              虹の橋を渡ったことを記録しますか?
            </div>
            <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.8, marginBottom: 20, textAlign: "center" }}>
              {name && `${name}との`}大切な時間を、Qoccaに残します。<br/>
              記録は削除されず、いつでも見返せます。
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowMemorialConfirm(false)} style={{ flex: 1, padding: "10px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>戻る</button>
              <button onClick={handleConfirmMemorial} disabled={saving} style={{ flex: 1, padding: "10px", background: C.memorial, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}>
                {saving ? "保存中..." : "記録する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {showDeleteConfirm && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 380 }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.dark, textAlign: "center", marginBottom: 12 }}>
              本当に削除しますか?
            </div>
            <p style={{ fontSize: 13, color: C.warmGray, lineHeight: 1.7, marginBottom: 12, textAlign: "center" }}>
              {name && `${name}の`}記録と、関連する写真もすべて削除されます。<br/>
              この操作は元に戻せません。
            </p>
            {status === "active" && (
              <div style={{ background: "#FFF9F0", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 11, color: C.memorial, lineHeight: 1.6 }}>
                💡 大切な思い出を残したい場合は、削除ではなく<br/>
                「🌈 虹の橋を渡ったことを記録する」をご検討ください。
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: "10px", background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, color: C.warmGray, cursor: "pointer", fontFamily: "inherit" }}>戻る</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: "10px", background: C.danger, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, color: "#fff", cursor: deleting ? "wait" : "pointer", fontFamily: "inherit" }}>
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
