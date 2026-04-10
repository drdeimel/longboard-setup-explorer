/**
 * FrontView component — annotated 2D front cross-section (ZY plane) of the front truck.
 *
 * Shows the truck geometry from the front:
 * - Z axis (horizontal, +right) = lateral right / heel side
 * - Y axis (vertical, +up) = up
 *
 * The front view shares the Y (height) axis with SideView — the vertical scale
 * must be the same pixelsPerMm for geometric consistency across views.
 *
 * Elements drawn:
 * - Road surface (ground plane at y = −wheelDiameter/2)
 * - Wheels (left and right, as vertical rectangles / circles at ±trackWidth/2)
 * - Axle line (horizontal at y = 0)
 * - Hanger outline
 * - Board surface (at y = axleToBoardDistance)
 * - Bushing positions along the pivot axis projection
 * - Track width dimension annotation
 * - Axle-to-board height annotation
 */

import React, { useState } from 'react'
import type { TruckConfig } from '../models/TruckConfig'
import { boardSurfaceHeight } from '../geometry/pivotAxis'
import type { KeyGeometryResult } from '../physics/keyGeometryDataSet'

/** Props for the FrontView component. */
interface FrontViewProps {
  /** Front truck configuration to visualize. */
  truck: TruckConfig
  /** CSS hex color for this setup. */
  color: string
  /** SVG viewport width in pixels. */
  width?: number
  /** SVG viewport height in pixels. */
  height?: number
  /**
   * Scale in pixels per mm. Must match SideView and TopView for geometric
   * consistency across views (shared Y axis → shared vertical scale).
   */
  pixelsPerMm?: number
  /**
   * Ground offset from the bottom of the SVG in pixels.
   * When provided, ensures the floor line aligns with SideView for consistent visuals.
   */
  groundOffsetPx?: number
  /** Pre-computed key geometry curves from parent (maxLeanDeg is the global DEFAULT_MAX_LEAN). */
  keyGeometryCurves?: { setupId: string; maxLeanDeg: number; curve: KeyGeometryResult[] }[]
  /** Board lean angle for tilting the board visualization (degrees). */
  leanAngleDeg?: number
  /** Callback when user drags the board point to change lean angle. */
  onLeanAngleChange?: (leanAngleDeg: number) => void
}

const DEFAULT_WIDTH = 500
const DEFAULT_HEIGHT = 280

/**
 * FrontView — annotated 2D front cross-section of the front truck geometry.
 *
 * @param props - Truck configuration and display options.
 * @returns SVG element showing front cross-section.
 */
