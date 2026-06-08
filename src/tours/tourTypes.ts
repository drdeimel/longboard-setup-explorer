/**
 * Tour system type definitions for the Longboard Truck Simulator.
 *
 * Defines the data structures used to describe tours and their steps.
 */

/** Position of the tooltip relative to the highlighted element. */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'center'

/** A single tooltip/step in a tour. */
export interface TourStep {
  /** CSS selector or element ID to highlight. */
  targetSelector: string

  /** Title shown in the explanation box. */
  title: string

  /** Explanation text shown in the explanation box. */
  description: string

  /** Position of the tooltip relative to the target element. */
  position?: TooltipPosition
}

/** A complete tour definition. */
export interface TourDefinition {
  /** Unique identifier for the tour. */
  id: string

  /** Display name shown in the tour selector. */
  name: string

  /** Brief description of what this tour covers. */
  description: string

  /** Ordered list of steps in the tour. */
  steps: TourStep[]
}
