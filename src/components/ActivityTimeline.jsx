export function ActivityTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) return null

  const width = 700
  const height = 90
  const padding = 8
  const maxCount = Math.max(...timeline.map(t => t.count), 1)

  const points = timeline.map((t, i) => {
    const x = padding + (i / Math.max(timeline.length - 1, 1)) * (width - padding * 2)
    const y = height - padding - (t.count / maxCount) * (height - padding * 2)
    return { x, y, ...t }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - padding} L ${points[0].x.toFixed(1)} ${height - padding} Z`

  const firstDate = new Date(timeline[0].week).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const lastDate = new Date(timeline[timeline.length - 1].week).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  return (
    <div className="timeline-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="timeline-svg" preserveAspectRatio="none">
        <path d={areaD} fill="var(--ca-timeline-fill)" />
        <path d={pathD} fill="none" stroke="var(--ca-timeline-line)" strokeWidth="1.5" />
      </svg>
      <div className="timeline-labels">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  )
}
