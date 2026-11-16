const STEPS: { title: string; body: string }[] = [
  { title: 'Survive 60 Days (Then Unlock Endless Mode)', body: 'Pick 1 of 8 Toronto characters and make daily choices to survive 60 days of winter, TTC delays, and city life, then push into Endless Mode (Day 61+) for maximum survival streaks.' },
  { title: 'Protect All 3 Bars', body: 'Watch your Cash ($), Sanity (⚡) and Health (❤️). If any single bar drops to 0, your run ends immediately.' },
  { title: 'Pay Rent Every 15 Days & Beat the Clock', body: 'Budget ahead for rent due on Days 15, 30, 45 and 60, and react fast when 10-second Shock Events appear.' },
  { title: 'High Stakes & Bag Items', body: 'Gamble on [HIGH STAKES • 50/50] choices for big comebacks and use items in your Bag to survive tough days.' },
]

export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="How to play" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>How to Play</h2>
        <ol className="howto">
          {STEPS.map((s) => (
            <li key={s.title}><b>{s.title}</b><span>{s.body}</span></li>
          ))}
        </ol>
        <button className="key key-yellow wide" onClick={onClose} autoFocus>Got it</button>
      </div>
    </div>
  )
}
