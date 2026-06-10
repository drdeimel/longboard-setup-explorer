# Data Models

## Purpose
TypeScript data models and interfaces for configurations in the Longboard Simulator.

## Ownership
Data modeling domain.

## Local Contracts
- All configuration state must be defined here with strict TypeScript interfaces.
- Interfaces must be immutable in practice; updates should produce new objects.
- Default values and presets should be defined alongside or near these models.

## Work Guidance
- Use discriminated unions for variant configurations (e.g., `single-pivot` vs `dual-pivot` trucks).
- Keep interfaces flat where possible, but group related parameters logically.

## Verification
- TypeScript compiler must pass with strict mode enabled.

## Child DOX Index
- None.