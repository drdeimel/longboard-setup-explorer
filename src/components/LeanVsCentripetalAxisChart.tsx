/**
 * LeanVsCentripetalAxisChart component — lean angle vs centripetal axis position.
 *
 * Shows the X coordinate of the Instantaneous Center of Rotation (ICR) as a
 * function of board lean angle. The ICR X position describes where, along the
 * board's rolling axis, the centripetal force is effectively applied.
 *
 * Positive X is forward (board rolling direction). Null ICR values (parallel
 * trucks) are omitted from each curve.
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

/** Props for the LeanVsCentripetalAxisChart component. */
interface LeanVsCentripetalAxisChartProps {
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
 * LeanVsCentripetalAxisChart — lean angle (x) vs ICR X position (y).
 *
 * Points where the ICR is undefined (parallel trucks → no turning center) are
 * excluded from each trace.
 *
 * @param props - Setup configurations and chart options.
 * @returns Plotly line chart.
 */
const LeanVsCentripetalAxisChart: React.FC<LeanVsCentripetalAxisChartProps> = ({
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

      // Filter out null ICR points (parallel trucks)
      const filtered = curve.filter(
        (r): r is KeyGeometryResult & { turningCenterX: number } => r.turningCenterX !== null,
      )
      const isActive = setup.id === activeSetupId
      const opacity = isActive || !activeSetupId ? 1 : 0.35

      allTraces.push({
        x: filtered.map(r => r.leanAngleDeg),
        y: filtered.map(r => -r.turningCenterX),
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
          'ICR X: %{y:.0f} mm<extra></extra>',
      })
    })

    return allTraces
  }, [setups, riderMassKg, comHeightM, boardThicknessMm, numSamples, activeSetupId, keyGeometryCurves])

  // Derive x-axis range from the keyGeometryCurves payload, falling back to DEFAULT_MAX_LEAN.
  const axisMaxLean = keyGeometryCurves?.[0]?.maxLeanDeg ?? DEFAULT_MAX_LEAN
  const wheelbase = setups[0]?.wheelbase ?? 600 // default fallback

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: 'Center of Stiffness',
          font: { color: UI_TEXT_PRIMARY, size: 13 },
        },
        paper_bgcolor: '#0f172a',
        plot_bgcolor: '#0f172a',
        font: { color: UI_TEXT_PRIMARY, size: 11 },
        xaxis: {
          title: { text: 'Lean Angle [°]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
          range: [-axisMaxLean, axisMaxLean],
        },
        yaxis: {
          title: { text: 'Behind Front truck [mm]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
          range: [-wheelbase, 0],
        },
        legend: {
          bgcolor: 'transparent',
          font: { color: UI_TEXT_PRIMARY, size: 10 },
        },
        margin: { l: 65, r: 20, t: 40, b: 50 },
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

export default LeanVsCentripetalAxisChart
