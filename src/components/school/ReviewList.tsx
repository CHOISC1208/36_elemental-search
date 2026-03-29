import { SchoolReview } from '@/types/school'
import { StarRating } from '@/components/ui/StarRating'

interface ReviewListProps {
  reviews: SchoolReview[]
}

export function ReviewList({ reviews }: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="text-gray-400 text-sm py-4">口コミはまだありません</p>
  }
  return (
    <div className="space-y-4">
      {reviews.map((r) => (
        <div key={r.id} className="border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">{r.poster_type}</span>
            <div className="flex items-center gap-2">
              <StarRating rating={r.rating_overall} size="sm" />
              {r.post_date && <span className="text-xs text-gray-400">{r.post_date}</span>}
            </div>
          </div>
          {r.title && <p className="font-semibold text-gray-800 mb-1">{r.title}</p>}
          {r.text_overall && <p className="text-sm text-gray-600 leading-relaxed">{r.text_overall}</p>}
        </div>
      ))}
    </div>
  )
}
