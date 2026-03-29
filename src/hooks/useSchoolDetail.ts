'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { School, SchoolReview } from '@/types/school'

export function useSchoolDetail(schoolId: string) {
  const [school, setSchool] = useState<School | null>(null)
  const [reviews, setReviews] = useState<SchoolReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!schoolId) return
    setLoading(true)

    Promise.all([
      supabase
        .schema(SCHEMA)
        .from('schools')
        .select('*')
        .eq('school_id', schoolId)
        .single(),
      supabase
        .schema(SCHEMA)
        .from('school_reviews')
        .select(
          'id, school_id, poster_type, enrollment_year, post_date, title, rating_overall, rating_policy, rating_class, rating_teacher, rating_facility, rating_access, rating_pta, rating_events, text_overall'
        )
        .eq('school_id', schoolId)
        .order('scraped_at', { ascending: false }),
      supabase
        .schema(SCHEMA)
        .from('school_links')
        .select('match_score, gaccom_schools(student_count, teacher_count, linked_jhs)')
        .eq('school_id', schoolId)
        .order('match_score', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([schoolRes, reviewsRes, gaccomRes]) => {
      let schoolData = schoolRes.data
      if (schoolData && gaccomRes.data) {
        const g = (gaccomRes.data.gaccom_schools as unknown) as { student_count: number | null; teacher_count: number | null; linked_jhs: string | null } | null
        if (g) {
          schoolData = {
            ...schoolData,
            student_count: g.student_count,
            teacher_count: g.teacher_count,
            linked_jhs: schoolData.linked_jhs ?? g.linked_jhs,
          }
        }
      }
      setSchool(schoolData)
      setReviews(reviewsRes.data ?? [])
      setLoading(false)
    })
  }, [schoolId])

  return { school, reviews, loading }
}
