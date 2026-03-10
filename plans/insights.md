# Implementation Insights

This file records non-trivial insights, discovered constraints, surprising behaviors, or important decisions made during implementation. Each agent working on this project should append entries here when they encounter something noteworthy.

## How to Add an Entry

Add a new section using the template below. Be specific — insights that seem obvious in the moment are often forgotten later.

```markdown
### [Phase X] Short title describing the insight
**Date:** YYYY-MM-DD  
**File(s) affected:** `path/to/file.ts`  
**Summary:** One-sentence summary.

**Detail:**
Full explanation. Include why the naive approach failed, what the correct approach is, and any implications for other parts of the codebase.

**Related tasks:** Task name(s) from kanban.md
```

---

## Insights Log

### [Phase 2] Steer angle sign convention requires negation relative to naive atan2

**Date:** 2026-03-01  
**File(s) affected:** `src/geometry/leanToSteer.ts`  
**Summary:** The steer angle extracted via `atan2(axle_x, axle_z)` has opposite sign from the physical "steer-matches-lean" convention expected by charts and callers.

**Detail:**
In the project right-hand coordinate system (X forward, Y up, Z right/heel), rotating the board right (+φ around +X axis) causes the hanger to rotate clockwise (when viewed from above, i.e., from +Y). This clockwise hanger rotation gives the axle tip at +Z a NEGATIVE X component, so `atan2(axle_x, axle_z) < 0` for a right lean (positive φ). However, the desired convention for charts is: positive lean → positive steer (both in the same direction). Therefore, the computed steer angle is negated:

```ts
steerAngleDeg = -(Math.atan2(axleFinal[0], axleFinal[2]) * 180) / Math.PI
```

The naive approach (no negation) would produce steer curves that are flipped relative to the lean direction, making the charts confusing. The steer sign convention now matches: lean right (+φ) → steer right (+δ), lean left (−φ) → steer left (−δ).

**Related tasks:** Implement `leanToSteer.ts`, Write unit tests for geometry functions.

---

### [Phase 3] Bushing torque sign is opposite to lean angle in the return moment model

**Date:** 2026-03-01  
**File(s) affected:** `src/physics/returnMoment.ts`, `src/physics/bushingModels.ts`  
**Summary:** The bushing torque in `computeReturnMoment` is NEGATIVE for a POSITIVE lean angle, which is counter-intuitive but physically correct.

**Detail:**
When the board leans right (+φ), the `computeLeanToSteer` function returns a NEGATIVE hanger rotation angle (e.g., -29.5° for +20° lean). This is because the hanger must rotate in the negative direction to compensate for the board lean and keep the axle in the road plane. The `bushingTorque` function, being odd-symmetric, then returns a NEGATIVE torque for this negative angle. This negative torque represents the bushing PUSHING the hanger BACK toward neutral (θ = 0), which is physically the restoring direction. The formula `M_net = M_bushing - M_gravity` thus has:
- Positive lean → M_bushing < 0 (bushing pushes hanger back = resists lean)
- Positive lean → M_gravity > 0 (gravity destabilizes)
- Net moment sign indicates: negative = stable (lean is corrected), positive = unstable

This contrasts with the steer angle convention (where positive lean → positive steer) but is consistent with the physical mechanics of the bushing system.

**Related tasks:** Implement `returnMoment.ts`, Write unit tests for physics functions.

---

### [Phase 2] vite.config.ts uses `/// <reference types="vitest/config" />` for test configuration

**Date:** 2026-03-01  
**File(s) affected:** `vite.config.ts`  
**Summary:** Adding the `test` property to Vite's config object requires the vitest type reference to avoid TypeScript errors.

**Detail:**
The standard Vite `defineConfig` type does not include the `test` property needed by Vitest. Adding `/// <reference types="vitest/config" />` at the top of `vite.config.ts` enables the extended type that includes `test`. Without it, TypeScript reports `"test" does not exist in type 'UserConfigExport'`. This is a Vitest-specific pattern, not documented prominently in the Vite docs.

