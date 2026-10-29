import type { Settings } from './settings'

const ROWS: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'sound', label: 'Sound effects', hint: 'Coins, hits and jingles' },
  { key: 'vibration', label: 'Vibration', hint: 'Phone buzz on big moments' },
  { key: 'large', label: 'Larger text', hint: 'Scales the whole game up' },
  { key: 'calm', label: 'Calm motion', hint: 'Turns off animations and effects' },
  { key: 'contrast', label: 'High contrast', hint: 'Black panels, white outlines' },
]

export function SettingsPanel({ settings, onChange, onClose }: { settings: Settings; onChange: (p: Partial<Settings>) => void; onClose: () => void }) {
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <ul>
          {ROWS.map((r) => (
            <li key={r.key}>
              <label>
                <span><b>{r.label}</b><small>{r.hint}</small></span>
                <input type="checkbox" role="switch" checked={settings[r.key]} onChange={(e) => onChange({ [r.key]: e.target.checked })} />
                <i className="switch" aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
        <button className="key key-yellow wide" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
