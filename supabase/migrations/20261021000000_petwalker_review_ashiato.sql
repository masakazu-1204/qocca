-- 2026/10/21 ペットウォーカーの口コミに あしあと 5 (King「ドンドン進めて」)。本番に適用済み。
--   口コミは開始から 1 件だけだった。初めての口コミ (人 × 場所で 1 回) に 5、1 日 3 件まで。
--   付与はクライアントの grantPetwalkerReview → RPC grant_free_currency (冪等キー petwalker_review:<user>:<spot>)。
insert into currency_earn_rules (rule_key, amount, daily_cap, is_active) values ('petwalker_review', 5, 3, true)
on conflict (rule_key) do nothing;
