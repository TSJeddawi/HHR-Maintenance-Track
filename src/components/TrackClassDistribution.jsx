import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Panel from './Panel'
import { placeTooltip } from '../utils/tooltipPlacement'

const TRACK_CLASSES = ['A', 'B', 'C', 'D', 'E']

function hasClassData(data) {
  return data.some((group) =>
    group.lines.some((line) =>
      TRACK_CLASSES.some((cls) => line.values?.[cls] != null),
    ),
  )
}

export default function TrackClassDistribution({ data }) {
  const [tooltip, setTooltip] = useState(null)
  const loaded = hasClassData(data)

  const tooltipRef = useRef(null)

  function updateTooltip(event, nextTooltip) {
    setTooltip({ ...nextTooltip, pointerX: event.clientX, pointerY: event.clientY })
  }

  // Measure the real tooltip size, then place it so it stays fully in the viewport.
  useLayoutEffect(() => {
    const node = tooltipRef.current
    if (!tooltip || !node) return
    const { width, height } = node.getBoundingClientRect()
    const viewport = document.documentElement
    const spot = placeTooltip(
      { x: tooltip.pointerX, y: tooltip.pointerY },
      { width, height },
      { width: viewport.clientWidth, height: viewport.clientHeight },
    )
    node.style.left = `${spot.left}px`
    node.style.top = `${spot.top}px`
    node.style.visibility = 'visible'
  }, [tooltip])

  return (
    <Panel
      title="Track Class Distribution"
      subtitle="A = best condition · E = lowest condition"
      className="panel--track-class"
    >
      <div className="class-legend" aria-hidden="true">
        {TRACK_CLASSES.map((cls, index) => (
          <span key={cls} className={`class-legend__item class-legend__item--${cls}`}>
            <i />
            {cls}
            {index === 0 ? ' best' : ''}
            {index === TRACK_CLASSES.length - 1 ? ' lowest' : ''}
          </span>
        ))}
      </div>

      <div className="class-groups">
        {data.map((group) => (
          <div key={group.type} className="class-group">
            <h3 className="class-group__title">{group.type}</h3>
            {group.lines.map((line) => (
              <div key={`${group.type}-${line.name}`} className="class-row">
                <span className="class-row__label">{line.name}</span>
                <div
                  className="class-row__bar"
                  role="img"
                  aria-label={`${group.type} ${line.name} class distribution`}
                >
                  {loaded
                    ? TRACK_CLASSES.map((cls) => {
                        const value = line.values[cls]
                        if (value == null) return null
                        return (
                          <div
                            key={cls}
                            className={`class-seg class-seg--${cls}${value > 0 && value < 8 ? ' class-seg--compact' : ''}`}
                            style={{ width: `${value}%` }}
                            onMouseOver={(event) =>
                              updateTooltip(event, {
                                cls,
                                value,
                                type: group.type,
                                line: line.name,
                              })
                            }
                            onMouseMove={(event) =>
                              updateTooltip(event, {
                                cls,
                                value,
                                type: group.type,
                                line: line.name,
                              })
                            }
                            onMouseOut={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget)) {
                                setTooltip(null)
                              }
                            }}
                          >
                            {value >= 8 ? <strong>{value}%</strong> : ''}
                          </div>
                        )
                      })
                    : null}
                </div>
              </div>
            ))}
          </div>
        ))}
        {loaded ? null : <p className="empty-note empty-note--overlay">No data loaded</p>}
      </div>

      {tooltip
        ? createPortal(
            <div
              ref={tooltipRef}
              className="class-tooltip"
              role="tooltip"
              style={{ left: 0, top: 0, visibility: 'hidden' }}
            >
              <p className="class-tooltip__class">Class {tooltip.cls}</p>
              <p className="class-tooltip__value">{tooltip.value}%</p>
              <p className="class-tooltip__meta">
                {tooltip.type} – {tooltip.line}
              </p>
            </div>,
            document.body,
          )
        : null}
    </Panel>
  )
}
