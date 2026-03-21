interface Ratings {
  policy: number | null
  class: number | null
  teacher: number | null
  facility: number | null
  access: number | null
  pta: number | null
  events: number | null
}

interface RatingRadarProps {
  ratings: Ratings
}

const LABELS = ['方針', '授業', '先生', '施設', 'アクセス', 'PTA', '行事']
const KEYS: (keyof Ratings)[] = ['policy', 'class', 'teacher', 'facility', 'access', 'pta', 'events']

export function RatingRadar({ ratings }: RatingRadarProps) {
  const cx = 100
  const cy = 100
  const r = 80
  const n = KEYS.length
  const max = 5

  const points = KEYS.map((key, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const val = ratings[key] ?? 0
    const ratio = val / max
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    }
  })

  const gridPoints = (ratio: number) =>
    KEYS.map((_, i) => {
      const angle = (Math.PI * 2 * i) / n - Math.PI / 2
      return `${cx + r * ratio * Math.cos(angle)},${cy + r * ratio * Math.sin(angle)}`
    }).join(' ')

  const dataPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-48 h-48">
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={gridPoints(ratio)}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="1"
          />
        ))}
        {KEYS.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + r * Math.cos(angle)}
              y2={cy + r * Math.sin(angle)}
              stroke="#E5E7EB"
              strokeWidth="1"
            />
          )
        })}
        <path d={dataPath} fill="#E07B3F" fillOpacity="0.3" stroke="#E07B3F" strokeWidth="2" />
        {KEYS.map((key, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2
          const lx = cx + (r + 14) * Math.cos(angle)
          const ly = cy + (r + 14) * Math.sin(angle)
          return (
            <text
              key={key}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="#6B7280"
            >
              {LABELS[i]}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
