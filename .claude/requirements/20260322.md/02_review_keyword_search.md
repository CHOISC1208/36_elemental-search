# ②　口コミキーワード検索 — 実装指示書

> 対象: Claude Code / 実装担当エンジニア  
> 作成日: 2026-03-22  
> 前提: Next.js 15 / Supabase / 既存コードベース（`~/git/elemental-search`想定）

---

## 概要

`school_reviews` テーブルの `text_overall`（および将来的に他の `text_*` カラム）に対して、
キーワードの部分一致検索を行う機能を追加する。

検索はメイン検索と**独立したUI**として提供し、「口コミで探す」タブ or セクションとして配置する。

---

## 1. Supabase クエリ変更

### 新規Hook: `useReviewSearch(params)`

**ファイル**: `hooks/useReviewSearch.ts`（新規作成）

```ts
export interface ReviewSearchParams {
  keyword: string          // 検索ワード（空文字の場合は全件）
  prefecture_name?: string // 絞り込み用（任意）
  city_code?: string       // 絞り込み用（任意）
  poster_type?: '保護者' | '生徒' | '卒業生' | ''
  limit?: number           // デフォルト 30
}

export interface ReviewSearchResult {
  review_id: number
  school_id: string
  school_name: string
  prefecture: string
  city: string
  poster_type: string
  rating_overall: number
  text_overall: string
  post_date: string
  title: string
}
```

**クエリロジック**:

```ts
// supabase クライアントを使用（既存の初期化コードに合わせる）
let query = supabase
  .from('school_reviews')
  .select(`
    id,
    school_id,
    poster_type,
    post_date,
    title,
    rating_overall,
    text_overall,
    schools!inner (
      school_name,
      prefecture,
      city
    )
  `)
  .not('text_overall', 'is', null)

if (params.keyword) {
  query = query.ilike('text_overall', `%${params.keyword}%`)
}
if (params.poster_type) {
  query = query.eq('poster_type', params.poster_type)
}
if (params.prefecture_name) {
  query = query.eq('schools.prefecture', params.prefecture_name)  
  // ※ Supabase の JOIN フィルターは外部テーブルへの直接 filter が必要な場合あり
  // → うまく動かない場合は schools テーブルを先に絞ってから school_id で IN クエリを使う
}

query = query
  .order('post_date', { ascending: false })
  .limit(params.limit ?? 30)
```

**注意**: `schools.prefecture` への JOIN フィルターが Supabase PostgREST で効かない場合の代替:

```ts
// Step 1: prefecture_name で school_id 一覧取得
const { data: schoolIds } = await supabase
  .from('schools')
  .select('school_id')
  .eq('prefecture', params.prefecture_name)

// Step 2: school_id で IN フィルター
query = query.in('school_id', schoolIds.map(s => s.school_id))
```

---

## 2. UI コンポーネント

### 2-1. `components/search/ReviewSearchBox.tsx`（新規作成）

**配置場所**: メインページ `/` の SearchBox の下、または専用タブとして

**UIに含める要素**:

| 要素 | 詳細 |
|------|------|
| キーワード入力 | プレースホルダー: `「給食がおいしい」「先生が親切」など` |
| 投稿者タイプ選択 | ラジオ or セグメント: 全て / 保護者 / 生徒 / 卒業生 |
| 都道府県・市区町村 | 既存の `usePrefectures` / `usePrefCities` を再利用 |
| 検索ボタン | Enter キーでも発火 |

**検索ボタン押下時の動作**:
- `useReviewSearch` を呼び出す
- ローディング中はスケルトン表示
- 0件の場合は「該当する口コミが見つかりませんでした」

### 2-2. `components/search/ReviewSearchResults.tsx`（新規作成）

各口コミカードに含める情報:

```
┌─────────────────────────────────────────────────────┐
│ 🏫 [school_name]   [prefecture] [city]              │
│ ⭐ [rating_overall]  [poster_type]  [post_date]    │
│                                                      │
│ [title]                                             │
│                                                      │
│ [text_overall をキーワードハイライト付きで表示]       │
│ （150文字程度で切り、「続きを読む」で展開）           │
│                                                      │
│                    [学校詳細を見る →]               │
└─────────────────────────────────────────────────────┘
```

**キーワードハイライト実装**:

```ts
// text_overall の中の keyword 部分を <mark> タグで囲む
function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword) return text
  const parts = text.split(new RegExp(`(${keyword})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
      : part
  )
}
```

---

## 3. ページへの組み込み

### オプションA: タブ切り替え（推奨）

`app/page.tsx` のメインページに `学校で探す` / `口コミで探す` のタブを追加:

```tsx
const [searchMode, setSearchMode] = useState<'school' | 'review'>('school')

// タブUI
<div className="flex gap-2 mb-4">
  <button onClick={() => setSearchMode('school')} className={...}>学校で探す</button>
  <button onClick={() => setSearchMode('review')} className={...}>口コミで探す</button>
</div>

{searchMode === 'school' && <SearchBox ... />}
{searchMode === 'review' && <ReviewSearchBox ... />}
```

### オプションB: 専用ページ `/reviews/search`

- 規模が大きくなる場合はこちらを推奨
- `app/reviews/search/page.tsx` を新規作成

---

## 4. 将来拡張（今回は対応不要）

- `text_policy`, `text_class`, `text_teacher` など全 `text_*` カラムへの検索対象拡張
  - → UI に「検索対象」セレクタを追加する形で対応可
- Supabase の `full text search`（`to_tsvector` / `to_tsquery`）への切り替え
  - → データ量が増えて `ilike` が遅くなったタイミングで検討

---

## 完了条件

- [ ] キーワードを入力して検索ボタンを押すと口コミ一覧が表示される
- [ ] キーワード部分がハイライトされる
- [ ] 「学校詳細を見る」で `/schools/[schoolId]` に遷移できる
- [ ] 投稿者タイプで絞り込みができる
- [ ] 都道府県で絞り込みができる
- [ ] 0件・ローディング・エラー状態が適切に表示される
