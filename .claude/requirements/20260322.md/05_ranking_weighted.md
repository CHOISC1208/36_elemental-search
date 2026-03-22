# ⑤　カテゴリ別ランキング（ウェイト調整機能付き） — 実装指示書

> 対象: Claude Code / 実装担当エンジニア  
> 作成日: 2026-03-22  
> 前提: Next.js 15 / Supabase / Zustand（既存）

---

## 概要

ユーザーが各評価カテゴリのウェイトをスライダーで調整し、
独自の重み付けスコアで学校をランキングできるページを作成する。

**新規ページ**: `/ranking`

---

## 1. ランキングスコアの計算式

### 使用するカラム（`school_reviews` の平均 → `schools` に集約済みと仮定、または都度集計）

| カテゴリ名 | DBカラム | UIラベル |
|-----------|---------|---------|
| 方針・校風 | `rating_policy` | 方針・校風 |
| 授業 | `rating_class` | 授業・学習 |
| 先生 | `rating_teacher` | 先生 |
| 施設・セキュリティ | `rating_facility` | 施設 |
| アクセス・立地 | `rating_access` | 立地・アクセス |
| 保護者関係(PTA) | `rating_pta` | PTA・保護者 |
| イベント | `rating_events` | 行事・イベント |

**注意**: `schools` テーブルには `rating_avg` のみある。各カテゴリ別平均は `school_reviews` を集計する必要がある。

### スコア計算

```ts
// ウェイト（0〜100、合計は正規化しないでよい）
type Weights = {
  policy: number
  class: number
  teacher: number
  facility: number
  access: number
  pta: number
  events: number
}

// 学校ごとのスコア
function calcScore(school: SchoolWithRatings, weights: Weights): number {
  const total =
    (school.avg_policy  ?? 0) * weights.policy  +
    (school.avg_class   ?? 0) * weights.class   +
    (school.avg_teacher ?? 0) * weights.teacher +
    (school.avg_facility?? 0) * weights.facility+
    (school.avg_access  ?? 0) * weights.access  +
    (school.avg_pta     ?? 0) * weights.pta     +
    (school.avg_events  ?? 0) * weights.events

  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
  return weightSum === 0 ? 0 : total / weightSum
}
```

---

## 2. Supabase データ取得

### 2-1. カテゴリ別平均を持つビューまたはRPCを作成

**SQL（Supabase SQL Editorで実行）**:

```sql
-- マテリアライズドビュー（パフォーマンス重視）
CREATE MATERIALIZED VIEW school_rating_summary AS
SELECT
  r.school_id,
  s.school_name,
  s.prefecture,
  s.city,
  s.school_type,
  s.nearest_station,
  s.review_count,
  s.rating_avg,
  AVG(r.rating_policy)   AS avg_policy,
  AVG(r.rating_class)    AS avg_class,
  AVG(r.rating_teacher)  AS avg_teacher,
  AVG(r.rating_facility) AS avg_facility,
  AVG(r.rating_access)   AS avg_access,
  AVG(r.rating_pta)      AS avg_pta,
  AVG(r.rating_events)   AS avg_events,
  COUNT(r.id)            AS review_count_verified
FROM school_reviews r
JOIN schools s ON r.school_id = s.school_id
GROUP BY r.school_id, s.school_name, s.prefecture, s.city,
         s.school_type, s.nearest_station, s.review_count, s.rating_avg;

-- インデックス
CREATE INDEX ON school_rating_summary (school_id);

-- リフレッシュ（データ更新時に実行）
REFRESH MATERIALIZED VIEW school_rating_summary;
```

**ビューが使えない場合の代替 RPC**:

```sql
CREATE OR REPLACE FUNCTION get_school_rating_summary(
  pref_name TEXT DEFAULT NULL,
  city_cd TEXT DEFAULT NULL,
  s_type TEXT DEFAULT NULL,
  min_reviews INTEGER DEFAULT 3
)
RETURNS TABLE (
  school_id TEXT,
  school_name TEXT,
  prefecture TEXT,
  city TEXT,
  school_type TEXT,
  nearest_station TEXT,
  rating_avg NUMERIC,
  review_count BIGINT,
  avg_policy NUMERIC,
  avg_class NUMERIC,
  avg_teacher NUMERIC,
  avg_facility NUMERIC,
  avg_access NUMERIC,
  avg_pta NUMERIC,
  avg_events NUMERIC
) AS $$
  SELECT
    r.school_id,
    s.school_name,
    s.prefecture,
    s.city,
    s.school_type,
    s.nearest_station,
    s.rating_avg,
    COUNT(r.id) AS review_count,
    AVG(r.rating_policy),
    AVG(r.rating_class),
    AVG(r.rating_teacher),
    AVG(r.rating_facility),
    AVG(r.rating_access),
    AVG(r.rating_pta),
    AVG(r.rating_events)
  FROM school_reviews r
  JOIN schools s ON r.school_id = s.school_id
  WHERE
    (pref_name IS NULL OR s.prefecture = pref_name) AND
    (city_cd   IS NULL OR s.city = city_cd) AND
    (s_type    IS NULL OR s.school_type = s_type)
  GROUP BY r.school_id, s.school_name, s.prefecture, s.city,
           s.school_type, s.nearest_station, s.rating_avg
  HAVING COUNT(r.id) >= min_reviews
  ORDER BY s.rating_avg DESC NULLS LAST
  LIMIT 200
$$ LANGUAGE sql STABLE;
```

