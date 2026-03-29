import { School } from '@/types/school'

interface CompareSummaryProps {
  schools: School[]
}

export function CompareSummary({ schools }: CompareSummaryProps) {
  if (schools.length < 2) return null

  const topRated = schools.reduce((a, b) =>
    (b.rating_avg ?? 0) > (a.rating_avg ?? 0) ? b : a
  )
  const mostReviews = schools.reduce((a, b) =>
    b.review_count > a.review_count ? b : a
  )

  return (
    <div className="bg-brand-light border border-brand-border rounded-xl p-4 mt-4">
      <h3 className="font-bold text-brand-text mb-3">比較のポイント</h3>
      <ul className="space-y-2 text-sm text-gray-700">
        <li>⭐ 評価が最も高いのは <strong>{topRated.school_name}</strong>（{topRated.rating_avg?.toFixed(1) ?? '-'}）</li>
        <li>💬 口コミが最も多いのは <strong>{mostReviews.school_name}</strong>（{mostReviews.review_count}件）</li>
      </ul>
    </div>
  )
}
