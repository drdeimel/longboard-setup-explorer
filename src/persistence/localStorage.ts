/**
 * Versioned localStorage persistence for the Longboard Simulator.
 *
 * Serializes the full app state (setups list + rider params) under a versioned
 * key. On load, validates the structure and falls back to defaults if the data
 * is missing, corrupt, or from an incompatible version.
 *
 * Version strategy: bumping `STORAGE_VERSION` causes all existing persisted
 * state to be discarded (treated as incompatible) and the app starts fresh
 * with defaults. This is intentional for major breaking changes to the state
 * shape.
 */

import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import type { RiderParams } from '../components/ConfigPanel'

/** Current storage format version. Bump when state shape changes incompatibly. */
const STORAGE_VERSION = 2

/** localStorage key for persisted app state. */
const STORAGE_KEY = `longboard-simulator-v${STORAGE_VERSION}`

/** The shape of the serialized app state written to localStorage. */
interface PersistedAppState {
  version: number
  setups: BoardSetupConfig[]
  riderParams: RiderParams
  activeSetupId: string
  steeringLeanAngleDeg: number
}

/**
 * Serialize and save the full app state to localStorage.
 *
 * Called on every state mutation (via `useEffect` in `App.tsx`) per the
 * persistence invariant in `AGENTS.md §5`.
 *
 * @param state - The current app state to persist.
 */
export function saveState(state: {
  setups: BoardSetupConfig[]
  riderParams: RiderParams
  activeSetupId: string
  steeringLeanAngleDeg: number
}): void {
  try {
    const payload: PersistedAppState = {
      version: STORAGE_VERSION,
      ...state,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    // Storage may be full or unavailable (e.g. private browsing with quota=0).
    // Fail silently — the app continues to work without persistence.
    console.warn('[persistence] Failed to save state:', err)
  }
}

/**
 * Load and deserialize app state from localStorage.
 *
 * Validates that:
 * - The key exists in localStorage.
 * - The version matches the current `STORAGE_VERSION`.
 * - The payload has the expected shape (at minimum: `setups` array and
 *   `riderParams` object with the required fields).
 *
 * Returns `null` if validation fails at any step, signaling the caller
 * to fall back to default state.
 *
 * @returns The deserialized app state, or `null` if unavailable/invalid.
 */
export function loadState(): {
  setups: BoardSetupConfig[]
  riderParams: RiderParams
  activeSetupId: string
  steeringLeanAngleDeg: number
} | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (!isPersistedAppState(parsed)) return null

    return {
      setups: parsed.setups,
      riderParams: parsed.riderParams,
      activeSetupId: parsed.activeSetupId,
      steeringLeanAngleDeg: parsed.steeringLeanAngleDeg,
    }
  } catch (err) {
    console.warn('[persistence] Failed to load state:', err)
    return null
  }
}

/**
 * Type guard: validate that a parsed JSON value matches `PersistedAppState`.
 *
 * Only validates the structural shape (not deep field-level ranges). The goal
 * is to catch stale/corrupt blobs, not re-validate physics constraints.
 *
 * @param value - The `JSON.parse` output to validate.
 * @returns `true` if the value conforms to `PersistedAppState`.
 */
function isPersistedAppState(value: unknown): value is PersistedAppState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  if (v['version'] !== STORAGE_VERSION) return false
  if (!Array.isArray(v['setups']) || v['setups'].length === 0) return false
  if (typeof v['riderParams'] !== 'object' || v['riderParams'] === null) return false
  if (typeof v['activeSetupId'] !== 'string') return false
  if (typeof v['steeringLeanAngleDeg'] !== 'number') return false

  const rp = v['riderParams'] as Record<string, unknown>
  if (typeof rp['massKg'] !== 'number') return false
  if (typeof rp['comHeightM'] !== 'number') return false

  // Each setup must have at minimum: id, name, color, wheelbase, frontTruck, rearTruck
  for (const setup of v['setups'] as unknown[]) {
    if (!isSetupShape(setup)) return false
  }

  return true
}

/**
 * Minimal shape check for a `BoardSetupConfig` object from storage.
 *
 * @param s - Value to check.
 * @returns `true` if `s` has the expected top-level shape.
 */
function isSetupShape(s: unknown): s is BoardSetupConfig {
  if (typeof s !== 'object' || s === null) return false
  const setup = s as Record<string, unknown>
  return (
    typeof setup['id'] === 'string' &&
    typeof setup['name'] === 'string' &&
    typeof setup['color'] === 'string' &&
    typeof setup['wheelbase'] === 'number' &&
    typeof setup['frontTruck'] === 'object' &&
    typeof setup['rearTruck'] === 'object'
  )
}
