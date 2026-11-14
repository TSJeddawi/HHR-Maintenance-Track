// Layout of the Route Overview drawing. Everything here is derived from the TSR records read from the workbook
// and from the stations in data/route.js. The trains are a decorative animation and carry no data.

export const ROUTE_SVG = {
  height: 140, // fits the route section
  x0: 34,
  rightPad: 26,
  signRows: [13, 33], // two staggered rows for signs that would otherwise overlap
  signR: 9,
  laneH: 11,
  laneY: [49, 63],
  axisY: 98,
}

// Visual aid only: restriction speeds are tinted so they can be told apart at a glance.
// These colours are not an official safety classification.
export const SPEED_COLORS = [
  { limit: 80, color: '#c4483c' },
  { limit: 120, color: '#e0852f' },
  { limit: 170, color: '#d6a51c' },
  { limit: 230, color: '#3b76b8' },
]

export function speedColor(limit) {
  if (limit == null) return '#8a97a6'
  return SPEED_COLORS.reduce((best, c) => (Math.abs(c.limit - limit) < Math.abs(best.limit - limit) ? c : best)).color
}

export const TRAINS = [
  { lane: 0, dir: 1, offset: 0 },
  { lane: 0, dir: 1, offset: 0.5 },
  { lane: 1, dir: -1, offset: 0.25 },
  { lane: 1, dir: -1, offset: 0.75 },
]

// Reads KP range, tracks and speed limit from a TSR record (already parsed from the workbook).
export function describeTsr(tsr, mapKp) {
  const range = String(tsr.kpLabel ?? '').match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
  const first = range ? Number(range[1]) : Number(mapKp) || 0
  const second = range ? Number(range[2]) : first
  const digits = String(tsr.track ?? '').match(/\d/g) ?? []
  let tracks = [1, 2]
  if (digits.includes('1') && !digits.includes('2')) tracks = [1]
  else if (digits.includes('2') && !digits.includes('1')) tracks = [2]
  const limit = Number(String(tsr.restriction ?? '').match(/\d+(?:\.\d+)?/)?.[0])
  return {
    a: Math.min(first, second),
    b: Math.max(first, second),
    tracks,
    limit: Number.isFinite(limit) ? limit : null,
  }
}

// Signs normally sit directly above their segment. Signs that would collide are staggered over two rows and
// spread sideways; a thin connector line joins each one to the exact centre of its KP range.
export function placeSigns(entries, g, width) {
  const R = g.signR
  const GAP = 3
  const rowY = g.signRows
  const dy = rowY[1] - rowY[0]
  const need = (sameRow) => (sameRow ? 2 * R + GAP : Math.sqrt(Math.max(0, (2 * R + GAP) ** 2 - dy * dy)))

  const clusters = []
  entries.forEach((e) => {
    const last = clusters[clusters.length - 1]
    if (last && e.cx - last[last.length - 1].cx < 4 * R) last.push(e)
    else clusters.push([e])
  })

  const ccw = (p, q, r) => (r.y - p.y) * (q.x - p.x) > (q.y - p.y) * (r.x - p.x)
  const crosses = (a, b) => ccw(a.from, b.from, b.to) !== ccw(a.to, b.from, b.to) && ccw(a.from, a.to, b.from) !== ccw(a.from, a.to, b.to)
  const near = (p, seg) => {
    const dx = seg.to.x - seg.from.x
    const dyy = seg.to.y - seg.from.y
    const t = Math.max(0, Math.min(1, ((p.x - seg.from.x) * dx + (p.y - seg.from.y) * dyy) / (dx * dx + dyy * dyy || 1)))
    return Math.hypot(p.x - (seg.from.x + t * dx), p.y - (seg.from.y + t * dyy))
  }

  const placed = []
  clusters.forEach((cluster) => {
    const n = cluster.length
    let best = null
    const masks = n <= 8 ? 1 << n : 1
    for (let mask = 0; mask < masks; mask += 1) {
      const rows = cluster.map((_, i) => (mask >> i) & 1)
      const sx = []
      cluster.forEach((e, i) => {
        let v = e.cx
        for (let k = 0; k < i; k += 1) v = Math.max(v, sx[k] + need(rows[k] === rows[i]))
        sx.push(v)
      })
      const shift = sx.reduce((sum, v, i) => sum + v - cluster[i].cx, 0) / n
      const lowest = Math.min(...sx) - shift
      const lowerBound = Math.max(R + 2, (placed.length ? placed[placed.length - 1].sx + 2 * R + GAP : 0))
      const move = lowest < lowerBound ? lowerBound - lowest : 0
      const xs = sx.map((v) => Math.min(v - shift + move, width - R - 2))
      const segs = cluster.map((e, i) => ({ from: { x: xs[i], y: rowY[rows[i]] + R }, to: { x: e.cx, y: e.laneTop - 1.5 } }))
      let cost = xs.reduce((sum, v, i) => sum + Math.abs(v - cluster[i].cx), 0) + rows.reduce((a, r) => a + r, 0) * 2
      cluster.forEach((_, i) => {
        cluster.forEach((__, k) => {
          if (i === k) return
          if (near({ x: xs[k], y: rowY[rows[k]] }, segs[i]) < R + 1.5) cost += 1000
          if (k > i && crosses(segs[i], segs[k])) cost += 1000
        })
      })
      if (!best || cost < best.cost) best = { cost, rows, xs }
    }
    cluster.forEach((e, i) => placed.push({ ...e, sx: best.xs[i], sy: rowY[best.rows[i]], row: best.rows[i] }))
  })
  return placed
}

