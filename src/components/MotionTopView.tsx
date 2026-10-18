import React, { useMemo } from 'react'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import type { KeyGeometryResult } from '../physics/keyGeometryDataSet'
import type { BoardPose, MotionViewportMode } from '../geometry/boardMotion'
import type { Point2D } from '../geometry/turningCenter'
import { DISPLAY_WHEEL_WIDTH_MM } from '../physics/keyGeometryDataSet'
import { MOTION_VIEW_SCALE_PX_PER_MM } from '../geometry/boardMotion'

interface MotionTracePoint {
  position: Point2D
  timeSeconds: number
  color: string
}

interface MotionTopViewProps {
  setup: BoardSetupConfig
  pose: BoardPose
  trace: MotionTracePoint[]
  viewportCenter: Point2D
  viewportScale?: number
  viewportMode: MotionViewportMode
  onViewportModeChange: (mode: MotionViewportMode) => void
  width?: number
  height?: number
  boardWidthMm?: number
  steeringLeanAngleDeg?: number
  keyGeometryCurve?: KeyGeometryResult[]
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 300

function rotate(point: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  return { x: cos * point.x - sin * point.z, z: sin * point.x + cos * point.z }
}

const MotionTopView: React.FC<MotionTopViewProps> = ({
  setup,
  pose,
  trace,
  viewportCenter,
  viewportScale = MOTION_VIEW_SCALE_PX_PER_MM,
  viewportMode,
  onViewportModeChange,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  boardWidthMm = 245,
  steeringLeanAngleDeg = 0,
  keyGeometryCurve,
}) => {
  const scale = viewportScale
  const toSVG = (point: Point2D): [number, number] => [
    width / 2 + (point.x - viewportCenter.x) * scale,
    height / 2 + (point.z - viewportCenter.z) * scale,
  ]
  const toWorld = (local: Point2D): Point2D => {
    const rotated = rotate(local, pose.headingRad)
    return { x: pose.position.x + rotated.x, z: pose.position.z + rotated.z }
  }

  const currentGeometry = useMemo(() => {
    if (!keyGeometryCurve || keyGeometryCurve.length === 0) return undefined
    return keyGeometryCurve.reduce((previous, current) =>
      Math.abs(current.leanAngleDeg - steeringLeanAngleDeg) < Math.abs(previous.leanAngleDeg - steeringLeanAngleDeg) ? current : previous,
    )
  }, [keyGeometryCurve, steeringLeanAngleDeg])
  const frontSteerRad = ((currentGeometry?.frontSteerAngleDeg ?? 0) * Math.PI) / 180
  const rearSteerRad = -((currentGeometry?.rearSteerAngleDeg ?? 0) * Math.PI) / 180
  const halfWidth = boardWidthMm / 2
  const halfWheelWidth = DISPLAY_WHEEL_WIDTH_MM / 2
  const wheelLength = setup.frontTruck.wheelDiameter
  const wheelHalfTrack = setup.frontTruck.trackWidth / 2

  const boardCorners = [
    toSVG(toWorld({ x: 0, z: -halfWidth })),
    toSVG(toWorld({ x: setup.wheelbase, z: -halfWidth })),
    toSVG(toWorld({ x: setup.wheelbase, z: halfWidth })),
    toSVG(toWorld({ x: 0, z: halfWidth })),
  ].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

  // Steering rotates each wheel's axle endpoint around the truck axle center.
  const steeredAxlePoint = (x: number, z: number, steerRad: number): Point2D => ({
    x: x + Math.sin(steerRad) * z,
    z: Math.cos(steerRad) * z,
  })

  const axleLine = (x: number, steerRad: number) => {
    const left = toSVG(toWorld(steeredAxlePoint(x, -wheelHalfTrack, steerRad)))
    const right = toSVG(toWorld(steeredAxlePoint(x, wheelHalfTrack, steerRad)))
    return { x1: left[0], y1: left[1], x2: right[0], y2: right[1] }
  }

  const wheelPolygon = (x: number, z: number, steerRad: number) => {
    const wheelCenter = steeredAxlePoint(x, z, steerRad)
    // Match the analytical TopView convention: rolling direction rotates
    // opposite to the axle vector around the shared axle center.
    const rolling = { x: Math.cos(steerRad), z: -Math.sin(steerRad) }
    const axle = { x: Math.sin(steerRad), z: Math.cos(steerRad) }
    const local = [
      { x: -rolling.x * wheelLength / 2 - axle.x * halfWheelWidth, z: -rolling.z * wheelLength / 2 - axle.z * halfWheelWidth },
      { x: rolling.x * wheelLength / 2 - axle.x * halfWheelWidth, z: rolling.z * wheelLength / 2 - axle.z * halfWheelWidth },
      { x: rolling.x * wheelLength / 2 + axle.x * halfWheelWidth, z: rolling.z * wheelLength / 2 + axle.z * halfWheelWidth },
      { x: -rolling.x * wheelLength / 2 + axle.x * halfWheelWidth, z: -rolling.z * wheelLength / 2 + axle.z * halfWheelWidth },
    ].map(offset => toSVG(toWorld({ x: wheelCenter.x + offset.x, z: wheelCenter.z + offset.z })))
    return local.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  }

  const frontAxle = axleLine(0, frontSteerRad)
  const rearAxle = axleLine(setup.wheelbase, rearSteerRad)
  const traceSegments = trace.slice(1).map((point, index) => {
    const previous = trace[index]
    const [x1, y1] = toSVG(previous.position)
    const [x2, y2] = toSVG(point.position)
    return { key: `${previous.timeSeconds}-${point.timeSeconds}`, x1, y1, x2, y2, color: point.color }
  })

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="block" aria-label="Birds-eye board motion trace">
      <defs>
        <pattern
          id="motion-floor-pebbles"
          width="72"
          height="72"
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${(width / 2 - viewportCenter.x * scale).toFixed(2)} ${(height / 2 - viewportCenter.z * scale).toFixed(2)})`}
        >
          <rect width="72" height="72" fill="#17251d" />
          <circle cx="12" cy="18" r="2.2" fill="#33483a" />
          <circle cx="39" cy="11" r="1.5" fill="#405542" />
          <circle cx="58" cy="43" r="2.5" fill="#2d4133" />
          <circle cx="25" cy="58" r="1.7" fill="#425846" />
          <circle cx="67" cy="67" r="1.2" fill="#314937" />
        </pattern>
        <clipPath id="motion-view-clip"><rect width={width} height={height} rx={4} /></clipPath>
      </defs>
      <rect width={width} height={height} fill="url(#motion-floor-pebbles)" rx={4} />
      <g clipPath="url(#motion-view-clip)">
        {traceSegments.map(segment => (
          <line
            key={segment.key}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.color}
            strokeWidth={2}
            strokeOpacity={0.8}
          />
        ))}
        <polygon points={boardCorners} fill="#334155" stroke={setup.color} strokeWidth={2} />
        <line {...frontAxle} stroke="#cbd5e1" strokeWidth={2} />
        <line {...rearAxle} stroke="#cbd5e1" strokeWidth={2} />
        <g fill="#64748b" stroke="#cbd5e1" strokeWidth={1}>
          <polygon points={wheelPolygon(0, -wheelHalfTrack, frontSteerRad)} />
          <polygon points={wheelPolygon(0, wheelHalfTrack, frontSteerRad)} />
          <polygon points={wheelPolygon(setup.wheelbase, -wheelHalfTrack, rearSteerRad)} />
          <polygon points={wheelPolygon(setup.wheelbase, wheelHalfTrack, rearSteerRad)} />
        </g>
        <circle cx={toSVG(pose.position)[0]} cy={toSVG(pose.position)[1]} r={4} fill="#f97316" stroke="#fff" strokeWidth={1} />
      </g>
      <text x={8} y={18} fill="#f8fafc" fontSize={11} fontFamily="monospace">Birds-eye Motion Trace</text>
      <foreignObject x={8} y={22} width={112} height={28}>
        <button
          type="button"
          className="px-2 py-1 text-xs rounded bg-slate-900/85 hover:bg-slate-800 text-slate-200 border border-slate-600"
          onClick={() => onViewportModeChange(viewportMode === 'follow' ? 'zoom-to-fit' : 'follow')}
          aria-label={viewportMode === 'follow' ? 'Switch to zoom-to-fit view' : 'Switch to follow view'}
          title={viewportMode === 'follow' ? 'Switch to zoom-to-fit view' : 'Switch to follow view'}
        >
          {viewportMode === 'follow' ? 'Zoom to fit' : 'Follow'}
        </button>
      </foreignObject>
      <text x={width - 8} y={18} fill="#cbd5e1" fontSize={10} fontFamily="monospace" textAnchor="end">orange: front-truck reference</text>
    </svg>
  )
}

export type { MotionTracePoint }
export default MotionTopView
