/**
 * LeanVsSteerChart component — lean angle vs steer angle for all active setups.
 *
 * Uses Plotly.js (via react-plotly.js) to render a scientific line chart.
 * One curve per setup, each color-coded to match the setup's display color.
 * Hover readout shows exact lean/steer values.
 */

import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from '../models/BoardSetupConfig'
import { computePivotAxis } from '../geometry/pivotAxis'
import { returnKeyGeometryCurves, type KeyGeometryResult } from '../physics/keyGeometryDataSet'

/** Props for the LeanVsSteerChart component. */
interface LeanVsSteerChartProps {
  /** All active board setups. */
  setups: BoardSetupConfig[]
  /** Rider mass in kg. */
  riderMassKg?: number
  /** Rider center-of-mass height above ground in m. */
  comHeightM?: number
  /** Number of sample points per curve. */
  numSamples?: number
  /** ID of the highlighted setup (drawn on top, thicker). */
  activeSetupId?: string
  /** Pre-computed key geometry curves from parent (maxLeanDeg is the global DEFAULT_MAX_LEAN). */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
}

const DEFAULT_SAMPLES = 91

/**
 * LeanVsSteerChart — lean angle (x) vs steer angle (y), one curve per setup.
 *
 * @param props - Setup configurations and chart options.
 * @returns Plotly line chart.
 */
const LeanVsSteerChart: React.FC<LeanVsSteerChartProps> = ({
  setups,
  riderMassKg = 75,
  comHeightM = 1.0,
  numSamples = DEFAULT_SAMPLES,
  activeSetupId,
  keyGeometryCurves,
}) => {
  const traces = useMemo(() => {
    return setups.map(setup => {
      // Use pre-computed curves if available, otherwise compute locally
      const precomputedEntry = keyGeometryCurves?.find(k => k.setupId === setup.id)
      const maxLeanDeg = precomputedEntry?.maxLeanDeg ?? DEFAULT_MAX_LEAN
      const curve = precomputedEntry?.curve ?? returnKeyGeometryCurves(
        computePivotAxis(
          setup.frontTruck.pivotAxisAngle,
          setup.frontTruck.rake,
        ).direction,
        setup.frontTruck.pivotAxisAngle,
        setup.frontTruck.rake,
        setup.frontTruck.axleToBaseplateDistance,
        setup.frontTruck.baseplateToBoard,
        setup.frontTruck.roadsideBushing,
        setup.frontTruck.boardsideBushing,
        riderMassKg,
        comHeightM,
        -maxLeanDeg,
        maxLeanDeg,
        numSamples,
        setup.rearTruck.pivotAxisAngle,
        setup.rearTruck.rake,
        setup.wheelbase,
      )

      const isActive = setup.id === activeSetupId
      return {
        x: curve.map(r => r.leanAngleDeg),
        y: curve.map(r => -r.hangerRotationDeg),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: setup.name,
        line: {
          color: setup.color,
          width: isActive || !activeSetupId ? 2.5 : 1.5,
        },
        opacity: isActive || !activeSetupId ? 1 : 0.4,
        hovertemplate:
          `<b>${setup.name}</b><br>` +
          'Lean: %{x:.1f}°<br>' +
          'Steer: %{y:.2f}°<extra></extra>',
      }
    })
  }, [setups, riderMassKg, comHeightM, numSamples, activeSetupId, keyGeometryCurves])

  // Derive x-axis range from the keyGeometryCurves payload, falling back to DEFAULT_MAX_LEAN.
  const axisMaxLean = keyGeometryCurves?.[0]?.maxLeanDeg ?? DEFAULT_MAX_LEAN

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: 'Turn per Lean °/°',
          font: { color: '#94a3b8', size: 13 },
        },
        paper_bgcolor: '#0f172a',
        plot_bgcolor: '#0f172a',
        font: { color: '#94a3b8', size: 11 },
        xaxis: {
          title: { text: 'Lean [°])', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: '#64748b',
          range: [-axisMaxLean, axisMaxLean],
        },
        yaxis: {
          title: { text: 'Turn [°]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: '#64748b',
        },
        legend: {
          bgcolor: 'transparent',
          font: { color: '#94a3b8', size: 10 },
        },
        margin: { l: 50, r: 20, t: 40, b: 50 },
        hovermode: 'x unified',
      }}
      config={{
        displayModeBar: false,
        responsive: true,
      }}
      style={{ width: '100%', height: '100%' }}
      useResizeHandler
    />
  )
}

export default LeanVsSteerChart
