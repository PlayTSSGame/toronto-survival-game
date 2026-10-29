import type { GameState } from '../types'

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-CA', { maximumFractionDigits: 2 })}`

/** Draws a 1080x1080 result card. The medal is lifted from the on-screen SVG so it always matches. */
export async function makeResultPng(state: GameState, rank: string, outcome: string, url: string): Promise<Blob> {
  const W = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = W
  const c = canvas.getContext('2d')
  if (!c) throw new Error('canvas unavailable')
  try { await Promise.all([document.fonts.load('64px "Lilita One"'), document.fonts.load('900 32px Nunito')]) } catch { /* fall back to system fonts */ }

  const won = state.status === 'finished'
  c.fillStyle = '#121212'
  c.fillRect(0, 0, W, W)
  c.fillStyle = 'rgba(255,255,255,.07)'
  for (let y = 18; y < W; y += 36) for (let x = 18; x < W; x += 36) c.fillRect(x, y, 3, 3)

  c.lineWidth = 12
  c.strokeStyle = '#fff'
  c.fillStyle = '#1F1F2B'
  c.beginPath(); c.roundRect(50, 50, W - 100, W - 100, 60); c.fill(); c.stroke()
  c.fillStyle = won ? '#2EE6A6' : '#FF3B30'
  c.fillRect(110, 50 - 6, W - 220, 12)

  c.textAlign = 'center'
  c.fillStyle = '#FFD23F'
  c.font = '56px "Lilita One", system-ui, sans-serif'
  c.fillText('TORONTO SURVIVAL SIMULATOR', W / 2, 150)

  const svg = document.querySelector('.medal')
  if (svg) {
    // Size the clone to the viewBox ratio so the medal is not stretched.
    const clone = svg.cloneNode(true) as SVGElement
    clone.setAttribute('width', '340')
    clone.setAttribute('height', '380')
    const str = new XMLSerializer().serializeToString(clone)
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str)
    try { await img.decode(); c.drawImage(img, W / 2 - 170, 190, 340, 380) } catch { /* medal optional */ }
  }

  c.fillStyle = '#B9B9CC'
  c.font = '900 30px Nunito, system-ui, sans-serif'
  c.fillText('YOUR RANK', W / 2, 640)
  c.fillStyle = '#FFD23F'
  c.strokeStyle = '#121212'
  c.lineWidth = 10
  c.font = '104px "Lilita One", system-ui, sans-serif'
  c.lineJoin = 'round'
  c.strokeText(rank, W / 2, 740, 900)
  c.fillText(rank, W / 2, 740, 900)
  c.fillStyle = '#fff'
  c.font = '700 40px Nunito, system-ui, sans-serif'
  c.fillText(outcome, W / 2, 805)

  const pills: [string, string][] = [[money(state.stats.cash), '#FFD23F'], [`Sanity ${state.stats.sanity}`, '#4CC9F0'], [`Health ${state.stats.health}`, '#FF6FB5']]
  c.font = '44px "Lilita One", system-ui, sans-serif'
  const widths = pills.map(([t]) => c.measureText(t).width + 60)
  const total = widths.reduce((a, b) => a + b, 0) + 24 * (pills.length - 1)
  let x = (W - total) / 2
  pills.forEach(([t, col], i) => {
    c.fillStyle = '#2A2A3A'
    c.beginPath(); c.roundRect(x, 850, widths[i], 84, 42); c.fill()
    c.fillStyle = col
    c.textAlign = 'center'
    c.fillText(t, x + widths[i] / 2, 910)
    x += widths[i] + 24
  })

  c.fillStyle = '#B9B9CC'
  c.font = '700 30px Nunito, system-ui, sans-serif'
  c.fillText(url, W / 2, 990, 900)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'))
}

/** Shares the image natively where files are supported, otherwise downloads it. */
export async function saveOrShare(blob: Blob, name = 'toronto-survival-result.png'): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Toronto Survival Simulator' })
      return 'shared'
    }
  } catch { /* cancelled or unsupported: fall through to download */ }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'saved'
}
