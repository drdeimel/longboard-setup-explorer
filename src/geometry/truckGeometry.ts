/**
 * Centralized truck geometry computations for the Longboard Simulator.
 * 
 * ARCHITECTURAL GUIDELINE:
 * This file is the SINGLE SOURCE OF TRUTH for all derived, lean-independent truck geometry parameters.
 * View components (FrontView, SideView, TopView) MUST NOT perform their own mechanical or geometric
 * calculations. Instead, they should consume the outputs of the functions provided here, or the
 * precomputed curves generated from them.
 * 
 * This prevents divergence between views when the underlying mechanical model changes.
 * Any changes to geometry formulas MUST be made here and validated by unit tests.
 */

import { boardSurfaceHeight } from './pivotAxis'

/**
 * Computed static geometry parameters for a truck setup.
 */
export interface TruckGeometry {
  /** Vertical distance from axle center to board surface (mm). */
  dBoard: number
  /** Effective rotation center height from axle center (mm). */
  invPendulumHeight: number
  /** Y coordinate of the rotation center relative to axle (mm). */
  rotCenterY: number
}

/**
 * Compute static truck geometry parameters.
 *
 * ARCHITECTURAL GUIDELINE:
 * This is the SINGLE SOURCE OF TRUTH for lean-independent truck geometry.
 * Always use this function to compute `dBoard`, `invPendulumHeight`, and `rotCenterY`
 * to ensure consistency across all views and physics calculations.
 *
 * @param axleToBaseplateDistance - Vertical distance from axle to baseplate (mm).
 * @param baseplateToBoard - Vertical distance from baseplate to board bottom (mm).
 * @param boardThicknessMm - Global board thickness (mm).
 * @param rake - Rake distance (mm).
 * @param pivotAxisAngleDeg - Pivot axis angle (degrees).
 * @returns Computed static geometry parameters.
 */
export function computeTruckGeometry(
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  boardThicknessMm: number,
  rake: number,
  pivotAxisAngleDeg: number,
): TruckGeometry {
  const totalBaseplateToBoard = baseplateToBoard + boardThicknessMm
  const dBoard = boardSurfaceHeight(axleToBaseplateDistance, totalBaseplateToBoard)
  
  const pivotAxisAngleRad = (pivotAxisAngleDeg * Math.PI) / 180
  // Note: totalBaseplateToBoard already includes boardThicknessMm, so we don't add it again.
  const invPendulumHeight = axleToBaseplateDistance + totalBaseplateToBoard - rake / Math.cos(pivotAxisAngleRad)
  
  const rotCenterY = dBoard - invPendulumHeight

  return {
    dBoard,
    invPendulumHeight,
    rotCenterY,
  }
}
