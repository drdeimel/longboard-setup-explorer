# Open Issues

This file tracks known implementation gaps, limitations, and issues that were discovered during development but not resolved in the same task. Each filing agent should provide enough context for another agent to pick up the issue.

## Issue Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]`  | Open — not yet addressed |
| `[-]`  | In Progress — being worked on |
| `[x]`  | Resolved |
| `[~]`  | Deferred — acknowledged, intentionally postponed |

## How to File an Issue

Add a new entry under the appropriate phase section using this template:

```markdown
#### ISSUE-XXX: Short descriptive title
**Status:** [ ]  
**Filed by:** Agent/task name  
**Date:** YYYY-MM-DD  
**Severity:** Low | Medium | High  
**Phase:** Phase X — Name  

**Description:**  
What is wrong or incomplete.

**Steps to reproduce / context:**  
How to observe the issue, or what code path triggers it.

**Suggested fix:**  
Optional — if you have a hypothesis.

**Affected files:**  
- `path/to/file.ts`
```

---

## Phase 1 — Project Scaffolding
*(No issues filed yet)*

## Phase 2 — Geometry Engine
*(No issues filed yet)*

## Phase 3 — Bushing & Physics Engine
*(No issues filed yet)*

## Phase 4 — SVG Diagrams
*(No issues filed yet)*

## Phase 5 — Chart Components
*(No issues filed yet)*

## Phase 6 — Config Panel & Multi-Setup Management
*(No issues filed yet)*

## Phase 7 — App Integration, Layout & Persistence

#### ISSUE-001: Plotly.js bundle is large; chart components should use dynamic imports
**Status:** [ ]
**Filed by:** Phase 5 — Chart Components implementation
**Date:** 2026-03-01
**Severity:** Low
**Phase:** Phase 7 — App Integration, Layout & Persistence

**Description:**
The production bundle is ~4MB (1.5MB gzipped) because `react-plotly.js` and `plotly.js` are imported synchronously in all four chart components. The Vite build emits a `(!) Some chunks are larger than 500 kB` warning.

**Steps to reproduce / context:**
Run `npm run build`. Look at `dist/assets/index-*.js` — it's ~4.9MB.

**Suggested fix:**
Wrap all four chart components in `React.lazy()` calls in `App.tsx`:
```ts
const LeanVsSteerChart = React.lazy(() => import('./components/LeanVsSteerChart'))
```
Wrap the chart grid section in `<React.Suspense fallback={<LoadingSpinner />}>`. This defers Plotly loading until after the SVG diagrams and config panel have painted.

**Affected files:**
- `src/App.tsx`
- `src/components/LeanVsSteerChart.tsx`
- `src/components/LeanVsReturnMomentChart.tsx`
- `src/components/SteeringMomentChart.tsx`
- `src/components/RotationAxisDistChart.tsx`

## Phase 8 — Polish & Future-Proofing
*(No issues filed yet)*
