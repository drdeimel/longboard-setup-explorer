/**
 * ConfigPanel component — scrollable list of named setups with parameter sliders.
 *
 * Provides:
 * - Setup list: color swatch, editable name, duplicate button, delete button
 * - Per-setup parameter sliders (front truck full set, rear truck minimal, wheelbase)
 * - Global rider parameters: rider mass, CoM height
 * - Preset configurations: Standard RKP 50°, Standard TKP, High-angle RKP 65°
 *
 * Invariants enforced here (per AGENTS.md §5):
 * - Delete is disabled (not hidden) when only 1 setup exists
 * - Confirms deletion when more than 3 setups exist
 */

import React, { useState } from 'react'
import type { BoardSetupConfig } from '../models/BoardSetupConfig'
import { DEFAULT_MAX_LEAN } from '../models/BoardSetupConfig'
import type { TruckConfig } from '../models/TruckConfig'
import type { RearTruckConfig } from '../models/RearTruckConfig'
import type { BushingConfig } from '../models/BushingConfig'

// ─────────────────────────────────────────────────────────────────────────────
// Preset configurations
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_STANDARD_RKP_50: Omit<BoardSetupConfig, 'id' | 'name' | 'color'> = {
  wheelbase: 760,
  frontTruck: {
    type: 'single-pivot',
    pivotAxisAngle: 50,
    rake: 0,
    axleToBaseplateDistance: 38,
    baseplateToBoard: 4,
    wheelDiameter: 150,
    trackWidth: 218,
    bushingMomentArm: 25,
    roadsideBushing: { shape: 'cone', durometer: 90, height: 'standard' },
    boardsideBushing: { shape: 'barrel', durometer: 90, height: 'standard' },
  },
  rearTruck: { pivotAxisAngle: 47, rake: 0 },
}

const PRESET_STANDARD_TKP: Omit<BoardSetupConfig, 'id' | 'name' | 'color'> = {
  wheelbase: 740,
  frontTruck: {
    type: 'single-pivot',
    pivotAxisAngle: 35,
    rake: 3,
    axleToBaseplateDistance: 32,
    baseplateToBoard: 3,
    wheelDiameter: 104,
    trackWidth: 205,
    bushingMomentArm: 20,
    roadsideBushing: { shape: 'barrel', durometer: 88, height: 'standard' },
    boardsideBushing: { shape: 'barrel', durometer: 88, height: 'standard' },
  },
  rearTruck: { pivotAxisAngle: 35, rake: 3 },
}

const PRESET_HIGH_ANGLE_RKP_65: Omit<BoardSetupConfig, 'id' | 'name' | 'color'> = {
  wheelbase: 720,
  frontTruck: {
    type: 'single-pivot',
    pivotAxisAngle: 65,
    rake: 0,
    axleToBaseplateDistance: 42,
    baseplateToBoard: 5,
    wheelDiameter: 160,
    trackWidth: 230,
    bushingMomentArm: 28,
    roadsideBushing: { shape: 'cone', durometer: 85, height: 'tall' },
    boardsideBushing: { shape: 'barrel', durometer: 85, height: 'standard' },
  },
  rearTruck: { pivotAxisAngle: 50, rake: 0 },
}

