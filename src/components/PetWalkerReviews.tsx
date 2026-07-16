// ペットウォーカー スポット詳細の口コミUI (DB基盤に「乗せるだけ」)
// ⚠️ DB: pet_walker_reviews(本人insert/update/delete・公開はis_hidden=false・image_urls jsonb) /
//        pet_walker_review_reports(本人insertのみ・通報3件で自動非表示=トリガー)
//        pet_walker_spots.avg_rating/review_count はトリガー自動集計 (ここでは表示用に取得分から再計算)。
// 写真: petwalker-review-photos バケット (本人フォルダのみ書込・公開読取)。
//       アップ前にクライアントで webp 圧縮 (長辺1600px・q0.8)。最大3枚。
// ⚠️ 静けさ世界観: QCトークン・絵文字なし(★は評価記号として許容)・font-weight<=500・transition 0.8s+。
// ⚠️ 決済・SNS・施設マップ・認証には一切触れない。読むのは reviews/reports と profiles(表示名)のみ。

import { useState, useEffect, useCallback, useRef } from "react";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_TIMING } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

const ease = QC_TIMING.hoverEasing;

const MAX_PHOTOS = 3;
const REVIEW_PHOTO_BUCKET = "petwalker-review-photos";

type ReviewRow = {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  visited_with: string | null;
  image_urls: string[] | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

// クライアント側 webp 圧縮 (長辺1600px・q0.8)。失敗時は元ファイルをそのまま返す。
async function compressToWebp(file: File): Promise<Blob> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas 2d context");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    if (blob && blob.size > 0 && blob.size < file.size) return blob;
    return blob && blob.size > 0 ? blob : file;
  } catch {
    return file;
  }
}

const REPORT_REASONS = ["不適切な内容", "誤った情報", "宣伝・スパム", "その他"];

// 星表示 (read-only)。filled=塗り星の数。
function Stars({ filled, size = 16 }: { filled: number; size?: number }) {
  return (
    <span style={{ color: QC.terracotta, fontSize: size, letterSpacing: 1 }} aria-label={`評価 ${filled} / 5`}>
      {"★".repeat(Math.round(filled))}
      <span style={{ color: QC.lightSand }}>{"★".repeat(Math.max(0, 5 - Math.round(filled)))}</span>
    </span>
  );
}

