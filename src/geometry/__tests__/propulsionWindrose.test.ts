import { describe, expect, it } from 'vitest'
import { computePositivePropulsionWindrose } from '../propulsionWindrose'

describe('computePositivePropulsionWindrose', () => {
  it('returns only positive ratios at zero steer', () => {
    const samples = computePositivePropulsionWindrose(0, 8)

    expect(samples.map(sample => sample.appliedAngleDeg)).toEqual([0, 45, 315])
    expect(samples[0].ratio).toBeCloseTo(1)
    expect(samples[1].ratio).toBeCloseTo(Math.SQRT1_2)
  })

  it('rotates the maximum propulsion direction with wheel steer', () => {
    const samples = computePositivePropulsionWindrose(-45, 8)
    const maximum = samples.reduce((best, sample) => sample.ratio > best.ratio ? sample : best)

    expect(maximum.appliedAngleDeg).toBe(45)
    expect(maximum.ratio).toBeCloseTo(1)
  })

  it('keeps ratios strictly between zero and one', () => {
    const samples = computePositivePropulsionWindrose(13, 32)

    expect(samples.every(sample => sample.ratio > 0 && sample.ratio <= 1)).toBe(true)
  })
})
