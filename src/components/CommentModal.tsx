// src/components/CommentModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { X, Heart, MessageCircle, Trash2, Send } from "lucide-react";

// Supabase クライアント（App.tsxと同じ値を使う）
const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

// ブランドカラー
const BRAND = "#F5A94A";
const BRAND_DEEP = "#B27820";
const CREAM = "#FFF9F0";
const TEXT_DARK = "#2C2C2A";
const TEXT_MID = "#444441";
const TEXT_MUTED = "#888780";
const BORDER = "#F1EFE8";

// ========================================
// Type
// ========================================
export type CommentTargetType = "gallery" | "event" | "blog";

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  like_count: number;
  liked_by_me: boolean;
  is_my_comment: boolean;
  can_delete: boolean;
}

interface CommentModalProps {
  open: boolean;
  onClose: () => void;
  targetType: CommentTargetType;
  targetId: string;
  // 投稿者ID（ギャラリー/ブログの削除権限チェック用）
  postOwnerId?: string;
  // 現在のログインユーザーID
  currentUserId?: string | null;
  // ログイン画面への遷移関数（未ログイン時のボタン用）
  onRequireLogin?: () => void;
  // タイトル表示（任意）
  title?: string;
}

// ========================================
// テーブル名マッピング
// ========================================
const TABLE_MAP = {
  gallery: {
    comments: "gallery_comments",
    likes: "gallery_comment_likes",
    foreignKey: "gallery_post_id",
  },
  event: {
    comments: "event_comments",
    likes: "event_comment_likes",
    foreignKey: "event_id",
  },
  blog: {
    comments: "blog_comments",
    likes: "blog_comment_likes",
    foreignKey: "blog_post_id",
  },
};

