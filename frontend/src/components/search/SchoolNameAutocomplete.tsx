'use client'
import { useState, useEffect } from 'react'
import { supabase, SCHEMA } from '@/lib/supabase'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

interface SchoolSuggestion {
  school_id: string
  school_name: string
  prefecture: string
  city: string
}

interface SchoolNameAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (school: SchoolSuggestion) => void
}

export function SchoolNameAutocomplete({ value, onChange, onSelect }: SchoolNameAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([])
  const debouncedValue = useDebouncedValue(value, 200)

  useEffect(() => {
    if (debouncedValue.length < 2) {
      setSuggestions([])
      return
    }
    supabase
      .schema(SCHEMA)
      .from('schools')
      .select('school_id, school_name, prefecture, city')
      .or(`school_name.ilike.%${debouncedValue}%,furigana.ilike.%${debouncedValue}%`)
      .limit(10)
      .then(({ data }) => setSuggestions(data ?? []))
  }, [debouncedValue])

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="学校名・よみがなで検索..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto mt-1">
          {suggestions.map((s) => (
            <li
              key={s.school_id}
              onMouseDown={() => { onSelect(s); onChange(s.school_name); setOpen(false) }}
              className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center gap-2"
            >
              <span className="text-sm text-gray-900 truncate">{s.school_name}</span>
              <span className="text-xs text-gray-400 shrink-0">{s.prefecture} {s.city}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
