const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'architecture', label: 'Architecture', icon: '🔗' },
  { id: 'risks', label: 'Risks', icon: '⚠️' },
  { id: 'trends', label: 'Trends', icon: '📈' },
]

export function DashboardTabs({ activeTab, onChange }) {
  return (
    <nav className="dashboard-tabs" role="tablist" aria-label="Analysis sections">
      {TABS.map(tab => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`dashboard-tab ${activeTab === tab.id ? 'dashboard-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          <span aria-hidden="true">{tab.icon}</span> {tab.label}
        </button>
      ))}
    </nav>
  )
}
