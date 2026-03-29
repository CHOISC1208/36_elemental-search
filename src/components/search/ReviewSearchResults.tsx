'use client'
import { useState } from 'react'
import { ReviewSearchResult } from '@/hooks/useReviewSearch'
import { highlightText } from '@/utils/highlight'
import { StarRating } from '@/components/ui/StarRating'

interface ReviewSearchResultsProps {
  results: ReviewSearchResult[]
  loading: boolean
  searched: boolean
  keyword: string
  onSelectSchool: (schoolId: string) => void
}

const PREVIEW_LENGTH = 150

function ReviewCard({ result, keyword, onSelectSchool }: { result: ReviewSearchResult; keyword: string; onSelectSchool: (schoolId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const text = result.text_overall ?? ''
  const isLong = text.length > PREVIEW_LENGTH
  const displayText = expanded || !isLong ? text : text.slice(0, PREVIEW_LENGTH) + '...'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            onClick={() => onSelectSchool(result.school_id)}
            className="font-bold text-gray-900 hover:text-brand text-sm text-left"
          >
            {result.school_name}
          </button>
          <p className="text-xs text-gray-400">{result.prefecture} {result.city}</p>
        </div>
        <div className="shrink-0 text-right">
          <StarRating rating={result.rating_overall} />
          <p className="text-xs text-gray-400 mt-0.5">{result.poster_type}</p>
        </div>
      </div>

      {result.title && (
        <p className="text-sm font-medium text-gray-700">{highlightText(result.title, keyword)}</p>
      )}

      <p className="text-sm text-gray-600 leading-relaxed">
        {highlightText(displayText, keyword)}
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="ml-1 text-brand hover:underline text-xs"
          >
            続きを読む
          </button>
        )}
      </p>

      <div className="flex items-center justify-between">
        {result.post_date && (
          <p className="text-xs text-gray-400">{result.post_date}</p>
        )}
        <button
          onClick={() => onSelectSchool(result.school_id)}
          className="ml-auto text-xs text-brand hover:underline"
        >
          学校詳細を見る →
        </button>
      </div>
    </div>
  )
}

export function ReviewSearchResults({ results, loading, searched, keyword, onSelectSchool }: ReviewSearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  if (!searched) return null

  if (results.length === 0) {
    return (
      <p className="text-center text-gray-400 py-8 mt-4">該当する口コミが見つかりませんでした</p>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-gray-600">{results.length}件の口コミ</p>
      {results.map((r) => (
        <ReviewCard key={r.review_id} result={r} keyword={keyword} onSelectSchool={onSelectSchool} />
      ))}
    </div>
  )
}