const FrontView: React.FC<FrontViewProps> = ({
  truck,
  color,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  pixelsPerMm,
  groundOffsetPx = 20,
  keyGeometryCurves,
  leanAngleDeg = 0,
  onLeanAngleChange,
}) => {
  const [isDragging, setIsDragging] = useState(false)

  const dBoard = boardSurfaceHeight(truck.axleToBaseplateDistance, truck.baseplateToBoard)

  // Geometry extents (in mm)
  const halfTrack = truck.trackWidth / 2
  // Width: fit trackWidth + extra for board line (160mm) + padding
  const geometryWidthMm = truck.trackWidth + 180 // padding for board line and margins
  const geometryHeightMm = dBoard + truck.wheelDiameter / 2 + 20

  const ppm = pixelsPerMm ?? Math.min(
    (width - 40) / geometryWidthMm,
    (height - 40) / geometryHeightMm,
  )

  // SVG origin: axle center
  const originX = width / 2
  // Use groundOffsetPx to ensure alignment with SideView
  const originY = height - groundOffsetPx - truck.wheelDiameter / 2 * ppm

  /** Convert physics (Z, Y) to SVG pixels. Z is horizontal (+ = right), Y is vertical (+ = up). */
  const toSVG = (physZ: number, physY: number): [number, number] => [
    originX + physZ * ppm,
    originY - physY * ppm,
  ]

  const groundY = originY + truck.wheelDiameter / 2 * ppm
  const wheelWidthMm = 52 // fixed wheel width for front-view indicator
  const wheelWidth = wheelWidthMm * ppm
  // Match wheel indicator height to actual wheel diameter in this view.
  const wheelHeight = truck.wheelDiameter * ppm

  const wheelOffset = 14 // mm offset from axle center to wheel contact point

  const [leftWheelX] = toSVG(-halfTrack - wheelOffset, 0)
  const [rightWheelX] = toSVG(halfTrack + wheelOffset, 0)

  // Axle line endpoints
  const [leftAxleX, axleY] = toSVG(-halfTrack, 0)
  const [rightAxleX] = toSVG(halfTrack, 0)

  // Hanger body (simplified rectangle between the wheel contact points)
  const hangerTop = originY - (truck.axleToBaseplateDistance * ppm * 0.6)
  const hangerHeight = truck.axleToBaseplateDistance * ppm * 0.6
  const hangerHalfWidth = (halfTrack - 10) * ppm

  // Board surface computations (moved out of JSX)
  // Get the center of board position from keyGeometryCurves at the current lean angle
  let boardCenterZ = 0
  let boardCenterY = dBoard
  let centerForceZ = 0
  let centerForceY = 0
  let invPendulumHeight = 0
  let rotCenterY = 0
  let effectiveLeanAngleDeg = leanAngleDeg
  const pivotAxisAngleRad = (truck.pivotAxisAngle * Math.PI) / 180

  if (keyGeometryCurves && keyGeometryCurves[0]?.curve) {
    const curve = keyGeometryCurves[0].curve
    // Find the entry closest to the current lean angle
    const closestEntry = curve.reduce((prev, curr) => 
      Math.abs(curr.leanAngleDeg - leanAngleDeg) < Math.abs(prev.leanAngleDeg - leanAngleDeg) ? curr : prev
    )
    invPendulumHeight = closestEntry.invPendulumHeight
    rotCenterY = dBoard - invPendulumHeight

    boardCenterZ = closestEntry.centerOfBoardZ
    boardCenterY = closestEntry.centerOfBoardY + rotCenterY
    centerForceZ = closestEntry.centerOfForceZ
    centerForceY = closestEntry.centerOfForceY + rotCenterY
    effectiveLeanAngleDeg = closestEntry.leanAngleDeg
  } else {
    invPendulumHeight = truck.baseplateToBoard + truck.axleToBaseplateDistance - truck.rake / Math.cos(pivotAxisAngleRad)
    rotCenterY = dBoard - invPendulumHeight
  }

  // Calculate tilted board endpoints
  const leanRad = (effectiveLeanAngleDeg * Math.PI) / 180
  const boardHalfWidth = 100 // mm half-width of board for visualization
  const tiltOffsetZ = boardHalfWidth * Math.cos(leanRad)
  const tiltOffsetY = boardHalfWidth * Math.sin(leanRad)

  const [boardStartX, boardStartY] = toSVG(boardCenterZ - tiltOffsetZ, boardCenterY + tiltOffsetY)
  const [boardEndX, boardEndY] = toSVG(boardCenterZ + tiltOffsetZ, boardCenterY - tiltOffsetY)
  const [boardCenterXSvg, boardCenterYSvg] = toSVG(boardCenterZ, boardCenterY)
  const [centerForceXSvg, centerForceYSvg] = toSVG(centerForceZ, centerForceY)
  const [rotCenterXSvg, rotCenterYSvg] = toSVG(0, rotCenterY)

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`block ${isDragging ? 'cursor-grabbing' : ''}`}
      aria-label="Front view cross-section (ZY plane)"
      onMouseMove={(e) => {
        if (!isDragging || !onLeanAngleChange) return

        // Get mouse position relative to SVG
        const svgRect = e.currentTarget.getBoundingClientRect()
        const mouseX = e.clientX - svgRect.left
        const mouseY = e.clientY - svgRect.top

        // Calculate angle from rotation center to mouse position
        // In SVG coordinates: X increases right, Y increases down
        const dx = mouseX - rotCenterXSvg
        const dy = mouseY - rotCenterYSvg

        // Calculate lean angle: atan2(dx, -dy) gives angle from vertical
        // -dy because in SVG Y is positive downward, but physics Y is positive upward
        let leanAngleRad = Math.atan2(dx, -dy)
        let leanAngleDeg = (leanAngleRad * 180) / Math.PI

        // Clamp to reasonable range (-45 to 45 degrees)
        leanAngleDeg = Math.max(-45, Math.min(45, leanAngleDeg))

        onLeanAngleChange(leanAngleDeg)
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      {/* Background */}
      <rect width={width} height={height} fill="#0f172a" rx={4} />

      {/* Title */}
      <text x={8} y={18} fill="#94a3b8" fontSize={11} fontFamily="monospace">
        Front View (ZY)
      </text>

      {/* Ground plane */}
      <line
        x1={0}
        y1={groundY}
        x2={width}
        y2={groundY}
        stroke="#374151"
        strokeWidth={2}
        strokeDasharray="4 4"
      />

      {/* Left wheel */}
      <rect
        x={leftWheelX - wheelWidth / 2}
        y={groundY - wheelHeight}
        width={wheelWidth}
        height={wheelHeight}
        rx={0}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />

      {/* Right wheel */}
      <rect
        x={rightWheelX - wheelWidth / 2}
        y={groundY - wheelHeight}
        width={wheelWidth}
        height={wheelHeight}
        rx={0}
        fill="none"
        stroke="#475569"
        strokeWidth={1.5}
      />

      {/* Axle line */}
      <line
        x1={leftAxleX}
        y1={axleY}
        x2={rightAxleX}
        y2={axleY}
        stroke={color}
        strokeWidth={2.5}
        opacity={0.9}
      />

      {/* Hanger body */}
      <rect
        x={originX - hangerHalfWidth}
        y={hangerTop}
        width={hangerHalfWidth * 2}
        height={hangerHeight}
        fill="none"
        stroke={color}
        strokeWidth={1}
        opacity={0.4}
        rx={3}
      />

      {/* Board surface - drawn using centerOfBoard position and tilted */}
      <>
        <line
          x1={boardStartX}
          y1={boardStartY}
          x2={boardEndX}
          y2={boardEndY}
          stroke="#334155"
          strokeWidth={20}
        />
        {/* Draggable board center point - drag to set lean angle */}
        <circle
          cx={boardCenterXSvg}
          cy={boardCenterYSvg}
          r={8}
          fill={color}
          fillOpacity={isDragging ? 0.5 : 0.3}
          stroke="#fff"
          strokeWidth={1.5}
          className="cursor-grab"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(true)
          }}
        />
        <circle cx={centerForceXSvg} cy={centerForceYSvg} r={4} fill={color} stroke="#f59e0b" strokeWidth={1} />
        <text
          x={boardEndX + 4}
          y={boardEndY + 4}
          fill="#64748b"
          fontSize={9}
          fontFamily="monospace"
        >
          board
        </text>

        <circle cx={rotCenterXSvg} cy={rotCenterYSvg} r={4} fill="#e2e8f0" />

        {/* Vertical line between board and rotation center */}
        <line
          x1={boardCenterXSvg}
          y1={boardCenterYSvg}
          x2={rotCenterXSvg}
          y2={rotCenterYSvg}
          stroke="#334155"
          strokeWidth={2}
          opacity={0.5}
        />

      </>

      {/* Axle center crosshair */}
      <circle cx={originX} cy={axleY} r={4} fill="#e2e8f0" />

      {/* Center of board curve */}
      {keyGeometryCurves && keyGeometryCurves[0]?.curve && (
        <path
          d={keyGeometryCurves[0].curve
            .map((p, i) => {
              const pointRotCenterY = dBoard - p.invPendulumHeight
              const [sx, sy] = toSVG(p.centerOfBoardZ, p.centerOfBoardY + pointRotCenterY)
              return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`
            })
            .join(' ')}
          fill="none"
          stroke="#64748b"
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={1.0}
        />
      )}

      {/* Center of force curve */}
      {keyGeometryCurves && keyGeometryCurves[0]?.curve && (
        <path
          d={keyGeometryCurves[0].curve
            .map((p, i) => {
              const pointRotCenterY = dBoard - p.invPendulumHeight
              const [sx, sy] = toSVG(p.centerOfForceZ, p.centerOfForceY + pointRotCenterY)
              return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`
            })
            .join(' ')}
          fill="none"
          stroke="#64748b"
          strokeWidth={2}
          strokeDasharray="2 2"
          opacity={0.9}
        />
      )}

      {/* Track width dimension */}
      <line
        x1={leftWheelX}
        y1={groundY + 10}
        x2={rightWheelX}
        y2={groundY + 10}
        stroke="#64748b"
        strokeWidth={1}
      />
      <line x1={leftWheelX} y1={groundY + 6} x2={leftWheelX} y2={groundY + 14} stroke="#64748b" strokeWidth={1} />
      <line x1={rightWheelX} y1={groundY + 6} x2={rightWheelX} y2={groundY + 14} stroke="#64748b" strokeWidth={1} />
      <text
        x={(leftWheelX + rightWheelX) / 2}
        y={groundY + 22}
        fill="#64748b"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
      >
        w={truck.trackWidth}mm
      </text>


      {/* Axis labels */}
      <text x={width - 20} y={axleY + 4} fill="#475569" fontSize={10} fontFamily="monospace">
        +Z
      </text>
      <text x={originX + 4} y={20} fill="#475569" fontSize={10} fontFamily="monospace">
        +Y
      </text>
    </svg>
  )
}

export default FrontView
