'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { Prefecture, City } from '@/types/school'

export function usePrefectures() {
  const [prefectures, setPrefectures] = useState<Prefecture[]>([])

  useEffect(() => {
    supabase
      .schema(SCHEMA)
      .from('prefectures')
      .select('slug, name')
      .order('slug')
      .then(({ data }) => setPrefectures(data ?? []))
  }, [])

  return prefectures
}

export function usePrefCities(prefSlug: string) {
  const [cities, setCities] = useState<City[]>([])

  useEffect(() => {
    if (!prefSlug) {
      setCities([])
      return
    }
    supabase
      .schema(SCHEMA)
      .from('cities')
      .select('city_code, name, prefecture_slug')
      .eq('prefecture_slug', prefSlug)
      .order('name')
      .then(({ data }) => setCities(data ?? []))
  }, [prefSlug])

  return cities
}
