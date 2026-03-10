# AGENTS.md — Onboarding Guide for AI Coding Agents

Welcome to the **Longboard Simulator** project. This document is your entry point. Read it before touching any code.

---

## 1. Project Overview

The Longboard Simulator is an interactive web application that models the geometry and physics of longboard truck systems. Given a set of truck parameters (pivot axis angle, rake, bushing stiffness, etc.), the app computes and visualizes:

- Lean-to-steer curves
- Return moment curves
- Steering moment diagrams
- Rotation axis distance
- Instant Center of Rotation (ICR) locus
- Annotated 2D cross-section diagrams (side, front, top views)

**Tech stack:**

| Layer | Technology |
|-------|-----------|
| UI framework | React 18 (functional components only) |
| Build tool | Vite |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS (no inline styles except SVG geometry) |
| Charting | Plotly.js via `react-plotly.js` |
| Math utilities | Custom `src/math/vec3.ts` and `src/math/mat3.ts` — **no mathjs** |

---

## 2. Repository Structure

Once Phase 1 scaffolding is complete, `src/` will be organized as follows:

```
src/
├── math/
│   ├── vec3.ts          # Vec3 type and vector helpers
│   └── mat3.ts          # 3×3 rotation matrix utilities (Rodrigues formula)
├── geometry/
│   ├── pivotAxis.ts     # Compute 3D pivot axis from truck parameters
│   ├── leanToSteer.ts   # Lean angle → steer angle via 3D rotation
│   ├── rotationAxisDist.ts  # Perpendicular distance from pivot axis to board plane
│   └── turningCenter.ts     # ICR locus computation
├── physics/
│   ├── bushingModels.ts     # Stiffness curves for cone and barrel bushings
│   ├── returnMoment.ts      # Combined bushing + gravitational return moment
│   └── lateralForce.ts      # Steering moment from lateral force
├── models/
│   ├── BoardSetupConfig.ts  # Top-level setup interface
│   ├── TruckConfig.ts       # Front truck interface (full detail)
│   ├── RearTruckConfig.ts   # Rear truck interface (minimal)
│   └── BushingConfig.ts     # Bushing interface
├── components/
│   ├── SideView.tsx         # SVG side cross-section (XY plane)
│   ├── FrontView.tsx        # SVG front cross-section (ZY plane)
│   ├── TopView.tsx          # SVG top-down view (XZ plane) with ICR locus
│   ├── DerivedParams.tsx    # Color-coded reactive parameter table
│   ├── ConfigPanel.tsx      # Setup configuration panel with sliders
│   ├── LeanVsSteerChart.tsx
│   ├── LeanVsReturnMomentChart.tsx
│   ├── SteeringMomentChart.tsx
│   └── RotationAxisDistChart.tsx
├── persistence/
│   └── localStorage.ts      # Versioned saveState / loadState
└── App.tsx                  # Root component — global state and layout
```

---

## 3. How to Pick Up Work

Follow these steps exactly when starting a new task:

1. **Read context:** Open [`plans/plan.md`](plans/plan.md) and read the relevant phase section to understand the design intent.
2. **Check the board:** Open [`plans/kanban.md`](plans/kanban.md) and find a task in the **Backlog** column that you can work on (no unresolved blockers).
3. **Claim the task:** Move the task's checklist marker from `[ ]` to `[-]` and move the item to the **In Progress** section.
4. **Implement:** Write the code. Follow all coding standards below. Check [`plans/open_issues.md`](plans/open_issues.md) for known issues in the files you're touching.
5. **Record insights:** If you discover anything non-obvious, append an entry to [`plans/insights.md`](plans/insights.md).
6. **File issues:** If you encounter something broken or incomplete that you cannot fix in this task, file it in [`plans/open_issues.md`](plans/open_issues.md).
7. **Complete the task:** Move the checklist marker from `[-]` to `[x]` and move the item to the **Done** section.

---

## 4. Coordinate System

All geometry uses a right-handed coordinate system anchored at the **axle center**:

