interface ScoreBarProps {
  label: string
  score: number | null
  max?: number
}

export function ScoreBar({ label, score, max = 5 }: ScoreBarProps) {
  const pct = score != null ? (score / max) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 shrink-0 text-gray-600">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: score != null ? `${pct}%` : '0%' }}
        />
      </div>
      <span className="w-8 text-right text-gray-700">
        {score != null ? score.toFixed(1) : '-'}
      </span>
    </div>
  )
}
