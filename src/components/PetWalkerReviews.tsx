// ペットウォーカー スポット詳細の口コミUI (DB基盤に「乗せるだけ」)
// ⚠️ DB: pet_walker_reviews(本人insert/update/delete・公開はis_hidden=false) /
//        pet_walker_review_reports(本人insertのみ・通報3件で自動非表示=トリガー)
//        pet_walker_spots.avg_rating/review_count はトリガー自動集計 (ここでは表示用に取得分から再計算)。
// ⚠️ 静けさ世界観: QCトークン・絵文字なし(★は評価記号として許容)・font-weight<=500・transition 0.8s+。
// ⚠️ 決済・SNS・施設マップ・認証には一切触れない。読むのは reviews/reports と profiles(表示名)のみ。

import { useState, useEffect, useCallback } from "react";
import { QC, QC_FONT_JP, QC_FONT_EN, QC_TIMING } from "../constants/theme";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

const ease = QC_TIMING.hoverEasing;

type ReviewRow = {
  id: string;
  spot_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  visited_with: string | null;
  created_at: string;
  profiles: { display_name: string | null } | null;
};

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
  // 通報
  const [reportOpenId, setReportOpenId] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const fetchReviews = useCallback(async () => {
    const { data } = await supabase
      .from("pet_walker_reviews")
      .select("id,spot_id,user_id,rating,comment,visited_with,created_at,profiles(display_name)")
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
    } else {
      setRating(0); setComment(""); setVisitedWith("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myReview?.id, spotId]);

  // 平均・件数 (is_hidden=false のみ取得済 → トリガー集計と同義)
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

  const submit = async () => {
    if (!user || rating < 1 || submitting) return;
    setSubmitting(true); setErrMsg(null);
    const payload = {
      spot_id: spotId,
      user_id: user.id,
      rating,
      comment: comment.trim() || null,
      visited_with: visitedWith.trim() || null,
    };
    let error;
    if (myReview) {
      ({ error } = await supabase
        .from("pet_walker_reviews")
        .update({ rating: payload.rating, comment: payload.comment, visited_with: payload.visited_with, updated_at: new Date().toISOString() })
        .eq("id", myReview.id));
    } else {
      ({ error } = await supabase.from("pet_walker_reviews").insert(payload));
    }
    setSubmitting(false);
    if (error) { setErrMsg("送信できませんでした。時間をおいて、もう一度お試しください。"); return; }
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
    </section>
  );
}
