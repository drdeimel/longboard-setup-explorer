/**
 * Net return moment computation for the Longboard Simulator.
 *
 * ARCHITECTURAL GUIDELINE:
 * This file handles lean-dependent physics computations (torques, stiffness, ICR).
 * For lean-independent, static truck geometry (e.g., dBoard, invPendulumHeight),
 * use the centralized functions in `src/geometry/truckGeometry.ts`.
 * This separation prevents divergence between views and physics calculations.
 *
 * Combines the bushing restoring torque with the gravitational destabilizing
 * (inverted pendulum) torque to compute the net return moment as a function
 * of board lean angle.
 *
 * Formula (from plan.md):
 * ```
 * M_net(φ) = M_bushing(θ(φ)) − m × g × d_eff(φ) × sin(φ)
 * ```
 *
 * Where:
 * - `M_bushing(θ(φ))` — combined roadside + boardside bushing torque at the
 *   hanger rotation angle θ corresponding to lean φ.
 * - `m` — rider mass in kg.
 * - `g` — gravitational acceleration (9.81 m/s²).
 * - `d_eff(φ)` — effective moment arm = perpendicular distance from pivot axis
 *   to board surface plane at lean angle φ (computed via computeRotationAxisDist),
 *   converted from mm to meters.
 * - `φ` — board lean angle in degrees.
 *
 * A positive net return moment indicates the truck tends to return to upright
 * (stable). A negative net return moment indicates the lean is self-reinforcing
 * (unstable at that lean angle).
 *
 * All torques are in N·mm; angles in degrees; distances in mm.
 */

import type { BushingConfig } from '../models/BushingConfig'
import { combinedBushingTorque, bushingStiffness } from './bushingModels'
import { computeLeanToSteer, type LeanToSteerResult } from '../geometry/leanToSteer'
import { computeICR } from '../geometry/turningCenter'
import { computeTruckGeometry } from '../geometry/truckGeometry'
import { computeSteeringMoment } from './lateralForce'
import type { Vec3 } from '../math/vec3'

/** Default visualization constants for the truck views. */
export const DISPLAY_WHEEL_OFFSET_MM = 14  // Offset from axle center to wheel contact point
export const DISPLAY_WHEEL_WIDTH_MM = 52    // Wheel width for front-view indicator
export const DISPLAY_BOARD_HALF_WIDTH_MM = 100 // Half-width of board for visualization
export const DISPLAY_GEOMETRY_WIDTH_MM = 200   // Default width for side view geometry box
export const DISPLAY_BOARD_LINE_PADDING = 20 // Padding for board line in front view

/**
 * Compute the inverse pendulum height (effective rotation center height).
 * 
 * This is the vertical distance from the axle center to the effective rotation
 * point where the pivot axis intersects the hanger's vertical rotation axis.
 * 
 * Formula: invPendulumHeight = axleToBaseplateDistance + baseplateToBoard + boardThicknessMm - rake / cos(α)
 * 
 * @param axleToBaseplateDistance - Vertical distance from axle to baseplate (mm)
 * @param baseplateToBoard - Vertical distance from baseplate to board surface (mm)
 * @param boardThicknessMm - Board thickness (mm)
 * @param rake - Rake r (mm)
 * @param pivotAxisAngleDeg - Pivot axis angle α (degrees)
 * @returns invPendulumHeight in mm
 */
export function computeInvPendulumHeight(
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  rake: number,
  pivotAxisAngleDeg: number,
): number {
  const pivotAxisAngleRad = (pivotAxisAngleDeg * Math.PI) / 180
  // Note: baseplateToBoard passed from App.tsx already includes boardThicknessMm
  return axleToBaseplateDistance + baseplateToBoard - rake / Math.cos(pivotAxisAngleRad)
}

/** Gravitational acceleration in m/s². */
const G = 9.81

/**
 * Result of the return moment computation at a single lean angle.
 */
export interface KeyGeometryResult {


  /**
   * Board lean angle φ, in degrees.
   */
  leanAngleDeg: number

