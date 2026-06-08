/**
 * Integration tests for the Longboard Simulator truck computation.
 *
 * These tests verify consistency across the full computation pipeline:
 *   pivot axis → lean-to-steer → bushing torque → key geometry → ICR
 *
 * They ensure that the various modules work together correctly and that
 * the end-to-end truck behavior is physically consistent.
 */

import { describe, it, expect } from 'vitest'
import { computePivotAxis } from '../../geometry/pivotAxis'
import { computeLeanToSteer } from '../../geometry/leanToSteer'
import { computeICR } from '../../geometry/turningCenter'
import { computeKeyGeometry, returnKeyGeometryCurves } from '../keyGeometryDataSet'
import { bushingTorque, combinedBushingTorque, bushingMaxAngle } from '../bushingModels'
import { computeSteeringMoment, centripetalForce } from '../lateralForce'
import type { BushingConfig } from '../../models/BushingConfig'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPS = 1e-6

function approx(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps
}

const barrelStd: BushingConfig = { shape: 'barrel', durometer: 90, height: 'standard' }
const coneStd: BushingConfig = { shape: 'cone', durometer: 90, height: 'standard' }

// ---------------------------------------------------------------------------
// Integration: Full truck computation pipeline consistency
// ---------------------------------------------------------------------------

