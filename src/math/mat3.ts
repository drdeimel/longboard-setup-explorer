/**
 * 3×3 rotation matrix utilities for the Longboard Simulator geometry engine.
 *
 * Rotation matrices are stored in **row-major order** as a flat array of 9 numbers:
 *   [m00, m01, m02,
 *    m10, m11, m12,
 *    m20, m21, m22]
 *
 * Index formula: `m[row * 3 + col]`
 *
 * The Rodrigues formula is used exclusively — no small-angle approximations.
 */

import { type Vec3, dot, cross, scale, add } from './vec3'

/** A 3×3 matrix stored in row-major order as 9 numbers. */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
]

/**
 * Construct the 3×3 rotation matrix for a rotation of `angleDeg` degrees
 * around the unit axis `axis` using the Rodrigues rotation formula.
 *
 * R = I·cos θ + sin θ·[axis]× + (1 − cos θ)·(axis ⊗ axis)
 *
 * @param axis     - Unit vector defining the rotation axis. Must be normalised.
 * @param angleDeg - Rotation angle in **degrees** (positive = right-hand rule).
 * @returns 3×3 rotation matrix in row-major order.
 */
export function rotationMatrix(axis: Vec3, angleDeg: number): Mat3 {
  const θ = (angleDeg * Math.PI) / 180
  const c = Math.cos(θ)
  const s = Math.sin(θ)
  const t = 1 - c

  const [ux, uy, uz] = axis

  return [
    // Row 0
    t * ux * ux + c,       t * ux * uy - s * uz,  t * ux * uz + s * uy,
    // Row 1
    t * ux * uy + s * uz,  t * uy * uy + c,       t * uy * uz - s * ux,
    // Row 2
    t * ux * uz - s * uy,  t * uy * uz + s * ux,  t * uz * uz + c,
  ]
}

/**
 * Multiply a 3×3 matrix by a 3-component vector: result = M · v.
 *
 * @param m - 3×3 rotation matrix in row-major order.
 * @param v - 3-component column vector.
 * @returns Resulting 3-component vector M·v.
 */
export function mulMatVec(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}

/**
 * Multiply two 3×3 matrices: result = A · B.
 *
 * @param a - Left 3×3 matrix in row-major order.
 * @param b - Right 3×3 matrix in row-major order.
 * @returns Product matrix A·B in row-major order.
 */
export function mulMat(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0]*b[0] + a[1]*b[3] + a[2]*b[6],
    a[0]*b[1] + a[1]*b[4] + a[2]*b[7],
    a[0]*b[2] + a[1]*b[5] + a[2]*b[8],

    a[3]*b[0] + a[4]*b[3] + a[5]*b[6],
    a[3]*b[1] + a[4]*b[4] + a[5]*b[7],
    a[3]*b[2] + a[4]*b[5] + a[5]*b[8],

    a[6]*b[0] + a[7]*b[3] + a[8]*b[6],
    a[6]*b[1] + a[7]*b[4] + a[8]*b[7],
    a[6]*b[2] + a[7]*b[5] + a[8]*b[8],
  ]
}

/**
 * Transpose a 3×3 matrix.
 *
 * For rotation matrices this is equivalent to the inverse.
 *
 * @param m - 3×3 matrix in row-major order.
 * @returns Transposed matrix Mᵀ in row-major order.
 */
export function transpose(m: Mat3): Mat3 {
  return [
    m[0], m[3], m[6],
    m[1], m[4], m[7],
    m[2], m[5], m[8],
  ]
}

/**
 * Return the 3×3 identity matrix.
 *
 * @returns Identity matrix I₃.
 */
export function identity(): Mat3 {
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]
}

// Re-export Vec3 helpers used internally so callers can import from a single place.
export { dot, cross, scale, add }
