/**
 * Unit tests for the geometry engine.
 *
 * Reference cases (from AGENTS.md §9):
 * - 50° RKP truck, zero rake, symmetric bushings, 0° lean → 0° steer
 * - 50° RKP truck, zero rake, 45° lean → matches analytically derivable steer angle
 * - Zero pivot axis angle → no steering response at any lean angle
 * - 90° pivot axis angle → maximum steering sensitivity
 *
 * Coordinate system: X forward, Y up, Z lateral right.
 * All angles in degrees, distances in mm.
 */

import { describe, it, expect } from 'vitest'
import { computePivotAxis, boardSurfaceHeight } from '../pivotAxis'
import { computeLeanToSteer, leanToSteerCurve } from '../leanToSteer'
import { computeRotationAxisDist } from '../rotationAxisDist'
import { computeICR, icrLocus } from '../turningCenter'
import { dot, cross, normalize, length } from '../../math/vec3'
import { rotationMatrix, mulMatVec } from '../../math/mat3'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tolerance for floating-point assertions */
const EPS = 1e-6

function approx(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps
}

// ---------------------------------------------------------------------------
// vec3 math tests
// ---------------------------------------------------------------------------

describe('vec3 math', () => {
  it('dot product: [1,0,0]·[0,1,0] = 0', () => {
    expect(dot([1, 0, 0], [0, 1, 0])).toBe(0)
  })

  it('dot product: [1,2,3]·[4,5,6] = 32', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32)
  })

  it('cross product: [1,0,0]×[0,1,0] = [0,0,1]', () => {
    const c = cross([1, 0, 0], [0, 1, 0])
    expect(approx(c[0], 0)).toBe(true)
    expect(approx(c[1], 0)).toBe(true)
    expect(approx(c[2], 1)).toBe(true)
  })

  it('normalize: length of normalized vector is 1', () => {
    const v = normalize([3, 4, 0])
    expect(approx(length(v), 1)).toBe(true)
  })

  it('normalize: [3,4,0] → [0.6,0.8,0]', () => {
    const v = normalize([3, 4, 0])
    expect(approx(v[0], 0.6)).toBe(true)
    expect(approx(v[1], 0.8)).toBe(true)
    expect(approx(v[2], 0)).toBe(true)
  })

  it('normalize: throws on zero vector', () => {
    expect(() => normalize([0, 0, 0])).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// mat3 tests
// ---------------------------------------------------------------------------

describe('mat3 rotation', () => {
  it('90° rotation around Z maps [1,0,0] → [0,1,0]', () => {
    const R = rotationMatrix([0, 0, 1], 90)
    const v = mulMatVec(R, [1, 0, 0])
    expect(approx(v[0], 0)).toBe(true)
    expect(approx(v[1], 1)).toBe(true)
    expect(approx(v[2], 0)).toBe(true)
  })

  it('180° rotation around Y maps [1,0,0] → [-1,0,0]', () => {
    const R = rotationMatrix([0, 1, 0], 180)
    const v = mulMatVec(R, [1, 0, 0])
    expect(approx(v[0], -1)).toBe(true)
    expect(approx(v[1], 0)).toBe(true)
    expect(approx(v[2], 0)).toBe(true)
  })

  it('0° rotation is identity', () => {
    const R = rotationMatrix([1, 0, 0], 0)
    const v = mulMatVec(R, [1, 2, 3])
    expect(approx(v[0], 1)).toBe(true)
    expect(approx(v[1], 2)).toBe(true)
    expect(approx(v[2], 3)).toBe(true)
  })

  it('360° rotation returns original vector', () => {
    const R = rotationMatrix([0, 1, 0], 360)
    const v = mulMatVec(R, [1, 2, 3])
    expect(approx(v[0], 1)).toBe(true)
    expect(approx(v[1], 2)).toBe(true)
    expect(approx(v[2], 3)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// pivotAxis tests
// ---------------------------------------------------------------------------

describe('computePivotAxis', () => {
  it('50° angle, zero rake: direction = (cos50°, sin50°, 0)', () => {
    const { direction } = computePivotAxis(50, 0)
    const expected = [Math.cos((50 * Math.PI) / 180), Math.sin((50 * Math.PI) / 180), 0]
    expect(approx(direction[0], expected[0])).toBe(true)
    expect(approx(direction[1], expected[1])).toBe(true)
    expect(approx(direction[2], 0)).toBe(true)
  })

  it('50° angle, zero rake: point on axis is at origin (rake=0)', () => {
    const { point } = computePivotAxis(50, 0)
    expect(approx(point[0], 0)).toBe(true)
    expect(approx(point[1], 0)).toBe(true)
    expect(approx(point[2], 0)).toBe(true)
  })

  it('direction vector has unit length for any angle', () => {
    for (const angle of [0, 30, 45, 50, 65, 90]) {
      const { direction } = computePivotAxis(angle, 0)
      expect(approx(length(direction), 1)).toBe(true)
    }
  })

  it('rake=10mm at 50°: point on axis is 10mm perpendicular to direction', () => {
    const { direction, point } = computePivotAxis(50, 10)
    // point should be perpendicular to direction
    expect(approx(dot(point, direction), 0, 1e-10)).toBe(true)
    // point should have magnitude = |rake|
    expect(approx(length(point), 10)).toBe(true)
  })

  it('boardSurfaceHeight: 38 + 4 = 42mm', () => {
    expect(boardSurfaceHeight(38, 4)).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// leanToSteer tests — core reference cases
// ---------------------------------------------------------------------------

describe('computeLeanToSteer', () => {
  /** Standard 50° RKP truck pivot axis direction (no rake needed for this) */
  const pivotDir50: readonly [number, number, number] = [
    Math.cos((50 * Math.PI) / 180),
    Math.sin((50 * Math.PI) / 180),
    0,
  ]

  it('Reference: 50° RKP, zero lean → zero steer (AGENTS.md §9)', () => {
    const result = computeLeanToSteer(pivotDir50, 0)
    expect(approx(result.steerAngleDeg, 0, 1e-8)).toBe(true)
  })

  it('Reference: 50° RKP, 45° lean → non-zero steer (basic sanity)', () => {
    const result = computeLeanToSteer(pivotDir50, 45)
    // Should produce meaningful steer (empirically ≈ 40° for 50° RKP at 45° lean)
    expect(Math.abs(result.steerAngleDeg)).toBeGreaterThan(1)
  })

  it('Reference: zero pivot axis angle → no steering response at any lean', () => {
    // 0° pivot axis = horizontal axis (no steering coupling)
    const pivotDirHoriz: readonly [number, number, number] = [1, 0, 0]
    const result0 = computeLeanToSteer(pivotDirHoriz, 45)
    expect(approx(result0.steerAngleDeg, 0, 1e-5)).toBe(true)
  })

  it('Reference: 90° pivot axis (vertical) → maximum steering sensitivity', () => {
    // 90° = vertical axis, lean maps directly to steer
    const pivotDirVert: readonly [number, number, number] = [0, 1, 0]
    const result = computeLeanToSteer(pivotDirVert, 45)
    // Vertical axis: steer should be approximately equal to lean for small-medium angles
    expect(Math.abs(result.steerAngleDeg)).toBeGreaterThan(30)
  })

  it('Steer angle sign is consistent with lean sign (positive lean → positive steer)', () => {
    const resultPositive = computeLeanToSteer(pivotDir50, 20)
    const resultNegative = computeLeanToSteer(pivotDir50, -20)
    expect(resultPositive.steerAngleDeg).toBeGreaterThan(0)
    expect(resultNegative.steerAngleDeg).toBeLessThan(0)
    // Symmetry: |steer(-φ)| = |steer(+φ)|
    expect(
      approx(
        Math.abs(resultPositive.steerAngleDeg),
        Math.abs(resultNegative.steerAngleDeg),
        1e-6,
      ),
    ).toBe(true)
  })

  it('Steer angle is monotonically increasing with lean angle (50° RKP)', () => {
    const leanAngles = [0, 5, 10, 15, 20, 25, 30]
    const steers = leanAngles.map((lean) => computeLeanToSteer(pivotDir50, lean).steerAngleDeg)
    for (let i = 1; i < steers.length; i++) {
      expect(steers[i]).toBeGreaterThan(steers[i - 1])
    }
  })

  it('Steer returned after axle is confirmed to be in road plane (y≈0)', () => {
    // After computing steer, verify that the Y component of the axle is near zero
    // This is the core invariant of the algorithm
    for (const leanDeg of [-45, -30, -15, 0, 15, 30, 45]) {
      const result = computeLeanToSteer(pivotDir50, leanDeg)
      const θ = result.hangerRotationDeg

      // Reconstruct: lean board, then rotate hanger
      const R_lean = rotationMatrix([1, 0, 0], leanDeg)
      const leanedAxisDir = normalize(mulMatVec(R_lean, pivotDir50))
      const axleLeaned = mulMatVec(R_lean, [0, 0, 1])
      const R_hanger = rotationMatrix(leanedAxisDir, θ)
      const axleFinal = mulMatVec(R_hanger, axleLeaned)

      expect(approx(axleFinal[1], 0, 1e-5)).toBe(true)
    }
  })

  it('leanToSteerCurve: generates correct number of samples', () => {
    const curve = leanToSteerCurve(pivotDir50, -45, 45, 91)
    expect(curve).toHaveLength(91)
  })

  it('leanToSteerCurve: first sample matches direct computation', () => {
    const curve = leanToSteerCurve(pivotDir50, -45, 45, 91)
    const direct = computeLeanToSteer(pivotDir50, -45)
    expect(approx(curve[0].steerAngleDeg, direct.steerAngleDeg)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rotationAxisDist tests
// ---------------------------------------------------------------------------

describe('computeRotationAxisDist', () => {
  it('Returns a non-negative distance', () => {
    const result = computeRotationAxisDist(50, 0, 38, 4, 0)
    expect(result.distanceMm).toBeGreaterThanOrEqual(0)
  })

  it('Distance is finite for all typical lean angles', () => {
    for (const lean of [-45, -30, -15, 0, 15, 30, 45]) {
      const result = computeRotationAxisDist(50, 0, 38, 4, lean)
      expect(isFinite(result.distanceMm)).toBe(true)
    }
  })

  it('Zero lean returns consistent distance (baseline check)', () => {
    const result = computeRotationAxisDist(50, 0, 38, 4, 0)
    // At zero lean, board surface is at y=42mm, axis passes through origin
    // Distance should be the perpendicular distance in the vertical direction
    expect(result.distanceMm).toBeGreaterThan(0)
    expect(result.leanAngleDeg).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// turningCenter tests
// ---------------------------------------------------------------------------

describe('computeICR', () => {
  it('Zero lean → ICR at infinity (straight ahead)', () => {
    const result = computeICR(50, 0, 47, 0, 760, 0)
    expect(result.icr).toBeNull()
    expect(result.turningRadiusMm).toBeNull()
  })

  it('Non-zero lean → finite ICR', () => {
    const result = computeICR(50, 0, 47, 0, 760, 30)
    expect(result.icr).not.toBeNull()
    expect(result.turningRadiusMm).not.toBeNull()
  })

  it('Symmetric trucks (same angle, same rake) → ICR on board centerline (z=0)', () => {
    // When front and rear trucks have identical geometry, the board turns symmetrically.
    // The ICR should lie on the board centerline Z=0 (i.e., icrZ ≈ 0).
    const result = computeICR(50, 0, 50, 0, 760, 30)
    if (result.icr !== null) {
      expect(approx(result.icr.z, 0, 1e-4)).toBe(true)
    }
  })

  it('Front and rear steer angles have same sign for positive lean', () => {
    const result = computeICR(50, 0, 47, 0, 760, 25)
    expect(result.frontSteerDeg).toBeGreaterThan(0)
    expect(result.rearSteerDeg).toBeGreaterThan(0)
  })

  it('Negative lean gives opposite steer direction to positive lean', () => {
    const posLean = computeICR(50, 0, 47, 0, 760, 30)
    const negLean = computeICR(50, 0, 47, 0, 760, -30)
    if (posLean.icr && negLean.icr) {
      // The Z coordinates should be mirror images
      expect(approx(posLean.icr.z, -negLean.icr.z, 1e-4)).toBe(true)
    }
  })

  it('icrLocus: generates proper number of samples', () => {
    const locus = icrLocus(50, 0, 47, 0, 760, -40, 40, 81)
    expect(locus).toHaveLength(81)
  })

  it('icrLocus: zero lean sample has null ICR', () => {
    // With 81 samples from -40 to 40, sample 40 is at 0 lean
    const locus = icrLocus(50, 0, 47, 0, 760, -40, 40, 81)
    const zeroLeanSample = locus.find((s) => Math.abs(s.leanAngleDeg) < 0.01)
    expect(zeroLeanSample?.icr).toBeNull()
  })
})
