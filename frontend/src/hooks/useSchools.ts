'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { School, SearchParams } from '@/types/school'

// gaccom school_ids をモジュールレベルでキャッシュ（一度だけfetch）
let _gaccomIdsCache: Set<string> | null = null
let _gaccomIdsFetching: Promise<Set<string>> | null = null

function fetchGaccomIds(): Promise<Set<string>> {
  if (_gaccomIdsCache) return Promise.resolve(_gaccomIdsCache)
  if (!_gaccomIdsFetching) {
    _gaccomIdsFetching = Promise.resolve(
      supabase.schema(SCHEMA).from('school_links').select('school_id')
    ).then(({ data }) => {
      _gaccomIdsCache = new Set(data?.map((d: { school_id: string }) => d.school_id) ?? [])
      return _gaccomIdsCache
    })
  }
  return _gaccomIdsFetching
}

export function useSchools(params: SearchParams) {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(false)
  const gaccomIds = useRef<Set<string>>(new Set())

  // gaccom IDs を事前ロード
  useEffect(() => {
    fetchGaccomIds().then((ids) => { gaccomIds.current = ids })
  }, [])

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
    if (params.cities && params.cities.length > 0) {
      query = query.in('city', params.cities)
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
    if (params.nearest_station) {
      query = query.ilike('nearest_station', `%${params.nearest_station}%`)
    }
    if (params.has_reviews) {
      query = query.gt('review_count', 0)
    }

    if (params.sort === 'rating') {
      query = query.order('rating_avg', { ascending: false, nullsFirst: false })
    } else if (params.sort === 'reviews') {
      query = query.order('review_count', { ascending: false })
    }

    // has_gaccom はクライアントサイドでフィルタするため多めに取得
    const fetchLimit = params.has_gaccom ? 300 : 50

    query.limit(fetchLimit).then(({ data }) => {
      let results = data ?? []
      if (params.has_gaccom && gaccomIds.current.size > 0) {
        results = results.filter((s) => gaccomIds.current.has(s.school_id))
        results = results.slice(0, 50)
      }
      setSchools(results as School[])
      setLoading(false)
    })
  }, [
    params.prefecture_name,
    params.prefecture_slug,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    params.cities.join(','),
    params.school_name,
    params.school_type,
    params.has_lunch,
    params.has_uniform,
    params.nearest_station,
    params.has_reviews,
    params.has_gaccom,
    params.sort,
  ])

  return { schools, loading }
}
