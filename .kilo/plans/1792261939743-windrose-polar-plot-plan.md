# Windrose Polar Plot Plan

## Decisions

- Add matching front and rear visualizations to `TopView`, which owns the top-down XZ SVG and the currently selected lean angle.
- Rotate the top view 90 degrees counterclockwise so board-forward runs horizontally.
- Remove ICR locus lines and ICR legend from this view, but retain the active-lean turning arc and turning-radius label.
- Use the active setup only, matching the existing turning-arc behavior; non-active setup overlays remain unchanged.
- Use the **front truck** wheel travel direction.
- Applied-force angle is measured from the board's forward X direction, with positive angle toward +Z/right on the top view.
- Plot only positive propulsion ratios: `max(0, cos(theta - delta))`. Applied-force directions with zero or opposing contribution are omitted.
- Use a fixed 32-direction sample grid. This is not a sampled physical histogram: the exact underlying curve is a clipped cosine determined by one direction vector and unit length.
- Do not approximate the curve with an ellipse. The mockup and final SVG should show only the forward-propelling half of the clipped cosine in one color.
- Target leaf span is approximately 700 mm in board coordinates, rendered with the same `icrScale` as the board. Keep the overlay transparent so the board and ICR remain visible.
- Place the center slightly behind the front axle, initially around 15% of wheelbase behind it (with the exact visual offset decided during mockup review). This represents the front-foot region without inventing a rider-foot model.
- Highlight the two applied-force sample directions perpendicular to board-forward with brighter blue and higher opacity, without changing their ratio-derived lengths.
- Compute the center of moment as `rearRatio / (rearRatio + frontRatio + epsilon) * wheelbase`, using the larger front perpendicular leaf and the rear leaf at the opposite perpendicular angle; render it as a white point on the board centerline.
- Render the finite current-lean ICR position from `turningCenterX/Z` as a blue point; omit it when the ICR is at infinity.

## Data and Geometry

1. Extend the centralized lean-dependent result path in `src/physics/keyGeometryDataSet.ts` rather than computing steering geometry in `TopView`.
   - Reuse the existing `computeLeanToSteer` result used by `computeKeyGeometry`.
   - Add the front steer angle, or a named front wheel travel direction, to `KeyGeometryResult` so consumers do not recompute it.
    - Prefer a compact result such as `frontSteerAngleDeg` (with documented sign convention); the wheel travel vector is derived centrally as `(cos(delta), -sin(delta))` in `(X, Z)` coordinates, matching `turningCenter.ts`.
2. Add a pure geometry helper in `src/geometry/` for the windrose data contract if the implementation needs sampled display points.
   - Input: front steer angle and sample count (32).
   - Output: 32 `{ appliedAngleDeg, ratio }` samples, where `ratio = max(0, dot(appliedForceUnit, wheelDirection))`.
   - Keep this helper exact and deterministic; no force magnitude is needed because the ratio is normalized.
   - If the renderer can consume the direction vector directly, keep the geometry result compact and generate only SVG points in the component. The component must not calculate steering angles or wheel vectors.
3. Ensure the active lean lookup uses the existing precomputed `keyGeometryCurves` entry. Handle missing/null/empty curves without throwing and render no windrose data for that state.
4. Add geometry tests covering:
    - Zero steer: ratio is `+1` along board-forward direction; zero and opposing directions are omitted.
   - Positive and negative steer rotate the maximum ratio by the corresponding signed front steer angle.
    - All returned ratios remain in `(0, 1]` and are independent of applied force magnitude.
   - The active lean value selects the nearest existing curve sample consistently with the current turning-arc behavior.

## SVG Mockup First

1. Before production component changes, create a standalone SVG mockup under the project's visualization/mockup area (for example `doc/plans/mockups/windrose-top-view.svg`).
2. The mockup should show:
   - The existing board silhouette and front/rear axle context.
   - A 700 mm transparent windrose centered slightly behind the front axle/front-foot region.
   - 32 directional leaves/spokes around the applied-force angle ring.
   - One-color propulsion encoding: render only positive/front-propelling leaves; omit opposing and zero-ratio leaves.
    - A compact legend stating `propulsion ratio = force along front wheel direction / applied force`.
    - A representative nonzero lean case and a zero-lean case so the rotation and positive-only behavior are obvious.
3. Present the mockup for user feedback before implementing `TopView`. Do not proceed to production visual edits until the user approves the placement, opacity, wedge styling, and positive-only interpretation.

## Production Visualization

1. Update `TopView.tsx` to consume the centralized front-wheel direction/result for the active setup and current `steeringLeanAngleDeg`.
2. Convert the chosen center from board coordinates to SVG using the existing `toSVG` transform. Keep the anchor in board coordinates so it follows wheelbase/scale changes correctly.
3. Render the positive subset of the 32-direction sample grid as SVG elements inside the existing clipped geometry group, behind the turning arc but above the board outline as appropriate for readability.
    - Use 700 mm maximum leaf span in physical coordinates.
   - Use the front-wheel direction to orient the positive half.
   - Use ratio for leaf length; omit ratios `<= 0`; do not distort the ratio into an ellipse.
   - Keep opacity low enough that ICR locus and board remain legible.
4. Add a short title/legend or accessible label identifying the plot, its positive propulsion ratio, front-wheel basis, and current lean angle. Preserve existing setup colors and active-setup emphasis.
5. Avoid adding a new control unless review shows the overlay cannot be read alongside the current ICR locus. The first implementation should always show it for the active setup.

## Validation

- Run geometry and physics Vitest suites, plus new windrose unit tests.
- Run TypeScript/build/lint checks used by the repository.
- Manually inspect zero lean, positive lean, negative lean, straight/no-steer, multiple setups, narrow/mobile viewport, and missing curve data.
- Verify the 700 mm maximum leaf span in board-coordinate scale, center placement behind the front axle, 32-direction sampling, transparency, and positive-only one-color behavior.
- Confirm changing the lean slider rotates the windrose direction without changing its normalized maximum ratio.
- Confirm the visualization remains readable when the turning arc and ICR locus are present.

## Files Likely Affected

- `src/physics/keyGeometryDataSet.ts` — centralized result/data contract.
- `src/geometry/` — exact windrose/vector helper and tests, if required by the final data shape.
- `src/components/TopView.tsx` — SVG overlay and active-lean selection.
- `src/geometry/__tests__/` and/or `src/physics/__tests__/` — formula and integration coverage.
- Standalone SVG mockup file — created and reviewed before production visual implementation.

## Risks and Explicit Non-Goals

- A clipped positive cosine is not a filled elliptical windrose; presenting it as one would imply a different physical relationship. The approved visual is therefore a one-color forward-propulsion half-windrose sampled at 32 directions.
- This plot describes directional force projection only. It does not model force magnitude, speed, rider foot placement, wheel slip, or combined front/rear traction.
- The front-foot anchor is a visualization convention, not a new rider-body model.
