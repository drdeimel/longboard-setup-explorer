/**
 * Rotation axis distance computation for the Longboard Simulator.
 *
 * Computes the perpendicular distance from the pivot axis line to the board
 * surface plane as a function of lean angle. This "effective pivot height"
 * determines how far the virtual steering pivot is from the board, which
 * affects steering feel and the scaling of the steering moment.
 *
 * Coordinate system (origin = axle center):
 *   X = forward, Y = up, Z = lateral right
 *
 * The board surface plane is horizontal at `y = axleToBoardDistance`
 * (above the axle center). At zero lean this is the XZ plane offset by
 * `axleToBoardDistance` in Y.
 *
 * When the board leans by φ around the X axis, the board surface plane
 * tilts; however for the purpose of this computation we define the
 * "effective rotation axis distance" as the distance from the pivot axis
 * to the board center-line plane in the leaned configuration.
 */

import { type Vec3, dot, cross, normalize, length, scale, add } from '../math/vec3'
import { rotationMatrix, mulMatVec } from '../math/mat3'
import { computePivotAxis } from './pivotAxis'

/**
 * Result of the rotation axis distance computation at a given lean angle.
 */
export interface RotationAxisDistResult {
  /**
   * Board lean angle, in degrees.
   */
  leanAngleDeg: number

  /**
   * Perpendicular distance from the pivot axis line to the board surface
   * plane, in mm. This is the effective moment arm for lateral forces
   * applied at the board surface.
   * @units mm
   */
  distanceMm: number
}

/**
 * Compute the perpendicular distance from the pivot axis line to the
 * board surface plane at a given lean angle.
 *
 * The board surface plane passes through the point `(0, d_board, 0)` where
 * `d_board = axleToBaseplateDistance + baseplateToBoard` (the board Y offset
 * above the axle center). At lean angle φ, the board surface plane normal
 * tilts with the board: `n_plane = R_x(φ) · (0, 1, 0) = (0, cos φ, -sin φ)`.
 *
 * The pivot axis line is: `P(t) = pointOnAxis + t × directionOfAxis`.
 * After board lean φ, the pivot axis also tilts with the board:
 *   `dir' = R_x(φ) · dir`
 *   `point' = R_x(φ) · point` (if the point is on the truck body)
 *
 * The perpendicular distance from a line to a plane is:
 * - If the line is parallel to the plane (direction ⊥ plane normal): distance
 *   = |dot(point_on_line − point_on_plane, plane_normal)|
 * - If the line is not parallel (would intersect the plane): distance = 0
 *   at the intersection; we report the distance at the intersection point,
 *   which equals 0 in this case.
 *
 * For the lean-to-steer analysis the relevant distance is the perpendicular
 * offset from the pivot axis to the board surface measured along the board's
 * normal, evaluated at the point on the axis closest to the board.
 *
 * In practice for a typical truck configuration (pivot axis in XY plane),
 * the relevant scalar is the distance measured perpendicular to the board
 * in the board's own reference frame. This equals:
 *   `d_eff(φ) = |dot(P_board − P_axis, n_board)| `
 * where `P_board` is the board center (0, d_board, 0) in the upright frame,
 * `P_axis` is the closest point on the pivot axis in the upright frame,
 * and `n_board` is the board normal after lean.
 *
 * @param pivotAxisAngleDeg  - Pivot axis angle α above horizontal (degrees).
 * @param rake               - Rake r in mm (perpendicular offset of axis from axle).
 * @param axleToBaseplateDistance - Vertical distance axle → baseplate (mm).
 * @param baseplateToBoard   - Vertical distance baseplate → board surface (mm).
 * @param leanAngleDeg       - Board lean angle φ in degrees.
 * @returns Distance in mm from pivot axis to board surface plane.
 */
