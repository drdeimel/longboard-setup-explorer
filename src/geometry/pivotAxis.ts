/**
 * Pivot axis geometry for the Longboard Simulator.
 *
 * Computes the 3D line representing a truck's pivot axis from the three
 * fundamental truck parameters: pivot axis angle, rake, and axle-to-board
 * distance.
 *
 * Coordinate system (origin = axle center):
 *   X = forward (board rolling direction)
 *   Y = up (normal to road surface)
 *   Z = lateral right
 *
 * All distances in mm; all angles in degrees.
 */

import { type Vec3, scale } from '../math/vec3'

/**
 * A 3D line described by a point on the line and a unit direction vector.
 */
export interface PivotAxisLine {
  /**
   * A point on the pivot axis line (closest to the axle center / origin).
   * Coordinates in mm.
   */
  point: Vec3

  /**
   * Unit direction vector along the pivot axis.
   * Points in the general upward–forward direction (positive Y component
   * for typical truck angles of 20°–65°).
   */
  direction: Vec3
}

/**
 * Compute the 3D pivot axis line for a truck from its geometry parameters.
 *
 * The pivot axis lies in the XY plane (no lateral tilt) for a single-pivot
 * truck. Its direction is `n̂ = (cos α, sin α, 0)` where `α` is the pivot
 * axis angle above horizontal.
 *
 * The closest point on the axis to the origin (axle center) is determined
 * by the rake `r`. Rake is the signed perpendicular distance from the axle
 * center to the axis line in the XY plane. The perpendicular to `n̂` in the
 * XY plane is `n̂_perp = (−sin α, cos α, 0)`, so:
 *
 *   P_axis = r × n̂_perp = r × (−sin α, cos α, 0)
 *
 * This means positive rake shifts the axis point forward and upward relative
 * to the axle center (i.e., the axis passes above/ahead of the axle).
 *
 * @param pivotAxisAngleDeg - Angle `α` of the pivot axis above horizontal
 *   in the XY (side-view) plane. In degrees. Typical range: 20°–65°.
 * @param rake - Perpendicular distance `r` from axle center to pivot axis
 *   line, in the XY plane. In mm. Positive = axis passes forward of axle.
 * @returns `PivotAxisLine` — unit direction vector and point on the axis.
 */
export function computePivotAxis(
  pivotAxisAngleDeg: number,
  rake: number,
): PivotAxisLine {
  const α = (pivotAxisAngleDeg * Math.PI) / 180

  // Unit direction vector along the pivot axis (lies in XY plane)
  const direction: Vec3 = [Math.cos(α), Math.sin(α), 0]

  // Perpendicular direction in XY plane (90° CCW from direction)
  // n̂_perp = (−sin α,  cos α,  0)
  const perpXY: Vec3 = [-Math.sin(α), Math.cos(α), 0]

  // Point on axis (closest to origin) displaced by rake along the perpendicular
  const point: Vec3 = scale(perpXY, rake)

  return { direction, point }
}

/**
 * Compute the board surface height above the axle center.
 *
 * The board surface is the plane `y = axleToBoardDistance` in the coordinate
 * system with origin at the axle center. This is the sum of:
 *   - `axleToBaseplateDistance`: vertical distance from axle center up to the
 *     truck baseplate mounting face.
 *   - `baseplateToBoard`: vertical distance from the baseplate up to the board
 *     bottom surface (includes board thickness and risers).
 *
 * @param axleToBaseplateDistance - Vertical distance from axle center to the
 *   top of the truck baseplate, in mm.
 * @param baseplateToBoard - Vertical distance from baseplate top to board
 *   bottom (riser + board thickness), in mm.
 * @returns Board surface Y coordinate above axle center, in mm.
 */
export function boardSurfaceHeight(
  axleToBaseplateDistance: number,
  baseplateToBoard: number,
): number {
  return axleToBaseplateDistance + baseplateToBoard
}


