export function OwnershipSilos({ silos }) {
  if (!silos || silos.length === 0) {
    return (
      <p className="panel-empty">
        ✓ No strong knowledge silos detected — ownership is reasonably distributed.
      </p>
    )
  }

  return (
    <ul className="silo-list">
      {silos.map(s => (
        <li key={s.filename} className="silo-item">
          <div className="silo-filename" title={s.filename}>{s.filename}</div>
          <div className="silo-bar-track">
            <div
              className="silo-bar-fill"
              style={{ width: `${s.concentration}%` }}
            />
            <span className="silo-bar-label">{s.concentration}%</span>
          </div>
          <div className="silo-meta">
            <strong>{s.owner}</strong> owns this · {s.totalCommits} commits ·{' '}
            {s.contributorCount} {s.contributorCount === 1 ? 'contributor' : 'contributors'} total
          </div>
        </li>
      ))}
    </ul>
  )
}
