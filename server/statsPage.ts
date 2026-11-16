/** The owners' pages: password screen and the stats dashboard. Plain HTML + CSS, no scripts, no external requests. */
import type { Metric, Report } from './stats.ts'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const CSS = `
@font-face{font-family:'Lilita One';font-display:swap;src:url(/fonts/lilita-one-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Nunito';font-weight:700;font-display:swap;src:url(/fonts/nunito-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Nunito';font-weight:900;font-display:swap;src:url(/fonts/nunito-latin-900-normal.woff2) format('woff2')}
:root{color-scheme:dark;--ink:#121212;--card:#1F1F2B;--line:#34344A;--mut:#B9B9CC;--yellow:#FFD23F;--red:#FF3B30;--mint:#2EE6A6;--sky:#4CC9F0;--pink:#FF6FB5;--display:'Lilita One','Arial Black',system-ui,sans-serif}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--ink) radial-gradient(rgba(255,255,255,.07) 2px,transparent 2px) 0 0/36px 36px;color:#fff;font:700 15px/1.45 'Nunito',system-ui,sans-serif}
a{color:var(--sky)}
h1,h2,.num,.badge,button{font-family:var(--display);font-weight:400}
.wrap{max-width:980px;margin:0 auto;padding:22px 16px 60px}
.card{background:var(--card);border:3px solid #fff;border-radius:22px;box-shadow:6px 6px 0 var(--accent,var(--yellow));padding:16px}
`

const LOGIN_CSS = `
.login{min-height:100vh;display:grid;place-items:center;padding:20px}
.login .card{width:min(360px,100%);display:grid;gap:14px;text-align:center;transform:rotate(-.6deg)}
.coin{width:64px;height:64px;margin:-46px auto 0;filter:drop-shadow(0 4px 0 #0008)}
.login h1{margin:0;font-size:30px;line-height:1;color:var(--yellow);text-shadow:3px 3px 0 var(--ink);-webkit-text-stroke:2px var(--ink);paint-order:stroke fill;text-transform:uppercase}
.login p{margin:0;color:var(--mut);font-size:14px}
.login p.err{color:#fff;background:var(--red);border:3px solid var(--ink);border-radius:12px;padding:6px 10px;font-weight:900}
input{font:inherit;font-weight:900;width:100%;padding:13px 14px;border-radius:14px;border:3px solid #fff;background:var(--ink);color:#fff;text-align:center;letter-spacing:.12em}
input:focus{outline:3px solid var(--sky);outline-offset:2px}
button{width:100%;padding:13px;border-radius:14px;border:3px solid var(--ink);background:var(--yellow);color:var(--ink);font-size:20px;letter-spacing:.04em;cursor:pointer;box-shadow:0 5px 0 #B8901A;transition:transform .08s,box-shadow .08s}
button:active{transform:translateY(4px);box-shadow:0 1px 0 #B8901A}
`

