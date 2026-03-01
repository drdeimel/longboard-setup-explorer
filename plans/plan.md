# Longboard Simulator — Implementation Plan

## Goal

Build a web-based interactive simulator that provides an intuitive visualization of the mechanical effects of different truck geometry features on a longboard/skateboard/surfskate. Multiple configurations can be created, compared, and overlaid on shared charts.

---

## Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | React 18 + Vite (TypeScript) | Reactive state-driven UI, fast HMR; TS essential for type-safe geometry parameters |
| SVG Diagrams | Inline SVG via React components | Precise geometry rendering, arbitrary annotations, interactive highlights |
| Charts | Plotly.js via `react-plotly.js` | Designed for scientific/mathematical line charts; built-in hover readout, multi-series, axis auto-scaling, export to PNG |
| Math | Custom TypeScript vector/matrix utilities in `src/math/` | Only 3D rotation matrices, vector normalize/dot/cross needed; avoids the ~500KB mathjs bundle |
| Styling | Tailwind CSS | Rapid layout, design tokens, no runtime overhead |

### Why Plotly over Recharts

Recharts is optimized for business/dashboard data (time series, bar/pie charts). The simulator's charts are:
- **Mathematical function curves** sampled at 100–300 points (not time-series records)
- **Multi-series parametric** with potentially very different Y-axis ranges per setup
- Need **scientific hover** (showing exact X/Y values at cursor)
- May benefit from **zoom/pan** on dense curves (e.g. ICR locus at high lean angles)

Plotly handles all of this natively and is the standard for scientific web visualization.

---

## Core Architecture

```
src/
  math/
    vec3.ts              ← Vec3 type + dot, cross, normalize, scale helpers
    mat3.ts              ← 3x3 rotation matrix construction and multiply
  geometry/
    pivotAxis.ts         ← 3D pivot axis from pivotAxisAngle + rake
    leanToSteer.ts       ← lean angle → steer angle via 3D axis rotation
    rotationAxisDist.ts  ← effective pivot axis distance to board surface
    turningRadius.ts     ← ICR locus from front/rear steer angles + wheelbase
  physics/
    bushingModels.ts     ← parameterized stiffness curves per shape
    returnMoment.ts      ← combined bushing + gravitational return moment
    lateralForce.ts      ← steering moment vs. lateral force model
  models/
    TruckConfig.ts       ← full front truck geometry + bushing config
    RearTruckConfig.ts   ← minimal rear truck (pivotAxisAngle + rake)
    BoardSetupConfig.ts  ← frontTruck + rearTruck + wheelbase
    BushingConfig.ts     ← bushing shape, durometer, height
  components/
    ConfigPanel/         ← add/remove named setups, sliders per setup
    SideView/            ← annotated SVG side cross-section of front truck
    FrontView/           ← annotated SVG front cross-section of front truck
    TopView/             ← top-down board SVG with ICR locus
    DerivedParams/       ← computed parameter summary table (h_pendulum, ICR at 0°/90°)
    Charts/
      LeanVsSteerChart.tsx
      LeanVsReturnMomentChart.tsx
      SteeringMomentChart.tsx
      RotationAxisDistChart.tsx
  persistence/
    localStorage.ts      ← saveState / loadState with versioned key + fallback defaults
  App.tsx
  main.tsx
```

---

## Geometry Model

### Coordinate System

All positions are relative to the **axle center** as the origin:

