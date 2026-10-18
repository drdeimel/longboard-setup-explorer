import { describe, expect, it } from 'vitest'
import {
  getLeanWaveform,
  SINUSOIDAL_CYCLE_DURATION_S,
  SINUSOIDAL_5X_CYCLE_DURATION_S,
  TRAPEZOIDAL_TRANSITION_DURATION_S,
  TRAPEZOIDAL_5X_CYCLE_DURATION_S,
  TRAPEZOIDAL_5X_TRANSITION_DURATION_S,
} from '../leanWaveforms'

const min = -30
const max = 30

describe('lean waveforms', () => {
  it('routes manual input unchanged through the waveform interface', () => {
    expect(getLeanWaveform('manual').evaluate(12, min, max, 17)).toBe(17)
  })

  it('covers the full sine range over one explicit cycle', () => {
    const sine = getLeanWaveform('sinusoidal')
    expect(sine.evaluate(0, min, max, 0)).toBeCloseTo(min)
    expect(sine.evaluate(SINUSOIDAL_CYCLE_DURATION_S / 2, min, max, 0)).toBeCloseTo(max)
    expect(sine.evaluate(SINUSOIDAL_CYCLE_DURATION_S, min, max, 0)).toBeCloseTo(min)
  })

  it('completes the sinusoidal 5x cycle five times faster', () => {
    const sine5x = getLeanWaveform('sinusoidal-5x')
    expect(SINUSOIDAL_5X_CYCLE_DURATION_S).toBe(SINUSOIDAL_CYCLE_DURATION_S / 5)
    expect(sine5x.evaluate(0, min, max, 0)).toBeCloseTo(min)
    expect(sine5x.evaluate(SINUSOIDAL_5X_CYCLE_DURATION_S / 2, min, max, 0)).toBeCloseTo(max)
    expect(sine5x.evaluate(SINUSOIDAL_5X_CYCLE_DURATION_S, min, max, 0)).toBeCloseTo(min)
  })

  it('uses endpoint dwell and smooth cubic transitions for the trapezoid', () => {
    const trapezoid = getLeanWaveform('trapezoidal')
    const dwell = (SINUSOIDAL_CYCLE_DURATION_S - 2 * TRAPEZOIDAL_TRANSITION_DURATION_S) / 2
    expect(trapezoid.evaluate(0, min, max, 0)).toBe(min)
    expect(trapezoid.evaluate(dwell, min, max, 0)).toBeCloseTo(min)
    expect(trapezoid.evaluate(dwell + TRAPEZOIDAL_TRANSITION_DURATION_S / 2, min, max, 0)).toBeCloseTo(0)
    expect(trapezoid.evaluate(2 * dwell + TRAPEZOIDAL_TRANSITION_DURATION_S, min, max, 0)).toBeCloseTo(max)
    expect(trapezoid.evaluate(SINUSOIDAL_CYCLE_DURATION_S, min, max, 0)).toBeCloseTo(min)
  })

  it('completes the trapezoidal 5x cycle five times faster', () => {
    const trapezoid5x = getLeanWaveform('trapezoidal-5x')
    const dwell = (TRAPEZOIDAL_5X_CYCLE_DURATION_S - 2 * TRAPEZOIDAL_5X_TRANSITION_DURATION_S) / 2
    expect(TRAPEZOIDAL_5X_CYCLE_DURATION_S).toBe(SINUSOIDAL_CYCLE_DURATION_S / 5)
    expect(TRAPEZOIDAL_5X_TRANSITION_DURATION_S).toBe(TRAPEZOIDAL_TRANSITION_DURATION_S / 5)
    expect(trapezoid5x.evaluate(0, min, max, 0)).toBe(min)
    expect(trapezoid5x.evaluate(dwell + TRAPEZOIDAL_5X_TRANSITION_DURATION_S / 2, min, max, 0)).toBeCloseTo(0)
    expect(trapezoid5x.evaluate(TRAPEZOIDAL_5X_CYCLE_DURATION_S, min, max, 0)).toBeCloseTo(min)
  })
})
