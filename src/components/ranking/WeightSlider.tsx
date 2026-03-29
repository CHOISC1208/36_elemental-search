interface WeightSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

export function WeightSlider({ label, value, onChange }: WeightSliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-700">{label}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          value === 0 ? 'bg-gray-100 text-gray-400' : 'bg-brand-light text-brand'
        }`}>
          {value === 0 ? '無視' : value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-brand"
      />
    </div>
  )
}
