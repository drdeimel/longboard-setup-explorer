/**
 * 3D vector utilities for the Longboard Simulator geometry engine.
 *
 * All coordinates follow the project right-handed coordinate system:
 *   X = forward (board rolling direction)
 *   Y = up (normal to road surface)
 *   Z = lateral right (heel side for regular stance)
 *
 * Distances are in millimetres; angles are in degrees unless noted otherwise.
 */

/** A 3-component numeric vector. */
export type Vec3 = readonly [number, number, number]

/**
 * Compute the dot product of two vectors.
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Scalar dot product a · b.
 */
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/**
 * Compute the cross product of two vectors.
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Vector a × b.
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

/**
 * Compute the Euclidean length (magnitude) of a vector.
 * @param v - Input vector.
 * @returns Non-negative scalar length |v|.
 */
export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v))
}

/**
 * Normalize a vector to unit length.
 * @param v - Input vector. Must not be the zero vector.
 * @returns Unit vector v / |v|.
 * @throws {RangeError} If the input vector has zero magnitude.
 */
export function normalize(v: Vec3): Vec3 {
  const len = length(v)
  if (len === 0) {
    throw new RangeError('Cannot normalize the zero vector')
  }
  return scale(v, 1 / len)
}

/**
 * Scale a vector by a scalar factor.
 * @param v - Input vector.
 * @param s - Scalar multiplier.
 * @returns Vector s × v.
 */
export function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

/**
 * Add two vectors component-wise.
 * @param a - First vector.
 * @param b - Second vector.
 * @returns Vector a + b.
 */
export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/**
 * Subtract vector b from vector a component-wise.
 * @param a - First vector (minuend).
 * @param b - Second vector (subtrahend).
 * @returns Vector a − b.
 */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

/**
 * Negate a vector (component-wise sign flip).
 * @param v - Input vector.
 * @returns Vector −v.
 */
export function negate(v: Vec3): Vec3 {
  return [-v[0], -v[1], -v[2]]
}
