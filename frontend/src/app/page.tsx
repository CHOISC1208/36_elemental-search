'use client'
import { useState } from 'react'
import { SearchParams } from '@/types/school'
import { SearchBox } from '@/components/search/SearchBox'
import { FilterChips } from '@/components/search/FilterChips'
import { PopularAreas } from '@/components/search/PopularAreas'
import { SchoolCard } from '@/components/school/SchoolCard'
import { CompareBar } from '@/components/compare/CompareBar'
import { ReviewSearchBox } from '@/components/search/ReviewSearchBox'
import { ReviewSearchResults } from '@/components/search/ReviewSearchResults'
import { useSchools } from '@/hooks/useSchools'
import { useReviewSearch, ReviewSearchParams } from '@/hooks/useReviewSearch'
import { useCompareStore } from '@/store/compareStore'
import { School } from '@/types/school'

const DEFAULT_PARAMS: SearchParams = {
  prefecture_slug: '',
  prefecture_name: '',
  city_code: '',
  school_name: '',
  school_type: '',
  has_lunch: false,
  has_uniform: false,
  sort: 'rating',
}

type SearchMode = 'school' | 'review'

export default function HomePage() {
  const [mode, setMode] = useState<SearchMode>('school')
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS)
  const [searched, setSearched] = useState(false)
  const [reviewKeyword, setReviewKeyword] = useState('')

  const { schools, loading } = useSchools(searched ? params : { ...DEFAULT_PARAMS, prefecture_slug: 'NONE' })
  const { results, loading: reviewLoading, searched: reviewSearched, search: searchReviews } = useReviewSearch()
  const { schools: compareList, add, remove, canAdd } = useCompareStore()

  const handleSearch = (p: SearchParams) => {
    setParams(p)
    setSearched(true)
  }

  const handleRemoveFilter = (key: keyof SearchParams) => {
    const next = { ...params, [key]: key === 'has_lunch' || key === 'has_uniform' ? false : '' }
    setParams(next)
    if (searched) setSearched(true)
  }

  const handleToggleCompare = (school: School) => {
    if (compareList.some((s) => s.school_id === school.school_id)) {
      remove(school.school_id)
    } else {
      add(school)
    }
  }

  const handleReviewSearch = (p: ReviewSearchParams) => {
    setReviewKeyword(p.keyword)
    searchReviews(p)
  }

  return (
    <div>
      {/* モード切替タブ */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setMode('school')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'school' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          学校で探す
        </button>
        <button
          onClick={() => setMode('review')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'review' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          口コミで探す
        </button>
      </div>

      {mode === 'school' && (
        <>
          <SearchBox onSearch={handleSearch} />
          <FilterChips params={params} onRemove={handleRemoveFilter} />
          {!searched && (
            <PopularAreas onSelect={(p) => handleSearch({ ...DEFAULT_PARAMS, ...p })} />
          )}

          {searched && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  {loading ? '検索中...' : `${schools.length}件`}
                </p>
                <select
                  value={params.sort}
                  onChange={(e) => handleSearch({ ...params, sort: e.target.value as SearchParams['sort'] })}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1"
                >
                  <option value="rating">評価が高い順</option>
                  <option value="reviews">口コミが多い順</option>
                </select>
              </div>

              <div className="space-y-3">
                {schools.map((school) => (
                  <SchoolCard
                    key={school.school_id}
                    school={school}
                    isInCompare={compareList.some((s) => s.school_id === school.school_id)}
                    onToggleCompare={handleToggleCompare}
                    canAdd={canAdd}
                    searchKeyword={params.school_name}
                  />
                ))}
                {!loading && schools.length === 0 && (
                  <p className="text-center text-gray-400 py-8">該当する学校が見つかりませんでした</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'review' && (
        <>
          <ReviewSearchBox onSearch={handleReviewSearch} />
          <ReviewSearchResults
            results={results}
            loading={reviewLoading}
            searched={reviewSearched}
            keyword={reviewKeyword}
          />
        </>
      )}

      <CompareBar />
    </div>
  )
}
