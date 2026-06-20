function relativeTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function HotspotsList({ hotspots }) {
  if (!hotspots || hotspots.length === 0) {
    return <p className="panel-empty">No clear hotspots detected — churn is evenly distributed.</p>
  }

  const maxScore = Math.max(...hotspots.map(h => h.score))

  return (
    <ul className="hotspot-list">
      {hotspots.map((h, i) => (
        <li key={h.filename} className="hotspot-item">
          <div className="hotspot-rank">{i + 1}</div>
          <div className="hotspot-info">
            <div className="hotspot-filename" title={h.filename}>{h.filename}</div>
            <div className="hotspot-bar-track">
              <div
                className="hotspot-bar-fill"
                style={{ width: `${(h.score / maxScore) * 100}%` }}
              />
            </div>
            <div className="hotspot-meta">
              <span>{h.commitCount} commits</span>
              <span>·</span>
              <span>{h.totalChanges} changes</span>
              <span>·</span>
              <span>{h.authorCount} {h.authorCount === 1 ? 'author' : 'authors'}</span>
              <span>·</span>
              <span>{relativeTime(h.lastChanged)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
