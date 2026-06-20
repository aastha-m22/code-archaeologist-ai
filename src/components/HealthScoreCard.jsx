const BREAKDOWN_LABELS = {
  hotspotDensity: 'Hotspot density',
  churnStability: 'Churn stability',
  ownershipDiversity: 'Ownership diversity',
  couplingHealth: 'Coupling health',
  contributorDiversity: 'Contributor diversity',
}

export function HealthScoreCard({ health }) {
  if (!health) return null

  const circumference = 2 * Math.PI * 54
  const offset = circumference - (health.score / 100) * circumference

  return (
    <div className="health-card">
      <div className="health-ring-wrap">
        <svg viewBox="0 0 120 120" className="health-ring">
          <circle cx="60" cy="60" r="54" className="health-ring-track" />
          <circle
            cx="60" cy="60" r="54"
            className={`health-ring-fill health-ring-fill--${health.tone}`}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="health-ring-label">
          <div className="health-ring-score">{health.score}</div>
          <div className="health-ring-max">/100</div>
        </div>
      </div>

      <div className="health-info">
        <div className={`health-status health-status--${health.tone}`}>{health.status}</div>

        <div className="health-breakdown">
          {Object.entries(health.breakdown).map(([key, value]) => (
            <div key={key} className="health-breakdown-row">
              <span className="health-breakdown-label">{BREAKDOWN_LABELS[key]}</span>
              <div className="health-breakdown-track">
                <div
                  className="health-breakdown-fill"
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="health-breakdown-value">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="health-lists">
        <div className="health-list">
          <div className="health-list-title health-list-title--good">✓ Strengths</div>
          <ul>
            {health.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
        <div className="health-list">
          <div className="health-list-title health-list-title--bad">⚠ Risks</div>
          <ul>
            {health.risks.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </div>
    </div>
  )
}
