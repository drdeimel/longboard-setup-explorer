# Geometry Engine

## Purpose
3D geometry computations and truck kinematics for the Longboard Simulator.

## Ownership
Geometry engine domain.

## Local Contracts
- This directory is the **SINGLE SOURCE OF TRUTH** for all derived, lean-independent truck geometry parameters.
- View components (`src/components/`) MUST NOT perform their own mechanical or geometric calculations. They must consume outputs from this directory.
- Any changes to geometry formulas MUST be made here and validated by unit tests.

## Work Guidance
- Use exact 3D rotation matrices; no small-angle approximations.
- Coordinate system: X = forward, Y = up, Z = lateral right. Origin = axle center.
- All distances in mm; all angles in degrees.

## Verification
- Unit tests in `src/geometry/__tests__/` must pass.

## Child DOX Index
- None.