'use client'

interface SchoolMapProps {
  schoolName: string
  address: string | null
}

export function SchoolMap({ schoolName, address }: SchoolMapProps) {
  if (!address) return null

  const query = encodeURIComponent(`${schoolName} ${address}`)
  const embedUrl = `https://maps.google.com/maps?q=${query}&output=embed&hl=ja`
  const mapsUrl  = `https://www.google.com/maps/search/?api=1&query=${query}`

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-700">所在地マップ</p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand hover:underline"
        >
          Google Maps で開く →
        </a>
      </div>
      <div className="rounded-xl overflow-hidden border border-gray-200 h-64">
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`${schoolName}の地図`}
        />
      </div>
    </div>
  )
}
