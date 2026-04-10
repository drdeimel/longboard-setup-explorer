/**
 * App — root component for the Longboard Truck Simulator.
 *
 * Manages global state:
 * - `setups`: list of board setup configurations (multiple, color-coded)
 * - `activeSetupId`: currently selected setup (highlighted in all diagrams)
 * - `riderParams`: global rider mass + CoM height
 * - `steeringLeanAngleDeg`: lean angle shown in the SteeringMomentChart
 *
 * Persistence invariant (AGENTS.md §5):
 * - State is written to localStorage on every change via `useEffect`.
 * - State is loaded from localStorage on mount; falls back to defaults.
 *
 * Layout: responsive two-column (config panel left, diagrams right).
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { BoardSetupConfig } from './models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from './models/BoardSetupConfig'
import ConfigPanel, {
  type RiderParams,
  PRESETS,
  SETUP_COLORS,
  nextColor,
} from './components/ConfigPanel'
import SideView from './components/SideView'
import FrontView from './components/FrontView'
import TopView from './components/TopView'
import LeanVsSteerChart from './components/LeanVsSteerChart'
import LeanVsRotationalStiffnessChart from './components/LeanVsRotationalStiffnessChart'
import SteeringMomentChart from './components/SteeringMomentChart'
import LeanVsBushingTorqueChart from './components/LeanVsBushingTorqueChart'
import LeanVsTurningRadiusChart from './components/LeanVsTurningRadiusChart'
import LeanVsCentripetalAxisChart from './components/LeanVsCentripetalAxisChart'
import { saveState, loadState } from './persistence/localStorage'
import { computePivotAxis } from './geometry/pivotAxis'
import { returnKeyGeometryCurves } from './physics/keyGeometryDataSet'

// ─────────────────────────────────────────────────────────────────────────────
// Default state
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a stable UUID-like ID for setups. */
function generateId(): string {
  return `setup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Default rider parameters: 75kg rider, 1.0m CoM height. */
const DEFAULT_RIDER_PARAMS: RiderParams = {
  massKg: 75,
  boardThicknessMm: 11,
  comHeightM: 1.0,
}

/** Build the default initial setup from the Standard RKP 50° preset. */
function buildDefaultSetup(): BoardSetupConfig {
  const preset = PRESETS[0]
  return {
    id: generateId(),
    name: preset.label,
    color: SETUP_COLORS[0],
    ...preset.config,
  }
}

/** Build the initial app state: try localStorage first, fall back to defaults. */
function buildInitialState(): {
  setups: BoardSetupConfig[]
  activeSetupId: string
  riderParams: RiderParams
  steeringLeanAngleDeg: number
} {
  const persisted = loadState()
  if (persisted) return persisted

  const defaultSetup = buildDefaultSetup()
  return {
    setups: [defaultSetup],
    activeSetupId: defaultSetup.id,
    riderParams: DEFAULT_RIDER_PARAMS,
    steeringLeanAngleDeg: 0,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared SVG scale
// ─────────────────────────────────────────────────────────────────────────────

function computeRequiredSideVerticalExtentMm(setup: BoardSetupConfig, boardThicknessMm: number): number {
  const truck = setup.frontTruck
  const dBoard = boardThicknessMm + truck.baseplateToBoard + truck.axleToBaseplateDistance
  return dBoard + truck.wheelDiameter / 2 + 30
}

function computeRequiredFrontVerticalExtentMm(setup: BoardSetupConfig, boardThicknessMm: number): number {
  const truck = setup.frontTruck
  const dBoard = boardThicknessMm + truck.baseplateToBoard + truck.axleToBaseplateDistance
  return dBoard + truck.wheelDiameter / 2 + 20
}

function quantizeVerticalExtentMm(prev: number, required: number): number {
  if (prev <= 0) return required

  let next = prev

  // Grow in fixed +10% steps.
  while (required > next) {
    next *= 1.1
  }

  // Shrink only when usage drops below 25%.
  while (required < next * 0.25) {
    next *= 0.25
  }

  return next
}

// ─────────────────────────────────────────────────────────────────────────────
// App component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * App — root component managing global state and two-column layout.
 */
const App: React.FC = () => {
  const initial = buildInitialState()

  const [setups, setSetups] = useState<BoardSetupConfig[]>(initial.setups)
  const [activeSetupId, setActiveSetupId] = useState<string>(initial.activeSetupId)
  const [riderParams, setRiderParams] = useState<RiderParams>(initial.riderParams)
  const [steeringLeanAngleDeg, setSteeringLeanAngleDeg] = useState<number>(
    initial.steeringLeanAngleDeg,
  )
  const [topViewCollapsed, setTopViewCollapsed] = useState<boolean>(false)
  const diagramsRowRef = useRef<HTMLDivElement | null>(null)
  const [diagramHeightPx, setDiagramHeightPx] = useState<number>(280)
  const [verticalExtentBucketMm, setVerticalExtentBucketMm] = useState<number>(() => {
    const initialSetup = initial.setups[0]
    return Math.max(
      computeRequiredSideVerticalExtentMm(initialSetup, initial.riderParams.boardThicknessMm),
      computeRequiredFrontVerticalExtentMm(initialSetup, initial.riderParams.boardThicknessMm),
    )
  })

  // ── Persistence: save to localStorage (debounced to avoid blocking on slider changes) ──
  const saveTimerRef = useRef<number | null>(null)

  useEffect(() => {
    // Debounce saves by 300ms to avoid blocking UI during slider interactions
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveState({ setups, riderParams, activeSetupId, steeringLeanAngleDeg })
    }, 2000)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [setups, activeSetupId, riderParams, steeringLeanAngleDeg])

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeSetup = setups.find(s => s.id === activeSetupId) ?? setups[0]
  const requiredExtentMm = useMemo(() => {
    // Shared vertical reference for both Side and Front views.
    return Math.max(
      computeRequiredSideVerticalExtentMm(activeSetup, riderParams.boardThicknessMm),
      computeRequiredFrontVerticalExtentMm(activeSetup, riderParams.boardThicknessMm),
    )
  }, [activeSetup, riderParams.boardThicknessMm])

  useEffect(() => {
    setVerticalExtentBucketMm(prev => quantizeVerticalExtentMm(prev, requiredExtentMm))
  }, [requiredExtentMm])

  useEffect(() => {
    const el = diagramsRowRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const update = () => {
      const h = Math.max(220, Math.round(el.getBoundingClientRect().height))
      setDiagramHeightPx(h)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [topViewCollapsed])

  const sharedViewHeightPx = Math.max(220, diagramHeightPx)
  // One floor offset for both views so the dotted ground lines overlap exactly.
  const sharedGroundOffsetPx = Math.max(12, Math.min(40, Math.round(sharedViewHeightPx * 0.07)))
  const availableHeightPx = Math.max(80, sharedViewHeightPx - sharedGroundOffsetPx - 16)
  const verticalPpm = Math.max(0.3, Math.min(2.5, availableHeightPx / verticalExtentBucketMm))
  // Simplified model: one shared vertical ppm only (no horizontal cap coupling).
  const sharedPpm = verticalPpm

  // ── Key Geometry Curves (computed once per setup when config changes) ───────
  const DEFAULT_SAMPLES = 91
  const keyGeometryCurves = useMemo(() => {
    return setups.map(setup => {
      const truck = setup.frontTruck
      const rearTruck = setup.rearTruck
      const { direction } = computePivotAxis(truck.pivotAxisAngle, truck.rake)
      const curve = returnKeyGeometryCurves(
        direction,
        truck.pivotAxisAngle,
        truck.rake,
        truck.axleToBaseplateDistance,
        riderParams.boardThicknessMm + truck.baseplateToBoard,
        truck.roadsideBushing,
        truck.boardsideBushing,
        riderParams.massKg,
        riderParams.comHeightM,
        -DEFAULT_MAX_LEAN,
        DEFAULT_MAX_LEAN,
        DEFAULT_SAMPLES,
        rearTruck.pivotAxisAngle,
        rearTruck.rake,
        setup.wheelbase,
      )
      return {
        setupId: setup.id,
        maxLeanDeg: DEFAULT_MAX_LEAN,
        curve,
      }
    })
  }, [setups, riderParams.massKg, riderParams.comHeightM, riderParams.boardThicknessMm])

  // ── Setup mutation handlers ────────────────────────────────────────────────

  const handleSetupChange = useCallback((updated: BoardSetupConfig) => {
    setSetups(prev => prev.map(s => (s.id === updated.id ? updated : s)))
  }, [])

  const handleSetupDuplicate = useCallback(
    (id: string) => {
      const source = setups.find(s => s.id === id)
      if (!source) return
      const existingColors = setups.map(s => s.color)
      const newSetup: BoardSetupConfig = {
        ...source,
        id: generateId(),
        name: `${source.name} copy`,
        color: nextColor(existingColors),
      }
      setSetups(prev => [...prev, newSetup])
      setActiveSetupId(newSetup.id)
    },
    [setups],
  )

  const handleSetupDelete = useCallback(
    (id: string) => {
      if (setups.length <= 1) return // invariant: always at least one setup
      setSetups(prev => {
        const next = prev.filter(s => s.id !== id)
        // If we deleted the active setup, switch to the first remaining
        if (id === activeSetupId) {
          setActiveSetupId(next[0]?.id ?? '')
        }
        return next
      })
    },
    [setups, activeSetupId],
  )

  const handleLoadPreset = useCallback(
    (
      presetConfig: Omit<BoardSetupConfig, 'id' | 'name' | 'color'>,
      presetLabel: string,
    ) => {
      const existingColors = setups.map(s => s.color)
      const newSetup: BoardSetupConfig = {
        id: generateId(),
        name: presetLabel,
        color: nextColor(existingColors),
        ...presetConfig,
      }
      setSetups(prev => [...prev, newSetup])
      setActiveSetupId(newSetup.id)
    },
    [setups],
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-3 border-b border-gray-800 bg-gray-900">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Longboard Truck Simulator
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Interactive visualization of truck geometry and physics
        </p>
      </header>

      {/* Main two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Config Panel ── */}
        <aside className="w-96 flex-shrink-0 border-r border-gray-800 overflow-y-auto" data-testid="config-panel">
          <ConfigPanel
            setups={setups}
            activeSetupId={activeSetupId}
            riderParams={riderParams}
            steeringLeanAngleDeg={steeringLeanAngleDeg}
            onSetupChange={handleSetupChange}
            onSetupDuplicate={handleSetupDuplicate}
            onSetupDelete={handleSetupDelete}
            onActiveSetupChange={setActiveSetupId}
            onRiderParamsChange={setRiderParams}
            onSteeringLeanAngleChange={setSteeringLeanAngleDeg}
            onLoadPreset={handleLoadPreset}
          />
        </aside>

        {/* ── Right: Diagrams + Charts ── */}
        <main className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Header row with collapse toggle */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-400 ml-1">Truck Diagrams</h2>
            <button
              onClick={() => setTopViewCollapsed(!topViewCollapsed)}
              className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
              title={topViewCollapsed ? 'Show Top View (ICR)' : 'Hide Top View'}
            >
              {topViewCollapsed ? 'Show ICR ▶' : 'Hide ICR ▼'}
            </button>
          </div>

          {/* Row 1: SVG diagrams - keep Side/Front frame widths symmetric in both layouts */}
          <div ref={diagramsRowRef} className={`grid gap-1 ${topViewCollapsed ? 'grid-cols-2' : 'grid-cols-6'}`}>
            {/* Side View */}
            <div className={topViewCollapsed ? 'col-span-1 w-full' : 'col-span-2 w-full'}>
              <SideView
                truck={activeSetup.frontTruck}
                color={activeSetup.color}
                width={500}
                height={sharedViewHeightPx}
                pixelsPerMm={sharedPpm}
                groundOffsetPx={sharedGroundOffsetPx}
                boardThicknessMm={riderParams.boardThicknessMm}
              />
            </div>

            {/* Top View (ICR locus) - collapsible */}
            {!topViewCollapsed && (
              <div className="col-span-2 w-full">
                <TopView
                  setups={setups}
                  activeSetupId={activeSetupId}
                  width={500}
                  height={sharedViewHeightPx}
                  boardThicknessMm={riderParams.boardThicknessMm}
                  keyGeometryCurves={keyGeometryCurves}
                />
              </div>
            )}

            {/* Front View */}
            <div className={topViewCollapsed ? 'col-span-1 w-full' : 'col-span-2 w-full'}>
              <FrontView
                truck={activeSetup.frontTruck}
                color={activeSetup.color}
                width={500}
                height={sharedViewHeightPx}
                pixelsPerMm={sharedPpm}
                groundOffsetPx={sharedGroundOffsetPx}
                boardThicknessMm={riderParams.boardThicknessMm}
                keyGeometryCurves={keyGeometryCurves}
                leanAngleDeg={steeringLeanAngleDeg}
                onLeanAngleChange={setSteeringLeanAngleDeg}
              />
            </div>
          </div>

          {/* Row 2: Charts grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64">
              <LeanVsSteerChart
                setups={setups}
                riderMassKg={riderParams.massKg}
                comHeightM={riderParams.comHeightM}
                boardThicknessMm={riderParams.boardThicknessMm}
                activeSetupId={activeSetupId}
                keyGeometryCurves={keyGeometryCurves}
              />
            </div>
            <div className="h-64">
              <LeanVsRotationalStiffnessChart
                setups={setups}
                riderMassKg={riderParams.massKg}
                comHeightM={riderParams.comHeightM}
                boardThicknessMm={riderParams.boardThicknessMm}
                activeSetupId={activeSetupId}
                keyGeometryCurves={keyGeometryCurves}
              />
            </div>
            <div className="h-64">
              <SteeringMomentChart
                setups={setups}
                riderMassKg={riderParams.massKg}
                comHeightM={riderParams.comHeightM}
                boardThicknessMm={riderParams.boardThicknessMm}
                leanAngleDeg={steeringLeanAngleDeg}
                activeSetupId={activeSetupId}
                keyGeometryCurves={keyGeometryCurves}
              />
            </div>
            <div className="h-64">
              <LeanVsBushingTorqueChart
                setups={setups}
                riderMassKg={riderParams.massKg}
                comHeightM={riderParams.comHeightM}
                boardThicknessMm={riderParams.boardThicknessMm}
                activeSetupId={activeSetupId}
                keyGeometryCurves={keyGeometryCurves}
              />
            </div>
          </div>

          {/* Row 3: Turning geometry charts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64">
              <LeanVsTurningRadiusChart
                setups={setups}
                riderMassKg={riderParams.massKg}
                comHeightM={riderParams.comHeightM}
                boardThicknessMm={riderParams.boardThicknessMm}
                activeSetupId={activeSetupId}
                keyGeometryCurves={keyGeometryCurves}
              />
            </div>
            <div className="h-64">
              <LeanVsCentripetalAxisChart
                setups={setups}
                riderMassKg={riderParams.massKg}
                comHeightM={riderParams.comHeightM}
                boardThicknessMm={riderParams.boardThicknessMm}
                activeSetupId={activeSetupId}
                keyGeometryCurves={keyGeometryCurves}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
