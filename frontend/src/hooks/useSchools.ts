'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { School, SearchParams } from '@/types/school'

export function useSchools(params: SearchParams) {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    let query = supabase
      .schema(SCHEMA)
      .from('schools')
      .select(
        'school_id, school_name, furigana, prefecture, city, address, nearest_station, school_type, uniform, lunch, events, tuition, selection, selection_method, rating_avg, review_count'
      )

    if (params.prefecture_name) {
      query = query.eq('prefecture', params.prefecture_name)
    }
    if (params.city_code) {
      query = query.eq('city', params.city_code)
    }
    if (params.school_name) {
      query = query.or(
        `school_name.ilike.%${params.school_name}%,furigana.ilike.%${params.school_name}%`
      )
    }
    if (params.school_type) {
      query = query.eq('school_type', params.school_type)
    }
    if (params.has_lunch) {
      query = query.not('lunch', 'is', null)
    }
    if (params.has_uniform) {
      query = query.not('uniform', 'is', null)
    }

    if (params.sort === 'rating') {
      query = query.order('rating_avg', { ascending: false, nullsFirst: false })
    } else if (params.sort === 'reviews') {
      query = query.order('review_count', { ascending: false })
    }

    query.limit(50).then(({ data }) => {
      setSchools(data ?? [])
      setLoading(false)
    })
  }, [
    params.prefecture_name,
    params.prefecture_slug,
    params.city_code,
    params.school_name,
    params.school_type,
    params.has_lunch,
    params.has_uniform,
    params.sort,
  ])

  return { schools, loading }
}
