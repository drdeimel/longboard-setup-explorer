/**
 * Instantaneous Center of Rotation (ICR) / turning center computation.
 *
 * Computes the ICR locus in the top-down (XZ) plane as a function of board
 * lean angle. The ICR is the instantaneous point about which the board is
 * rotating.
 *
 * For a two-truck board:
 * - The front truck produces steer angle δ_front(φ).
 * - The rear truck produces steer angle δ_rear(φ).
 * - The ICR is at the intersection of perpendiculars to the wheel velocity
 *   vectors drawn from each axle.
 *
 * Coordinate system (origin = front axle center, top-down view):
 *   X = forward (board length direction) — horizontal on screen
 *   Z = lateral right — vertical on screen in top-down view
 *
 * The rear axle is at position (−wheelbase, 0) from the front axle.
 *
 * Steer angles are the angles the axle direction makes with the board Z axis
 * in the XZ plane. Positive steer = axle rotated toward forward-right.
 */

import { computeLeanToSteer } from './leanToSteer'
import { computePivotAxis } from './pivotAxis'
import { type Vec3 } from '../math/vec3'

/**
 * A 2D point in the top-down (XZ) plane.
 */
export interface Point2D {
  /** X coordinate — forward direction (mm from front axle center). */
  x: number
  /** Z coordinate — lateral direction (mm from board centerline). */
  z: number
}

/**
 * ICR result at a single lean angle.
 */
export interface ICRResult {
  /**
   * Board lean angle, in degrees.
   */
  leanAngleDeg: number

  /**
   * Front truck steer angle δ_front, in degrees.
   */
  frontSteerDeg: number

  /**
   * Rear truck steer angle δ_rear, in degrees.
   */
  rearSteerDeg: number

  /**
   * ICR position in the top-down plane (origin = front axle center).
   * `null` if the board is going straight (ICR at infinity).
   * @units mm from front axle center
   */
  icr: Point2D | null

  /**
   * TurningCurvature — distance from ICR to the front axle center, in mm.
   * `null` if ICR is at infinity (straight ahead).
   * @units mm
   */
  turningCurvature: number
}

/**
 * Compute the ICR at a given lean angle for a board with front and rear truck
 * parameters.
 *
 * The computation uses the Ackermann steering model in 2D (top-down view):
 * - Each axle's perpendicular bisector (the line perpendicular to the axle
 *   direction passing through the axle center) is computed.
 * - The ICR is at the intersection of these two bisectors.
 *
 * The axle direction in the top-down plane after steering is:
 *   `dir_axle = (sin δ, cos δ)` in (X, Z) coordinates where δ is steer angle.
 *   (δ = 0 → axle points along Z; δ > 0 → axle rotates toward forward-right)
 *
 * The perpendicular to the axle (the rolling direction) is:
 *   `roll_dir = (cos δ, -sin δ)` in (X, Z).
 *
 * The perpendicular bisector passes through the axle center in the direction
 * of the axle (perpendicular to the rolling direction).
 *
 * Front axle center: (0, 0) in (X, Z).
 * Rear axle center: (−wheelbase, 0) in (X, Z).
 *
 * @param frontPivotAxisAngleDeg - Front truck pivot axis angle α (degrees).
 * @param frontRake              - Front truck rake r (mm).
 * @param rearPivotAxisAngleDeg  - Rear truck pivot axis angle α_rear (degrees).
 * @param rearRake               - Rear truck rake r_rear (mm).
 * @param wheelbase              - Wheelbase L — front-to-rear axle distance (mm).
 * @param leanAngleDeg           - Board lean angle φ (degrees).
 * @returns ICR position, steer angles, and turning radius at the given lean.
 */
export function computeICR(
  frontPivotAxisAngleDeg: number,
  frontRake: number,
  rearPivotAxisAngleDeg: number,
  rearRake: number,
  wheelbase: number,
  leanAngleDeg: number,
): ICRResult {
  // Compute front and rear pivot axis direction vectors
  const { direction: frontAxisDir } = computePivotAxis(frontPivotAxisAngleDeg, frontRake)
  const { direction: rearAxisDir } = computePivotAxis(rearPivotAxisAngleDeg, rearRake)

  // Compute steer angles from lean angle
  const frontResult = computeLeanToSteer(frontAxisDir, leanAngleDeg)
  const rearResult = computeLeanToSteer(rearAxisDir, leanAngleDeg)

  const δFront = frontResult.steerAngleDeg
  const δRear = rearResult.steerAngleDeg

  // If both steer angles are nearly zero, ICR is at infinity (going straight)
  if (Math.abs(δFront) < 1e-8 && Math.abs(δRear) < 1e-8) {
    return {
      leanAngleDeg,
      frontSteerDeg: δFront,
      rearSteerDeg: δRear,
      icr: null,
      turningCurvature: 0.0,
    }
  }

  const δFRad = (δFront * Math.PI) / 180
  const δRRad = (δRear * Math.PI) / 180

  //compute the point where the board is tangential to the turning circle
  // = felt center of turning of the board
  //law of equal triangles: ratio of sines = ratio of distance front to distance rear
  const cc = (Math.sin(δRRad))/(Math.sin(δFRad))
  const icrX = wheelbase / (1+cc)

  //once we know X, we can compute curvature:
  const turningCurvature = Math.tan(δFRad) / icrX
  const icrZ = 1/turningCurvature
  
  const icr: Point2D = { x: icrX, z: icrZ }

  return {
    leanAngleDeg,
    frontSteerDeg: δFront,
    rearSteerDeg: δRear,
    icr,
    turningCurvature,
  }
}

// Suppress unused import — Vec3 type is used via computeLeanToSteer/computePivotAxis
void (null as unknown as Vec3)