export function computeRotationAxisDist(
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  leanAngleDeg: number,
): RotationAxisDistResult {
  const dBoard = axleToBaseplateDistance + baseplateToBoard

  // Pivot axis in the un-leaned (upright) truck frame
  const { direction: axisDir, point: axisPoint } = computePivotAxis(
    pivotAxisAngleDeg,
    rake,
  )

  // Rotate both the axis direction and axis point with the board lean
  const R_lean = rotationMatrix([1, 0, 0], leanAngleDeg)
  const axisDirLeaned = normalize(mulMatVec(R_lean, axisDir))
  const axisPointLeaned = mulMatVec(R_lean, axisPoint)

  // Board surface plane normal after lean (initially Y axis, rotated by φ around X)
  // n_board = R_x(φ) · (0,1,0) = (0, cos φ, -sin φ)
  const leanRad = (leanAngleDeg * Math.PI) / 180
  const normalBoard: Vec3 = [0, Math.cos(leanRad), -Math.sin(leanRad)]

  // Board surface reference point (origin of board, in world frame after lean)
  // The board center at height dBoard, leaned: R_x(φ) · (0, dBoard, 0)
  const boardCenter: Vec3 = mulMatVec(R_lean, [0, dBoard, 0] as Vec3)

  // Check if axis line is parallel to the board plane
  // (dot(axisDirLeaned, normalBoard) ≈ 0 → parallel)
  const alignmentWithNormal = dot(axisDirLeaned, normalBoard)

  let distanceMm: number

  if (Math.abs(alignmentWithNormal) < 1e-9) {
    // Pivot axis is parallel to the board plane — compute constant offset distance
    const ptDiff: Vec3 = [
      boardCenter[0] - axisPointLeaned[0],
      boardCenter[1] - axisPointLeaned[1],
      boardCenter[2] - axisPointLeaned[2],
    ]
    distanceMm = Math.abs(dot(ptDiff, normalBoard))
  } else {
    // Pivot axis intersects the board plane at some point.
    // Find the parameter t* where the line hits the plane:
    //   dot(axisPointLeaned + t* × axisDirLeaned − boardCenter, normalBoard) = 0
    // t* = dot(boardCenter − axisPointLeaned, normalBoard) / dot(axisDirLeaned, normalBoard)
    const ptDiff: Vec3 = [
      boardCenter[0] - axisPointLeaned[0],
      boardCenter[1] - axisPointLeaned[1],
      boardCenter[2] - axisPointLeaned[2],
    ]
    const tStar = dot(ptDiff, normalBoard) / alignmentWithNormal

    // Intersection point
    const intersection = add(axisPointLeaned, scale(axisDirLeaned, tStar))

    // The "effective distance" is now the lateral (in-plane) offset from the
    // intersection point to the board center, projected away from the axis direction.
    const toCenter: Vec3 = [
      boardCenter[0] - intersection[0],
      boardCenter[1] - intersection[1],
      boardCenter[2] - intersection[2],
    ]

    // Remove the component along the axis direction to get the perp offset
    const projOnAxis = dot(toCenter, axisDirLeaned)
    const perpComponent: Vec3 = [
      toCenter[0] - axisDirLeaned[0] * projOnAxis,
      toCenter[1] - axisDirLeaned[1] * projOnAxis,
      toCenter[2] - axisDirLeaned[2] * projOnAxis,
    ]
    distanceMm = length(perpComponent)
  }

  return { leanAngleDeg, distanceMm }
}

/**
 * Generate a rotation axis distance curve by sampling over a lean angle range.
 *
 * @param pivotAxisAngleDeg       - Pivot axis angle α (degrees).
 * @param rake                    - Rake r (mm).
 * @param axleToBaseplateDistance - Axle-to-baseplate distance (mm).
 * @param baseplateToBoard        - Baseplate-to-board distance (mm).
 * @param minLeanDeg              - Minimum lean angle (degrees).
 * @param maxLeanDeg              - Maximum lean angle (degrees).
 * @param numSamples              - Number of evenly-spaced samples.
 * @returns Array of `{leanAngleDeg, distanceMm}` results.
 */
export function rotationAxisDistCurve(
  pivotAxisAngleDeg: number,
  rake: number,
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
  minLeanDeg: number,
  maxLeanDeg: number,
  numSamples: number,
): RotationAxisDistResult[] {
  const results: RotationAxisDistResult[] = []
  const step = (maxLeanDeg - minLeanDeg) / (numSamples - 1)
  for (let i = 0; i < numSamples; i++) {
    const lean = minLeanDeg + i * step
    results.push(
      computeRotationAxisDist(
        pivotAxisAngleDeg,
        rake,
        axleToBaseplateDistance,
        baseplateToBoard,
        lean,
      ),
    )
  }
  return results
}

// Suppress unused import warning for `cross`
void (cross as unknown as number)
