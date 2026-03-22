'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { SchoolWithRatings } from '@/types/ranking'

export interface RankingFilters {
  prefecture_name?: string
  city?: string
  school_type?: '公立' | '私立' | '国立' | ''
  min_reviews?: number
}

export function useRankingData(filters: RankingFilters) {
  const [schools, setSchools] = useState<SchoolWithRatings[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    let query = supabase
      .schema(SCHEMA)
      .from('school_rating_summary')
      .select('*')
      .gte('review_count_verified', filters.min_reviews ?? 3)

    if (filters.prefecture_name) {
      query = query.eq('prefecture', filters.prefecture_name)
    }
    if (filters.city) {
      query = query.eq('city', filters.city)
    }
    if (filters.school_type) {
      query = query.eq('school_type', filters.school_type)
    }

    query
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(200)
      .then(({ data }) => {
        setSchools((data ?? []) as SchoolWithRatings[])
        setLoading(false)
      })
  }, [filters.prefecture_name, filters.city, filters.school_type, filters.min_reviews])

  return { schools, loading }
}
