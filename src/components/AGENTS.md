# UI Components

## Purpose
React components for the Longboard Simulator UI, including configuration panels, SVG diagrams, and Plotly charts.

## Ownership
UI and presentation domain.

## Local Contracts
- View components (`FrontView`, `SideView`, `TopView`) MUST NOT perform their own mechanical or geometric calculations. They must consume precomputed geometry or centralized functions from `src/geometry/`.
- `FrontView` visualizes steering motion by projecting axle and wheel widths using the centralized `computeLeanToSteer` function (using `cos` for Z-axis projection). Wheel sides are rendered as ellipses whose minor axis scales with `sin(steering angle)` to dynamically show wheel profile thickness during steering.
- `SideView` receives the active lean angle and uses centralized `computeSideViewMotion` plus `computeWheelRimZPositions` output to render left outer, left inner, right inner, and right outer rims. At zero steer they overlap in side projection; steering separates left/right rims with opposite fore/aft motion.
- The axle line in `SideView` is the orthographic XY projection of the steered axle, using centralized `computeWheelAxleZPositions`; do not replace it with a fixed decorative line.
- Side-view wheel outlines are painted back-to-front with the right wheel first and left wheel last; rim faces use the SVG background fill to occlude the farther wheel.
- Side-view trail motion uses `computeTrailOffsetX` to translate the wheel set and truck axle. The pivot-axis drawing remains fixed in its zero-steer reference placement. The current test variant uses `cos(steerAngle) * totalHeight` as the motion arm.
- Charts must use `react-plotly.js` and overlay all active setups with consistent color coding.
- `LeanVsLateralForceChart` visualizes `lateralForceEquilibriumN` from the pre-computed key geometry curves: the lateral force at which bushing torque and steering moment balance at each lean angle.
- `TopView` overlays matching transparent 700 mm positive-only propulsion windroses at the front and rear axle centers for the active lean angle, using centralized steering data and 32-direction sampling.
- `TopView` highlights the applied-force leaves at +/-90 degrees to board-forward with brighter blue and higher opacity while preserving their ratio-derived lengths.
- `TopView` retains the active-lean turning arc and turning-radius label while omitting the full ICR locus lines.
- `TopView` marks the current lean's finite ICR position with a blue point projected from the centralized turning-center result.
- `TopView` renders four grey rotated wheel rectangles using shared wheel-rim positions, wheel diameter, wheel width, track width, and wheel offset.
- The wheel-width control is rendered immediately below wheel diameter and drives wheel width in `FrontView`, `SideView`, `TopView`, and `MotionTopView`.
- `TopView` marks the center of moment with a white point computed as `rearRatio / (rearRatio + frontRatio + epsilon) * wheelbase`, using the larger front perpendicular leaf and the rear leaf at the opposite perpendicular angle.
- `MotionTopView` renders the session-only birds-eye rigid-motion graph. Board motion is supplied in floor coordinates; viewport-center renormalization is supplied separately so the floor and board remain visually together.
- `MotionTopView` rotates axle endpoints around each truck axle center, draws the axle through those endpoints, and uses the matching rolling/axle basis for wheel rectangles.
- Motion trace samples record the active setup color; trace segments must retain their recorded historical color when the active configuration changes.
- The motion graph viewport toggle switches between `Follow` and `Zoom-To-Fit`; the latter displays the complete currently retained trace.
- The motion graph viewport toggle is rendered as an SVG overlay directly below the `Birds-eye Motion Trace` label.
- The `ConfigPanel` enforces setup lifecycle rules: at least one setup must exist, deletion is disabled at 1 setup, and duplication creates a deep copy with a new auto-generated name and color.
- The `ConfigPanel` exposes library setup instantiation through a resettable select beside `Share current`; selecting a library entry creates a setup through the existing preset callback.
- Chart Controls expose the `Lean motion` selector and simulation play/pause control. Manual mode enables slider and front-view drag input; automatic modes drive the shared lean used by diagrams and charts. Pause freezes the shared simulation clock and motion view.
- `TourOverlay` renders the guided tour UI with backdrop, highlight, and tooltip. Transition timing between tour stops is controlled via CSS transitions.
- `TourSelector` provides the UI for selecting and starting available tours.

## Work Guidance
- Use Tailwind CSS for styling.
- SVG diagrams must maintain consistent scale and axis alignment (X horizontal, Y vertical for Side/Front views; X horizontal, Z vertical for Top view).
- Components should be reactive to state changes.

## Verification
- Visual regression and manual testing of SVG alignment, chart overlays, and steering projection accuracy.

## Child DOX Index
- None.
