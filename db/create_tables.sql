-- ================================================
-- 小学校データ テーブル定義
-- Supabase SQL Editor で実行してください
-- ================================================

-- スキーマ作成
CREATE SCHEMA IF NOT EXISTS "36_elemental-search";

-- ------------------------------------------------
-- 都道府県マスタ
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS "36_elemental-search".prefectures (
    slug             TEXT PRIMARY KEY,   -- 'hokkaido', 'tokyo' など
    name             TEXT NOT NULL       -- '北海道', '東京都' など
);

-- ------------------------------------------------
-- 市区町村マスタ
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS "36_elemental-search".cities (
    city_code        TEXT PRIMARY KEY,   -- '01101' など
    name             TEXT NOT NULL,      -- '札幌市中央区' など
    prefecture_slug  TEXT REFERENCES "36_elemental-search".prefectures(slug) ON DELETE CASCADE,
    scraped_at       TIMESTAMPTZ         -- スクレイピング完了日時（NULLは未取得）
);

CREATE INDEX IF NOT EXISTS idx_cities_prefecture ON "36_elemental-search".cities(prefecture_slug);

-- ------------------------------------------------
-- minkou.jp 学校マスタ
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS "36_elemental-search".schools (
    school_id        TEXT PRIMARY KEY,
    school_name      TEXT,
    furigana         TEXT,
    prefecture       TEXT,
    city             TEXT,
    address          TEXT,
    nearest_station  TEXT,
    school_type      TEXT,              -- '公立' | '私立' | '国立'
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

CREATE INDEX IF NOT EXISTS idx_schools_prefecture ON "36_elemental-search".schools(prefecture);
CREATE INDEX IF NOT EXISTS idx_schools_city       ON "36_elemental-search".schools(city);
CREATE INDEX IF NOT EXISTS idx_schools_type       ON "36_elemental-search".schools(school_type);

-- ------------------------------------------------
-- minkou.jp 口コミ
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS "36_elemental-search".school_reviews (
    id               BIGSERIAL PRIMARY KEY,
    school_id        TEXT REFERENCES "36_elemental-search".schools(school_id) ON DELETE CASCADE,
    review_url       TEXT UNIQUE,       -- 重複INSERT防止
    poster_type      TEXT,              -- '保護者' | '生徒' | '卒業生'
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

CREATE INDEX IF NOT EXISTS idx_reviews_school_id ON "36_elemental-search".school_reviews(school_id);

-- ------------------------------------------------
-- gaccom.jp 学校マスタ
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS "36_elemental-search".gaccom_schools (
    gaccom_id        TEXT PRIMARY KEY,  -- gaccom の学校ID（URLの数値部分）
    gaccom_url       TEXT,              -- 学校詳細ページURL
    school_name      TEXT,              -- 学校名
    address          TEXT,              -- 所在地
    phone            TEXT,              -- 電話番号
    fax              TEXT,              -- FAX番号
    school_type      TEXT,              -- '公立' | '私立'
    nearest_station  TEXT,              -- 最寄駅
    pref_cd          INTEGER,           -- 都道府県コード（JIS）
    pref_name        TEXT,              -- 都道府県名
    student_count    INTEGER,           -- 児童数
    teacher_count    INTEGER,           -- 教職員数
    linked_jhs       TEXT,              -- 進学先中学校（「、」区切り）
    reporter_text    TEXT,              -- 学校レポーター情報テキスト
    scraped_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gaccom_schools_pref_cd    ON "36_elemental-search".gaccom_schools(pref_cd);
CREATE INDEX IF NOT EXISTS idx_gaccom_schools_school_type ON "36_elemental-search".gaccom_schools(school_type);

-- ------------------------------------------------
-- 学校名寄せ結果
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS "36_elemental-search".school_links (
    school_id    TEXT REFERENCES "36_elemental-search".schools(school_id)          ON DELETE CASCADE,
    gaccom_id    TEXT REFERENCES "36_elemental-search".gaccom_schools(gaccom_id)   ON DELETE CASCADE,
    match_score  NUMERIC(4,3),           -- 0.000 〜 1.000（総合スコア）
    addr_score   NUMERIC(4,3),           -- 住所類似度
    name_score   NUMERIC(4,3),           -- 学校名類似度
    verified     BOOLEAN DEFAULT FALSE,  -- 目視確認済みフラグ
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_id, gaccom_id)
);

CREATE INDEX IF NOT EXISTS idx_school_links_score ON "36_elemental-search".school_links(match_score);