### 2-2. Hook

```ts
// hooks/useRankingData.ts

export interface RankingFilters {
  prefecture_name?: string
  city?: string
  school_type?: '公立' | '私立' | '国立' | ''
  min_reviews?: number  // デフォルト: 3
}

export function useRankingData(filters: RankingFilters) {
  // get_school_rating_summary RPC を呼ぶ
  // SchoolWithRatings[] を返す
}
```

---

## 3. Zustand Store（ウェイト管理）

```ts
// store/rankingStore.ts

interface RankingState {
  weights: Weights
  setWeight: (key: keyof Weights, value: number) => void
  resetWeights: () => void
  preset: 'balanced' | 'academic' | 'safety' | 'custom'
  applyPreset: (preset: RankingState['preset']) => void
}

const DEFAULT_WEIGHTS: Weights = {
  policy: 50, class: 50, teacher: 50,
  facility: 50, access: 50, pta: 30, events: 30
}

const PRESETS = {
  balanced: { policy:50, class:50, teacher:50, facility:50, access:50, pta:30, events:30 },
  academic:  { policy:70, class:90, teacher:80, facility:40, access:20, pta:10, events:10 },
  safety:    { policy:40, class:40, teacher:40, facility:90, access:70, pta:30, events:20 },
}
```

---

## 4. UI / ページ構成

### ページ: `app/ranking/page.tsx`

**レイアウト（2カラム: 左=設定パネル, 右=ランキング）**:

```
┌──────────────────┬──────────────────────────────────────┐
│ ⚙️ ランキング設定  │ 🏆 ランキング結果                    │
│                  │                                      │
│ [プリセット選択]  │  1位 ○○小学校  Score: 4.23          │
│ バランス型        │  ⭐4.5 先生 ⭐4.2 施設 ⭐4.0        │
│ 学習重視         │  東京都 渋谷区 ・ 公立               │
│ 安全重視         │  口コミ 45件                         │
│                  │  ─────────────────────────          │
│ [ウェイトスライダー]│  2位 △△小学校  Score: 4.18        │
│ 方針・校風  [50] │  ...                                 │
│ ████░░░░░░░      │                                      │
│ 授業・学習  [50] │                                      │
│ ████░░░░░░░      │  [さらに表示]                        │
│ 先生       [50] │                                      │
│ ...              │                                      │
│                  │                                      │
│ [絞り込み]       │                                      │
│ 都道府県: [▼]   │                                      │
│ 市区町村: [▼]   │                                      │
│ 種別: 全て[▼]   │                                      │
│ 最低口コミ数: 3  │                                      │
└──────────────────┴──────────────────────────────────────┘
```

**モバイル対応**: スライダーパネルを折りたたみ（`<details>` or アコーディオン）にして上部に配置

### `components/ranking/WeightSlider.tsx`

```tsx
interface WeightSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  icon?: string
}

// input[type="range"] min=0 max=100 step=5
// 現在値をバッジ表示
// ウェイト0のとき「無視」と表示
```

### `components/ranking/RankingCard.tsx`

```tsx
interface RankingCardProps {
  rank: number
  school: SchoolWithRatings
  score: number
  weights: Weights
}

// スコアが高いカテゴリを上位3つハイライト表示
// 「比較に追加」ボタン（既存の CompareBar と連携）
// 「詳細を見る」で /schools/[schoolId] に遷移
```

---

## 5. スコアのリアルタイム更新

- `useRankingData` でデータを一度取得（サーバー側のソートは `rating_avg` のみ）
- ウェイト変更時はクライアント側で `calcScore` を再計算してソートし直す
- `useMemo` で計算コストを抑える:

```ts
const rankedSchools = useMemo(() => {
  return [...schools]
    .map(s => ({ ...s, score: calcScore(s, weights) }))
    .sort((a, b) => b.score - a.score)
}, [schools, weights])
```

---

## 6. ナビゲーション追加

ヘッダーに `🏆 ランキング` リンクを追加

---

## 完了条件

- [ ] `/ranking` にアクセスするとランキングが表示される
- [ ] スライダーを動かすとリアルタイムにランキングが変わる
- [ ] プリセット（バランス/学習重視/安全重視）が適用できる
- [ ] 都道府県・市区町村・学校種別で絞り込みができる
- [ ] 各カードから学校詳細・比較に遷移できる
- [ ] 口コミ数が少ない学校は除外される（デフォルト: 3件以上）
- [ ] マテリアライズドビューまたはRPCのSQLが `docs/sql/` に保存されている
