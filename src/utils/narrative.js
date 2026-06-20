import Groq from 'groq-sdk'

const SYSTEM_PROMPT = `You are a senior engineering consultant brought in to assess a codebase's architecture and risk profile, using only version control history — not the code itself. You're given: commit data, file coupling (files that change together), technical debt hotspots, ownership/knowledge-silo data, a computed repository health score, bus-factor analysis, and ML-based bug-risk predictions.

Write like a consultant delivering findings to an engineering lead — direct, evidence-based, citing specific filenames and numbers. Never write generic platitudes like "the codebase shows signs of organic growth." Identify concrete architectural concerns and give actionable recommendations, not vague encouragement.

Structure your response in exactly these sections, using markdown headers:
## Assessment
2-3 sentences: what this data reveals about how the project evolved and its overall risk posture, referencing the health score.

## Architectural Concerns
Identify 1-2 specific hidden-coupling patterns (cite exact files and co-occurrence %) and explain the likely underlying design issue (e.g. "shared domain logic that should be extracted"). Give one concrete recommendation.

## Highest-Risk Files
Name the top 2-3 files from the ML risk predictions or hotspots, citing their specific risk score/percentage. Explain in one sentence each why they're dangerous to touch.

## Bus Factor & Continuity Risk
State the bus factor number and what it means in practice. If there are knowledge silos, name them and recommend a mitigation (e.g. pairing, documentation).

## Recommended Next Steps
2-3 concrete, prioritized actions — not generic advice like "write more tests."

Keep the whole thing under 350 words. Be specific, not generic. This is a paid consulting deliverable, not a blog post.`

export async function generateNarrative(apiKey, analysisData, repoName, extras = {}) {
  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })

  const { coupling, hotspots, silos, meta } = analysisData
  const { health, busFactor, riskModel } = extras

  const healthBlock = health
    ? `REPOSITORY HEALTH SCORE: ${health.score}/100 (${health.status})
Strengths: ${health.strengths.join('; ')}
Risks: ${health.risks.join('; ')}`
    : 'Repository health score not computed.'

  const busFactorBlock = busFactor
    ? `BUS FACTOR: ${busFactor.busFactor} (${busFactor.riskLevel}) out of ${busFactor.totalContributors} contributors
Top contributors: ${busFactor.topContributors.slice(0, 4).map(c => `${c.author} (${c.sharePct}%)`).join(', ')}`
    : 'Bus factor not computed.'

  const riskBlock = riskModel?.trained
    ? `ML BUG-RISK PREDICTIONS (logistic regression, proxy-labeled, test accuracy ${riskModel.diagnostics.testAccuracy}%):
${riskModel.predictions.slice(0, 6).map(p => `- ${p.filename}: ${p.riskScore}% risk (${p.riskLabel}) — ${p.explanation[0]}`).join('\n')}`
    : 'ML risk model not available for this repository (insufficient data).'

  const dataSnapshot = `
Repository: ${repoName}
Total commits analyzed: ${meta.totalCommits}
Contributors: ${meta.totalAuthors}
Unique files touched: ${meta.uniqueFiles}

${healthBlock}

${busFactorBlock}

${riskBlock}

TOP FILE COUPLINGS (files that change together):
${coupling.slice(0, 8).map(c => `- ${c.source} <-> ${c.target} (${c.coOccurrences} co-occurrences, strength ${c.strength})`).join('\n') || 'None found'}

TOP HOTSPOTS (high churn + frequency):
${hotspots.slice(0, 6).map(h => `- ${h.filename}: ${h.commitCount} commits, ${h.totalChanges} total line changes, ${h.authorCount} authors`).join('\n') || 'None found'}

OWNERSHIP SILOS (single-author concentration):
${silos.slice(0, 5).map(s => `- ${s.filename}: ${s.concentration}% owned by ${s.owner} (${s.totalCommits} commits)`).join('\n') || 'No strong silos detected'}
`.trim()

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 700,
      temperature: 0.6,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: dataSnapshot },
      ],
    })

    const text = completion.choices[0]?.message?.content
    if (!text?.trim()) throw new Error('Empty response from API.')
    return text
  } catch (err) {
    throw new Error(parseGroqError(err))
  }
}

function parseGroqError(err) {
  const msg = err?.message || ''
  const status = err?.status || err?.statusCode

  if (status === 401 || msg.toLowerCase().includes('invalid api key')) {
    return 'Invalid Groq API key. Please check your key and try again.'
  }
  if (status === 429 || msg.toLowerCase().includes('rate limit')) {
    return 'Groq rate limit reached. Please wait a moment and try again.'
  }
  if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
    return 'Network error reaching Groq. Check your connection.'
  }
  return `Narrative generation failed: ${msg || 'Unknown error'}`
}
