/**
 * Regression tests for the Longboard Simulator truck computation.
 *
 * These tests capture the current behavior of the truck computation pipeline
 * at specific configuration points. They serve as a safety net to detect
 * unintended changes in truck behavior caused by code modifications.
 *
 * Each test records expected output values for a given input configuration.
 * If any of these values change, it indicates a behavioral regression that
 * should be reviewed.
 *
 * All angles in degrees, distances in mm, torques in N·mm, forces in N.
 */

import { describe, it, expect } from 'vitest'
import { computePivotAxis } from '../../geometry/pivotAxis'
import { computeLeanToSteer } from '../../geometry/leanToSteer'
import { computeICR } from '../../geometry/turningCenter'
import { computeKeyGeometry, returnKeyGeometryCurves } from '../keyGeometryDataSet'
import { bushingTorque, combinedBushingTorque, bushingBaseStiffness } from '../bushingModels'
import { computeSteeringMoment, centripetalForce } from '../lateralForce'
import type { BushingConfig } from '../../models/BushingConfig'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const barrel90: BushingConfig = { shape: 'barrel', durometer: 90, height: 'standard' }
const cone90: BushingConfig = { shape: 'cone', durometer: 90, height: 'standard' }
const barrel75: BushingConfig = { shape: 'barrel', durometer: 75, height: 'standard' }
const barrel97: BushingConfig = { shape: 'barrel', durometer: 97, height: 'standard' }

// ---------------------------------------------------------------------------
// Regression: Bushing model baseline values
// ---------------------------------------------------------------------------

describe('Regression: Bushing model baseline values', () => {
  it('Barrel 90A base stiffness is 0.3 N·mm/deg', () => {
    expect(bushingBaseStiffness(barrel90)).toBeCloseTo(0.3, 10)
  })

  it('Cone 90A base stiffness is 0.3 N·mm/deg', () => {
    expect(bushingBaseStiffness(cone90)).toBeCloseTo(0.3, 10)
  })

  it('Barrel 90A torque at 10° is 19.069 N·mm', () => {
    const torque = bushingTorque(barrel90, 10)
    expect(torque).toBeCloseTo(19.06905, 4)
  })

  it('Barrel 90A torque at 30° is 57.664 N·mm', () => {
    const torque = bushingTorque(barrel90, 30)
    expect(torque).toBeCloseTo(57.66435, 4)
  })

  it('Cone 90A torque at 10° is 10.170 N·mm', () => {
    const torque = bushingTorque(cone90, 10)
    expect(torque).toBeCloseTo(10.17016, 4)
  })

  it('Cone 90A torque at 30° is 57.664 N·mm', () => {
    const torque = bushingTorque(cone90, 30)
    expect(torque).toBeCloseTo(57.66435, 4)
  })

  it('Combined barrel+barrel 90A torque at 20° is 76.505 N·mm', () => {
    const torque = combinedBushingTorque(barrel90, barrel90, 20)
    expect(torque).toBeCloseTo(76.5048, 4)
  })

  it('Combined barrel+cone 90A torque at 20° is 67.579 N·mm', () => {
    const torque = combinedBushingTorque(barrel90, cone90, 20)
    expect(torque).toBeCloseTo(67.57924, 4)
  })
})

// ---------------------------------------------------------------------------
// Regression: Lean-to-steer baseline values
// ---------------------------------------------------------------------------