- **X**: forward direction of travel
- **Y**: upward (normal to road surface when upright)
- **Z**: lateral (towards the rider's right)

### Truck Geometry Parameters

The truck geometry is defined by the following parameters (all positions relative to the axle center as origin):

| Parameter | Symbol | Units | Description |
|---|---|---|---|
| Pivot axis angle | `α` | degrees | Angle of the pivot axis from horizontal in the XY plane (side view) |
| Rake | `r` | mm | Perpendicular distance from axle center to the pivot axis line. Positive values indicate forward direction |
| Axle-to-Baseplate distance | `d_axle_baseplate` | mm | Vertical distance from axle center up to the truck's baseplate |
| Baseplate-to-board distance | `d_baseplate_board` | mm | Vertical distance from the base plate up to the board top. Defined by board thickness and additional risers|

| Wheel radius | `r_wheel` | mm | Radius of the wheel; defines ground plane at `y = -r_wheel` below axle |
| Track width | `w_track` | mm | Lateral distance between the two wheel contact points (hanger width) |
| Bushing moment arm | `d_bushing` | mm | Distance along the pivot axis from the axle plane to the bushing seat; defines mechanical advantage of bushing force on hanger rotation |

### Board-Level Parameters

These parameters are shared across both trucks of a single board setup:

| Parameter | Symbol | Units | Description |
|---|---|---|---|
| Wheelbase | `L` | mm | Distance between front and rear truck axle centers; used for turning radius and ICR computation |

The **kingpin** is considered orthogonal to the pivot axis and is not an independent geometric parameter — it does not influence the lean-to-steer or moment calculations.

**Notes:**
- `r_wheel` defines the road surface as a constraint plane and sets the lean-angle range (board cannot lean past the point where wheel rim touches ground).
- `w_track` is the moment arm for computing the steering moment produced by a lateral centripetal force.
- `d_bushing` scales the bushing torque output: `M_hanger = M_bushing_stiffness(θ) × 1` where the stiffness function already encodes `d_bushing` as a multiplier. Alternatively: `M_hanger(θ) = F_bushing(θ × d_bushing) × d_bushing`.
- `L` (wheelbase) is required for the top-down turning center diagram. The same truck config can be applied to both front and rear, or different configs can be set per truck.

### Derived Pivot Axis Representation

From these three parameters, the pivot axis is fully determined:

- **Pivot axis unit vector:** `n̂ = (cos α, sin α, 0)` — lies in the forward-up (XY) plane
- **Point on pivot axis (closest to axle):** `P_axis = r × n̂_perp` where `n̂_perp` is the unit vector perpendicular to `n̂` in the XY plane
- **Board surface plane:** `y = d_baseplate_board + d_axle_baseplate` (above axle center)

The pivot axis line is then: `L(t) = P_axis + t × n̂`

### Lean-to-Steer Mapping

When the board leans by angle `φ` (rotation of the board around the forward X axis), the hanger rotates around the pivot axis by angle `θ`. The steer angle `δ` is obtained by projecting the resulting axle rotation onto the road (XZ) plane:

```
θ(φ) = geometric projection of board lean onto pivot axis
δ(φ) = component of hanger rotation in the road plane
```

This is computed exactly via 3D rotation matrices — no small-angle approximations.

### Effective Rotation Axis Distance

The perpendicular distance from the pivot axis line to the board surface plane `y = d_baseplate_board + d_axle_baseplate`, as a function of lean angle `φ`. This describes how far the "virtual steering pivot" is from the board surface, affecting the steering feel.

---

## Bushing Model

Each truck has two independent bushings (roadside + boardside), each configurable with:

| Parameter | Values |
|---|---|
| Shape | `cone`, `barrel` |
| Durometer | 60A – 100A (continuous slider) |
| Height | `standard`, `tall` |

### Stiffness Curves

Stiffness is modeled as a parameterized nonlinear function of hanger rotation angle `θ`:

- **Barrel:** near-linear, `M = k × θ` with mild cubic term
- **Cone:** progressive, `M = k × θ × (1 + c × θ²)` where `c` is shape-dependent

Durometer scales the base stiffness `k`. Tall bushings increase the angular range before bottoming out.

Combined bushing torque:
```
M_bushing(θ) = M_roadside(θ) + M_boardside(θ)
```

---

## Physics Model

### Net Return Moment

```
M_net(φ) = M_bushing(θ(φ)) - m × g × h_CoM × sin(φ)
```

Where:
- `m` — rider mass (kg)
- `h_CoM` — rider center of mass height (m)
- `φ` — board lean angle

Rider weight and CoM height are global parameters (not per-setup).

### Steering Moment vs. Lateral Force

Given a lateral force `F_y` applied at the board surface (e.g., centripetal force during a turn), the steering moment is:

```
M_steer(F_y) = F_y × d_eff(φ)
```

Where `d_eff(φ)` is the effective moment arm derived from the truck geometry (related to the rotation axis distance to the board surface).

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Header: Longboard Truck Simulator                                          │
├─────────────┬───────────────────────────────────────────────────────────────┤
│  Config     │  Diagrams Area                                                │
│  Panel      │  ┌──────────────────────────────────┐  ┌────────────────┐     │
│             │  │  Side View (XY)                  │  │ Front View (ZY)│     │
│ [+ Add      │  │  board length → horizontal →     │  │ track width →  │     │
│  Setup]     │  │  height → vertical               │  │ horizontal     │     │
│             │  └──────────────────────────────────┘  │ height →       │     │
│ Setup A 🔴  │  ┌──────────────────────────────────┐  │ vertical       │     │
│  [sliders]  │  │  Top View (XZ)                   │  ├────────────────┤     │
│             │  │  board length → horizontal →     │  │ Derived Params │     │
│ Setup B 🔵  │  │  track width → vertical          │  │ per setup:     │     │
│  [sliders]  │  └──────────────────────────────────┘  │  h_pendulum    │     │
│             │                                        └────────────────┘     │
│ Setup C 🟢  │  ┌──────────────────────┐  ┌──────────────────────┐           │
│  [sliders]  │  │ Lean vs Steer        │  │ Lean vs Return       │           │
│             │  │ Angle Chart          │  │ Moment Chart         │           │
│ Rear Truck  │  └──────────────────────┘  └──────────────────────┘           │
│  [sliders]  │  ┌──────────────────────┐  ┌──────────────────────┐           │
│             │  │ Steering Moment vs   │  │ Rotation Axis        │           │
│             │  │ Lateral Force Chart  │  │ Dist Chart           │           │
│             │  └──────────────────────┘  └──────────────────────┘           │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

**View alignment rules (enforced in implementation):**
- The board's **length direction** (forward travel, X axis) is always **horizontal** on screen.
- Adjacent views share exactly one axis (one 90° rotation between neighbors):
  - Side View (XY) → Front View (ZY): shares **Y (vertical/height)** axis → both have height on the vertical screen axis
  - Side View (XY) → Top View (XZ): shares **X (forward/length)** axis → both have board length on the horizontal screen axis
- Front View occupies the right column spanning both SVG rows; Derived Parameters panel fills the space below it.
- Ensure that the scale of heights and widths match between Views, so that the board's geometry is geometrically consistent across all views; height and horizontal length use the same pixel-per-mm scale.

**Derived Parameters panel** (bottom-right quadrant, below Front View):
Displays computed values for each active setup as a color-coded table. Values are recomputed reactively when parameters change.

| Derived Parameter | Formula | Notes |
|---|---|---|
| Inverted pendulum height | `h_pendulum = d_board + r_wheel` | Total board surface height above ground; lever arm for rider gravitational torque |
| Lean-to-steer leverage at 0° | `dδ/dφ|_{φ=0}` (dimensionless °/°) | Linearized steering sensitivity at upright: degrees of steer per degree of lean; derived as the slope of the lean-to-steer curve at the origin via numerical differentiation of the full 3D rotation model |
| Contact patch lateral rate at 0° | `d(z_contact)/dφ|_{φ=0}` (mm/°) | Rate at which the wheel contact patch moves sideways as the board leans from upright; combines the pure geometric lean effect (r_wheel × cos φ) with the rake-induced axle shift from hanger rotation |


Each chart overlays all active setups as color-coded curves. SVG diagrams show the currently selected/highlighted setup.

---

## Implementation Tasks

### Phase 1: Project Scaffolding

- [ ] Initialize Vite + React + TypeScript project
- [ ] Install dependencies: `react-plotly.js`, `plotly.js`, `tailwindcss`; no mathjs required
- [ ] Configure Tailwind CSS
- [ ] Set up folder structure (`math/`, `geometry/`, `physics/`, `models/`, `components/`)
- [ ] Implement `src/math/vec3.ts` — Vec3 type and helpers: `dot`, `cross`, `normalize`, `scale`, `add`, `sub`
- [ ] Implement `src/math/mat3.ts` — 3×3 rotation matrix from axis+angle (Rodrigues formula), matrix-vector multiply
- [ ] Define `BoardSetupConfig` TypeScript interface: `frontTruck: TruckConfig`, `rearTruck: RearTruckConfig`, `wheelbase: number`
- [ ] Define `TruckConfig` TypeScript interface (front truck, full detail) with all geometry parameters: `pivotAxisAngle`, `rake`, `axleToBoardDistance`, `wheelRadius`, `trackWidth`, `bushingMomentArm`, `roadsideBushing`, `boardsideBushing`
- [ ] Define `RearTruckConfig` TypeScript interface (rear truck, minimal — only `pivotAxisAngle` and `rake` needed for ICR computation)
- [ ] Define `BushingConfig` TypeScript interface: `shape`, `durometer`, `height`

### Phase 2: Geometry Engine

- [ ] Implement `pivotAxis.ts` — compute 3D pivot axis line (unit vector + point on axis) from `pivotAxisAngle`, `rake`, and `axleToBoardDistance`; coordinate origin is axle center
- [ ] Implement `leanToSteer.ts` — compute steer angle `δ` from board lean angle `φ` using exact 3D rotation around the pivot axis
- [ ] Implement `rotationAxisDist.ts` — compute perpendicular distance from pivot axis line to board surface plane `y = axleToBoardDistance` as a function of lean angle
- [ ] Implement `turningCenter.ts` — compute instantaneous center of rotation (ICR) in the top-down plane for a given lean angle using front + rear steer angles and wheelbase `L`; produce the ICR locus as a polyline over the full lean angle range
- [ ] Write unit tests for geometry functions with known reference cases (e.g., 50° angle + zero rake → standard RKP lean-to-steer curve; symmetric trucks + nonzero lean → ICR on a perpendicular bisector of the wheelbase)

### Phase 3: Bushing & Physics Engine

- [ ] Implement `bushingModels.ts` — parameterized stiffness curves for `cone` and `barrel` bushing shapes; parameterize by durometer and height
- [ ] Implement `returnMoment.ts` — combine roadside + boardside bushing torque with gravitational destabilizing moment
- [ ] Implement `lateralForce.ts` — compute steering moment as a function of lateral force at each lean angle
- [ ] Write unit tests for physics functions: verify moment curves have the correct sign and shape

### Phase 4: SVG Diagrams

**View alignment constraint:** All three SVG views must be laid out so that:
- The board's **length direction** (X axis, forward travel) is always **horizontal** on screen
- Adjacent views share exactly one axis (standard orthographic projection):
  - `SideView` (XY plane) and `FrontView` (ZY plane): both keep **Y (height) vertical** — placed side by side in the top row
  - `SideView` (XY plane) and `TopView` (XZ plane): both keep **X (length) horizontal** — `TopView` placed directly below `SideView`
  - `FrontView` occupies the right column spanning both rows

- [ ] Implement `SideView` component — annotated 2D side cross-section showing pivot axis line, board surface, hanger, axle center (origin), pivot axis angle `α`, rake offset `r`, and wheel radius; board length horizontal, height vertical
- [ ] Implement `FrontView` component — annotated 2D front cross-section showing track width horizontal, axle-to-board height vertical, wheel contact points, and bushing positions; height axis shared with SideView
- [ ] Implement `TopView` component — top-down board diagram (XZ plane); board length horizontal and matched to SideView horizontal scale; track width vertical; shows board outline, both truck axles, and ICR locus color-coded by lean angle; multiple setups overlaid
- [ ] Implement `DerivedParams` component — color-coded table in the bottom-right quadrant (below FrontView); displays per-setup: inverted pendulum height `h_pendulum = d_board + r_wheel`, ICR at 0° lean = "∞ (straight)", ICR at 90° lean `R_min`; updates reactively when parameters change
- [ ] Add dynamic geometry updates: all SVG diagrams and the DerivedParams panel redraw reactively when parameters change
- [ ] Add dimension annotations and labels (angles, distances) to all SVG views

### Phase 5: Chart Components

- [ ] Implement `LeanVsSteerChart` — lean angle (x) vs steer angle (y), one curve per setup
- [ ] Implement `LeanVsReturnMomentChart` — lean angle (x) vs net return moment (y), one curve per setup; rider weight / CoM height as global inputs
- [ ] Implement `SteeringMomentChart` — lateral force (x) vs steering moment (y) at a specified lean angle, one curve per setup
- [ ] Implement `RotationAxisDistChart` — lean angle (x) vs effective rotation axis distance to board surface (y), one curve per setup
- [ ] Apply consistent color coding across all charts matching setup colors in the config panel

### Phase 6: Config Panel & Multi-Setup Management

**Setup lifecycle rules:**
- The app always maintains at least one setup; the delete button is disabled (greyed out) when only one setup exists
- New setups are created by **duplicating an existing setup** (the currently selected one) — there is no "create blank" option; this ensures users always start from a sensible baseline
- Each setup has: a **rename field** (inline edit of the name), a **duplicate button** (creates a copy with a new auto-generated name and a new color), and a **delete button** (disabled when ≤1 setup)
- On first app load (empty localStorage), a single default setup is created from a built-in preset

- [ ] Implement `ConfigPanel` component — scrollable list of named setups; each row shows: color swatch, editable name, duplicate button, delete button (disabled when only 1 setup)
- [ ] Implement setup duplication: clicking "Duplicate" on a setup creates a deep copy with a new auto-generated name (e.g. "Setup A copy") and a new auto-assigned color, appended to the list
- [ ] Implement setup deletion: clicking "Delete" removes the setup from the list; the button is disabled when only 1 setup remains; confirm if more than 3 setups exist to prevent accidental deletion
- [ ] Implement per-setup board-level parameter:
  - Wheelbase `L` (mm, e.g. 600–1000 mm)
- [ ] Implement **front truck** parameter sliders (full set — drives all diagrams and charts):
  - Pivot axis angle `α` (degrees, e.g. 20°–65°)
  - Rake `r` (mm, perpendicular distance from axle center to pivot axis line)
  - Axle-to-board distance `d_board_baseplate` (mm, vertical distance from board surface to truck baseplate surface)
  - Axle-to-board distance `d_basplate_axle` (mm, vertical distance from truck baseplate surface to axle center)
  - Wheel radius `r_wheel` (mm, e.g. 60–120 mm)
  - Track width `w_track` (mm, e.g. 150–280 mm)
  - Bushing moment arm `d_bushing` (mm, distance along pivot axis from axle plane to bushing seat)
  - Boardside bushing: shape (`barrel`/`cone`), durometer (60A–100A), height (`standard`/`tall`)
  - Roadside bushing: shape (`barrel`/`cone`), durometer (60A–100A), height (`standard`/`tall`)
- [ ] Implement **rear truck** parameter sliders (minimal — only used for top-down ICR locus):
  - Pivot axis angle `α_rear` (degrees)
  - Rake `r_rear` (mm)
- [ ] Implement global rider parameters: rider mass (kg), CoM height (m)
- [ ] Assign a distinct color to each setup automatically; display color swatch next to setup name
- [ ] Add preset configurations (e.g., "Standard RKP 50°", "Standard TKP", "High-angle RKP 65°") as quick-load buttons

### Phase 7: App Integration, Layout & Persistence

- [ ] Implement `App.tsx` — wire global state (setups list, rider params) to all components
- [ ] Implement `src/persistence/localStorage.ts` — `saveState(state)` serializes the full app state (all setups + rider params) to `localStorage` under a versioned key; `loadState()` deserializes and validates on app start; handles missing/corrupt data by falling back to default values
- [ ] Hook persistence into `App.tsx`: call `saveState` on every state change (via `useEffect`); call `loadState` on initial mount
- [ ] Implement responsive two-column layout: config panel (left) + diagrams/charts (right)
- [ ] Add tooltip/hover info on charts showing exact values per setup at the cursor position
- [ ] Add a "highlight setup" interaction: clicking a setup in the config panel highlights its curves on all charts

### Phase 8: Polish & Future-Proofing

- [ ] Document the geometry and physics interfaces in code with JSDoc comments to ease future dual-pivot axis additions
- [ ] Add a `TruckType` discriminated union in `TruckConfig.ts` with `single-pivot` (current) and `dual-pivot` (stub) variants
- [ ] Write a `README.md` explaining the geometry model, parameters, and how to extend the simulator
- [ ] Ensure the app is responsive and works on tablet-width screens

---

## Architecture Notes for Future Dual-Pivot Extension

The geometry engine is designed so that [`leanToSteer.ts`](src/geometry/leanToSteer.ts) accepts a generic `PivotAxis` interface. A dual-pivot truck (surfskate) adds a second `PivotAxis` with its own geometry and a coupling mechanism between the two pivots. The `TruckConfig` discriminated union and the pluggable `PivotAxis` abstraction make this extension additive rather than requiring rewrites.
