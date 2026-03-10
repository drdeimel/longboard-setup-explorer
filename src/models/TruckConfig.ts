/**
 * Front truck configuration interface for the Longboard Simulator.
 *
 * The front truck provides the full set of geometric parameters that drive
 * all diagrams and charts. Distances are in millimetres; angles in degrees.
 *
 * Origin of the coordinate system is the **axle center**:
 *   X = forward, Y = up, Z = lateral right.
 */

import type { BushingConfig } from './BushingConfig'

/**
 * Discriminated union tag for the truck pivot mechanism type.
 *
 * Currently only `'single-pivot'` is fully implemented.
 * The `'dual-pivot'` variant is a future extension stub (see Phase 8 / AGENTS.md).
 */
export type TruckType = 'single-pivot' | 'dual-pivot'

/**
 * Full geometry and bushing configuration for a front truck.
 *
 * All positional parameters are defined relative to the axle center as the
 * origin, using the project right-handed coordinate system (X forward, Y up,
 * Z lateral right).
 *
 * @see {@link RearTruckConfig} for the minimal rear-truck interface.
 *
 * @example
 * const standardRKP50: TruckConfig = {
 *   type: 'single-pivot',
 *   pivotAxisAngle: 50,
 *   rake: 0,
 *   axleToBaseplateDistance: 38,
 *   baseplateToBoard: 4,
 * wheelDiameter: 150,
 *   trackWidth: 218,
 *   bushingMomentArm: 25,
 *   roadsideBushing: { shape: 'cone',   durometer: 90, height: 'standard' },
 *   boardsideBushing: { shape: 'barrel', durometer: 90, height: 'standard' },
 * }
 */
export interface TruckConfig {
  /**
   * Pivot mechanism type.
   * Must be `'single-pivot'` for the currently implemented geometry engine.
   */
  type: TruckType

  /**
   * Pivot axis angle `α` — angle of the pivot axis above horizontal,
   * measured in the XY (side-view) plane.
   * @units degrees
   * @range 0° (horizontal) – 90° (vertical)
   */
  pivotAxisAngle: number

  /**
   * Rake `r` — perpendicular distance from the axle center to the pivot axis
   * line, measured in the XY plane. Positive values shift the pivot axis
   * forward of the axle center.
   * @units mm
   */
  rake: number

  /**
   * Vertical distance from the axle center to the top surface of the
   * truck's baseplate (i.e., the baseplate mounting face that contacts the board).
   * @units mm
   * @minimum 0
   */
  axleToBaseplateDistance: number

  /**
   * Vertical distance from the baseplate top surface to the bottom of the board.
   * Includes board thickness and any risers added between board and baseplate.
   * @units mm
   * @minimum 0
   */
  baseplateToBoard: number

  /**
   * Wheel diameter `d_wheel`. Defines the road surface as a constraint plane at
   * `y = −d_wheel/2` relative to the axle center. Limits the maximum lean angle
   * before wheel bite.
   * @units mm
   * @minimum 60
   */
  wheelDiameter: number

  /**
   * Track width `w_track` — lateral distance between the two wheel contact
   * patches (hanger width, side to side). Used as the moment arm when
   * computing steering moment from a lateral centripetal force.
   * @units mm
   * @minimum 100
   */
  trackWidth: number

  /**
   * Bushing moment arm `d_bushing` — distance along the pivot axis from the
   * axle plane (origin) to the bushing seat. Determines the mechanical advantage
   * of the bushing force on hanger rotation.
   * @units mm
   * @minimum 0
   */
  bushingMomentArm: number

  /**
   * Configuration of the roadside bushing (wheel side of the kingpin).
   */
  roadsideBushing: BushingConfig

  /**
   * Configuration of the boardside bushing (board side of the kingpin).
   */
  boardsideBushing: BushingConfig
}
