/**
 * Repository Health Score — a single 0-100 metric synthesizing five
 * forensic signals into one number, in the spirit of CodeScene's "Code
 * Health" or a credit score: not a magic ML output, but a transparent,
 * weighted combination of measurable signals that's easy to defend and
 * explain to a reviewer.
 *
 * Each sub-score is computed independently on a 0-100 scale, then combined
 * with fixed weights. Weights are a design decision, not learned — stated
 * explicitly so this isn't dressed up as something it isn't.
 */

const WEIGHTS = {
  hotspotDensity: 0.25,
  churnStability: 0.20,
  ownershipDiversity: 0.20,
  couplingHealth: 0.20,
  contributorDiversity: 0.15,
}

/** Hotspot density: what fraction of files are "severe" hotspots. Lower is healthier. */
function scoreHotspotDensity(hotspots, totalFiles) {
  if (totalFiles === 0) return 100
  const maxScore = Math.max(...hotspots.map(h => h.score), 1)
  const severeCount = hotspots.filter(h => h.score / maxScore > 0.5).length
  const ratio = severeCount / totalFiles
  return Math.max(0, Math.round(100 - ratio * 400)) // 25% severe hotspots -> 0
}

/** Churn stability: how concentrated total churn is in a few files (Gini-like). Lower concentration = healthier. */
function scoreChurnStability(hotspots) {
  if (hotspots.length === 0) return 100
  const totalChurn = hotspots.reduce((sum, h) => sum + h.totalChanges, 0)
  if (totalChurn === 0) return 100
  const top20pct = Math.max(1, Math.ceil(hotspots.length * 0.2))
  const sorted = [...hotspots].sort((a, b) => b.totalChanges - a.totalChanges)
  const topChurn = sorted.slice(0, top20pct).reduce((sum, h) => sum + h.totalChanges, 0)
  const concentration = topChurn / totalChurn
  // Healthy codebases still concentrate ~50-60% of churn in 20% of files (Pareto is normal);
  // penalize only when it's extreme (>85%)
  return Math.max(0, Math.round(100 - Math.max(0, concentration - 0.5) * 200))
}

/** Ownership diversity: inverse of how many files are single-author silos. */
function scoreOwnershipDiversity(silos, totalFiles) {
  if (totalFiles === 0) return 100
  const ratio = silos.length / totalFiles
  return Math.max(0, Math.round(100 - ratio * 300)) // ~33% silo files -> 0
}

/** Coupling health: penalize a high volume of strong hidden-coupling links. */
function scoreCouplingHealth(coupling, totalFiles) {
  if (totalFiles === 0) return 100
  const strongLinks = coupling.filter(c => c.strength > 0.6).length
  const ratio = strongLinks / Math.max(totalFiles, 1)
  return Math.max(0, Math.round(100 - ratio * 250))
}

/** Contributor diversity: more contributors relative to repo size generally means healthier review/ownership patterns. */
function scoreContributorDiversity(totalAuthors, totalCommits) {
  if (totalCommits === 0) return 50
  // Commits-per-author as a proxy: very high commits/author with low author count = risk
  const commitsPerAuthor = totalCommits / Math.max(totalAuthors, 1)
  if (totalAuthors >= 5) return 100
  if (totalAuthors >= 3) return 80
  if (totalAuthors === 2) return 60
  return Math.max(20, Math.round(50 - commitsPerAuthor / 10))
}

function statusForScore(score) {
  if (score >= 80) return { status: 'Healthy', tone: 'success' }
  if (score >= 60) return { status: 'Stable', tone: 'info' }
  if (score >= 40) return { status: 'At Risk', tone: 'warn' }
  return { status: 'Critical', tone: 'danger' }
}

/**
 * Computes the full repository health report.
 * @returns {{score: number, status: string, tone: string, breakdown: object, strengths: string[], risks: string[]}}
 */
export function computeRepositoryHealth({ hotspots, silos, coupling, meta }) {
  const totalFiles = meta.uniqueFiles || 1

  const breakdown = {
    hotspotDensity: scoreHotspotDensity(hotspots, totalFiles),
    churnStability: scoreChurnStability(hotspots),
    ownershipDiversity: scoreOwnershipDiversity(silos, totalFiles),
    couplingHealth: scoreCouplingHealth(coupling, totalFiles),
    contributorDiversity: scoreContributorDiversity(meta.totalAuthors, meta.totalCommits),
  }

  const score = Math.round(
    Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + breakdown[key] * weight, 0)
  )

  const { status, tone } = statusForScore(score)

  const strengths = []
  const risks = []

  if (breakdown.hotspotDensity >= 75) strengths.push('Few severe hotspots relative to codebase size')
  else if (breakdown.hotspotDensity < 50) risks.push(`${hotspots.filter(h => h.score > 0).length} files show concerning churn-and-frequency patterns`)

  if (breakdown.ownershipDiversity >= 75) strengths.push('Knowledge is reasonably distributed across contributors')
  else if (breakdown.ownershipDiversity < 50) risks.push(`${silos.length} files are owned >70% by a single contributor`)

  if (breakdown.couplingHealth >= 75) strengths.push('Limited hidden coupling between unrelated files')
  else if (breakdown.couplingHealth < 50) risks.push(`${coupling.filter(c => c.strength > 0.6).length} file pairs show strong undocumented coupling`)

  if (breakdown.churnStability >= 70) strengths.push('Code churn is spread reasonably evenly, not concentrated in a few files')
  else if (breakdown.churnStability < 50) risks.push('Churn is heavily concentrated in a small number of files')

  if (breakdown.contributorDiversity >= 80) strengths.push(`Healthy contributor base (${meta.totalAuthors} people)`)
  else if (breakdown.contributorDiversity < 50) risks.push(`Very few contributors (${meta.totalAuthors}) relative to commit volume`)

  if (strengths.length === 0) strengths.push('No standout strengths detected in this sample')
  if (risks.length === 0) risks.push('No major risks detected in this sample')

  return { score, status, tone, breakdown, strengths, risks }
}