export function layoutRoute({ items, stations, maxKp, width }) {
  const g = ROUTE_SVG
  const kpMax = Math.max(maxKp, ...items.map((item) => item.b))
  const span = Math.max(0, width - g.x0 - g.rightPad)
  const x = (kp) => g.x0 + (Math.min(Math.max(kp, 0), kpMax) / kpMax) * span

  const spans = items.flatMap((item) =>
    item.tracks.map((track) => {
      const left = x(item.a)
      return { id: `${item.id}-${track}`, j: item.j, track, x: left, w: Math.max(x(item.b) - left, 6) }
    }),
  )

  const signs = placeSigns(
    [...items]
      .sort((p, q) => p.a + p.b - (q.a + q.b))
      .map((item) => {
        const left = x(item.a)
        return {
          id: item.id,
          j: item.j,
          limit: item.limit,
          cx: left + Math.max(x(item.b) - left, 6) / 2,
          laneTop: g.laneY[item.tracks[0] - 1],
        }
      }),
    g,
    width,
  )

  return { ...g, kpMax, span, spans, signs, stations: stations.map((s) => ({ ...s, x: x(s.kp) })) }
}

// Position of a decorative train along the line for a given animation time.
export function trainX(timeMs, train, layout) {
  const f = (timeMs / 24000 + train.offset) % 1
  const x = layout.x0 + f * layout.span
  return train.dir > 0 ? x : 2 * layout.x0 + layout.span - x
}

export const TRAIN_LENGTH = 46
export const GLOW_RANGE = 70 // pixels before and after a TSR over which its highlight fades in and out (about 1.7 s of train travel)

// How strongly each TSR lights up (0..1) for the current animation time. The glow follows the decorative train:
// it rises as a train on the same track approaches the TSR, is full while the train covers it, and fades as it leaves.
export function lightLevels(timeMs, layout) {
  const bySpan = {}
  const byTsr = {}
  layout.spans.forEach((s) => {
    bySpan[s.id] = 0
  })
  TRAINS.forEach((train) => {
    const x = trainX(timeMs, train, layout)
    const left = train.dir > 0 ? x - TRAIN_LENGTH : x
    const right = left + TRAIN_LENGTH
    layout.spans.forEach((s) => {
      if (s.track !== train.lane + 1) return
      const dist = Math.max(0, s.x - right, left - (s.x + s.w))
      const t = Math.max(0, 1 - dist / GLOW_RANGE)
      const level = t * t * (3 - 2 * t)
      bySpan[s.id] = Math.max(bySpan[s.id], level)
      byTsr[s.j] = Math.max(byTsr[s.j] ?? 0, level)
    })
  })
  return { bySpan, byTsr }
}

// Where the selected TSR sits on the drawing: its spans, a KP bracket under the axis and the sign.
export function selectionGeometry(layout, j) {
  const spans = layout.spans.filter((s) => s.j === j)
  const sign = layout.signs.find((s) => s.j === j)
  if (!spans.length || !sign) return null
  const x1 = Math.min(...spans.map((s) => s.x))
  const x2 = Math.max(...spans.map((s) => s.x + s.w))
  return { spans, sign, x1, x2, tracks: spans.map((s) => s.track) }
}

// Text of the "selected TSR" tag, cut to the width available between KAEC and Madinah.
export function selectionTag(tsr, maxChars) {
  const parts = [tsr.kpLabel, tsr.track, tsr.restriction, tsr.reason].map((p) => String(p ?? '').trim()).filter(Boolean)
  const text = parts.join(' · ')
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text
}

// Linear blend between two #rrggbb colours (used for the glow).
export function mixColor(from, to, t) {
  const f = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const a = f(from)
  const b = f(to)
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`
}

export function tsrLocationText(tsr) {
  const location = String(tsr?.location ?? '').trim()
  const kpLabel = String(tsr?.kpLabel ?? '').trim()
  if (location && /\bkp\b/i.test(location)) return location
  if (location && kpLabel) return `${location} ${kpLabel}`
  return location || kpLabel || '—'
}

export function tsrMapKp(tsr) {
  const text = tsrLocationText(tsr)
  const afterKp = text.match(/\bKP\s*([0-9]+(?:\.[0-9]+)?)/i)
  if (afterKp) return Number(afterKp[1])
  const fallback = Number(tsr?.kp)
  return Number.isFinite(fallback) ? fallback : 0
}

// Combined KP length of the restricted sections on one track; overlapping or touching ranges are merged so nothing is counted twice.
export function restrictedLength(items, track) {
  const ranges = items
    .filter((item) => item.tracks.includes(track))
    .map((item) => [item.a, item.b])
    .sort((p, q) => p[0] - q[0])
  let total = 0
  let current = null
  for (const [a, b] of ranges) {
    if (!current || a > current[1]) {
      if (current) total += current[1] - current[0]
      current = [a, b]
    } else {
      current[1] = Math.max(current[1], b)
    }
  }
  if (current) total += current[1] - current[0]
  return total
}

// Selecting the TSR that is already selected deselects it; another TSR switches the selection.
export function toggleSelection(current, id) {
  return current === id ? null : id
}
