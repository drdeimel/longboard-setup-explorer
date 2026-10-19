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
import { computeWheelRimZPositions } from '../geometry/wheelRimPositions'
import type { KeyGeometryResult } from '../physics/keyGeometryDataSet'
import { DISPLAY_WHEEL_OFFSET_MM } from '../physics/keyGeometryDataSet'
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
const CENTER_OF_MOMENT_EPSILON = 1e-9

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
    centerY + radius * Math.sin(angle),
  ]
  const [x1, y1] = point(angleRad - halfWidthRad)
  const [x2, y2] = point(angleRad + halfWidthRad)
  return `M ${centerX.toFixed(1)} ${centerY.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`
}

function toPolylinePoints(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

function wheelRectanglePoints(
  axleX: number,
  centerZ: number,
  steerAngleDeg: number,
  wheelDiameterMm: number,
  wheelWidthMm: number,
  toSVG: (x: number, z: number) => [number, number],
): string {
  const steerRad = (steerAngleDeg * Math.PI) / 180
  const rolling = [Math.cos(steerRad), -Math.sin(steerRad)]
  const axle = [Math.sin(steerRad), Math.cos(steerRad)]
  const wheelCenterX = axleX + axle[0] * centerZ
  const wheelCenterZ = axle[1] * centerZ
  const halfLength = wheelDiameterMm / 2
  const halfWidth = wheelWidthMm / 2
  const corners = [
    [wheelCenterX + rolling[0] * halfLength + axle[0] * halfWidth, wheelCenterZ + rolling[1] * halfLength + axle[1] * halfWidth],
    [wheelCenterX - rolling[0] * halfLength + axle[0] * halfWidth, wheelCenterZ - rolling[1] * halfLength + axle[1] * halfWidth],
    [wheelCenterX - rolling[0] * halfLength - axle[0] * halfWidth, wheelCenterZ - rolling[1] * halfLength - axle[1] * halfWidth],
    [wheelCenterX + rolling[0] * halfLength - axle[0] * halfWidth, wheelCenterZ + rolling[1] * halfLength - axle[1] * halfWidth],
  ]
  return corners
    .map(([x, z]) => {
      const [svgX, svgY] = toSVG(x, z)
      return `${svgX.toFixed(1)},${svgY.toFixed(1)}`
    })
    .join(' ')
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
  const originX = width / 2 - refSetup.wheelbase * icrScale * 0.5
  const originY = height / 2

  /** Convert physics (X, Z) to SVG pixel coordinates (90° CCW rotated view).
   *  physX (forward) → horizontal: front at left, rear at right.
   *  physZ (lateral) → vertical: heel side (+Z) goes downward.
   */
  const toSVG = (physX: number, physZ: number): [number, number] => [
    originX + physX * icrScale,
    originY + physZ * icrScale,
  ]

  // Precompute board outline dimensions for the reference setup (drawn once)
  // Use the configured board width without the former ICR-view padding.
  const boardExtensionMm = 0
  const refHalfBoardWidth = boardWidthMm / 2
  const extendedHalfBoardWidth = refHalfBoardWidth + boardExtensionMm
  
  const refBoardWidthPx = refSetup.wheelbase * icrScale + 2 * 0.1 * refSetup.wheelbase * icrScale
  const refBoardHeightPx = (boardWidthMm + 2 * boardExtensionMm) * icrScale
  const [refBoardLeft, refBoardTop] = toSVG(-0.1 * refSetup.wheelbase, -extendedHalfBoardWidth)

  // Precompute side line positions (at actual track width)
  const [frontAxleX] = toSVG(0, refHalfBoardWidth)
  const [rearAxleX] = toSVG(refSetup.wheelbase, refHalfBoardWidth)

  const windroses = useMemo(() => {
    const activeCurveData = keyGeometryCurves?.find(d => d.setupId === activeSetupId)
    if (!activeCurveData || activeCurveData.curve.length === 0) return []

    const point = activeCurveData.curve.reduce((prev, curr) =>
      Math.abs(curr.leanAngleDeg - steeringLeanAngleDeg) < Math.abs(prev.leanAngleDeg - steeringLeanAngleDeg) ? curr : prev,
    )
    return [
      {
        id: 'front',
        center: toSVG(0, 0),
        color: refSetup.color,
        steerAngleDeg: point.frontSteerAngleDeg,
      },
      {
        id: 'rear',
        center: toSVG(refSetup.wheelbase, 0),
        color: refSetup.color,
        // The rear truck is mounted backwards.
        steerAngleDeg: -point.rearSteerAngleDeg,
      },
    ].map(windrose => {
      const samples = computePositivePropulsionWindrose(windrose.steerAngleDeg, WINDROSE_SAMPLE_COUNT)
      return {
        ...windrose,
        samples,
        perpendicularRatios: {
          90: samples.find(sample => sample.appliedAngleDeg === 90)?.ratio ?? 0,
          270: samples.find(sample => sample.appliedAngleDeg === 270)?.ratio ?? 0,
        },
      }
    })
  }, [keyGeometryCurves, activeSetupId, steeringLeanAngleDeg, refSetup.color, refSetup.wheelbase])

  const centerOfMoment = useMemo(() => {
    const front = windroses.find(windrose => windrose.id === 'front')
    const rear = windroses.find(windrose => windrose.id === 'rear')
    if (!front || !rear) return null

    const frontAngle = front.perpendicularRatios[90] >= front.perpendicularRatios[270] ? 90 : 270
    const rearAngle = frontAngle === 90 ? 270 : 90
    const frontRatio = front.perpendicularRatios[frontAngle]
    const rearRatio = rear.perpendicularRatios[rearAngle]
    if (rearRatio <= 0) return null

    const distanceFromFrontMm = (rearRatio / (rearRatio + frontRatio + CENTER_OF_MOMENT_EPSILON)) * refSetup.wheelbase
    return toSVG(distanceFromFrontMm, 0)
  }, [windroses, refSetup.wheelbase])

  const axleLine = (axleX: number, steerAngleDeg: number, trackWidthMm: number): { x1: number; y1: number; x2: number; y2: number } => {
    const steerRad = (steerAngleDeg * Math.PI) / 180
    const halfTrackPx = (trackWidthMm / 2) * icrScale
    return {
      x1: axleX - halfTrackPx * Math.sin(steerRad),
      y1: originY - halfTrackPx * Math.cos(steerRad),
      x2: axleX + halfTrackPx * Math.sin(steerRad),
      y2: originY + halfTrackPx * Math.cos(steerRad),
    }
  }

  const wheelOffsetMm = refSetup.frontTruck.wheelOffset ?? DISPLAY_WHEEL_OFFSET_MM
  const axleSpanMm = refSetup.frontTruck.trackWidth + 2 * wheelOffsetMm
  const frontAxleLine = axleLine(frontAxleX, windroses[0]?.steerAngleDeg ?? 0, axleSpanMm)
  // The rear truck is mounted backwards, so its visible axle rotation is reversed.
  const rearAxleLine = axleLine(rearAxleX, windroses[1]?.steerAngleDeg ?? 0, axleSpanMm)

  const frontWheelRims = computeWheelRimZPositions(
    refSetup.frontTruck.trackWidth,
    wheelOffsetMm,
    refSetup.frontTruck.wheelWidth,
  )
  const rearWheelRims = computeWheelRimZPositions(
    refSetup.frontTruck.trackWidth,
    wheelOffsetMm,
    refSetup.frontTruck.wheelWidth,
  )
  const frontLeftWheelZ = (frontWheelRims.leftOuterZ + frontWheelRims.leftInnerZ) / 2
  const frontRightWheelZ = (frontWheelRims.rightInnerZ + frontWheelRims.rightOuterZ) / 2
  const rearLeftWheelZ = (rearWheelRims.leftOuterZ + rearWheelRims.leftInnerZ) / 2
  const rearRightWheelZ = (rearWheelRims.rightInnerZ + rearWheelRims.rightOuterZ) / 2

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
      icrPoint: isStraight ? null : toSVG(icrX!, icrZ!),
      projectedIcrPoint: isStraight ? null : toSVG(icrX!, 0),
    }
  }, [keyGeometryCurves, activeSetupId, steeringLeanAngleDeg, maxWheelbase, refSetup.color])

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-label="Top view (XZ plane) with pumping gear ratio"
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
        Top View (XZ) — Lever/Transmission Windrose + Turning Arc
      </text>

      {/* Board outline — drawn once for the reference setup, extended by 60mm on both sides */}
      <rect
        x={refBoardLeft}
        y={refBoardTop}
        width={refBoardWidthPx}
        height={refBoardHeightPx}
        fill="#334155"
        fillOpacity={1}
        stroke="none"
        rx={3}
      />

      <g fill="#475569" fillOpacity={0.9} stroke="#64748b" strokeWidth={1}>
        <polygon points={wheelRectanglePoints(0, frontLeftWheelZ, windroses[0]?.steerAngleDeg ?? 0, refSetup.frontTruck.wheelDiameter, refSetup.frontTruck.wheelWidth, toSVG)} />
        <polygon points={wheelRectanglePoints(0, frontRightWheelZ, windroses[0]?.steerAngleDeg ?? 0, refSetup.frontTruck.wheelDiameter, refSetup.frontTruck.wheelWidth, toSVG)} />
        <polygon points={wheelRectanglePoints(refSetup.wheelbase, rearLeftWheelZ, windroses[1]?.steerAngleDeg ?? 0, refSetup.frontTruck.wheelDiameter, refSetup.frontTruck.wheelWidth, toSVG)} />
        <polygon points={wheelRectanglePoints(refSetup.wheelbase, rearRightWheelZ, windroses[1]?.steerAngleDeg ?? 0, refSetup.frontTruck.wheelDiameter, refSetup.frontTruck.wheelWidth, toSVG)} />
      </g>
      
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
      {windroses.map(windrose => (
        <g
          key={windrose.id}
          aria-label={`${windrose.id} pumping gear ratio`}
          data-tour={windrose.id === 'front' ? 'front-lever-windrose' : undefined}
        >
          {windrose.samples.map(sample => {
            const isPerpendicular = sample.appliedAngleDeg === 90 || sample.appliedAngleDeg === 270
            return (
              <path
                key={sample.appliedAngleDeg}
                d={windroseWedgePath(windrose.center[0], windrose.center[1], sample, icrScale)}
                fill={isPerpendicular ? '#7dd3fc' : windrose.color}
                fillOpacity={isPerpendicular ? 0.65 : 0.3}
                stroke={isPerpendicular ? '#7dd3fc' : windrose.color}
                strokeOpacity={isPerpendicular ? 0.75 : 0.45}
                strokeWidth={0.5}
              />
            )
          })}
        </g>
      ))}

      {centerOfMoment && (
        <g aria-label="Center of Moment for Rotational Pumping">
          <circle
            cx={centerOfMoment[0]}
            cy={centerOfMoment[1]}
            r={4}
            fill="#ffffff"
            stroke="#0f172a"
            strokeWidth={1}
          />
          <text
            x={centerOfMoment[0] + 8}
            y={centerOfMoment[1] - 6}
            fill="#ffffff"
            fontSize={10}
            fontFamily="monospace"
          >
            <tspan x={centerOfMoment[0] + 8} dy="0">Center of Moment</tspan>
            <tspan x={centerOfMoment[0] + 8} dy="12">for Pumping</tspan>
          </text>
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

      {turningArc?.icrPoint && (
        <circle
          cx={turningArc.icrPoint[0]}
          cy={turningArc.icrPoint[1]}
          r={4}
          fill="#3b82f6"
          stroke="#ffffff"
          strokeWidth={1}
          aria-label="Instantaneous center of rotation"
        />
      )}

      {turningArc?.projectedIcrPoint && (
        <g aria-label="Furthest back stable CoM position">
          <circle
            cx={turningArc.projectedIcrPoint[0]}
            cy={turningArc.projectedIcrPoint[1]}
            r={4}
            fill="#60a5fa"
            stroke="#0f172a"
            strokeWidth={1}
          />
          <text
            x={turningArc.projectedIcrPoint[0] + 8}
            y={turningArc.projectedIcrPoint[1] - 6}
            fill="#60a5fa"
            fontSize={10}
            fontFamily="monospace"
          >
            <tspan x={turningArc.projectedIcrPoint[0] + 8} dy="0">Furthest back</tspan>
            <tspan x={turningArc.projectedIcrPoint[0] + 8} dy="12">stable CoM position</tspan>
          </text>
        </g>
      )}

      {turningArc?.radiusMm != null && turningArc.radiusMm < 99900 && (
        <text
          x={width - 8}
          y={height - 8}
          fill={UI_TEXT_MUTED}
          fontSize={13}
          fontFamily="monospace"
          textAnchor="end"
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
