const STAGE_LABELS = {
  fetching: 'Excavating commit history',
  analyzing: 'Running forensic analysis',
  narrating: 'Writing the story',
}

const STAGE_DETAILS = {
  fetching: 'Pulling commits and file diffs from the GitHub API',
  analyzing: 'Computing file coupling, hotspots, and ownership patterns',
  narrating: 'Sending forensic data to Llama 3.3 for narrative synthesis',
}

export function LoadingState({ stage, progress, repoInfo }) {
  const showProgress = stage === 'fetching' && progress.total > 0
  const pct = showProgress ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="loading-view">
      <div className="loading-dig" aria-hidden="true">🔍</div>

      <h2 className="loading-title">{STAGE_LABELS[stage] || 'Working…'}</h2>
      <p className="loading-detail">{STAGE_DETAILS[stage]}</p>

      {repoInfo && (
        <p className="loading-repo">{repoInfo.full_name}</p>
      )}

      {showProgress && (
        <div className="loading-progress-wrap">
          <div className="loading-progress-track">
            <div
              className="loading-progress-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="loading-progress-label">
            {progress.current} / {progress.total} commits
          </span>
        </div>
      )}

      {!showProgress && (
        <div className="loading-pulse" aria-hidden="true">
          <span /><span /><span />
        </div>
      )}

      <p className="loading-note">
        This can take 20–60 seconds depending on repo size and commit count.
      </p>
    </div>
  )
}
