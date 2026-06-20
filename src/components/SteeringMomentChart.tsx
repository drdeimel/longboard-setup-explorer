/**
 * SteeringMomentChart component — lateral force vs steering moment.
 *
 * Shows the steering moment as a function of lateral centripetal force
 * applied at the board surface, at a specified lean angle.
 * The slope of each curve equals the effective moment arm d_eff(φ).
 *
 * One curve per setup, color-coded by setup color.
 */

import React, { useMemo } from 'react'
import Plot from 'react-plotly.js'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { steeringMomentCurve, type SteeringMomentResult } from '../physics/lateralForce'
import { type KeyGeometryResult } from '../physics/keyGeometryDataSet'
import { UI_TEXT_MUTED, UI_TEXT_PRIMARY } from '../theme/uiColors'

/** Props for the SteeringMomentChart component. */
interface SteeringMomentChartProps {
  /** All active board setups. */
  setups: BoardSetupConfig[]
  /** Rider mass in kg. */
  riderMassKg?: number
  /** Rider center-of-mass height above ground in m. */
  comHeightM?: number
  /** Global board thickness in mm, added to baseplate-to-board distance. */
  boardThicknessMm?: number
  /** Board lean angle at which to evaluate the steering moment (degrees). */
  leanAngleDeg?: number
  /** Maximum lateral force to display (N). */
  maxForceN?: number
  /** Number of sample points. */
  numSamples?: number
  /** ID of the highlighted setup. */
  activeSetupId?: string
  /** Pre-computed key geometry curves from parent (maxLeanDeg is the global DEFAULT_MAX_LEAN). */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
}

const DEFAULT_LEAN_DEG = 0
const DEFAULT_MAX_FORCE_N = 500
const DEFAULT_SAMPLES = 101

/**
 * SteeringMomentChart — lateral force (x) vs steering moment (y) per setup.
 *
 * @param props - Setup configurations and chart options.
 * @returns Plotly line chart.
 */
const SteeringMomentChart: React.FC<SteeringMomentChartProps> = ({
  setups,
  riderMassKg = 75,
  comHeightM = 1.0,
  boardThicknessMm = 11,
  leanAngleDeg = DEFAULT_LEAN_DEG,
  maxForceN = DEFAULT_MAX_FORCE_N,
  numSamples = DEFAULT_SAMPLES,
  activeSetupId,
  keyGeometryCurves,
}) => {
  const traces = useMemo(() => {
    return setups.map(setup => {
      // keyGeometryCurves is used to trigger recomputation when config changes
      void keyGeometryCurves

      const truck = setup.frontTruck
      const curve: SteeringMomentResult[] = steeringMomentCurve(
        truck.pivotAxisAngle,
        truck.rake,
        truck.axleToBaseplateDistance,
        boardThicknessMm + truck.baseplateToBoard,
        leanAngleDeg,
        -maxForceN,
        maxForceN,
        numSamples,
      )
      const isActive = setup.id === activeSetupId
      return {
        x: curve.map(r => r.lateralForceN),
        y: curve.map(r => r.steeringMomentNmm / 1000), // N·m
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
          'F_lat: %{x:.0f} N<br>' +
          'M_steer: %{y:.3f} N·m<extra></extra>',
      }
    })
  }, [
    setups,
    riderMassKg,
    comHeightM,
    boardThicknessMm,
    leanAngleDeg,
    maxForceN,
    numSamples,
    activeSetupId,
    keyGeometryCurves,
  ])

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: `Steering Moment vs Lateral Force (φ=${leanAngleDeg}°)`,
          font: { color: UI_TEXT_PRIMARY, size: 13 },
        },
        paper_bgcolor: '#0f172a',
        plot_bgcolor: '#0f172a',
        font: { color: UI_TEXT_PRIMARY, size: 11 },
        xaxis: {
          title: { text: 'Lateral Force (N)', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
          range: [-maxForceN, maxForceN],
        },
        yaxis: {
          title: { text: 'Steering Moment (N·m)', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
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

export default SteeringMomentChart
