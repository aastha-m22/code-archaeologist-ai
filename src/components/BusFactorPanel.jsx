export function BusFactorPanel({ busFactor, fileBusFactor }) {
  if (!busFactor) return null

  const riskiestFiles = (fileBusFactor || []).filter(f => f.busFactor === 1).slice(0, 8)

  return (
    <div className="busfactor-panel">
      <div className="busfactor-headline">
        <div className="busfactor-number-wrap">
          <div className={`busfactor-number busfactor-number--${busFactor.tone}`}>
            {busFactor.busFactor}
          </div>
          <div className="busfactor-number-label">Bus Factor</div>
        </div>
        <div className="busfactor-explain">
          <div className={`busfactor-risk-badge busfactor-risk-badge--${busFactor.tone}`}>
            {busFactor.riskLevel}
          </div>
          <p className="busfactor-explain-text">
            The loss of <strong>{busFactor.busFactor}</strong> key contributor
            {busFactor.busFactor === 1 ? '' : 's'} would account for over half of this
            repository's commit history — a critical knowledge-continuity threshold.
          </p>
        </div>
      </div>

      <div className="busfactor-contributors">
        <div className="panel-subtitle">Commit share by contributor</div>
        {busFactor.topContributors.map(c => (
          <div key={c.author} className="contributor-row">
            <span className="contributor-name" title={c.author}>{c.author}</span>
            <div className="contributor-bar-track">
              <div className="contributor-bar-fill" style={{ width: `${c.sharePct}%` }} />
            </div>
            <span className="contributor-pct">{c.sharePct}%</span>
          </div>
        ))}
      </div>

      {riskiestFiles.length > 0 && (
        <div className="busfactor-files">
          <div className="panel-subtitle">Single-point-of-failure files (bus factor = 1)</div>
          <ul className="sof-list">
            {riskiestFiles.map(f => (
              <li key={f.filename} className="sof-item">
                <span className="sof-filename" title={f.filename}>{f.filename}</span>
                <span className="sof-owner">{f.topOwnerSharePct}% owned by {f.topOwner}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
