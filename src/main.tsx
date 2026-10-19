import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startPwaUpdates } from './lib/pwaUpdate'

// 2026/10/19 携帯で古い画面のままになる問題: 新しい版が届いたら、画面移動か 10 分以上離れて戻ったときに切り替える
startPwaUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
