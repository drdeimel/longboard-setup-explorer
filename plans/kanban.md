# Kanban Board — Longboard Simulator

> **Agents:** Move tasks between columns as you work. Change the status marker on the checklist item and move it to the appropriate column section.

## Status Legend

| Marker | Column      | Meaning                                      |
|--------|-------------|----------------------------------------------|
| `[ ]`  | Backlog     | Not yet started                              |
| `[-]`  | In Progress | Currently being worked on                    |
| `[x]`  | Done        | Completed and verified                       |
| `[!]`  | Blocked     | Cannot proceed — dependency or issue present |

---

## Backlog

### Phase 1 — Project Scaffolding

*(All Phase 1 tasks moved to In Progress)*

### Phase 2 — Geometry Engine

*(All Phase 2 tasks moved to In Progress)*

### Phase 3 — Bushing & Physics Engine

*(All Phase 3 tasks moved to In Progress)*

### Phase 4 — SVG Diagrams

*(All Phase 4 tasks moved to In Progress)*

### Phase 5 — Chart Components

*(All Phase 5 tasks moved to In Progress)*

### Phase 6 — Config Panel & Multi-Setup Management

*(All Phase 6 tasks moved to In Progress)*

### Phase 7 — App Integration, Layout & Persistence

*(All Phase 7 tasks moved to In Progress)*

### Phase 8 — Polish & Future-Proofing

*(All Phase 8 tasks moved to In Progress)*

---

## In Progress

*(No tasks currently in progress)*

---

## Done

### Phase 8 — Polish & Future-Proofing

- [x] Document geometry and physics interfaces with JSDoc comments
- [x] Add `TruckType` discriminated union with `single-pivot` and `dual-pivot` stubs
- [x] Write `README.md` explaining geometry model, parameters, and extension guide
- [x] Ensure the app is responsive and works on tablet-width screens

### Phase 7 — App Integration, Layout & Persistence

- [x] Implement `App.tsx` — wire global state to all components
- [x] Implement `src/persistence/localStorage.ts` — versioned saveState/loadState
- [x] Hook persistence into `App.tsx`
- [x] Implement responsive two-column layout
- [x] Add tooltip/hover info on charts (Plotly built-in `hovermode: 'x unified'`)
- [x] Add "highlight setup" interaction (activeSetupId prop dims non-active curves)

### Phase 6 — Config Panel & Multi-Setup Management

- [x] Implement `ConfigPanel` component
- [x] Implement setup duplication
- [x] Implement setup deletion (disabled when ≤1 setup; confirm when >3)
- [x] Implement per-setup board-level parameter: Wheelbase `L`
- [x] Implement front truck parameter sliders (full set)
- [x] Implement rear truck parameter sliders (minimal)
- [x] Implement global rider parameters: rider mass, CoM height
- [x] Assign distinct colors per setup; display color swatch
- [x] Add preset configurations: "Standard RKP 50°", "Standard TKP", "High-angle RKP 65°"

### Phase 5 — Chart Components

- [x] Implement `LeanVsSteerChart`
- [x] Implement `LeanVsReturnMomentChart`
- [x] Implement `SteeringMomentChart`
- [x] Implement `RotationAxisDistChart`
- [x] Apply consistent color coding across all charts

### Phase 4 — SVG Diagrams

- [x] Implement `SideView` component — annotated 2D side cross-section (XY plane)
- [x] Implement `FrontView` component — annotated 2D front cross-section (ZY plane)
- [x] Implement `TopView` component — top-down board diagram (XZ plane) with ICR locus
- [x] Implement `DerivedParams` component — color-coded reactive table
- [x] Add dynamic geometry updates: all SVG diagrams and DerivedParams redraw reactively
- [x] Add dimension annotations and labels to all SVG views

### Phase 3 — Bushing & Physics Engine

- [x] Implement `bushingModels.ts` — parameterized stiffness curves for `cone` and `barrel` shapes
- [x] Implement `returnMoment.ts` — combine roadside + boardside bushing torque with gravitational destabilizing moment
- [x] Implement `lateralForce.ts` — compute steering moment as function of lateral force
- [x] Write unit tests for physics functions

### Phase 2 — Geometry Engine

- [x] Implement `pivotAxis.ts` — compute 3D pivot axis line from `pivotAxisAngle`, `rake`, `axleToBoardDistance`
- [x] Implement `leanToSteer.ts` — compute steer angle from lean angle via exact 3D rotation
- [x] Implement `rotationAxisDist.ts` — perpendicular distance from pivot axis to board surface plane
- [x] Implement `turningCenter.ts` — ICR locus computation
- [x] Write unit tests for geometry functions with known reference cases

### Phase 1 — Project Scaffolding

- [x] Initialize Vite + React + TypeScript project
- [x] Install dependencies: `react-plotly.js`, `plotly.js`, `tailwindcss`; no mathjs required
- [x] Configure Tailwind CSS
- [x] Set up folder structure (`math/`, `geometry/`, `physics/`, `models/`, `components/`)
- [x] Implement `src/math/vec3.ts` — Vec3 type and helpers: `dot`, `cross`, `normalize`, `scale`, `add`, `sub`
- [x] Implement `src/math/mat3.ts` — 3×3 rotation matrix from axis+angle (Rodrigues formula), matrix-vector multiply
- [x] Define `BoardSetupConfig` TypeScript interface
- [x] Define `TruckConfig` TypeScript interface (front truck, full detail)
- [x] Define `RearTruckConfig` TypeScript interface
- [x] Define `BushingConfig` TypeScript interface

---

## Blocked

*(No tasks currently blocked)*