| Axis | Direction |
|------|-----------|
| X    | Forward (along the board's rolling direction) |
| Y    | Up (normal to the ground plane) |
| Z    | Lateral right (toward the rider's heel side for a regular stance) |

- All distances and positions are in **millimetres (mm)**.
- All angles are in **degrees** unless a function's JSDoc explicitly states radians.
- The board surface plane is the XZ plane (Y = 0 at ground level, axle center is the origin).

---

## 5. Key Invariants to Never Break

These constraints are non-negotiable. Violating them will produce incorrect physics or break the app.

1. **Exact 3D rotation for lean-to-steer:** The lean→steer conversion in [`src/geometry/leanToSteer.ts`](src/geometry/leanToSteer.ts) **must** use exact 3D rotation matrices built with the Rodrigues formula. Small-angle approximations (`sin θ ≈ θ`, `cos θ ≈ 1`) are **never acceptable**, even for small lean angles.

2. **Shared scale across SVG views:** All three SVG diagram components (`SideView`, `FrontView`, `TopView`) must use the **same pixels-per-mm scale factor**. Adjacent views that share a geometric axis must be aligned so that matching dimensions visually correspond across diagrams.

3. **Persist on every state change:** App state must be written to `localStorage` on every React state update. There must be no code path that mutates setup state without triggering a persistence write.

4. **At least one setup must always exist:** The setup deletion logic must prevent removal of the last remaining setup. The delete button must be disabled (not merely hidden) when only one setup exists.

5. **No mathjs:** Do not add `mathjs` as a dependency. All linear algebra must go through [`src/math/vec3.ts`](src/math/vec3.ts) and [`src/math/mat3.ts`](src/math/mat3.ts).

---

## 6. Coding Standards

- **TypeScript strict mode** is enabled. There must be zero `any` types in production code.
- **JSDoc comments** are required on every exported function and interface. Include `@param`, `@returns`, and units where applicable.
- **No inline styles** except for SVG geometry attributes (e.g. `cx`, `cy`, `r`, `d`). All other styling must use Tailwind CSS utility classes.
- **React functional components only.** No class components. Prefer `const MyComponent: React.FC<Props> = ...` signatures.
- **No side effects at module load time.** All computation should happen inside React hooks or pure functions called from hooks.
- **Pure functions for all math/geometry/physics.** Functions in `src/math/`, `src/geometry/`, and `src/physics/` must be pure (no React imports, no side effects, no global state).

---

## 7. How to Record Insights

Open [`plans/insights.md`](plans/insights.md) and append a new entry when you encounter any of the following:

- A non-obvious algorithm behavior or edge case
- A constraint that isn't documented in [`plans/plan.md`](plans/plan.md) but turns out to matter
- A decision where you chose approach A over approach B and the reason is non-obvious
- A surprising interaction between two parts of the codebase
- A performance issue or numerical precision problem

Use the template provided at the top of [`plans/insights.md`](plans/insights.md). Be specific about the file(s) affected and why the naive approach fails.

---

## 8. How to File Issues

Open [`plans/open_issues.md`](plans/open_issues.md) and file a new entry when:

- You found a bug you cannot fix within the current task's scope
- A function is incomplete or only partially correct
- A required behavior is missing and would require changes across multiple files
- You made a design decision that you suspect may need revisiting

Use the `ISSUE-XXX` template at the top of [`plans/open_issues.md`](plans/open_issues.md). Increment the issue number from the last filed issue. File under the appropriate phase section. Provide enough context that a different agent can understand and fix the issue without needing to ask follow-up questions.

---

## 9. Testing

Unit tests are **required** for all functions in `src/geometry/` and `src/physics/`. Tests live alongside source files or in a `__tests__/` subdirectory.

**Reference cases to use:**

| Scenario | Expected behavior |
|----------|------------------|
| 50° RKP truck, zero rake, symmetric bushings, 0° lean | 0° steer |
| 50° RKP truck, zero rake, 45° lean | Matches analytically derivable steer angle for this configuration |
| Zero pivot axis angle | No steering response at any lean angle |
| 90° pivot axis angle | Maximum steering sensitivity |
| Equal bushing stiffness, zero lean | Zero return moment |

Tests must cover edge cases: zero lean, maximum lean (±45°), extreme truck angles (0° and 90°), and asymmetric bushing configurations.

---

## 10. Getting Started Commands

> **Note:** These commands apply once Phase 1 scaffolding is complete. The project does not yet have a `package.json`.

```bash
# Scaffold the project (run once, in the workspace root)
npm create vite@latest . -- --template react-ts

# Install runtime dependencies
npm install react-plotly.js plotly.js

# Install Tailwind CSS and its Vite plugin
npm install -D tailwindcss @tailwindcss/vite

# Install type definitions
npm install -D @types/plotly.js

# Start the development server
npm run dev

# Run tests (once a test runner is configured)
npm test
```

After scaffolding, configure Tailwind by following the official Vite + Tailwind setup guide and set up `tsconfig.json` with `"strict": true`.
