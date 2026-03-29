import { School, SchoolReview } from '@/types/school'
import { StarRating } from '@/components/ui/StarRating'
import { Badge } from '@/components/ui/Badge'

interface CompareTableProps {
  schools: School[]
  reviewsMap: Record<string, SchoolReview[]>
}

function avg(reviews: SchoolReview[], key: keyof SchoolReview): number | null {
  const vals = reviews.map((r) => r[key] as number | null).filter((v): v is number => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

const RATING_ROWS = [
  { label: '総合', key: 'rating_overall' as keyof SchoolReview },
  { label: '方針', key: 'rating_policy' as keyof SchoolReview },
  { label: '授業', key: 'rating_class' as keyof SchoolReview },
  { label: '先生', key: 'rating_teacher' as keyof SchoolReview },
  { label: '施設', key: 'rating_facility' as keyof SchoolReview },
  { label: 'アクセス', key: 'rating_access' as keyof SchoolReview },
]

export function CompareTable({ schools, reviewsMap }: CompareTableProps) {
  const n = schools.length
  const cols = `120px repeat(${n}, 1fr)`

  return (
    <div className="overflow-x-auto">
      <div style={{ display: 'grid', gridTemplateColumns: cols }} className="min-w-0">
        {/* ヘッダー */}
        <div className="p-3 font-bold text-sm text-gray-500 border-b border-gray-200" />
        {schools.map((s) => (
          <div key={s.school_id} className="p-3 border-b border-gray-200 border-l border-gray-100">
            <Badge type={s.school_type} />
            <p className="font-bold text-gray-900 mt-1 text-sm">{s.school_name}</p>
            <p className="text-xs text-gray-500">{s.prefecture} {s.city}</p>
          </div>
        ))}

        {/* 基本情報 */}
        {[
          { label: '最寄駅', fn: (s: School) => s.nearest_station ?? '-' },
          { label: '児童数', fn: (s: School) => s.student_count != null ? `${s.student_count}人` : '-' },
          { label: '給食', fn: (s: School) => s.lunch ?? '-' },
          { label: '制服', fn: (s: School) => s.uniform ?? '-' },
        ].map(({ label, fn }) => (
          <>
            <div key={`label-${label}`} className="p-3 text-sm text-gray-500 bg-gray-50 border-b border-gray-100">{label}</div>
            {schools.map((s) => (
              <div key={`${s.school_id}-${label}`} className="p-3 text-sm text-gray-800 border-b border-gray-100 border-l border-gray-100">{fn(s)}</div>
            ))}
          </>
        ))}

        {/* 評価 */}
        {RATING_ROWS.map(({ label, key }) => {
          const scores = schools.map((s) => avg(reviewsMap[s.school_id] ?? [], key))
          const maxScore = Math.max(...scores.filter((v): v is number => v != null))
          return (
            <>
              <div key={`label-${key}`} className="p-3 text-sm text-gray-500 bg-gray-50 border-b border-gray-100">{label}</div>
              {schools.map((s, i) => {
                const score = scores[i]
                const isTop = score != null && score === maxScore && n > 1
                return (
                  <div
                    key={`${s.school_id}-${key}`}
                    className={`p-3 text-sm border-b border-gray-100 border-l border-gray-100 ${isTop ? 'bg-orange-50 font-bold text-brand' : 'text-gray-800'}`}
                  >
                    {score != null ? (
                      <StarRating rating={score} size="sm" />
                    ) : '-'}
                  </div>
                )
              })}
            </>
          )
        })}
      </div>
    </div>
  )
}
