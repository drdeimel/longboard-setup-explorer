/**
 * Positive propulsion-ratio samples for the top-view windrose.
 *
 * Applied-force angles are measured from board-forward (+X) toward +Z.
 * The wheel travel direction is perpendicular to the steered front axle:
 * `(cos(delta), -sin(delta))` in the `(X, Z)` plane.
 */

export interface PropulsionWindroseSample {
  appliedAngleDeg: number
  ratio: number
}

/**
 * Sample the positive component of applied force along the front wheel travel
 * direction. Non-positive ratios are omitted from the returned display data.
 */
export function computePositivePropulsionWindrose(
  frontSteerAngleDeg: number,
  sampleCount = 32,
): PropulsionWindroseSample[] {
  if (sampleCount < 1) return []

  const steerRad = (frontSteerAngleDeg * Math.PI) / 180
  const wheelX = Math.cos(steerRad)
  const wheelZ = -Math.sin(steerRad)
  const samples: PropulsionWindroseSample[] = []

  for (let i = 0; i < sampleCount; i++) {
    const appliedAngleDeg = (i * 360) / sampleCount
    const appliedRad = (appliedAngleDeg * Math.PI) / 180
    const appliedX = Math.cos(appliedRad)
    const appliedZ = Math.sin(appliedRad)
    const ratio = appliedX * wheelX + appliedZ * wheelZ

    if (ratio > 1e-12) {
      samples.push({ appliedAngleDeg, ratio })
    }
  }

  return samples
}
