/**
 * Net return moment computation for the Longboard Simulator.
 *
 * @deprecated Use keyGeometryDataSet.ts instead - it provides superset functionality
 * including ICR computation and is the single source of truth for geometry.
 * This file is kept for backward compatibility but will be removed in a future release.
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
import { combinedBushingTorque } from './bushingModels'
import { combinedBushingStiffness } from './bushingModels'
import { computeLeanToSteer, type LeanToSteerResult } from '../geometry/leanToSteer'
import { computeRotationAxisDist } from '../geometry/rotationAxisDist'
import type { Vec3 } from '../math/vec3'

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
}

/**
 * Compute the net return moment at a single lean angle.
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
  comHeightM: number,
  leanAngleDeg: number,
): KeyGeometryResult {
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
  const pivotAxisAngleRad = pivotAxisAngleDeg * Math.PI / 180
  const rotationAxisDist = computeRotationAxisDist(
    pivotAxisAngleDeg,
    rake,
    axleToBaseplateDistance,
    baseplateToBoard,
    leanAngleDeg,
  )

  //compute the effective rotation center height, i.e. the place where pivot and the hanger's vertical rotation axis intersect
  //This is measured from the axle (Y=0), not from ground
  //Positive rake moves the effective rotation center UP from the axle
  const invPendulumHeight = axleToBaseplateDistance+baseplateToBoard - rake / Math.cos(pivotAxisAngleRad)


  const riderForce = riderMassKg * G
  const centerOfBoardY = invPendulumHeight * Math.cos(leanRad)
  const centerOfBoardZ = invPendulumHeight * Math.sin(leanRad)
  const centerOfForceY = centerOfBoardY + (centerOfBoardZ - centerOfBoardY) * Math.tan(leanRad) 
  const centerOfForceZ = bushingTorqueNm / riderForce
  const centerOfForceAngle = Math.atan2(centerOfForceY, invPendulumHeight)
  const centerOfForceRadius = Math.sqrt(centerOfForceY*centerOfForceY + centerOfForceZ+centerOfForceZ)
  const weightGeometricStiffness = 0 - centerOfForceRadius * riderForce * Math.sin(centerOfForceAngle)

  const bushingStiffness = combinedBushingStiffness(
    roadsideBushing,
    boardsideBushing,
    hangerRotationDeg,
  )
  const totalRotationalStiffness = bushingStiffness + weightGeometricStiffness

  const horizontalStiffness = totalRotationalStiffness / centerOfForceZ
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
    horizontalStiffness
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
): KeyGeometryResult[] {
  const results: KeyGeometryResult[] = []
  const step = (maxLeanDeg - minLeanDeg) / (numSamples - 1)
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
      ),
    )
  }
  return results
}
