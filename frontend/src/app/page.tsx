'use client'
import { useState } from 'react'
import { SearchParams } from '@/types/school'
import { SearchBox, DEFAULT_SEARCH_PARAMS } from '@/components/search/SearchBox'
import { FilterChips } from '@/components/search/FilterChips'
import { PopularAreas } from '@/components/search/PopularAreas'
import { SchoolTable } from '@/components/school/SchoolTable'
import { SchoolSidePeek } from '@/components/school/SchoolSidePeek'
import { CompareBar } from '@/components/compare/CompareBar'
import { ReviewSearchBox } from '@/components/search/ReviewSearchBox'
import { ReviewSearchResults } from '@/components/search/ReviewSearchResults'
import { useSchools } from '@/hooks/useSchools'
import { useReviewSearch, ReviewSearchParams } from '@/hooks/useReviewSearch'
import { useCompareStore } from '@/store/compareStore'
import { School } from '@/types/school'

type SearchMode = 'school' | 'review'

export default function HomePage() {
  const [mode, setMode] = useState<SearchMode>('school')
  const [params, setParams] = useState<SearchParams>(DEFAULT_SEARCH_PARAMS)
  const [searched, setSearched] = useState(false)
  const [reviewKeyword, setReviewKeyword] = useState('')
  const [sidePeekSchoolId, setSidePeekSchoolId] = useState<string | null>(null)

  const { schools, loading } = useSchools(
    searched ? params : { ...DEFAULT_SEARCH_PARAMS, prefecture_slug: 'NONE' }
  )
  const { results, loading: reviewLoading, searched: reviewSearched, search: searchReviews } = useReviewSearch()
  const { schools: compareList, add, remove, canAdd } = useCompareStore()

  const handleSearch = (p: SearchParams) => { setParams(p); setSearched(true) }

  const handleRemoveFilter = (key: keyof SearchParams, value?: string) => {
    let next: SearchParams
    if (key === 'cities' && value) {
      next = { ...params, cities: params.cities.filter((c) => c !== value) }
    } else if (key === 'has_lunch' || key === 'has_uniform' || key === 'has_reviews' || key === 'has_gaccom') {
      next = { ...params, [key]: false }
    } else {
      next = { ...params, [key]: '' }
    }
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

  return (
    <div>
      {/* モード切替タブ */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 lg:hidden">
        <button
          onClick={() => setMode('school')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'school' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          学校で探す
        </button>
        <button
          onClick={() => setMode('review')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            mode === 'review' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
          }`}
        >
          口コミで探す
        </button>
      </div>

      {/* PC: 2カラムレイアウト */}
      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">

        {/* 左カラム: 検索パネル */}
        <div className="lg:sticky lg:top-6 space-y-3">
          {/* PCではタブをここに */}
          <div className="hidden lg:flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMode('school')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'school' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              学校で探す
            </button>
            <button
              onClick={() => setMode('review')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'review' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              口コミで探す
            </button>
          </div>

          {mode === 'school' && (
            <>
              <SearchBox onSearch={handleSearch} />
              <FilterChips params={params} onRemove={(key, value) => handleRemoveFilter(key, value)} />
            </>
          )}

          {mode === 'review' && (
            <ReviewSearchBox onSearch={(p: ReviewSearchParams) => { setReviewKeyword(p.keyword); searchReviews(p) }} />
          )}
        </div>

        {/* 右カラム: 結果 */}
        <div className="mt-4 lg:mt-0">
          {mode === 'school' && (
            <>
              {!searched && (
                <PopularAreas onSelect={(p) => handleSearch({ ...DEFAULT_SEARCH_PARAMS, ...p })} />
              )}
              {searched && (
                <>
                  <p className="text-sm text-gray-600 mb-3">
                    {loading ? '検索中...' : `${schools.length}件`}
                  </p>
                  <SchoolTable
                    schools={schools}
                    selectedSchoolId={sidePeekSchoolId}
                    onRowClick={(s) => setSidePeekSchoolId(
                      s.school_id === sidePeekSchoolId ? null : s.school_id
                    )}
                    compareList={compareList}
                    onToggleCompare={handleToggleCompare}
                    canAdd={canAdd}
                  />
                  {!loading && schools.length === 0 && (
                    <p className="text-center text-gray-400 py-8">該当する学校が見つかりませんでした</p>
                  )}
                </>
              )}
            </>
          )}

          {mode === 'review' && (
            <ReviewSearchResults
              results={results}
              loading={reviewLoading}
              searched={reviewSearched}
              keyword={reviewKeyword}
            />
          )}
        </div>
      </div>

      <CompareBar />

      <SchoolSidePeek
        schoolId={sidePeekSchoolId}
        onClose={() => setSidePeekSchoolId(null)}
      />
    </div>
  )
}
