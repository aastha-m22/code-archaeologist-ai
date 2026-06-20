function renderMarkdown(text) {
  // Minimal markdown rendering: ## headers and paragraphs only (controlled AI output, no need for a full parser)
  const lines = text.split('\n')
  const blocks = []
  let currentPara = []

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: 'p', text: currentPara.join(' ') })
      currentPara = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { flushPara(); continue }
    if (trimmed.startsWith('## ')) {
      flushPara()
      blocks.push({ type: 'h3', text: trimmed.slice(3) })
    } else {
      currentPara.push(trimmed)
    }
  }
  flushPara()

  return blocks
}

export function NarrativePanel({ narrative, narrativeError, hasGroqKey }) {
  if (!hasGroqKey) {
    return (
      <div className="narrative-empty">
        <span className="narrative-empty-icon" aria-hidden="true">🤖</span>
        <p>
          Add a Groq API key in advanced options to get an AI-generated narrative of this
          repo's evolution.
        </p>
      </div>
    )
  }

  if (narrativeError) {
    return (
      <div className="narrative-error" role="alert">
        <span aria-hidden="true">⚠️</span> {narrativeError}
      </div>
    )
  }

  if (!narrative) {
    return (
      <div className="narrative-loading">
        <span className="narrative-loading-dot" />
        <span className="narrative-loading-dot" />
        <span className="narrative-loading-dot" />
      </div>
    )
  }

  const blocks = renderMarkdown(narrative)

  return (
    <div className="narrative-content">
      {blocks.map((block, i) =>
        block.type === 'h3' ? (
          <h3 key={i} className="narrative-h3">{block.text}</h3>
        ) : (
          <p key={i} className="narrative-p">{block.text}</p>
        )
      )}
    </div>
  )
}
