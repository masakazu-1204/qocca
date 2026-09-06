---
name: token-efficiency
description: Qoccaプロジェクトでの全作業に常時適用するトークン節約ルール。ファイル読み込み・Supabase MCP調査・報告文・コンテキスト管理・依頼書対応の5領域で消費を最小化する。セッション開始時と、大きなファイルを読む前・DB調査を始める前・報告を書く前に必ず参照。⚠️ 安全 > 節約: 99-safety-protocol の確認SELECT・WHERE限定・3点セットは絶対に省略しない。
---

# トークン節約スキル (token-efficiency)

> 原則: **安全 > 節約**。99-safety-protocol の安全手順(確認SELECT→実行→結果確認、WHERE限定、防御対象非接触の検証)は節約対象外。削るのは「重複・全読み・冗長報告」だけ。

---

## A. 読み込み最小化(汎用)

### A-1. 全ファイルcat禁止 → grep→範囲Read
- 巨大ファイル(App.tsx 約6276行 / home.tsx 3900行+ / marketplace.tsx 2400行+)は**絶対に全読みしない**
- 手順: `Grep -n "シンボル名"` で行特定 → `Read offset/limit` で該当±20行だけ読む
- なぜ: home.tsx 全読み=約50k tokens。grep+範囲読みなら1-2k tokensで同じ結論に着ける(96%削減)

**Before**: `Read home.tsx` (3900行全部)
**After**: `Grep -n "SectionQuietlyLoved" home.tsx` → `Read offset:2235 limit:60`

### A-2. ディレクトリ構造は初回のみ
- `ls` / `Glob` での構造把握はセッション初回のみ。以後は記憶を使う
- ファイルの存在確認が必要な時だけピンポイントで `Glob 特定パターン`

### A-3. 編集後の再読み禁止
- Edit/Write 成功後にファイルを Read し直さない(ツールが失敗時はエラーを返す)

## B. Supabase MCP調査の効率化(Qocca特化)★最重要

### B-1. スキーマ確認は記憶を一次ソースに
- `list_tables` / information_schema の再確認を毎回しない。既知の確定事実:
  - `stripe_payment_intent_id` / `stripe_transfer_id` (**両方 e 付き**。strip_ は過去資料の誤記)
  - x_posts: `content` / `tweet_id` (tweet_text は無い)
  - instagram_post_templates: `caption_template` / `image_prompt` (template_key は無い)
  - pet_walker_spots: `approval_status` (status では無い)
  - events: `updated_at` は**無い** (id/event_date/status/created_at/approval_status)
  - metrics_daily: PK は `snapshot_date`
- 未知テーブルに触る時だけ information_schema.columns を1回引く → 結果を以後のターンで使い回す

### B-2. SELECT は1ターンにまとめて並列発行
- 独立した確認クエリは**1メッセージで複数 execute_sql を同時に**投げる(往復削減)
- 関連する集計は UNION ALL で1クエリに束ねる(ただし GROUP BY エイリアス衝突に注意 → `GROUP BY 2` か サブクエリで包む)

### B-3. SELECT * 禁止・LIMIT 必須
- 必要カラムだけ指定。プレビューは `LEFT(col, 40)` + `LIMIT 5-8`
- なぜ: instagram_post_templates の SELECT * は caption 全文×112行で数万tokens吹き飛ぶ

### B-4. 巨大MCP応答の予防
- `get_advisors` は **100k文字級**。件数確認だけなら前回結果ファイルを grep、再取得は「変化を確認する必要がある時」だけ
- `list_deployments` も50k級。最新1件の状態確認なら `get_project` (latestDeployment入り) で足りる
- 応答がファイル保存された場合は **grep で必要行だけ抽出**(全文読み・全文スライス禁止)

### B-5. Edge Function 本文は1回だけ
- `get_edge_function` の結果(コード全文)は同セッション内で再取得しない。要点(入力/出力/ガード)をその場で記録して使い回す

## C. 報告の圧縮(汎用)

### C-1. 前置き・気遣い文を削る
- 「〜を確認しますね」「素晴らしいです」等の儀礼文なし。結論→根拠→次アクションの順で即入る

### C-2. 表形式で密度を上げる
- Before/After・検証結果は表1つに集約。同じ情報を本文と表で二度書きしない

### C-3. 全文貼り禁止(件数+代表例)
- grep結果・SQL結果は「N件、代表: xxx」で足りる。全文は King が求めた時だけ
- 「実行したSQL全文」欄は依頼書が明示要求した時のみ。通常は操作種別と件数(例: UPDATE 2文 / SELECT 5本)

### C-4. コミットメッセージとPR本文の重複削減
- 詳細はPR本文に書き、コミットメッセージは要約+PR参照で済ませる(同内容の二重貼りをしない)

## D. コンテキスト管理(汎用)

### D-1. 確定事実は再調査しない
- 一度確認した事実(kill_switch状態、テンプレ件数、ルート定義、カラム構造)は同セッション内で再SELECT しない。変化しうるもの(投稿status等)だけ再確認
- 例外: 書き込み操作の直前確認は 99-safety-protocol に従い必ず行う(安全 > 節約)

### D-2. セッション肥大時の自己要約
- 長セッションでは「確定事実・進行中タスク・未解決」を3-5行で自己要約し、それ以前の詳細履歴に依存しない状態を保つ

### D-3. バックグラウンド出力・保存ファイルは grep で拾う
- tool-results に保存された大出力は必要キーだけ grep。「全部読んで要約」をしない

## E. 依頼書対応の効率化(Qocca特化)

### E-1. Step順に淡々と処理
- ワイ(Claude.ai)の依頼書は構造化済み。Step1→2→3の順で実行し、**中間の確認往復を作らない**(King判断が必要な分岐だけ停止)

### E-2. 報告は指定フォーマットに忠実
- 依頼書の「報告フォーマット」の項目**だけ**を、その順で書く。余計な追加考察・重複サマリを足さない
- 「🛡️ 99-safety-protocol 厳守」の遵守確認セクションは維持(これは削らない)

### E-3. 調査のみタスクで変更提案を混ぜない
- 「調査のみ」指示では調査結果+選択肢提示まで。実装コード案の全文を先回りで書かない(GO後に書く)

---

## 自戒リスト(実際にやらかした無駄・再発防止)

1. **home.tsx を複数回長距離Read** → grep+範囲読みで足りた
2. **get_advisors を同日2回フル取得**(109k×2) → 2回目は件数grepだけで良かった
3. **list_deployments フル取得**(50k) → get_project の latestDeployment で足りた
4. **コミットメッセージとPR本文がほぼ同文で二重** → PR参照方式へ
5. **kill_switch / テンプレ状態を同セッションで再SELECT** → 変化イベントが無い限り記憶を使う
