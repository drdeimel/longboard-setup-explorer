# Persistence

## Purpose
Local storage state management for the Longboard Simulator.

## Ownership
State persistence domain.

## Local Contracts
- All application state must be serializable to and from `localStorage`.
- A versioned key must be used to handle schema migrations and prevent loading corrupt or outdated state.
- Fallback to default values must be robust and silent (or log a warning) if deserialization fails.

## Work Guidance
- Keep serialization logic separate from UI components.
- Use `JSON.stringify` and `JSON.parse` with appropriate error handling.

## Verification
- Manual testing of state persistence across page reloads and schema version bumps.

## Child DOX Index
- None.