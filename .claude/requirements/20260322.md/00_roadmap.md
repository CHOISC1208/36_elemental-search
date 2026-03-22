# 実装ロードマップ（2026-03-22）

## 推奨着手順序

| 順序 | 機能 | 工数目安 | 難易度 | 依存 |
|------|------|---------|--------|------|
| 1st | ④ 学校名検索強化 | 半日〜1日 | ★☆☆ | なし |
| 2nd | ② 口コミキーワード検索 | 1〜2日 | ★★☆ | `utils/highlight.ts`（④で作成） |
| 3rd | ③ 学校分布ページ | 1〜2日 | ★★☆ | Supabase RPC作成が必要 |
| 4th | ⑤ カテゴリ別ランキング | 2〜3日 | ★★★ | Supabase RPC/ビュー作成が必要 |

## Supabase で先に実行すべきSQL

### ③ 分布用RPC（先に実行）
```sql
-- docs/sql/get_school_count_by_prefecture.sql 参照
CREATE OR REPLACE FUNCTION get_school_count_by_prefecture() ...
CREATE OR REPLACE FUNCTION get_school_count_by_city(pref_name TEXT) ...
```

### ⑤ ランキング用ビュー（先に実行）
```sql
-- docs/sql/school_rating_summary.sql 参照
CREATE MATERIALIZED VIEW school_rating_summary AS ...
REFRESH MATERIALIZED VIEW school_rating_summary;
```

## 新規ファイル一覧

```
app/
├── stats/page.tsx               ③ 分布ページ
└── ranking/page.tsx             ⑤ ランキングページ

components/
├── search/
│   ├── ReviewSearchBox.tsx      ② 口コミ検索UI
│   ├── ReviewSearchResults.tsx  ② 検索結果
│   └── SchoolNameAutocomplete.tsx ④ オートコンプリート
├── stats/
│   ├── PrefectureBarChart.tsx   ③ 都道府県グラフ
│   ├── CityBarChart.tsx         ③ 市区町村グラフ
│   └── DistributionTable.tsx    ③ 分布表
└── ranking/
    ├── WeightSlider.tsx         ⑤ ウェイトスライダー
    └── RankingCard.tsx          ⑤ ランキングカード

hooks/
├── useReviewSearch.ts           ②
├── useSchoolDistribution.ts     ③
├── useRankingData.ts            ⑤
└── useDebouncedValue.ts         ④（共通）

store/
└── rankingStore.ts              ⑤ Zustandストア

utils/
└── highlight.ts                 ② ④ 共通ハイライト

docs/sql/
├── get_school_count_by_prefecture.sql   ③
├── get_school_count_by_city.sql         ③
└── school_rating_summary.sql            ⑤
```

## 既存ファイルの修正箇所

| ファイル | 修正内容 |
|---------|---------|
| `hooks/useSchools.ts` | furigana検索対応、デバウンス対応 |
| `components/search/SearchBox.tsx` | 学校名入力をオートコンプリートに置き換え |
| `app/page.tsx` | 「口コミで探す」タブ追加 |
| ヘッダーコンポーネント | `/stats` `/ranking` のナビリンク追加 |
