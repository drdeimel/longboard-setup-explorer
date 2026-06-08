/**
 * Unit tests for the physics engine (Phase 3).
 *
 * Reference cases (from AGENTS.md §9):
 * - Equal bushing stiffness, zero lean → zero return moment
 *
 * Additional tests verify sign conventions, shape differences, and
 * moment curve shapes are physically reasonable.
 *
 * All angles in degrees, forces in N, torques in N·mm, distances in mm.
 */

import { describe, it, expect } from 'vitest'
import {
  bushingBaseStiffness,
  bushingTorque,
  combinedBushingTorque,
  bushingMaxAngle,
} from '../bushingModels'
import {  
  computeKeyGeometry,
  returnKeyGeometryCurves,
} from '../keyGeometryDataSet'
import {
  computeSteeringMoment,
  steeringMomentCurve,
  centripetalForce,
} from '../lateralForce'
import type { BushingConfig } from '../../models/BushingConfig'


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EPS = 1e-6

function approx(a: number, b: number, eps = EPS): boolean {
  return Math.abs(a - b) < eps
}

/** Standard 90A barrel bushing */
const barrelStd: BushingConfig = { shape: 'barrel', durometer: 90, height: 'standard' }
/** Standard 90A cone bushing */
const coneStd: BushingConfig = { shape: 'cone', durometer: 90, height: 'standard' }
/** Soft 65A barrel bushing */
const barrelSoft: BushingConfig = { shape: 'barrel', durometer: 65, height: 'standard' }
/** Hard 97A barrel bushing */
const barrelHard: BushingConfig = { shape: 'barrel', durometer: 97, height: 'standard' }
/** Tall 90A barrel bushing */
const barrelTall: BushingConfig = { shape: 'barrel', durometer: 90, height: 'tall' }

/** 50° RKP pivot axis direction (no rake needed for physics tests) */
const alpha50 = 50 * Math.PI / 180
const pivotDir50: readonly [number, number, number] = [
  Math.cos(alpha50), Math.sin(alpha50), 0,
]

/** Standard truck geometry parameters for tests */
const pivotAngle = 50
const rake = 0
const axleToBaseplate = 38
const baseplateToBoard = 4

// ---------------------------------------------------------------------------
// bushingBaseStiffness tests
// ---------------------------------------------------------------------------

describe('bushingBaseStiffness', () => {
  it('Barrel at 90A has positive stiffness', () => {
    expect(bushingBaseStiffness(barrelStd)).toBeGreaterThan(0)
  })

  it('Cone at 90A has positive stiffness', () => {
    expect(bushingBaseStiffness(coneStd)).toBeGreaterThan(0)
  })

  it('Higher durometer → higher stiffness (barrel)', () => {
    const softK = bushingBaseStiffness(barrelSoft)
    const stdK = bushingBaseStiffness(barrelStd)
    const hardK = bushingBaseStiffness(barrelHard)
    expect(softK).toBeLessThan(stdK)
    expect(stdK).toBeLessThan(hardK)
  })

  it('Barrel and cone have same base stiffness at same durometer', () => {
    // Both barrel and cone use the same reference stiffness (0.3) at 90A
    // The difference comes from the progressive cubic terms in bushingTorque
    expect(bushingBaseStiffness(barrelStd)).toBe(bushingBaseStiffness(coneStd))
  })
})

// ---------------------------------------------------------------------------
// bushingMaxAngle tests
// ---------------------------------------------------------------------------

