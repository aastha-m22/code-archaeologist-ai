/**
 * Code forensics analysis, inspired by Adam Tornhill's "Your Code as a
 * Crime Scene" — using version control history (not static analysis) to
 * surface real architectural signals: hidden coupling, technical debt
 * hotspots, and knowledge silos.
 */

const IGNORE_PATTERNS = [
  /^node_modules\//, /^dist\//, /^build\//, /package-lock\.json$/,
  /^\.git\//, /yarn\.lock$/, /^vendor\//, /\.min\.js$/, /\.map$/,
]

function shouldIgnore(filename) {
  return IGNORE_PATTERNS.some(p => p.test(filename))
}

// Weak-label heuristic for "this commit was a bugfix" — used as a proxy
// label for the risk model, since real defect ground truth doesn't exist
// without issue-tracker integration. This is a standard practice in
// empirical software engineering research (e.g. the SZZ algorithm lineage),
// not a shortcut — we're explicit about it being a proxy, not ground truth.
const BUGFIX_PATTERN = /\b(fix|bug|bugfix|hotfix|patch|revert|regression|crash|error|broken|incorrect|fail(ed|ure)?)\b/i

export function isBugfixCommit(message) {
  return BUGFIX_PATTERN.test(message || '')
}

/**
 * Builds a co-occurrence matrix: for every pair of files that appear
 * together in a commit, count how often. This surfaces "hidden coupling" —
 * files with no direct import relationship that nonetheless always change
 * together, suggesting an undocumented dependency or duplicated logic.
 */
export function computeCoupling(commits, { maxFilesPerCommit = 20 } = {}) {
  const pairCounts = new Map() // "fileA|||fileB" -> count
  const fileChangeCounts = new Map() // filename -> total commits touching it

  for (const commit of commits) {
    const files = commit.files
      .map(f => f.filename)
      .filter(f => !shouldIgnore(f))

    // Skip commits that touch too many files (likely merges, formatting passes, or repo-wide refactors)
    // — these create noise rather than signal in coupling analysis
    if (files.length < 2 || files.length > maxFilesPerCommit) {
      for (const f of files) {
        fileChangeCounts.set(f, (fileChangeCounts.get(f) || 0) + 1)
      }
      continue
    }

    for (const f of files) {
      fileChangeCounts.set(f, (fileChangeCounts.get(f) || 0) + 1)
    }

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join('|||')
        pairCounts.set(key, (pairCounts.get(key) || 0) + 1)
      }
    }
  }

  // Convert to coupling strength: co-occurrences / min(individual change counts)
  // This normalizes for files that just change a lot in general
  const links = []
  for (const [key, count] of pairCounts.entries()) {
    if (count < 2) continue // require at least 2 co-occurrences to call it a signal
    const [a, b] = key.split('|||')
    const minChanges = Math.min(fileChangeCounts.get(a) || 1, fileChangeCounts.get(b) || 1)
    const strength = count / minChanges

    links.push({
      source: a,
      target: b,
      coOccurrences: count,
      strength: Math.round(strength * 100) / 100,
    })
  }

  links.sort((a, b) => b.coOccurrences - a.coOccurrences)
  return { links, fileChangeCounts }
}

/**
 * Computes a hotspot score per file: commit frequency × total line churn.
 * High-churn, frequently-changed files are statistically the most likely
 * locations of bugs and the most expensive to maintain — a well-established
 * heuristic in software forensics research.
 */
