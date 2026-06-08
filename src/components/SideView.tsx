/**
 * SideView component — annotated 2D side cross-section (XY plane) of the front truck.
 *
 * Shows the truck geometry from the side:
 * - X axis (horizontal) = forward board direction
 * - Y axis (vertical) = up
 *
 * Elements drawn:
 * - Road surface (ground plane at y = −wheelDiameter/2)
 * - Wheel outline (circle)
 * - Axle center (origin, marked with crosshair)
 * - Board surface (horizontal line at y = axleToBoardDistance)
 * - Pivot axis line (extends through the truck, colored by setup color)
 * - Rake offset indicator
 * - Annotations: pivot axis angle α, axle-to-board distance, rake
 *
 * All geometry uses the project coordinate system (X forward, Y up).
 * SVG coordinate system flips Y so that up on screen = positive Y in physics.
 */

import React from 'react'
import type { TruckConfig } from '../models/TruckConfig'
import { computePivotAxis, boardSurfaceHeight } from '../geometry/pivotAxis'
import { computeInvPendulumHeight, DISPLAY_GEOMETRY_WIDTH_MM } from '../physics/keyGeometryDataSet'
import { UI_TEXT_MUTED, UI_TEXT_PRIMARY, UI_TEXT_SECONDARY } from '../theme/uiColors'

/** Props for the SideView component. */
interface SideViewProps {
  /** Front truck configuration to visualize. */
  truck: TruckConfig
  /** CSS hex color for this setup (e.g. '#ef4444'). */
  color: string
  /** SVG viewport width in pixels. */
  width?: number
  /** SVG viewport height in pixels. */
  height?: number
  /**
   * Scale in pixels per mm. If provided, this shared scale must match FrontView
   * and TopView to maintain geometric consistency across views.
   */
  pixelsPerMm?: number
  /**
   * Ground offset from the bottom of the SVG in pixels.
   * When provided, ensures the floor line aligns with FrontView for consistent visuals.
   */
  groundOffsetPx?: number
  /** Global board thickness in mm (shared with FrontView). */
  boardThicknessMm?: number
}

/** Default SVG dimensions. */
const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 280

/**
 * SideView — annotated 2D side cross-section of the front truck geometry.
 *
 * @param props - Truck configuration and display options.
 * @returns SVG element showing side cross-section.
 */