describe('Regression: Lean-to-steer baseline values', () => {
  const { direction: pivotDir50 } = computePivotAxis(50, 0)
  const { direction: pivotDir45 } = computePivotAxis(45, 0)
  const { direction: pivotDir55 } = computePivotAxis(55, 0)

  it('50° RKP at 0° lean → 0° steer', () => {
    const result = computeLeanToSteer(pivotDir50, 0)
    expect(result.steerAngleDeg).toBeCloseTo(0, 10)
    expect(result.hangerRotationDeg).toBeCloseTo(0, 10)
  })

  it('50° RKP at 15° lean → 17.14° steer', () => {
    const result = computeLeanToSteer(pivotDir50, 15)
    expect(result.steerAngleDeg).toBeCloseTo(17.1423, 3)
    // Hanger rotation is an internal value; verify it's non-zero and negative
    expect(result.hangerRotationDeg).toBeLessThan(0)
    expect(result.hangerRotationDeg).toBeCloseTo(-22.6291, 3)
  })

  it('50° RKP at 30° lean → 30.79° steer', () => {
    const result = computeLeanToSteer(pivotDir50, 30)
    expect(result.steerAngleDeg).toBeCloseTo(30.7897, 3)
    expect(result.hangerRotationDeg).toBeLessThan(0)
    expect(result.hangerRotationDeg).toBeCloseTo(-41.9301, 3)
  })

  it('50° RKP at 45° lean → 40.12° steer', () => {
    const result = computeLeanToSteer(pivotDir50, 45)
    expect(result.steerAngleDeg).toBeCloseTo(40.1207, 3)
  })

  it('45° RKP at 30° lean → 26.57° steer', () => {
    const result = computeLeanToSteer(pivotDir45, 30)
    expect(result.steerAngleDeg).toBeCloseTo(26.5651, 3)
  })

  it('55° RKP at 30° lean → 35.53° steer', () => {
    const result = computeLeanToSteer(pivotDir55, 30)
    expect(result.steerAngleDeg).toBeCloseTo(35.5296, 3)
  })

  it('50° RKP at -30° lean → -30.79° steer (symmetry)', () => {
    const result = computeLeanToSteer(pivotDir50, -30)
    expect(result.steerAngleDeg).toBeCloseTo(-30.7897, 3)
  })
})

// ---------------------------------------------------------------------------
// Regression: ICR baseline values
// ---------------------------------------------------------------------------

