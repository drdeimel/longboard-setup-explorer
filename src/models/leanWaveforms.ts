/** Lean motion modes and waveform implementations used by the shared lean state. */

export type LeanMotion = 'manual' | 'sinusoidal' | 'sinusoidal-5x' | 'trapezoidal' | 'trapezoidal-5x'

export const SINUSOIDAL_CYCLE_DURATION_S = 4
export const SINUSOIDAL_5X_CYCLE_DURATION_S = SINUSOIDAL_CYCLE_DURATION_S / 5
export const TRAPEZOIDAL_TRANSITION_DURATION_S = 0.5
export const TRAPEZOIDAL_5X_CYCLE_DURATION_S = SINUSOIDAL_CYCLE_DURATION_S / 5
export const TRAPEZOIDAL_5X_TRANSITION_DURATION_S = TRAPEZOIDAL_TRANSITION_DURATION_S / 5

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

const sinusoidal5xWaveform: LeanWaveform = {
  motion: 'sinusoidal-5x',
  evaluate: (timeSeconds, minLeanDeg, maxLeanDeg) => {
    const phase = (2 * Math.PI * (timeSeconds % SINUSOIDAL_5X_CYCLE_DURATION_S)) / SINUSOIDAL_5X_CYCLE_DURATION_S
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

const trapezoidal5xWaveform: LeanWaveform = {
  motion: 'trapezoidal-5x',
  evaluate: (timeSeconds, minLeanDeg, maxLeanDeg) => {
    const cycleTime = ((timeSeconds % TRAPEZOIDAL_5X_CYCLE_DURATION_S) + TRAPEZOIDAL_5X_CYCLE_DURATION_S) % TRAPEZOIDAL_5X_CYCLE_DURATION_S
    const transition = TRAPEZOIDAL_5X_TRANSITION_DURATION_S
    const dwell = (TRAPEZOIDAL_5X_CYCLE_DURATION_S - 2 * transition) / 2

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
  'sinusoidal-5x': sinusoidal5xWaveform,
  trapezoidal: trapezoidalWaveform,
  'trapezoidal-5x': trapezoidal5xWaveform,
}

export function getLeanWaveform(motion: LeanMotion): LeanWaveform {
  return waveforms[motion]
}
