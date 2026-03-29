import React from 'react'

export function highlightText(text: string, keyword: string): React.ReactNode {
  if (!keyword || !text) return text
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 rounded-sm px-0.5 font-medium">{part}</mark>
      : part
  )
}
