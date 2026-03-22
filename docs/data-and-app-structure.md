# データ構造・アプリ構成まとめ

> UI変更作業の参考用（2026-03-22時点）

---

## 1. データベース（Supabase）

スキーマ名: `36_elemental-search`

### テーブル一覧

#### `prefectures` — 都道府県マスタ
| カラム | 型 | 説明 |
|-------|-----|------|
| slug | TEXT PK | `hokkaido`, `tokyo` など |
| name | TEXT | `北海道`, `東京都` など |

#### `cities` — 市区町村マスタ
| カラム | 型 | 説明 |
|-------|-----|------|
| city_code | TEXT PK | `01101` など |
| name | TEXT | `札幌市中央区` など |
| prefecture_slug | TEXT FK | → prefectures.slug |
| scraped_at | TIMESTAMPTZ | 取得完了日時（NULL=未取得） |

#### `schools` — 学校マスタ（minkou.jp）
| カラム | 型 | 説明 |
|-------|-----|------|
| school_id | TEXT PK | minkou の学校ID |
| school_name | TEXT | 学校名 |
| furigana | TEXT | ふりがな |
| prefecture | TEXT | 都道府県名（例: `東京都`） |
| city | TEXT | 市区町村名 |
| address | TEXT | 住所 |
| nearest_station | TEXT | 最寄駅 |
| school_type | TEXT | `公立` / `私立` / `国立` |
| uniform | TEXT | 制服情報 |
| lunch | TEXT | 給食情報 |
| events | TEXT | 学校行事 |
| tuition | TEXT | 授業料 |
| selection | TEXT | 選抜有無 |
| selection_method | TEXT | 選抜方法 |
| rating_avg | NUMERIC(4,2) | 総合評価平均 |
| review_count | INTEGER | 口コミ数 |
| scraped_at | TIMESTAMPTZ | 取得日時 |

#### `school_reviews` — 口コミ（minkou.jp）
| カラム | 型 | 説明 |
|-------|-----|------|
| id | BIGSERIAL PK | |
| school_id | TEXT FK | → schools.school_id |
| review_url | TEXT UNIQUE | 重複防止 |
| poster_type | TEXT | `保護者` / `生徒` / `卒業生` |
| enrollment_year | INTEGER | 在籍年 |
| post_date | TEXT | 投稿日 |
| title | TEXT | タイトル |
| rating_overall | NUMERIC(3,1) | 総合評価 |
| rating_policy | NUMERIC(3,1) | 方針・校風 |
| rating_class | NUMERIC(3,1) | 授業 |
| rating_teacher | NUMERIC(3,1) | 先生 |
| rating_facility | NUMERIC(3,1) | 施設 |
| rating_access | NUMERIC(3,1) | アクセス |
| rating_pta | NUMERIC(3,1) | PTA |
| rating_events | NUMERIC(3,1) | 行事 |
| text_overall | TEXT | 総合コメント |
| text_policy | TEXT | 方針コメント |
| text_class | TEXT | 授業コメント |
| text_facility | TEXT | 施設コメント |
| text_access | TEXT | アクセスコメント |
| text_pta | TEXT | PTAコメント |
| text_events | TEXT | 行事コメント |
| text_commute | TEXT | 通学コメント |

#### `gaccom_schools` — 学校マスタ（gaccom.jp）
| カラム | 型 | 説明 |
|-------|-----|------|
| gaccom_id | TEXT PK | gaccom の学校ID |
| gaccom_url | TEXT | 詳細ページURL |
| school_name | TEXT | 学校名 |
| address | TEXT | 所在地 |
| phone | TEXT | 電話番号 |
| fax | TEXT | FAX番号 |
| school_type | TEXT | `公立` / `私立` |
| nearest_station | TEXT | 最寄駅 |
| pref_cd | INTEGER | 都道府県コード（JIS） |
| pref_name | TEXT | 都道府県名 |
| student_count | INTEGER | 児童数 |
| teacher_count | INTEGER | 教職員数 |
| linked_jhs | TEXT | 進学先中学校（`、`区切り） |
| reporter_text | TEXT | 学校レポーター情報 |

