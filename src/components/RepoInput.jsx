import { useState, useId } from 'react'

const EXAMPLE_REPOS = [
  'facebook/react',
  'expressjs/express',
  'pallets/flask',
]

const COMMIT_LIMIT_OPTIONS = [
  { value: 100, label: '100 commits', note: 'Fastest' },
  { value: 300, label: '300 commits', note: 'Recommended' },
  { value: 500, label: '500 commits', note: 'Deeper history' },
  { value: 1000, label: '1000 commits', note: 'Most thorough' },
]

export function RepoInput({ onAnalyze, isLoading }) {
  const [url, setUrl] = useState('')
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('ca_gh_token') || '')
  const [groqKey, setGroqKey] = useState(() => localStorage.getItem('ca_groq_key') || '')
  const [commitLimit, setCommitLimit] = useState(100)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [err, setErr] = useState('')

  const urlId = useId()
  const ghId = useId()
  const groqId = useId()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) {
      setErr('Paste a GitHub repository URL to begin.')
      return
    }
    setErr('')

    if (githubToken.trim()) localStorage.setItem('ca_gh_token', githubToken.trim())
    if (groqKey.trim()) localStorage.setItem('ca_groq_key', groqKey.trim())

    onAnalyze(url.trim(), githubToken.trim(), groqKey.trim(), commitLimit)
  }

  return (
    <div className="repo-input-view">
      <div className="hero">
        <div className="hero-badge">
          <span aria-hidden="true">🔍</span> Repository intelligence platform
        </div>
        <h1 className="hero-title">
          Every codebase has a <em>story</em>.
        </h1>
        <p className="hero-sub">
          Paste a GitHub repo. We mine the commit history — not the code itself — to compute a
          health score, bus factor, ML-based bug-risk predictions, and hidden file coupling.
          Then an AI engineering consultant writes up the findings.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="repo-form" noValidate>
        <div className="repo-input-row">
          <label htmlFor={urlId} className="sr-only">GitHub repository URL</label>
          <input
            id={urlId}
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); setErr('') }}
            placeholder="github.com/facebook/react"
            className={`repo-input ${err ? 'repo-input--error' : ''}`}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!err}
          />
          <button type="submit" className="analyze-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Digging…
              </>
            ) : (
              'Excavate →'
            )}
          </button>
        </div>

        {err && <p className="repo-err" role="alert">{err}</p>}

        <div className="example-repos">
          <span className="example-label">Try:</span>
          {EXAMPLE_REPOS.map(r => (
            <button
              key={r}
              type="button"
              className="example-chip"
              onClick={() => setUrl(r)}
            >
              {r}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced(v => !v)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? '− Hide' : '+ Show'} advanced options (API keys)
        </button>

        {showAdvanced && (
          <div className="advanced-panel">
            <div className="advanced-field">
              <label className="advanced-label">Analysis depth</label>
              <div className="depth-selector" role="radiogroup" aria-label="Commit analysis depth">
                {COMMIT_LIMIT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={commitLimit === opt.value}
                    className={`depth-chip ${commitLimit === opt.value ? 'depth-chip--active' : ''}`}
                    onClick={() => setCommitLimit(opt.value)}
                  >
                    <span className="depth-chip-label">{opt.label}</span>
                    <span className="depth-chip-note">{opt.note}</span>
                  </button>
                ))}
              </div>
              <p className="advanced-hint">
                Larger samples give more reliable hotspot/coupling signals and enough data to
                train the ML risk model, but take proportionally longer to fetch (~0.3–0.5s per
                commit due to GitHub's per-commit detail API).
              </p>
            </div>

            <div className="advanced-field">
              <label htmlFor={ghId} className="advanced-label">
                GitHub token <span className="optional-tag">optional</span>
              </label>
              <input
                id={ghId}
                type="password"
                value={githubToken}
                onChange={e => setGithubToken(e.target.value)}
                placeholder="ghp_... (raises rate limit from 60 to 5000 req/hr)"
                className="advanced-input"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="advanced-hint">
                Without a token you get 60 requests/hour — enough for small repos. For larger
                ones, add a{' '}
                <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer">
                  personal access token
                </a>{' '}
                (no scopes needed for public repos).
              </p>
            </div>

            <div className="advanced-field">
              <label htmlFor={groqId} className="advanced-label">
                Groq API key <span className="optional-tag">optional — enables AI narrative</span>
              </label>
              <input
                id={groqId}
                type="password"
                value={groqKey}
                onChange={e => setGroqKey(e.target.value)}
                placeholder="gsk_..."
                className="advanced-input"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="advanced-hint">
                Without this, you still get the full visual analysis — just no AI-written
                narrative. Get a free key at{' '}
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
                  console.groq.com
                </a>
              </p>
            </div>

            <p className="advanced-disclaimer">
              🔒 Both keys are stored only in your browser's localStorage and sent directly to
              their respective APIs — never to any server we control.
            </p>
          </div>
        )}
      </form>

      <div className="feature-grid">
        <div className="feature-item">
          <span className="feature-icon" aria-hidden="true">💚</span>
          <div>
            <div className="feature-title">Health score</div>
            <div className="feature-desc">0–100, combining 5 weighted forensic signals</div>
          </div>
        </div>
        <div className="feature-item">
          <span className="feature-icon" aria-hidden="true">🚌</span>
          <div>
            <div className="feature-title">Bus factor</div>
            <div className="feature-desc">How many people could leave before knowledge is lost</div>
          </div>
        </div>
        <div className="feature-item">
          <span className="feature-icon" aria-hidden="true">🧠</span>
          <div>
            <div className="feature-title">ML risk scoring</div>
            <div className="feature-desc">Logistic regression, genuinely trained per repo</div>
          </div>
        </div>
      </div>
    </div>
  )
}
