/**
 * URL-based state serialization for sharing board setups via link.
 *
 * Encodes the full app state (setups + rider params) into a URL-safe Base64
 * string stored in the `?setup=` query parameter.
 */

import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import type { RiderParams } from '../components/ConfigPanel'

/** The shape of the state encoded in the URL. */
export interface UrlState {
  setups: BoardSetupConfig[]
  riderParams: RiderParams
  activeSetupId: string
  steeringLeanAngleDeg: number
}

/**
 * Serialize app state into a URL-safe Base64 string.
 */
export function serializeState(state: UrlState): string {
  const json = JSON.stringify(state)
  return btoa(json)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

/**
 * Deserialize a URL-safe Base64 string back into app state.
 * Returns null if the data is invalid or corrupted.
 */
export function deserializeState(encoded: string): UrlState | null {
  try {
    // Restore standard Base64 padding
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const pad = base64.length % 4
    if (pad) base64 += '='.repeat(4 - pad)

    const json = atob(base64)
    const parsed = JSON.parse(json)

    if (!isValidUrlState(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Read the `setup` query parameter from the current URL and deserialize it.
 */
export function readStateFromUrl(): UrlState | null {
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('setup')
  if (!raw) return null
  return deserializeState(raw)
}

/**
 * Build a shareable URL for the current state.
 */
export function buildShareUrl(state: UrlState): string {
  const encoded = serializeState(state)
  const base = window.location.origin + window.location.pathname
  return `${base}?setup=${encoded}`
}

/** Minimal shape check for deserialized URL state. */
function isValidUrlState(value: unknown): value is UrlState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!Array.isArray(v['setups']) || v['setups'].length === 0) return false
  if (typeof v['riderParams'] !== 'object' || v['riderParams'] === null) return false
  if (typeof v['activeSetupId'] !== 'string') return false
  if (typeof v['steeringLeanAngleDeg'] !== 'number') return false
  return true
}
