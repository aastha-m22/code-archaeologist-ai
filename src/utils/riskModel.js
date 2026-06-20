/**
 * Bug-Risk Prediction Model — GENUINE machine learning, with an honest
 * caveat clearly stated: this is logistic regression trained client-side
 * via gradient descent on a PROXY label, not ground-truth defect data.
 *
 * WHY A PROXY LABEL: There is no real bug-tracking integration here, so
 * there's no ground truth like "this file caused production incident #4521."
 * Instead we use the same proxy the empirical software engineering
 * literature uses when issue trackers aren't available (closely related to
 * the SZZ algorithm lineage): a commit is treated as a "bugfix commit" if
 * its message matches fix/bug/hotfix/patch/crash/etc. Files disproportionately
 * touched in bugfix commits get a positive label. This is a real, accepted
 * technique — but it is NOT the same as verified defect data, and the model
 * trained on it should be read as "files that pattern-match historical bug
 * fixes" rather than "files that will definitely have bugs."
 *
 * WHY LOGISTIC REGRESSION, NOT XGBOOST/RANDOMFOREST: those require a backend
 * (Python or a WASM runtime) and meaningfully more training data than a
 * single repo's commit history provides (typically 50-500 files). A 6-feature
 * logistic regression is the right-sized model for this data volume — it's
 * genuinely trained (real gradient descent, real loss minimization, real
 * train/test split), fully explainable via its learned weights, and won't
 * silently overfit on n=80 samples the way a forest of trees would.
 */

const FEATURE_NAMES = [
  'commitFrequency',         // normalized commit count
  'churn',                   // normalized total line changes
  'ownershipConcentration',  // normalized inverse of author count — single-owner files score high
  'couplingDegree',          // normalized number of coupling links involving this file
  'fileAge',                 // normalized age in days since first commit
  'recentActivity',          // normalized inverse of days-since-last-change (recency)
]

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z))
}

/** Min-max normalize a feature array to [0, 1]. */
function normalize(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range === 0) return values.map(() => 0.5)
  return values.map(v => (v - min) / range)
}

/**
 * Builds the feature matrix and proxy labels from hotspot + coupling data.
 */
function buildDataset(hotspots, coupling) {
  const couplingDegree = new Map()
  for (const link of coupling) {
    couplingDegree.set(link.source, (couplingDegree.get(link.source) || 0) + 1)
    couplingDegree.set(link.target, (couplingDegree.get(link.target) || 0) + 1)
  }

  const raw = hotspots.map(h => ({
    filename: h.filename,
    commitFrequency: h.commitCount,
    churn: h.totalChanges,
    ownershipConcentration: 1 / Math.max(1, h.authorCount), // inverted: 1 author -> 1.0, many authors -> small
    authorCount: h.authorCount, // kept for explanation text, not used as a model feature directly
    couplingDegree: couplingDegree.get(h.filename) || 0,
    fileAge: h.ageDays || 1,
    recentActivity: 1 / Math.max(1, h.daysSinceLastChange || 1),
    // Proxy label: was this file disproportionately touched in bugfix commits?
    bugfixRatio: h.commitCount > 0 ? (h.bugfixCommits || 0) / h.commitCount : 0,
  }))

  if (raw.length === 0) return null

  // Normalize each feature column independently
  const cols = {}
  for (const name of FEATURE_NAMES) {
    cols[name] = normalize(raw.map(r => r[name]))
  }

  const X = raw.map((_, i) => FEATURE_NAMES.map(name => cols[name][i]))
  // Label: top-tertile bugfix ratio -> positive class (1), rest -> negative (0)
  const bugfixRatios = raw.map(r => r.bugfixRatio)
  const sortedRatios = [...bugfixRatios].sort((a, b) => a - b)
  const threshold = sortedRatios[Math.floor(sortedRatios.length * 0.67)] || 0
  const y = bugfixRatios.map(r => (r > threshold && r > 0 ? 1 : 0))

  return { X, y, filenames: raw.map(r => r.filename), raw }
}

/**
 * Trains logistic regression via batch gradient descent.
 * Returns learned weights + bias, and training diagnostics.
 */
function trainLogisticRegression(X, y, { epochs = 300, learningRate = 0.5, l2 = 0.01 } = {}) {
  const n = X.length
  const d = X[0].length
  let weights = new Array(d).fill(0)
  let bias = 0

  const lossHistory = []

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradW = new Array(d).fill(0)
    let gradB = 0
    let loss = 0

    for (let i = 0; i < n; i++) {
      const z = X[i].reduce((sum, x, j) => sum + x * weights[j], bias)
      const pred = sigmoid(z)
      const error = pred - y[i]

      for (let j = 0; j < d; j++) gradW[j] += error * X[i][j]
      gradB += error

      const epsilon = 1e-9
      loss += -(y[i] * Math.log(pred + epsilon) + (1 - y[i]) * Math.log(1 - pred + epsilon))
    }

    for (let j = 0; j < d; j++) {
      weights[j] -= learningRate * (gradW[j] / n + l2 * weights[j])
    }
    bias -= learningRate * (gradB / n)

    if (epoch % 20 === 0 || epoch === epochs - 1) {
      lossHistory.push({ epoch, loss: loss / n })
    }
  }

  return { weights, bias, lossHistory }
}

