/**
 * DerivedParams component — color-coded reactive parameter table.
 *
 * Displays computed derived parameters for each active setup:
 * - Inverted pendulum height h_pendulum = axleToBoardDistance + wheelDiameter/2
 * - Lean-to-steer leverage at 0° lean (dδ/dφ|₀, dimensionless °/°)
 * - Contact patch lateral rate at 0° lean d(z_contact)/dφ|₀ (mm/°)
 *
 * Values update reactively whenever the setup parameters change.
 * Each row is color-coded to match the setup's display color.
 */

import React, { useMemo } from 'react'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { computePivotAxis, boardSurfaceHeight } from '../geometry/pivotAxis'
import { computeLeanToSteer } from '../geometry/leanToSteer'
import type { KeyGeometryResult } from '../physics/keyGeometryDataSet'

/** Props for the DerivedParams component. */
interface DerivedParamsProps {
  /** All active board setups. */
  setups: BoardSetupConfig[]
  /** ID of the currently highlighted setup (for visual emphasis). */
  activeSetupId?: string
  /** Pre-computed key geometry curves from parent (maxLeanDeg is the global DEFAULT_MAX_LEAN). */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
}

/**
 * Compute the lean-to-steer leverage at 0° lean via numerical differentiation.
 * Uses a small perturbation δφ = 0.1° to estimate the derivative.
 *
 * @param setup - Board setup configuration.
 * @returns dδ/dφ at φ=0, in degrees of steer per degree of lean.
 */
function computeLeanToSteerLeverage(setup: BoardSetupConfig): number {
  const { direction } = computePivotAxis(
    setup.frontTruck.pivotAxisAngle,
    setup.frontTruck.rake,
  )
  const delta = 0.1 // degrees
  const r1 = computeLeanToSteer(direction, delta)
  const r2 = computeLeanToSteer(direction, -delta)
  return (r1.steerAngleDeg - r2.steerAngleDeg) / (2 * delta)
}

/**
 * Compute the contact patch lateral rate at 0° lean.
 *
 * The contact patch location in Z at lean angle φ combines:
 * 1. Pure lean effect: the wheel tilts, rotating the contact point by r_wheel * sin(φ)
 *    → z_contact due to pure lean = r_wheel * sin(φ)  (moves toward +Z for +φ lean)
 * 2. Rake-induced axle shift: the hanger rotation θ(φ) causes the axle to shift
 *    laterally by rake * (1 - cos(hanger_rotation)) approximately.
 *    This is small for typical rake values at 0° lean.
 *
 * The derivative is computed numerically.
 *
 * @param setup - Board setup configuration.
 * @returns d(z_contact)/dφ at φ=0, in mm per degree.
 */
function computeContactPatchLateralRate(setup: BoardSetupConfig): number {
  const truck = setup.frontTruck
  const { direction } = computePivotAxis(truck.pivotAxisAngle, truck.rake)
  const delta = 0.1

  const zContact = (leanDeg: number): number => {
    const leanRad = (leanDeg * Math.PI) / 180
    // Contact patch Z = lateral shift due to wheel lean
    const zLean = truck.wheelDiameter / 2 * Math.sin(leanRad)
    // Additional Z shift from axle rotation (rake effect)
    const { hangerRotationDeg } = computeLeanToSteer(direction, leanDeg)
    const hangerRad = (hangerRotationDeg * Math.PI) / 180
    // Rake causes a small lateral shift when hanger rotates
    const zRake = truck.rake * (1 - Math.cos(hangerRad))
    return zLean + zRake
  }

  return (zContact(delta) - zContact(-delta)) / (2 * delta)
}

/**
 * DerivedParams — color-coded reactive derived parameter table.
 *
 * @param props - Active setups and currently highlighted setup ID.
 * @returns Table of computed parameters per setup.
 */
const DerivedParams: React.FC<DerivedParamsProps> = ({ setups, activeSetupId, keyGeometryCurves }) => {
  const params = useMemo(
    () =>
      setups.map(setup => {
        const truck = setup.frontTruck
        const hPendulum = boardSurfaceHeight(
          truck.axleToBaseplateDistance,
          truck.baseplateToBoard,
        ) + truck.wheelDiameter / 2

        const leverage = computeLeanToSteerLeverage(setup)
        const lateralRate = computeContactPatchLateralRate(setup)

        // Get Felt truck height from keyGeometryCurves at 0° lean
        let feltTruckHeight: number | undefined = undefined
        if (keyGeometryCurves) {
          const curve = keyGeometryCurves.find(k => k.setupId === setup.id)?.curve
          if (curve && curve.length > 0) {
            // Find the entry closest to 0° lean
            const zeroEntry = curve.find(r => r.leanAngleDeg === 0)
            if (zeroEntry) {
              feltTruckHeight = zeroEntry.invPendulumHeight
            }
          }
        }

        return {
          setup,
          hPendulum: Math.round(hPendulum * 10) / 10,
          leverage: Math.round(leverage * 1000) / 1000,
          lateralRate: Math.round(lateralRate * 1000) / 1000,
          feltTruckHeight: feltTruckHeight !== undefined ? Math.round(feltTruckHeight * 10) / 10 : undefined,
        }
      }),
    [setups, keyGeometryCurves],
  )

  return (
    <div className="rounded-md bg-slate-900 border border-slate-700 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700">
        <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
          Derived Parameters
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-3 py-2 text-slate-300 font-normal">Setup</th>
              <th
                className="text-right px-2 py-2 text-slate-300 font-normal"
                title="Felt truck height = effective rotation center height (mm)"
              >
                Felt truck (mm)
              </th>
              <th
                className="text-right px-2 py-2 text-slate-300 font-normal"
                title="Inverted pendulum height = board surface height + wheel radius (mm)"
              >
                h_pend (mm)
              </th>
              <th
                className="text-right px-2 py-2 text-slate-300 font-normal"
                title="Lean-to-steer leverage at 0° lean (°steer / °lean)"
              >
                δ/φ|₀ (°/°)
              </th>
              <th
                className="text-right px-3 py-2 text-slate-300 font-normal"
                title="Contact patch lateral rate at 0° lean (mm/°)"
              >
                dz/dφ|₀ (mm/°)
              </th>
            </tr>
          </thead>
          <tbody>
            {params.map(({ setup, hPendulum, leverage, lateralRate, feltTruckHeight }) => {
              const isActive = setup.id === activeSetupId
              return (
                <tr
                  key={setup.id}
                  className={`border-b border-slate-800 last:border-0 transition-colors ${
                    isActive ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <td className="px-3 py-2 flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: setup.color }}
                    />
                    <span className="text-slate-300 truncate max-w-24" title={setup.name}>
                      {setup.name}
                    </span>
                  </td>
                  <td
                    className="text-right px-2 py-2 font-mono"
                    style={{ color: setup.color }}
                  >
                    {feltTruckHeight !== undefined ? feltTruckHeight : '-'}
                  </td>
                  <td
                    className="text-right px-2 py-2 font-mono"
                    style={{ color: setup.color }}
                  >
                    {hPendulum}
                  </td>
                  <td
                    className="text-right px-2 py-2 font-mono"
                    style={{ color: setup.color }}
                  >
                    {leverage.toFixed(3)}
                  </td>
                  <td
                    className="text-right px-3 py-2 font-mono"
                    style={{ color: setup.color }}
                  >
                    {lateralRate.toFixed(3)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DerivedParams
