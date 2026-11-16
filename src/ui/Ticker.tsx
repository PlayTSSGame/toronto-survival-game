import { loadSponsors, PLACEHOLDER, type Sponsor } from './sponsors'

/**
 * Continuous scrolling sponsor banner. Shows the placeholder slots until paid sponsors are added.
 * It pauses on hover/focus and holds still when Calm motion (or reduced motion) is on.
 */
export function SponsorTicker({ onSponsorClick, sponsors = loadSponsors() }: { onSponsorClick: (name: string) => void; sponsors?: Sponsor[] }) {
  const slots: Sponsor[] = sponsors.length ? sponsors : [{ name: 'placeholder', text: PLACEHOLDER }]
  // Repeat the strip so the loop has no gap, even on a wide desktop screen.
  const lane = (copy: number) => (
    <ul className="ticker-lane" aria-hidden={copy > 0 ? 'true' : undefined} key={copy}>
      {[...slots, ...slots].map((s, i) => (
        <li key={i}>
          {s.url ? (
            <a href={s.url} target="_blank" rel="noopener noreferrer sponsored" tabIndex={copy > 0 ? -1 : undefined} onClick={() => onSponsorClick(s.name)}>
              <b>{s.name}</b> {s.text}
            </a>
          ) : (
            <span>{s.text}</span>
          )}
        </li>
      ))}
    </ul>
  )
  return (
    <aside className="ticker" aria-label="Sponsors">
      <div className="ticker-track">{lane(0)}{lane(1)}</div>
    </aside>
  )
}