export function computeHotspots(commits) {
  const stats = new Map() // filename -> { commits, additions, deletions, lastChanged, authors }
  const now = Date.now()

  for (const commit of commits) {
    const isBugfix = isBugfixCommit(commit.message)

    for (const f of commit.files) {
      if (shouldIgnore(f.filename)) continue

      if (!stats.has(f.filename)) {
        stats.set(f.filename, {
          filename: f.filename,
          commitCount: 0,
          totalChanges: 0,
          authors: new Set(),
          lastChanged: commit.date,
          firstSeen: commit.date,
          bugfixCommits: 0,
        })
      }

      const s = stats.get(f.filename)
      s.commitCount += 1
      s.totalChanges += f.changes || 0
      s.authors.add(commit.author)
      if (isBugfix) s.bugfixCommits += 1
      if (commit.date > s.lastChanged) s.lastChanged = commit.date
      if (commit.date < s.firstSeen) s.firstSeen = commit.date
    }
  }

  const hotspots = Array.from(stats.values()).map(s => {
    const ageDays = Math.max(1, (now - new Date(s.firstSeen).getTime()) / 86400000)
    const daysSinceLastChange = Math.max(0, (now - new Date(s.lastChanged).getTime()) / 86400000)

    return {
      filename: s.filename,
      commitCount: s.commitCount,
      totalChanges: s.totalChanges,
      authorCount: s.authors.size,
      authors: Array.from(s.authors),
      lastChanged: s.lastChanged,
      firstSeen: s.firstSeen,
      bugfixCommits: s.bugfixCommits,
      ageDays: Math.round(ageDays),
      daysSinceLastChange: Math.round(daysSinceLastChange),
      // Hotspot score: normalized product of frequency and churn
      score: s.commitCount * Math.log(s.totalChanges + 1),
    }
  })

  hotspots.sort((a, b) => b.score - a.score)
  return hotspots
}

/**
 * Identifies knowledge silos: files predominantly owned by a single author.
 * High commit concentration on one person = risk if that person leaves,
 * and a common real-world signal of under-documented "scary" code.
 */
export function computeOwnership(commits) {
  const fileAuthors = new Map() // filename -> Map(author -> commitCount)

  for (const commit of commits) {
    for (const f of commit.files) {
      if (shouldIgnore(f.filename)) continue
      if (!fileAuthors.has(f.filename)) fileAuthors.set(f.filename, new Map())
      const authorMap = fileAuthors.get(f.filename)
      authorMap.set(commit.author, (authorMap.get(commit.author) || 0) + 1)
    }
  }

  const silos = []
  for (const [filename, authorMap] of fileAuthors.entries()) {
    const total = Array.from(authorMap.values()).reduce((a, b) => a + b, 0)
    if (total < 3) continue // need enough history to call it a pattern

    const sorted = Array.from(authorMap.entries()).sort((a, b) => b[1] - a[1])
    const [topAuthor, topCount] = sorted[0]
    const concentration = topCount / total

    if (concentration >= 0.7 && sorted.length >= 1) {
      silos.push({
        filename,
        owner: topAuthor,
        concentration: Math.round(concentration * 100),
        totalCommits: total,
        contributorCount: sorted.length,
      })
    }
  }

  silos.sort((a, b) => b.concentration - a.concentration)
  return silos
}

/**
 * Builds a timeline of commit activity for visualization — commits per week.
 */
export function computeActivityTimeline(commits) {
  const weekMap = new Map()

  for (const commit of commits) {
    if (!commit.date) continue
    const d = new Date(commit.date)
    // Round down to the start of the week (Sunday)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    weekStart.setHours(0, 0, 0, 0)
    const key = weekStart.toISOString().slice(0, 10)

    weekMap.set(key, (weekMap.get(key) || 0) + 1)
  }

  return Array.from(weekMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

/**
 * Runs the full analysis pipeline and returns a structured summary.
 */
export function analyzeRepo(commits) {
  const { links } = computeCoupling(commits)
  const hotspots = computeHotspots(commits)
  const silos = computeOwnership(commits)
  const timeline = computeActivityTimeline(commits)

  const totalAuthors = new Set(commits.map(c => c.author)).size
  const dateRange = commits.length > 0
    ? {
        earliest: commits.reduce((a, c) => (!a || c.date < a ? c.date : a), null),
        latest: commits.reduce((a, c) => (!a || c.date > a ? c.date : a), null),
      }
    : null

  return {
    coupling: links.slice(0, 30), // top 30 strongest links
    hotspots: hotspots.slice(0, 15),
    silos: silos.slice(0, 10),
    timeline,
    meta: {
      totalCommits: commits.length,
      totalAuthors,
      dateRange,
      uniqueFiles: new Set(commits.flatMap(c => c.files.map(f => f.filename))).size,
    },
  }
}