export function PetWalkerReviews({ spotId, isPC }: { spotId: string; isPC?: boolean }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  // 投稿フォーム
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [visitedWith, setVisitedWith] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // 写真: 既存URL (編集時) + 新規ファイル。合計 MAX_PHOTOS 枚まで
  const [keptUrls, setKeptUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 通報
  const [reportOpenId, setReportOpenId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from("pet_walker_reviews")
      .select("id,spot_id,user_id,rating,comment,visited_with,image_urls,created_at,profiles(display_name)")
      .eq("spot_id", spotId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false });
    setReviews(((data as unknown) as ReviewRow[]) || []);
    setLoading(false);
  }, [spotId]);

  useEffect(() => { setLoading(true); fetchReviews(); }, [fetchReviews]);

  // 自分の既存口コミ (UNIQUE制約 → あれば編集モード)
  const myReview = user ? reviews.find((r) => r.user_id === user.id) || null : null;

  // 編集モード時はフォームに既存値をプリフィル (口コミ取得後 / spot切替時)
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment || "");
      setVisitedWith(myReview.visited_with || "");
      setKeptUrls(myReview.image_urls || []);
    } else {
      setRating(0); setComment(""); setVisitedWith(""); setKeptUrls([]);
    }
    setNewFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id, spotId]);

  // 平均・件数 (is_hidden=false のみ取得済 → トリガー集計と同義)
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  // 写真の選択 (合計 MAX_PHOTOS 枚まで・超過分は静かに切る)
  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_PHOTOS - keptUrls.length - newFiles.length;
    const picked = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room));
    if (picked.length > 0) setNewFiles((prev) => [...prev, ...picked]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!user || rating < 1 || submitting) return;
    setSubmitting(true); setErrMsg(null);

    // 1) 新規写真を webp 圧縮してアップロード (本人フォルダ: <user.id>/...)
    const uploadedUrls: string[] = [];
    for (let i = 0; i < newFiles.length; i++) {
      const blob = await compressToWebp(newFiles[i]);
      const ext = blob.type === "image/webp" ? "webp" : (newFiles[i].name.split(".").pop()?.toLowerCase() || "jpg");
      const path = `${user.id}/${spotId}_${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from(REVIEW_PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || undefined });
      if (upErr) {
        setSubmitting(false);
        setErrMsg("写真をアップロードできませんでした。枚数やサイズを見直して、もう一度お試しください。");
        return;
      }
      uploadedUrls.push(supabase.storage.from(REVIEW_PHOTO_BUCKET).getPublicUrl(path).data.publicUrl);
    }
    const imageUrls = [...keptUrls, ...uploadedUrls].slice(0, MAX_PHOTOS);

    // 2) 口コミ本体を insert / update
    const payload = {
      spot_id: spotId,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
      visited_with: visitedWith.trim() || null,
      image_urls: imageUrls,
    };
    let error;
    if (myReview) {
      ({ error } = await supabase
        .from("pet_walker_reviews")
        .update({ rating: payload.rating, comment: payload.comment, visited_with: payload.visited_with, image_urls: payload.image_urls, updated_at: new Date().toISOString() })
        .eq("id", myReview.id));
    } else {
      ({ error } = await supabase.from("pet_walker_reviews").insert(payload));
    }
    setSubmitting(false);
    if (error) { setErrMsg("送信できませんでした。時間をおいて、もう一度お試しください。"); return; }

    // 3) 編集で外した写真はストレージからも片づける (失敗しても口コミ自体は成立)
    const removed = (myReview?.image_urls || []).filter((u) => !imageUrls.includes(u));
    if (removed.length > 0) {
      const paths = removed
        .map((u) => u.split(`/object/public/${REVIEW_PHOTO_BUCKET}/`)[1])
        .filter((p): p is string => !!p);
      if (paths.length > 0) await supabase.storage.from(REVIEW_PHOTO_BUCKET).remove(paths);
    }
    setNewFiles([]);
    await fetchReviews();
  };

  const submitReport = async (reviewId: string, reason: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("pet_walker_review_reports")
      .insert({ review_id: reviewId, reporter_id: user.id, reason });
    // 二重通報 (UNIQUE違反 23505) は握り潰して「通報済み」表示に倒す
    setReportedIds((prev) => new Set(prev).add(reviewId));
    setReportOpenId(null);
    if (error && error.code !== "23505") { /* 通信失敗等も静かに通報済み扱い (再送はしない) */ }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return ""; }
  };

  return (
    <section style={{ marginTop: 40, paddingTop: 28, borderTop: `1px solid ${QC.lightSand}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 18 }}>
        <p style={{ fontFamily: QC_FONT_EN, fontSize: 12, letterSpacing: 2, color: QC.sage, margin: 0 }}>REVIEWS</p>
        <h2 style={{ fontFamily: QC_FONT_JP, fontWeight: 500, fontSize: 18, margin: 0, color: QC.charcoal }}>みんなの口コミ</h2>
      </div>

      {/* 平均評価 */}
      {count > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <Stars filled={avg} size={20} />
          <span style={{ fontFamily: QC_FONT_EN, fontSize: 20, fontWeight: 500, color: QC.charcoal }}>{avg.toFixed(1)}</span>
          <span style={{ fontSize: 13, color: QC.warmGray, fontWeight: 300 }}>（{count}件）</span>
        </div>
      ) : (
        <p style={{ fontSize: 14, color: QC.warmGray, fontWeight: 300, marginBottom: 28 }}>
          {loading ? "読み込んでいます。" : "まだ口コミがありません。"}
        </p>
      )}

      {/* 投稿フォーム (ログイン時のみ) / 未ログイン導線 */}
      {user ? (
        <div style={{ background: QC.cream, border: `1px solid ${QC.lightSand}`, borderRadius: 14, padding: isPC ? "22px 24px" : "18px 18px", marginBottom: 32 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: QC.charcoal, margin: "0 0 14px" }}>
            {myReview ? "あなたの口コミを編集" : "この場所の口コミを書く"}
          </p>
          {/* 星選択 */}
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                aria-label={`${n}つ星`}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 2,
                  fontSize: 28, lineHeight: 1, color: n <= rating ? QC.terracotta : QC.lightSand,
                  transition: `color ${QC_TIMING.hoverDuration} ${ease}`,
                }}
              >★</button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="うちの子と過ごした時間を、そっと書き残せます。（任意）"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box", resize: "vertical",
              border: `1px solid ${QC.lightSand}`, borderRadius: 10, padding: "12px 14px",
              fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 300, color: QC.charcoal,
              background: "#fff", marginBottom: 12, lineHeight: 1.8,
            }}
          />
          <input
            value={visitedWith}
            onChange={(e) => setVisitedWith(e.target.value)}
            placeholder="だれと行きましたか？（任意・例：柴犬のむぎと）"
            style={{
              width: "100%", boxSizing: "border-box",
              border: `1px solid ${QC.lightSand}`, borderRadius: 10, padding: "10px 14px",
              fontFamily: QC_FONT_JP, fontSize: 13.5, fontWeight: 300, color: QC.charcoal,
              background: "#fff", marginBottom: 16,
            }}
          />
          {/* 写真 (任意・最大3枚)。既存 keptUrls + 新規 newFiles をサムネイルで並べ、それぞれ外せる */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
              {keptUrls.map((u) => (
                <div key={u} style={{ position: "relative", width: 72, height: 72 }}>
                  <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: `1px solid ${QC.lightSand}`, display: "block" }} />
                  <button
                    onClick={() => setKeptUrls((prev) => prev.filter((x) => x !== u))}
                    aria-label="この写真を外す"
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: `1px solid ${QC.lightSand}`, background: QC.warmWhite, color: QC.warmGray, fontSize: 11, lineHeight: 1, cursor: "pointer", padding: 0 }}
                  >×</button>
                </div>
              ))}
              {newFiles.map((f, i) => (
                <div key={`${f.name}_${i}`} style={{ position: "relative", width: 72, height: 72 }}>
                  <img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, border: `1px solid ${QC.lightSand}`, display: "block" }} />
                  <button
                    onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}
                    aria-label="この写真を外す"
                    style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 999, border: `1px solid ${QC.lightSand}`, background: QC.warmWhite, color: QC.warmGray, fontSize: 11, lineHeight: 1, cursor: "pointer", padding: 0 }}
                  >×</button>
                </div>
              ))}
              {keptUrls.length + newFiles.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 72, height: 72, borderRadius: 10, cursor: "pointer",
                    border: `1px dashed ${QC.sage}`, background: "transparent",
                    color: QC.sage, fontFamily: QC_FONT_JP, fontSize: 11.5, fontWeight: 300, lineHeight: 1.7,
                    transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
                  }}
                >写真を<br />添える</button>
              )}
            </div>
            <p style={{ fontSize: 11.5, color: QC.sage, fontWeight: 300, margin: "8px 0 0" }}>
              この場所で撮った写真を、{MAX_PHOTOS}枚まで添えられます。（任意）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => pickFiles(e.target.files)}
              style={{ display: "none" }}
            />
          </div>
          {errMsg && <p style={{ fontSize: 12.5, color: QC.terracotta, fontWeight: 400, margin: "0 0 12px" }}>{errMsg}</p>}
          <button
            onClick={submit}
            disabled={rating < 1 || submitting}
            style={{
              padding: "11px 28px", borderRadius: 999, border: "none",
              background: rating < 1 || submitting ? QC.lightSand : QC.softBrown,
              color: "#fff", fontFamily: QC_FONT_JP, fontSize: 14, fontWeight: 400, letterSpacing: 0.5,
              cursor: rating < 1 || submitting ? "default" : "pointer",
              transition: `all ${QC_TIMING.hoverDuration} ${ease}`,
            }}
          >
            {submitting ? "送信中…" : myReview ? "更新する" : "投稿する"}
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 13.5, color: QC.warmGray, fontWeight: 300, marginBottom: 32 }}>
          ログインすると、この場所の口コミを書けます。
        </p>
      )}

      {/* 口コミ一覧 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {reviews.map((r) => {
          const mine = user && r.user_id === user.id;
          const name = r.profiles?.display_name || "住民";
          return (
            <div key={r.id} style={{ border: `1px solid ${QC.lightSand}`, borderRadius: 12, padding: "16px 18px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Stars filled={r.rating} size={14} />
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: QC.charcoal }}>{name}{mine ? "（あなた）" : ""}</span>
                </div>
                <span style={{ fontSize: 11.5, color: QC.sage, fontWeight: 300 }}>{fmtDate(r.created_at)}</span>
              </div>
              {r.comment && (
                <p style={{ fontSize: 14, color: QC.warmGray, fontWeight: 300, lineHeight: 1.9, margin: "0 0 6px", whiteSpace: "pre-wrap" }}>{r.comment}</p>
              )}
              {/* 口コミ写真: サムネイル → タップで拡大 */}
              {(r.image_urls?.length ?? 0) > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 4px" }}>
                  {(r.image_urls || []).map((u) => (
                    <button
                      key={u}
                      onClick={() => setLightboxUrl(u)}
                      aria-label="写真を拡大する"
                      style={{ padding: 0, border: `1px solid ${QC.lightSand}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", background: QC.cream, width: 88, height: 88 }}
                    >
                      <img src={u} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                  ))}
                </div>
              )}
              {r.visited_with && (
                <p style={{ fontSize: 12, color: QC.sage, fontWeight: 300, margin: "6px 0 0" }}>{r.visited_with} と</p>
              )}
              {/* 通報 (ログイン時・自分以外) */}
              {user && !mine && (
                <div style={{ marginTop: 10 }}>
                  {reportedIds.has(r.id) ? (
                    <span style={{ fontSize: 11.5, color: QC.sage, fontWeight: 300 }}>通報済み</span>
                  ) : reportOpenId === r.id ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {REPORT_REASONS.map((reason) => (
                        <button
                          key={reason}
                          onClick={() => submitReport(r.id, reason)}
                          style={{
                            padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                            border: `1px solid ${QC.lightSand}`, background: "transparent",
                            color: QC.warmGray, fontFamily: QC_FONT_JP, fontSize: 11.5, fontWeight: 400,
                          }}
                        >{reason}</button>
                      ))}
                      <button onClick={() => setReportOpenId(null)} style={{ background: "none", border: "none", color: QC.sage, fontSize: 11.5, cursor: "pointer", fontFamily: QC_FONT_JP }}>やめる</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReportOpenId(r.id)}
                      style={{ background: "none", border: "none", color: QC.sage, fontSize: 11.5, fontWeight: 300, cursor: "pointer", padding: 0, fontFamily: QC_FONT_JP, textDecoration: "underline" }}
                    >通報する</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ライトボックス (タップで閉じる) */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          role="button"
          aria-label="閉じる"
          style={{
            position: "fixed", inset: 0, zIndex: 60, cursor: "pointer",
            background: "rgba(44,41,38,0.82)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            animation: `qocca-fadeInSlow 0.6s ${ease} both`,
          }}
        >
          <img src={lightboxUrl} alt="" style={{ maxWidth: "92vw", maxHeight: "86vh", borderRadius: 14, boxShadow: "0 12px 48px rgba(0,0,0,0.4)" }} />
        </div>
      )}
    </section>
  );
}
