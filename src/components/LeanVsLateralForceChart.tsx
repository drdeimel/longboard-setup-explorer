/**
 * LeanVsLateralForceChart — lean angle vs equilibrium lateral force.
 *
 * At each lean angle φ, shows the lateral force (N) at which the bushing
 * restoring torque exactly balances the steering moment produced by that
 * same force. This is the self-steering equilibrium point: the centripetal
 * force the truck "demands" to hold a steady carve at lean angle φ.
 *
 * Value from: KeyGeometryResult.lateralForceEquilibriumN
 */

import React from 'react'
import Plot from 'react-plotly.js'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from '../models/BoardSetupConfig'
import { type KeyGeometryResult } from '../physics/keyGeometryDataSet'
import { UI_TEXT_MUTED, UI_TEXT_PRIMARY } from '../theme/uiColors'

interface LeanVsLateralForceChartProps {
  setups: BoardSetupConfig[]
  activeSetupId?: string
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
}

const LeanVsLateralForceChart: React.FC<LeanVsLateralForceChartProps> = ({
  setups,
  activeSetupId,
  keyGeometryCurves,
}) => {
  const traces = setups.map(setup => {
    const entry = keyGeometryCurves?.find(k => k.setupId === setup.id)
    const curve = entry?.curve ?? []
    const isActive = setup.id === activeSetupId
    return {
      x: curve.map(r => -r.lateralForceEquilibriumN),
      y: curve.map(r => r.leanAngleDeg),
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
        'F_lat eq: %{x:.1f} N<br>' +
        'Lean: %{y:.1f}°<extra></extra>',
    }
  })

  const axisMaxLean = keyGeometryCurves?.[0]?.maxLeanDeg ?? DEFAULT_MAX_LEAN

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: 'Equilibrium Lateral Force vs Lean',
          font: { color: UI_TEXT_PRIMARY, size: 13 },
        },
        paper_bgcolor: '#0f172a',
        plot_bgcolor: '#0f172a',
        font: { color: UI_TEXT_PRIMARY, size: 11 },
        xaxis: {
          title: { text: 'Lateral Force [N]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
        },
        yaxis: {
          title: { text: 'Lean [°]', font: { size: 11 } },
          gridcolor: '#1e293b',
          zerolinecolor: '#334155',
          color: UI_TEXT_MUTED,
          range: [-axisMaxLean, axisMaxLean],
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

export default LeanVsLateralForceChart
