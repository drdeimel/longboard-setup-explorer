# UI Components

## Purpose
React components for the Longboard Simulator UI, including configuration panels, SVG diagrams, and Plotly charts.

## Ownership
UI and presentation domain.

## Local Contracts
- View components (`FrontView`, `SideView`, `TopView`) MUST NOT perform their own mechanical or geometric calculations. They must consume precomputed geometry or centralized functions from `src/geometry/`.
- `FrontView` visualizes steering motion by projecting axle and wheel widths using the centralized `computeLeanToSteer` function (using `cos` for Z-axis projection). Wheel sides are rendered as ellipses whose minor axis scales with `sin(steering angle)` to dynamically show wheel profile thickness during steering.
- Charts must use `react-plotly.js` and overlay all active setups with consistent color coding.
- The `ConfigPanel` enforces setup lifecycle rules: at least one setup must exist, deletion is disabled at 1 setup, and duplication creates a deep copy with a new auto-generated name and color.

## Work Guidance
- Use Tailwind CSS for styling.
- SVG diagrams must maintain consistent scale and axis alignment (X horizontal, Y vertical for Side/Front views; X horizontal, Z vertical for Top view).
- Components should be reactive to state changes.

## Verification
- Visual regression and manual testing of SVG alignment, chart overlays, and steering projection accuracy.

## Child DOX Index
- None.