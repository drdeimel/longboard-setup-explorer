/**
 * TopView component — top-down board diagram (XZ plane) with ICR locus.
 *
 * Shows the board from above, rotated 90° CCW relative to the XZ-plane axes:
 * - X axis (vertical, +down on screen) = forward board direction (front at top, rear at bottom)
 * - Z axis (horizontal, +right on screen) = lateral right / heel side
 *
 * The rotated layout places the board as a narrow vertical strip in the centre
 * while the ICR locus expands left/right, filling the wide-box viewport well.
 *
 * Elements drawn:
 * - Board outline (rectangle from front to rear axle with board width)
 * - Front truck axle (horizontal line at Y = originY, spanning ±trackWidth/2)
 * - Rear truck axle (horizontal line at Y = originY + wheelbase*scale, spanning ±trackWidth/2)
 * - ICR locus: two colored polylines (positive-Z and negative-Z branches)
 * - Multiple setups overlaid if multiple configs provided
 */

import React, { useMemo } from 'react'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from '../models/BoardSetupConfig'
import { computePivotAxis } from '../geometry/pivotAxis'
import { returnKeyGeometryCurves, type KeyGeometryResult } from '../physics/keyGeometryDataSet'
import { UI_TEXT_MUTED, UI_TEXT_PRIMARY, UI_TEXT_SECONDARY } from '../theme/uiColors'

/** Props for the TopView component. */
interface TopViewProps {
  /** All active board setups to display (overlaid). */
  setups: BoardSetupConfig[]
  /** ID of the currently highlighted/active setup. */
  activeSetupId?: string
  /** SVG viewport width in pixels. */
  width?: number
  /** SVG viewport height in pixels. */
  height?: number
  /**
   * Scale in pixels per mm — must match SideView horizontal scale for
   * geometric consistency (shared X axis).
   */
  pixelsPerMm?: number
  /**
   * Pre-computed key geometry curves from parent (one entry per setup).
   * When provided, skips local computation; use the same payload that is
   * passed to all other chart components.
   */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
  /** Global board thickness in mm, added to baseplate-to-board distance in physics computations. */
  boardThicknessMm?: number
}

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 220
const DEFAULT_SAMPLES = 91

// ICR can be very far from the board — scale to show more area
const ICR_VIEW_SCALE = 0.16 // pixels per mm — 2x scale to make board appear 100% larger

/**
 * Split a flat KeyGeometryResult array into two contiguous sub-arrays by the
 * sign of turningCenterZ.  Points with null turningCenterZ (ICR at infinity,
 * i.e. straight-ahead) are discarded.
 *
 * The locus naturally forms two branches: Z > 0 (heel-side ICR, lean one way)
 * and Z < 0 (toe-side ICR, lean the other way).  Connecting them with a
 * single polyline would draw a spurious line crossing the diagram from one
 * side to the other.
 *
 * @param curve - Full curve over symmetric lean range.
 * @returns Two arrays: points with Z ≥ 0 and points with Z < 0.
 */
function splitByZSign(
  curve: KeyGeometryResult[],
): { positive: KeyGeometryResult[]; negative: KeyGeometryResult[] } {
  const positive: KeyGeometryResult[] = []
  const negative: KeyGeometryResult[] = []
  for (const r of curve) {
    if (r.turningCenterX === null || r.turningCenterZ === null) continue
    if (r.turningCenterZ >= 0) {
      positive.push(r)
    } else {
      negative.push(r)
    }
  }
  return { positive, negative }
}

/**
 * Build an SVG polyline `points` attribute string from an array of (svgX,
 * svgY) tuples.
 *
 * @param pts - Array of [svgX, svgY] pixel coordinates.
 * @returns Space-separated "x,y" pairs suitable for the SVG `points` attribute.
 */
