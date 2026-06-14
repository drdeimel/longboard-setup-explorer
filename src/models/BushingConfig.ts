/**
 * Bushing configuration interfaces for the Longboard Simulator.
 *
 * Each truck has two independent bushings (roadside and boardside).
 * Bushing properties determine the rotational stiffness of the hanger.
 */

/**
 * Physical shape of a bushing.
 *
 * - `'barrel'`  — cylindrical bushing with near-linear stiffness (mild progressive).
 * - `'cone'`    — conical bushing with progressive stiffness that increases
 *                 nonlinearly with rotation angle.
 * - `'none'`    — no bushing; constant zero stiffness and zero force/moment.
 */
export type BushingShape = 'barrel' | 'cone' | 'none'

/**
 * Nominal height tier of a bushing.
 *
 * - `'standard'` — Default OEM-height bushing.
 * - `'tall'`     — Extended-height bushing; increases maximum angular range
 *                  before compression bottoming.
 */
export type BushingHeight = 'standard' | 'tall'

/**
 * Configuration for a single bushing (roadside or boardside).
 *
 * @example
 * const softConeBushing: BushingConfig = {
 *   shape: 'cone',
 *   durometer: 78,
 *   height: 'standard',
 * }
 */
export interface BushingConfig {
  /**
   * Shape of the bushing, which determines the stiffness curve family.
   * Barrel bushings are near-linear; cone bushings are progressive.
   */
  shape: BushingShape

  /**
   * Durometer rating on the Shore A scale (60A – 100A).
   * Higher values indicate a stiffer bushing.
   * Typical range: 60 (very soft) to 100 (very hard).
   * @minimum 60
   * @maximum 100
   * @units Shore A
   */
  durometer: number

  /**
   * Height tier of the bushing.
   * Tall bushings provide a greater angular range before the hanger
   * compresses the bushing to its limit.
   */
  height: BushingHeight
}