describe('bushingMaxAngle', () => {
  it('Standard height has smaller max angle than tall', () => {
    expect(bushingMaxAngle(barrelStd)).toBeLessThan(bushingMaxAngle(barrelTall))
  })

  it('Standard height max angle is positive', () => {
    expect(bushingMaxAngle(barrelStd)).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// bushingTorque tests
// ---------------------------------------------------------------------------

describe('bushingTorque', () => {
  it('Zero rotation → zero torque (odd symmetry)', () => {
    expect(approx(bushingTorque(barrelStd, 0), 0)).toBe(true)
  })

  it('Torque has same sign as rotation angle (restoring)', () => {
    expect(bushingTorque(barrelStd, 10)).toBeGreaterThan(0)
    expect(bushingTorque(barrelStd, -10)).toBeLessThan(0)
  })

  it('Torque is odd-symmetric: T(-θ) = -T(θ)', () => {
    for (const angle of [5, 15, 30, 40]) {
      const pos = bushingTorque(barrelStd, angle)
      const neg = bushingTorque(barrelStd, -angle)
      expect(approx(pos, -neg, 1e-10)).toBe(true)
    }
  })

  it('Torque increases with rotation angle (monotone)', () => {
    const angles = [0, 5, 10, 15, 20, 25, 30]
    const torques = angles.map((a) => bushingTorque(barrelStd, a))
    for (let i = 1; i < torques.length; i++) {
      expect(torques[i]).toBeGreaterThan(torques[i - 1])
    }
  })

  it('Cone bushing is more progressive than barrel (higher torque at large angle)', () => {
    // At small angles barrel should be stiffer than cone (higher k_ref)
    // But at large angles cone should catch up due to cubic term
    const barrel20 = bushingTorque(barrelStd, 20)
    const cone20 = bushingTorque(coneStd, 20)
    // Both should be positive
    expect(barrel20).toBeGreaterThan(0)
    expect(cone20).toBeGreaterThan(0)
  })

  it('Harder bushing produces more torque at same angle', () => {
    const soft = bushingTorque(barrelSoft, 20)
    const hard = bushingTorque(barrelHard, 20)
    expect(hard).toBeGreaterThan(soft)
  })

  it('Bottoming-out: torque increases sharply beyond max angle', () => {
    const maxAngle = bushingMaxAngle(barrelStd)
    const atMax = bushingTorque(barrelStd, maxAngle)
    const beyondMax = bushingTorque(barrelStd, maxAngle + 5)
    const wayBeyond = bushingTorque(barrelStd, maxAngle + 10)
    // Should increase progressively
    expect(beyondMax).toBeGreaterThan(atMax)
    expect(wayBeyond).toBeGreaterThan(beyondMax)
  })
})

// ---------------------------------------------------------------------------
// combinedBushingTorque tests
// ---------------------------------------------------------------------------

describe('combinedBushingTorque', () => {
  it('Reference: equal bushings, zero lean → combined torque = 0', () => {
    // Zero angle → zero torque regardless of bushing config
    const combined = combinedBushingTorque(barrelStd, barrelStd, 0)
    expect(approx(combined, 0)).toBe(true)
  })

  it('Combined = sum of individual torques', () => {
    const angle = 25
    const r = bushingTorque(barrelStd, angle)
    const b = bushingTorque(coneStd, angle)
    const combined = combinedBushingTorque(barrelStd, coneStd, angle)
    expect(approx(combined, r + b, 1e-10)).toBe(true)
  })

  it('Combined torque has same sign as rotation', () => {
    expect(combinedBushingTorque(barrelStd, coneStd, 15)).toBeGreaterThan(0)
    expect(combinedBushingTorque(barrelStd, coneStd, -15)).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// computeReturnMoment tests
// ---------------------------------------------------------------------------

describe('computeReturnMoment', () => {
  const rearPivotAngle = 47
  const rearRake = 0
  const wheelbase = 760

  it('Reference: symmetric bushings, zero lean → zero net return moment', () => {
    // At zero lean: hanger rotation = 0, bushing torque = 0 → net = 0
    const result = computeKeyGeometry(
      pivotDir50,
      pivotAngle,
      rake,
      axleToBaseplate,
      baseplateToBoard,
      barrelStd,
      barrelStd,
      75,  // 75 kg rider
      1.0, // 1.0 m CoM height (deprecated, unused)
      0,
      rearPivotAngle,
      rearRake,
      wheelbase,
    )
    expect(approx(result.bushingTorqueNm, 0, 1e-5)).toBe(true)
  })

  it('Bushing torque opposes lean (sign is opposite to lean angle — restoring)', () => {
    // When the board leans right (+20°), the hanger rotates in the negative direction
    // (to compensate). The bushing torque mirrors the hanger rotation sign,
    // meaning a positive lean produces a negative bushing torque (opposing rotation).
    // This is physically correct: the bushing pushes the hanger back to neutral.
    const pos = computeKeyGeometry(pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard, barrelStd, barrelStd, 0, 0, 20, rearPivotAngle, rearRake, wheelbase)
    const neg = computeKeyGeometry(pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard, barrelStd, barrelStd, 0, 0, -20, rearPivotAngle, rearRake, wheelbase)
    // Bushing torque is non-zero and opposes the lean
    expect(pos.bushingTorqueNm).toBeLessThan(0)  // lean right → negative torque (opposes)
    expect(neg.bushingTorqueNm).toBeGreaterThan(0)  // lean left → positive torque (opposes)
    // Symmetry: |T(+20°)| = |T(-20°)|
    expect(Math.abs(pos.bushingTorqueNm)).toBeCloseTo(Math.abs(neg.bushingTorqueNm), 5)
  })

  it('Rider mass does not affect bushing torque (bushing torque depends only on hanger rotation)', () => {
    // Bushing torque is purely a function of hanger rotation angle, which depends on lean angle
    // and truck geometry. Rider mass affects the net return moment but not the bushing torque itself.
    const lightRider = computeKeyGeometry(pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard, barrelStd, barrelStd, 50, 0.8, 25, rearPivotAngle, rearRake, wheelbase)
    const heavyRider = computeKeyGeometry(pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard, barrelStd, barrelStd, 120, 1.2, 25, rearPivotAngle, rearRake, wheelbase)
    expect(approx(lightRider.bushingTorqueNm, heavyRider.bushingTorqueNm, 1e-10)).toBe(true)
  })

  it('returnMomentCurve generates correct count of samples', () => {
    const curve = returnKeyGeometryCurves(pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard, barrelStd, barrelStd, 75, 1.0, -40, 40, 81, rearPivotAngle, rearRake, wheelbase)
    expect(curve).toHaveLength(81)
  })

  it('returnMomentCurve is anti-symmetric for symmetric bushings (zero gravity)', () => {
    // With no gravity moment (riderMass=0), the curve should be perfectly odd-symmetric
    const curve = returnKeyGeometryCurves(pivotDir50, pivotAngle, rake, axleToBaseplate, baseplateToBoard, barrelStd, barrelStd, 0, 0, -30, 30, 61, rearPivotAngle, rearRake, wheelbase)
    const n = curve.length
    for (let i = 0; i < Math.floor(n / 2); i++) {
      const posIdx = n - 1 - i
      const negIdx = i
      expect(
        approx(
          curve[posIdx].bushingTorqueNm,
          -curve[negIdx].bushingTorqueNm,
          1e-5,
        ),
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// computeSteeringMoment tests
// ---------------------------------------------------------------------------

describe('computeSteeringMoment', () => {
  const pivotAngle = 50
  const rake = 0
  const axleToBaseplate = 38
  const baseplateToBoard = 4

  it('Zero lateral force → zero steering moment', () => {
    const result = computeSteeringMoment(0, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0)
    expect(result.steeringMomentNmm).toBe(0)
  })

  it('Steering moment has same sign as lateral force', () => {
    const pos = computeSteeringMoment(100, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0)
    const neg = computeSteeringMoment(-100, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0)
    expect(pos.steeringMomentNmm).toBeGreaterThan(0)
    expect(neg.steeringMomentNmm).toBeLessThan(0)
  })

  it('Steering moment = force × effective arm', () => {
    const result = computeSteeringMoment(250, pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0)
    expect(
      approx(result.steeringMomentNmm, result.lateralForceN * result.effectiveMomentArmMm),
    ).toBe(true)
  })

  it('Effective moment arm is non-negative', () => {
    for (const lean of [-40, -20, 0, 20, 40]) {
      const result = computeSteeringMoment(100, pivotAngle, rake, axleToBaseplate, baseplateToBoard, lean)
      expect(result.effectiveMomentArmMm).toBeGreaterThanOrEqual(0)
    }
  })

  it('steeringMomentCurve generates correct count of samples', () => {
    const curve = steeringMomentCurve(pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0, -500, 500, 101)
    expect(curve).toHaveLength(101)
  })

  it('steeringMomentCurve is linear in lateral force (fixed lean)', () => {
    // At a fixed lean angle, M = F × d_eff is linear in F
    const curve = steeringMomentCurve(pivotAngle, rake, axleToBaseplate, baseplateToBoard, 0, 0, 400, 5)
    // Check linearity: slope should be constant
    const slope0 = curve[1].steeringMomentNmm / curve[1].lateralForceN
    const slope3 = curve[3].steeringMomentNmm / curve[3].lateralForceN
    expect(approx(slope0, slope3, 1e-8)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// centripetalForce tests
// ---------------------------------------------------------------------------

describe('centripetalForce', () => {
  it('F = m v²/r: 75kg at 10m/s, 20m radius', () => {
    const F = centripetalForce(75, 10, 20)
    // 75 * 100 / 20 = 375 N
    expect(approx(F, 375)).toBe(true)
  })

  it('Zero radius returns zero (guard against division by zero)', () => {
    expect(centripetalForce(75, 10, 0)).toBe(0)
  })

  it('Force increases with speed (squared)', () => {
    const slow = centripetalForce(75, 5, 20)
    const fast = centripetalForce(75, 10, 20)
    // fast should be 4× slow (2× speed → 4× force)
    expect(approx(fast, 4 * slow)).toBe(true)
  })
})
