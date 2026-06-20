import { RepoInput } from './components/RepoInput'
import { LoadingState } from './components/LoadingState'
import { ResultsDashboard } from './components/ResultsDashboard'
import { ErrorState } from './components/ErrorState'
import { useAnalysis } from './hooks/useAnalysis'
import './App.css'

export default function App() {
  const {
    stage, progress, repoInfo, analysis, narrative, narrativeError, error,
    health, busFactor, fileBusFactor, riskModel,
    runAnalysis, reset,
  } = useAnalysis()

  const isLoading = stage === 'fetching' || stage === 'analyzing' || stage === 'narrating'
  const hasGroqKey = !!localStorage.getItem('ca_groq_key')

  const handleAnalyze = (url, githubToken, groqKey, commitLimit) => {
    runAnalysis(url, githubToken, groqKey, commitLimit)
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon" aria-hidden="true">🔍</span>
            <span className="logo-text">
              Code<strong>Archaeologist</strong> <span className="logo-ai-tag">AI</span>
            </span>
          </div>
          {stage === 'done' && (
            <button className="nav-btn" onClick={reset}>← New excavation</button>
          )}
        </div>
      </header>

      <main className="main">
        {(stage === 'idle') && (
          <RepoInput onAnalyze={handleAnalyze} isLoading={isLoading} />
        )}

        {isLoading && (
          <LoadingState stage={stage} progress={progress} repoInfo={repoInfo} />
        )}

        {stage === 'error' && (
          <ErrorState message={error} onRetry={reset} />
        )}

        {stage === 'done' && analysis && (
          <ResultsDashboard
            repoInfo={repoInfo}
            analysis={analysis}
            narrative={narrative}
            narrativeError={narrativeError}
            hasGroqKey={hasGroqKey}
            health={health}
            busFactor={busFactor}
            fileBusFactor={fileBusFactor}
            riskModel={riskModel}
            onReset={reset}
          />
        )}
      </main>

      <footer className="footer">
        <p>
          Commit-coupling forensics inspired by{' '}
          <a href="https://www.adamtornhill.com/articles/codemaat/codemaatintro.html" target="_blank" rel="noopener noreferrer">
            Adam Tornhill's research
          </a>
          {' '}· Risk model: logistic regression trained on proxy-labeled commit history
          {' '}· Narrative by{' '}
          <a href="https://groq.com" target="_blank" rel="noopener noreferrer">Groq</a>
          {' '}· Data via{' '}
          <a href="https://docs.github.com/en/rest" target="_blank" rel="noopener noreferrer">GitHub API</a>
        </p>
      </footer>
    </div>
  )
}