**Related tasks:** Initialize Vite + React + TypeScript project, Write unit tests for geometry functions.

---

### [Phase 4] SVG coordinate system: Y-axis flip required for physics ↔ screen mapping

**Date:** 2026-03-01
**File(s) affected:** `src/components/SideView.tsx`, `src/components/FrontView.tsx`, `src/components/TopView.tsx`
**Summary:** SVG y-coordinates increase downward while the physics coordinate system has Y pointing up; a negation is required in all `toSVG()` helper functions.

**Detail:**
In the physics coordinate system: Y = 0 is the axle center, Y > 0 is up, and Y < 0 is the road (ground at y = −wheelDiameter/2). SVG coordinate systems have y=0 at the top and y increasing downward. Every component therefore uses a `toSVG(physX, physY)` helper that negates the Y component: `svgY = originY − physY × ppm`. Forgetting this negation causes the board to appear below the ground plane and wheels to float above the axle center.

The top-down view (XZ plane) uses a different helper because there is no Y dimension — X becomes the horizontal axis and Z becomes the vertical axis (Z increases downward on screen, which correctly matches the "heel side = right" intuition from the rider's perspective).

**Related tasks:** Implement SideView, Implement FrontView, Implement TopView.

---

### [Phase 4/7] Shared pixelsPerMm scale is computed once in App.tsx and passed as a prop

**Date:** 2026-03-01
**File(s) affected:** `src/App.tsx`, `src/components/SideView.tsx`, `src/components/FrontView.tsx`, `src/components/TopView.tsx`
**Summary:** The shared scale for cross-view geometric consistency is computed once in App based on the active setup geometry and the available SVG pixel height, then passed as `pixelsPerMm` to all three SVG components.

**Detail:**
If each component computed its own scale independently, the views would not be geometrically aligned (e.g., 50mm on the side view would not represent the same distance as 50mm on the top view). By computing a single scale in `computeSharedScale()` in App.tsx and passing it as a prop, all three views always use the same pixels-to-mm ratio. The scale is based on the SideView height since that view constrains the vertical geometry range most tightly (it must show from the ground to the board surface).

**Related tasks:** Add dynamic geometry updates.

---

### [Phase 6] `nextColor()` cycles through the palette when all distinct colors are taken

**Date:** 2026-03-01
**File(s) affected:** `src/components/ConfigPanel.tsx`
**Summary:** When more than 8 setups exist, `nextColor()` falls back to cycling through the palette modulo its length rather than erroring.

**Detail:**
The palette contains 8 distinct colors. For the common case (≤8 setups) each setup gets a unique color. When setup count exceeds 8, the function cycles: `SETUP_COLORS[existingColors.length % SETUP_COLORS.length]`. This produces color collisions for large setup counts but avoids a crash or ugly fallback. If color uniqueness for large suite counts becomes important, the function can be extended to generate unique HSL colors algorithmically.

**Related tasks:** Assign distinct colors per setup.

---

### [Phase 7] Plotly.js bundle is large (~4MB uncompressed); dynamic import could mitigate

**Date:** 2026-03-01
**File(s) affected:** `src/components/LeanVsSteerChart.tsx`, `src/components/LeanVsReturnMomentChart.tsx`, `src/components/SteeringMomentChart.tsx`, `src/components/RotationAxisDistChart.tsx`
**Summary:** Plotly.js contributes ~4MB to the production bundle (1.5MB gzipped). A build warning suggests using dynamic imports to code-split the chart components.

**Detail:**
The current implementation imports Plotly synchronously via `import Plot from 'react-plotly.js'`. This keeps all chart code in the main bundle. For production performance, each chart component could use `React.lazy(() => import('./LeanVsSteerChart'))` in App.tsx with a `<Suspense>` boundary to defer Plotly loading until after the initial paint. Since the simulator is data-exploration UI (not performance-critical first-paint), this optimization is filed as a future improvement rather than blocking.

**Related tasks:** Implement LeanVsSteerChart, Implement LeanVsReturnMomentChart, Implement SteeringMomentChart, Implement RotationAxisDistChart.