// ========================================
// Main Component
// ========================================
export default function CommentModal({
  open,
  onClose,
  targetType,
  targetId,
  postOwnerId,
  currentUserId,
  onRequireLogin,
  title,
}: CommentModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const config = TABLE_MAP[targetType];

  // ========================================
  // コメント読み込み
  // ========================================
  const loadComments = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);

    try {
      // コメント取得
      const { data: commentsData, error } = await supabase
        .from(config.comments)
        .select("*")
        .eq(config.foreignKey, targetId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!commentsData) {
        setComments([]);
        return;
      }

      // プロフィール取得（一括）
      const userIds = [...new Set(commentsData.map((c: any) => c.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(
        (profilesData || []).map((p: any) => [p.id, p])
      );

      // いいね情報を取得
      const commentIds = commentsData.map((c: any) => c.id);
      const { data: likesData } = await supabase
        .from(config.likes)
        .select("comment_id, user_id")
        .in("comment_id", commentIds);

      // いいね数とmy like
      const likeCountMap = new Map<string, number>();
      const myLikedSet = new Set<string>();
      (likesData || []).forEach((like: any) => {
        likeCountMap.set(
          like.comment_id,
          (likeCountMap.get(like.comment_id) || 0) + 1
        );
        if (currentUserId && like.user_id === currentUserId) {
          myLikedSet.add(like.comment_id);
        }
      });

      // マージ
      const merged: Comment[] = commentsData.map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        parent_comment_id: c.parent_comment_id,
        profile: profileMap.get(c.user_id) as any,
        like_count: likeCountMap.get(c.id) || 0,
        liked_by_me: myLikedSet.has(c.id),
        is_my_comment: currentUserId === c.user_id,
        can_delete:
          currentUserId === c.user_id ||
          (targetType !== "event" && currentUserId === postOwnerId),
      }));

      setComments(merged);
    } catch (err) {
      console.error("コメント読み込みエラー:", err);
    } finally {
      setLoading(false);
    }
  }, [targetId, config.comments, config.likes, config.foreignKey, currentUserId, postOwnerId, targetType]);

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, loadComments]);

  // ========================================
  // コメント送信
  // ========================================
  const handleSubmit = async () => {
    if (!input.trim() || !currentUserId || submitting) return;
    setSubmitting(true);

    try {
      const { error } = await supabase.from(config.comments).insert({
        [config.foreignKey]: targetId,
        user_id: currentUserId,
        content: input.trim(),
        parent_comment_id: replyTo?.id || null,
      });

      if (error) throw error;

      setInput("");
      setReplyTo(null);
      await loadComments();
    } catch (err) {
      console.error("投稿エラー:", err);
      alert("コメントの投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  // ========================================
  // コメント削除
  // ========================================
  const handleDelete = async (commentId: string) => {
    if (!window.confirm("このコメントを削除しますか?")) return;

    try {
      const { error } = await supabase
        .from(config.comments)
        .delete()
        .eq("id", commentId);

      if (error) throw error;
      await loadComments();
    } catch (err) {
      console.error("削除エラー:", err);
      alert("削除に失敗しました");
    }
  };

  // ========================================
  // いいね切り替え
  // ========================================
  const handleToggleLike = async (comment: Comment) => {
    if (!currentUserId) {
      onRequireLogin?.();
      return;
    }

    try {
      if (comment.liked_by_me) {
        // 解除
        const { error } = await supabase
          .from(config.likes)
          .delete()
          .eq("comment_id", comment.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
      } else {
        // 追加
        const { error } = await supabase.from(config.likes).insert({
          comment_id: comment.id,
          user_id: currentUserId,
        });
        if (error) throw error;
      }
      await loadComments();
    } catch (err) {
      console.error("いいねエラー:", err);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          maxWidth: 560,
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: TEXT_DARK,
        }}
      >
        {/* ヘッダー */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCircle size={20} strokeWidth={2} color={BRAND} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>
              {title || "コメント"} ({comments.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              padding: 4,
              cursor: "pointer",
              color: TEXT_MUTED,
              display: "flex",
            }}
            aria-label="閉じる"
          >
            <X size={22} />
          </button>
        </div>

        {/* 未ログイン案内 */}
        {!currentUserId && (
          <div
            style={{
              padding: "12px 20px",
              background: CREAM,
              borderBottom: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: TEXT_MID }}>
              ログインしてコメントしよう 🐾
            </span>
            <button
              onClick={onRequireLogin}
              style={{
                padding: "6px 16px",
                background: BRAND,
                color: "white",
                border: "none",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ログイン
            </button>
          </div>
        )}

        {/* コメント一覧 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 20px 16px",
          }}
        >
          {loading ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: TEXT_MUTED,
                fontSize: 13,
              }}
            >
              読み込み中...
            </div>
          ) : comments.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: TEXT_MUTED,
                fontSize: 13,
              }}
            >
              まだコメントがありません
              <br />
              <span style={{ fontSize: 12 }}>最初のコメントをどうぞ 🐾</span>
            </div>
          ) : (
            comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                onReply={() => setReplyTo(c)}
                onDelete={() => handleDelete(c.id)}
                onToggleLike={() => handleToggleLike(c)}
              />
            ))
          )}
        </div>

        {/* 入力欄（ログイン時のみ） */}
        {currentUserId && (
          <div
            style={{
              borderTop: `1px solid ${BORDER}`,
              padding: "12px 20px 16px",
              background: "#FFFFFF",
            }}
          >
            {/* 返信中のバッジ */}
            {replyTo && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  background: CREAM,
                  borderRadius: 8,
                  marginBottom: 8,
                  fontSize: 12,
                  color: TEXT_MID,
                }}
              >
                <span>
                  💬 {replyTo.profile?.display_name || "ユーザー"} さんへ返信
                </span>
                <button
                  onClick={() => setReplyTo(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: TEXT_MUTED,
                    display: "flex",
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  replyTo ? "返信を書く..." : "コメントを書く..."
                }
                rows={2}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: "inherit",
                  resize: "none",
                  outline: "none",
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    (e.metaKey || e.ctrlKey) &&
                    !submitting
                  ) {
                    handleSubmit();
                  }
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || submitting}
                style={{
                  padding: "10px 14px",
                  background:
                    input.trim() && !submitting ? BRAND : "#E5E5E3",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  cursor:
                    input.trim() && !submitting ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 44,
                  minHeight: 44,
                }}
                aria-label="送信"
              >
                <Send size={18} />
              </button>
            </div>
            <div
              style={{
                fontSize: 10,
                color: TEXT_MUTED,
                marginTop: 4,
                textAlign: "right",
              }}
            >
              Ctrl + Enter で送信
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ========================================
// コメント1件の表示
// ========================================
function CommentItem({
  comment,
  onReply,
  onDelete,
  onToggleLike,
}: {
  comment: Comment;
  onReply: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
}) {
  const displayName = comment.profile?.display_name || "ユーザー";
  const avatar = comment.profile?.avatar_url;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 0",
        borderBottom: `1px solid ${BORDER}`,
      }}
    >
      {/* アバター */}
      <div
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: CREAM,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          color: BRAND_DEEP,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          displayName.charAt(0)
        )}
      </div>

      {/* 本文 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_DARK }}>
            {displayName}
          </span>
          <span style={{ fontSize: 11, color: TEXT_MUTED }}>
            {formatTime(comment.created_at)}
          </span>
        </div>

        {/* 返信バッジ */}
        {comment.parent_comment_id && (
          <div
            style={{
              fontSize: 11,
              color: BRAND,
              marginTop: 2,
            }}
          >
            💬 返信
          </div>
        )}

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: TEXT_MID,
            marginTop: 4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {comment.content}
        </div>

        {/* アクション */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 8,
            alignItems: "center",
          }}
        >
          <button
            onClick={onToggleLike}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: comment.liked_by_me ? BRAND : TEXT_MUTED,
              fontSize: 12,
            }}
          >
            <Heart
              size={14}
              strokeWidth={2}
              fill={comment.liked_by_me ? BRAND : "none"}
            />
            {comment.like_count > 0 && <span>{comment.like_count}</span>}
          </button>

          <button
            onClick={onReply}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: TEXT_MUTED,
              fontSize: 12,
            }}
          >
            返信
          </button>

          {comment.can_delete && (
            <button
              onClick={onDelete}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
                color: TEXT_MUTED,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Trash2 size={12} />
              削除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================================
// 日時フォーマット
// ========================================
function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
