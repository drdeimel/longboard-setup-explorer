/**
 * Lean-to-steer mapping for the Longboard Simulator.
 *
 * Computes the steering angle produced when a board leans by a given angle,
 * using the exact 3D rotation approach (Rodrigues formula). No small-angle
 * approximations are ever used — this is a project invariant (see AGENTS.md §5).
 *
 * ## Geometry
 *
 * When the board leans by angle φ around the forward X axis, the truck hanger
 * is constrained to rotate around the pivot axis. The hanger rotation angle θ
 * brings the axle back to the road plane (y = 0).
 *
 * The steer angle δ is the angle that the final axle direction makes with the
 * Z axis in the XZ plane: `δ = atan2(axle_x, axle_z)`.
 *
 * ## Method
 *
 * 1. Apply board lean: R_lean = R_x(φ).
 * 2. Rotate the pivot axis direction: `n̂' = R_lean · n̂`.
 * 3. Rotate the initial axle vector (0,0,1) with the board lean to get the
 *    "would-be" leaned axle: `a_lean = R_lean · (0,0,1)`.
 * 4. Find θ such that rotating `a_lean` around `n̂'` gives y=0:
 *    Using Rodrigues formula: `a(θ)_y = 0`.
 *    Solved via: A·cos θ + B·sin θ = −C (linear in sin/cos).
 *    Two solutions exist; we pick the one with |θ| ≤ π (physically the
 *    shorter rotation, corresponding to a real truck hanger).
 * 5. Apply the hanger rotation to get the final axle direction.
 * 6. Extract steer angle from the XZ projection.
 */

import { type Vec3, dot, cross, normalize } from '../math/vec3'
import { rotationMatrix, mulMatVec } from '../math/mat3'

/**
 * Result of the lean-to-steer computation.
 */
export interface LeanToSteerResult {
  /**
   * Board lean angle input, in degrees.
   */
  leanAngleDeg: number

  /**
   * Steering angle δ, in degrees.
   * Positive steer to the right (positive Z side) when leaning right.
   */
  steerAngleDeg: number

  /**
   * Hanger rotation angle θ around the pivot axis, in degrees.
   * This is the mechanical rotation of the truck hanger.
   */
  hangerRotationDeg: number
}

/**
 * Compute the steering angle produced by a given board lean angle using
 * exact 3D rotation (Rodrigues formula). No small-angle approximations.
 *
 * @param pivotAxisDirection - Unit vector along the pivot axis in the
 *   axle-center coordinate frame (Y up, X forward, Z right). Must be
 *   normalised. Typically `(cos α, sin α, 0)` for a standard truck.
 * @param leanAngleDeg - Board lean angle φ in degrees. Positive = lean to
 *   the right (rotation around +X axis).
 * @returns Steer angle δ in degrees and hanger rotation θ in degrees.
 */
