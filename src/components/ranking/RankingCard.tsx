'use client'
import { SchoolWithRatings, Weights, WEIGHT_LABELS, calcScore } from '@/types/ranking'
import { Badge } from '@/components/ui/Badge'
import { useCompareStore } from '@/store/compareStore'
import { School } from '@/types/school'

interface RankingCardProps {
  rank: number
  school: SchoolWithRatings
  weights: Weights
  onSchoolClick: (schoolId: string) => void
  isSelected?: boolean
}

const RANK_COLORS = ['text-yellow-500', 'text-gray-400', 'text-orange-400']

export function RankingCard({ rank, school, weights, onSchoolClick, isSelected = false }: RankingCardProps) {
  const score = calcScore(school, weights)
  const { schools: compareList, add, remove, canAdd } = useCompareStore()
  const isInCompare = compareList.some((s) => s.school_id === school.school_id)

  const handleToggle = () => {
    if (isInCompare) {
      remove(school.school_id)
    } else {
      add(school as unknown as School)
    }
  }

  // スコアが高いカテゴリ上位3つをハイライト
  const categoryScores = (Object.keys(weights) as (keyof Weights)[])
    .map((key) => {
      const avgKey = `avg_${key}` as keyof SchoolWithRatings
      return { key, score: (school[avgKey] as number | null) ?? 0, weight: weights[key] }
    })
    .filter((c) => c.weight > 0 && c.score > 0)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)

  return (
    <div className={`bg-white rounded-xl border p-4 transition-colors ${isSelected ? 'border-brand ring-1 ring-brand' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className={`text-2xl font-bold w-8 text-center shrink-0 ${RANK_COLORS[rank - 1] ?? 'text-gray-300'}`}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Badge type={school.school_type as '公立' | '私立' | '国立'} />
              </div>
              <button
                type="button"
                onClick={() => onSchoolClick(school.school_id)}
                className="font-bold text-gray-900 hover:text-brand text-sm text-left"
              >
                {school.school_name}
              </button>
              <p className="text-xs text-gray-400 mt-0.5">{school.prefecture} {school.city}</p>
              {school.nearest_station && (
                <p className="text-xs text-gray-400">🚉 {school.nearest_station}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold text-brand">{score.toFixed(2)}</p>
              <p className="text-xs text-gray-400">{school.review_count_verified}件の口コミ</p>
            </div>
          </div>

          {/* 上位カテゴリ */}
          {categoryScores.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {categoryScores.map(({ key, score: s }) => (
                <span key={key} className="text-xs bg-brand-light text-brand border border-brand-border rounded-full px-2 py-0.5">
                  {WEIGHT_LABELS[key]} {s.toFixed(1)}
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-2">
            <button
              onClick={handleToggle}
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
      </div>
    </div>
  )
}
