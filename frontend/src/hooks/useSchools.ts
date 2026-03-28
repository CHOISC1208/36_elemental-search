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

    // ── 半径検索モード ──────────────────────────────────────────
    if (params.center_lat !== null && params.center_lng !== null && params.radius_km !== null) {
      supabase
        .schema(SCHEMA)
        .rpc('schools_within_radius', {
          center_lat: params.center_lat,
          center_lng: params.center_lng,
          radius_km: params.radius_km,
        })
        .then(({ data }) => {
          let results: School[] = (data ?? []) as School[]

          // クライアントサイドで追加フィルター
          if (params.school_name) {
            const q = params.school_name.toLowerCase()
            results = results.filter(
              (s) =>
                s.school_name.toLowerCase().includes(q) ||
                (s.furigana ?? '').toLowerCase().includes(q)
            )
          }
          if (params.school_type) {
            results = results.filter((s) => s.school_type === params.school_type)
          }
          if (params.has_lunch) {
            results = results.filter((s) => s.lunch != null)
          }
          if (params.has_uniform) {
            results = results.filter((s) => s.uniform != null)
          }
          if (params.nearest_station) {
            const q = params.nearest_station.toLowerCase()
            results = results.filter((s) =>
              (s.nearest_station ?? '').toLowerCase().includes(q)
            )
          }
          if (params.has_reviews) {
            results = results.filter((s) => s.review_count > 0)
          }
          if (params.has_gaccom && gaccomIds.current.size > 0) {
            results = results.filter((s) => gaccomIds.current.has(s.school_id))
          }

          // 半径検索は距離順固定（RPC が distance_km 昇順で返す）
          setSchools(results.slice(0, 100))
          setLoading(false)
        })
      return
    }

    // ── 通常検索モード ───────────────────────────────────────────
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
    params.center_lat,
    params.center_lng,
    params.radius_km,
  ])

  return { schools, loading }
}
