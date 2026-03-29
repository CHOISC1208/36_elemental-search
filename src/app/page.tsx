'use client'
import { useState } from 'react'
import { SchoolSearchForm } from '@/components/search/SchoolSearchForm'
import { MainTabBar } from '@/components/nav/MainTabBar'
import { SchoolTable } from '@/components/school/SchoolTable'
import { SchoolSidePeek } from '@/components/school/SchoolSidePeek'
import { CompareBar } from '@/components/compare/CompareBar'
import { ReviewSearchBox } from '@/components/search/ReviewSearchBox'
import { ReviewSearchResults } from '@/components/search/ReviewSearchResults'
import { useSchoolSearch, SchoolSearchQuery, SCHOOL_SEARCH_PAGE_SIZE } from '@/hooks/useSchoolSearch'
import { useReviewSearch, ReviewSearchParams } from '@/hooks/useReviewSearch'
import { useCompareStore } from '@/store/compareStore'
import { School } from '@/types/school'

type SearchMode = 'school' | 'review'

export default function HomePage() {
  const [mode, setMode]           = useState<SearchMode>('school')
  const [query, setQuery]         = useState<SchoolSearchQuery | null>(null)
  const [page, setPage]           = useState(1)
  const [sidePeekId, setSidePeekId] = useState<string | null>(null)
  const [reviewKeyword, setReviewKeyword] = useState('')

  const { schools, total, loading }   = useSchoolSearch(query, page)
  const { results, loading: rvLoading, searched: rvSearched, search: searchReviews } = useReviewSearch()
  const { schools: compareList, add, remove, canAdd } = useCompareStore()

  const totalPages = Math.ceil(total / SCHOOL_SEARCH_PAGE_SIZE)

  const handleSearch = (q: SchoolSearchQuery) => {
    setQuery(q)
    setPage(1)
    setSidePeekId(null)
  }

  const handleToggleCompare = (school: School) => {
    if (compareList.some(s => s.school_id === school.school_id)) remove(school.school_id)
    else add(school)
  }

  return (
    <div className="space-y-4">
      {/* ── タブナビゲーション（4タブ） ── */}
      <MainTabBar
        activeTab={mode === 'review' ? 'review' : 'school'}
        onModeChange={setMode}
      />

      {/* ── 学校検索モード ── */}
      {mode === 'school' && (
        <>
          {/* ①②③ 検索フォーム */}
          <SchoolSearchForm onSearch={handleSearch} />

          {/* ④ 検索結果 */}
          {!query && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
              <span className="text-4xl">🏫</span>
              <p className="text-sm">条件を設定して「検索」を押してください</p>
            </div>
          )}

          {query && (
            <div>
              {/* 件数・条件ラベル */}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600 font-medium">
                  {loading ? '検索中...' : `検索結果 ${total.toLocaleString()} 件`}
                  {!loading && query.radius_km && (
                    <span className="ml-2 text-xs text-brand font-normal">
                      半径 {query.radius_km}km・距離順
                    </span>
                  )}
                </p>
                {!loading && total > 0 && !query.radius_km && (
                  <p className="text-xs text-gray-400">
                    {page} / {totalPages} ページ
                  </p>
                )}
              </div>

              {/* テーブル */}
              <SchoolTable
                schools={schools}
                selectedSchoolId={sidePeekId}
                onRowClick={s => setSidePeekId(s.school_id === sidePeekId ? null : s.school_id)}
                compareList={compareList}
                onToggleCompare={handleToggleCompare}
                canAdd={canAdd}
                showDistance={!!query?.radius_km}
              />

              {/* 0件メッセージ */}
              {!loading && total === 0 && (
                <p className="text-center text-gray-400 py-10">
                  該当する学校が見つかりませんでした
                </p>
              )}

              {/* ページネーション（半径検索時は非表示） */}
              {!query.radius_km && totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button
                    onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    ← 前へ
                  </button>

                  {/* ページ番号（前後2ページ） */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                    .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                      if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
                      acc.push(n)
                      return acc
                    }, [])
                    .map((item, idx) =>
                      item === '…' ? (
                        <span key={`ellipsis-${idx}`} className="text-gray-400 text-sm px-1">…</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => { setPage(item as number); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                          className={`w-9 h-9 text-sm rounded-lg border transition-colors ${
                            page === item
                              ? 'bg-brand text-white border-brand'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    次へ →
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 口コミ検索モード ── */}
      {mode === 'review' && (
        <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-6 lg:items-start">
          <div className="lg:sticky lg:top-6">
            <ReviewSearchBox
              onSearch={(p: ReviewSearchParams) => {
                setReviewKeyword(p.keyword)
                searchReviews(p)
              }}
            />
          </div>
          <div className="mt-4 lg:mt-0">
            <ReviewSearchResults
              results={results}
              loading={rvLoading}
              searched={rvSearched}
              keyword={reviewKeyword}
            />
          </div>
        </div>
      )}

      <CompareBar />
      <SchoolSidePeek schoolId={sidePeekId} onClose={() => setSidePeekId(null)} />
    </div>
  )
}