describe('Regression: ICR baseline values', () => {
  it('50°/47° trucks at 15° lean → ICR at (398.46, 1291.81)', () => {
    const result = computeICR(50, 0, 47, 0, 760, 15)
    expect(result.frontSteerDeg).toBeCloseTo(17.1423, 3)
    expect(result.rearSteerDeg).toBeCloseTo(15.5120, 3)
    expect(result.icr).not.toBeNull()
    if (result.icr) {
      expect(result.icr.x).toBeCloseTo(398.4572, 3)
      expect(result.icr.z).toBeCloseTo(1291.8111, 3)
    }
    expect(result.turningCurvature).toBeCloseTo(0.000774, 5)
  })

  it('50°/47° trucks at 30° lean → ICR at (395.19, 663.20)', () => {
    const result = computeICR(50, 0, 47, 0, 760, 30)
    expect(result.frontSteerDeg).toBeCloseTo(30.7897, 3)
    expect(result.rearSteerDeg).toBeCloseTo(28.1995, 3)
    expect(result.icr).not.toBeNull()
    if (result.icr) {
      expect(result.icr.x).toBeCloseTo(395.1878, 3)
      expect(result.icr.z).toBeCloseTo(663.2039, 3)
    }
    expect(result.turningCurvature).toBeCloseTo(0.001508, 5)
  })

  it('50°/50° symmetric trucks at 30° lean → ICR at (380.00, 637.72)', () => {
    const result = computeICR(50, 0, 50, 0, 760, 30)
    expect(result.frontSteerDeg).toBeCloseTo(30.7897, 3)
    expect(result.rearSteerDeg).toBeCloseTo(30.7897, 3)
    expect(result.icr).not.toBeNull()
    if (result.icr) {
      expect(result.icr.x).toBeCloseTo(380.0, 3)
      // For symmetric trucks, turningCurvature is small, so icrZ = 1/curvature is large
      expect(result.icr.z).toBeCloseTo(637.7157, 3)
    }
  })

  it('50°/47° trucks at 0° lean → null ICR (straight)', () => {
    const result = computeICR(50, 0, 47, 0, 760, 0)
    expect(result.icr).toBeNull()
    expect(result.turningCurvature).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Regression: Key geometry baseline values
// ---------------------------------------------------------------------------

describe('Regression: Key geometry baseline values', () => {
  const { direction: pivotDir50 } = computePivotAxis(50, 0)
  const pivotAngle = 50
  const rake = 0
  const axleToBaseplate = 38
  const baseplateToBoard = 4
  const rearPivotAngle = 47
  const rearRake = 0
  const wheelbase = 760
  const riderMass = 75

  it('50° RKP, barrel/barrel, 75kg at 0° lean → zero bushing torque', () => {
    const result = computeKeyGeometry(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel90, barrel90, riderMass, 1.0, 0,
      rearPivotAngle, rearRake, wheelbase,
    )
    expect(result.leanAngleDeg).toBe(0)
    expect(result.hangerRotationDeg).toBeCloseTo(0, 10)
    expect(result.bushingTorqueNm).toBeCloseTo(0, 10)
    expect(result.invPendulumHeight).toBeCloseTo(42, 10)
  })

  it('50° RKP, barrel/barrel, 75kg at 15° lean → -86.66 N·mm bushing torque', () => {
    const result = computeKeyGeometry(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel90, barrel90, riderMass, 1.0, 15,
      rearPivotAngle, rearRake, wheelbase,
    )
    expect(result.leanAngleDeg).toBe(15)
    expect(result.hangerRotationDeg).toBeCloseTo(-22.6291, 3)
    expect(result.bushingTorqueNm).toBeCloseTo(-86.6582, 3)
  })

  it('50° RKP, barrel/barrel, 75kg at 30° lean → -162.56 N·mm bushing torque', () => {
    const result = computeKeyGeometry(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel90, barrel90, riderMass, 1.0, 30,
      rearPivotAngle, rearRake, wheelbase,
    )
    expect(result.leanAngleDeg).toBe(30)
    expect(result.hangerRotationDeg).toBeCloseTo(-41.9301, 3)
    expect(result.bushingTorqueNm).toBeCloseTo(-162.5624, 3)
  })

  it('50° RKP, barrel/barrel, 75kg at 30° lean → turningCenterX=395.19', () => {
    const result = computeKeyGeometry(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel90, barrel90, riderMass, 1.0, 30,
      rearPivotAngle, rearRake, wheelbase,
    )
    expect(result.turningCenterX).toBeCloseTo(395.1878, 3)
    expect(result.turningCenterZ).toBeCloseTo(663.2039, 3)
    expect(result.turningCurvature).toBeCloseTo(0.001508, 5)
  })

  it('50° RKP, barrel/barrel, 75kg at 30° lean → centerOfForceZ=220.95', () => {
    const result = computeKeyGeometry(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel90, barrel90, riderMass, 1.0, 30,
      rearPivotAngle, rearRake, wheelbase,
    )
    // centerOfForceZ = -bushingTorqueNm * (1000 / riderForce)
    // riderForce = 75 * 9.81 = 735.75 N
    // centerOfForceZ = -(-162.56) * (1000 / 735.75) = 220.95
    expect(result.centerOfForceZ).toBeCloseTo(220.9479, 3)
  })
})

// ---------------------------------------------------------------------------
// Regression: Steering moment baseline values
// ---------------------------------------------------------------------------

describe('Regression: Steering moment baseline values', () => {
  const pivotAngle = 50
  const rake = 0
  const axleToBaseplate = 38
  const baseplateToBoard = 4

  it('50° RKP, 0° lean, 100N lateral → 2700 N·mm steering moment', () => {
    const result = computeSteeringMoment(
      100, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0,
    )
    expect(result.lateralForceN).toBe(100)
    expect(result.effectiveMomentArmMm).toBeCloseTo(26.9971, 3)
    expect(result.steeringMomentNmm).toBeCloseTo(2699.71, 2)
  })

  it('50° RKP, 15° lean, 100N lateral → 2700 N·mm steering moment', () => {
    const result = computeSteeringMoment(
      100, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 15,
    )
    expect(result.effectiveMomentArmMm).toBeCloseTo(26.9971, 3)
    expect(result.steeringMomentNmm).toBeCloseTo(2699.71, 2)
  })

  it('50° RKP, 30° lean, 100N lateral → 2700 N·mm steering moment', () => {
    const result = computeSteeringMoment(
      100, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 30,
    )
    expect(result.effectiveMomentArmMm).toBeCloseTo(26.9971, 3)
    expect(result.steeringMomentNmm).toBeCloseTo(2699.71, 2)
  })
})

// ---------------------------------------------------------------------------
// Regression: Full curve snapshots
// ---------------------------------------------------------------------------

describe('Regression: Full curve snapshots', () => {
  const { direction: pivotDir50 } = computePivotAxis(50, 0)
  const pivotAngle = 50
  const rake = 0
  const axleToBaseplate = 38
  const baseplateToBoard = 4
  const rearPivotAngle = 47
  const rearRake = 0
  const wheelbase = 760
  const riderMass = 75

  it('Return moment curve at key points matches baseline', () => {
    const curve = returnKeyGeometryCurves(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel90, barrel90, riderMass, 1.0,
      -30, 30, 61,
      rearPivotAngle, rearRake, wheelbase,
    )

    expect(curve).toHaveLength(61)

    // Sample at -30° (index 0)
    expect(curve[0].leanAngleDeg).toBeCloseTo(-30, 10)
    expect(curve[0].bushingTorqueNm).toBeCloseTo(162.5624, 3)

    // Sample at 0° (index 30)
    expect(curve[30].leanAngleDeg).toBeCloseTo(0, 10)
    expect(curve[30].bushingTorqueNm).toBeCloseTo(0, 10)

    // Sample at +30° (index 60)
    expect(curve[60].leanAngleDeg).toBeCloseTo(30, 10)
    expect(curve[60].bushingTorqueNm).toBeCloseTo(-162.5624, 3)

    // Sample at +15° (index 45) - step = 60/60 = 1°, so 15° is at index 45
    expect(curve[45].leanAngleDeg).toBeCloseTo(15, 10)
    expect(curve[45].bushingTorqueNm).toBeCloseTo(-86.6582, 3)
  })

  it('Return moment curve with soft bushings produces less torque', () => {
    const curve = returnKeyGeometryCurves(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel75, barrel75, riderMass, 1.0,
      -30, 30, 61,
      rearPivotAngle, rearRake, wheelbase,
    )

    // At 30°, soft bushings should produce less torque than 90A
    const torqueAt30 = curve[60].bushingTorqueNm
    expect(Math.abs(torqueAt30)).toBeLessThan(162.5624)
    expect(torqueAt30).toBeCloseTo(-112.8905, 3)
  })

  it('Return moment curve with hard bushings produces more torque', () => {
    const curve = returnKeyGeometryCurves(
      pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard,
      barrel97, barrel97, riderMass, 1.0,
      -30, 30, 61,
      rearPivotAngle, rearRake, wheelbase,
    )

    // At 30°, hard bushings should produce more torque than 90A
    const torqueAt30 = curve[60].bushingTorqueNm
    expect(Math.abs(torqueAt30)).toBeGreaterThan(162.5624)
    expect(torqueAt30).toBeCloseTo(-188.8333, 3)
  })
})

// ---------------------------------------------------------------------------
// Regression: Centripetal force baseline
// ---------------------------------------------------------------------------

describe('Regression: Centripetal force baseline', () => {
  it('75kg at 5m/s, 20m radius → 93.75 N', () => {
    expect(centripetalForce(75, 5, 20)).toBeCloseTo(93.75, 10)
  })

  it('75kg at 10m/s, 20m radius → 375 N', () => {
    expect(centripetalForce(75, 10, 20)).toBeCloseTo(375, 10)
  })

  it('75kg at 10m/s, 10m radius → 750 N', () => {
    expect(centripetalForce(75, 10, 10)).toBeCloseTo(750, 10)
  })

  it('75kg at 10m/s, 0m radius → 0 N (guard)', () => {
    expect(centripetalForce(75, 10, 0)).toBe(0)
  })
})
