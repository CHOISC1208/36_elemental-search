export type SchoolType = '公立' | '私立' | '国立'

export interface School {
  school_id: string
  school_name: string
  furigana: string | null
  prefecture: string
  city: string
  address: string
  nearest_station: string | null
  school_type: SchoolType
  uniform: string | null
  lunch: string | null
  events: string | null
  tuition: string | null
  selection: string | null
  selection_method: string | null
  rating_avg: number | null
  review_count: number
  student_count?: number | null
  teacher_count?: number | null
  linked_jhs?: string | null
}

export interface SchoolReview {
  id: number
  school_id: string
  poster_type: '保護者' | '生徒' | '卒業生'
  enrollment_year: number | null
  post_date: string | null
  title: string | null
  rating_overall: number | null
  rating_policy: number | null
  rating_class: number | null
  rating_teacher: number | null
  rating_facility: number | null
  rating_access: number | null
  rating_pta: number | null
  rating_events: number | null
  text_overall: string | null
}

export interface Prefecture {
  slug: string
  name: string
}

export interface City {
  city_code: string
  name: string
  prefecture_slug: string
}

export interface SearchParams {
  prefecture_slug: string
  city_code: string
  school_name: string
  school_type: SchoolType | ''
  has_lunch: boolean
  has_uniform: boolean
  sort: 'rating' | 'reviews' | 'station'
}
