import { speedColor } from '../utils/routeGeometry'

const COLUMNS = [
  'Route / Section',
  'KP From',
  'KP To',
  'Speed Restriction (km/h)',
  'Track (TRK1 / TRK2)',
  'Reason',
]

function formatKp(value) {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 1000) / 1000)
}

function formatTrack(track) {
  const raw = String(track ?? '').trim()
  if (!raw) return '—'
  const compact = raw.replace(/\s+/g, '')
  const trackLike = /trk|track/i.test(raw) || /^(?:[12]|[12]\s*[/,&+]\s*[12])$/i.test(raw)
  if (!trackLike) return raw
  const has1 = /(?:^|[^0-9])1(?:[^0-9]|$)/.test(compact)
  const has2 = /(?:^|[^0-9])2(?:[^0-9]|$)/.test(compact)
  if (has1 && has2) return 'TRK1 / TRK2'
  if (has1) return 'TRK1'
  if (has2) return 'TRK2'
  return raw
}

function formatSpeed(item) {
  if (item.limit != null) return String(item.limit)
  const raw = String(item.tsr.restriction ?? '').trim()
  return raw || '—'
}

function cellText(value) {
  const text = String(value ?? '').trim()
  return text || '—'
}

// Active TSRs as a selectable table. A row highlights its marker; a marker filters this list.
export default function TsrTable({ items, selectedId, hotId, filtered, onToggle, onHover }) {
  return (
    <div
      className="tsr-table data-table"
      role="table"
      aria-label={
        filtered
          ? 'Active temporary speed restrictions, filtered to the selected TSR'
          : 'Active temporary speed restrictions'
      }
    >
      <div className="data-table__head" role="row">
        {COLUMNS.map((column) => (
          <span key={column} role="columnheader" title={column}>
            {column}
          </span>
        ))}
      </div>
      <div className="data-table__body" role="rowgroup">
        {items.length === 0 ? (
          <p className="data-table__empty">No data loaded</p>
        ) : (
          items.map((item) => {
            const { tsr } = item
            const selected = item.id === selectedId
            const section = cellText(tsr.location)
            const kpFrom = formatKp(item.a)
            const kpTo = formatKp(item.b)
            const speed = formatSpeed(item)
            const track = formatTrack(tsr.track)
            const reason = cellText(tsr.reason)
            return (
              <div
                key={item.id}
                className={[
                  'data-table__row',
                  'data-table__row--clickable',
                  selected ? 'data-table__row--selected' : '',
                  hotId === item.id ? 'is-hot' : '',
                ].filter(Boolean).join(' ')}
                role="row"
                aria-selected={selected}
                tabIndex={0}
                onClick={() => onToggle(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onToggle(item.id)
                  }
                }}
                onMouseEnter={() => onHover(item.id)}
                onMouseLeave={() => onHover(null)}
              >
                <span role="cell" title={section}>{section}</span>
                <span role="cell" title={kpFrom}>{kpFrom}</span>
                <span role="cell" title={kpTo}>{kpTo}</span>
                <span role="cell" className="tsr-table__speed" title={`${speed} km/h`}>
                  <i style={{ background: speedColor(item.limit) }} />
                  {speed}
                </span>
                <span role="cell" title={track}>{track}</span>
                <span role="cell" title={reason}>{reason}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