export function loginPage(error: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#121212"><title>TSS stats</title><style>${CSS}${LOGIN_CSS}</style></head><body>
<main class="login"><form class="card" method="post" action="/stats">
<svg class="coin" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#FFD23F" stroke="#121212" stroke-width="5"/><circle cx="32" cy="32" r="18" fill="none" stroke="#121212" stroke-width="4"/><path d="M32 20v24M38 25c-2-3-12-3-12 2s12 4 12 9-10 6-12 2" fill="none" stroke="#121212" stroke-width="4" stroke-linecap="round"/></svg>
<h1>Survival stats</h1><p>Toronto Survival Simulator. Owners only.</p>
${error ? '<p class="err" role="alert">Wrong password. Try again.</p>' : ''}
<input type="password" name="password" placeholder="Password" aria-label="Password" autocomplete="current-password" autofocus required>
<button>Open stats</button></form></main></body></html>`
}

const DASH_CSS = `
.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin-bottom:18px}
.top h1{margin:0;font-size:32px;line-height:1;color:var(--yellow);text-shadow:3px 3px 0 #000;text-transform:uppercase}
.top small{display:block;color:var(--mut);font-weight:700;font-size:13px}
.pills{margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.pills a{padding:6px 14px;border-radius:99px;border:3px solid #fff;background:var(--card);color:#fff;text-decoration:none;font-weight:900;font-size:13px}
.pills a.on{background:var(--yellow);color:var(--ink);border-color:var(--ink)}
.pills a.quiet{border-color:var(--line);color:var(--mut)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(138px,1fr));gap:14px;margin-bottom:22px}
.kpi{padding:12px 14px;border-radius:18px;box-shadow:5px 5px 0 var(--accent);border-width:3px}
.kpi .l{color:var(--mut);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.07em}
.kpi .num{font-size:38px;line-height:1.05;color:var(--accent)}
.kpi .d{color:var(--mut);font-size:12px}
.kpi .d b{color:#fff}
.rates{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:22px}
.rate{background:var(--card);border:3px solid var(--line);border-radius:14px;padding:8px 12px}
.rate .num{font-size:24px;color:#fff}.rate span{display:block;color:var(--mut);font-size:12px}
h2{font-size:21px;margin:0 0 10px;color:#fff}
h2 small{font-family:'Nunito',sans-serif;font-weight:700;font-size:12px;color:var(--mut);margin-left:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-bottom:22px;align-items:start}
.chart{display:flex;align-items:flex-end;gap:2px;height:150px;padding-top:8px}
.chart .col{flex:1 1 0;min-width:2px;height:100%;display:flex;align-items:flex-end;gap:1px}
.chart i{flex:1;border-radius:3px 3px 0 0;min-height:0}
.chart i.v{background:var(--sky)}.chart i.s{background:var(--yellow)}
.axis{display:flex;justify-content:space-between;color:var(--mut);font-size:12px;margin-top:6px}
.legend{display:flex;gap:14px;color:var(--mut);font-size:12px;margin-top:6px}
.legend b{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
.bars{display:grid;gap:9px;margin:0;padding:0;list-style:none}
.bars li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center}
.bars .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:900}
.bars .v{color:var(--yellow);font-family:var(--display);font-size:17px}
.bars .t{grid-column:1/-1;height:9px;border-radius:99px;background:#34344A;overflow:hidden}
.bars .t i{display:block;height:100%;border-radius:99px;background:var(--c,var(--mint))}
.bars .sub{grid-column:1/-1;color:var(--mut);font-size:12px;margin-top:-2px}
.empty{color:var(--mut);margin:0}
.foot{margin-top:26px;color:var(--mut);font-size:12px}
@media(max-width:520px){.top h1{font-size:26px}.pills{margin-left:0}}
`

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '–')

function fmtDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const end = Date.parse(`${to}T00:00:00Z`)
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

const CLASS_NAMES: Record<string, string> = {
  NIGHTLIFE_PROMOTER: 'Nightlife Promoter', LUXURY_DATER: 'Luxury Dater', GIG_COURIER: 'Gig Courier',
  STARTUP_HUSTLER: 'Startup Hustler', CAMPUS_RES: 'Campus Resident',
}
function className(id: string): string {
  const raw = id.replace(/^CLASS_\d+_/, '')
  return CLASS_NAMES[raw] ?? raw.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const OUTCOME_NAMES: Record<string, [string, string]> = {
  endurance: ['Survived the 60 days', '#2EE6A6'], asset: ['Bought the condo', '#4CC9F0'], wealth: ['Wealth victory', '#FFD23F'], lost: ['Lost the run', '#FF3B30'],
}

function bars(rows: { name: string; value: number; sub?: string; color?: string }[], emptyText: string): string {
  if (!rows.length) return `<p class="empty">${esc(emptyText)}</p>`
  const max = Math.max(...rows.map((r) => r.value), 1)
  return `<ul class="bars">${rows.map((r) => `<li><span class="n" title="${esc(r.name)}">${esc(r.name)}</span><span class="v">${r.value}</span><span class="t"><i style="width:${Math.max(3, Math.round((r.value / max) * 100))}%;${r.color ? `--c:${r.color}` : ''}"></i></span>${r.sub ? `<span class="sub">${esc(r.sub)}</span>` : ''}</li>`).join('')}</ul>`
}

export function renderReport(r: Report): string {
  const kpi = (label: string, m: Metric, color: string) =>
    `<div class="card kpi" style="--accent:${color}"><div class="l">${label}</div><div class="num">${r.totals[m]}</div><div class="d"><b>+${r.today[m]}</b> today</div></div>`
  const t = r.totals

  const byDay = new Map(r.daily.map((d) => [d.day, d.counts]))
  const days = eachDay(r.from, r.to)
  const peak = Math.max(1, ...days.map((d) => Math.max(byDay.get(d)?.visit ?? 0, byDay.get(d)?.start ?? 0)))
  const chart = days.map((d) => {
    const c = byDay.get(d)
    const v = c?.visit ?? 0
    const s = c?.start ?? 0
    return `<div class="col" title="${esc(fmtDay(d))}: ${v} visits, ${s} runs started"><i class="v" style="height:${(v / peak) * 100}%"></i><i class="s" style="height:${(s / peak) * 100}%"></i></div>`
  }).join('')

  const refRows = Object.entries(r.refs)
    .sort((a, b) => b[1].visit - a[1].visit || b[1].start - a[1].start)
    .map(([name, c]) => ({
      name: name === 'direct' ? 'direct (no ref code)' : name,
      value: c.visit,
      sub: `${c.start} runs started · ${c.finish} finished · ${c.win} won · ${c.sponsor_click} sponsor clicks`,
      color: name === 'direct' ? '#B9B9CC' : '#FF6FB5',
    }))
  const classRows = Object.entries(r.classes).sort((a, b) => b[1] - a[1]).map(([id, v]) => ({ name: className(id), value: v, color: '#FFD23F' }))
  const outRows = Object.entries(r.outcomes).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: OUTCOME_NAMES[k]?.[0] ?? k, value: v, color: OUTCOME_NAMES[k]?.[1] }))
  const sponsorRows = Object.entries(r.sponsors).sort((a, b) => b[1] - a[1]).map(([name, v]) => ({ name, value: v, color: '#4CC9F0' }))

  const pill = (n: number) => `<a href="/stats?days=${n}"${r.days === n ? ' class="on"' : ''}>${n} days</a>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#121212"><title>TSS stats</title><style>${CSS}${DASH_CSS}</style></head><body><div class="wrap">
<header class="top"><div><h1>Survival stats</h1><small>${esc(fmtDay(r.from))} to ${esc(fmtDay(r.to))} · Toronto time · one visit = one browser session</small></div>
<nav class="pills" aria-label="Range">${pill(7)}${pill(30)}${pill(60)}<a class="quiet" href="/stats?days=${r.days}">Refresh</a><a class="quiet" href="/stats?logout=1">Log out</a></nav></header>

<section class="kpis" aria-label="Totals">${kpi('Visits', 'visit', '#4CC9F0')}${kpi('Runs started', 'start', '#FFD23F')}${kpi('Finished', 'finish', '#2EE6A6')}${kpi('Won', 'win', '#FF6FB5')}${kpi('Endless mode', 'endless', '#A78BFA')}${kpi('Sponsor clicks', 'sponsor_click', '#FF9F43')}</section>

<section class="rates" aria-label="Rates">
<div class="rate"><div class="num">${pct(t.start, t.visit)}</div><span>of visitors start a run</span></div>
<div class="rate"><div class="num">${pct(t.finish, t.start)}</div><span>of runs get finished</span></div>
<div class="rate"><div class="num">${pct(t.win, t.finish)}</div><span>of finished runs are wins</span></div>
<div class="rate"><div class="num">${pct(t.sponsor_click, t.visit)}</div><span>of visitors click a sponsor</span></div></section>

<section class="card" style="--accent:var(--sky);margin-bottom:22px"><h2>Every day <small>peak ${peak} in a day</small></h2><div class="chart" role="img" aria-label="Visits and runs started per day">${chart}</div>
<div class="axis"><span>${esc(fmtDay(r.from))}</span><span>${esc(fmtDay(r.to))}</span></div>
<div class="legend"><span><b style="background:var(--sky)"></b>Visits</span><span><b style="background:var(--yellow)"></b>Runs started</span></div></section>

<div class="grid">
<section class="card" style="--accent:var(--pink)"><h2>Campus referrals <small>?ref= codes</small></h2>${bars(refRows, 'No visits yet.')}</section>
<section class="card" style="--accent:var(--yellow)"><h2>Characters picked</h2>${bars(classRows, 'No runs started yet.')}</section>
<section class="card" style="--accent:var(--mint)"><h2>How runs end</h2>${bars(outRows, 'No finished runs yet.')}</section>
<section class="card" style="--accent:var(--sky)"><h2>Sponsor clicks <small>by name</small></h2>${bars(sponsorRows, 'No sponsor clicks yet.')}</section>
</div>
<p class="foot">Counts are anonymous and approximate. Add <code>?format=json</code> to the address for the raw numbers.</p>
</div></body></html>`
}
