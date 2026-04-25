import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://qufrqkuipzuqeqkvuhkx.supabase.co",
  "sb_publishable_TWEGFx7kfggQffOSzs31Jg_J3yYZqou"
);

const C = {
  orange: "#F5A94A",
  orangePale: "#FFF3E0",
  dark: "#333",
  gray: "#888",
  warmGray: "#666",
  white: "#fff",
  green: "#4CAF50",
};

export const ReviewModal = ({ order, onClose, onSubmit }: {
  order: any;
  onClose: () => void;
  onSubmit: () => void;
}) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    await supabase.from("reviews").insert({
      order_id: order.id,
      reviewer_id: user.id,
      seller_id: order.seller_id,
      listing_id: order.listing_id,
      rating,
      comment,
    });

    setLoading(false);
    setDone(true);
    onSubmit();
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.white, borderRadius:"24px 24px 0 0", padding:"28px 24px", width:"100%", maxWidth:500, maxHeight:"80vh", overflowY:"auto" }}>
        {done ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>⭐</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.dark, marginBottom:8 }}>レビューを送信しました</div>
            <div style={{ fontSize:13, color:C.warmGray, marginBottom:20 }}>ありがとうございました！</div>
            <button onClick={onClose} style={{ padding:"12px 32px", background:C.orange, border:"none", borderRadius:12, color:C.white, fontWeight:800, fontSize:16, cursor:"pointer", fontFamily:"inherit" }}>閉じる</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <div style={{ fontSize:17, fontWeight:900, color:C.dark }}>⭐ レビューを書く</div>
              <button onClick={onClose} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:C.gray }}>×</button>
            </div>

            <div style={{ fontSize:13, color:C.warmGray, marginBottom:16 }}>評価</div>
            <div style={{ display:"flex", gap:8, marginBottom:24 }}>
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  style={{ fontSize:36, background:"none", border:"none", cursor:"pointer", opacity: (hovered || rating) >= s ? 1 : 0.3, transition:"opacity 0.1s" }}
                >⭐</button>
              ))}
            </div>

            <div style={{ fontSize:13, color:C.warmGray, marginBottom:8 }}>コメント（任意）</div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="取引の感想を書いてください..."
              maxLength={300}
              style={{ width:"100%", minHeight:100, padding:"10px 12px", borderRadius:10, border:"1.5px solid #eee", fontSize:14, fontFamily:"inherit", resize:"vertical", boxSizing:"border-box" }}
            />
            <div style={{ fontSize:11, color:C.gray, textAlign:"right", marginBottom:20 }}>{comment.length}/300</div>

            <button
              onClick={handleSubmit}
              disabled={rating === 0 || loading}
              style={{ width:"100%", padding:"14px", background: rating === 0 ? "#ccc" : C.orange, border:"none", borderRadius:12, color:C.white, fontWeight:800, fontSize:16, cursor: rating === 0 ? "not-allowed" : "pointer", fontFamily:"inherit" }}
            >
              {loading ? "送信中..." : "レビューを送信する"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
