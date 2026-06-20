/**
 * Bus Factor Analysis — estimates how many contributors would need to
 * "disappear" before the project loses critical knowledge.
 *
 * This uses the standard practical approximation for bus factor from a
 * commit-history-only signal (no LOC-ownership data available from the
 * GitHub commits API without per-line blame, which isn't fetched here):
 * rank contributors by total commit share, and find the minimum number
 * whose combined share covers >50% of all commits. This is a documented
 * proxy used by tools like `git-quick-stats` and several bus-factor
 * calculators — not a perfect measure of code ownership, but a reasonable
 * one given the data available.
 */

function classifyRisk(busFactor, totalAuthors) {
  if (totalAuthors <= 1) return { level: 'Critical Risk', tone: 'danger' }
  const ratio = busFactor / totalAuthors
  if (busFactor === 1) return { level: 'Critical Risk', tone: 'danger' }
  if (busFactor === 2 || ratio < 0.25) return { level: 'High Risk', tone: 'warn' }
  if (ratio < 0.5) return { level: 'Medium Risk', tone: 'info' }
  return { level: 'Low Risk', tone: 'success' }
}

/**
 * Repo-level bus factor: minimum number of top contributors whose combined
 * commit share exceeds 50% of all commits in the analyzed window.
 */
export function computeBusFactor(commits) {
  const authorCounts = new Map()
  for (const c of commits) {
    authorCounts.set(c.author, (authorCounts.get(c.author) || 0) + 1)
  }

  const total = commits.length
  const sorted = Array.from(authorCounts.entries())
    .map(([author, count]) => ({ author, count, share: total > 0 ? count / total : 0 }))
    .sort((a, b) => b.count - a.count)

  let cumulative = 0
  let busFactor = 0
  for (const entry of sorted) {
    cumulative += entry.share
    busFactor += 1
    if (cumulative >= 0.5) break
  }

  const { level, tone } = classifyRisk(busFactor, sorted.length)

  return {
    busFactor,
    totalContributors: sorted.length,
    riskLevel: level,
    tone,
    topContributors: sorted.slice(0, 8).map(s => ({
      author: s.author,
      commits: s.count,
      sharePct: Math.round(s.share * 100),
    })),
  }
}

/**
 * Per-file bus factor: for each file with enough history, the same
 * cumulative-share calculation restricted to that file's commits.
 */
export function computeFileBusFactor(commits) {
  const fileAuthorCounts = new Map() // filename -> Map(author -> count)

  for (const commit of commits) {
    for (const f of commit.files) {
      if (!fileAuthorCounts.has(f.filename)) fileAuthorCounts.set(f.filename, new Map())
      const m = fileAuthorCounts.get(f.filename)
      m.set(commit.author, (m.get(commit.author) || 0) + 1)
    }
  }

  const results = []
  for (const [filename, authorMap] of fileAuthorCounts.entries()) {
    const total = Array.from(authorMap.values()).reduce((a, b) => a + b, 0)
    if (total < 3) continue

    const sorted = Array.from(authorMap.entries())
      .map(([author, count]) => ({ author, count, share: count / total }))
      .sort((a, b) => b.count - a.count)

    let cumulative = 0
    let fileBusFactor = 0
    for (const entry of sorted) {
      cumulative += entry.share
      fileBusFactor += 1
      if (cumulative >= 0.5) break
    }

    results.push({
      filename,
      busFactor: fileBusFactor,
      contributorCount: sorted.length,
      topOwner: sorted[0].author,
      topOwnerSharePct: Math.round(sorted[0].share * 100),
      totalCommits: total,
    })
  }

  results.sort((a, b) => a.busFactor - b.busFactor || b.topOwnerSharePct - a.topOwnerSharePct)
  return results
}
