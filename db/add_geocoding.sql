-- ================================================
-- 半径検索対応: 学校テーブルに緯度・経度を追加
-- Supabase SQL Editor で実行してください
-- ================================================

-- 1. schools テーブルに緯度・経度カラムを追加
ALTER TABLE "36_elemental-search".schools
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. 空間クエリ用インデックス
CREATE INDEX IF NOT EXISTS idx_schools_location
  ON "36_elemental-search".schools(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 3. 半径検索 RPC 関数（Haversine 公式）
--    引数: center_lat, center_lng (WGS84), radius_km
--    戻り値: schools の全カラム + distance_km（距離順ソート済み）
CREATE OR REPLACE FUNCTION "36_elemental-search".schools_within_radius(
  center_lat  DOUBLE PRECISION,
  center_lng  DOUBLE PRECISION,
  radius_km   DOUBLE PRECISION
)
RETURNS TABLE (
  school_id        TEXT,
  school_name      TEXT,
  furigana         TEXT,
  prefecture       TEXT,
  city             TEXT,
  address          TEXT,
  nearest_station  TEXT,
  school_type      TEXT,
  uniform          TEXT,
  lunch            TEXT,
  events           TEXT,
  tuition          TEXT,
  selection        TEXT,
  selection_method TEXT,
  rating_avg       NUMERIC,
  review_count     INTEGER,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  distance_km      DOUBLE PRECISION
) AS $$
  SELECT
    s.school_id,
    s.school_name,
    s.furigana,
    s.prefecture,
    s.city,
    s.address,
    s.nearest_station,
    s.school_type,
    s.uniform,
    s.lunch,
    s.events,
    s.tuition,
    s.selection,
    s.selection_method,
    s.rating_avg,
    s.review_count,
    s.latitude,
    s.longitude,
    6371.0 * acos(
      LEAST(1.0,
        cos(radians(center_lat)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(center_lng)) +
        sin(radians(center_lat)) * sin(radians(s.latitude))
      )
    ) AS distance_km
  FROM "36_elemental-search".schools s
  WHERE
    s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND 6371.0 * acos(
      LEAST(1.0,
        cos(radians(center_lat)) * cos(radians(s.latitude)) *
        cos(radians(s.longitude) - radians(center_lng)) +
        sin(radians(center_lat)) * sin(radians(s.latitude))
      )
    ) <= radius_km
  ORDER BY distance_km ASC
$$ LANGUAGE sql STABLE;
