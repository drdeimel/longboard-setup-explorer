/**
 * LeanVsRotationalStiffnessChart component — lean angle vs rotational stiffness.
 *
 * Shows the rotational stiffness curve per setup.
 *
 * Global rider parameters (mass, CoM height) affect all setups equally.
 * Hover shows exact values.
 */

import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from '../models/BoardSetupConfig'
import { computePivotAxis } from '../geometry/pivotAxis'
import { returnKeyGeometryCurves, type KeyGeometryResult } from '../physics/keyGeometryDataSet'

/** Props for the LeanVsRotationalStiffnessChart. */
interface LeanVsRotationalStiffnessChartProps {
  /** All active board setups. */
  setups: BoardSetupConfig[]
  /** Rider mass in kg. */
  riderMassKg: number
  /** Rider center-of-mass height above ground in m. */
  comHeightM: number
  /** Global board thickness in mm, added to baseplate-to-board distance. */
  boardThicknessMm?: number
  /** Number of sample points per curve. */
  numSamples?: number
  /** ID of the highlighted setup. */
  activeSetupId?: string
  /** Pre-computed key geometry curves from parent (maxLeanDeg is the global DEFAULT_MAX_LEAN). */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
}

const DEFAULT_SAMPLES = 91

/**
 * LeanVsRotationalStiffnessChart — lean angle (x) vs rotational stiffness (y).
 *
 * @param props - Setup configurations, rider params, and chart options.
 * @returns Plotly line chart with rotational stiffness curves per setup.
 */
const LeanVsRotationalStiffnessChart: React.FC<LeanVsRotationalStiffnessChartProps> = ({
  setups,
  riderMassKg,
  comHeightM,
  boardThicknessMm = 11,
  numSamples = DEFAULT_SAMPLES,
  activeSetupId,
  keyGeometryCurves,
}) => {
  const traces = useMemo(() => {
    const allTraces: Plotly.Data[] = []

    setups.forEach(setup => {
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
        boardThicknessMm + setup.frontTruck.baseplateToBoard,
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
      const opacity = isActive || !activeSetupId ? 1 : 0.35

      // Net moment (solid, prominent)
      allTraces.push({
        x: curve.map(r => r.leanAngleDeg),
        y: curve.map(r => r.totalRotationalStiffness),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: `${setup.name} (net)`,
        line: { color: setup.color, width: isActive || !activeSetupId ? 2.5 : 1.5 },
        opacity,
        legendgroup: setup.id,
        hovertemplate:
          `<b>${setup.name}</b> Net<br>` +
          'Lean: %{x:.1f}°<br>' +
          'M_net: %{y:.3f} N·m<extra></extra>',
      })
    })

    return allTraces
  }, [setups, riderMassKg, comHeightM, boardThicknessMm, numSamples, activeSetupId, keyGeometryCurves])

  // Derive x-axis range from the keyGeometryCurves payload, falling back to DEFAULT_MAX_LEAN.
  const axisMaxLean = keyGeometryCurves?.[0]?.maxLeanDeg ?? DEFAULT_MAX_LEAN

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: 'Bushing Stiffness',
          font: { color: '#94a3b8', size: 13 },
        },
        paper_bgcolor: '#0f172a',
        plot_bgcolor: '#0f172a',
        font: { color: '#94a3b8', size: 11 },
        xaxis: {
          title: { text: 'Lean [°]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: '#64748b',
          range: [-axisMaxLean, axisMaxLean],
        },
        yaxis: {
          title: { text: 'Stiffness [Nm/°]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: '#64748b',
        },
        legend: {
          bgcolor: 'transparent',
          font: { color: '#94a3b8', size: 10 },
        },
        margin: { l: 55, r: 20, t: 40, b: 50 },
        hovermode: 'x unified',
        annotations: [
          {
            x: 0,
            y: 0,
            xref: 'paper',
            yref: 'paper',
            text: `Rider: ${riderMassKg}kg, CoM: ${comHeightM.toFixed(1)}m`,
            showarrow: false,
            font: { color: '#475569', size: 9 },
            xanchor: 'left',
            yanchor: 'bottom',
          },
        ],
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

export default LeanVsRotationalStiffnessChart
