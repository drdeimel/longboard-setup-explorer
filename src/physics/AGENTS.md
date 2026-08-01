# Physics Engine

## Purpose
Physics and mechanical models for the Longboard Simulator, including bushing stiffness, return moments, and lateral forces.

## Ownership
Physics engine domain.

## Local Contracts
- This directory is the source of truth for all physics calculations (bushing torque, gravitational moments, lateral forces).
- Physics models must be parameterized and unit-safe (torques in N·mm, angles in degrees, distances in mm, masses in kg).
- Key geometry computations are centralized in `keyGeometryDataSet.ts`.

## Work Guidance
- Bushing models must support `cone` and `barrel` shapes with durometer and height variations.
- Net return moment combines bushing restoring torque and gravitational destabilizing torque.
- Steering moment (`lateralForce.ts`) sums two independent moments: `F × d_invPendulum(φ)` (board-level arm, lean-dependent) and `F × cos(δ(φ)) × trail × cos(α)` (ground-contact arm, scaled by steer angle cosine). Requires `wheelDiameter` for the trail term; defaults to 0.
- `KeyGeometryResult.lateralForceEquilibriumN`: lateral force at which steering moment equals bushing torque at a given lean angle. Computed in `keyGeometryDataSet.ts` using `computeSteeringMoment` with unit force.
- All physics functions must be pure and deterministic for reliable charting and testing.
- changing or implmementing the physical models requires extra diligence for implementation inaccuracies. Equations should have clear meanings and be well documented, ideally with well-known concepts.

## Verification
- Unit tests in `src/physics/__tests__/` must pass.
- Integration and regression tests must validate curve shapes and signs.

## Child DOX Index
- None.