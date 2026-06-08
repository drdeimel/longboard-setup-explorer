# Tour System Design

## Overview
An introductory tour system that highlights and explains specific areas of the Longboard Truck Simulator page. Tours use translucent circles to highlight areas with hovering explanation boxes, presented as a consecutive click-through experience.

## Architecture

### 1. Tour Data Structure

**File: `src/tours/tourTypes.ts`**

```typescript
/** A single tooltip/step in a tour. */
export interface TourStep {
  /** CSS selector or element ID to highlight. */
  targetSelector: string
  
  /** Title shown in the explanation box. */
  title: string
  
  /** Explanation text shown in the explanation box. */
  description: string
  
  /** Optional: position of the tooltip relative to target ('top', 'bottom', 'left', 'right', 'center'). */
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

/** A complete tour definition. */
export interface TourDefinition {
  /** Unique identifier for the tour. */
  id: string
  
  /** Display name shown in the tour selector. */
  name: string
  
  /** Brief description of what this tour covers. */
  description: string
  
  /** Ordered list of steps in the tour. */
  steps: TourStep[]
}
```

### 2. Tour Definitions (Easy-to-Edit)

**File: `src/tours/tourDefinitions.ts`**

This file contains all tour content in a simple, easy-to-edit format. Adding new tours or modifying existing ones only requires editing this file.

```typescript
import type { TourDefinition } from './tourTypes'

export const TOURS: TourDefinition[] = [
  {
    id: 'getting-started',
    name: 'Getting Started',
    description: 'Learn the basics of the Longboard Truck Simulator',
    steps: [
      {
        targetSelector: 'header h1',
        title: 'Welcome!',
        description: 'This is the Longboard Truck Geometry Explorer — your interactive tool for understanding truck setups.',
        position: 'bottom',
      },
      {
        targetSelector: '[data-testid="config-panel"]',
        title: 'Configuration Panel',
        description: 'On the left, you can adjust all truck parameters: pivot angle, rake, bushings, and more. Try loading a preset to get started quickly.',
        position: 'right',
      },
      {
        targetSelector: '.grid.grid-cols-2 > div:first-child',
        title: 'Side View',
        description: 'The side view shows a cross-section of your front truck. Notice the pivot axis angle, rake offset, and trailing distance indicators.',
        position: 'top',
      },
      {
        targetSelector: '.grid.grid-cols-2 > div:nth-child(2)',
        title: 'Front View',
        description: 'The front view shows how the truck leans and steers. The colored lines indicate the pivot axis at different lean angles.',
        position: 'top',
      },
      {
        targetSelector: '.grid.grid-cols-2 .h-64:first-child',
        title: 'Top View',
        description: 'See how both trucks steer from above. The intersection point shows your Instantaneous Center of Rotation (ICR).',
        position: 'top',
      },
      {
        targetSelector: '.grid.grid-cols-2 .h-64:nth-child(2)',
        title: 'Lean vs Steer Chart',
        description: 'This chart shows how much your truck steers for a given board lean angle. Different setups will show different curves.',
        position: 'top',
      },
    ],
  },
  // Add more tours here easily!
  // {
  //   id: 'advanced-geometry',
  //   name: 'Advanced Geometry',
  //   description: 'Deep dive into truck geometry parameters',
  //   steps: [ ... ],
  // },
]
```

### 3. Components

**File: `src/components/TourOverlay.tsx`**

The overlay component renders:
- A semi-transparent dark backdrop over the page
- A translucent circle highlighting the current target element
- A hovering explanation box with title, description, and navigation controls

```typescript
interface TourOverlayProps {
  /** Current tour definition. */
  tour: TourDefinition
  
  /** Current step index (0-based). */
  currentStep: number
  
  /** Callback when user advances to next step. */
  onNext: () => void
  
  /** Callback when user goes back to previous step. */
  onPrev: () => void
  
  /** Callback when user exits the tour. */
  onExit: () => void
}
```

**File: `src/components/TourSelector.tsx`**

A dropdown or modal that lets users choose which tour to start.

```typescript
interface TourSelectorProps {
  /** Available tours. */
  tours: TourDefinition[]
  
  /** Callback when user selects a tour to start. */
  onStartTour: (tourId: string) => void
}
```

### 4. State Management

State is managed in `App.tsx`:

```typescript
// Tour state
const [activeTourId, setActiveTourId] = useState<string | null>(null)
const [currentStep, setCurrentStep] = useState<number>(0)
const [isTourRunning, setIsTourRunning] = useState<boolean>(false)
```

### 5. Tour Button Placement

A "Take a Tour" button is added to the header, right-aligned:

```tsx
<header className="flex items-center justify-between ...">
  <div>
    <h1>Longboard Truck Geometry Explorer</h1>
    <p>Interactive visualization...</p>
  </div>
  <TourSelectorButton onClick={...} />
</header>
```

## File Structure

```
src/
  tours/
    tourTypes.ts          # Type definitions
    tourDefinitions.ts    # All tour content (easy to edit)
  components/
    TourOverlay.tsx       # Tour overlay with circles + tooltips
    TourSelector.tsx      # Tour selection UI
    TourButton.tsx        # Small button to start tours
```

## Extensibility

Adding a new tour is as simple as:
1. Open `src/tours/tourDefinitions.ts`
2. Add a new object to the `TOURS` array
3. Each step needs: `targetSelector`, `title`, `description`, and optionally `position`

No code changes are needed elsewhere unless you want custom behavior.

## Implementation Notes

- Use CSS selectors for targeting elements (add `data-tour-*` attributes where needed)
- The translucent circle is positioned over the target element using `getBoundingClientRect()`
- The explanation box is positioned relative to the target (top/bottom/left/right/center)
- Keyboard navigation: Escape to exit, Arrow keys to navigate
- Tour progress can be persisted in localStorage (optional)