describe('Integration: Full truck pipeline', () => {
  const pivotAngle = 50
  const rake = 0
  const axleToBaseplate = 38
  const baseplateToBoard = 4
  const rearPivotAngle = 47
  const rearRake = 0
  const wheelbase = 760
  const riderMass = 75

  it('Lean-to-steer from pivot axis matches ICR steer angle', () => {
    // The steer angle computed via computeLeanToSteer should match
    // the steer angle returned by computeICR for the same truck geometry
    const { direction: frontAxisDir } = computePivotAxis(pivotAngle, rake)
    const { direction: rearAxisDir } = computePivotAxis(rearPivotAngle, rearRake)

    for (const lean of [-30, -15, 0, 15, 30]) {
      const frontLts = computeLeanToSteer(frontAxisDir, lean)
      const rearLts = computeLeanToSteer(rearAxisDir, lean)
      const icr = computeICR(pivotAngle, rake, rearPivotAngle, rearRake, wheelbase, lean)

      expect(approx(frontLts.steerAngleDeg, icr.frontSteerDeg, 1e-10)).toBe(true)
      expect(approx(rearLts.steerAngleDeg, icr.rearSteerDeg, 1e-10)).toBe(true)
    }
  })

  it('Key geometry bushing torque matches direct bushing computation', () => {
    const { direction: pivotDir } = computePivotAxis(pivotAngle, rake)

    for (const lean of [-25, -10, 0, 10, 25]) {
      const lts = computeLeanToSteer(pivotDir, lean)
      const directTorque = combinedBushingTorque(barrelStd, barrelStd, lts.hangerRotationDeg)
      const kgResult = computeKeyGeometry(
        pivotDir, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
        barrelStd, barrelStd, riderMass, 1.0, lean,
        rearPivotAngle, rearRake, wheelbase,
      )

      expect(approx(kgResult.bushingTorqueNm, directTorque, 1e-8)).toBe(true)
    }
  })

  it('Key geometry hanger rotation matches lean-to-steer result', () => {
    const { direction: pivotDir } = computePivotAxis(pivotAngle, rake)

    for (const lean of [-40, -20, 0, 20, 40]) {
      const lts = computeLeanToSteer(pivotDir, lean)
      const kgResult = computeKeyGeometry(
        pivotDir, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
        barrelStd, barrelStd, riderMass, 1.0, lean,
        rearPivotAngle, rearRake, wheelbase,
      )

      expect(approx(kgResult.hangerRotationDeg, lts.hangerRotationDeg, 1e-10)).toBe(true)
    }
  })

  it('Key geometry curve produces consistent results across lean range', () => {
    const { direction: pivotDir } = computePivotAxis(pivotAngle, rake)
    const curve = returnKeyGeometryCurves(
      pivotDir, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrelStd, barrelStd, riderMass, 1.0,
      -40, 40, 81,
      rearPivotAngle, rearRake, wheelbase,
    )

    expect(curve).toHaveLength(81)

    // Verify each sample is internally consistent
    for (const sample of curve) {
      // Bushing torque should be finite
      expect(isFinite(sample.bushingTorqueNm)).toBe(true)

      // Hanger rotation should be finite
      expect(isFinite(sample.hangerRotationDeg)).toBe(true)

      // If ICR exists, coordinates should be finite
      if (sample.turningCenterX !== null) {
        expect(isFinite(sample.turningCenterX)).toBe(true)
      }
      if (sample.turningCenterZ !== null) {
        expect(isFinite(sample.turningCenterZ)).toBe(true)
      }
    }

    // Verify anti-symmetry of bushing torque for symmetric trucks at zero lean
    const zeroLeanSample = curve.find((s) => Math.abs(s.leanAngleDeg) < 0.01)
    expect(zeroLeanSample).toBeDefined()
    if (zeroLeanSample) {
      expect(approx(zeroLeanSample.bushingTorqueNm, 0, 1e-5)).toBe(true)
    }
  })

  it('Steering moment is consistent with rotation axis distance', () => {
    const lateralForce = 200 // N

    for (const lean of [-30, -15, 0, 15, 30]) {
      const smResult = computeSteeringMoment(
        lateralForce, pivotAngle, rake, axleToBaseplate, baseplateToBoard, lean,
      )

      // Steering moment should equal force × effective arm
      expect(approx(smResult.steeringMomentNmm, lateralForce * smResult.effectiveMomentArmMm, 1e-8)).toBe(true)

      // Effective moment arm should be non-negative
      expect(smResult.effectiveMomentArmMm).toBeGreaterThanOrEqual(0)
    }
  })

  it('Centripetal force produces reasonable steering moments at speed', () => {
    const speed = 8 // m/s (~29 km/h)
    const radius = 15 // m

    const lateralForce = centripetalForce(riderMass, speed, radius)
    expect(lateralForce).toBeGreaterThan(0)

    // F = m * v² / r = 75 * 64 / 15 = 320 N
    expect(approx(lateralForce, 320, 1)).toBe(true)

    const smResult = computeSteeringMoment(
      lateralForce, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 15,
    )

    // Should produce a non-zero steering moment
    expect(Math.abs(smResult.steeringMomentNmm)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Integration: Cross-truck consistency
// ---------------------------------------------------------------------------

describe('Integration: Cross-truck consistency', () => {
  const axleToBaseplate = 38
  const baseplateToBoard = 4
  const wheelbase = 760
  const riderMass = 75

  it('Identical front and rear trucks produce identical steer angles', () => {
    const pivotAngle = 50
    const rake = 0

    for (const lean of [-30, -15, 0, 15, 30]) {
      const icr = computeICR(pivotAngle, rake, pivotAngle, rake, wheelbase, lean)
      expect(approx(icr.frontSteerDeg, icr.rearSteerDeg, 1e-10)).toBe(true)
    }
  })

  it('Higher pivot angle produces higher steer angle for same lean', () => {
    const rake = 0
    const lean = 25

    const lowAngle = computeICR(45, rake, 45, rake, wheelbase, lean)
    const highAngle = computeICR(55, rake, 55, rake, wheelbase, lean)

    // Higher pivot angle should produce more steering
    expect(Math.abs(highAngle.frontSteerDeg)).toBeGreaterThan(Math.abs(lowAngle.frontSteerDeg))
  })

  it('Rake does not affect steer angle (lean-to-steer uses only pivot axis direction)', () => {
    // The current computeLeanToSteer only uses the direction vector, not the point.
    // Rake affects the point on the pivot axis but not its direction.
    // Therefore, steer angles should be identical regardless of rake.
    const pivotAngle = 50
    const lean = 25

    const zeroRake = computeICR(pivotAngle, 0, pivotAngle, 0, wheelbase, lean)
    const positiveRake = computeICR(pivotAngle, 15, pivotAngle, 15, wheelbase, lean)

    // Steer angles should be the same since direction is unchanged
    expect(approx(positiveRake.frontSteerDeg, zeroRake.frontSteerDeg, 1e-10)).toBe(true)
  })

  it('Different durometer bushings produce different torque magnitude but still anti-symmetric curve', () => {
    const { direction: pivotDir } = computePivotAxis(50, 0)

    // Use significantly different durometers
    const softBushing: BushingConfig = { shape: 'barrel', durometer: 75, height: 'standard' }
    const hardBushing: BushingConfig = { shape: 'barrel', durometer: 97, height: 'standard' }

    // Same bushings on both sides → anti-symmetric curve
    const symmetricCurve = returnKeyGeometryCurves(
      pivotDir, 50, 0, axleToBaseplate, baseplateToBoard,
      barrelStd, barrelStd, riderMass, 1.0,
      -30, 30, 61,
      47, 0, wheelbase,
    )

    // Different bushings → still anti-symmetric because both bushings see same angle
    const asymmetricCurve = returnKeyGeometryCurves(
      pivotDir, 50, 0, axleToBaseplate, baseplateToBoard,
      softBushing, hardBushing, riderMass, 1.0,
      -30, 30, 61,
      47, 0, wheelbase,
    )

    // Both curves should be anti-symmetric (T(-θ) = -T(θ))
    const n = symmetricCurve.length
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const posIdx = n - 1 - i
      const negIdx = i
      expect(
        approx(symmetricCurve[posIdx].bushingTorqueNm, -symmetricCurve[negIdx].bushingTorqueNm, 1e-5),
      ).toBe(true)
      expect(
        approx(asymmetricCurve[posIdx].bushingTorqueNm, -asymmetricCurve[negIdx].bushingTorqueNm, 1e-5),
      ).toBe(true)
    }

    // But the magnitudes should differ (harder bushings → more torque)
    const midIdx = Math.floor(n * 0.75) // sample at ~75% of range
    expect(Math.abs(asymmetricCurve[midIdx].bushingTorqueNm)).not.toBe(
      Math.abs(symmetricCurve[midIdx].bushingTorqueNm),
    )
  })
})

// ---------------------------------------------------------------------------
// Integration: Physical invariants
// ---------------------------------------------------------------------------

describe('Integration: Physical invariants', () => {
  const pivotAngle = 50
  const rake = 0
  const axleToBaseplate = 38
  const baseplateToBoard = 4
  const rearPivotAngle = 47
  const rearRake = 0
  const wheelbase = 760

  it('Bushing torque never exceeds physical limits within normal lean range', () => {
    const { direction: pivotDir } = computePivotAxis(pivotAngle, rake)
    const maxAngle = bushingMaxAngle(barrelStd)

    for (const lean of [-40, -30, -20, -10, 0, 10, 20, 30, 40]) {
      const kgResult = computeKeyGeometry(
        pivotDir, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
        barrelStd, barrelStd, 75, 1.0, lean,
        rearPivotAngle, rearRake, wheelbase,
      )

      // Hanger rotation should not exceed bushing max angle by more than a reasonable margin
      expect(Math.abs(kgResult.hangerRotationDeg)).toBeLessThan(maxAngle + 20)

      // Bushing torque should be finite and reasonable (< 10 N·m = 10000 N·mm)
      expect(Math.abs(kgResult.bushingTorqueNm)).toBeLessThan(10000)
    }
  })

  it('Turning curvature increases with lean angle (tighter turns at more lean)', () => {
    for (const lean of [5, 10, 15, 20, 25, 30]) {
      const icrSmall = computeICR(pivotAngle, rake, rearPivotAngle, rearRake, wheelbase, lean - 5)
      const icrLarge = computeICR(pivotAngle, rake, rearPivotAngle, rearRake, wheelbase, lean)

      if (icrSmall.turningCurvature !== 0 && icrLarge.turningCurvature !== 0) {
        // Higher lean should produce higher curvature (tighter turn)
        expect(Math.abs(icrLarge.turningCurvature)).toBeGreaterThanOrEqual(
          Math.abs(icrSmall.turningCurvature),
        )
      }
    }
  })

  it('Zero lean always produces zero steering regardless of truck setup', () => {
    const setups = [
      { front: 50, frontRake: 0, rear: 50, rearRake: 0 },
      { front: 50, frontRake: 10, rear: 47, rearRake: 5 },
      { front: 45, frontRake: 0, rear: 45, rearRake: 0 },
      { front: 55, frontRake: -5, rear: 50, rearRake: 0 },
    ]

    for (const setup of setups) {
      const icr = computeICR(setup.front, setup.frontRake, setup.rear, setup.rearRake, wheelbase, 0)
      expect(icr.frontSteerDeg).toBeCloseTo(0, 10)
      expect(icr.rearSteerDeg).toBeCloseTo(0, 10)
      expect(icr.icr).toBeNull()
      expect(icr.turningCurvature).toBe(0)
    }
  })
})
