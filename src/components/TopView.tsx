/**
 * TopView component — top-down board diagram (XZ plane) with propulsion windrose.
 *
 * Shows the board from above, rotated 90° CCW relative to the XZ-plane axes:
 * - X axis (vertical, +down on screen) = forward board direction (front at top, rear at bottom)
 * - Z axis (horizontal, +right on screen) = lateral right / heel side
 *
 * The rotated layout places the board horizontally in the centre of the viewport.
 *
 * Elements drawn:
 * - Board outline (rectangle from front to rear axle with board width)
 * - Front and rear truck axles as vertical lines spanning the board width
 * - Positive propulsion windrose for the active setup and lean angle
 */

import React, { useMemo } from 'react'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { computePositivePropulsionWindrose, type PropulsionWindroseSample } from '../geometry/propulsionWindrose'
import type { KeyGeometryResult } from '../physics/keyGeometryDataSet'
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
  /** Global board width in mm (used for board outline visualization). */
  boardWidthMm?: number
  /** Current steering lean angle in degrees, used to display the turning circle segment. */
  steeringLeanAngleDeg?: number
}

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 220
// Keep the board and windrose in a shared physical scale.
const TOP_VIEW_SCALE = 0.48 // pixels per mm; 3x zoom
const WINDROSE_DIAMETER_MM = 700
const WINDROSE_SAMPLE_COUNT = 32
const WINDROSE_CENTER_FRACTION_OF_WHEELBASE = 0.15

