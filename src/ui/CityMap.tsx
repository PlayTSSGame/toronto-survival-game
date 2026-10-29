/** Simplified, not-to-scale Toronto map. The current location lights up. */

const POIS: { key: string; keywords: string[]; x: number; y: number; label: string }[] = [
  { key: 'mississauga', keywords: ['mississauga'], x: 38, y: 150, label: 'Mississauga' },
  { key: 'york', keywords: ['york'], x: 118, y: 28, label: 'York U' },
  { key: 'uoft', keywords: ['u of t', 'campus', 'robarts', 'residence', 'quad'], x: 150, y: 98, label: 'U of T' },
  { key: 'bloor', keywords: ['bloor', 'loblaws'], x: 190, y: 82, label: 'Bloor-Yonge' },
  { key: 'dundas', keywords: ['dundas', 'spadina'], x: 190, y: 116, label: 'Yonge-Dundas' },
  { key: 'eaton', keywords: ['eaton'], x: 214, y: 128, label: 'Eaton Centre' },
  { key: 'kingwest', keywords: ['king west'], x: 132, y: 146, label: 'King West' },
  { key: 'fidi', keywords: ['financial', 'bay street'], x: 196, y: 150, label: 'Financial Dist.' },
  { key: 'union', keywords: ['union', 'st. george'], x: 176, y: 162, label: 'Union' },
  { key: 'gardiner', keywords: ['gardiner', 'downtown'], x: 262, y: 170, label: 'Gardiner' },
]

function matchPoi(place: string) {
  const p = place.toLowerCase()
  return POIS.find((poi) => poi.keywords.some((k) => p.includes(k)))
}

export function CityMap({ place }: { place: string }) {
  const here = matchPoi(place)
  return (
    <figure className="map">
      <svg viewBox="0 0 360 220" role="img" aria-label={`Map. You are at ${place}`}>
        <rect width="360" height="220" fill="#2A3350" />
        {/* lake */}
        <path d="M0 184q60-14 120 0t120 0 120-8v44H0z" fill="#3A8FD6" stroke="#121212" strokeWidth="3" />
        <path d="M20 205q20-6 40 0M150 208q20-6 40 0M270 204q20-6 40 0" fill="none" stroke="#B8E8FF" strokeWidth="3" strokeLinecap="round" />
        {/* streets */}
        <g stroke="#4A5578" strokeWidth="6" strokeLinecap="round">
          <path d="M190 14V176M20 126h330M20 150h330M60 86h280" />
        </g>
        {/* subway line 1 (U) and line 2 (Bloor) */}
        <path d="M190 14V158H150V92L128 70" fill="none" stroke="#FFD23F" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M60 86h280" fill="none" stroke="#2EE6A6" strokeWidth="7" strokeLinecap="round" />
        {POIS.map((p) => {
          const on = here?.key === p.key
          return (
            <g key={p.key} transform={`translate(${p.x} ${p.y})`}>
              {on && <circle className="ping" r="10" fill="none" stroke="#FF3B30" strokeWidth="4" />}
              <circle r={on ? 7 : 4.5} fill={on ? '#FF3B30' : '#fff'} stroke="#121212" strokeWidth="3" />
              <text y={on ? -13 : -9} textAnchor="middle" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize={on ? 12 : 9} fill={on ? '#fff' : '#C9CFE6'} stroke="#121212" strokeWidth="3" paintOrder="stroke">{p.label}</text>
            </g>
          )
        })}
      </svg>
      <figcaption>{here ? `You are at ${here.label}` : place}</figcaption>
    </figure>
  )
}
