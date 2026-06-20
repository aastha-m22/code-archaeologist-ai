# 🔍 CodeArchaeologist AI

> **Every codebase has a story. We dig it up — from the commit history, not the code.**

CodeArchaeologist AI is a software forensics and repository intelligence platform that analyzes a GitHub repo's **version control history** (not its static code) to surface architectural hotspots, hidden coupling, knowledge silos, repository health, and bug-risk — then has an AI engineering consultant write up the findings.

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![D3](https://img.shields.io/badge/D3.js-7-F9A03C?logo=d3.js&logoColor=white)](https://d3js.org)
[![Groq](https://img.shields.io/badge/Groq-Llama_3.3_70B-F55036)](https://groq.com)

---

## 🧠 The idea

Most code analysis tools look at the code as it exists *right now* — linting, complexity metrics, dependency graphs from imports. That misses something important: **how the code actually got built**, who built which parts, and which files secretly depend on each other in ways no import statement reveals.

This is based on a real software engineering research technique sometimes called **"code as a crime scene"** (Adam Tornhill) — using git history forensically, extended here with a genuinely-trained ML risk layer:

- **Hidden coupling** — if `payment.js` and `email-templates/receipt.html` change together in 80% of commits, they're coupled even though nothing imports the other.
- **Hotspots** — files with high commit frequency *and* high line churn are statistically where bugs concentrate. The single best-validated heuristic in empirical SE literature for predicting defect-prone files.
- **Knowledge silos & bus factor** — files (or whole repos) overly dependent on one contributor are a continuity risk.
- **ML bug-risk scoring** — a logistic regression model, trained per-repo on that repo's own commit history, predicts which files most resemble historical bug-fix patterns.

---

## ✨ Features

| Feature | What it does |
|---|---|
| 💚 **Repository Health Score** | 0–100 score combining 5 weighted signals: hotspot density, churn stability, ownership diversity, coupling health, contributor diversity |
| 🚌 **Bus Factor Analysis** | Repo-level and per-file bus factor — how many contributors would need to leave before knowledge is critically lost |
| 🧠 **ML Bug-Risk Prediction** | Real logistic regression, trained via gradient descent on this repo's own history — not a static heuristic dressed up as ML |
| 📜 **Engineering Consultant narrative** | AI-generated findings citing specific files, percentages, and a prioritized action list — not generic praise |
| 🔗 **Risk-colored coupling graph** | Interactive D3 force-directed graph — node color = ML risk tier, size = hotspot severity |
| 🗺️ **Ownership heatmap** | Visual matrix of top contributors × top files |
| 📈 **Activity timeline** | Commit volume over time |
| 📊 **Tabbed dashboard** | Overview / Architecture / Risks / Trends — organized like a real SaaS analytics product |
| ⚙️ **Configurable analysis depth** | Choose 100 / 300 / 500 / 1000 commits, with automatic GitHub API pagination |
| 🔓 **Works without any keys** | Full analysis works with zero setup — GitHub token and Groq key are both optional |

---

## ⚠️ Methodology — what's genuinely real vs. a stated heuristic

This section exists because it's easy to dress up a hardcoded score as "AI" or "ML." Here's exactly what each component is:

| Component | What it actually is | Why |
|---|---|---|
| **Health Score** | A transparent, fixed-weight combination of 5 independently-computed sub-scores (see `src/utils/health.js`). **Not learned, not ML.** | Weights are a design decision, stated explicitly in code comments. This is the same approach CodeScene's "Code Health" uses — explainable by design, not a black box. |
| **Bus Factor** | A documented practical approximation: rank contributors by commit share, find the minimum count whose cumulative share exceeds 50%. | This is the standard proxy used by tools like `git-quick-stats` when per-line blame data isn't available (which it isn't, from the commits-list API used here). |
| **Bug-Risk Model** | A **genuinely trained logistic regression** — real gradient descent, real train/test split (80/20), real loss minimization (`src/utils/riskModel.js`). | **Important caveat, stated in the UI itself:** there is no real defect-tracking integration, so there's no ground truth like "this file caused production incident #4521." The training label is a **proxy**: commits whose message matches `fix\|bug\|crash\|...` are treated as bugfix commits, and files disproportionately touched in them get a positive label. This is a real, peer-reviewed technique in the empirical SE literature (related to the SZZ algorithm lineage) — but it is *not* verified defect data. Read risk scores as *"resembles historical bug-fix patterns,"* not a guarantee. |
| **Engineering Consultant narrative** | Llama 3.3 70B via Groq, prompted with the actual computed health/bus-factor/risk numbers and told to cite them. | Real LLM call, real data grounding — not a templated string. |

### Why not XGBoost / RandomForest / ARIMA / Prophet?

The original spec for this project asked for gradient-boosted trees and time-series forecasting. After analysis, these were deliberately **not** implemented, for an honest reason: a single repository's commit history typically yields 50–500 files — nowhere near enough labeled data to train a tree ensemble without either overfitting badly or requiring synthetic data that would make the "ML" cosmetic rather than real. A 6-feature logistic regression is the right-sized model for this data volume: genuinely trained, fully explainable via its learned weights, and honest about its limits. Time-series forecasting (ARIMA/Prophet) was skipped for the same reason — most repos don't have enough weekly commit history to forecast meaningfully, and a fake-looking trend line would be worse than no trend line.

---

## 🚀 Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/code-archaeologist.git
cd code-archaeologist
npm install
npm run dev
# → http://localhost:5173
```

Paste any public GitHub repo URL (e.g. `github.com/expressjs/express`), pick an analysis depth, and click Excavate.

### Optional: raise rate limits / enable AI narrative
- **GitHub token** (no scopes needed) — raises the API rate limit from 60 to 5,000 requests/hour. Get one at [github.com/settings/tokens](https://github.com/settings/tokens)
- **Groq API key** — enables the AI-written engineering consultant narrative. Free at [console.groq.com](https://console.groq.com/keys)

Both are entered in "advanced options" and stored only in your browser's `localStorage`.

---

## 📁 Project Structure

```
code-archaeologist/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx                       # Orchestration
    ├── App.css / index.css           # Dark forensic design system
    ├── hooks/
    │   └── useAnalysis.js            # Pipeline: fetch → analyze → score → train → narrate
    ├── utils/
    │   ├── github.js                  # GitHub API client, pagination, rate-limit handling
    │   ├── forensics.js                # Coupling, hotspots, silos, activity timeline
    │   ├── health.js                  # ★ Repository Health Score (weighted, explainable)
    │   ├── busFactor.js                # ★ Bus factor — repo-level and per-file
    │   ├── riskModel.js                # ★ Genuine ML — logistic regression, gradient descent
    │   └── narrative.js                # Groq "Engineering Consultant" prompt
    └── components/
        ├── RepoInput.jsx              # URL input + analysis-depth selector + advanced keys
        ├── LoadingState.jsx
        ├── DashboardTabs.jsx          # Overview / Architecture / Risks / Trends
        ├── ResultsDashboard.jsx       # Tab orchestration
        ├── HealthScoreCard.jsx        # Health ring + breakdown + strengths/risks
        ├── BusFactorPanel.jsx         # Bus factor number + contributor bars + SPOF files
        ├── RiskPredictionPanel.jsx    # ML predictions + explainability + model diagnostics
        ├── OwnershipHeatmap.jsx       # Contributor × file matrix
        ├── CouplingGraph.jsx          # D3 force-directed graph, risk-colored
        ├── HotspotsList.jsx
        ├── OwnershipSilos.jsx
        ├── ActivityTimeline.jsx
        ├── NarrativePanel.jsx
        └── ErrorState.jsx
```

---

## 🔬 How the algorithms work

**Coupling**: For every commit touching 2–20 files (outside that range is excluded as noise — merges, mass reformats), every file pair is counted as a co-occurrence. Strength is normalized by each file's total change count.

**Hotspot score**: `commitCount × log(totalLineChanges + 1)` — logarithmic dampening on churn prevents one huge refactor commit from dominating, while frequency is weighted linearly, matching the empirical pattern that recurring small edits predict defects better than one-off large ones.

**Repository Health**: Five sub-scores (hotspot density, churn stability via Gini-like concentration, ownership diversity, coupling health, contributor diversity), each 0–100, combined with fixed weights (25/20/20/20/15%). See `health.js` for the exact formulas.

**Bus Factor**: Contributors ranked by commit share; minimum count whose cumulative share exceeds 50% of total commits.

**Bug-Risk Model**: 6 features (commit frequency, churn, ownership concentration, coupling degree, file age, recency) min-max normalized, logistic regression trained via batch gradient descent (300 epochs, L2-regularized) on an 80/20 train/test split. The proxy label and its limitation are documented above and surfaced directly in the UI.

---

## 🌐 Deploy to Vercel

```bash
npx vercel
# Framework: Vite | Build: npm run build | Output: dist
```

No environment variables needed — all keys are entered client-side at runtime.

## 📦 Deploy to GitHub Pages

```bash
npm install --save-dev gh-pages
# Add to package.json: "deploy": "gh-pages -d dist", "predeploy": "npm run build"
npm run deploy
```

---

## 🔐 Security note

GitHub and Groq API calls are made directly from the browser. Both keys live only in the user's own `localStorage` — appropriate for a personal tool, but means the keys are visible in DevTools. For a multi-user production deployment, route both APIs through a backend proxy (e.g. a Vercel Edge Function) so server-side keys are never exposed to the client.

---

## 🗺️ Explicitly not implemented (and why)

Being upfront about scope, rather than faking these:

- **ARIMA / Prophet forecasting** — most repos lack enough weekly-granularity history to forecast meaningfully; a fabricated trend line would be worse than none.
- **XGBoost / RandomForest** — would need a backend runtime (Python/WASM) and meaningfully more training data than a single repo provides; see Methodology section above.
- **PDF / Markdown export** — straightforward to add, deprioritized for this pass in favor of getting the analytics correct.
- **Web Workers for background processing** — the sequential per-commit GitHub API fetch is the actual bottleneck (network-bound, not CPU-bound), so a Web Worker wouldn't meaningfully help without also solving the fetch concurrency, which risks hitting GitHub secondary rate limits.
- **Strict TypeScript migration** — the codebase is plain JS with JSDoc-style comments; a full migration was out of scope for this pass.

## 🗺️ Future improvements

- [ ] Backend proxy for secure multi-user deployment
- [ ] Concurrent (rate-limit-aware) commit fetching to speed up large-repo analysis
- [ ] PDF/Markdown/JSON export of the full report
- [ ] Function-level coupling (not just file-level) using AST diffing
- [ ] Support for GitLab and Bitbucket repos

---

## 📄 License

MIT

---

_Inspired by Adam Tornhill's research on software forensics and the CodeMaat / CodeScene approach to git-history mining._
