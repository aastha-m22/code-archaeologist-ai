import { useState } from 'react'
import { DashboardTabs } from './DashboardTabs'
import { HealthScoreCard } from './HealthScoreCard'
import { BusFactorPanel } from './BusFactorPanel'
import { RiskPredictionPanel } from './RiskPredictionPanel'
import { OwnershipHeatmap } from './OwnershipHeatmap'
import { CouplingGraph } from './CouplingGraph'
import { HotspotsList } from './HotspotsList'
import { OwnershipSilos } from './OwnershipSilos'
import { ActivityTimeline } from './ActivityTimeline'
import { NarrativePanel } from './NarrativePanel'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ResultsDashboard({
  repoInfo, analysis, narrative, narrativeError, hasGroqKey,
  health, busFactor, fileBusFactor, riskModel, onReset,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const { meta, coupling, hotspots, silos, timeline } = analysis

  return (
    <div className="results-view">
      <div className="results-header">
        <div>
          <h2 className="results-title">
            {repoInfo?.full_name || 'Repository analysis'}
          </h2>
          {repoInfo?.description && (
            <p className="results-desc">{repoInfo.description}</p>
          )}
        </div>
        <button className="back-btn" onClick={onReset}>← Excavate another</button>
      </div>

      {/* Stats row — always visible regardless of tab */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{meta.totalCommits}</div>
          <div className="stat-label">Commits analyzed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{meta.totalAuthors}</div>
          <div className="stat-label">Contributors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{meta.uniqueFiles}</div>
          <div className="stat-label">Files touched</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{health?.score ?? '—'}</div>
          <div className="stat-label">Health score</div>
        </div>
      </div>

      <DashboardTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* ─── OVERVIEW ─── */}
      {activeTab === 'overview' && (
        <div className="tab-panel">
          <section className="panel panel--full">
            <h3 className="panel-title">
              <span aria-hidden="true">💚</span> Repository health
            </h3>
            <p className="panel-sub">
              A 0–100 score combining hotspot density, churn stability, ownership diversity,
              coupling health, and contributor diversity.
            </p>
            <HealthScoreCard health={health} />
          </section>

          <section className="panel panel--full panel--narrative">
            <h3 className="panel-title">
              <span aria-hidden="true">📜</span> Engineering consultant report
            </h3>
            <NarrativePanel narrative={narrative} narrativeError={narrativeError} hasGroqKey={hasGroqKey} />
          </section>

          <section className="panel panel--full">
            <h3 className="panel-title">
              <span aria-hidden="true">🚌</span> Bus factor
            </h3>
            <p className="panel-sub">
              The minimum number of contributors whose departure would remove over half this
              repo's institutional knowledge.
            </p>
            <BusFactorPanel busFactor={busFactor} fileBusFactor={fileBusFactor} />
          </section>
        </div>
      )}

      {/* ─── ARCHITECTURE ─── */}
      {activeTab === 'architecture' && (
        <div className="tab-panel">
          <section className="panel panel--full">
            <h3 className="panel-title">
              <span aria-hidden="true">🔗</span> File coupling network
            </h3>
            <p className="panel-sub">
              Files that change together across commits — node color is bug-risk tier, size is
              hotspot severity.
            </p>
            <CouplingGraph coupling={coupling} hotspots={hotspots} riskModel={riskModel} />
          </section>

          <section className="panel panel--full">
            <h3 className="panel-title">
              <span aria-hidden="true">🗺️</span> Ownership heatmap
            </h3>
            <p className="panel-sub">Top contributors × top files, by commit presence</p>
            <OwnershipHeatmap hotspots={hotspots} busFactor={busFactor} />
          </section>
        </div>
      )}

      {/* ─── RISKS ─── */}
      {activeTab === 'risks' && (
        <div className="tab-panel">
          <section className="panel panel--full">
            <h3 className="panel-title">
              <span aria-hidden="true">🧠</span> ML bug-risk predictions
            </h3>
            <p className="panel-sub">
              Logistic regression trained on this repo's own commit history, with explainable
              per-file risk scores.
            </p>
            <RiskPredictionPanel riskModel={riskModel} />
          </section>

          <div className="panel-grid">
            <section className="panel">
              <h3 className="panel-title">
                <span aria-hidden="true">🔥</span> Technical debt hotspots
              </h3>
              <p className="panel-sub">High commit frequency × high line churn</p>
              <HotspotsList hotspots={hotspots} />
            </section>

            <section className="panel">
              <h3 className="panel-title">
                <span aria-hidden="true">👤</span> Knowledge silos
              </h3>
              <p className="panel-sub">Files dominated by a single contributor</p>
              <OwnershipSilos silos={silos} />
            </section>
          </div>
        </div>
      )}

      {/* ─── TRENDS ─── */}
      {activeTab === 'trends' && (
        <div className="tab-panel">
          <section className="panel panel--full">
            <h3 className="panel-title">
              <span aria-hidden="true">📈</span> Commit activity over time
            </h3>
            <p className="panel-sub">
              Historical commit volume by week. (Statistical forecasting of future hotspots —
              e.g. ARIMA/Prophet — is not implemented; see README for why.)
            </p>
            {timeline.length > 1 ? (
              <ActivityTimeline timeline={timeline} />
            ) : (
              <p className="panel-empty">Not enough time-distributed data to chart activity.</p>
            )}
          </section>
        </div>
      )}

      <div className="results-footer-meta">
        Analysis window: {formatDate(meta.dateRange?.earliest)} — {formatDate(meta.dateRange?.latest)}
      </div>
    </div>
  )
}
