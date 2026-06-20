/**
 * Unit tests for centralized truck geometry computations.
 *
 * ARCHITECTURAL GUIDELINE:
 * These tests ensure that the centralized geometry calculations remain consistent
 * with the physics computations. Any changes to geometry formulas MUST be validated here.
 */

import { describe, it, expect } from 'vitest'
import { computeTruckGeometry } from '../truckGeometry'
import { computeInvPendulumHeight } from '../../physics/keyGeometryDataSet'

describe('computeTruckGeometry', () => {
  it('should compute consistent geometry parameters', () => {
    const axleToBaseplateDistance = 50
    const baseplateToBoard = 10
    const boardThicknessMm = 11
    const rake = 0
    const pivotAxisAngleDeg = 50

    const geom = computeTruckGeometry(
      axleToBaseplateDistance,
      baseplateToBoard,
      boardThicknessMm,
      rake,
      pivotAxisAngleDeg,
    )

    // Validate dBoard
    expect(geom.dBoard).toBe(axleToBaseplateDistance + baseplateToBoard + boardThicknessMm)

    // Validate invPendulumHeight matches the legacy physics function
    // Note: computeInvPendulumHeight was updated to NOT add boardThicknessMm again,
    // so we pass baseplateToBoard + boardThicknessMm as the second argument to match
    // the behavior expected by the caller (App.tsx).
    const expectedInvPendulumHeight = computeInvPendulumHeight(
      axleToBaseplateDistance,
      baseplateToBoard + boardThicknessMm,
      rake,
      pivotAxisAngleDeg,
    )
    expect(geom.invPendulumHeight).toBeCloseTo(expectedInvPendulumHeight, 5)

    // Validate rotCenterY
    expect(geom.rotCenterY).toBe(geom.dBoard - geom.invPendulumHeight)
  })

  it('should handle positive rake correctly', () => {
    const geom = computeTruckGeometry(50, 10, 11, 10, 50)
    // Positive rake should decrease the invPendulumHeight (move rotation center up relative to board)
    const geomNoRake = computeTruckGeometry(50, 10, 11, 0, 50)
    expect(geom.invPendulumHeight).toBeLessThan(geomNoRake.invPendulumHeight)
  })
})
