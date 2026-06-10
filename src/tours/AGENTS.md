# Tour System

## Purpose
Interactive tour system definitions and types for the Longboard Simulator.

## Ownership
User onboarding and guidance domain.

## Local Contracts
- Tour definitions must be decoupled from the components they target, using stable selectors or refs.
- Tour state (current step, visibility) must be managed globally or via a dedicated context.

## Work Guidance
- Use TypeScript interfaces to define tour steps, targets, and content.
- Ensure tours are accessible and can be dismissed or restarted.

## Verification
- Manual testing of tour flow, targeting accuracy, and state persistence.

## Child DOX Index
- None.