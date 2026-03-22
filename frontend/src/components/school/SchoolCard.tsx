'use client'
import Link from 'next/link'
import { School } from '@/types/school'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'
import { highlightText } from '@/utils/highlight'

interface SchoolCardProps {
  school: School
  isInCompare: boolean
  onToggleCompare: (school: School) => void
  canAdd: boolean
  searchKeyword?: string
}

export function SchoolCard({ school, isInCompare, onToggleCompare, canAdd, searchKeyword = '' }: SchoolCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge type={school.school_type} />
            {school.lunch && (
              <span className="text-xs px-2 py-0.5 bg-orange-50 text-brand border border-brand-border rounded">給食あり</span>
            )}
            {school.uniform && (
              <span className="text-xs px-2 py-0.5 bg-gray-50 text-gray-600 border border-gray-200 rounded">制服あり</span>
            )}
          </div>
          <Link href={`/schools/${school.school_id}`}>
            <h3 className="font-bold text-gray-900 hover:text-brand truncate">{highlightText(school.school_name, searchKeyword)}</h3>
          </Link>
          <p className="text-sm text-gray-500 mt-0.5">{school.prefecture} {school.city}</p>
          {school.nearest_station && (
            <p className="text-xs text-gray-400 mt-0.5">🚉 {school.nearest_station}</p>
          )}
          {school.student_count != null && (
            <p className="text-xs text-gray-400">👨‍👦 児童数 {school.student_count}人</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <StarRating rating={school.rating_avg} />
          <p className="text-xs text-gray-400 mt-0.5">{school.review_count}件の口コミ</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => onToggleCompare(school)}
          disabled={!isInCompare && !canAdd}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            isInCompare
              ? 'bg-brand text-white border-brand'
              : canAdd
              ? 'border-brand text-brand hover:bg-brand-light'
              : 'border-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isInCompare ? '比較中 ✓' : '比較に追加'}
        </button>
      </div>
    </div>
  )
}