export function computeLeanToSteer(
  pivotAxisDirection: Vec3,
  leanAngleDeg: number,
): LeanToSteerResult {
  // Step 1: Apply board lean — rotate the truck frame around the X axis by φ.
  const R_lean = rotationMatrix([1, 0, 0], leanAngleDeg)
  const nLean = normalize(mulMatVec(R_lean, pivotAxisDirection))

  // The axle vector after board lean (before hanger compensation)
  const axleLeaned = mulMatVec(R_lean, [0, 0, 1] as Vec3)

  // Step 2: Find hanger rotation θ around nLean such that y-component of
  // final axle = 0 (axle stays in road plane).
  //
  // Rodrigues: a' = a cos θ + (k × a) sin θ + k (k · a)(1 - cos θ)
  // where a = axleLeaned, k = nLean.
  //
  // Setting a'_y = 0:
  //   a_y cos θ + (k × a)_y sin θ + k_y (k · a)(1 - cos θ) = 0
  //
  // Rearranging:
  //   [a_y - k_y (k·a)] cos θ + [(k×a)_y] sin θ = -k_y (k·a)
  //   A cos θ + B sin θ = -C
  //
  // where:
  //   A = a_y - k_y (k·a)
  //   B = (k×a)_y
  //   C = k_y (k·a)

  const a = axleLeaned
  const k = nLean
  const kDotA = dot(k, a)
  const kCrossA = cross(k, a)

  const A = a[1] - k[1] * kDotA
  const B = kCrossA[1]
  const C = k[1] * kDotA

  // Solve A cos θ + B sin θ = -C
  // R = sqrt(A²+B²), φ0 = atan2(B,A)
  // Solutions: θ = -φ0 ± acos(-C/R) [or equivalently: atan2(B,A) ± acos(-C/R)]
  //
  // We want the solution with smallest |θ| that preserves the correct steer
  // direction sign — physically the hanger takes the shortest rotation.

  const R_mag = Math.sqrt(A * A + B * B)

  let hangerRotationRad: number

  if (R_mag < 1e-10) {
    // Degenerate case: pivot axis perpendicular to this constraint
    // (e.g. 0° pivot axis angle — no steer). θ = 0.
    hangerRotationRad = 0
  } else {
    const cosOffset = -C / R_mag
    // Clamp to [-1, 1] for numerical safety
    const cosOffsetClamped = Math.max(-1, Math.min(1, cosOffset))
    const offset = Math.acos(cosOffsetClamped)
    const phi0 = Math.atan2(B, A)

    // Two candidate solutions
    const θ1 = phi0 + offset
    const θ2 = phi0 - offset

    // Wrap both solutions to (-π, π] range to find the physically short rotation
    const wrapPi = (angle: number): number => {
      let a2 = angle % (2 * Math.PI)
      if (a2 > Math.PI) a2 -= 2 * Math.PI
      if (a2 <= -Math.PI) a2 += 2 * Math.PI
      return a2
    }

    const θ1w = wrapPi(θ1)
    const θ2w = wrapPi(θ2)

    // Pick the solution with smaller magnitude (shorter hanger rotation).
    // Both solutions satisfy the y=0 constraint; the smaller-magnitude one
    // is the physically correct (non-inverted) hanger position.
    if (Math.abs(θ1w) <= Math.abs(θ2w)) {
      hangerRotationRad = θ1w
    } else {
      hangerRotationRad = θ2w
    }
  }

  // Step 3: Apply the computed hanger rotation to get the final axle direction.
  const hangerRotationDeg = (hangerRotationRad * 180) / Math.PI
  const R_hanger = rotationMatrix(k, hangerRotationDeg)
  const axleFinal = mulMatVec(R_hanger, a)

  // Step 4: Extract steer angle from the axle projection onto the XZ plane.
  // δ = -atan2(axle.x, axle.z) — angle of axle from Z axis in XZ plane.
  //
  // Sign convention: positive steer corresponds to positive lean (heel-side lean
  // → positive steer angle). Negation is applied because in the right-hand
  // coordinate system (X forward, Z right), clockwise hanger rotation (when
  // viewed from above) produces negative X component in the axle but physically
  // corresponds to a "right steer" (turning toward the lean direction).
  // See plans/insights.md for the full explanation.
  const steerAngleDeg = -(Math.atan2(axleFinal[0], axleFinal[2]) * 180) / Math.PI

  return {
    leanAngleDeg,
    steerAngleDeg,
    hangerRotationDeg,
  }
}

/**
 * Generate a lean-to-steer curve by sampling over a range of lean angles.
 *
 * @param pivotAxisDirection - Unit vector along the pivot axis.
 * @param minLeanDeg - Minimum lean angle to sample, in degrees.
 * @param maxLeanDeg - Maximum lean angle to sample, in degrees.
 * @param numSamples - Number of evenly-spaced samples (inclusive of endpoints).
 * @returns Array of `{leanAngleDeg, steerAngleDeg, hangerRotationDeg}` results.
 */
export function leanToSteerCurve(
  pivotAxisDirection: Vec3,
  minLeanDeg: number,
  maxLeanDeg: number,
  numSamples: number,
): LeanToSteerResult[] {
  const results: LeanToSteerResult[] = []
  const step = (maxLeanDeg - minLeanDeg) / (numSamples - 1)
  for (let i = 0; i < numSamples; i++) {
    const lean = minLeanDeg + i * step
    results.push(computeLeanToSteer(pivotAxisDirection, lean))
  }
  return results
}
