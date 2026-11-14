import Panel from './Panel'

const R = 62
const CX = 80
const CY = 80
const ARC = `M${CX - R} ${CY}A${R} ${R} 0 0 1 ${CX + R} ${CY}`
const TICKS = [0, 25, 50, 75, 100].map((percent) => {
  const phi = (Math.PI * percent) / 100
  const c = Math.cos(phi)
  const s = Math.sin(phi)
  return { percent, x1: CX - (R + 6) * c, y1: CY - (R + 6) * s, x2: CX - (R + 10) * c, y2: CY - (R + 10) * s }
})

function IndexTile({ title, value }) {
  return (
    <div className="kpi2__index" tabIndex={0} title={`${title}: ${value}`}>
      <p className="kpi2__label">{title}</p>
      <p className="kpi2__number">{value}</p>
      <span className="kpi2__rule" aria-hidden="true" />
    </div>
  )
}

// 0–100 dial: the scale is the real 0–100 range of a percentage, not an invented target.
function Dial({ title, percent }) {
  const has = percent != null && percent !== '—' && Number.isFinite(Number(percent))
  const value = has ? Math.min(100, Math.max(0, Number(percent))) : 0
  const label = has ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : '—'

  return (
    <div className="kpi2__dial" tabIndex={0} title={`${title}: ${has ? `${label}%` : 'No data loaded'}`}>
      <svg viewBox="0 0 160 94" role="img" aria-label={has ? `${title} ${label} percent` : 'No data loaded'}>
        <path className="kpi2__track" d={ARC} pathLength="100" />
        {TICKS.map((tick) => (
          <line key={tick.percent} className="kpi2__tick" x1={tick.x1} y1={tick.y1} x2={tick.x2} y2={tick.y2} />
        ))}
        {has ? (
          <>
            <path className="kpi2__arc" d={ARC} pathLength="100" style={{ '--p': value }} />
            <g className="kpi2__dot" style={{ '--a': `${value * 1.8}deg` }}>
              <circle cx={CX - R} cy={CY} r="5" />
            </g>
          </>
        ) : null}
        <text className="kpi2__value" x={CX} y="74" textAnchor="middle">{has ? `${label}%` : '—'}</text>
        <text className="kpi2__end" x={CX - R} y="93" textAnchor="middle">0</text>
        <text className="kpi2__end" x={CX + R} y="93" textAnchor="middle">100</text>
      </svg>
      <p className="kpi2__label">{title}</p>
    </div>
  )
}

export default function BottomKpiPanel({ items }) {
  const byId = Object.fromEntries(items.map((item) => [item.id, item]))

  return (
    <Panel title="Key Performance Indicators" className="panel--bottom panel--kpi-board">
      <div className="kpi2">
        <div className="kpi2__indices">
          <IndexTile title="KPI-IM1" value={byId['kpi-im1']?.value ?? '—'} />
          <IndexTile title="KPI-ISR" value={byId['kpi-isr']?.value ?? '—'} />
        </div>
        <div className="kpi2__dials">
          <Dial title="Maintenance Compliance" percent={byId.compliance?.value} />
          <Dial title="Grinding Progress" percent={byId.grinding?.value} />
          <Dial title="Spare Part Availability" percent={byId.spares?.value} />
          <Dial title="Machine Availability" percent={byId.machines?.value} />
        </div>
      </div>
    </Panel>
  )
}
