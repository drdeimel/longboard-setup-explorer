/**
 * Bushing stiffness models for the Longboard Simulator.
 *
 * Models the rotational torque produced by a bushing as a function of hanger
 * rotation angle θ (the angle the hanger has rotated around the pivot axis).
 *
 * Two bushing shapes are modelled:
 * - `barrel` — near-linear stiffness with a mild progressive cubic term.
 * - `cone`   — progressive stiffness that increases nonlinearly with θ.
 *
 * Durometer (Shore A scale, 60–100) scales the base stiffness constant k.
 * Height (`standard` vs `tall`) increases the angle at which the bushing
 * begins to "bottom out" (maximum rotation limit).
 *
 * All torques are in N·mm; angles in degrees.
 */

import type { BushingConfig } from '../models/BushingConfig'

// ---------------------------------------------------------------------------
// Physical constants and calibration parameters
// ---------------------------------------------------------------------------

/**
 * Reference base stiffness at 90A durometer for a standard barrel bushing.
 * Empirically calibrated so that a 90A barrel produces ~1 N·m of torque at
 * approximately 30° of hanger rotation.
 * @units N·mm / degree
 */
const K_BARREL_REFERENCE = 0.3 // N·mm per degree at 90A

/**
 * Reference base stiffness at 90A durometer for a standard cone bushing.
 * Calibrated so that a 90A cone produces slightly less torque at small angles
 * but catches up quickly due to progressive stiffening.
 * @units N·mm / degree
 */
const K_CONE_REFERENCE = 0.3 // N·mm per degree at 90A (base)

/**
 * Cubic progression coefficient for cone bushings.
 * Controls how quickly the stiffness increases with rotation angle.
 * @units 1/degree²
 */
const CONE_CUBIC_COEFFICIENT = 0.00001

/**
 * Mild cubic term for barrel bushings (slight progressiveness).
 * @units 1/degree²
 */
const BARREL_CUBIC_COEFFICIENT = 0.00001

/**
 * Maximum rotation angle (soft limit) for a standard-height bushing in degrees.
 * Beyond this angle the bushing "bottoms out" and stiffness increases sharply.
 * @units degrees
 */
const STANDARD_MAX_ANGLE_DEG = 45

/**
 * Maximum rotation angle (soft limit) for a tall-height bushing in degrees.
 * @units degrees
 */
const TALL_MAX_ANGLE_DEG = 60

/**
 * Reference durometer for normalized stiffness constants above.
 */
const REFERENCE_DUROMETER = 90

/**
 * Stiffness exponent — how stiffness scales with durometer relative to reference.
 * A value of 2.0 means: k scales quadratically with (durometer / 90).
 */
const DUROMETER_EXPONENT = 2.0

// ---------------------------------------------------------------------------
// Core stiffness model
// ---------------------------------------------------------------------------

/**
 * Compute the base stiffness coefficient for a bushing from its configuration.
 *
 * The stiffness scales as:
 *   `k = k_ref × (durometer / reference_durometer)^exponent`
 *
 * @param config - Bushing configuration (shape, durometer, height).
 * @returns Base stiffness k in N·mm per degree.
 */
export function bushingBaseStiffness(config: BushingConfig): number {
  if (config.shape === 'none') return 0
  const durometerRatio = config.durometer / REFERENCE_DUROMETER
  const kRef =
    config.shape === 'barrel' ? K_BARREL_REFERENCE : K_CONE_REFERENCE

  return 1 * kRef * Math.pow(durometerRatio, DUROMETER_EXPONENT)
}

/**
 * Compute the maximum rotation angle (soft limit) for a bushing.
 *
 * @param config - Bushing configuration (shape, durometer, height).
 * @returns Maximum rotation angle in degrees before soft bottoming-out.
 * @units degrees
 */
export function bushingMaxAngle(config: BushingConfig): number {
  return config.height === 'tall' ? TALL_MAX_ANGLE_DEG : STANDARD_MAX_ANGLE_DEG
}

