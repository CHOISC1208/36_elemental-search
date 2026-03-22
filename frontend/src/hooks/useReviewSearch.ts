'use client'
import { useState } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'

export interface ReviewSearchParams {
  keyword: string
  prefecture_name?: string
  city_code?: string
  poster_type?: '保護者' | '生徒' | '卒業生' | ''
  limit?: number
}

export interface ReviewSearchResult {
  review_id: number
  school_id: string
  school_name: string
  prefecture: string
  city: string
  poster_type: string
  rating_overall: number | null
  text_overall: string | null
  post_date: string | null
  title: string | null
}

export function useReviewSearch() {
  const [results, setResults] = useState<ReviewSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async (params: ReviewSearchParams) => {
    setLoading(true)
    setSearched(true)

    try {
      // 都道府県フィルターがある場合は school_id の IN クエリで対応
      let schoolIds: string[] | null = null
      if (params.prefecture_name) {
        const { data: schools } = await supabase
          .schema(SCHEMA)
          .from('schools')
          .select('school_id')
          .eq('prefecture', params.prefecture_name)
        schoolIds = (schools ?? []).map((s: { school_id: string }) => s.school_id)
        if (schoolIds.length === 0) {
          setResults([])
          setLoading(false)
          return
        }
      }

      let query = supabase
        .schema(SCHEMA)
        .from('school_reviews')
        .select(`
          id,
          school_id,
          poster_type,
          post_date,
          title,
          rating_overall,
          text_overall,
          schools!inner (
            school_name,
            prefecture,
            city
          )
        `)
        .not('text_overall', 'is', null)

      if (params.keyword) {
        query = query.ilike('text_overall', `%${params.keyword}%`)
      }
      if (params.poster_type) {
        query = query.eq('poster_type', params.poster_type)
      }
      if (schoolIds !== null) {
        query = query.in('school_id', schoolIds)
      }
      if (params.city_code) {
        query = query.eq('schools.city', params.city_code)
      }

      query = query.order('post_date', { ascending: false }).limit(params.limit ?? 30)

      const { data } = await query

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: ReviewSearchResult[] = (data ?? []).map((r: any) => ({
        review_id: r.id,
        school_id: r.school_id,
        school_name: r.schools?.school_name ?? '',
        prefecture: r.schools?.prefecture ?? '',
        city: r.schools?.city ?? '',
        poster_type: r.poster_type,
        rating_overall: r.rating_overall,
        text_overall: r.text_overall,
        post_date: r.post_date,
        title: r.title,
      }))

      setResults(mapped)
    } finally {
      setLoading(false)
    }
  }

  return { results, loading, searched, search }
}
