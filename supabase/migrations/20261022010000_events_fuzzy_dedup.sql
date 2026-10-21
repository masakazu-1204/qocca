-- 2026/10/22 イベントの表記ゆれ重複をまとめる
--
-- 収集先を 7 → 43 に増やしたら、同じイベントがサイトごとに少しずつ違う名前で入るようになった
--   例: 「ジャパンわんこフェスタ2026秋」/「ジャパンわんこフェスタ2026 秋 in お台場」
--       「Shiba Festival 2026 Autumn」/「Shiba Festival 2026 Autumn（埼玉）」
-- scraper の重複判定は「名前(空白除去) + 開催日」の完全一致なので、ここでは拾えない。
--
-- 判定: 同じ開催日・同じ都道府県 (片方が 全国/未指定 でも可) で、名前の芯が
--   完全一致、または 8 文字以上あって片方がもう片方を含む
--   名前の芯 = 括弧の中身・年・記号・空白・絵文字・"in" を除いて小文字化したもの
--   8 文字未満の包含は使わない (「保護猫の譲渡会」と「ライカム 保護猫の譲渡会」のような別イベントを守るため)
-- 残す: 説明と会場の情報が多いほう (同じなら先に入ったほう)
-- 落とす: 削除せず status/approval_status = 'rejected' にする。削除すると重複判定の記録 (event_dedup_hashes) も
--   消え、次の収集で同じものがまた入る。落とした行は開催日が過ぎたら events-mark-ended-daily が消す。
-- 対象: 自動収集 (ai_scraped・organizer_id なし) の公開中のものだけ。住民の投稿と管理者登録は触らない。

create or replace function public.event_title_key(t text) returns text
language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(lower(coalesce(t, '')), '[（(【\[][^）)】\]]*[）)】\]]', '', 'g'),
             '20[0-9]{2}|\min\M', '', 'g'),
           '[^0-9a-zぁ-んァ-ヶー一-龠々〆]', '', 'g')
$$;

create or replace function public.dedupe_events_fuzzy() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with x as (
    select id, event_date, prefecture, created_at,
           coalesce(length(description), 0) + coalesce(length(place), 0) as info,
           public.event_title_key(title) as k
    from events
    where status = 'approved' and organizer_id is null and source_type = 'ai_scraped'
      and coalesce(end_date, event_date) >= (now() at time zone 'Asia/Tokyo')::date
  ), pairs as (
    select a.id a_id, b.id b_id, a.info a_info, b.info b_info, a.created_at a_at, b.created_at b_at
    from x a join x b on a.event_date = b.event_date and a.id < b.id
    where (a.prefecture = b.prefecture or a.prefecture in ('全国','未指定') or b.prefecture in ('全国','未指定'))
      and length(a.k) >= 4 and length(b.k) >= 4
      and (a.k = b.k or (least(length(a.k), length(b.k)) >= 8 and (position(a.k in b.k) > 0 or position(b.k in a.k) > 0)))
  ), losers as (
    select distinct case when a_info > b_info or (a_info = b_info and a_at <= b_at) then b_id else a_id end as id
    from pairs
  )
  update events e set status = 'rejected', approval_status = 'rejected'
  from losers l where e.id = l.id;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.dedupe_events_fuzzy() from public, anon, authenticated;

-- 収集 (毎日 3:00 JST) のあと 3:40 JST に回す
select cron.schedule('events-fuzzy-dedup-daily', '40 18 * * *', $$select public.dedupe_events_fuzzy();$$);

-- 毎月 URL が変わる収集先 (月ごとのまとめ記事) を自動で入れ替える
--   ワンクォール: magazine.cainz.com/wanqol/articles/{地域_}dogevent_{英語の月}_{年}
--   happyplace:  happyplace.pet/event/{年}0{月2桁}/   (2026 年 11 月 = 2026011)
--   ラテチャンネル: lattechannel.com/event_{年}_{月2桁}/
-- 毎月 20 日と 1 日に、今月と来月のページを登録し (まだ無いページは収集時に 404 になるだけ)、先月以前のページを止める
create or replace function public.rotate_monthly_event_sources() returns integer
language plpgsql security definer set search_path = public as $$
declare
  m date;
  n integer := 0;
  r record;
