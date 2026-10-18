# Geometry Engine

## Purpose
3D geometry computations and truck kinematics for the Longboard Simulator.

## Ownership
Geometry engine domain.

## Local Contracts
- This directory is the **SINGLE SOURCE OF TRUTH** for all derived, lean-independent truck geometry parameters.
- View components (`src/components/`) MUST NOT perform their own mechanical or geometric calculations. They must consume outputs from this directory.
- Any changes to geometry formulas MUST be made here and validated by unit tests.
- Positive propulsion windrose samples are centralized here and derive from the front wheel travel direction; views consume the resulting data.
- `boardMotion.ts` owns pure rigid-motion integration around the current local ICR and the separate viewport calculations. The motion graph places the rear truck at local +X, so travel is local -X; infinite ICR is represented by `null` and must produce straight motion. Automatic motion modes may apply the 10/3 s heading-correction time constant toward the nearest of the two horizontal orientations; Follow mode adds a 200 mm clearance to its safe border margin, while Zoom-To-Fit computes scale and center from the complete visible trace without zooming in closer than Follow. App-level simulation time is separate from wall-clock time, is paused by the motion control, and updates no faster than every 50 ms.

## Work Guidance
- Use exact 3D rotation matrices; no small-angle approximations.
- Coordinate system: X = forward, Y = up, Z = lateral right. Origin = axle center.
- All distances in mm; all angles in degrees.

## Verification
- Unit tests in `src/geometry/__tests__/` must pass.

## Child DOX Index
- None.
