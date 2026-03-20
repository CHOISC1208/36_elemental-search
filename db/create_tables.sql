-- ================================================
-- minkou.jp 小学校データ テーブル定義
-- Supabase SQL Editor で実行してください
-- ================================================

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS "36_elemental-search";

-- 都道府県マスタ
CREATE TABLE IF NOT EXISTS "36_elemental-search".prefectures (
    slug             TEXT PRIMARY KEY,   -- 'hokkaido', 'tokyo' など
    name             TEXT NOT NULL       -- '北海道', '東京都' など
);

-- 市区町村マスタ
CREATE TABLE IF NOT EXISTS "36_elemental-search".cities (
    city_code        TEXT PRIMARY KEY,   -- '01101' など
    name             TEXT NOT NULL,      -- '札幌市中央区' など
    prefecture_slug  TEXT REFERENCES "36_elemental-search".prefectures(slug) ON DELETE CASCADE,
    scraped_at       TIMESTAMPTZ         -- スクレイピング完了日時（NULLは未取得）
);

-- 既存テーブルへのカラム追加（再実行時用）
ALTER TABLE "36_elemental-search".cities
    ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cities_prefecture ON "36_elemental-search".cities(prefecture_slug);

-- 学校マスタ
CREATE TABLE IF NOT EXISTS "36_elemental-search".schools (
    school_id        TEXT PRIMARY KEY,
    school_name      TEXT,
    furigana         TEXT,
    prefecture       TEXT,
    city             TEXT,
    address          TEXT,
    nearest_station  TEXT,
    school_type      TEXT,          -- '公立' | '私立' | '国立'
    uniform          TEXT,
    lunch            TEXT,
    events           TEXT,
    tuition          TEXT,
    selection        TEXT,
    selection_method TEXT,
    rating_avg       NUMERIC(4,2),
    review_count     INTEGER DEFAULT 0,
    scraped_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 口コミ
CREATE TABLE IF NOT EXISTS "36_elemental-search".school_reviews (
    id               BIGSERIAL PRIMARY KEY,
    school_id        TEXT REFERENCES "36_elemental-search".schools(school_id) ON DELETE CASCADE,
    review_url       TEXT UNIQUE,   -- 重複INSERT防止
    poster_type      TEXT,          -- '保護者' | '生徒' | '卒業生'
    enrollment_year  INTEGER,
    post_date        TEXT,
    title            TEXT,
    rating_overall   NUMERIC(3,1),
    rating_policy    NUMERIC(3,1),
    rating_class     NUMERIC(3,1),
    rating_teacher   NUMERIC(3,1),
    rating_facility  NUMERIC(3,1),
    rating_access    NUMERIC(3,1),
    rating_pta       NUMERIC(3,1),
    rating_events    NUMERIC(3,1),
    text_overall     TEXT,
    text_policy      TEXT,
    text_class       TEXT,
    text_facility    TEXT,
    text_access      TEXT,
    text_pta         TEXT,
    text_events      TEXT,
    text_commute     TEXT,
    scraped_at       TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（不動産スコアリングで都道府県・市区町村検索が多いため）
CREATE INDEX IF NOT EXISTS idx_schools_prefecture ON "36_elemental-search".schools(prefecture);
CREATE INDEX IF NOT EXISTS idx_schools_city       ON "36_elemental-search".schools(city);
CREATE INDEX IF NOT EXISTS idx_schools_type       ON "36_elemental-search".schools(school_type);
CREATE INDEX IF NOT EXISTS idx_reviews_school_id  ON "36_elemental-search".school_reviews(school_id);
