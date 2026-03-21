# 小学校検索アプリ React コンポーネント設計書

## 技術スタック

| 項目 | 採用技術 |
|---|---|
| フレームワーク | Next.js 14 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| データフェッチ | Supabase JS Client |
| 状態管理 | Zustand（比較リスト管理） |
| ルーティング | Next.js App Router |

---

## ディレクトリ構成

```
src/
├── app/
│   ├── page.tsx                     # 検索・一覧ページ
│   ├── schools/
│   │   └── [schoolId]/
│   │       └── page.tsx             # 学校詳細ページ
│   └── compare/
│       └── page.tsx                 # 比較ページ
├── components/
│   ├── search/
│   │   ├── SearchBox.tsx            # 都道府県・市区町村・学校名入力
│   │   ├── FilterChips.tsx          # 絞り込みチップ
│   │   └── PopularAreas.tsx         # よく検索されるエリア
│   ├── school/
│   │   ├── SchoolCard.tsx           # 一覧カード
│   │   ├── SchoolHero.tsx           # 詳細ヒーロー部分
│   │   ├── RatingRadar.tsx          # レーダーチャート＋バー
│   │   ├── SchoolSpecs.tsx          # スペックグリッド
│   │   └── ReviewList.tsx           # 口コミ一覧
│   ├── compare/
│   │   ├── CompareTable.tsx         # 比較テーブル
│   │   ├── CompareBar.tsx           # 画面下部の比較トリガーバー
│   │   └── CompareSummary.tsx       # 比較のポイント
│   └── ui/
│       ├── Badge.tsx                # 公立/私立/国立バッジ
│       ├── ScoreBar.tsx             # スコアバー
│       └── StarRating.tsx           # 星評価表示
├── store/
│   └── compareStore.ts              # 比較リストのZustand store
├── hooks/
│   ├── useSchools.ts                # 学校一覧フェッチ
│   ├── useSchoolDetail.ts           # 学校詳細フェッチ
│   └── usePrefCities.ts             # 都道府県・市区町村フェッチ
├── lib/
│   └── supabase.ts                  # Supabaseクライアント初期化
└── types/
    └── school.ts                    # 型定義
```

---

## 型定義

```typescript
// src/types/school.ts

export type SchoolType = '公立' | '私立' | '国立'

export interface School {
  school_id: string
  school_name: string
  furigana: string | null
  prefecture: string
  city: string
  address: string
  nearest_station: string | null
  school_type: SchoolType
  uniform: string | null
  lunch: string | null
  events: string | null
  tuition: string | null
  selection: string | null
  selection_method: string | null
  rating_avg: number | null
  review_count: number
  // gaccom_schools から JOIN
  student_count?: number | null
  teacher_count?: number | null
  linked_jhs?: string | null
}

export interface SchoolReview {
  id: number
  school_id: string
  poster_type: '保護者' | '生徒' | '卒業生'
  enrollment_year: number | null
  post_date: string | null
  title: string | null
  rating_overall: number | null
  rating_policy: number | null
  rating_class: number | null
  rating_teacher: number | null
  rating_facility: number | null
  rating_access: number | null
  rating_pta: number | null
  rating_events: number | null
  text_overall: string | null
}

export interface Prefecture {
  slug: string
  name: string
}

export interface City {
  city_code: string
  name: string
  prefecture_slug: string
}

export interface SearchParams {
  prefecture_slug: string
  city_code: string
  school_name: string
  school_type: SchoolType | ''
  has_lunch: boolean
  has_uniform: boolean
  sort: 'rating' | 'reviews' | 'station'
}
```

---

## コンポーネント詳細

### 1. SearchBox

**役割**: 都道府県・市区町村・学校名の検索フォーム

**Props**:
```typescript
interface SearchBoxProps {
  onSearch: (params: SearchParams) => void
}
```

**実装ポイント**:
- 都道府県選択時に `usePrefCities` フックで市区町村を動的ロード
- 都道府県が未選択の場合、市区町村は `disabled`
- 「リセット」で全フィールドをクリア

```typescript
// src/hooks/usePrefCities.ts
export function usePrefCities(prefSlug: string) {
  const [cities, setCities] = useState<City[]>([])

  useEffect(() => {
    if (!prefSlug) { setCities([]); return }
    supabase
      .schema('36_elemental-search')
      .from('cities')
      .select('city_code, name')
      .eq('prefecture_slug', prefSlug)
      .order('name')
      .then(({ data }) => setCities(data ?? []))
  }, [prefSlug])

  return cities
}
```

---

### 2. SchoolCard

**役割**: 検索一覧に表示される学校カード

**Props**:
```typescript
interface SchoolCardProps {
  school: School
  isInCompare: boolean
  onToggleCompare: (school: School) => void
}
```

**表示内容**:
- 学校名・種別バッジ
- 住所・最寄駅・児童数
- カテゴリ別評価ピル（6カテゴリ）
- 総合スコア・星・口コミ件数
- 給食・制服タグ
- 比較に追加/外すボタン

---

### 3. RatingRadar

**役割**: カテゴリ別評価のレーダーチャート＋横バー

**Props**:
```typescript
interface RatingRadarProps {
  ratings: {
    policy: number | null    // 方針
    class: number | null     // 授業
    teacher: number | null   // 先生
    facility: number | null  // 施設
    access: number | null    // アクセス
    pta: number | null       // PTA
    events: number | null    // 行事
  }
}
```