/**
 * Compute the restoring torque from a single bushing at a given hanger
 * rotation angle θ.
 *
 * **Barrel bushing:** Near-linear with mild progressiveness:
 * ```
 * M = k × θ × (1 + c_barrel × θ²)
 * ```
 *
 * **Cone bushing:** Progressive, stiffening faster:
 * ```
 * M = k × θ × (1 + c_cone × θ²)
 * ```
 *
 * Beyond the soft-limit angle, a steep exponential term is added to model
 * the "bottoming-out" effect (bushing compressed against hardware).
 *
 * The function is odd-symmetric: `M(-θ) = -M(θ)` (no bias).
 *
 * @param config     - Bushing configuration.
 * @param angleDeg   - Hanger rotation angle θ in degrees. Positive = compressed.
 * @returns Restoring torque in N·mm. Sign matches angle sign (restoring).
 * @units N·mm
 */
export function bushingTorque(config: BushingConfig, angleDeg: number): number {
  if (config.shape === 'none') return 0
  const k = bushingBaseStiffness(config)
  const maxAngle = bushingMaxAngle(config)
  const θ = angleDeg

  let baseTorque = 0
  if (config.shape === 'barrel')
  {
    baseTorque = (25.4/4.0) * k * θ * (1 + BARREL_CUBIC_COEFFICIENT * θ * θ) 
  } 
  else
  {
    const angle_ratio = Math.abs(θ)/30.0
    const coneWidthRatio = 0.3 //the width ratio of cone's narrow and wide end'
    //const coneVolumeRatio = (coneWidthRatio*coneWidthRatio+1)/2/Math.sqrt(2)
    const cone_nonlinearity = (coneWidthRatio + (1-coneWidthRatio) * angle_ratio)
    baseTorque = (25.4/4.0) * k * θ * (1 + CONE_CUBIC_COEFFICIENT *  θ * θ) * cone_nonlinearity 
  }

  return baseTorque //+ bottomOutTorque
}

/**
 * stub
 * @param config 
 * @param angleDeg 
 * @returns 
 */
export function bushingStiffness(config: BushingConfig, angleDeg: number): number {
  if (config.shape === 'none') return 0

  const delta_angle = 0.1
  const torque_a = bushingTorque(config, angleDeg-0.5*delta_angle)
  const torque_b = bushingTorque(config, angleDeg+0.5*delta_angle)

  const stiffness = (torque_b- torque_a) / delta_angle
  
  return stiffness
  
}

/**
 * Compute the combined restoring torque from both bushings (roadside +
 * boardside), given that both are compressed by the same hanger rotation
 * angle θ.
 *
 * In a standard skateboard/longboard truck, both bushings resist rotation
 * additively. One bushing compresses while the other decompresses; however,
 * a common simplification (and the one used here) is that both contribute
 * equally in the restoring direction, as the standard geometry places both
 * on the same kingpin with the same moment arm.
 *
 * @param roadsideBushing  - Configuration for the roadside bushing.
 * @param boardsideBushing - Configuration for the boardside bushing.
 * @param angleDeg         - Hanger rotation angle θ in degrees.
 * @returns Combined restoring torque in N·mm.
 * @units N·mm
 */
export function combinedBushingTorque(
  roadsideBushing: BushingConfig,
  boardsideBushing: BushingConfig,
  angleDeg: number,
): number {
  return (
    bushingTorque(roadsideBushing, angleDeg) +
    bushingTorque(boardsideBushing, angleDeg)
  )
}

/**
 * stub
 * @param roadsideBushing
 * @param boardsideBushing 
 * @param angleDeg 
 * @returns 
 */
export function combinedBushingStiffness(
  roadsideBushing: BushingConfig,
  boardsideBushing: BushingConfig,
  angleDeg: number,
): number {
  return (
    bushingStiffness(roadsideBushing, angleDeg) +
    bushingStiffness(boardsideBushing, angleDeg)
  )
}
