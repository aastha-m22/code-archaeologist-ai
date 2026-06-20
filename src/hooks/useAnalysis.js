import { useState, useCallback } from 'react'
import { parseRepoUrl, fetchRepoInfo, fetchCommitsWithFiles } from '../utils/github'
import { analyzeRepo } from '../utils/forensics'
import { generateNarrative } from '../utils/narrative'
import { computeRepositoryHealth } from '../utils/health'
import { computeBusFactor, computeFileBusFactor } from '../utils/busFactor'
import { trainBugRiskModel } from '../utils/riskModel'

const DEFAULT_COMMIT_LIMIT = 100

export function useAnalysis() {
  const [stage, setStage] = useState('idle') // idle | fetching | analyzing | narrating | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [repoInfo, setRepoInfo] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [narrative, setNarrative] = useState('')
  const [narrativeError, setNarrativeError] = useState('')
  const [error, setError] = useState('')
  const [health, setHealth] = useState(null)
  const [busFactor, setBusFactor] = useState(null)
  const [fileBusFactor, setFileBusFactor] = useState(null)
  const [riskModel, setRiskModel] = useState(null)

  const reset = useCallback(() => {
    setStage('idle')
    setProgress({ current: 0, total: 0 })
    setRepoInfo(null)
    setAnalysis(null)
    setNarrative('')
    setNarrativeError('')
    setError('')
    setHealth(null)
    setBusFactor(null)
    setFileBusFactor(null)
    setRiskModel(null)
  }, [])

  const runAnalysis = useCallback(async (repoUrl, githubToken, groqKey, commitLimit = DEFAULT_COMMIT_LIMIT) => {
    reset()

    const parsed = parseRepoUrl(repoUrl)
    if (!parsed) {
      setError('Could not parse that as a GitHub repository. Try a URL like github.com/owner/repo')
      setStage('error')
      return
    }

    try {
      setStage('fetching')
      const info = await fetchRepoInfo(parsed.owner, parsed.repo, githubToken)
      setRepoInfo(info)

      const commits = await fetchCommitsWithFiles(
        parsed.owner,
        parsed.repo,
        githubToken,
        commitLimit,
        (current, total) => setProgress({ current, total })
      )

      setStage('analyzing')
      const result = analyzeRepo(commits)
      setAnalysis(result)

      const healthReport = computeRepositoryHealth(result)
      setHealth(healthReport)

      const busFactorReport = computeBusFactor(commits)
      setBusFactor(busFactorReport)

      const fileBusFactorReport = computeFileBusFactor(commits)
      setFileBusFactor(fileBusFactorReport)

      const riskReport = trainBugRiskModel(result.hotspots, result.coupling)
      setRiskModel(riskReport)

      if (groqKey) {
        setStage('narrating')
        try {
          const text = await generateNarrative(groqKey, result, `${parsed.owner}/${parsed.repo}`, {
            health: healthReport,
            busFactor: busFactorReport,
            riskModel: riskReport,
          })
          setNarrative(text)
        } catch (narrErr) {
          // Narrative is a bonus feature — don't fail the whole analysis if it errors
          setNarrativeError(narrErr.message)
        }
      }

      setStage('done')
    } catch (err) {
      setError(err.message || 'Something went wrong analyzing this repository.')
      setStage('error')
    }
  }, [reset])

  return {
    stage,
    progress,
    repoInfo,
    analysis,
    narrative,
    narrativeError,
    error,
    health,
    busFactor,
    fileBusFactor,
    riskModel,
    runAnalysis,
    reset,
  }
}
