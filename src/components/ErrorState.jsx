export function ErrorState({ message, onRetry }) {
  return (
    <div className="error-view">
      <div className="error-icon" aria-hidden="true">⚠️</div>
      <h2 className="error-title">Excavation failed</h2>
      <p className="error-message" role="alert">{message}</p>
      <button className="error-retry-btn" onClick={onRetry}>← Try a different repo</button>
    </div>
  )
}
