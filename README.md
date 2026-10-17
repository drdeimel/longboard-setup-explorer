# Longboard Truck Simulator

An interactive web-based simulator for exploring and comparing longboard/skateboard truck geometry and physics. Visualize how pivot axis angle, rake, bushing stiffness, and rider weight interact to determine steering feel, stability, and turning behaviour.

---

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Geometry Model](#geometry-model)
- [Physics Model](#physics-model)
- [Parameter Reference](#parameter-reference)
- [Architecture](#architecture)
- [Extending the Simulator](#extending-the-simulator)

---

## Features

- **Annotated SVG diagrams**: Side (XY), front (ZY), and top-down (XZ) cross-sections of the truck geometry, all sharing a consistent scale so dimensions read correctly across views.
- **ICR locus**: Top-down diagram shows the instantaneous center of rotation as a color-coded path from 0° to 40° lean angle.
- **Four scientific charts** (via Plotly.js):
  - Lean vs Steer Angle
  - Lean vs Net Return Moment
  - Lateral Force vs Steering Moment
  - Lean vs Rotation Axis Distance to Board
- **Multi-setup comparison**: Create and overlay up to 8 named setups, each with a distinct color.
- **Parameter sliders**: Full front truck geometry, minimal rear truck, and global rider parameters — all sliders update diagrams and charts reactively.
- **Preset configurations**: Standard RKP 50°, Standard TKP, High-angle RKP 65°.
- **Persistent state**: All setup configurations are saved to `localStorage` on every change and restored on next visit.

---

## Getting Started

```bash
# Install dependencies (requires Node ≥ 18)
npm install

# Start the development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## Geometry Model

### Coordinate System

All positions are relative to the **axle center** as the origin, using a right-handed coordinate system:

| Axis | Direction                                        |
|------|--------------------------------------------------|
| X    | Forward (board rolling direction)               |
| Y    | Up (normal to road surface when upright)        |
| Z    | Lateral right (toward rider's heel side)        |

All distances are in **millimetres (mm)**. All angles are in **degrees** unless a function's JSDoc explicitly states radians.

### Pivot Axis

The pivot axis is a 3D line parameterised by three values:

| Parameter | Symbol | Description |
|-----------|--------|-------------|
| `pivotAxisAngle` | α | Angle of the pivot axis above horizontal in the XY (side-view) plane. Typical range: 20°–65°. |
| `rake` | r | Perpendicular distance from the axle center to the pivot axis line, in the XY plane. Positive = axis passes forward of axle. |

The axis direction is `n̂ = (cos α, sin α, 0)`. The closest point on the axis to the origin is `P = r × n̂⊥` where `n̂⊥ = (−sin α, cos α, 0)`.

### Lean-to-Steer Mapping

When the board leans by angle φ (rotation around the +X axis), the hanger rotates around the pivot axis. The lean-to-steer computation uses **exact 3D rotation matrices** (Rodrigues formula) — no small-angle approximations are ever used.

The steer angle δ is the angle the axle direction makes with the Z axis in the XZ plane after the hanger settles with the axle back in the road plane.

### Rotation Axis Distance

The perpendicular distance from the pivot axis line to the board surface plane (`y = axleToBoardDistance`) as a function of lean angle. This is the effective moment arm for lateral forces applied at the board surface.

### ICR Locus (Turning Center)

For a two-truck board, the instantaneous center of rotation is the intersection of perpendiculars to the axle rolling directions. The locus is plotted in the top-down (XZ) plane for lean angles 0°–40°.

---

## Physics Model

### Net Return Moment

```
M_net(φ) = M_bushing(θ(φ)) − m × g × h_CoM × sin(φ)
```

- `M_bushing(θ)` — combined roadside + boardside bushing torque (N·mm)
- `m` — rider mass (kg)
- `g` — 9.81 m/s²
- `h_CoM` — rider CoM height above ground (m)
- `φ` — board lean angle (degrees)

Positive net moment → truck tends to return to upright (stable).  
Negative net moment → lean is self-reinforcing at that angle (unstable).

### Bushing Stiffness Curves

| Shape | Torque formula | Notes |
|-------|---------------|-------|
| Barrel | M = k·θ·(1 + c_b·θ²) | Near-linear, mild progressiveness |
| Cone | M = k·θ·(1 + c_c·θ²) | Progressive, stiffens faster |

Durometer (60A–100A) scales base stiffness k. Tall bushings increase the soft-limit angle before bottoming out.

### Steering Moment from Lateral Force

```
M_steer(F_lat) = F_lat × d_eff(φ)
```

Where `d_eff(φ)` is the perpendicular distance from the pivot axis to the board surface at lean angle φ.

---

## Parameter Reference

### Front Truck (`TruckConfig`)

| Field | Units | Description |
|-------|-------|-------------|
| `pivotAxisAngle` | ° | Pivot axis angle above horizontal |
| `rake` | mm | Perpendicular offset of pivot axis from axle center |
| `axleToBaseplateDistance` | mm | Vertical distance from axle center to baseplate mounting face |
| `baseplateToBoard` | mm | Vertical distance from baseplate to board bottom (includes risers) |
| `wheelRadius` | mm | Wheel radius; determines ground plane and max lean |
| `trackWidth` | mm | Lateral distance between wheel contact patches |
| `bushingMomentArm` | mm | Distance along pivot axis to bushing seat |
| `roadsideBushing` | — | Roadside bushing: shape, durometer, height |
| `boardsideBushing` | — | Boardside bushing: shape, durometer, height |

### Rear Truck (`RearTruckConfig`)

| Field | Units | Description |
|-------|-------|-------------|
| `pivotAxisAngle` | ° | Pivot axis angle (used for ICR locus only) |
| `rake` | mm | Rake (used for ICR locus only) |

### Board Setup (`BoardSetupConfig`)

| Field | Units | Description |
|-------|-------|-------------|
| `wheelbase` | mm | Front-to-rear axle center distance |
| `frontTruck` | — | Full front truck configuration |
| `rearTruck` | — | Minimal rear truck configuration |

---

## Architecture

```
src/
├── math/
│   ├── vec3.ts          — Vec3 type and vector helpers
│   └── mat3.ts          — 3×3 rotation matrix (Rodrigues formula)
├── geometry/
│   ├── pivotAxis.ts     — Pivot axis line from truck parameters
│   ├── leanToSteer.ts   — Exact 3D lean→steer mapping
│   ├── rotationAxisDist.ts — Pivot-axis-to-board distance
│   └── turningCenter.ts — ICR locus computation
├── physics/
│   ├── bushingModels.ts — Stiffness curves for cone and barrel
│   ├── returnMoment.ts  — Net return moment (bushing − gravity)
│   └── lateralForce.ts  — Steering moment from lateral force
├── models/
│   ├── BoardSetupConfig.ts
│   ├── TruckConfig.ts
│   ├── RearTruckConfig.ts
│   └── BushingConfig.ts
├── components/
│   ├── SideView.tsx     — SVG side cross-section
│   ├── FrontView.tsx    — SVG front cross-section
│   ├── TopView.tsx      — SVG top-down view with ICR locus
│   ├── DerivedParams.tsx — Reactive parameter table
│   ├── ConfigPanel.tsx  — Parameter sliders and setup management
│   ├── LeanVsSteerChart.tsx
│   ├── LeanVsReturnMomentChart.tsx
│   ├── SteeringMomentChart.tsx
│   └── RotationAxisDistChart.tsx
├── persistence/
│   └── localStorage.ts  — Versioned save/load
└── App.tsx              — Root component, global state, layout
```

### Key Design Invariants

1. **Exact 3D rotation for lean-to-steer**: Rodrigues formula, no small-angle approximations.
2. **Shared scale across SVG views**: All three SVG diagrams use the same pixels-per-mm scale.
3. **Persist on every state change**: `useEffect` in `App.tsx` calls `saveState` whenever `setups`, `riderParams`, `activeSetupId`, or `steeringLeanAngleDeg` changes.
4. **At least one setup always exists**: Delete button is disabled (not hidden) when only one setup remains.
5. **No mathjs**: All linear algebra uses [`src/math/vec3.ts`](src/math/vec3.ts) and [`src/math/mat3.ts`](src/math/mat3.ts).

---

## Extending the Simulator

### Adding a New Bushing Shape

1. Add the new shape string to the `BushingConfig['shape']` union in [`src/models/BushingConfig.ts`](src/models/BushingConfig.ts).
2. Implement the stiffness curve in [`src/physics/bushingModels.ts`](src/physics/bushingModels.ts) — add a new branch in `bushingBaseStiffness` and `bushingTorque`.
3. Add the new shape to the `SelectRow` options in [`src/components/ConfigPanel.tsx`](src/components/ConfigPanel.tsx).

### Adding a Dual-Pivot Truck (Surfskate)

The geometry engine is designed for this extension:

1. Add a `'dual-pivot'` variant to the `TruckType` union in [`src/models/TruckConfig.ts`](src/models/TruckConfig.ts) with a second `PivotAxisLine` and a coupling parameter.
2. Implement a `computeLeanToSteerDualPivot` function in [`src/geometry/leanToSteer.ts`](src/geometry/leanToSteer.ts) that chains two `computeLeanToSteer` calls with the coupling factor.
3. Update [`src/components/ConfigPanel.tsx`](src/components/ConfigPanel.tsx) to show the second pivot axis parameters when `type === 'dual-pivot'`.

This is an **additive change** — the existing single-pivot code path is unmodified.

### Changing the Persistence Format

Bump `STORAGE_VERSION` in [`src/persistence/localStorage.ts`](src/persistence/localStorage.ts). This discards all existing persisted state and starts fresh with defaults. If migration is needed, add a migration function that reads the old version and converts it to the new shape before storing.
