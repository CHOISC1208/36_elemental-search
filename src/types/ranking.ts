export interface Weights {
  policy: number
  class: number
  teacher: number
  facility: number
  access: number
  pta: number
  events: number
}

export interface SchoolWithRatings {
  school_id: string
  school_name: string
  prefecture: string
  city: string
  school_type: string
  nearest_station: string | null
  rating_avg: number | null
  review_count: number
  review_count_verified: number
  avg_policy: number | null
  avg_class: number | null
  avg_teacher: number | null
  avg_facility: number | null
  avg_access: number | null
  avg_pta: number | null
  avg_events: number | null
}

export type PresetKey = 'balanced' | 'academic' | 'safety'

export const PRESETS: Record<PresetKey, Weights> = {
  balanced: { policy: 50, class: 50, teacher: 50, facility: 50, access: 50, pta: 30, events: 30 },
  academic:  { policy: 70, class: 90, teacher: 80, facility: 40, access: 20, pta: 10, events: 10 },
  safety:    { policy: 40, class: 40, teacher: 40, facility: 90, access: 70, pta: 30, events: 20 },
}

export const WEIGHT_LABELS: Record<keyof Weights, string> = {
  policy:   '方針・校風',
  class:    '授業・学習',
  teacher:  '先生',
  facility: '施設',
  access:   '立地・アクセス',
  pta:      'PTA・保護者',
  events:   '行事・イベント',
}

export function calcScore(school: SchoolWithRatings, weights: Weights): number {
  const total =
    (school.avg_policy   ?? 0) * weights.policy   +
    (school.avg_class    ?? 0) * weights.class     +
    (school.avg_teacher  ?? 0) * weights.teacher   +
    (school.avg_facility ?? 0) * weights.facility  +
    (school.avg_access   ?? 0) * weights.access    +
    (school.avg_pta      ?? 0) * weights.pta       +
    (school.avg_events   ?? 0) * weights.events
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0)
  return weightSum === 0 ? 0 : total / weightSum
}
