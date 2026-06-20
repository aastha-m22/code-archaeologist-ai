const GITHUB_API = 'https://api.github.com'

/**
 * Parses a GitHub URL into owner/repo.
 * Accepts: github.com/owner/repo, github.com/owner/repo.git, owner/repo
 */
export function parseRepoUrl(input) {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/$/, '')
  const githubMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/]+)/i)
  if (githubMatch) return { owner: githubMatch[1], repo: githubMatch[2] }

  const shorthandMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/)
  if (shorthandMatch) return { owner: shorthandMatch[1], repo: shorthandMatch[2] }

  return null
}

class GitHubError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
    this.name = 'GitHubError'
  }
}

async function ghFetch(path, token) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${GITHUB_API}${path}`, { headers })

  if (res.status === 404) {
    throw new GitHubError('Repository not found. Check the URL and make sure it\'s public.', 404)
  }
  if (res.status === 403) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      throw new GitHubError(
        'GitHub API rate limit reached (60 requests/hour without a token). Add a personal access token to continue, or wait an hour.',
        403
      )
    }
    throw new GitHubError('Access forbidden. The repository may be private.', 403)
  }
  if (!res.ok) {
    throw new GitHubError(`GitHub API error: ${res.status} ${res.statusText}`, res.status)
  }

  return res.json()
}

/**
 * Fetches basic repo metadata.
 */
export async function fetchRepoInfo(owner, repo, token) {
  return ghFetch(`/repos/${owner}/${repo}`, token)
}

/**
 * Fetches the commit list, paginating across multiple GitHub API pages
 * if the requested limit exceeds the 100-per-page maximum.
 */
async function fetchCommitList(owner, repo, token, limit) {
  const perPage = 100
  const pagesNeeded = Math.ceil(limit / perPage)
  let allCommits = []

  for (let page = 1; page <= pagesNeeded; page++) {
    const remaining = limit - allCommits.length
    const pageSize = Math.min(perPage, remaining)
    if (pageSize <= 0) break

    const pageData = await ghFetch(
      `/repos/${owner}/${repo}/commits?per_page=${pageSize}&page=${page}`,
      token
    )

    if (!Array.isArray(pageData) || pageData.length === 0) break
    allCommits = allCommits.concat(pageData)
    if (pageData.length < pageSize) break // reached the end of history
  }

  return allCommits
}

/**
 * Fetches the last N commits with their stats.
 * GitHub's list endpoint doesn't include file changes, so we fetch
 * each commit individually (capped to avoid burning rate limits).
 * Supports limit values beyond 100 via automatic pagination.
 */
export async function fetchCommitsWithFiles(owner, repo, token, limit = 100, onProgress) {
  const listData = await fetchCommitList(owner, repo, token, limit)

  if (!Array.isArray(listData) || listData.length === 0) {
    throw new GitHubError('No commits found in this repository.', 404)
  }

  const commits = []
  const total = listData.length

  // Fetch detail for each commit (includes files changed + stats)
  // Sequential to respect rate limits and report progress accurately
  for (let i = 0; i < listData.length; i++) {
    const sha = listData[i].sha
    try {
      const detail = await ghFetch(`/repos/${owner}/${repo}/commits/${sha}`, token)
      commits.push({
        sha: detail.sha,
        message: detail.commit.message.split('\n')[0].slice(0, 120),
        author: detail.commit.author?.name || 'unknown',
        date: detail.commit.author?.date,
        files: (detail.files || []).map(f => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          status: f.status,
        })),
      })
    } catch (err) {
      // Skip individual commit failures (e.g. merge commits with huge diffs) rather than failing the whole analysis
      console.warn(`Skipped commit ${sha}:`, err.message)
    }

    if (onProgress) onProgress(i + 1, total)
  }

  if (commits.length === 0) {
    throw new GitHubError('Could not retrieve commit details. The repository may be too large or restricted.', 500)
  }

  return commits
}
