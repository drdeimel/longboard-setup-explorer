/**
 * Rear truck configuration interface for the Longboard Simulator.
 *
 * The rear truck uses a minimal parameter set. Only the pivot axis geometry is
 * needed because the rear truck contributes solely to the top-down turning
 * center / ICR locus computation — it does not independently drive the bushing
 * model, return moment, or SVG diagram views.
 *
 * Distances are in millimetres; angles in degrees.
 */

/**
 * Minimal geometry configuration for the rear truck.
 *
 * @see {@link TruckConfig} for the full front-truck interface with bushing
 * and detailed geometry parameters.
 *
 * @example
 * const rearTruck: RearTruckConfig = {
 *   pivotAxisAngle: 47,
 *   rake: 0,
 * }
 */
export interface RearTruckConfig {
  /**
   * Pivot axis angle `α_rear` — angle of the rear truck pivot axis above
   * horizontal, measured in the XY (side-view) plane.
   * @units degrees
   * @range 0° (horizontal) – 90° (vertical)
   */
  pivotAxisAngle: number

  /**
   * Rake `r_rear` — perpendicular distance from the rear axle center to the
   * rear pivot axis line, measured in the XY plane. Positive shifts forward.
   * @units mm
   */
  rake: number
}
