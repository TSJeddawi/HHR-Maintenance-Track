import Panel from './Panel'

const EMPTY = '—'

function formatMetric(value, digits) {
  if (value == null) return EMPTY
  const n = Number(value)
  if (!Number.isFinite(n)) return EMPTY
  const rounded = Number(n.toFixed(digits))
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits)
}

// One value against its limit, drawn on a labelled numeric scale (the scale maximum only sets the drawing width).
function Bullet({ title, value, unit, limit, max, foot }) {
  const n = Number(value)
  const has = value != null && Number.isFinite(n)
  const tone = !has ? 'default' : n < limit ? 'positive' : 'warning'
  const label = has ? formatMetric(value, unit === '%' ? 1 : 0) : EMPTY
  const suffix = unit || ''

  return (
    <div className={`x-bul x-bul--${tone}`}>
      <div className="x-bul__top">
        <span>{title}</span>
        <b>
          {label}
          {has && unit ? <em>{unit}</em> : null}
        </b>
      </div>
      <div
        className="x-bul__bar"
        title={`${title}: ${has ? `${label}${suffix}` : 'No data loaded'} · limit < ${limit}${suffix}`}
      >
        {has ? <i style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /> : null}
        <u style={{ left: `${(limit / max) * 100}%` }} />
      </div>
      <div className="x-bul__scale">
        <span style={{ left: 0 }}>0</span>
        <span style={{ left: `${(limit / max) * 100}%` }}>{limit}{suffix}</span>
        <span style={{ left: '100%' }}>{max}{suffix}</span>
      </div>
      <div className="x-bul__foot">{foot} · Target &lt; {limit}{suffix}</div>
    </div>
  )
}

export default function RailQualityPanel({ yearlyBrokenRail, llp }) {
  return (
    <Panel
      title="Rail Quality"
      subtitle="Yearly broken rail and LLP limits"
      className="panel--rail-quality"
    >
      <div className="x-rail">
        <Bullet title="LLP" value={llp} unit="%" limit={25} max={50} foot="Over 2LL0" />
        <Bullet title="Yearly Broken Rail" value={yearlyBrokenRail} unit="" limit={6} max={12} foot="Per year" />
      </div>
    </Panel>
  )
}
