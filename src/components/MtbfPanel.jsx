import { ArrowDown, ArrowUp, Fence, Split, TrainFront } from 'lucide-react'
import Panel from './Panel'

const NUMBER_FORMAT = new Intl.NumberFormat('en-US')

const ASSET_META = {
  Fence: { icon: Fence },
  Track: { icon: TrainFront },
  Turnout: { icon: Split },
}

// MTBF in hours per asset, with the change against the previous month when that month is in the workbook.
export default function MtbfPanel({ data }) {
  return (
    <Panel title="MTBF (Hours)" subtitle="Mean time between failures by asset" className="panel--mtbf">
      <div className="m-strip">
        {data.map((item) => {
          const Icon = ASSET_META[item.asset].icon
          const has = item.hours != null
          const previous = Number(item.previousHours)
          const diff =
            has && item.previousHours != null && Number.isFinite(previous)
              ? Number((item.hours - previous).toFixed(1))
              : null
          const ChangeIcon = diff > 0 ? ArrowUp : ArrowDown

          return (
            <div
              key={item.asset}
              className="m-met"
              title={`${item.asset}: ${has ? `${NUMBER_FORMAT.format(item.hours)} hours` : 'No data loaded'}`}
            >
              <div className="m-met__id">
                <span className="m-met__icon" aria-hidden="true">
                  <Icon size={15} strokeWidth={2.1} />
                </span>
                <span className="m-met__name">{item.asset}</span>
              </div>
              <p className="m-met__value">
                {has ? NUMBER_FORMAT.format(item.hours) : '—'}
                {has ? <small>h</small> : null}
              </p>
              <p className="m-met__delta">
                {diff != null && diff !== 0 ? (
                  <span
                    className={`kpi-card__change kpi-card__change--${diff > 0 ? 'good' : 'bad'}`}
                    title={`Change vs previous month (${NUMBER_FORMAT.format(previous)} h)`}
                  >
                    <ChangeIcon size={11} strokeWidth={2.8} />
                    {diff > 0 ? '+' : '−'}
                    {NUMBER_FORMAT.format(Math.abs(diff))}
                  </span>
                ) : null}
              </p>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
