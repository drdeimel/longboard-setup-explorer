/**
 * Top-level board setup configuration interface for the Longboard Simulator.
 *
 * A `BoardSetupConfig` represents one complete, named board setup that can be
 * compared against other setups in the simulator. The app maintains a list of
 * these setups; all diagrams and charts overlay curves for every active setup.
 *
 * Distances are in millimetres; angles in degrees.
 */

import type { TruckConfig } from './TruckConfig'
import type { RearTruckConfig } from './RearTruckConfig'

/**
 * The single canonical default for maximum lean angle (degrees).
 * All presets, default setups, and chart fallbacks import from here
 * to ensure a single line controls the default value app-wide.
 */
export const DEFAULT_MAX_LEAN = 30

/**
 * A complete board setup: front truck, rear truck, board-level parameters,
 * and display metadata.
 *
 * @example
 * const defaultSetup: BoardSetupConfig = {
 *   id: 'setup-1',
 *   name: 'Standard RKP 50°',
 *   color: '#ef4444',
 *   wheelbase: 760,
 *   frontTruck: { ... },
 *   rearTruck: { pivotAxisAngle: 47, rake: 0 },
 * }
 */
export interface BoardSetupConfig {
  /**
   * Unique identifier for this setup.
   * Generated on creation and never mutated.
   */
  id: string

  /**
   * Human-readable display name for this setup.
   * Editable via the ConfigPanel rename field.
   */
  name: string

  /**
   * CSS hex color string (e.g. `'#ef4444'`) used to identify this setup in
   * chart curves, SVG annotations, and the config panel color swatch.
   */
  color: string

  /**
   * Wheelbase `L` — the center-to-center distance between the front and rear
   * truck axles. Used for the top-down turning center / ICR locus computation.
   * @units mm
   * @minimum 400
   */
  wheelbase: number

  /**
   * Full geometry and bushing configuration for the front truck.
   * Drives all diagrams, charts, and derived parameter computations.
   */
  frontTruck: TruckConfig

  /**
   * Minimal geometry configuration for the rear truck.
   * Used only for the top-down ICR locus in `TopView`.
   */
  rearTruck: RearTruckConfig
}
