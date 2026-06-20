import { useMemo } from 'react'

/**
 * Builds a developer × file ownership matrix from raw commit data,
 * limited to the top N files (by total commits) and top M authors
 * (by total commits) to keep the heatmap legible.
 */
function buildMatrix(hotspots, busFactorContributors, maxFiles = 12, maxAuthors = 8) {
  const topFiles = hotspots.slice(0, maxFiles)
  const topAuthors = (busFactorContributors || []).slice(0, maxAuthors).map(c => c.author)

  return { topFiles, topAuthors }
}

function shortenPath(filename, maxLen = 24) {
  if (filename.length <= maxLen) return filename
  const parts = filename.split('/')
  const base = parts[parts.length - 1]
  return base.length >= maxLen - 2 ? `…${base.slice(-(maxLen - 2))}` : `…/${base}`
}

export function OwnershipHeatmap({ hotspots, busFactor }) {
  const { topFiles, topAuthors } = useMemo(
    () => buildMatrix(hotspots, busFactor?.topContributors),
    [hotspots, busFactor]
  )

  if (topFiles.length === 0 || topAuthors.length === 0) {
    return <p className="panel-empty">Not enough data to build an ownership heatmap.</p>
  }

  // For each file, find which authors are in its author list and approximate intensity
  // by whether that author touched the file at all (we don't have per-file-per-author
  // commit counts cached on the hotspot object, so this renders presence, not weighted intensity).
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-scroll">
        <table className="heatmap-table">
          <thead>
            <tr>
              <th className="heatmap-corner" />
              {topAuthors.map(author => (
                <th key={author} className="heatmap-author-header" title={author}>
                  <span>{author.length > 10 ? author.slice(0, 9) + '…' : author}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topFiles.map(file => (
              <tr key={file.filename}>
                <th className="heatmap-file-header" title={file.filename}>
                  {shortenPath(file.filename)}
                </th>
                {topAuthors.map(author => {
                  const touched = file.authors?.includes(author)
                  return (
                    <td key={author} className="heatmap-cell">
                      {touched && <span className="heatmap-dot" />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="heatmap-hint">
        Each dot means that contributor has committed to that file. Rows with very few dots
        relative to the file's total commits indicate concentrated ownership.
      </p>
    </div>
  )
}
