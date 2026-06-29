// 2026/6/29 案① B案実装: フローティング戻るボタン (全長いページ用)
// - スクロール中もずっと押せる位置 (左下 fixed) に「←」ボタンを置き、navigate(-1) で履歴1段戻り
// - TabBar(70px) + iOS safe-area との重なりを回避 (bottom 計算)
// - history.length <= 1 (直接アクセス・SPAでまだ移動してない) なら fallback = '/'
// - 既存の上部「← 戻る」UI / TabBar / popstate ハンドラ は不変、本コンポーネントは単独で動作
// - 静けさデザイン: 半透明 dark + blur、translateY hover、0.3s ease

import { useNavigate } from "react-router-dom";
import { useState } from "react";

type Props = {
  /** クリック時のカスタム挙動 (省略時は navigate(-1) → 履歴がなければ '/' へ) */
  onClick?: () => void;
  /** TabBar表示中は重ねないよう少し上に逃がす (デフォルト true) */
  aboveTabBar?: boolean;
  /**
   * 2026/6/29 追加: 下部固定バー(注文バー等)と干渉する画面用の手動オフセット。
   * 指定すると aboveTabBar の挙動を上書きし、bottom = calc(${bottomOffset}px + safe-area)
   * 例: DetailPage の注文バー(高さ~90px+safe-area)を避けるなら 120 程度を渡す。
   */
  bottomOffset?: number;
  /** 表示位置 (デフォルト 'left') */
  side?: 'left' | 'right';
  /** aria-label (デフォルト "戻る") */
  label?: string;
};

export const FloatingBackButton = ({
  onClick,
  aboveTabBar = true,
  bottomOffset,
  side = 'left',
  label = '戻る',
}: Props) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    if (onClick) { onClick(); return; }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  // 優先順位: bottomOffset (明示) > aboveTabBar (TabBar高 80px) > デフォルト (16px)
  // すべて safe-area-inset-bottom を加算してホームインジケータ機に対応。
  const bottomCalc = typeof bottomOffset === 'number'
    ? `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`
    : aboveTabBar
      ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
      : 'calc(16px + env(safe-area-inset-bottom, 0px))';

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      aria-label={label}
      style={{
        position: 'fixed',
        [side]: 16,
        bottom: bottomCalc,
        zIndex: 100,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'rgba(44, 41, 38, 0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        color: '#fff',
        fontSize: 20,
        fontWeight: 400,
        lineHeight: 1,
        cursor: 'pointer',
        boxShadow: hovered
          ? '0 6px 18px rgba(0, 0, 0, 0.24)'
          : '0 4px 14px rgba(0, 0, 0, 0.18)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: pressed ? 'scale(0.94)' : (hovered ? 'translateY(-1px)' : 'translateY(0)'),
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease',
        fontFamily: 'inherit',
        padding: 0,
        // iOS Safari の "Add to Home" PWA の display 緩和(案③)と合わせて、
        // 端スワイプが効かないケースでもこのボタンが必ず存在する保険になる。
      }}
    >
      ←
    </button>
  );
};
