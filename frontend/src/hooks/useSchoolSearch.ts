'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { School, SchoolType } from '@/types/school'

export const SCHOOL_SEARCH_PAGE_SIZE = 20

export interface SchoolSearchQuery {
  school_name: string
  prefectures: string[]
  city_name: string | null
  school_types: SchoolType[]
  // 半径検索（設定時は都道府県/市区町村フィルターより優先）
  center_lat: number | null
  center_lng: number | null
  radius_km: number | null
}

export function useSchoolSearch(query: SchoolSearchQuery | null, page: number) {
  const [schools, setSchools]   = useState<School[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    if (!query) { setSchools([]); setTotal(0); return }
    setLoading(true)

    // ── 半径検索モード ──────────────────────────────────────────
    if (query.center_lat !== null && query.center_lng !== null && query.radius_km !== null) {
      supabase
        .schema(SCHEMA)
        .rpc('schools_within_radius', {
          center_lat: query.center_lat,
          center_lng: query.center_lng,
          radius_km:  query.radius_km,
        })
        .then(({ data }) => {
          let results = (data ?? []) as School[]
          if (query.school_name) {
            const q = query.school_name.toLowerCase()
            results = results.filter(s =>
              s.school_name.toLowerCase().includes(q) ||
              (s.furigana ?? '').toLowerCase().includes(q)
            )
          }
          if (query.school_types.length > 0) {
            results = results.filter(s => query.school_types.includes(s.school_type))
          }
          const capped = results.slice(0, 100)
          setSchools(capped)
          setTotal(capped.length)
          setLoading(false)
        })
      return
    }

    // ── 通常検索モード（サーバーサイドページネーション） ────────
    const from = (page - 1) * SCHOOL_SEARCH_PAGE_SIZE
    const to   = from + SCHOOL_SEARCH_PAGE_SIZE - 1

    let q = supabase
      .schema(SCHEMA)
      .from('schools')
      .select(
        'school_id, school_name, furigana, school_type, prefecture, city, address, nearest_station, rating_avg, review_count',
        { count: 'exact' }
      )

    if (query.school_name)         q = q.or(`school_name.ilike.%${query.school_name}%,furigana.ilike.%${query.school_name}%`)
    if (query.prefectures.length)  q = q.in('prefecture', query.prefectures)
    if (query.city_name)           q = q.eq('city', query.city_name)
    if (query.school_types.length) q = q.in('school_type', query.school_types)

    q.order('rating_avg', { ascending: false, nullsFirst: false })
      .range(from, to)
      .then(({ data, count }) => {
        setSchools((data ?? []) as School[])
        setTotal(count ?? 0)
        setLoading(false)
      })
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(query),
    page,
  ])

  return { schools, total, loading }
}