  /**
   * stub
   */
  hangerRotationDeg: number

  /**
   * stub
   */
  invPendulumHeight: number
  /**
   * stub
   */
  centerOfBoardY: number
  /**
   * stub
   */
  centerOfBoardZ: number
  /**
   * stub
   */
  centerOfForceY: number
  /**
   * stub
   */
  centerOfForceZ: number
  /**
   * stub
   */
  bushingTorqueNm: number
  /**
   * stub
   */
  totalRotationalStiffness: number
  /**
   * stub
   */
  horizontalStiffness: number

  /**
   * Instantaneous Center of Rotation (ICR) X coordinate in mm.
   * Positive X is forward (board rolling direction).
   * null if trucks steer identically (parallel trucks).
   */
  turningCenterX: number | null

  /**
   * Instantaneous Center of Rotation (ICR) Z coordinate in mm.
   * Positive Z is lateral right (toward rider's heel side).
   * null if trucks steer identically (parallel trucks).
   */
  turningCenterZ: number | null

  /**
   * Turning curvature in 1/mm
   * null if trucks steer identically (parallel trucks).
   */
  turningCurvature: number

  /**
   * Total rotational torque = bushingTorqueNm + gravitational torque contribution.
   * Gravitational term = integral of weightGeometricStiffness over lean angle
   * = -invPendulumHeight × (riderForce / 1000) × sin(φ_rad)   [N·m]
   */
  totalRotationalTorqueNm: number

  /**
   * Lateral force (N) at which the total rotational torque (bushing + gravitational)
   * exactly balances the steering moment produced by that force at this lean angle.
   * Computed as: totalRotationalTorqueNm * 1000 / steeringMomentFactor
   * where steeringMomentFactor = M_steer [N·mm] per 1 N of lateral force.
   */
  lateralForceEquilibriumN: number

}

/**
 * Compute the key geometry at a single lean angle.
 *
 * @param pivotAxisDirection   - Unit vector along the truck pivot axis.
 * @param pivotAxisAngleDeg    - Pivot axis angle α (degrees).
 * @param rake                  - Rake r (mm).
 * @param axleToBaseplateDistance - Axle-to-baseplate distance (mm).
 * @param baseplateToBoard     - Baseplate-to-board distance (mm).
 * @param roadsideBushing      - Roadside bushing configuration.
 * @param boardsideBushing     - Boardside bushing configuration.
 * @param riderMassKg          - Rider mass in kg.
 * @param comHeightM            - Rider center-of-mass height above ground in m (deprecated, unused).
 * @param leanAngleDeg         - Board lean angle φ in degrees.
 * @param rearPivotAxisAngleDeg - Rear truck pivot axis angle (degrees).
 * @param rearRake              - Rear truck rake (mm).
 * @param wheelbase             - Distance between front and rear axles (mm).
 * @param trackWidth            - Track width (mm). Optional; required for wheel-board clearance.
 * @param wheelDiameter         - Wheel diameter (mm). Optional; required for wheel-board clearance.
 * @param precomputed           - Pre-computed lean-invariant values (optional, computed if not provided).
 * @returns Return moment breakdown at the given lean angle.
 */
