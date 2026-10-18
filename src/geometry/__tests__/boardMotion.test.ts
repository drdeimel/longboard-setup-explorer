import { describe, expect, it } from 'vitest'
import { computeZoomToFitViewport, updateBoardPose, updateViewportCenter } from '../boardMotion'

describe('board motion', () => {
  it('moves straight when the ICR is infinite', () => {
    const pose = updateBoardPose(
      { position: { x: 0, z: 0 }, headingRad: 0 },
      { icr: null, velocityMmPerSecond: 1000, deltaTimeSeconds: 1 },
    )
    expect(pose.position.x).toBeCloseTo(-1000)
    expect(pose.position.z).toBeCloseTo(0)
    expect(pose.headingRad).toBe(0)
  })

  it('uses the actual ICR center for a circular update', () => {
    const pose = updateBoardPose(
      { position: { x: 0, z: 0 }, headingRad: 0 },
      { icr: { x: 0, z: 1000 }, velocityMmPerSecond: 1000, deltaTimeSeconds: Math.PI / 2 },
    )
    expect(pose.position.x).toBeCloseTo(-1000)
    expect(pose.position.z).toBeCloseTo(1000)
    expect(pose.headingRad).toBeCloseTo(-Math.PI / 2)
  })

  it('corrects automatic orientation toward the nearest horizontal direction', () => {
    const pose = updateBoardPose(
      { position: { x: 0, z: 0 }, headingRad: Math.PI / 2 },
      { icr: null, velocityMmPerSecond: 0, deltaTimeSeconds: 1, orientationCorrectionEnabled: true },
    )
    expect(pose.headingRad).toBeCloseTo((Math.PI / 2) * Math.exp(-1 / (10 / 3)))
  })

  it('can correct toward the reverse horizontal direction', () => {
    const initialHeading = (3 * Math.PI) / 4
    const correctionFraction = 1 - Math.exp(-1 / (10 / 3))
    const pose = updateBoardPose(
      { position: { x: 0, z: 0 }, headingRad: initialHeading },
      { icr: null, velocityMmPerSecond: 0, deltaTimeSeconds: 1, orientationCorrectionEnabled: true },
    )
    expect(pose.headingRad).toBeCloseTo(initialHeading + (Math.PI / 4) * correctionFraction)
  })

  it('does not correct orientation when disabled for manual motion', () => {
    const pose = updateBoardPose(
      { position: { x: 0, z: 0 }, headingRad: Math.PI / 2 },
      { icr: null, velocityMmPerSecond: 0, deltaTimeSeconds: 1 },
    )
    expect(pose.headingRad).toBe(Math.PI / 2)
  })

  it('only follows the reference point near the viewport border', () => {
    const center = { x: 0, z: 0 }
    expect(updateViewportCenter(center, { x: 10, z: 10 }, 500, 300, 1)).toEqual(center)
    expect(updateViewportCenter(center, { x: 5000, z: 0 }, 500, 300, 1).x).toBeGreaterThan(0)
  })

  it('keeps 200 mm of forward clearance inside the safe border', () => {
    const center = { x: 0, z: 0 }
    const shifted = updateViewportCenter(center, { x: 5000, z: 0 }, 500, 300, 1)
    const safeHalfWidthMm = (500 / 2 - 56 - 200 * 0.048) / 0.048
    const target = 5000 - safeHalfWidthMm
    const alpha = 1 - Math.exp(-1 / 0.25)
    expect(shifted.x).toBeCloseTo(target * alpha, 5)
  })

  it('fits the complete trace into the zoom-to-fit viewport', () => {
    const viewport = computeZoomToFitViewport(
      [{ x: -5000, z: -2000 }, { x: 5000, z: 2000 }],
      640,
      300,
    )
    expect(viewport.center).toEqual({ x: 0, z: 0 })
    expect(viewport.scale).toBeCloseTo((300 - 2 * 56) / 4000)
  })

  it('does not zoom in closer than Follow mode for a short trace', () => {
    const viewport = computeZoomToFitViewport([{ x: 0, z: 0 }, { x: 10, z: 10 }], 640, 300)
    expect(viewport.scale).toBe(0.048)
  })
})
