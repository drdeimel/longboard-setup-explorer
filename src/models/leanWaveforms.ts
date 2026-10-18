/** Lean motion modes and waveform implementations used by the shared lean state. */

export type LeanMotion = 'manual' | 'sinusoidal' | 'trapezoidal'

export const SINUSOIDAL_CYCLE_DURATION_S = 4
export const TRAPEZOIDAL_TRANSITION_DURATION_S = 0.5

export interface LeanWaveform {
  readonly motion: LeanMotion
  evaluate(timeSeconds: number, minLeanDeg: number, maxLeanDeg: number, manualLeanDeg: number): number
}

const manualWaveform: LeanWaveform = {
  motion: 'manual',
  evaluate: (_timeSeconds, _minLeanDeg, _maxLeanDeg, manualLeanDeg) => manualLeanDeg,
}

const sinusoidalWaveform: LeanWaveform = {
  motion: 'sinusoidal',
  evaluate: (timeSeconds, minLeanDeg, maxLeanDeg) => {
    const phase = (2 * Math.PI * (timeSeconds % SINUSOIDAL_CYCLE_DURATION_S)) / SINUSOIDAL_CYCLE_DURATION_S
    return minLeanDeg + (maxLeanDeg - minLeanDeg) * (0.5 - 0.5 * Math.cos(phase))
  },
}

const trapezoidalWaveform: LeanWaveform = {
  motion: 'trapezoidal',
  evaluate: (timeSeconds, minLeanDeg, maxLeanDeg) => {
    const cycleTime = ((timeSeconds % SINUSOIDAL_CYCLE_DURATION_S) + SINUSOIDAL_CYCLE_DURATION_S) % SINUSOIDAL_CYCLE_DURATION_S
    const transition = TRAPEZOIDAL_TRANSITION_DURATION_S
    const dwell = (SINUSOIDAL_CYCLE_DURATION_S - 2 * transition) / 2

    if (cycleTime < dwell) return minLeanDeg
    if (cycleTime < dwell + transition) {
      const u = (cycleTime - dwell) / transition
      return minLeanDeg + (maxLeanDeg - minLeanDeg) * (3 * u * u - 2 * u * u * u)
    }
    if (cycleTime < 2 * dwell + transition) return maxLeanDeg
    if (cycleTime < 2 * dwell + 2 * transition) {
      const u = (cycleTime - (2 * dwell + transition)) / transition
      return maxLeanDeg - (maxLeanDeg - minLeanDeg) * (3 * u * u - 2 * u * u * u)
    }
    return minLeanDeg
  },
}

const waveforms: Record<LeanMotion, LeanWaveform> = {
  manual: manualWaveform,
  sinusoidal: sinusoidalWaveform,
  trapezoidal: trapezoidalWaveform,
}

export function getLeanWaveform(motion: LeanMotion): LeanWaveform {
  return waveforms[motion]
}