export function computeKeyGeometry(
  pivotAxisDirection: Vec3,
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  roadsideBushing: BushingConfig,
  boardsideBushing: BushingConfig,
  riderMassKg: number,
  _comHeightM: number,
  leanAngleDeg: number,
  rearPivotAxisAngleDeg: number,
  rearRake: number,
  wheelbase: number,
  _trackWidth: number = 0,
  wheelDiameter: number = 0,
  precomputed?: {
    pivotAxisAngleRad: number
    invPendulumHeight: number
    riderForce: number
  },
): KeyGeometryResult {
  // Use precomputed values if provided, otherwise compute
  // const pivotAxisAngleRad = precomputed?.pivotAxisAngleRad ?? (pivotAxisAngleDeg * Math.PI / 180)
  
  // Use centralized geometry computation to ensure consistency
  const truckGeom = computeTruckGeometry(
    axleToBaseplateDistance,
    baseplateToBoard,
    0, // boardThicknessMm is already included in baseplateToBoard by the caller (App.tsx)
    rake,
    pivotAxisAngleDeg,
  )
  const invPendulumHeight = precomputed?.invPendulumHeight ?? truckGeom.invPendulumHeight
  
  const riderForce = precomputed?.riderForce ?? (riderMassKg * G)

  // Get hanger rotation from lean angle
  const lts: LeanToSteerResult = computeLeanToSteer(pivotAxisDirection, leanAngleDeg)
  const { hangerRotationDeg } = lts

  // Bushing restoring torque at this hanger rotation angle
  const bushingTorqueNm =  combinedBushingTorque(
    roadsideBushing,
    boardsideBushing,
    hangerRotationDeg,
  )

  const leanRad = (leanAngleDeg * Math.PI) / 180
  /*
  const rotationAxisDist = computeRotationAxisDist(
    pivotAxisAngleDeg,
    rake,
    axleToBaseplateDistance,
    baseplateToBoard,
    leanAngleDeg,
  )
  */

  //compute the effective rotation center height, i.e. the place where pivot and the hanger's vertical rotation axis intersect
  //This is measured from the axle (Y=0), not from ground
  //Positive rake moves the effective rotation center UP from the axle
  // Note: invPendulumHeight is now precomputed or computed once above

  const centerOfBoardZ = invPendulumHeight * Math.sin(leanRad)
  const centerOfBoardY = invPendulumHeight * Math.cos(leanRad)
  const centerOfForceZ =  -bushingTorqueNm * (1000 / riderForce)
  const centerOfForceY =  centerOfBoardY  - (centerOfForceZ - centerOfBoardZ) * Math.tan(leanRad) 
  // const centerOfForceAngle = Math.atan2(centerOfForceZ, centerOfForceY)
  //const centerOfForceRadius = Math.sqrt(centerOfForceY*centerOfForceY + centerOfForceZ+centerOfForceZ)
  const weightGeometricStiffness =  -invPendulumHeight * Math.cos(leanRad) * (riderForce  / 1000) * (Math.PI / 180)
  const totalRotationalStiffness = 
      bushingStiffness(roadsideBushing, hangerRotationDeg) 
    + bushingStiffness(boardsideBushing, hangerRotationDeg)  
    + weightGeometricStiffness

  const horizontalStiffness = totalRotationalStiffness / centerOfForceZ

  // --- Instantaneous Center of Rotation (ICR) computation ---
  const icrResult = computeICR(
    pivotAxisAngleDeg,
    rake,
    rearPivotAxisAngleDeg,
    rearRake,
    wheelbase,
    leanAngleDeg,
  )
  const turningCenterX: number | null = icrResult.icr?.x ?? null
  const turningCenterZ: number | null = icrResult.icr?.z ?? null
  const turningCurvature: number = icrResult.turningCurvature

  // Total rotational torque: integral of totalRotationalStiffness over lean angle.
  // = bushingTorqueNm  +  ∫₀^φ weightGeometricStiffness(φ') dφ'
  //
  // weightGeometricStiffness(φ') = -invPendulumHeight × cos(φ') × (riderForce/1000) × (π/180)
  // Integrating analytically:
  //   ∫₀^φ cos(φ') dφ' = sin(φ)   [in radians]
  // so the gravitational torque contribution is:
  //   M_grav = -invPendulumHeight × (riderForce / 1000) × sin(φ_rad)   [N·m]
  const gravitationalTorqueNm = -invPendulumHeight * (riderForce / 1000) * Math.sin(leanRad)
  const totalRotationalTorqueNm = bushingTorqueNm - gravitationalTorqueNm

  // Lateral force equilibrium: the lateral force at which the steering moment
  // equals the total rotational torque (bushing + gravitational) at this lean angle.
  // steeringMomentFactor [N·mm / N] = M_steer for 1 N of lateral force at this lean.
  const steeringMomentFactorNmmPerN = computeSteeringMoment(
    1,
    pivotAxisAngleDeg,
    rake,
    axleToBaseplateDistance,
    baseplateToBoard,
    leanAngleDeg,
    wheelDiameter,
  ).steeringMomentNmm
  const lateralForceEquilibriumN = steeringMomentFactorNmmPerN !== 0
    ? (totalRotationalTorqueNm * 1000) / steeringMomentFactorNmmPerN
    : 0

  return {
    leanAngleDeg,
    hangerRotationDeg,
    invPendulumHeight,
    centerOfBoardY,
    centerOfBoardZ,
    centerOfForceY,
    centerOfForceZ,
    bushingTorqueNm,
    totalRotationalStiffness,
    totalRotationalTorqueNm,
    horizontalStiffness,
    turningCenterX,
    turningCenterZ,
    turningCurvature,
    lateralForceEquilibriumN,
  }
}

