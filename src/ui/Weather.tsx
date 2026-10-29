/** Header icons that react to the live readings. */

export function WeatherIcon({ tempC, precipMm, size = 30 }: { tempC: number; precipMm: number; size?: number }) {
  const snow = tempC < 0
  const wet = precipMm > 5
  const hot = tempC >= 22 && !wet
  const ink = { stroke: '#121212', strokeWidth: 3, strokeLinejoin: 'round' as const }
  return (
    <svg className="wx" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {(hot || (!wet && !snow)) && (
        <g className={hot ? 'rays' : ''}>
          <circle cx={hot ? 20 : 27} cy={hot ? 20 : 13} r={hot ? 9 : 7} fill="#FFD23F" {...ink} />
          {hot && [0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d="M20 3v5" stroke="#FFD23F" strokeWidth="3.5" strokeLinecap="round" transform={`rotate(${a} 20 20)`} />
          ))}
        </g>
      )}
      {!hot && (
        <path d="M11 30a7 7 0 0 1-1-13.9A9 9 0 0 1 27 14a6.5 6.5 0 0 1 1 16z" fill={snow || wet ? '#B8C4DB' : '#fff'} {...ink} />
      )}
      {wet && !snow && [14, 21, 28].map((x, i) => (
        <path key={x} className="drop" style={{ animationDelay: `${i * 0.25}s` }} d={`M${x} 32l-2 5`} stroke="#4CC9F0" strokeWidth="3.5" strokeLinecap="round" />
      ))}
      {snow && [13, 21, 29].map((x, i) => (
        <circle key={x} className="flake" style={{ animationDelay: `${i * 0.35}s` }} cx={x} cy="34" r="2.6" fill="#fff" />
      ))}
    </svg>
  )
}

/** Little streetcar: rolls when service is normal, parks with a flashing light when delayed. */
export function TrainIcon({ delayed, size = 34 }: { delayed: boolean; size?: number }) {
  return (
    <svg className={`train ${delayed ? 'stuck' : 'run'}`} width={size} height={size * 0.62} viewBox="0 0 56 34" aria-hidden="true">
      <g className="car">
        <rect x="3" y="6" width="50" height="19" rx="6" fill="#FF3B30" stroke="#121212" strokeWidth="3" />
        <rect x="9" y="10" width="9" height="8" rx="2" fill="#B8E8FF" stroke="#121212" strokeWidth="2" />
        <rect x="23" y="10" width="9" height="8" rx="2" fill="#B8E8FF" stroke="#121212" strokeWidth="2" />
        <rect x="37" y="10" width="11" height="8" rx="2" fill="#B8E8FF" stroke="#121212" strokeWidth="2" />
        <path d="M3 21h50" stroke="#fff" strokeWidth="2.5" />
        <circle cx="15" cy="28" r="3.6" fill="#121212" /><circle cx="41" cy="28" r="3.6" fill="#121212" />
        <path d="M28 6V2h8" fill="none" stroke="#121212" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {delayed && <circle className="alarm" cx="49" cy="5" r="4" fill="#FFD23F" stroke="#121212" strokeWidth="2" />}
    </svg>
  )
}