const SideView: React.FC<SideViewProps> = ({
  truck,
  color,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  pixelsPerMm,
  groundOffsetPx = 20,
  boardThicknessMm = 11,
}) => {
  const dBoard = boardSurfaceHeight(
    truck.axleToBaseplateDistance,
    truck.baseplateToBoard + boardThicknessMm,
  )
  const { direction: axisDir, point: axisPoint } = computePivotAxis(
    truck.pivotAxisAngle,
    truck.rake,
  )

  // Determine scale: fit the geometry into the SVG with some padding
  // The geometry spans from −wheelDiameter/2 (ground) to +dBoard (board surface)
  // horizontally we'll show some range around origin
  const geometryHeightMm = dBoard + truck.wheelDiameter / 2 + 20 // margin
  const geometryWidthMm = DISPLAY_GEOMETRY_WIDTH_MM // ±100 mm from axle

  const ppm = pixelsPerMm ?? Math.min(
    (width - 40) / geometryWidthMm,
    (height - 40) / geometryHeightMm,
  )

  // SVG origin: place axle center at center-x, with vertical position that
  // allows the ground and board to both be visible
  const originX = width / 2
  // Position axle center such that ground is at bottom and board near top
  // Use groundOffsetPx to ensure alignment with FrontView
  const originY = height - groundOffsetPx - truck.wheelDiameter / 2 * ppm

  /** Convert physics (X, Y) to SVG (px, py). Y is flipped (SVG y increases downward). */
  const toSVG = (physX: number, physY: number): [number, number] => [
    originX + physX * ppm,
    originY - physY * ppm,
  ]

  // Ground plane: y = −wheelDiameter/2
  const groundY = originY + truck.wheelDiameter / 2 * ppm

  // Pivot axis line: extends from ground level to board level along the axis direction
  // The axis direction is computed from pivotAxisAngle: direction = [cos(α), sin(α), 0]
  // For positive angles, positive direction points up toward board, negative points down to ground
  const wheelRadius = truck.wheelDiameter / 2
  
  // Calculate extent to reach ground level (y = -wheelRadius) and board level (y = dBoard)
  // Using parametric equation: y = axisPoint[1] + t * axisDir[1]
  // Solve for t: t = (y - axisPoint[1]) / axisDir[1]
  // Need to handle case where axisDir[1] is close to zero (horizontal axis)
  const axisDirY = axisDir[1]
  const axisPointY = axisPoint[1]
  
  // Check angle direction matches pivotAxisAngle configuration
  const angleSign = Math.sign(axisDirY)
  const expectedSign = Math.sign(Math.sin((truck.pivotAxisAngle * Math.PI) / 180))
  const angleMatches = Math.abs(angleSign) === Math.abs(expectedSign) || Math.abs(axisDirY) < 0.001
  
  // Calculate t values for ground and board
  // For positive direction (toward board): y = dBoard
  // For negative direction (toward ground): y = -wheelRadius
  // t = (y - axisPointY) / axisDirY
  const tBoard = Math.abs(axisDirY) > 0.001 
    ? (dBoard - axisPointY) / axisDirY 
    : 0 // Horizontal axis case - use default extent
  const tGround = Math.abs(axisDirY) > 0.001 
    ? (axisPointY + wheelRadius) / axisDirY 
    : -150 // Horizontal axis case - use default negative extent
  
  // For positive axisDirY (typical RKP trucks):
  // - tBoard > 0 means going forward/up to reach board
  // - We need to go backward/down to reach ground (use negative t or invert)
  // The axis extends in both positive and negative directions from axisPoint
  const tPos = tBoard  // positive extent toward board (larger y value)
  const tNeg = -tGround  // negative extent toward ground (smaller y value when axisDirY > 0)
  
  // Compute the endpoints using the calculated t values
  const axPos = axisPoint[0] + axisDir[0] * tPos
  const ayPos = axisPoint[1] + axisDirY * tPos
  const axNeg = axisPoint[0] + axisDir[0] * tNeg
  const ayNeg = axisPoint[1] + axisDirY * tNeg
  
  const [svgAxPos, svgAyPos] = toSVG(axPos, ayPos)
  const [svgAxNeg, svgAyNeg] = toSVG(axNeg, ayNeg)

  // Wheel circle center is at axle center (origin in physics = (0,0))
  const [wheelCx, wheelCy] = toSVG(0, 0)
  const wheelR = truck.wheelDiameter / 2 * ppm

  // Axle center crosshair
  const [axleSvgX, axleSvgY] = toSVG(0, 0)

  // Board surface line - extends to the edges of the visible geometry box
  const [, boardSurfaceY] = toSVG(0, dBoard)
  const boardLineLeft = 20
  const boardLineRight = width - 20
  // Board thickness is controlled globally from App/ConfigPanel.
  // The top edge stays on boardSurfaceY; the body extends downward.
  const boardThicknessPx = boardThicknessMm * ppm

  // Rake indicator: line from origin to axis closest point
  const [rakeEndX, rakeEndY] = toSVG(axisPoint[0], axisPoint[1])

  // Annotation: pivot axis angle arc
  // Draw the arc at the pivot axis ground intersection point, showing the
  // angle between the pivot axis and the ground plane (horizontal)
  const arcRadius = 40 * ppm
  const alphaDeg = truck.pivotAxisAngle
  const alphaRad = (alphaDeg * Math.PI) / 180
  // Arc center is at the pivot axis ground intersection point
  const arcCenterX = svgAxNeg
  const arcCenterY = svgAyNeg
  // Arc starts along the ground (horizontal right) and sweeps up to the pivot axis
  const arcStartX = arcCenterX + arcRadius
  const arcStartY = arcCenterY
  const arcEndX = arcCenterX + arcRadius * Math.cos(alphaRad)
  const arcEndY = arcCenterY - arcRadius * Math.sin(alphaRad) // SVG y flip

  // Effective rotation center (intersection of pivot axis and hanger vertical rotation axis)
  // This is measured from the axle (Y=0), not from ground
  // At rake=0, this equals axleToBaseplateDistance (height of pivot point above axle)
  // Positive rake moves the effective rotation center UP from the axle
  const invPendulumHeight = computeInvPendulumHeight(
    truck.axleToBaseplateDistance,
    truck.baseplateToBoard,
    boardThicknessMm,
    truck.rake,
    truck.pivotAxisAngle,
  )
  const [, effectiveRotCenterY] = toSVG(0, dBoard - invPendulumHeight)

  // Trailing: horizontal distance from wheel contact patch (x=0) to where
  // the pivot axis intersects the ground plane (y = -wheelRadius)
  // axNeg is the x-coordinate of the pivot axis ground intersection point
  const trailingMm = Math.abs(axNeg)
  const trailingIndicatorY = groundY + 15
  const [trailingStartX] = toSVG(0, -wheelRadius) // wheel contact patch x
  const trailingEndX = svgAxNeg // pivot axis ground intersection x

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-label="Side view cross-section (XY plane)"
    >
      {/* Background */}
      <rect width={width} height={height} fill="#0f172a" rx={4} />

      {/* Title */}
      <text x={8} y={18} fill={UI_TEXT_PRIMARY} fontSize={11} fontFamily="monospace">
        Side View (XY)
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
      <text x={4} y={groundY - 4} fill={UI_TEXT_MUTED} fontSize={9} fontFamily="monospace">
        ground
      </text>

      {/* Wheel circle */}
      <circle
        cx={wheelCx}
        cy={wheelCy}
        r={wheelR}
        fill="none"
        stroke="#475569"
        strokeWidth={0.25}
      />
      {/* Wheel contact point */}
      <circle cx={wheelCx} cy={groundY} r={3} fill={UI_TEXT_MUTED} />

      {/* Board surface */}
      <rect
        x={boardLineLeft}
        y={boardSurfaceY}
        width={boardLineRight - boardLineLeft}
        height={boardThicknessPx}
        fill="#334155"
      />
      <text x={boardLineRight + 4} y={boardSurfaceY + boardThicknessPx + 4} fill={UI_TEXT_MUTED} fontSize={9} fontFamily="monospace">
        board
      </text>

      {/* Pivot axis line */}
      <line
        x1={svgAxNeg}
        y1={svgAyNeg}
        x2={svgAxPos}
        y2={svgAyPos}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6 3"
        opacity={0.85}
      />

      {/* Rake indicator: dashed line from origin to closest axis point */}
      {Math.abs(truck.rake) > 0.5 && (
        <>
          <line
            x1={axleSvgX}
            y1={axleSvgY}
            x2={rakeEndX}
            y2={rakeEndY}
            stroke="#22d3ee"
            strokeWidth={1.5}
            strokeDasharray="3 2"
          />
          {/* Tick at axle */}
          <line x1={axleSvgX - 4} y1={axleSvgY - 4} x2={axleSvgX + 4} y2={axleSvgY + 4} stroke="#22d3ee" strokeWidth={1} />
          <line x1={axleSvgX + 4} y1={axleSvgY - 4} x2={axleSvgX - 4} y2={axleSvgY + 4} stroke="#22d3ee" strokeWidth={1} />
          <text
            x={(axleSvgX + rakeEndX) / 2 + 4}
            y={(axleSvgY + rakeEndY) / 2}
            fill="#22d3ee"
            fontSize={9}
            fontFamily="monospace"
          >
            r={truck.rake}mm
          </text>
        </>
      )}

      {/* invPendulum dimension: distance from board to rotation axis intersection point */}
      <g data-tour="side-view-inv-pendulum">
        {/* Vertical dimension line from board surface down to effective rotation center */}
        <line
          x1={originX + 50}
          y1={boardSurfaceY}
          x2={originX + 50}
          y2={effectiveRotCenterY}
          stroke="#22d3ee"
          strokeWidth={1.5}
        />
        {/* Tick marks at endpoints */}
        <line x1={originX + 46} y1={boardSurfaceY} x2={originX + 54} y2={boardSurfaceY} stroke="#22d3ee" strokeWidth={1} />
        <line x1={originX + 46} y1={effectiveRotCenterY} x2={originX + 54} y2={effectiveRotCenterY} stroke="#22d3ee" strokeWidth={1} />
        {/* Value label */}
        <text
          x={originX + 58}
          y={(boardSurfaceY + effectiveRotCenterY) / 2 + 4}
          fill="#22d3ee"
          fontSize={9}
          fontFamily="monospace"
        >
          {invPendulumHeight.toFixed(1)}mm
        </text>
      </g>

      {/* Axle center crosshair */}
      <line
        x1={axleSvgX - 8}
        y1={axleSvgY}
        x2={axleSvgX + 8}
        y2={axleSvgY}
        stroke="#e2e8f0"
        strokeWidth={1.5}
      />
      <line
        x1={axleSvgX}
        y1={axleSvgY - 8}
        x2={axleSvgX}
        y2={axleSvgY + 8}
        stroke="#e2e8f0"
        strokeWidth={1.5}
      />
      <circle cx={axleSvgX} cy={axleSvgY} r={3} fill="#e2e8f0" />

      {/* Vertical rotation axis of the hanger (dashed line through axle) */}
      <line
        x1={axleSvgX}
        y1={groundY - 10}
        x2={axleSvgX}
        y2={boardSurfaceY + 10}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 4"
        opacity={0.6}
      />

      {/* Effective rotation center (intersection point) */}
      <g data-tour="side-view-rotation-center">
        <circle
          cx={axleSvgX}
          cy={effectiveRotCenterY}
          r={5}
          fill={color}
          stroke="#ffffff"
          strokeWidth={1.5}
          opacity={0.9}
        />
      </g>

      {/* Pivot angle arc annotation */}
      <path
        d={`M ${arcStartX} ${arcStartY} A ${arcRadius} ${arcRadius} 0 0 0 ${arcEndX} ${arcEndY}`}
        fill="none"
        stroke={UI_TEXT_PRIMARY}
        strokeWidth={1}
      />
      <text
        x={arcCenterX + arcRadius * Math.cos(alphaRad / 2) + 4}
        y={arcCenterY - arcRadius * Math.sin(alphaRad / 2)}
        fill={UI_TEXT_PRIMARY}
        fontSize={10}
        fontFamily="monospace"
      >
        α={alphaDeg}°
      </text>

      {/* Axle-to-board dimension (board surface height) - moved to left side */}
      <line
        x1={originX - 100}
        y1={axleSvgY}
        x2={originX - 100}
        y2={boardSurfaceY}
        stroke="#22d3ee"
        strokeWidth={1.5}
      />
      {/* Tick marks */}
      <line x1={originX - 104} y1={axleSvgY} x2={originX - 96} y2={axleSvgY} stroke="#22d3ee" strokeWidth={1} />
      <line x1={originX - 104} y1={boardSurfaceY} x2={originX - 96} y2={boardSurfaceY} stroke="#22d3ee" strokeWidth={1} />
      <text
        x={originX - 108}
        y={(axleSvgY + boardSurfaceY) / 2 + 4}
        fill="#22d3ee"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="end"
      >
        {dBoard}mm
      </text>

      {/* Wheel radius dimension */}
      <line
        x1={originX - 100}
        y1={axleSvgY}
        x2={originX - 100}
        y2={groundY}
        stroke="#22d3ee"
        strokeWidth={1.5}
      />
      {/* Tick marks */}
      <line x1={originX - 104} y1={axleSvgY} x2={originX - 96} y2={axleSvgY} stroke="#22d3ee" strokeWidth={1} />
      <line x1={originX - 104} y1={groundY} x2={originX - 96} y2={groundY} stroke="#22d3ee" strokeWidth={1} />
      <text
        x={originX - 112}
        y={(axleSvgY + groundY) / 2 + 4}
        fill="#22d3ee"
        fontSize={9}
        fontFamily="monospace"
        textAnchor="end"
      >
        r={truck.wheelDiameter / 2}
      </text>

      {/* Trailing dimension: horizontal distance from wheel contact patch to pivot axis ground intersection */}
      <g data-tour="side-view-trailing">
        <line
          x1={trailingStartX}
          y1={trailingIndicatorY}
          x2={trailingEndX}
          y2={trailingIndicatorY}
          stroke="#22d3ee"
          strokeWidth={1.5}
        />
        {/* Tick marks */}
        <line x1={trailingStartX} y1={trailingIndicatorY - 4} x2={trailingStartX} y2={trailingIndicatorY + 4} stroke="#22d3ee" strokeWidth={1} />
        <line x1={trailingEndX} y1={trailingIndicatorY - 4} x2={trailingEndX} y2={trailingIndicatorY + 4} stroke="#22d3ee" strokeWidth={1} />
        <text
          x={(trailingStartX + trailingEndX) / 2}
          y={trailingIndicatorY + 14}
          fill="#22d3ee"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="middle"
        >
          trailing={trailingMm.toFixed(1)}mm
        </text>
      </g>

      {/* Arrow markers definition */}
      <defs>
        <marker id="arrowUp" markerWidth={6} markerHeight={6} refX={3} refY={6} orient="auto">
          <path d="M0,6 L3,0 L6,6" fill={UI_TEXT_MUTED} />
        </marker>
        <marker id="arrowDown" markerWidth={6} markerHeight={6} refX={3} refY={0} orient="auto">
          <path d="M0,0 L3,6 L6,0" fill={UI_TEXT_MUTED} />
        </marker>
      </defs>

      {/* Axis labels */}
      <text x={width - 20} y={originY + 4} fill={UI_TEXT_SECONDARY} fontSize={10} fontFamily="monospace">
        +X
      </text>
      <text x={originX + 4} y={20} fill={UI_TEXT_SECONDARY} fontSize={10} fontFamily="monospace">
        +Y
      </text>
      <line
        x1={10}
        y1={originY}
        x2={width - 10}
        y2={originY}
        stroke="#1e293b"
        strokeWidth={0.5}
        strokeDasharray="2 4"
      />
    </svg>
  )
}

export default SideView
