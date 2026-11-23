import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play } from 'lucide-react'
import Panel from './Panel'
import TsrTable from './TsrTable'
import { placeTooltip } from '../utils/tooltipPlacement'
import {
  ROUTE_SVG,
  SPEED_COLORS,
  TRAINS,
  describeTsr,
  chooseMarker,
  layoutRoute,
  lightLevels,
  mixColor,
  restrictedLength,
  selectionGeometry,
  selectionTag,
  speedColor,
  toggleSelection,
  trainX,
  tsrLocationText,
  tsrMapKp,
} from '../utils/routeGeometry'

const MAIN_STATIONS = ['makkah', 'jeddah', 'kaec', 'madinah']
const LANE_COLORS = ['#0d9488', '#1e3a5f']
const AMBER = '#b45309'
const NAVY = '#0b1f3a'

// Route drawing: TSR segments, signs and stations come from the workbook; the trains are a decorative animation.
// Colours show restriction speed and are a visual aid only, not a safety classification.
export default function RouteOverview({ stations, tsrs = [], maxKp }) {
  const canvasRef = useRef(null)
  const svgRef = useRef(null)
  const [width, setWidth] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [filterId, setFilterId] = useState(null)
  const [hotId, setHotId] = useState(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const clockRef = useRef(0)
  const selJRef = useRef(null)
  const [kpHit, setKpHit] = useState(null)

  const activeTsrs = useMemo(
    () =>
      tsrs.map((tsr) => ({
        ...tsr,
        status: 'Active',
        locationText: tsrLocationText(tsr),
        mapKp: tsrMapKp(tsr),
      })),
    [tsrs],
  )
  const items = useMemo(
    () => activeTsrs.map((tsr, j) => ({ id: tsr.id, j, tsr, ...describeTsr(tsr, tsr.mapKp) })),
    [activeTsrs],
  )
  const routeStations = useMemo(
    () => stations.filter((station) => MAIN_STATIONS.includes(station.id)),
    [stations],
  )
  const layout = useMemo(
    () => (width > 0 ? layoutRoute({ items, stations: routeStations, maxKp, width }) : null),
    [items, routeStations, maxKp, width],
  )

  useLayoutEffect(() => {
    const el = canvasRef.current
    if (!el) return undefined
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const selectedItem = items.find((item) => item.id === selectedId) ?? null
  const selection = selectedItem && layout ? selectionGeometry(layout, selectedItem.j) : null
  const filtered = Boolean(filterId) && items.some((item) => item.id === filterId)
  const visibleItems = filtered ? items.filter((item) => item.id === filterId) : items
  useEffect(() => {
    selJRef.current = selectedItem ? selectedItem.j : null
  })

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        setSelectedId(null)
        setFilterId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Decorative train animation and the glow it casts on the restrictions it passes.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !layout) return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const trainEls = [...svg.querySelectorAll('[data-train]')]
    const spanEls = {}
    const haloEls = {}
    svg.querySelectorAll('[data-span]').forEach((n) => { spanEls[n.dataset.span] = n })
    svg.querySelectorAll('[data-halo]').forEach((n) => { haloEls[n.dataset.halo] = n })
    const signEls = {}
    svg.querySelectorAll('[data-sign]').forEach((n) => {
      signEls[n.dataset.sign] = { main: n.querySelector('[data-main]'), halo: n.querySelector('[data-shalo]') }
    })
    const colors = items.map((item) => speedColor(item.limit))

    let last = null
    let frame = 0
    function tick(time) {
      if (last == null) last = time
      if (!pausedRef.current) clockRef.current += time - last
      last = time
      const t = reduce ? 0 : clockRef.current
      TRAINS.forEach((train, i) => {
        const el = trainEls[i]
        if (el) {
          el.setAttribute(
            'transform',
            `translate(${trainX(t, train, layout)},${layout.laneY[train.lane] + layout.laneH / 2}) scale(${train.dir},1)`,
          )
        }
      })
      const levels = reduce ? { bySpan: {}, byTsr: {} } : lightLevels(t, layout)
      layout.spans.forEach((span) => {
        const level = levels.bySpan[span.id] ?? 0
        spanEls[span.id]?.setAttribute('fill-opacity', (0.6 + 0.4 * level).toFixed(3))
        haloEls[span.id]?.setAttribute('opacity', (0.5 * level).toFixed(3))
      })
      layout.signs.forEach((sign) => {
        const els = signEls[sign.j]
        if (!els) return
        const level = levels.byTsr[sign.j] ?? 0
        els.main.setAttribute('stroke-width', ((selJRef.current === sign.j ? 2.5 : 2) + 0.9 * level).toFixed(2))
        els.main.setAttribute('fill', mixColor('#ffffff', colors[sign.j], 0.16 * level))
        els.halo.setAttribute('opacity', (0.45 * level).toFixed(3))
      })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [layout, items])

  function pointFromEvent(event) {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    const box = svg.viewBox.baseVal
    return {
      x: ((event.clientX - rect.left) / rect.width) * box.width,
      y: ((event.clientY - rect.top) / rect.height) * box.height,
    }
  }

  function idsAtPoint(point) {
    if (!layout) return []
    const signIds = []
    layout.signs.forEach((sign) => {
      const dx = point.x - sign.sx
      const dy = point.y - sign.sy
      if (dx * dx + dy * dy <= layout.signR * layout.signR) signIds.push(items[sign.j].id)
    })
    if (signIds.length) return signIds
    const spanIds = []
    layout.spans.forEach((span) => {
      const top = layout.laneY[span.track - 1] - 1.5
      const bottom = top + layout.laneH + 3
      if (point.x >= span.x && point.x <= span.x + span.w && point.y >= top && point.y <= bottom) {
        spanIds.push(items[span.j].id)
      }
    })
    return spanIds
  }

  function onMarkerClick(event, id) {
    event.stopPropagation()
    const point = pointFromEvent(event)
    const next = chooseMarker(filterId, point ? idsAtPoint(point) : [], id)
    setFilterId(next)
    setSelectedId(next)
  }

  function onRowToggle(id) {
    const next = toggleSelection(selectedId, id)
    setSelectedId(next)
    if (next == null) setFilterId(null)
  }

  function togglePause() {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }

  // KP read-out: the pointer position along TRK1 / TRK2 is converted to a KP with the scale the drawing uses.
  function onSvgMove(event) {
    const svg = svgRef.current
    if (!svg || !layout) return
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return
    const k = svg.viewBox.baseVal.width / rect.width
    const x = (event.clientX - rect.left) * k
    const y = (event.clientY - rect.top) * k
    const lane = layout.laneY.findIndex((ly) => y >= ly - 2 && y <= ly + layout.laneH + 2)
    if (x < layout.x0 || x > layout.x0 + layout.span || lane < 0) {
      setKpHit(null)
      return
    }
    const kp = Math.min(layout.kpMax, Math.max(0, ((x - layout.x0) / layout.span) * layout.kpMax))
    setKpHit({ track: lane + 1, kp, x, pointerX: event.clientX, pointerY: event.clientY })
  }

  const kpTipRef = useRef(null)
  useLayoutEffect(() => {
    const node = kpTipRef.current
    if (!kpHit || !node) return
    const { width: w, height: h } = node.getBoundingClientRect()
    const viewport = document.documentElement
    const spot = placeTooltip(
      { x: kpHit.pointerX, y: kpHit.pointerY },
      { width: w, height: h },
      { width: viewport.clientWidth, height: viewport.clientHeight },
    )
    node.style.left = `${spot.left}px`
    node.style.top = `${spot.top}px`
    node.style.visibility = 'visible'
  }, [kpHit])

  const tipText = (item) => `${item.tsr.restriction} – ${item.tsr.reason}\n${item.tsr.locationText} · ${item.tsr.track}`
  const g = ROUTE_SVG

  const actions = activeTsrs.length ? (
    <>
      <span className="x-chip">
        <b>{activeTsrs.length}</b> active TSR{activeTsrs.length === 1 ? '' : 's'}
      </span>
      <span className="x-chip" title="Combined KP length of restricted sections on TRK1, overlaps merged (derived from the TSR table)">
        <i style={{ background: LANE_COLORS[0] }} />
        TRK1 <b>{+restrictedLength(items, 1).toFixed(1)}</b> km
      </span>
      <span className="x-chip" title="Combined KP length of restricted sections on TRK2, overlaps merged (derived from the TSR table)">
        <i style={{ background: LANE_COLORS[1] }} />
        TRK2 <b>{+restrictedLength(items, 2).toFixed(1)}</b> km
      </span>
      <button
        type="button"
        className="x-btn"
        aria-pressed={paused}
        onClick={togglePause}
        title="Pause or resume the decorative trains (illustrative, not live data)"
      >
        {paused ? <Play size={11} strokeWidth={2.4} /> : <Pause size={11} strokeWidth={2.4} />}
        <span>{paused ? 'Resume trains' : 'Pause trains'}</span>
      </button>
    </>
  ) : (
    <button type="button" className="x-btn" aria-pressed={paused} onClick={togglePause}>
      {paused ? <Play size={11} strokeWidth={2.4} /> : <Pause size={11} strokeWidth={2.4} />}
      <span>{paused ? 'Resume trains' : 'Pause trains'}</span>
    </button>
  )

  let keyOption = null
  if (layout) {
    const lastSign = layout.signs.length ? Math.max(...layout.signs.map((s) => s.sx + g.signR)) : -1e9
    keyOption = [
      { w: 178, label: 'km/h · visual key' },
      { w: 116, label: 'km/h' },
    ].find((o) => width - 8 - o.w > lastSign + 10)
  }
  const kaec = layout?.stations.find((s) => s.id === 'kaec')
  const madinah = layout?.stations.find((s) => s.id === 'madinah')

  return (
    <Panel
      title="Route Overview & TSR"
      subtitle="Makkah KP 0 to Madinah KP 449"
      className="panel--route"
      actions={actions}
    >
      <div className="x-r-canvas" ref={canvasRef}>
        {layout ? (
          <svg
            ref={svgRef}
            className="route__svg"
            width={width}
            height={g.height}
            viewBox={`0 0 ${width} ${g.height}`}
            role="img"
            aria-label="Route overview with active temporary speed restrictions. Colours show restriction speed and are a visual aid only."
            onMouseMove={onSvgMove}
            onMouseLeave={() => {
              setKpHit(null)
              setHotId(null)
            }}
          >
            <defs>
              <pattern id="route-sleepers" width="7" height="13" patternUnits="userSpaceOnUse">
                <rect x="3" y="1" width="1.4" height="11" rx=".5" fill="#b9c7d3" />
              </pattern>
              <filter id="route-soft" x="-40%" y="-150%" width="180%" height="400%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>

            {g.laneY.map((y, i) => {
              const on = selection && selection.tracks.includes(i + 1)
              return (
                <g key={y}>
                  <text x="0" y={y + g.laneH - 2.5} fontSize="11" fontWeight={on ? 800 : 700} fill={LANE_COLORS[i]}>
                    TRK{i + 1}
                  </text>
                  <rect x={layout.x0} y={y} width={layout.span} height={g.laneH} rx="3" fill="#edf2f6" stroke={on ? LANE_COLORS[i] : '#d5dee8'} strokeWidth={on ? 1.6 : 1} />
                  <rect x={layout.x0} y={y} width={layout.span} height={g.laneH} rx="3" fill="url(#route-sleepers)" pointerEvents="none" />
                  <line x1={layout.x0} x2={layout.x0 + layout.span} y1={y + 3.2} y2={y + 3.2} stroke="#aebdca" strokeWidth="1" pointerEvents="none" />
                  <line x1={layout.x0} x2={layout.x0 + layout.span} y1={y + g.laneH - 3.2} y2={y + g.laneH - 3.2} stroke="#aebdca" strokeWidth="1" pointerEvents="none" />
                </g>
              )
            })}

            {layout.spans.map((s) => (
              <rect key={`h-${s.id}`} data-halo={s.id} x={s.x - 1} y={g.laneY[s.track - 1] - 2} width={s.w + 2} height={g.laneH + 4} rx="3" fill={speedColor(items[s.j].limit)} opacity="0" filter="url(#route-soft)" pointerEvents="none" />
            ))}

            {layout.spans.map((s) => {
              const on = selection?.spans.some((p) => p.id === s.id)
              return (
                <rect
                  key={s.id}
                  data-span={s.id}
                  className="route__hit"
                  x={s.x}
                  y={g.laneY[s.track - 1] - 1.5}
                  width={s.w}
                  height={g.laneH + 3}
                  rx="2"
                  fill={speedColor(items[s.j].limit)}
                  fillOpacity=".6"
                  stroke={on ? NAVY : 'none'}
                  strokeWidth="1.6"
                  onClick={(event) => onMarkerClick(event, items[s.j].id)}
                  onMouseEnter={() => setHotId(items[s.j].id)}
                  onMouseLeave={() => setHotId(null)}
                >
                  <title>{tipText(items[s.j])}</title>
                </rect>
              )
            })}

            {selection ? (
              <g pointerEvents="none">
                <line
                  x1={(selection.x1 + selection.x2) / 2}
                  x2={(selection.x1 + selection.x2) / 2}
                  y1={g.laneY[Math.max(...selection.tracks) - 1] + g.laneH + 1.5}
                  y2={g.axisY + 6}
                  stroke={NAVY}
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <path d={`M${selection.x1} ${g.axisY + 6}V${g.axisY + 9}H${selection.x2}V${g.axisY + 6}`} fill="none" stroke={NAVY} strokeWidth="1.6" />
              </g>
            ) : null}

            <g pointerEvents="none">
              {layout.signs.map((s) => {
                const on = selectedItem && selectedItem.j === s.j
                return (
                  <line key={`l-${s.id}`} x1={s.sx} y1={s.sy + g.signR} x2={s.cx} y2={s.laneTop - 1.5} stroke={on ? NAVY : speedColor(s.limit)} strokeWidth={on ? 1.2 : 0.9} strokeOpacity={on ? 1 : 0.8} />
                )
              })}
            </g>

            {layout.signs.map((s) => {
              const on = selectedItem && selectedItem.j === s.j
              const c = speedColor(s.limit)
              return (
                <g
                  key={`s-${s.id}`}
                  data-sign={s.j}
                  data-hot={hotId === items[s.j].id ? '' : undefined}
                  className="route__hit"
                  onClick={(event) => onMarkerClick(event, items[s.j].id)}
                  onMouseEnter={() => setHotId(items[s.j].id)}
                  onMouseLeave={() => setHotId(null)}
                >
                  <title>{tipText(items[s.j])}</title>
                  <circle data-shalo cx={s.sx} cy={s.sy} r={g.signR + 2.5} fill={c} opacity="0" filter="url(#route-soft)" pointerEvents="none" />
                  {on ? <circle cx={s.sx} cy={s.sy} r={g.signR + 2.5} fill="none" stroke={NAVY} strokeOpacity=".45" strokeWidth="1.5" /> : null}
                  <circle data-main cx={s.sx} cy={s.sy} r={g.signR} fill="#fff" stroke={on ? NAVY : c} strokeWidth={on ? 2.5 : 2} />
                  <text x={s.sx} y={s.sy + 3.2} fontSize={s.limit >= 100 ? 8 : 9.5} fontWeight="800" textAnchor="middle" fill={NAVY} pointerEvents="none">
                    {s.limit ?? '–'}
                  </text>
                </g>
              )
            })}

            <line x1={layout.x0} x2={layout.x0 + layout.span} y1={g.axisY} y2={g.axisY} stroke="#c3cfdb" />
            {Array.from({ length: Math.floor(layout.kpMax / 10) + 1 }, (_, n) => n * 10).map((kp) => {
              const x = layout.x0 + (kp / layout.kpMax) * layout.span
              const major = kp % 50 === 0
              return (
                <g key={kp}>
                  <line x1={x} x2={x} y1={g.axisY - (major ? 7 : 4)} y2={g.axisY} stroke={major ? '#8fa3b6' : '#c3cfdb'} strokeWidth="1" />
                  {major ? (
                    <text x={x} y={g.axisY - 11} fontSize="9.5" fill="#6b7f93" textAnchor="middle" fontWeight="600">
                      {kp}
                    </text>
                  ) : null}
                </g>
              )
            })}
            <text x={layout.x0 + layout.span + 4} y={g.axisY - 11} fontSize="9.5" fill="#6b7f93" fontWeight="600">KP</text>

            {layout.stations.map((s) => (
              <g key={s.id}>
                <path d={`M${s.x} ${g.axisY - 4}l4 4-4 4-4-4z`} fill={NAVY} />
                <text x={s.x} y={g.axisY + 15} fontSize="11" fontWeight="700" textAnchor="middle" fill={NAVY}>{s.name}</text>
                <text x={s.x} y={g.axisY + 26} fontSize="9.5" textAnchor="middle" fill="#4a5d73">KP {s.kp}</text>
              </g>
            ))}

            {(() => {
              if (!selectedItem || !kaec || !madinah) return null
              const from = kaec.x + 56
              const to = madinah.x - 48
              const room = Math.max(0, to - from)
              const maxChars = Math.floor((room - 80) / 5.3)
              if (maxChars <= 12) return null
              const text = selectionTag(selectedItem.tsr, maxChars)
              const w = Math.min(room, 80 + text.length * 5.3)
              const x = (from + to) / 2 - w / 2
              const y = g.axisY + 12
              return (
                <g pointerEvents="none">
                  <rect x={x} y={y} width={w} height="20" rx="10" fill="#fff" stroke={NAVY} strokeWidth="1.2" />
                  <text x={x + 10} y={y + 13.5} fontSize="9.5" fontWeight="800" fill={AMBER}>Selected TSR</text>
                  <text x={x + 80} y={y + 13.5} fontSize="9.5" fontWeight="600" fill={NAVY}>{text}</text>
                </g>
              )
            })()}

            {keyOption ? (
              <g pointerEvents="none" fontSize="8" fill="#4a5d73">
                <title>Colours show restriction speed and are a visual aid only, not a safety classification.</title>
                {SPEED_COLORS.map((c, i) => {
                  const kx = width - 8 - keyOption.w
                  return (
                    <g key={c.limit}>
                      <circle cx={kx + 4 + i * 26} cy={g.signRows[0]} r="3.4" fill={c.color} />
                      <text x={kx + 10 + i * 26} y={g.signRows[0] + 3}>{c.limit}</text>
                    </g>
                  )
                })}
                <text x={width - 8 - keyOption.w + 108} y={g.signRows[0] + 3}>{keyOption.label}</text>
              </g>
            ) : null}

            <line
              x1={kpHit ? kpHit.x : 0}
              x2={kpHit ? kpHit.x : 0}
              y1={g.laneY[0] - 3}
              y2={g.laneY[1] + g.laneH + 3}
              stroke={NAVY}
              strokeOpacity=".55"
              strokeWidth="1"
              pointerEvents="none"
              visibility={kpHit ? 'visible' : 'hidden'}
            />

            {TRAINS.map((train, i) => (
              <g key={i} data-train={i} aria-hidden="true" pointerEvents="none" transform={`translate(${trainX(0, train, layout)},${layout.laneY[train.lane] + layout.laneH / 2}) scale(${train.dir},1)`}>
                <path d="M-46 -5.5H-9C-4 -5.5 -1 -3 1 0C-1 3 -4 5.5 -9 5.5H-46Z" fill={LANE_COLORS[train.lane]} />
                <rect x="-42" y="-2.6" width="5" height="3.4" rx="1" fill="#fff" opacity=".92" />
                <rect x="-33" y="-2.6" width="5" height="3.4" rx="1" fill="#fff" opacity=".92" />
                <rect x="-24" y="-2.6" width="5" height="3.4" rx="1" fill="#fff" opacity=".92" />
                <path d="M-13 -2.8H-7C-5 -2.8 -3.6 -1.6 -2.6 0C-3.6 1.6 -5 2.8 -7 2.8H-13Z" fill="#fff" opacity=".92" />
                <rect x="-46" y="2.4" width="37" height="1.2" fill="#fff" opacity=".35" />
              </g>
            ))}
          </svg>
        ) : null}
      </div>

      <TsrTable
        items={visibleItems}
        selectedId={selectedId}
        hotId={hotId}
        filtered={filtered}
        onToggle={onRowToggle}
        onHover={setHotId}
      />

      {kpHit && typeof document !== 'undefined'
        ? createPortal(
            <div ref={kpTipRef} className="class-tooltip kp-tooltip" role="tooltip" style={{ visibility: 'hidden' }}>
              {`TRK${kpHit.track} | KP ${kpHit.kp.toFixed(1)}`}
            </div>,
            document.body,
          )
        : null}
    </Panel>
  )
}