begin
  foreach m in array array[date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date,
                           (date_trunc('month', (now() at time zone 'Asia/Tokyo')) + interval '1 month')::date] loop
    for r in
      select * from (values
        ('ワンクォール ' || to_char(m, 'FMMM') || '月 全国ドッグイベント', 'https://magazine.cainz.com/wanqol/articles/dogevent_' || to_char(m, 'FMmonth') || '_' || to_char(m, 'YYYY'), '全国'),
        ('ワンクォール ' || to_char(m, 'FMMM') || '月 関東', 'https://magazine.cainz.com/wanqol/articles/kanto_dogevent_' || to_char(m, 'FMmonth') || '_' || to_char(m, 'YYYY'), '関東'),
        ('ワンクォール ' || to_char(m, 'FMMM') || '月 関西', 'https://magazine.cainz.com/wanqol/articles/kansai_dogevent_' || to_char(m, 'FMmonth') || '_' || to_char(m, 'YYYY'), '関西'),
        ('ワンクォール ' || to_char(m, 'FMMM') || '月 中部・東海', 'https://magazine.cainz.com/wanqol/articles/tokai_dogevent_' || to_char(m, 'FMmonth') || '_' || to_char(m, 'YYYY'), '東海'),
        ('ワンクォール ' || to_char(m, 'FMMM') || '月 中国・四国', 'https://magazine.cainz.com/wanqol/articles/chushikoku_dogevent_' || to_char(m, 'FMmonth') || '_' || to_char(m, 'YYYY'), '中国四国'),
        ('happyplace ' || to_char(m, 'FMMM') || '月 全国の犬イベント', 'https://happyplace.pet/event/' || to_char(m, 'YYYY') || '0' || to_char(m, 'MM') || '/', '全国'),
        ('ラテチャンネル ' || to_char(m, 'FMMM') || '月 全国の犬イベント', 'https://lattechannel.com/event_' || to_char(m, 'YYYY') || '_' || to_char(m, 'MM') || '/', '全国')
      ) v(name, url, prefecture)
    loop
      insert into event_sources (name, url, prefecture, is_active, scrape_frequency)
      values (r.name, r.url, r.prefecture, true, 'weekly')
      on conflict (url) do nothing;
      if found then n := n + 1; end if;
    end loop;
  end loop;

  -- 先月以前の月別ページを止める (URL に入っている年月が今月より前のもの)
  update event_sources set is_active = false
  where is_active and (
    (url ~ '^https://magazine\.cainz\.com/wanqol/articles/([a-z]+_)?dogevent_[a-z]+_[0-9]{4}$'
      and to_date(substring(url from 'dogevent_([a-z]+_[0-9]{4})$'), 'FMmonth_YYYY') < date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date)
    or (url ~ '^https://happyplace\.pet/event/[0-9]{7}/$'
      and to_date(substring(url from '/event/([0-9]{4})0') || substring(url from '/event/[0-9]{4}0([0-9]{2})/'), 'YYYYMM') < date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date)
    or (url ~ '^https://lattechannel\.com/event_[0-9]{4}_[0-9]{2}/$'
      and to_date(substring(url from 'event_([0-9]{4}_[0-9]{2})/'), 'YYYY_MM') < date_trunc('month', (now() at time zone 'Asia/Tokyo'))::date)
  );
  return n;
end $$;

revoke all on function public.rotate_monthly_event_sources() from public, anon, authenticated;

-- 毎月 1 日と 20 日の 2:00 JST (収集の 1 時間前)
select cron.schedule('event-sources-monthly-rotate', '0 17 1,20 * *', $$select public.rotate_monthly_event_sources();$$);