**実装ポイント**:
- SVGで正六角形ベースのレーダーチャートを描画
- nullのカテゴリは「データなし」として表示
- 横バーは `ScoreBar` コンポーネントを再利用

---

### 4. CompareBar

**役割**: 比較リストに追加した学校を画面下部に固定表示するバー

**Props**: なし（compareStoreから取得）

**表示条件**: compareStore の schools が1件以上のとき表示

```typescript
// src/store/compareStore.ts
import { create } from 'zustand'

interface CompareStore {
  schools: School[]
  add: (school: School) => void
  remove: (schoolId: string) => void
  clear: () => void
  canAdd: boolean  // 3校未満のとき true
}

export const useCompareStore = create<CompareStore>((set, get) => ({
  schools: [],
  add: (school) => {
    if (get().schools.length >= 3) return
    set(s => ({ schools: [...s.schools, school] }))
  },
  remove: (schoolId) =>
    set(s => ({ schools: s.schools.filter(sc => sc.school_id !== schoolId) })),
  clear: () => set({ schools: [] }),
  get canAdd() { return get().schools.length < 3 }
}))
```

---

### 5. CompareTable

**役割**: 最大3校の横並び比較テーブル

**Props**:
```typescript
interface CompareTableProps {
  schools: School[]
  reviewSummaries: Record<string, ReviewSummary>  // school_id → 集計値
}
```

**実装ポイント**:
- 各カテゴリで最高スコアのセルをオレンジ強調
- `grid-template-columns: 120px repeat(n, 1fr)` でn校に対応（1〜3校）
- スコアがnullのセルは「-」表示

---

## Supabaseクエリ設計

### 学校一覧取得

```typescript
// src/hooks/useSchools.ts
export function useSchools(params: SearchParams) {
  const SCHEMA = '36_elemental-search'

  let query = supabase
    .schema(SCHEMA)
    .from('schools')
    .select(`
      school_id, school_name, furigana,
      prefecture, city, address, nearest_station,
      school_type, uniform, lunch, rating_avg, review_count,
      school_links!inner(
        gaccom_schools(student_count, teacher_count)
      )
    `)

  if (params.prefecture_slug) {
    // prefectures テーブルの name と照合
    query = query.eq('prefecture', prefName)
  }
  if (params.city_code) {
    query = query.eq('city', cityName)
  }
  if (params.school_name) {
    query = query.ilike('school_name', `%${params.school_name}%`)
  }
  if (params.school_type) {
    query = query.eq('school_type', params.school_type)
  }

  // ソート
  if (params.sort === 'rating') query = query.order('rating_avg', { ascending: false })
  else if (params.sort === 'reviews') query = query.order('review_count', { ascending: false })

  return query.limit(20)
}
```

### 学校詳細 + 口コミ集計

```typescript
// カテゴリ別平均をSupabase RPCで取得（またはクライアント集計）
const { data: reviews } = await supabase
  .schema('36_elemental-search')
  .from('school_reviews')
  .select('rating_overall, rating_policy, rating_class, rating_teacher, rating_facility, rating_access, rating_pta, rating_events, poster_type, enrollment_year, title, text_overall')
  .eq('school_id', schoolId)
  .order('scraped_at', { ascending: false })
```

---

## ページ構成

### `/` 検索・一覧ページ

```
<SearchBox />
<FilterChips />
<PopularAreas />
─────────────────
件数・ソート
<SchoolCard /> × N
<CompareBar />  ← 固定フッター（比較リストに1件以上追加時）
```

### `/schools/[schoolId]` 詳細ページ

```
戻るリンク
<SchoolHero />
タブ（評価・口コミ ／ 学校情報 ／ 進学先）
<RatingRadar />
<SchoolSpecs />
<ReviewList />
```

### `/compare` 比較ページ

```
戻るリンク
<CompareTable />
<CompareSummary />
```

---

## カラー定数

```typescript
// src/lib/colors.ts
export const BRAND = {
  primary: '#E07B3F',       // オレンジ（アクセント）
  primaryLight: '#FFF8F0',  // 薄オレンジ（ヒーロー背景）
  primaryBorder: '#F5C4A0', // タグ枠線
  primaryText: '#B35A1F',   // タグテキスト
}

export const SCHOOL_TYPE_COLORS = {
  公立: { bg: '#E8F5E0', text: '#3B6D11' },
  私立: { bg: '#FFF0E0', text: '#B35A1F' },
  国立: { bg: '#E6F1FB', text: '#185FA5' },
}
```

---

## 実装優先順位

1. `SearchBox` + `usePrefCities` → 都道府県・市区町村の連動ドロップダウン
2. `useSchools` + `SchoolCard` → 一覧表示の基本動作
3. `SchoolDetail` ページ + `RatingRadar` → 詳細ページ
4. `compareStore` + `CompareBar` + `CompareTable` → 比較機能

---

## 注意事項

- Supabaseスキーマ名が `36_elemental-search`（ハイフン含む）のため、`.schema('36_elemental-search')` を必ず指定すること
- `school_links` テーブルは `match_score >= 0.85` のものだけJOINする（低信頼マッチを除外）
- `rating_avg` がnullの学校（口コミ0件）は一覧の末尾に表示する