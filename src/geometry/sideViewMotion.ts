/**
 * Side-view wheel motion derived from the truck's lean-to-steer solution.
 *
 * The axle center is rotated around the pivot axis by the solved hanger
 * rotation. The returned X offset is the fore/aft movement shown in SideView.
 */

import { computePivotAxis } from './pivotAxis'
import { computeLeanToSteer } from './leanToSteer'
import { rotationMatrix, mulMatVec } from '../math/mat3'

export interface SideViewMotion {
  steerAngleDeg: number
  hangerRotationDeg: number
  axleOffsetX: number
  trailOffsetX: number
}

/** Fore/aft trail displacement caused by steering. */
export function computeTrailOffsetX(
  steerAngleDeg: number,
  totalHeight: number,
): number {
  const steerRad = (steerAngleDeg * Math.PI) / 180
  const testMotionArm = Math.cos(steerRad) * totalHeight
  return testMotionArm * (1 - Math.cos(steerRad))
}

/** Project a wheel rim's Z position into the side-view physical X coordinate. */
export function projectWheelRimToSideX(
  axleOffsetX: number,
  steerAngleDeg: number,
  rimZ: number,
): number {
  const steerRad = (steerAngleDeg * Math.PI) / 180
  return axleOffsetX + Math.sin(steerRad) * rimZ
}

export function computeSideViewMotion(
  pivotAxisAngleDeg: number,
  rake: number,
  leanAngleDeg: number,
  totalHeight = 0,
): SideViewMotion {
  const { direction, point } = computePivotAxis(pivotAxisAngleDeg, rake)
  const steer = computeLeanToSteer(direction, leanAngleDeg)

  // Rotate the axle-center point around the pivot axis. The origin is the
  // axle center at zero steer, so only the resulting X displacement is needed.
  const relativeAxle = [-point[0], -point[1], -point[2]] as const
  const rotatedRelativeAxle = mulMatVec(
    rotationMatrix(direction, steer.hangerRotationDeg),
    relativeAxle,
  )

  return {
    steerAngleDeg: steer.steerAngleDeg,
    hangerRotationDeg: steer.hangerRotationDeg,
    axleOffsetX: point[0] + rotatedRelativeAxle[0],
    trailOffsetX: computeTrailOffsetX(
      steer.steerAngleDeg,
      // TEST: replace trail with cos(steer) * total height.
      totalHeight,
    ),
  }
}
