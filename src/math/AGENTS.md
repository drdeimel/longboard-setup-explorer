# Math Utilities

## Purpose
Core 3D vector and matrix math utilities for the Longboard Simulator.

## Ownership
Math domain.

## Local Contracts
- This directory provides low-level, dependency-free math operations (e.g., `vec3`, `mat3`).
- Functions must be pure, highly performant, and free of side effects.
- No external math libraries (like `mathjs`) should be added; custom implementations are required to keep bundle size minimal.

## Work Guidance
- Use TypeScript tuples or simple objects for vectors/matrices to avoid class overhead.
- Ensure all operations are numerically stable.

## Verification
- Unit tests must validate basic operations (dot, cross, normalize, rotation).

## Child DOX Index
- None.