/** The three available preset configurations. */
export const PRESETS: Array<{
  label: string
  config: Omit<BoardSetupConfig, 'id' | 'name' | 'color'>
}> = [
  { label: 'Standard RKP 50°', config: PRESET_STANDARD_RKP_50 },
  { label: 'Standard TKP', config: PRESET_STANDARD_TKP },
  { label: 'High-angle RKP 65°', config: PRESET_HIGH_ANGLE_RKP_65 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Color palette for auto-assigning setup colors
// ─────────────────────────────────────────────────────────────────────────────

export const SETUP_COLORS = [
  '#ef4444', // red
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
]

/**
 * Given a list of existing setup colors, return the next color that isn't in use.
 * Cycles through the palette if all colors are taken.
 */
export function nextColor(existingColors: string[]): string {
  for (const c of SETUP_COLORS) {
    if (!existingColors.includes(c)) return c
  }
  // Cycle: use index mod palette size
  return SETUP_COLORS[existingColors.length % SETUP_COLORS.length]
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

/**
 * SliderRow — a labeled slider with numeric display and editable input field.
 */
const SliderRow: React.FC<SliderRowProps> = ({ label, value, min, max, step, unit, onChange }) => (
  <div className="flex items-center gap-2 py-1">
    <label className="text-slate-300 text-xs w-36 flex-shrink-0">{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer min-w-[80px] w-full"
      style={{ accentColor: '#94a3b8' }}
      onChange={e => onChange(Number(e.target.value))}
    />
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      className="text-slate-200 text-xs w-16 text-right flex-shrink-0 font-mono bg-transparent border border-slate-700 rounded px-1 py-0.5 focus:border-slate-500 focus:outline-none"
      onChange={e => {
        const num = Number(e.target.value)
        if (!isNaN(num) && num >= min && num <= max) {
          onChange(num)
        }
      }}
    />
    <span className="text-slate-300 text-xs w-6 flex-shrink-0">
      {unit ?? ''}
    </span>
  </div>
)

interface SelectRowProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

/**
 * SelectRow — a labeled dropdown.
 */
const SelectRow: React.FC<SelectRowProps> = ({ label, value, options, onChange }) => (
  <div className="flex items-center gap-2 py-1">
    <label className="text-slate-300 text-xs w-36 flex-shrink-0">{label}</label>
    <select
      value={value}
      className="flex-1 bg-slate-800 border border-slate-700 rounded text-slate-200 text-xs px-2 py-1 min-w-0"
      onChange={e => onChange(e.target.value)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </div>
)

/** Props for the BushingEditor sub-component. */
interface BushingEditorProps {
  label: string
  bushing: BushingConfig
  onChange: (b: BushingConfig) => void
}

/**
 * BushingEditor — inline editor for a single bushing configuration.
 */
const BushingEditor: React.FC<BushingEditorProps> = ({ label, bushing, onChange }) => (
  <div className="mb-1">
    <p className="text-slate-300 text-xs font-medium mb-1">{label}</p>
    <SelectRow
      label="  Shape"
      value={bushing.shape}
      options={[
        { value: 'barrel', label: 'Barrel' },
        { value: 'cone', label: 'Cone' },
      ]}
      onChange={v => onChange({ ...bushing, shape: v as BushingConfig['shape'] })}
    />
    <SliderRow
      label="  Durometer"
      value={bushing.durometer}
      min={60}
      max={100}
      step={1}
      unit="A"
      onChange={v => onChange({ ...bushing, durometer: v })}
    />
    <SelectRow
      label="  Height"
      value={bushing.height}
      options={[
        { value: 'standard', label: 'Standard' },
        { value: 'tall', label: 'Tall' },
      ]}
      onChange={v => onChange({ ...bushing, height: v as BushingConfig['height'] })}
    />
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Rider parameters
// ─────────────────────────────────────────────────────────────────────────────

/** Rider global parameters. */
export interface RiderParams {
  /** Rider mass in kg. */
  massKg: number
  /** Global board thickness in mm (used by SideView + FrontView). */
  boardThicknessMm: number
  /** Rider center-of-mass height above ground in m. */
  comHeightM: number
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfigPanel props
// ─────────────────────────────────────────────────────────────────────────────

/** Props for the ConfigPanel component. */
interface ConfigPanelProps {
  /** Current list of setups. */
  setups: BoardSetupConfig[]
  /** ID of the currently selected/active setup. */
  activeSetupId: string
  /** Rider global parameters. */
  riderParams: RiderParams
  /** Lean angle shown in SteeringMomentChart (editable here). */
  steeringLeanAngleDeg: number
  /** Called when a setup's parameters change. */
  onSetupChange: (updated: BoardSetupConfig) => void
  /** Called when a setup is duplicated. */
  onSetupDuplicate: (id: string) => void
  /** Called when a setup is deleted. */
  onSetupDelete: (id: string) => void
  /** Called when the active setup changes. */
  onActiveSetupChange: (id: string) => void
  /** Called when rider params change. */
  onRiderParamsChange: (params: RiderParams) => void
  /** Called when steering lean angle changes. */
  onSteeringLeanAngleChange: (deg: number) => void
  /** Called when a preset is loaded (creates a new setup from preset). */
  onLoadPreset: (presetConfig: Omit<BoardSetupConfig, 'id' | 'name' | 'color'>, presetLabel: string) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ConfigPanel component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ConfigPanel — scrollable configuration panel for all setups and global params.
 *
 * @param props - Setup list, active setup, rider params, and change handlers.
 * @returns Configuration panel UI.
 */
const ConfigPanel: React.FC<ConfigPanelProps> = ({
  setups,
  activeSetupId,
  riderParams,
  steeringLeanAngleDeg,
  onSetupChange,
  onSetupDuplicate,
  onSetupDelete,
  onActiveSetupChange,
  onRiderParamsChange,
  onSteeringLeanAngleChange,
  onLoadPreset,
}) => {
  const [expandedSetupId, setExpandedSetupId] = useState<string | null>(activeSetupId)

  /** Update a field on the front truck of a setup. */
  const updateFrontTruck = (setupId: string, patch: Partial<TruckConfig>) => {
    const setup = setups.find(s => s.id === setupId)
    if (!setup) return
    onSetupChange({
      ...setup,
      frontTruck: { ...setup.frontTruck, ...patch },
    })
  }

  /** Update a field on the rear truck of a setup. */
  const updateRearTruck = (setupId: string, patch: Partial<RearTruckConfig>) => {
    const setup = setups.find(s => s.id === setupId)
    if (!setup) return
    onSetupChange({
      ...setup,
      rearTruck: { ...setup.rearTruck, ...patch },
    })
  }

  /** Handle delete with guard: disabled at 1 setup, confirm at >3. */
  const handleDelete = (id: string) => {
    if (setups.length <= 1) return // Guard: should never reach due to disabled button
    if (setups.length > 3) {
      const setup = setups.find(s => s.id === id)
      if (!window.confirm(`Delete setup "${setup?.name ?? id}"? This cannot be undone.`)) return
    }
    onSetupDelete(id)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Configuration
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Presets ── */}
        <div className="px-3 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-300 uppercase tracking-wide mb-2">Instantiate from Library:</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                className="px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                onClick={() => onLoadPreset(preset.config, preset.label)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Setup List ── */}
        <div className="px-3 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-300 uppercase tracking-wide mb-2">Setups</p>
          <div className="space-y-1">
            {setups.map(setup => {
              const isExpanded = expandedSetupId === setup.id
              const isActive = setup.id === activeSetupId
              return (
                <div
                  key={setup.id}
                  className={`rounded border transition-colors ${
                    isActive
                      ? 'border-slate-600 bg-slate-800'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  {/* Setup header row */}
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    {/* Color swatch */}
                    <button
                      className="w-4 h-4 rounded-full flex-shrink-0 ring-1 ring-slate-600"
                      style={{ backgroundColor: setup.color }}
                      onClick={() => onActiveSetupChange(setup.id)}
                      title="Set as active setup"
                      aria-label={`Set ${setup.name} as active`}
                    />
                    {/* Name (editable) */}
                    <input
                      type="text"
                      value={setup.name}
                      className="flex-1 bg-transparent text-sm text-slate-200 min-w-0 outline-none focus:text-white"
                      onChange={e =>
                        onSetupChange({ ...setup, name: e.target.value })
                      }
                      onClick={() => onActiveSetupChange(setup.id)}
                      aria-label="Setup name"
                    />
                    {/* Expand/collapse toggle */}
                    <button
                      className="text-slate-300 hover:text-white text-xs px-1"
                      onClick={() => {
                        onActiveSetupChange(setup.id)
                        setExpandedSetupId(isExpanded ? null : setup.id)
                      }}
                      title="Expand/collapse parameters"
                    >
                      {isExpanded ? '▲' : '▼'}
                    </button>
                    {/* Duplicate */}
                    <button
                      className="text-slate-300 hover:text-blue-300 text-xs px-1 transition-colors"
                      onClick={() => onSetupDuplicate(setup.id)}
                      title="Duplicate this setup"
                    >
                      ⊕
                    </button>
                    {/* Delete — disabled when only 1 setup */}
                    <button
                      className={`text-xs px-1 transition-colors ${
                        setups.length <= 1
                          ? 'text-slate-700 cursor-not-allowed'
                          : 'text-slate-300 hover:text-red-300'
                      }`}
                      onClick={() => handleDelete(setup.id)}
                      disabled={setups.length <= 1}
                      title={
                        setups.length <= 1
                          ? 'Cannot delete the last setup'
                          : 'Delete this setup'
                      }
                    >
                      ✕
                    </button>
                  </div>

                  {/* Expandable parameter section */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-slate-800">
                      {/* Front truck geometry */}
                      <p className="text-slate-300 text-xs font-medium mt-3 mb-1">
                        Front Truck — Geometry
                      </p>
                      <SliderRow
                        label="Pivot axis angle α"
                        value={setup.frontTruck.pivotAxisAngle}
                        min={20}
                        max={75}
                        step={0.5}
                        unit="°"
                        onChange={v => updateFrontTruck(setup.id, { pivotAxisAngle: v })}
                      />
                      <SliderRow
                        label="Rake r"
                        value={setup.frontTruck.rake}
                        min={-15}
                        max={15}
                        step={0.5}
                        unit="mm"
                        onChange={v => updateFrontTruck(setup.id, { rake: v })}
                      />
                      <SliderRow
                        label="Axle-to-baseplate"
                        value={setup.frontTruck.axleToBaseplateDistance}
                        min={20}
                        max={70}
                        step={1}
                        unit="mm"
                        onChange={v => updateFrontTruck(setup.id, { axleToBaseplateDistance: v })}
                      />
                      <SliderRow
                        label="Baseplate-to-board"
                        value={setup.frontTruck.baseplateToBoard}
                        min={0}
                        max={20}
                        step={1}
                        unit="mm"
                        onChange={v => updateFrontTruck(setup.id, { baseplateToBoard: v })}
                      />
                      <SliderRow
                        label="Wheel diameter"
                        value={setup.frontTruck.wheelDiameter}
                        min={60}
                        max={240}
                        step={1}
                        unit="mm"
                        onChange={v => updateFrontTruck(setup.id, { wheelDiameter: v })}
                      />
                      <SliderRow
                        label="Track width"
                        value={setup.frontTruck.trackWidth}
                        min={150}
                        max={280}
                        step={1}
                        unit="mm"
                        onChange={v => updateFrontTruck(setup.id, { trackWidth: v })}
                      />
                      <SliderRow
                        label="Bushing moment arm"
                        value={setup.frontTruck.bushingMomentArm}
                        min={10}
                        max={50}
                        step={1}
                        unit="mm"
                        onChange={v => updateFrontTruck(setup.id, { bushingMomentArm: v })}
                      />

                      {/* Front truck bushings */}
                      <p className="text-slate-300 text-xs font-medium mt-3 mb-1">
                        Front Truck — Bushings
                      </p>
                      <BushingEditor
                        label="Roadside Bushing"
                        bushing={setup.frontTruck.roadsideBushing}
                        onChange={b => updateFrontTruck(setup.id, { roadsideBushing: b })}
                      />
                      <BushingEditor
                        label="Boardside Bushing"
                        bushing={setup.frontTruck.boardsideBushing}
                        onChange={b => updateFrontTruck(setup.id, { boardsideBushing: b })}
                      />

                      {/* Rear truck */}
                      <p className="text-slate-300 text-xs font-medium mt-3 mb-1">
                        Rear Truck
                      </p>
                      <SliderRow
                        label="Wheelbase"
                        value={setup.wheelbase}
                        min={400}
                        max={1100}
                        step={5}
                        unit="mm"
                        onChange={v => onSetupChange({ ...setup, wheelbase: v })}
                      />
                      <SliderRow
                        label="Pivot axis angle α"
                        value={setup.rearTruck.pivotAxisAngle}
                        min={20}
                        max={75}
                        step={0.5}
                        unit="°"
                        onChange={v => updateRearTruck(setup.id, { pivotAxisAngle: v })}
                      />
                      <SliderRow
                        label="Rake r"
                        value={setup.rearTruck.rake}
                        min={-15}
                        max={15}
                        step={0.5}
                        unit="mm"
                        onChange={v => updateRearTruck(setup.id, { rake: v })}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Global Rider Parameters ── */}
        <div className="px-3 py-3 border-b border-slate-800">
          <p className="text-xs text-slate-300 uppercase tracking-wide mb-2">Rider (Global)</p>
          <SliderRow
            label="Mass"
            value={riderParams.massKg}
            min={0}
            max={150}
            step={1}
            unit="kg"
            onChange={v => onRiderParamsChange({ ...riderParams, massKg: v })}
          />
          <SliderRow
            label="Board thickness"
            value={riderParams.boardThicknessMm}
            min={1}
            max={30}
            step={0.5}
            unit="mm"
            onChange={v => onRiderParamsChange({ ...riderParams, boardThicknessMm: v })}
          />

        </div>

        {/* ── Chart Controls ── */}
        <div className="px-3 py-3">
          <p className="text-xs text-slate-300 uppercase tracking-wide mb-2">Chart Controls</p>
          <SliderRow
            label="Steering chart lean"
            value={steeringLeanAngleDeg}
            min={-DEFAULT_MAX_LEAN}
            max={DEFAULT_MAX_LEAN}
            step={1}
            unit="°"
            onChange={onSteeringLeanAngleChange}
          />
        </div>
      </div>
    </div>
  )
}

export default ConfigPanel