/** Evaluates accuracy on a held-out test split. */
function evaluate(X, y, weights, bias) {
  let correct = 0
  for (let i = 0; i < X.length; i++) {
    const z = X[i].reduce((sum, x, j) => sum + x * weights[j], bias)
    const pred = sigmoid(z) >= 0.5 ? 1 : 0
    if (pred === y[i]) correct += 1
  }
  return X.length > 0 ? correct / X.length : 0
}

function riskCategory(probability) {
  if (probability >= 0.75) return { label: 'Critical', tone: 'danger' }
  if (probability >= 0.5) return { label: 'High', tone: 'warn' }
  if (probability >= 0.25) return { label: 'Medium', tone: 'info' }
  return { label: 'Low', tone: 'success' }
}

/** Human-readable explanation citing the strongest contributing features. */
function explainPrediction(featureVector, weights, raw) {
  const contributions = FEATURE_NAMES.map((name, i) => ({
    name,
    contribution: featureVector[i] * weights[i],
  })).sort((a, b) => b.contribution - a.contribution)

  const reasons = []
  const top = contributions.slice(0, 3).filter(c => c.contribution > 0.01)

  const labelMap = {
    commitFrequency: `Changed frequently (${raw.commitFrequency} commits)`,
    churn: `High line churn (${raw.churn} total line changes)`,
    ownershipConcentration: raw.authorCount === 1
      ? 'Touched by only one contributor — single point of knowledge failure'
      : `Concentrated ownership (${raw.authorCount} contributors)`,
    couplingDegree: 'Strongly coupled with other files (hidden dependency risk)',
    fileAge: `Long-lived file (${raw.fileAge} days old)`,
    recentActivity: 'Recently active — still under active modification',
  }

  for (const c of top) {
    reasons.push(labelMap[c.name])
  }

  if (reasons.length === 0) reasons.push('No single dominant risk factor — combination of moderate signals')

  return reasons
}

/**
 * Full pipeline: build dataset from analysis results, train/test split,
 * train logistic regression, score every hotspot, and attach explanations.
 *
 * Returns null if there isn't enough data to train meaningfully (this is
 * surfaced to the UI rather than faking a result).
 */
export function trainBugRiskModel(hotspots, coupling) {
  const dataset = buildDataset(hotspots, coupling)
  if (!dataset || dataset.X.length < 8) {
    return { trained: false, reason: 'Not enough files with sufficient commit history to train a model (need at least 8).' }
  }

  const { X, y, filenames, raw } = dataset

  // Train/test split (80/20), shuffled with a fixed seed pattern for reproducibility
  const indices = X.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor((i * 2654435761) % (i + 1)) // deterministic pseudo-shuffle, no Math.random dependency
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  const splitPoint = Math.max(1, Math.floor(X.length * 0.8))
  const trainIdx = indices.slice(0, splitPoint)
  const testIdx = indices.slice(splitPoint)

  const Xtrain = trainIdx.map(i => X[i])
  const ytrain = trainIdx.map(i => y[i])
  const Xtest = testIdx.map(i => X[i])
  const ytest = testIdx.map(i => y[i])

  const { weights, bias, lossHistory } = trainLogisticRegression(Xtrain, ytrain)

  const trainAccuracy = evaluate(Xtrain, ytrain, weights, bias)
  const testAccuracy = Xtest.length > 0 ? evaluate(Xtest, ytest, weights, bias) : null
  const positiveRate = y.reduce((a, b) => a + b, 0) / y.length

  // Score every file (not just the split) for the final report
  const predictions = X.map((featureVector, i) => {
    const z = featureVector.reduce((sum, x, j) => sum + x * weights[j], bias)
    const probability = sigmoid(z)
    const { label, tone } = riskCategory(probability)

    return {
      filename: filenames[i],
      riskScore: Math.round(probability * 100),
      riskLabel: label,
      tone,
      explanation: explainPrediction(featureVector, weights, raw[i]),
    }
  })

  predictions.sort((a, b) => b.riskScore - a.riskScore)

  return {
    trained: true,
    predictions,
    diagnostics: {
      trainAccuracy: Math.round(trainAccuracy * 100),
      testAccuracy: testAccuracy !== null ? Math.round(testAccuracy * 100) : null,
      trainSize: Xtrain.length,
      testSize: Xtest.length,
      positiveRatePct: Math.round(positiveRate * 100),
      lossHistory,
      featureWeights: FEATURE_NAMES.map((name, i) => ({ name, weight: Math.round(weights[i] * 1000) / 1000 })),
    },
    caveat: 'Trained on a proxy label (bugfix-commit pattern matching), not verified defect data. Read scores as "resembles historical bug-fix patterns," not a guarantee.',
  }
}
