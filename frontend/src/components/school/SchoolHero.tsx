import { School } from '@/types/school'
import { Badge } from '@/components/ui/Badge'
import { StarRating } from '@/components/ui/StarRating'

interface SchoolHeroProps {
  school: School
}

export function SchoolHero({ school }: SchoolHeroProps) {
  return (
    <div className="bg-brand-light border-b border-brand-border px-4 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Badge type={school.school_type} />
          <span className="text-sm text-gray-500">{school.prefecture} {school.city}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{school.school_name}</h1>
        {school.furigana && (
          <p className="text-sm text-gray-500 mb-2">{school.furigana}</p>
        )}
        <div className="flex items-center gap-4">
          <StarRating rating={school.rating_avg} />
          <span className="text-sm text-gray-500">{school.review_count}件の口コミ</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
          {school.address && <span>📍 {school.address}</span>}
          {school.nearest_station && <span>🚉 {school.nearest_station}</span>}
          {school.student_count != null && <span>👨‍👦 児童数 {school.student_count}人</span>}
          {school.teacher_count != null && <span>👩‍🏫 教職員 {school.teacher_count}人</span>}
        </div>
      </div>
    </div>
  )
}