function windroseWedgePath(
  centerX: number,
  centerY: number,
  sample: PropulsionWindroseSample,
  scale: number,
): string {
  const radius = (WINDROSE_DIAMETER_MM / 2) * sample.ratio * scale
  const halfWidthRad = Math.PI / WINDROSE_SAMPLE_COUNT
  // Render leaves from the opposite end of each force direction.
  const angleRad = (sample.appliedAngleDeg * Math.PI) / 180 + Math.PI
  const point = (angle: number): [number, number] => [
    centerX + radius * Math.cos(angle),
    centerY - radius * Math.sin(angle),
  ]
  const [x1, y1] = point(angleRad - halfWidthRad)
  const [x2, y2] = point(angleRad + halfWidthRad)
  return `M ${centerX.toFixed(1)} ${centerY.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
}

function toPolylinePoints(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

/**
 * TopView — top-down board diagram with the active propulsion windrose.
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
  boardThicknessMm: _boardThicknessMm = 11,
  boardWidthMm = 245,
  steeringLeanAngleDeg = 0,
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

  const icrScale = TOP_VIEW_SCALE

  // SVG origin: centre of the wheelbase after a 90° CCW rotation.
  const originX = width / 2 - maxWheelbase * icrScale * 0.5
  const originY = height / 2

  /** Convert physics (X, Z) to SVG pixel coordinates (90° CCW rotated view).
   *  physX (forward) → horizontal: front at left, rear at right.
   *  physZ (lateral) → vertical: heel side (+Z) goes upward.
   */
  const toSVG = (physX: number, physZ: number): [number, number] => [
    originX + physX * icrScale,
    originY - physZ * icrScale,
  ]

  // Precompute board outline dimensions for the reference setup (drawn once)
  // Extend the board by 60mm on both sides (total 120mm extra width)
  const boardExtensionMm = 60
  const refHalfBoardWidth = boardWidthMm / 2
  const extendedHalfBoardWidth = refHalfBoardWidth + boardExtensionMm
  
  const refBoardWidthPx = refSetup.wheelbase * icrScale + 2 * 0.1 * refSetup.wheelbase * icrScale
  const refBoardHeightPx = (boardWidthMm + 2 * boardExtensionMm) * icrScale
  const [refBoardLeft, refBoardTop] = toSVG(-0.1 * refSetup.wheelbase, extendedHalfBoardWidth)

  // Precompute side line positions (at actual track width)
  const [frontAxleX] = toSVG(0, refHalfBoardWidth)
  const [rearAxleX] = toSVG(refSetup.wheelbase, refHalfBoardWidth)

  const windrose = useMemo(() => {
    const activeCurveData = keyGeometryCurves?.find(d => d.setupId === activeSetupId)
    if (!activeCurveData || activeCurveData.curve.length === 0) return null

    const point = activeCurveData.curve.reduce((prev, curr) =>
      Math.abs(curr.leanAngleDeg - steeringLeanAngleDeg) < Math.abs(prev.leanAngleDeg - steeringLeanAngleDeg) ? curr : prev,
    )
    const [centerX, centerY] = toSVG(refSetup.wheelbase * WINDROSE_CENTER_FRACTION_OF_WHEELBASE, 0)

    return {
      centerX,
      centerY,
      color: refSetup.color,
      frontSteerAngleDeg: point.frontSteerAngleDeg,
      rearSteerAngleDeg: point.rearSteerAngleDeg,
      samples: computePositivePropulsionWindrose(point.frontSteerAngleDeg, WINDROSE_SAMPLE_COUNT),
    }
  }, [keyGeometryCurves, activeSetupId, steeringLeanAngleDeg, refSetup.color, refSetup.wheelbase])

  const axleLine = (axleX: number, steerAngleDeg: number, trackWidthMm: number): { x1: number; y1: number; x2: number; y2: number } => {
    const steerRad = (steerAngleDeg * Math.PI) / 180
    const halfTrackPx = (trackWidthMm / 2) * icrScale
    return {
      x1: axleX - halfTrackPx * Math.sin(steerRad),
      y1: originY + halfTrackPx * Math.cos(steerRad),
      x2: axleX + halfTrackPx * Math.sin(steerRad),
      y2: originY - halfTrackPx * Math.cos(steerRad),
    }
  }

  const frontAxleLine = axleLine(frontAxleX, windrose?.frontSteerAngleDeg ?? 0, refSetup.frontTruck.trackWidth)
  // The rear truck is mounted backwards, so its visible axle rotation is reversed.
  const rearAxleLine = axleLine(rearAxleX, -(windrose?.rearSteerAngleDeg ?? 0), refSetup.frontTruck.trackWidth)

  const turningArc = useMemo(() => {
    const activeCurveData = keyGeometryCurves?.find(d => d.setupId === activeSetupId)
    if (!activeCurveData || activeCurveData.curve.length === 0) return null

    const point = activeCurveData.curve.reduce((prev, curr) =>
      Math.abs(curr.leanAngleDeg - steeringLeanAngleDeg) < Math.abs(prev.leanAngleDeg - steeringLeanAngleDeg) ? curr : prev,
    )
    const isStraight = point.turningCenterX === null || point.turningCenterZ === null || Math.abs(point.turningCenterZ) > 15000
    const icrX = isStraight ? 0 : point.turningCenterX
    const icrZ = isStraight ? 0 : point.turningCenterZ
    const radius = isStraight ? 0 : Math.abs(icrZ!)
    const minX = isStraight ? -0.1 * maxWheelbase : Math.max(-0.1 * maxWheelbase, icrX! - radius)
    const maxX = isStraight ? 1.1 * maxWheelbase : Math.min(1.1 * maxWheelbase, icrX! + radius)
    if (minX >= maxX) return null

    const points: [number, number][] = []
    for (let i = 0; i <= 32; i++) {
      const x = minX + (maxX - minX) * (i / 32)
      let z = 0
      if (!isStraight) {
        const dx = x - icrX!
        const distance = Math.sqrt(Math.max(0, radius * radius - dx * dx))
        z = icrZ! > 0 ? icrZ! - distance : icrZ! + distance
      }
      points.push(toSVG(x, z))
    }

    return {
      points: toPolylinePoints(points),
      color: refSetup.color,
      radiusMm: isStraight ? null : radius,
    }
  }, [keyGeometryCurves, activeSetupId, steeringLeanAngleDeg, maxWheelbase, refSetup.color])

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-label="Top view (XZ plane) with positive propulsion windrose"
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
        Top View (XZ) — Propulsion Windrose + Turning Arc
      </text>

      {/* Board outline — drawn once for the reference setup, extended by 60mm on both sides */}
      <rect
        x={refBoardLeft}
        y={refBoardTop}
        width={refBoardWidthPx}
        height={refBoardHeightPx}
        fill="#334155"
        fillOpacity={1}
        stroke="#475569"
        strokeWidth={1.5}
        strokeOpacity={1}
        rx={3}
      />
      
      {/* Side lines at actual track width */}
      <line
        x1={frontAxleLine.x1}
        y1={frontAxleLine.y1}
        x2={frontAxleLine.x2}
        y2={frontAxleLine.y2}
        stroke="#475569"
        strokeWidth={2.5}
        opacity={0.9}
      />
      <line
        x1={rearAxleLine.x1}
        y1={rearAxleLine.y1}
        x2={rearAxleLine.x2}
        y2={rearAxleLine.y2}
        stroke="#475569"
        strokeWidth={2.5}
        opacity={0.9}
      />

      <g clipPath="url(#topview-clip)">
      {windrose && (
        <g aria-label="Positive propulsion ratio windrose">
          {windrose.samples.map(sample => (
            <path
              key={sample.appliedAngleDeg}
              d={windroseWedgePath(windrose.centerX, windrose.centerY, sample, icrScale)}
              fill={sample.appliedAngleDeg === 90 || sample.appliedAngleDeg === 270 ? '#7dd3fc' : windrose.color}
              fillOpacity={sample.appliedAngleDeg === 90 || sample.appliedAngleDeg === 270 ? 0.65 : 0.3}
              stroke={sample.appliedAngleDeg === 90 || sample.appliedAngleDeg === 270 ? '#7dd3fc' : windrose.color}
              strokeOpacity={sample.appliedAngleDeg === 90 || sample.appliedAngleDeg === 270 ? 0.75 : 0.45}
              strokeWidth={0.5}
            />
          ))}
        </g>
      )}

      {turningArc && (
        <polyline
          points={turningArc.points}
          fill="none"
          stroke={turningArc.color}
          strokeWidth={4}
          opacity={0.6}
          strokeLinejoin="round"
        />
      )}

      {turningArc?.radiusMm != null && turningArc.radiusMm < 99900 && (
        <text
          x={originX + maxWheelbase * icrScale * 0.5}
          y={refBoardTop - 23}
          fill={UI_TEXT_MUTED}
          fontSize={13}
          fontFamily="monospace"
          textAnchor="middle"
        >
          Turning radius: {(turningArc.radiusMm / 1000).toFixed(1)}m
        </text>
      )}
      </g>

      {/* Wheelbase dimension for reference setup */}
      {(() => {
        const wb = refSetup.wheelbase
        // Place annotation below the board
        const offsetZmm = -200 - refSetup.frontTruck.trackWidth / 2
        const [frontX, annotY] = toSVG(0, offsetZmm)
        const [rearX] = toSVG(wb, offsetZmm)
        return (
          <g>
            <line x1={frontX} y1={annotY} x2={rearX} y2={annotY} stroke={UI_TEXT_MUTED} strokeWidth={1} />
            <line x1={frontX} y1={annotY - 4} x2={frontX} y2={annotY + 4} stroke={UI_TEXT_MUTED} strokeWidth={1} />
            <line x1={rearX} y1={annotY - 4} x2={rearX} y2={annotY + 4} stroke={UI_TEXT_MUTED} strokeWidth={1} />
            <text
              x={(frontX + rearX) / 2}
              y={annotY + 14}
              fill={UI_TEXT_MUTED}
              fontSize={9}
              fontFamily="monospace"
              textAnchor="middle"
            >
              L={wb}mm
            </text>
          </g>
        )
      })()}

      {/* Axis labels */}
      <text
        x={originX - 4}
        y={originY + 14}
        fill={UI_TEXT_SECONDARY}
        fontSize={10}
        fontFamily="monospace"
        textAnchor="middle"
      >
        front
      </text>
      <text
        x={originX + maxWheelbase * icrScale + 4}
        y={originY + 14}
        fill={UI_TEXT_SECONDARY}
        fontSize={10}
        fontFamily="monospace"
        textAnchor="middle"
      >
        rear
      </text>

    </svg>
  )
}

export default TopView
