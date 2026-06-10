/**
 * LeanVsBushingTorqueChart component — lean angle vs bushing torque.
 *
 * Shows how the bushing torque changes as a function of lean angle.
 *
 * One curve per setup, color-coded by setup color.
 */

import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from '../models/BoardSetupConfig'
import { computePivotAxis } from '../geometry/pivotAxis'
import { returnKeyGeometryCurves, type KeyGeometryResult } from '../physics/keyGeometryDataSet'
import { UI_TEXT_MUTED, UI_TEXT_PRIMARY } from '../theme/uiColors'

/** Props for the LeanVsBushingTorqueChart component. */
interface LeanVsBushingTorqueChartProps {
  /** All active board setups. */
  setups: BoardSetupConfig[]
  /** Rider mass in kg. */
  riderMassKg: number
  /** Rider center-of-mass height above ground in m. */
  comHeightM: number
  /** Global board thickness in mm, added to baseplate-to-board distance. */
  boardThicknessMm?: number
  /** Number of sample points. */
  numSamples?: number
  /** ID of the highlighted setup. */
  activeSetupId?: string
  /** Pre-computed key geometry curves from parent (maxLeanDeg is the global DEFAULT_MAX_LEAN). */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
}

const DEFAULT_SAMPLES = 91

/**
 * LeanVsBushingTorqueChart — lean angle (x) vs bushing torque (y).
 *
 * @param props - Setup configurations and chart options.
 * @returns Plotly line chart.
 */
const LeanVsBushingTorqueChart: React.FC<LeanVsBushingTorqueChartProps> = ({
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

      allTraces.push({
        x: curve.map(r => r.leanAngleDeg),
        y: curve.map(r => r.bushingTorqueNm),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: setup.name,
        line: {
          color: setup.color,
          width: isActive || !activeSetupId ? 2.5 : 1.5,
        },
        opacity,
        hovertemplate:
          `<b>${setup.name}</b><br>` +
          'Lean: %{x:.1f}°<br>' +
          'M_bushing: %{y:.3f} N·m<extra></extra>',
      })
    })

    return allTraces
  }, [setups, riderMassKg, comHeightM, boardThicknessMm, numSamples, activeSetupId, keyGeometryCurves])

  // Derive x-axis range from the keyGeometryCurves payload, falling back to DEFAULT_MAX_LEAN.
  const axisMaxLean = keyGeometryCurves?.[0]?.maxLeanDeg ?? DEFAULT_MAX_LEAN
  // Y-axis range: ±(riderWeight * boardWidth / 2) in Nm
  const riderWeightN = riderMassKg * 9.81
  const yAxisMax = (riderWeightN * 235 / 2) / 1000 // convert N·mm to Nm

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: 'Bushing Torque',
          font: { color: UI_TEXT_PRIMARY, size: 13 },
        },
        paper_bgcolor: '#0f172a',
        plot_bgcolor: '#0f172a',
        font: { color: UI_TEXT_PRIMARY, size: 11 },
        xaxis: {
          title: { text: 'Lean [°]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
          range: [-axisMaxLean, axisMaxLean],
        },
        yaxis: {
          title: { text: 'Bushing Torque [Nm]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
          range: [-yAxisMax, yAxisMax],
        },
        legend: {
          bgcolor: 'transparent',
          font: { color: UI_TEXT_PRIMARY, size: 10 },
        },
        margin: { l: 55, r: 20, t: 40, b: 50 },
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

export default LeanVsBushingTorqueChart
