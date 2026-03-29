import { SCHOOL_TYPE_COLORS } from '@/lib/colors'

interface BadgeProps {
  type: string
}

export function Badge({ type }: BadgeProps) {
  const colors = SCHOOL_TYPE_COLORS[type] ?? { bg: '#F3F4F6', text: '#374151' }
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {type}
    </span>
  )
}
