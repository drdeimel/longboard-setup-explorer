/**
 * Steering moment from lateral force for the Longboard Simulator.
 *
 * Two independent moment arms act about the pivot axis:
 *
 * 1. Inverted-pendulum arm `d_invPendulum(φ)`: perpendicular distance from the
 *    pivot axis to the board surface plane at lean angle φ. This is the arm for
 *    the lateral force component applied at board level (rider CoM projection).
 *    Computed by `computeRotationAxisDist`; lean-dependent.
 *
 * 2. Trail arm `trail × cos(α)`: perpendicular distance from the wheel contact
 *    patch on the ground to the pivot axis line.
 *    The pivot axis intersects the ground (y = −wheelRadius) at:
 *      x_ground = −(rake + wheelRadius × cos(α)) / sin(α)
 *    So: trail = |x_ground|, and
 *      trailArmMm = trail × cos(α) = |rake + wheelRadius × cos(α)| × cos(α) / sin(α)
 *    Lean-independent (ground geometry is fixed).
 *
 * Total steering moment:
 * ```
 * M_steer = F_lat × d_invPendulum(φ)  +  F_lat × cos(δ(φ)) × trail × cos(α)
 * ```
 * where δ(φ) is the steer angle produced by lean φ (from `computeLeanToSteer`).
 *
 * All forces in Newtons; torques in N·mm; distances in mm; angles in degrees.
 */

import { computeRotationAxisDist } from '../geometry/rotationAxisDist'
import { computePivotAxis } from '../geometry/pivotAxis'
import { computeLeanToSteer } from '../geometry/leanToSteer'

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
   * Effective moment arm = steeringMomentNmm / lateralForceN, in mm.
   * Equals d_invPendulum(φ) + cos(δ(φ)) × trail×cos(α).
   * @units mm
   */
  effectiveMomentArmMm: number

  /**
   * Steering moment `M_steer = F_lat × effectiveMomentArmMm`, in N·mm.
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
 * Compute the steering moment produced by a lateral force applied to the truck.
 *
 * Sums two independent moment arms about the pivot axis:
 * - `invPendulumArmMm`: perpendicular distance from pivot axis to board surface (lean-dependent).
 * - `trailArmMm`: perpendicular distance from wheel contact patch to pivot axis = trail × cos(α).
 *
 * @param lateralForceN           - Lateral force in Newtons.
 * @param pivotAxisAngleDeg       - Pivot axis angle α in degrees.
 * @param rake                    - Rake r in mm.
 * @param axleToBaseplateDistance - Axle-to-baseplate distance in mm.
 * @param baseplateToBoard        - Baseplate-to-board surface distance in mm.
 * @param leanAngleDeg            - Board lean angle φ in degrees.
 * @param wheelDiameter           - Wheel diameter in mm (required for trail arm). Default 0.
 * @returns Steering moment breakdown at the given force and lean angle.
 */
export function computeSteeringMoment(
  lateralForceN: number,
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  leanAngleDeg: number,
  wheelDiameter: number = 0,
): SteeringMomentResult {
  // Inverted-pendulum arm: perpendicular distance from pivot axis to board surface plane.
  // This is the moment arm for the lateral force component acting at board level.
  // Lean-dependent: the board tilts with lean angle φ, changing this distance.
  const invPendulumArmMm = computeRotationAxisDist(
    pivotAxisAngleDeg,
    rake,
    axleToBaseplateDistance,
    baseplateToBoard,
    leanAngleDeg,
  ).distanceMm

  // Trail arm: perpendicular distance from wheel contact patch (ground) to pivot axis.
  // Lean-independent: ground geometry is fixed regardless of board lean.
  // Derivation: pivot axis hits the ground (y = −wheelRadius) at
  //   x_ground = −(rake + wheelRadius × cos(α)) / sin(α)
  // trail = |x_ground|
  // trailArmMm = trail × cos(α) = |rake + wheelRadius × cos(α)| × cos(α) / sin(α)
  const wheelRadius = wheelDiameter / 2
  const pivotAxisAngleRad = (pivotAxisAngleDeg * Math.PI) / 180
  const sinPivot = Math.sin(pivotAxisAngleRad)
  const cosPivot = Math.cos(pivotAxisAngleRad)
  const trailArmMm = sinPivot > 1e-9
    ? Math.abs(rake + wheelRadius * cosPivot) * cosPivot / sinPivot
    : 0

  // The lateral force that contributes to the trail moment is the component
  // perpendicular to the steered wheel direction. When the hanger steers by
  // angle δ (from lean), only cos(δ) of the lateral force acts perpendicular
  // to the axle and thus generates a moment about the pivot axis via the trail.
  const { direction: pivotAxisDirection } = computePivotAxis(pivotAxisAngleDeg, rake)
  const steerAngleDeg = computeLeanToSteer(pivotAxisDirection, leanAngleDeg).steerAngleDeg
  const steerAngleRad = (steerAngleDeg * Math.PI) / 180

  const invPendulumMomentNmm = lateralForceN * invPendulumArmMm
  const trailMomentNmm       = lateralForceN * Math.cos(steerAngleRad) * trailArmMm
  const steeringMomentNmm    = invPendulumMomentNmm + trailMomentNmm

  // Derived scalar for callers that need a single arm (e.g. chart slope display)
  const effectiveMomentArmMm = invPendulumArmMm + trailArmMm

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
 * @param wheelDiameter           - Wheel diameter in mm (for trail contribution). Default 0.
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
  wheelDiameter: number = 0,
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
        wheelDiameter,
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
