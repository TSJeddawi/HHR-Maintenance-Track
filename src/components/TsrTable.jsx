import { speedColor } from '../utils/routeGeometry'

// Active TSRs as selectable cards. Selecting a card highlights its marker on the route drawing, and vice versa.
export default function TsrTable({ items, selectedId, hotId, onToggle, onHover }) {
  return (
    <div
      className="x-cards"
      role="table"
      style={{ gridTemplateColumns: `repeat(${items.length > 6 ? 4 : 3}, minmax(0, 1fr))` }}
    >
      {items.length === 0 ? (
        <p className="x-empty">No data loaded</p>
      ) : (
        items.map((item) => {
          const { tsr } = item
          const selected = item.id === selectedId
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
              <span role="cell" className="x-sign" style={{ '--c': speedColor(item.limit) }} title={`Restriction ${tsr.restriction || '—'}`}>
                {item.limit ?? '–'}
              </span>
              <span role="cell" className="x-main">
                <b title={tsr.locationText}>{tsr.locationText}</b>
                <em title={`${tsr.restriction || '—'} · ${tsr.track || '—'} · ${tsr.reason || '—'}`}>
                  {tsr.restriction || '—'} · {tsr.track || '—'} · {tsr.reason || '—'}
                </em>
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
