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
    ]).then(([schoolRes, reviewsRes]) => {
      setSchool(schoolRes.data)
      setReviews(reviewsRes.data ?? [])
      setLoading(false)
    })
  }, [schoolId])

  return { school, reviews, loading }
}