#### `school_links` — minkou ↔ gaccom 名寄せ結果
| カラム | 型 | 説明 |
|-------|-----|------|
| school_id | TEXT FK PK | → schools.school_id |
| gaccom_id | TEXT FK PK | → gaccom_schools.gaccom_id |
| match_score | NUMERIC(4,3) | 総合スコア（0〜1） |
| addr_score | NUMERIC(4,3) | 住所類似度 |
| name_score | NUMERIC(4,3) | 学校名類似度 |
| verified | BOOLEAN | 目視確認済みフラグ |
| created_at | TIMESTAMPTZ | |

---

## 2. フロントエンド（Next.js 15 / React 18）

### ページ構成

| URL | ファイル | 役割 |
|-----|---------|------|
| `/` | `app/page.tsx` | 検索トップ・結果一覧 |
| `/schools/[schoolId]` | `app/schools/[schoolId]/page.tsx` | 学校詳細 |
| `/compare` | `app/compare/page.tsx` | 学校比較（最大3校） |

### コンポーネント構成

```
components/
├── search/
│   ├── SearchBox.tsx       都道府県・市区町村・学校名・フィルター入力
│   ├── FilterChips.tsx     適用中フィルターのチップ表示・削除
│   └── PopularAreas.tsx    人気エリアのショートカット
├── school/
│   ├── SchoolCard.tsx      検索結果カード（名前・評価・比較追加ボタン）
│   ├── SchoolHero.tsx      詳細ページのヘッダー（名前・評価・基本情報）
│   ├── SchoolSpecs.tsx     学校情報タブ（制服・給食・行事・選抜等）
│   ├── ReviewList.tsx      口コミ一覧
│   └── RatingRadar.tsx     評価レーダーチャート（7カテゴリ）
├── compare/
│   ├── CompareBar.tsx      画面下部の比較選択バー
│   ├── CompareTable.tsx    比較テーブル
│   └── CompareSummary.tsx  比較サマリー
└── ui/
    ├── Badge.tsx            ラベルバッジ（公立/私立等）
    ├── StarRating.tsx       星評価表示
    └── ScoreBar.tsx         スコアバー（カテゴリ別評価）
```

### 状態管理

- **Zustand** (`compareStore.ts`) — 比較リスト（最大3校）をグローバル管理
  - `schools`: 比較中の学校リスト
  - `add(school)` / `remove(schoolId)` / `clear()`
  - `canAdd`: 3校未満かどうか

### データ取得（Hooks）

| Hook | 取得内容 | 主なフィルター |
|------|---------|--------------|
| `useSchools(params)` | 学校一覧（上限50件） | 都道府県名・市区町村コード・学校名・学校種別・給食・制服・ソート |
| `useSchoolDetail(schoolId)` | 学校詳細 + 口コミ一覧 | school_id |
| `usePrefectures()` | 都道府県一覧 | なし |
| `usePrefCities(prefSlug)` | 市区町村一覧 | prefecture_slug |

### 検索パラメータ（`SearchParams`）

```ts
{
  prefecture_slug: string    // 'tokyo' など
  prefecture_name: string    // '東京都' など（DB検索に使用）
  city_code: string          // '13101' など
  school_name: string        // 部分一致
  school_type: '公立' | '私立' | '国立' | ''
  has_lunch: boolean
  has_uniform: boolean
  sort: 'rating' | 'reviews' | 'station'
}
```

> 注: `sort: 'station'` はUIに選択肢はあるが、現時点でソートロジック未実装

### 学校詳細タブ構成

| タブ | 表示内容 |
|-----|---------|
| 評価・口コミ | レーダーチャート + カテゴリ別スコアバー + 口コミ一覧 |
| 学校情報 | 制服・給食・行事・授業料・選抜方法等 |
| 進学先 | linked_jhs（中学校名を`、`区切りでバッジ表示） |

---

## 3. 現状の制限・未実装

- `sort: 'station'`（最寄駅順）はUIにあるがソート未実装
- `school_reviews` の `text_*` カラムのうち `text_overall` のみフロントで使用（他は取得していない）
- `gaccom_schools` の `student_count`, `teacher_count`, `linked_jhs` は `schools` 型に `?` で結合想定だが、現在のクエリは `schools` テーブル単体のみ取得（`school_links` JOIN なし）
- 認証なし（Auth0追加予定）
