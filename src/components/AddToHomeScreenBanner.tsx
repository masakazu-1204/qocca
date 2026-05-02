import { useState, useEffect } from 'react';
import { X, Smartphone, Share } from 'lucide-react';

// beforeinstallprompt イベントの型定義
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'qocca_install_banner_dismissed_at';
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7日間
const DELAY_BEFORE_SHOW = 30 * 1000; // 30秒

export default function AddToHomeScreenBanner() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | null>(null);

  useEffect(() => {
    // 既にインストール済みなら表示しない(standalone モードで起動中)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }
    // iOS Safariの「ホーム画面から起動」も判定
    if ((window.navigator as any).standalone === true) {
      return;
    }

    // 過去に閉じた記録があり、7日以内なら表示しない
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION) {
        return;
      }
    }

    // プラットフォーム判定
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);

    if (isIOS) {
      setPlatform('ios');
      // iOSは beforeinstallprompt が発火しないので、タイマーで表示
      const timer = setTimeout(() => setShow(true), DELAY_BEFORE_SHOW);
      return () => clearTimeout(timer);
    }

    if (isAndroid) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Android / PC Chrome:beforeinstallprompt を待つ
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // 30秒経過後に表示
      setTimeout(() => setShow(true), DELAY_BEFORE_SHOW);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (platform === 'ios') {
      // iOS:手順案内モーダルを表示
      setShowIOSGuide(true);
      return;
    }

    if (deferredPrompt) {
      // Android / PC Chrome:インストールプロンプト表示
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShow(false);
  };

  const closeIOSGuide = () => {
    setShowIOSGuide(false);
    handleDismiss(); // 7日間の非表示も適用
  };

  if (!show && !showIOSGuide) return null;

  return (
    <>
      {/* メインバナー */}
      {show && !showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e5e5e5',
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            animation: 'slideUp 0.4s ease-out',
            maxWidth: '600px',
            margin: '0 auto',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                backgroundColor: '#FFF4E6',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Smartphone size={24} color="#F5A94A" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: '4px',
                }}
              >
                🐾 Qoccaをアプリのように使う
              </div>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.4 }}>
                ホーム画面に追加して、いつでもサッと開けるように!
              </div>
            </div>
            <button
              onClick={handleDismiss}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: '#999',
                flexShrink: 0,
              }}
              aria-label="閉じる"
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                backgroundColor: '#F5A94A',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              {platform === 'ios' ? '追加方法を見る' : '📱 ホーム画面に追加'}
            </button>
            <button
              onClick={handleDismiss}
              style={{
                backgroundColor: '#f5f5f5',
                color: '#666',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              今はやめる
            </button>
          </div>
        </div>
      )}

      {/* iOS用手順説明モーダル */}
      {showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={closeIOSGuide}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                ホーム画面に追加する方法
              </h3>
              <button
                onClick={closeIOSGuide}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#999',
                  padding: '4px',
                }}
                aria-label="閉じる"
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ fontSize: '14px', lineHeight: 1.6, color: '#555' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '20px',
                  padding: '12px',
                  backgroundColor: '#FFF4E6',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#F5A94A',
                    color: 'white',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  1
                </div>
                <div style={{ flex: 1 }}>
                  画面下部の<Share size={16} style={{ verticalAlign: 'middle', margin: '0 4px' }} />
                  <strong>共有ボタン</strong>をタップ
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '20px',
                  padding: '12px',
                  backgroundColor: '#FFF4E6',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#F5A94A',
                    color: 'white',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  2
                </div>
                <div style={{ flex: 1 }}>
                  メニューから「<strong>ホーム画面に追加</strong>」をタップ
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '20px',
                  padding: '12px',
                  backgroundColor: '#FFF4E6',
                  borderRadius: '8px',
                }}
              >
                <div
                  style={{
                    backgroundColor: '#F5A94A',
                    color: 'white',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}
                >
                  3
                </div>
                <div style={{ flex: 1 }}>
                  右上の「<strong>追加</strong>」をタップして完了!
                </div>
              </div>

              <div
                style={{
                  fontSize: '12px',
                  color: '#999',
                  textAlign: 'center',
                  marginTop: '16px',
                }}
              >
                💡 Safariでこのページを開いている必要があります
              </div>
            </div>

            <button
              onClick={closeIOSGuide}
              style={{
                width: '100%',
                backgroundColor: '#F5A94A',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '20px',
              }}
            >
              わかりました
            </button>
          </div>
        </div>
      )}

      {/* CSSアニメーション定義 */}
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
