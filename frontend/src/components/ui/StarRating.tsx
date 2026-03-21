interface StarRatingProps {
  rating: number | null
  size?: 'sm' | 'md'
}

export function StarRating({ rating, size = 'md' }: StarRatingProps) {
  if (rating == null) return <span className="text-gray-400 text-sm">-</span>
  const stars = Math.round(rating)
  const sz = size === 'sm' ? 'text-sm' : 'text-base'
  return (
    <span className={`${sz} text-amber-400`}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
      <span className="ml-1 text-gray-600 text-sm">{rating.toFixed(1)}</span>
    </span>
  )
}
