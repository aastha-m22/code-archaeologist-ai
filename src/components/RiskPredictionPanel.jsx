export function RiskPredictionPanel({ riskModel }) {
  if (!riskModel) return null

  if (!riskModel.trained) {
    return (
      <div className="risk-untrained">
        <span aria-hidden="true">🤖</span>
        <p>{riskModel.reason}</p>
      </div>
    )
  }

  const { predictions, diagnostics, caveat } = riskModel
  const topRisks = predictions.slice(0, 10)

  return (
    <div className="risk-panel">
      <div className="risk-caveat" role="note">
        <strong>How to read this:</strong> {caveat}
      </div>

      <div className="risk-diagnostics">
        <div className="risk-diag-item">
          <span className="risk-diag-value">{diagnostics.testAccuracy ?? '—'}%</span>
          <span className="risk-diag-label">Test accuracy</span>
        </div>
        <div className="risk-diag-item">
          <span className="risk-diag-value">{diagnostics.trainSize}</span>
          <span className="risk-diag-label">Training files</span>
        </div>
        <div className="risk-diag-item">
          <span className="risk-diag-value">{diagnostics.testSize}</span>
          <span className="risk-diag-label">Test files</span>
        </div>
        <div className="risk-diag-item">
          <span className="risk-diag-value">{diagnostics.positiveRatePct}%</span>
          <span className="risk-diag-label">Flagged historically</span>
        </div>
      </div>

      <div className="panel-subtitle">Highest predicted risk</div>
      <ul className="risk-list">
        {topRisks.map(p => (
          <li key={p.filename} className="risk-item">
            <div className="risk-item-top">
              <span className="risk-item-filename" title={p.filename}>{p.filename}</span>
              <span className={`risk-badge risk-badge--${p.tone}`}>
                {p.riskScore}% · {p.riskLabel}
              </span>
            </div>
            <div className="risk-item-explanation">
              {p.explanation.map((reason, i) => (
                <span key={i} className="risk-reason">• {reason}</span>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <details className="risk-weights-details">
        <summary>Model weights (feature importance)</summary>
        <div className="risk-weights-list">
          {diagnostics.featureWeights
            .slice()
            .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
            .map(w => (
              <div key={w.name} className="risk-weight-row">
                <span className="risk-weight-name">{w.name}</span>
                <span className={`risk-weight-value ${w.weight >= 0 ? 'positive' : 'negative'}`}>
                  {w.weight >= 0 ? '+' : ''}{w.weight}
                </span>
              </div>
            ))}
        </div>
      </details>
    </div>
  )
}
