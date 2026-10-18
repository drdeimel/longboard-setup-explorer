import type { Point2D } from './turningCenter'

export type MotionViewportMode = 'follow' | 'zoom-to-fit'

export interface BoardPose {
  position: Point2D
  headingRad: number
}

export interface BoardMotionInputs {
  /** Local ICR center relative to the front-truck reference point, in mm. */
  icr: Point2D | null
  /** Board speed magnitude, in mm/s. */
  velocityMmPerSecond: number
  /** Integration step, in seconds. */
  deltaTimeSeconds: number
  /** Apply automatic heading correction toward horizontal orientation. */
  orientationCorrectionEnabled?: boolean
}

export const BOARD_MOTION_UPDATE_PERIOD_MS = 50
export const SIMULATION_TIME_SCALE = 1
export const MOTION_TRACE_DURATION_S = 20
export const MOTION_VIEW_SCALE_PX_PER_MM = 0.048
export const VIEWPORT_CAMERA_RESPONSE_S = 0.25
export const VIEWPORT_CAMERA_MARGIN_PX = 56
export const VIEWPORT_FRONT_CLEARANCE_MM = 200
export const ORIENTATION_CORRECTION_TIME_CONSTANT_S = 10 / 3
export const MOTION_VIEW_MAX_SCALE_PX_PER_MM = MOTION_VIEW_SCALE_PX_PER_MM
export const MOTION_VIEW_MIN_SCALE_PX_PER_MM = 0.001

function rotate(point: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return { x: cos * point.x - sin * point.z, z: sin * point.x + cos * point.z }
}

function normalizeAngle(angleRad: number): number {
  return ((angleRad + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
}

function nearestHorizontalOrientationError(angleRad: number): number {
  const normalized = normalizeAngle(angleRad)
  const errorToForward = normalized
  const reverseTarget = normalized >= 0 ? Math.PI : -Math.PI
  const errorToReverse = normalized - reverseTarget
  return Math.abs(errorToForward) <= Math.abs(errorToReverse) ? errorToForward : errorToReverse
}

/** Advance the front-truck reference point and board heading in floor coordinates. */
export function updateBoardPose(pose: BoardPose, inputs: BoardMotionInputs): BoardPose {
  const { icr, velocityMmPerSecond, deltaTimeSeconds, orientationCorrectionEnabled = false } = inputs
  if (deltaTimeSeconds <= 0) return pose

  const distanceMm = velocityMmPerSecond * deltaTimeSeconds
  let nextPose = pose
  if (velocityMmPerSecond !== 0) {
    if (!icr) {
      nextPose = {
        position: {
          x: pose.position.x - Math.cos(pose.headingRad) * distanceMm,
          z: pose.position.z - Math.sin(pose.headingRad) * distanceMm,
        },
        headingRad: pose.headingRad,
      }
    } else {
      const radiusMm = Math.hypot(icr.x, icr.z)
      if (radiusMm >= 1e-9) {
        // The graph places the rear truck at local +X, so board-forward travel is -X.
        // Choose the circular tangent that points most closely along that direction.
        const turnSign = -Math.sign(icr.z) || -1
        const deltaHeadingRad = turnSign * distanceMm / radiusMm
        const rotatedReference = rotate({ x: -icr.x, z: -icr.z }, deltaHeadingRad)
        const localDisplacement: Point2D = {
          x: icr.x + rotatedReference.x,
          z: icr.z + rotatedReference.z,
        }

        nextPose = {
          position: {
            x: pose.position.x + rotate(localDisplacement, pose.headingRad).x,
            z: pose.position.z + rotate(localDisplacement, pose.headingRad).z,
          },
          headingRad: pose.headingRad + deltaHeadingRad,
        }
      }
    }
  }

  if (!orientationCorrectionEnabled) return nextPose
  const orientationErrorRad = nearestHorizontalOrientationError(nextPose.headingRad)
  const correctionFraction = 1 - Math.exp(-deltaTimeSeconds / ORIENTATION_CORRECTION_TIME_CONSTANT_S)
  return { ...nextPose, headingRad: nextPose.headingRad - orientationErrorRad * correctionFraction }
}

/** Smoothly move the viewport so the board reference stays clear of its safe border. */
export function updateViewportCenter(
  center: Point2D,
  referencePosition: Point2D,
  viewportWidthPx: number,
  viewportHeightPx: number,
  deltaTimeSeconds: number,
  frontClearanceMm = VIEWPORT_FRONT_CLEARANCE_MM,
): Point2D {
  const safeMarginPx = VIEWPORT_CAMERA_MARGIN_PX + frontClearanceMm * MOTION_VIEW_SCALE_PX_PER_MM
  const safeHalfWidthMm = Math.max(0, viewportWidthPx / 2 - safeMarginPx) / MOTION_VIEW_SCALE_PX_PER_MM
  const safeHalfHeightMm = Math.max(0, viewportHeightPx / 2 - safeMarginPx) / MOTION_VIEW_SCALE_PX_PER_MM
  const target = {
    x: referencePosition.x > center.x + safeHalfWidthMm
      ? referencePosition.x - safeHalfWidthMm
      : referencePosition.x < center.x - safeHalfWidthMm
        ? referencePosition.x + safeHalfWidthMm
        : center.x,
    z: referencePosition.z > center.z + safeHalfHeightMm
      ? referencePosition.z - safeHalfHeightMm
      : referencePosition.z < center.z - safeHalfHeightMm
        ? referencePosition.z + safeHalfHeightMm
        : center.z,
  }
  const alpha = 1 - Math.exp(-deltaTimeSeconds / VIEWPORT_CAMERA_RESPONSE_S)
  return {
    x: center.x + (target.x - center.x) * alpha,
    z: center.z + (target.z - center.z) * alpha,
  }
}

export function computeZoomToFitViewport(
  points: Point2D[],
  viewportWidthPx: number,
  viewportHeightPx: number,
): { center: Point2D; scale: number } {
  if (points.length === 0) {
    return { center: { x: 0, z: 0 }, scale: MOTION_VIEW_SCALE_PX_PER_MM }
  }

  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minZ: Math.min(current.minZ, point.z),
      maxZ: Math.max(current.maxZ, point.z),
    }),
    { minX: points[0].x, maxX: points[0].x, minZ: points[0].z, maxZ: points[0].z },
  )
  const availableWidthPx = Math.max(1, viewportWidthPx - 2 * VIEWPORT_CAMERA_MARGIN_PX)
  const availableHeightPx = Math.max(1, viewportHeightPx - 2 * VIEWPORT_CAMERA_MARGIN_PX)
  const spanX = Math.max(1, bounds.maxX - bounds.minX)
  const spanZ = Math.max(1, bounds.maxZ - bounds.minZ)
  const scale = Math.max(
    MOTION_VIEW_MIN_SCALE_PX_PER_MM,
    Math.min(
      MOTION_VIEW_MAX_SCALE_PX_PER_MM,
      availableWidthPx / spanX,
      availableHeightPx / spanZ,
    ),
  )

  return {
    center: {
      x: (bounds.minX + bounds.maxX) / 2,
      z: (bounds.minZ + bounds.maxZ) / 2,
    },
    scale,
  }
}