function toPolylinePoints(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

/**
 * TopView — top-down board diagram with ICR locus for all active setups.
 *
 * ICR data is taken from `keyGeometryCurves` when provided (preferred) or
 * computed locally as a fallback.  The locus is split into two separate
 * polylines by Z sign so the two branches (heel-lean and toe-lean sides) are
 * rendered independently without a connecting segment.
 *
 * @param props - Setup configurations, pre-computed curves, and display options.
 * @returns SVG element showing top-down view.
 */
const TopView: React.FC<TopViewProps> = ({
  setups,
  activeSetupId,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  keyGeometryCurves,
  boardThicknessMm = 11,
}) => {
  if (setups.length === 0) {
    return (
      <svg width="100%" height={height} className="block">
        <rect width={width} height={height} fill="#0f172a" rx={4} />
        <text x={width / 2} y={height / 2} fill={UI_TEXT_MUTED} textAnchor="middle" fontSize={12}>
          No setups
        </text>
      </svg>
    )
  }

  // Use the first (or active) setup for geometry reference
  const refSetup = setups.find(s => s.id === activeSetupId) ?? setups[0]
  const maxWheelbase = Math.max(...setups.map(s => s.wheelbase))

  // ICR locus can extend very far — use a dedicated scale to show more area
  const icrScale = ICR_VIEW_SCALE

  // ICR clipping range in mm — discard points that would be off-screen
  const icrClipMm = Math.max(maxWheelbase * 10, 10000)

  // SVG origin: front axle center.
  // After the 90° CCW rotation X maps to vertical and Z maps to horizontal.
  // Centre the wheelbase vertically and keep the ICR (Z) centred horizontally.
  const originX = width / 2
  const originY = height / 2 - maxWheelbase * icrScale * 0.5

  /** Convert physics (X, Z) to SVG pixel coordinates (90° CCW rotated view).
   *  physX (forward) → vertical: front at top, rear at bottom.
   *  physZ (lateral) → horizontal: heel side (+Z) to the right.
   */
  const toSVG = (physX: number, physZ: number): [number, number] => [
    originX + physZ * icrScale, // Z lateral = rightward on screen
    originY + physX * icrScale, // X forward = downward on screen
  ]

  // Precompute board outline dimensions for the reference setup (drawn once)
  // Extend the board by 60mm on both sides (total 120mm extra width)
  const boardExtensionMm = 60
  const refHalfTrack = refSetup.frontTruck.trackWidth / 2
  const extendedHalfTrack = refHalfTrack + boardExtensionMm
  
  const refBoardWidthPx = (refSetup.frontTruck.trackWidth + 2 * boardExtensionMm) * icrScale
  const refBoardKicktailLengthPx = 0.1 * refSetup.wheelbase * icrScale
  const refBoardHeightPx = refSetup.wheelbase * icrScale + 2 * refBoardKicktailLengthPx 
  const [refBoardLeft, refBoardTop] = toSVG(-0.1 * refSetup.wheelbase, -extendedHalfTrack)

  // Precompute side line positions (at actual track width)
  const [sideLineLeftX, sideLineTopY] = toSVG(0, -refHalfTrack)
  const [, sideLineBottomY] = toSVG(refSetup.wheelbase, -refHalfTrack)
  
  const [sideLineRightX] = toSVG(0, refHalfTrack)

  // ── Compute / retrieve ICR curves for every setup ─────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const icrData = useMemo(() => {
    return setups.map(setup => {
      const precomputed = keyGeometryCurves?.find(k => k.setupId === setup.id)
      const maxLeanDeg = precomputed?.maxLeanDeg ?? DEFAULT_MAX_LEAN
      const curve = precomputed?.curve ?? returnKeyGeometryCurves(
        computePivotAxis(setup.frontTruck.pivotAxisAngle, setup.frontTruck.rake).direction,
        setup.frontTruck.pivotAxisAngle,
        setup.frontTruck.rake,
        setup.frontTruck.axleToBaseplateDistance,
        boardThicknessMm + setup.frontTruck.baseplateToBoard,
        setup.frontTruck.roadsideBushing,
        setup.frontTruck.boardsideBushing,
        75,     // default rider mass fallback (kg)
        1.0,    // default CoM height fallback (m)
        -maxLeanDeg,
        maxLeanDeg,
        DEFAULT_SAMPLES,
        setup.rearTruck.pivotAxisAngle,
        setup.rearTruck.rake,
        setup.wheelbase,
      )
      return { setup, curve }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setups, keyGeometryCurves, boardThicknessMm])

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-label="Top view (XZ plane) with ICR locus"
    >
      {/* Background */}
      <rect width={width} height={height} fill="#0f172a" rx={4} />

      {/* Clip path — restricts all geometry to the viewport bounds */}
      <defs>
        <clipPath id="topview-clip">
          <rect x={0} y={0} width={width} height={height} />
        </clipPath>
      </defs>

      {/* Title */}
      <text x={8} y={18} fill={UI_TEXT_PRIMARY} fontSize={11} fontFamily="monospace">
        Top View (XZ) — ICR Locus
      </text>

      {/* Board outline — drawn once for the reference setup, extended by 60mm on both sides */}
      <rect
        x={refBoardLeft}
        y={refBoardTop}
        width={refBoardWidthPx}
        height={refBoardHeightPx}
        fill={refSetup.color}
        fillOpacity={0.05}
        stroke={refSetup.color}
        strokeWidth={1.5}
        strokeOpacity={0.4}
        rx={3}
      />
      
      {/* Side lines at actual track width */}
      <line
        x1={sideLineLeftX}
        y1={sideLineTopY}
        x2={sideLineRightX}
        y2={sideLineTopY}
        stroke="#ffffff"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <line
        x1={sideLineLeftX}
        y1={sideLineBottomY}
        x2={sideLineRightX}
        y2={sideLineBottomY}
        stroke="#ffffff"
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />

      {/* Render each setup — clipped to viewport */}
      <g clipPath="url(#topview-clip)">
      {icrData.map(({ setup, curve }) => {
        const isActive = setup.id === activeSetupId
        const opacity = isActive || !activeSetupId ? 1 : 0.3
        const wb = setup.wheelbase
        const halfTrack = setup.frontTruck.trackWidth / 2

        // Front axle endpoints
        const [frontAxleX1, frontAxleY1] = toSVG(0, -halfTrack)
        const [frontAxleX2, frontAxleY2] = toSVG(0, halfTrack)

        // Rear axle endpoints
        const [rearAxleX1, rearAxleY1] = toSVG(wb, -halfTrack)
        const [rearAxleX2, rearAxleY2] = toSVG(wb, halfTrack)

        // Split ICR locus into positive-Z and negative-Z branches
        const { positive, negative } = splitByZSign(curve)

        const toFilteredSVGPoints = (branch: KeyGeometryResult[]): [number, number][] =>
          branch
            .filter(r =>
              Math.abs(r.turningCenterZ!) < icrClipMm &&
              Math.abs(r.turningCenterX!) < icrClipMm * 2,
            )
            .map(r => toSVG(r.turningCenterX!, r.turningCenterZ!))

        const posPoints = toFilteredSVGPoints(positive)
        const negPoints = toFilteredSVGPoints(negative)

        const strokeW = isActive ? 2 : 1

        return (
          <g key={setup.id} opacity={opacity}>


            {/* ICR locus — positive-Z branch (heel lean) */}
            {posPoints.length > 1 && (
              <polyline
                points={toPolylinePoints(posPoints)}
                fill="none"
                stroke={setup.color}
                strokeWidth={strokeW}
                opacity={0.85}
                strokeLinejoin="round"
              />
            )}

            {/* ICR locus — negative-Z branch (toe lean) */}
            {negPoints.length > 1 && (
              <polyline
                points={toPolylinePoints(negPoints)}
                fill="none"
                stroke={setup.color}
                strokeWidth={strokeW}
                opacity={0.55}
                strokeDasharray="5 3"
                strokeLinejoin="round"
              />
            )}
          </g>
        )
      })}
      </g>

      {/* Wheelbase dimension for reference setup — now rendered as a vertical annotation */}
      {(() => {
        const wb = refSetup.wheelbase
        // Place annotation to the right of the board
        const offsetZmm = -200 - refSetup.frontTruck.trackWidth / 2
        const [annotX, frontY] = toSVG(0,  offsetZmm)
        const [,        rearY] = toSVG(wb, offsetZmm)
        return (
          <g>
            {/* vertical dimension line */}
            <line x1={annotX} y1={frontY} x2={annotX} y2={rearY} stroke={UI_TEXT_MUTED} strokeWidth={1} />
            {/* tick at front axle */}
            <line x1={annotX - 4} y1={frontY} x2={annotX + 4} y2={frontY} stroke={UI_TEXT_MUTED} strokeWidth={1} />
            {/* tick at rear axle */}
            <line x1={annotX - 4} y1={rearY} x2={annotX + 4} y2={rearY} stroke={UI_TEXT_MUTED} strokeWidth={1} />
            <text
              x={annotX - 20}
              y={(frontY + rearY) / 2 + 4}
              fill={UI_TEXT_MUTED}
              fontSize={9}
              fontFamily="monospace"
              textAnchor="end"
            >
              L={wb}mm
            </text>
          </g>
        )
      })()}

      {/* Axis labels */}
      {/* +X is downward (rear), front is at top */}
      <text
        x={originX + 4}
        y={originY - 4}
        fill={UI_TEXT_SECONDARY}
        fontSize={10}
        fontFamily="monospace"
        textAnchor="middle"
      >
        front
      </text>
      <text
        x={originX + 4}
        y={originY + maxWheelbase * icrScale + 14}
        fill={UI_TEXT_SECONDARY}
        fontSize={10}
        fontFamily="monospace"
        textAnchor="middle"
      >
        rear (−X)
      </text>
      <text
        x={width - 6}
        y={originY + maxWheelbase * icrScale / 2 + 4}
        fill={UI_TEXT_SECONDARY}
        fontSize={10}
        fontFamily="monospace"
        textAnchor="end"
      >
        +Z
      </text>

      {/* Legend */}
      <text x={8} y={height - 8} fill={UI_TEXT_SECONDARY} fontSize={9} fontFamily="monospace">
        ICR locus — solid: Z≥0 (heel lean) · dashed: Z&lt;0 (toe lean)
      </text>
    </svg>
  )
}

export default TopView
