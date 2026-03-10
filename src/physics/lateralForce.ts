/**
 * Steering moment from lateral force for the Longboard Simulator.
 *
 * Models the steering torque generated when a lateral force (e.g., centripetal
 * force during a turn) is applied at the board surface.
 *
 * From plan.md:
 * ```
 * M_steer(F_y) = F_y × d_eff(φ)
 * ```
 *
 * Where `d_eff(φ)` is the effective moment arm for the lateral force — the
 * perpendicular distance from the pivot axis to the board surface at lean
 * angle φ.
 *
 * The physical interpretation: a lateral force at the board surface creates
 * a torque around the pivot axis proportional to the perpendicular distance
 * from the force application point to the pivot axis line.
 *
 * All forces in Newtons; torques in N·mm; distances in mm; angles in degrees.
 */

import { computeRotationAxisDist } from '../geometry/rotationAxisDist'

/**
 * Result of the steering moment computation at a single lateral force value
 * and lean angle.
 */
export interface SteeringMomentResult {
  /**
   * Lateral force applied at board surface, in Newtons.
   * Positive = force toward heel side (+Z direction).
   * @units N
   */
  lateralForceN: number

  /**
   * Effective moment arm `d_eff` (pivot axis to board surface distance) at
   * the current lean angle, in mm.
   * @units mm
   */
  effectiveMomentArmMm: number

  /**
   * Steering moment `M_steer = F_y × d_eff`, in N·mm.
   * Positive → tends to steer in the same direction as the lateral force.
   * @units N·mm
   */
  steeringMomentNmm: number

  /**
   * Board lean angle at which this computation was performed, in degrees.
   */
  leanAngleDeg: number
}

/**
 * Compute the steering moment produced by a lateral force at the board surface.
 *
 * @param lateralForceN          - Lateral force at board surface in Newtons.
 * @param pivotAxisAngleDeg      - Pivot axis angle α in degrees.
 * @param rake                   - Rake r in mm.
 * @param axleToBaseplateDistance - Axle-to-baseplate distance in mm.
 * @param baseplateToBoard       - Baseplate-to-board surface distance in mm.
 * @param leanAngleDeg           - Board lean angle φ in degrees.
 * @returns Steering moment breakdown at the given force and lean angle.
 */
export function computeSteeringMoment(
  lateralForceN: number,
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  leanAngleDeg: number,
): SteeringMomentResult {
  // Get effective moment arm at this lean angle
  const distResult = computeRotationAxisDist(
    pivotAxisAngleDeg,
    rake,
    axleToBaseplateDistance,
    baseplateToBoard,
    leanAngleDeg,
  )

  const effectiveMomentArmMm = distResult.distanceMm

  // Steering moment: M = F × d
  // lateralForceN in N, effectiveMomentArmMm in mm
  // Result in N·mm
  const steeringMomentNmm = lateralForceN * effectiveMomentArmMm

  return {
    lateralForceN,
    effectiveMomentArmMm,
    steeringMomentNmm,
    leanAngleDeg,
  }
}

/**
 * Generate a steering moment curve over a range of lateral forces at a
 * fixed lean angle.
 *
 * @param pivotAxisAngleDeg       - Pivot axis angle α (degrees).
 * @param rake                    - Rake r (mm).
 * @param axleToBaseplateDistance - Axle-to-baseplate distance (mm).
 * @param baseplateToBoard        - Baseplate-to-board distance (mm).
 * @param leanAngleDeg            - Board lean angle φ (degrees).
 * @param minForceN               - Minimum lateral force to sample (N).
 * @param maxForceN               - Maximum lateral force to sample (N).
 * @param numSamples              - Number of evenly-spaced samples.
 * @returns Array of steering moment results over the force range.
 */
export function steeringMomentCurve(
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  leanAngleDeg: number,
  minForceN: number,
  maxForceN: number,
  numSamples: number,
): SteeringMomentResult[] {
  const results: SteeringMomentResult[] = []
  const step = (maxForceN - minForceN) / (numSamples - 1)
  for (let i = 0; i < numSamples; i++) {
    const force = minForceN + i * step
    results.push(
      computeSteeringMoment(
        force,
        pivotAxisAngleDeg,
        rake,
        axleToBaseplateDistance,
        baseplateToBoard,
        leanAngleDeg,
      ),
    )
  }
  return results
}

/**
 * Centripetal force helper: compute the lateral centripetal force required
 * for a rider of given mass traveling at a given speed through a turn of
 * given radius.
 *
 * `F_centripetal = m × v² / r`
 *
 * @param riderMassKg     - Rider mass in kg.
 * @param speedMs         - Speed in m/s.
 * @param turningRadiusM  - Turn radius in m.
 * @returns Centripetal (lateral) force in Newtons.
 * @units N
 */
export function centripetalForce(
  riderMassKg: number,
  speedMs: number,
  turningRadiusM: number,
): number {
  if (turningRadiusM <= 0) {
    return 0
  }
  return (riderMassKg * speedMs * speedMs) / turningRadiusM
}
