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
import { computeTruckGeometry } from '../geometry/truckGeometry'
import { computeLeanToSteer } from '../geometry/leanToSteer'
import { DISPLAY_WHEEL_OFFSET_MM, DISPLAY_WHEEL_WIDTH_MM } from '../physics/keyGeometryDataSet'
import type { KeyGeometryResult } from '../physics/keyGeometryDataSet'
import { UI_TEXT_MUTED, UI_TEXT_PRIMARY } from '../theme/uiColors'

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
  /** ID of the currently active setup, used to select the correct curve. */
  activeSetupId?: string
  /** Board lean angle for tilting the board visualization (degrees). */
  leanAngleDeg?: number
  /** Callback when user drags the board point to change lean angle. */
  onLeanAngleChange?: (leanAngleDeg: number) => void
  /** Global board thickness in mm (shared with SideView). */
  boardThicknessMm?: number
  /** Global board width in mm (used for board visualization). */
  boardWidthMm?: number
  /** Maximum lean angle in degrees for drag clamping (from riderParams). */
  maxLeanAngle?: number
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
  groundOffsetPx = 30,
  keyGeometryCurves,
  activeSetupId,
  leanAngleDeg = 0,
  onLeanAngleChange,
  boardThicknessMm = 11,
  boardWidthMm = 245,
  maxLeanAngle = 30,
}) => {
  const [isDragging, setIsDragging] = useState(false)

  const dBoard = boardSurfaceHeight(
    truck.axleToBaseplateDistance,
    truck.baseplateToBoard + boardThicknessMm,
  )


  // Board surface computations (moved out of JSX)
  // Get the center of board position from keyGeometryCurves at the current lean angle
  let boardCenterZ = 0
  let boardCenterY = dBoard
  let centerForceZ = 0
  let centerForceY = 0
  let invPendulumHeight = 0
  let rotCenterY = 0
  let effectiveLeanAngleDeg = leanAngleDeg

  const activeCurve = keyGeometryCurves?.find(c => c.setupId === activeSetupId)?.curve

  if (activeCurve) {
    // Find the entry closest to the current lean angle
    const closestEntry = activeCurve.reduce((prev, curr) =>
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
    // Fallback to direct computation if curves are not available
    const truckGeom = computeTruckGeometry(
      truck.axleToBaseplateDistance,
      truck.baseplateToBoard,
      boardThicknessMm,
      truck.rake,
      truck.pivotAxisAngle,
    )
    invPendulumHeight = truckGeom.invPendulumHeight
    rotCenterY = truckGeom.rotCenterY
  }

  // Compute steering angle for front view projection using the validated effectiveLeanAngleDeg
  const pivotAxisAngleRad = (truck.pivotAxisAngle * Math.PI) / 180
  const pivotAxisDirection: [number, number, number] = [
    Math.cos(pivotAxisAngleRad),
    Math.sin(pivotAxisAngleRad),
    0,
  ]
  const steerResult = computeLeanToSteer(pivotAxisDirection, effectiveLeanAngleDeg)
  const steerAngleRad = (steerResult.steerAngleDeg * Math.PI) / 180
  
  // Projection factor for front view (Z-axis component).
  // Note: Using cos(steerAngle) because at 0 steering, the axle is fully along the Z axis (width factor = 1).
  // Using sin would collapse the width to 0 at 0 steering, which is physically incorrect for a front view projection.
  const steerProjection = Math.cos(steerAngleRad)

  // Determine lean direction for wheel face occlusion
  const isPositiveLean = steerResult.steerAngleDeg > 0
  const isNearZeroSteer = Math.abs(steerResult.steerAngleDeg) < 0.5

  // Geometry extents (in mm)
  const halfTrack = (truck.trackWidth / 2) * steerProjection
  const geometryWidthMm = truck.trackWidth * steerProjection + 180 // padding for board line and margins
  const geometryHeightMm = dBoard + truck.wheelDiameter / 2 + 30  

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
  const wheelWidth = DISPLAY_WHEEL_WIDTH_MM * steerProjection * ppm
  // Match wheel indicator height to actual wheel diameter in this view.
  const wheelHeight = truck.wheelDiameter * ppm

  // Ellipse dimensions for wheel sides to visualize steering
  // At 0 steering, rx=0 (vertical line). As steering increases, ellipse widens.
  const wheelEllipseRx = (wheelHeight * Math.abs(Math.sin(steerAngleRad))) / 2
  const wheelEllipseRy = wheelHeight / 2

  const wheelOffset = DISPLAY_WHEEL_OFFSET_MM

  const [leftWheelX] = toSVG(-halfTrack - wheelOffset * steerProjection, 0)
  const [rightWheelX] = toSVG(halfTrack + wheelOffset * steerProjection, 0)

  // Axle line endpoints
  const [leftAxleX, axleY] = toSVG(-halfTrack, 0)
  const [rightAxleX] = toSVG(halfTrack, 0)

  // Hanger body (simplified rectangle between the wheel contact points)
  // const hangerTop = originY - (truck.axleToBaseplateDistance * ppm * 0.6)
  // const hangerHeight = truck.axleToBaseplateDistance * ppm * 0.6
  // const hangerHalfWidth = (halfTrack - 10) * steerProjection * ppm

  // Calculate tilted board endpoints
  const leanRad = (effectiveLeanAngleDeg * Math.PI) / 180
  const boardHalfWidth = (boardWidthMm ?? 245) / 2
  const tiltOffsetZ = boardHalfWidth * Math.cos(leanRad)
  const tiltOffsetY = boardHalfWidth * Math.sin(leanRad)

  const [boardStartX, boardStartY] = toSVG(boardCenterZ - tiltOffsetZ, boardCenterY + tiltOffsetY)
  const [boardEndX, boardEndY] = toSVG(boardCenterZ + tiltOffsetZ, boardCenterY - tiltOffsetY)
  // Board thickness is controlled globally from App/ConfigPanel.
  // Keep thickness perpendicular to the board centerline so the rectangle preserves shape while rotating.
  const boardThicknessPx = boardThicknessMm * ppm
  const normalOffsetX = -boardThicknessPx * Math.sin(leanRad)
  const normalOffsetY = boardThicknessPx * Math.cos(leanRad)
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

        // Get mouse position relative to SVG viewport pixels
        const svgRect = e.currentTarget.getBoundingClientRect()
        // Convert to SVG viewBox coordinates to avoid cursor offset when
        // rendered size differs from internal SVG width/height.
        const scaleX = width / Math.max(1, svgRect.width)
        const scaleY = height / Math.max(1, svgRect.height)
        const mouseX = (e.clientX - svgRect.left) * scaleX
        const mouseY = (e.clientY - svgRect.top) * scaleY

        // Calculate angle from rotation center to mouse position
        // In SVG coordinates: X increases right, Y increases down
        const dx = mouseX - rotCenterXSvg
        const dy = mouseY - rotCenterYSvg

        // Calculate lean angle: atan2(dx, -dy) gives angle from vertical
        // -dy because in SVG Y is positive downward, but physics Y is positive upward
        let leanAngleRad = Math.atan2(dx, -dy)
        let leanAngleDeg = (leanAngleRad * 180) / Math.PI

        // Clamp to max lean angle range
        leanAngleDeg = Math.max(-maxLeanAngle, Math.min(maxLeanAngle, leanAngleDeg))

        onLeanAngleChange(leanAngleDeg)
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <defs>
        {/* Left wheel outer ellipse (clipped on negative lean): hide right half (keep x <= cx) */}
        <clipPath id="clip-lo-neg">
          <rect x={0} y={0} width={leftWheelX - wheelWidth / 2} height={height} />
        </clipPath>
        {/* Left wheel inner ellipse (clipped on positive lean): hide left half (keep x >= cx) */}
        <clipPath id="clip-li-pos">
          <rect x={leftWheelX + wheelWidth / 2} y={0} width={width} height={height} />
        </clipPath>
        {/* Right wheel inner ellipse (clipped on negative lean): hide right half (keep x <= cx) */}
        <clipPath id="clip-ri-neg">
          <rect x={0} y={0} width={rightWheelX - wheelWidth / 2} height={height} />
        </clipPath>
        {/* Right wheel outer ellipse (clipped on positive lean): hide left half (keep x >= cx) */}
        <clipPath id="clip-ro-pos">
          <rect x={rightWheelX + wheelWidth / 2} y={0} width={width} height={height} />
        </clipPath>
      </defs>

      {/* Background */}
      <rect width={width} height={height} fill="#0f172a" rx={4} />

      {/* Title */}
      <text x={8} y={18} fill={UI_TEXT_PRIMARY} fontSize={11} fontFamily="monospace">
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
      <g stroke="#475569" strokeWidth={1.5} fill="none">
        {/* Top horizontal line */}
        <line
          x1={leftWheelX - wheelWidth / 2}
          y1={groundY - wheelHeight}
          x2={leftWheelX + wheelWidth / 2}
          y2={groundY - wheelHeight}
        />
        {/* Bottom horizontal line */}
        <line
          x1={leftWheelX - wheelWidth / 2}
          y1={groundY}
          x2={leftWheelX + wheelWidth / 2}
          y2={groundY}
        />
        {/* Outer ellipse/line - full on positive lean, clipped on negative lean (hide right half) */}
        {isNearZeroSteer ? (
          <line
            x1={leftWheelX - wheelWidth / 2}
            y1={groundY - wheelHeight}
            x2={leftWheelX - wheelWidth / 2}
            y2={groundY}
          />
        ) : (
          <ellipse
            cx={leftWheelX - wheelWidth / 2}
            cy={groundY - wheelHeight / 2}
            rx={wheelEllipseRx}
            ry={wheelEllipseRy}
            clipPath={!isPositiveLean ? "url(#clip-lo-neg)" : undefined}
          />
        )}
        {/* Inner ellipse/line - clipped on positive lean (hide left half), full on negative lean */}
        {isNearZeroSteer ? (
          <line
            x1={leftWheelX + wheelWidth / 2}
            y1={groundY - wheelHeight}
            x2={leftWheelX + wheelWidth / 2}
            y2={groundY}
          />
        ) : (
          <ellipse
            cx={leftWheelX + wheelWidth / 2}
            cy={groundY - wheelHeight / 2}
            rx={wheelEllipseRx}
            ry={wheelEllipseRy}
            clipPath={isPositiveLean ? "url(#clip-li-pos)" : undefined}
          />
        )}
      </g>

      {/* Right wheel */}
      <g stroke="#475569" strokeWidth={1.5} fill="none">
        {/* Top horizontal line */}
        <line
          x1={rightWheelX - wheelWidth / 2}
          y1={groundY - wheelHeight}
          x2={rightWheelX + wheelWidth / 2}
          y2={groundY - wheelHeight}
        />
        {/* Bottom horizontal line */}
        <line
          x1={rightWheelX - wheelWidth / 2}
          y1={groundY}
          x2={rightWheelX + wheelWidth / 2}
          y2={groundY}
        />
        {/* Inner ellipse/line - full on positive lean, clipped on negative lean (hide right half) */}
        {isNearZeroSteer ? (
          <line
            x1={rightWheelX - wheelWidth / 2}
            y1={groundY - wheelHeight}
            x2={rightWheelX - wheelWidth / 2}
            y2={groundY}
          />
        ) : (
          <ellipse
            cx={rightWheelX - wheelWidth / 2}
            cy={groundY - wheelHeight / 2}
            rx={wheelEllipseRx}
            ry={wheelEllipseRy}
            clipPath={!isPositiveLean ? "url(#clip-ri-neg)" : undefined}
          />
        )}
        {/* Outer ellipse/line - clipped on positive lean (hide left half), full on negative lean */}
        {isNearZeroSteer ? (
          <line
            x1={rightWheelX + wheelWidth / 2}
            y1={groundY - wheelHeight}
            x2={rightWheelX + wheelWidth / 2}
            y2={groundY}
          />
        ) : (
          <ellipse
            cx={rightWheelX + wheelWidth / 2}
            cy={groundY - wheelHeight / 2}
            rx={wheelEllipseRx}
            ry={wheelEllipseRy}
            clipPath={isPositiveLean ? "url(#clip-ro-pos)" : undefined}
          />
        )}
      </g>

      {/* Axle line */}
      <line
        x1={leftAxleX}
        y1={axleY}
        x2={rightAxleX}
        y2={axleY}
        stroke={"#475569"}
        strokeWidth={2.5}
        opacity={0.9}
      />


      {/* Board surface - drawn using centerOfBoard position and tilted */}
      <>
        <polygon
          points={`${boardStartX},${boardStartY} ${boardEndX},${boardEndY} ${boardEndX + normalOffsetX},${boardEndY + normalOffsetY} ${boardStartX + normalOffsetX},${boardStartY + normalOffsetY}`}
          fill="#334155"
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
        {/* Center-of-force indicator: short, thick gravity arrow (downward). */}
        <defs>
          <marker id="gravity-arrow-tip" markerWidth={4} markerHeight={4} refX={2} refY={2} orient="auto">
            <path d="M0,0 L4,2 L0,4 Z" fill="#94a3b8" />
          </marker>
        </defs>
        <line
          x1={centerForceXSvg}
          y1={centerForceYSvg - 30}
          x2={centerForceXSvg}
          y2={centerForceYSvg - 8}
          stroke="#94a3b8"
          strokeWidth={4}
          markerEnd="url(#gravity-arrow-tip)"
        />
        <text
          x={boardEndX + 4}
          y={boardEndY + 4}
          fill={UI_TEXT_MUTED}
          fontSize={9}
          fontFamily="monospace"
        >
          board
        </text>

        <g data-tour="front-view-inv-pendulum">
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
        </g>

      </>

      {/* Center of board curve */}
      {activeCurve && (
        <path
          d={activeCurve
            .map((p, i) => {
              const pointRotCenterY = dBoard - p.invPendulumHeight
              const [sx, sy] = toSVG(p.centerOfBoardZ, p.centerOfBoardY + pointRotCenterY)
              return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`
            })
            .join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 2"
          opacity={0.8}
        />
      )}

      {/* Center of force curve */}
      {activeCurve && (
        <path
          d={activeCurve
            .map((p, i) => {
              const pointRotCenterY = dBoard - p.invPendulumHeight
              const [sx, sy] = toSVG(p.centerOfForceZ, p.centerOfForceY + pointRotCenterY)
              return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`
            })
            .join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="2 2"
          opacity={0.6}
        />
      )}

      {/* Track width dimension */}
      <line
        x1={leftWheelX}
        y1={groundY + 10}
        x2={rightWheelX}
        y2={groundY + 10}
        stroke={UI_TEXT_MUTED}
        strokeWidth={1}
      />
      <line x1={leftWheelX} y1={groundY + 6} x2={leftWheelX} y2={groundY + 14} stroke={UI_TEXT_MUTED} strokeWidth={1} />
      <line x1={rightWheelX} y1={groundY + 6} x2={rightWheelX} y2={groundY + 14} stroke={UI_TEXT_MUTED} strokeWidth={1} />
      <text
        x={(leftWheelX + rightWheelX) / 2}
        y={groundY + 22}
        fill={UI_TEXT_MUTED}
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
      >
        w={truck.trackWidth}mm
      </text>


      {/* Axis labels */}
    </svg>
  )
}

export default FrontView