/**
 * Generate the net return moment curve over a range of lean angles.
 *
 * @param pivotAxisDirection      - Unit vector along the truck pivot axis.
 * @param pivotAxisAngleDeg       - Pivot axis angle α (degrees).
 * @param rake                     - Rake r (mm).
 * @param axleToBaseplateDistance - Axle-to-baseplate distance (mm).
 * @param baseplateToBoard        - Baseplate-to-board distance (mm).
 * @param roadsideBushing          - Roadside bushing configuration.
 * @param boardsideBushing         - Boardside bushing configuration.
 * @param riderMassKg              - Rider mass in kg.
 * @param comHeightM              - Rider CoM height above ground in m (deprecated, unused).
 * @param minLeanDeg              - Minimum lean angle (degrees).
 * @param maxLeanDeg              - Maximum lean angle (degrees).
 * @param numSamples              - Number of evenly-spaced samples.
 * @param rearPivotAxisAngleDeg   - Rear truck pivot axis angle (degrees).
 * @param rearRake                - Rear truck rake (mm).
 * @param wheelbase               - Distance between front and rear axles (mm).
 * @param trackWidth              - Track width (mm). Optional; required for wheel-board clearance.
 * @param wheelDiameter           - Wheel diameter (mm). Optional; required for wheel-board clearance.
 * @returns Array of return moment results over the lean angle range.
 */
export function returnKeyGeometryCurves(
  pivotAxisDirection: Vec3,
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  roadsideBushing: BushingConfig,
  boardsideBushing: BushingConfig,
  riderMassKg: number,
  comHeightM: number,
  minLeanDeg: number,
  maxLeanDeg: number,
  numSamples: number,
  rearPivotAxisAngleDeg: number,
  rearRake: number,
  wheelbase: number,
  trackWidth: number = 0,
  wheelDiameter: number = 0,
): KeyGeometryResult[] {
  const results: KeyGeometryResult[] = []
  const step = (maxLeanDeg - minLeanDeg) / (numSamples - 1)

  // Pre-compute lean-invariant values once using centralized geometry computation
  const pivotAxisAngleRad = pivotAxisAngleDeg * Math.PI / 180
  const truckGeom = computeTruckGeometry(
    axleToBaseplateDistance,
    baseplateToBoard,
    0, // boardThicknessMm is already included in baseplateToBoard by the caller (App.tsx)
    rake,
    pivotAxisAngleDeg,
  )
  const riderForce = riderMassKg * G
  const precomputed = {
    pivotAxisAngleRad,
    invPendulumHeight: truckGeom.invPendulumHeight,
    riderForce,
  }

  for (let i = 0; i < numSamples; i++) {
    const lean = minLeanDeg + i * step
    results.push(
      computeKeyGeometry(
        pivotAxisDirection,
        pivotAxisAngleDeg,
        rake,
        axleToBaseplateDistance,
        baseplateToBoard,
        roadsideBushing,
        boardsideBushing,
        riderMassKg,
        comHeightM,
        lean,
        rearPivotAxisAngleDeg,
        rearRake,
        wheelbase,
        trackWidth,
        wheelDiameter,
        precomputed,
      ),
    )
  }
  return results
}
