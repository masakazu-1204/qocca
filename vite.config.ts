import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-180.png', 'logo.png'],
      manifest: {
        name: 'Qocca - ペットオーナー専門マーケットプレイス',
        short_name: 'Qocca',
        description: 'うちの子のための特別なものを。似顔絵・ハンドメイド服・フォト撮影・グッズ制作。ペット専門クリエイターが作る、世界にひとつだけの作品。',
        theme_color: '#F5A94A',
        background_color: '#FFFFFF',
        // 2026/6/29 案③ B案実装: 'standalone' → 'minimal-ui' に緩和
        //   - 'standalone' (旧): ホーム画面追加組で iOS 端スワイプ・ブラウザ戻るボタンが無効化
        //     → 戻れない問題の主原因の一つ
        //   - 'minimal-ui' (新): 最小限のブラウザUIを残す (端スワイプ可、戻る/進む可)
        //   - ネイティブアプリ感は若干減るが、ナビゲーション性が大幅改善
        display: 'minimal-ui',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'ja',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5
              }
            }
          }
        ],
        navigateFallbackDenylist: [/^\/api/, /^\/auth/]
      }
    })
  ],
})
