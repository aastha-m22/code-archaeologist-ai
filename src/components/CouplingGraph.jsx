import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

function shortenPath(filename, maxLen = 22) {
  if (filename.length <= maxLen) return filename
  const parts = filename.split('/')
  const base = parts[parts.length - 1]
  if (base.length >= maxLen - 3) return `…/${base.slice(-(maxLen - 3))}`
  return `…/${base}`
}

const RISK_COLOR_VAR = {
  Critical: '--ca-risk-critical',
  High: '--ca-risk-high',
  Medium: '--ca-risk-medium',
  Low: '--ca-risk-low',
}

export function CouplingGraph({ coupling, hotspots, riskModel }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [dimensions, setDimensions] = useState({ width: 700, height: 480 })

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect
      setDimensions({ width: Math.max(width, 320), height: 480 })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!coupling || coupling.length === 0 || !svgRef.current) return

    const { width, height } = dimensions
    const hotspotMap = new Map((hotspots || []).map(h => [h.filename, h]))
    const riskMap = new Map((riskModel?.trained ? riskModel.predictions : []).map(p => [p.filename, p]))

    // Build node list from unique files in the coupling links
    const nodeSet = new Set()
    coupling.forEach(l => { nodeSet.add(l.source); nodeSet.add(l.target) })
    const nodes = Array.from(nodeSet).map(filename => ({
      id: filename,
      hotspot: hotspotMap.get(filename) || null,
      risk: riskMap.get(filename) || null,
    }))

    const links = coupling.map(l => ({
      source: l.source,
      target: l.target,
      coOccurrences: l.coOccurrences,
      strength: l.strength,
    }))

    const maxCoOcc = Math.max(...links.map(l => l.coOccurrences), 1)
    const maxScore = Math.max(...nodes.map(n => n.hotspot?.score || 0), 1)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g')

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.4, 3])
      .on('zoom', (event) => g.attr('transform', event.transform))
    svg.call(zoom)

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => 70 + (1 - d.strength) * 60))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(22))

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'var(--ca-coupling-line)')
      .attr('stroke-opacity', d => 0.25 + (d.coOccurrences / maxCoOcc) * 0.55)
      .attr('stroke-width', d => 1 + (d.coOccurrences / maxCoOcc) * 3.5)

    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('r', d => 6 + (d.hotspot ? (d.hotspot.score / maxScore) * 12 : 0))
      .attr('fill', d => d.risk ? `var(${RISK_COLOR_VAR[d.risk.riskLabel]})` : 'var(--ca-node)')
      .attr('stroke', 'var(--ca-node-stroke)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null; d.fy = null
        })
      )
      .on('click', (event, d) => setSelectedNode(d))
      .on('mouseenter', function() { d3.select(this).attr('stroke-width', 3) })
      .on('mouseleave', function() { d3.select(this).attr('stroke-width', 1.5) })

    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .text(d => shortenPath(d.id))
      .attr('font-size', 9.5)
      .attr('fill', 'var(--ca-label)')
      .attr('text-anchor', 'middle')
      .attr('dy', d => -(8 + (d.hotspot ? (d.hotspot.score / maxScore) * 12 : 0)))
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y)

      label
        .attr('x', d => d.x)
        .attr('y', d => d.y)
    })

    return () => simulation.stop()
  }, [coupling, hotspots, riskModel, dimensions])

  if (!coupling || coupling.length === 0) {
    return (
      <div className="graph-empty">
        <p>No significant file coupling detected in this commit history.</p>
      </div>
    )
  }

  return (
    <div className="graph-wrap" ref={containerRef}>
      <svg ref={svgRef} className="graph-svg" />

      <div className="graph-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--ca-risk-critical)' }} /> Critical risk
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--ca-risk-high)' }} /> High risk
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: 'var(--ca-risk-medium)' }} /> Medium risk
        </div>
        <div className="legend-item">
          <span className="legend-dot legend-dot--node" /> Low / unscored
        </div>
        <div className="legend-item">
          <span className="legend-line" /> Coupling strength
        </div>
      </div>

      {selectedNode && (
        <div className="graph-tooltip" role="dialog" aria-label="File details">
          <button
            className="graph-tooltip-close"
            onClick={() => setSelectedNode(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="graph-tooltip-filename">{selectedNode.id}</div>
          {selectedNode.risk && (
            <div className={`graph-tooltip-risk graph-tooltip-risk--${selectedNode.risk.tone}`}>
              {selectedNode.risk.riskScore}% risk · {selectedNode.risk.riskLabel}
            </div>
          )}
          {selectedNode.hotspot ? (
            <div className="graph-tooltip-stats">
              <span>{selectedNode.hotspot.commitCount} commits</span>
              <span>{selectedNode.hotspot.totalChanges} line changes</span>
              <span>{selectedNode.hotspot.authorCount} contributors</span>
            </div>
          ) : (
            <div className="graph-tooltip-stats">
              <span>Coupled file — not a top hotspot</span>
            </div>
          )}
        </div>
      )}

      <p className="graph-hint">Drag nodes • scroll to zoom • click a node for details</p>
    </div>
  )
}
