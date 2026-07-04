/**
 * Centralized cache for key geometry curves.
 * 
 * ARCHITECTURAL GUIDELINE:
 * This module provides a memoized cache for `keyGeometryCurves` to ensure that
 * expensive geometry computations are only performed when their dependencies change.
 * View components should consume this cache rather than computing curves inline.
 */

import { useMemo } from 'react'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import type { RiderParams } from '../components/ConfigPanel'
import { computePivotAxis } from './pivotAxis'
import { returnKeyGeometryCurves, type KeyGeometryResult } from '../physics/keyGeometryDataSet'

export interface KeyGeometryCurveData {
  setupId: string
  maxLeanDeg: number
  curve: KeyGeometryResult[]
}

const DEFAULT_MAX_LEAN = 45
const DEFAULT_SAMPLES = 91

/**
 * Hook to get memoized key geometry curves for a list of setups.
 * 
 * @param setups - Array of board setup configurations.
 * @param riderParams - Global rider parameters.
 * @returns Memoized array of key geometry curve data.
 */
export function useKeyGeometryCurves(
  setups: BoardSetupConfig[],
  riderParams: RiderParams,
): KeyGeometryCurveData[] {
  return useMemo(() => {
    const maxLean = riderParams.maxLeanAngle ?? DEFAULT_MAX_LEAN
    return setups.map(setup => {
      const truck = setup.frontTruck
      const rearTruck = setup.rearTruck
      const { direction } = computePivotAxis(truck.pivotAxisAngle, truck.rake)
      
      const curve = returnKeyGeometryCurves(
        direction,
        truck.pivotAxisAngle,
        truck.rake,
        truck.axleToBaseplateDistance,
        riderParams.boardThicknessMm + truck.baseplateToBoard,
        truck.roadsideBushing,
        truck.boardsideBushing,
        riderParams.massKg,
        riderParams.comHeightM,
        -maxLean,
        maxLean,
        DEFAULT_SAMPLES,
        rearTruck.pivotAxisAngle,
        rearTruck.rake,
        setup.wheelbase,
        truck.trackWidth,
        truck.wheelDiameter,
      )
      
      return {
        setupId: setup.id,
        maxLeanDeg: maxLean,
        curve,
      }
    })
  }, [
    setups,
    riderParams.massKg,
    riderParams.comHeightM,
    riderParams.boardThicknessMm,
    riderParams.maxLeanAngle,
    // Note: We rely on object reference equality for `setups` and `riderParams`.
    // If individual truck properties change, the parent component must ensure
    // the `setups` array reference is updated to trigger recomputation.
  ])
}
