# Mechanics Computation Issues

Comprehensive review of all mechanics-related computations in the codebase. Issues are listed by severity, followed by detailed descriptions with source references.

---

## Terse Issue List

| # | Severity | File(s) | Summary |
|---|----------|---------|---------|
| 1 | CRITICAL | `keyGeometryDataSet.ts`, `returnMoment.ts` | `+` instead of `*` in Euclidean distance formula |
| 2 | CRITICAL | `turningCenter.ts` | ICR / curvature formula is incorrect — does not match bicycle model |
| 3 | MAJOR | `keyGeometryDataSet.ts` | Spurious `×1000` factor in `centerOfForceZ` — unit confusion |
| 4 | MAJOR | `returnMoment.ts` | `centerOfBoardY` / `centerOfBoardZ` assignments are swapped |
| 5 | MAJOR | `returnMoment.ts` vs `keyGeometryDataSet.ts` | `invPendulumHeight` formula differs between the two files |
| 6 | MAJOR | `keyGeometryDataSet.ts` | `weightGeometricStiffness` computed but commented out of `totalRotationalStiffness` |
| 7 | MAJOR | `keyGeometryDataSet.ts` | Division by zero in `horizontalStiffness` at zero lean |
| 8 | MAJOR | `keyGeometryDataSet.ts`, `returnMoment.ts` | `weightGeometricStiffness` formulas differ (sin vs cos, ÷1000 disagreement) |
| 9 | MODERATE | `geometry.test.ts`, `physics.test.ts` | Tests reference non-existent exports and stale field names |
| 10 | MODERATE | `returnMoment.ts`, `keyGeometryDataSet.ts` | Duplicate `computeKeyGeometry` with diverging logic |
| 11 | MODERATE | `bushingModels.ts` | Barrel and cone `K_*_REFERENCE` constants are identical — test expects barrel > cone |
| 12 | MODERATE | `bushingModels.ts` | Bottoming-out torque entirely disabled (`//+ bottomOutTorque`) |
| 13 | MODERATE | `rotationAxisDist.ts` | Conceptually wrong metric — not the correct moment arm for lateral force torque |
| 14 | MINOR | `keyGeometryDataSet.ts` | `computeRotationAxisDist` called but result unused — dead computation |
| 15 | MINOR | `bushingModels.ts` | `bushingStiffness` uses numerical differentiation when analytical derivative is available |
| 16 | MINOR | `bushingModels.ts` | Undocumented magic constant `25.4/4.0` in torque formulas |
| 17 | MINOR | `keyGeometryDataSet.ts`, `returnMoment.ts` | Variable `bushingTorqueNm` is in N·mm, not N·m — misleading name |
| 18 | MINOR | `leanToSteer.ts` | Comment sign error: says `θ = -φ₀ ± …` but code correctly uses `+φ₀` |
| 19 | SIMPLIFICATION | multiple | Center-of-force framework is over-complicated — virtual-work approach would be simpler and less error-prone |

---

## Detailed Descriptions

---

### ISSUE 1 — `+` instead of `*` in Euclidean distance (CRITICAL)

**Files:**
- [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:186)
- [`returnMoment.ts`](../src/physics/returnMoment.ts:150)

**Description:**

The Euclidean magnitude formula `sqrt(y² + z²)` is written with addition instead of multiplication for the second term:

```ts
// keyGeometryDataSet.ts:186
const centerOfForceRadius = Math.sqrt(
  centerOfForceY * centerOfForceY + centerOfForceZ + centerOfForceZ
)
```

`centerOfForceZ + centerOfForceZ` evaluates to `2 × centerOfForceZ` (a linear term), not `centerOfForceZ²` (a squared term). The same typo appears identically in [`returnMoment.ts:150`](../src/physics/returnMoment.ts:150).

**Correct form:**
```ts
const centerOfForceRadius = Math.sqrt(
  centerOfForceY * centerOfForceY + centerOfForceZ * centerOfForceZ
)
```

**Impact:** `centerOfForceRadius` is used downstream in `weightGeometricStiffness` (though currently commented out). Once the weight stiffness is re-enabled, this bug will produce incorrect gravity coupling at every non-zero lean angle.

---

### ISSUE 2 — ICR / curvature formula is incorrect (CRITICAL)

**File:** [`turningCenter.ts`](../src/geometry/turningCenter.ts:137)

**Description:**

The code computes the turning curvature and ICR position using an ad-hoc formula that does not match the standard bicycle model:

```ts
// turningCenter.ts:137-142
const cc = Math.cos(δFRad) / Math.cos(δRRad)
const icrX = wheelbase * cc / (1 + cc)
const turningCurvature = Math.tan(δFRad) / icrX
const icrZ = 1 / turningCurvature
```

**Correct bicycle-model formulas:**

The two-axle kinematic model gives the turning curvature as:

```
κ = (tan δ_F − tan δ_R) / L
```

and the ICR coordinates (origin at front axle) as:

```
Z_icr = −L cos δ_R cos δ_F / sin(δ_F − δ_R)
X_icr = Z_icr × tan δ_F
```

**Numerical comparison (δ_F = 30°, δ_R = 20°, L = 760 mm):**

| Quantity | Code result | Correct result |
|----------|-------------|----------------|
| `icrX` | +364 mm | −2056 mm |
| `turningCurvature` | 1.59 × 10⁻³ /mm | 2.81 × 10⁻⁴ /mm |
| `icrZ` | +631 mm | −3559 mm |

The values differ by roughly an order of magnitude and have the wrong sign.

**Special case — symmetric trucks (δ_F = δ_R):**

The correct curvature is 0 (straight line, ICR at infinity). The code produces a finite curvature `2 tan δ / L`, giving a nonsensical finite turning radius for a crabbing board.

**Impact:** All ICR-related charts and the TopView ICR locus are wrong. The turning radius chart ([`LeanVsTurningRadiusChart.tsx`](../src/components/LeanVsTurningRadiusChart.tsx:94)) and centripetal axis chart ([`LeanVsCentripetalAxisChart.tsx`](../src/components/LeanVsCentripetalAxisChart.tsx:91)) display incorrect values.

---

### ISSUE 3 — Spurious ×1000 factor in `centerOfForceZ` (MAJOR)

**File:** [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:183)

**Description:**

```ts
// keyGeometryDataSet.ts:183
const centerOfForceZ = -bushingTorqueNm * (1000 / riderForce)
```

The variable `bushingTorqueNm` is produced by [`combinedBushingTorque()`](../src/physics/bushingModels.ts:190) which returns torque in **N·mm** (per its JSDoc and the units of `K_BARREL_REFERENCE`). `riderForce` is in **N**. The lateral offset of the equivalent force should be:

```
offset_mm = torque_Nmm / force_N = N·mm / N = mm
```

Multiplying by `1000` produces an offset 1000× too large. Dimensional analysis: `(N·mm) × (1000 / N) = 1000 mm²/N × N = 1000 mm`, which is not dimensionally consistent.

If the intent were to convert from N·m to mm, the factor would be correct — but the upstream value is already in N·mm. The variable name `bushingTorqueNm` is misleading (see Issue 17).

**Impact:** `centerOfForceZ` is 1000× too large, which corrupts `centerOfForceY`, `centerOfForceAngle`, `centerOfForceRadius`, `weightGeometricStiffness`, and `horizontalStiffness`. Every downstream quantity in the key geometry result is wrong.

---

### ISSUE 4 — Y/Z swap in `returnMoment.ts` (MAJOR)

**File:** [`returnMoment.ts`](../src/physics/returnMoment.ts:145)

**Description:**

```ts
// returnMoment.ts:145-146
const centerOfBoardY = invPendulumHeight * Math.sin(leanRad)
const centerOfBoardZ = invPendulumHeight * Math.cos(leanRad)
```

At zero lean (`leanRad = 0`): `sin(0) = 0`, `cos(0) = 1`, so `centerOfBoardY = 0` and `centerOfBoardZ = height`. This means the board center is at lateral position Z = height when upright, and at vertical position Y = 0. This is physically wrong — at zero lean the board center should be directly above the axle (Y = height, Z = 0).

The corrected [`keyGeometryDataSet.ts:181-182`](../src/physics/keyGeometryDataSet.ts:181) has the assignments the right way around:

```ts
// keyGeometryDataSet.ts:181-182 (correct)
const centerOfBoardZ = invPendulumHeight * Math.sin(leanRad)
const centerOfBoardY = invPendulumHeight * Math.cos(leanRad)
```

**Impact:** `returnMoment.ts` is the stale copy (see Issue 10), so this only matters if its `computeKeyGeometry` is called. Currently the tests import from `keyGeometryDataSet.ts`.

---

### ISSUE 5 — `invPendulumHeight` formula differs between files (MAJOR)

**Files:**
- [`returnMoment.ts`](../src/physics/returnMoment.ts:141): `axleToBaseplateDistance + rake / cos(α)`
- [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:153): `axleToBaseplateDistance + baseplateToBoard − rake / cos(α)`

**Description:**

Three discrepancies:

1. **`baseplateToBoard` missing** in `returnMoment.ts`. The board surface height above the axle is `axleToBaseplateDistance + baseplateToBoard`, but `returnMoment.ts` omits the second term.

2. **Rake sign flipped.** `returnMoment.ts` uses `+ rake/cos(α)` (positive rake increases height), while `keyGeometryDataSet.ts` uses `− rake/cos(α)` (positive rake decreases height).

3. **Physical meaning.** The term `rake / cos(α)` represents the Y-intercept of the pivot axis: the height where the axis crosses the vertical line through the axle center. Geometrically, for a positive-rake truck, the pivot axis passes *forward and above* the axle, so the effective pivot point is *higher* than the axle. Thus `invPendulumHeight` (the pendulum arm from pivot to board surface) should be:

   ```
   h_pend = (axleToBaseplateDistance + baseplateToBoard) − rake / cos(α)
   ```

   The `keyGeometryDataSet.ts` formula matches this derivation. The `returnMoment.ts` formula is wrong on all three counts.

**Impact:** Wrong pendulum arm length corrupts `centerOfBoard*`, which propagates to all derived quantities.

---

### ISSUE 6 — `weightGeometricStiffness` commented out (MAJOR)

**File:** [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:193)

```ts
const totalRotationalStiffness = bushingStiffness //+ weightGeometricStiffness
```

The gravity coupling (inverted pendulum destabilizing effect) is computed on [line 187](../src/physics/keyGeometryDataSet.ts:187) but then not included in the final stiffness. This means `totalRotationalStiffness` is just the bushing stiffness, ignoring the rider's weight entirely. The UI chart title "Bushing Stiffness" ([`LeanVsRotationalStiffnessChart.tsx:109`](../src/components/LeanVsRotationalStiffnessChart.tsx:109)) partially reflects this, but the intent (per the `returnMoment.ts` header comments and `plan.md` formula) was a combined stiffness.

**Note:** Even if uncommented, the `weightGeometricStiffness` value is wrong due to Issues 1, 3, and 8.

---

### ISSUE 7 — Division by zero in `horizontalStiffness` (MAJOR)

**File:** [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:195)

```ts
const horizontalStiffness = totalRotationalStiffness / centerOfForceZ
```

At zero lean: `centerOfForceZ = -bushingTorqueNm × (1000 / riderForce)`. Since `bushingTorqueNm = 0` at zero lean (hanger rotation is 0 → bushing torque is 0), `centerOfForceZ = 0`. Division by zero yields `±Infinity` or `NaN`.

This value is stored in the result and may propagate to charts or derived parameters if they consume `horizontalStiffness`.

---

### ISSUE 8 — `weightGeometricStiffness` formulas disagree (MAJOR)

**Files:**
- [`returnMoment.ts`](../src/physics/returnMoment.ts:151): `−centerOfForceRadius × riderForce × sin(centerOfForceAngle)`
- [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:187): `−cos(centerOfForceAngle) × |centerOfForceZ| × riderForce / 1000`

Two implementations of the same concept use `sin` vs `cos`, use `radius` vs `|z|`, and one has a `/1000` factor while the other does not. Both are downstream of the broken `centerOfForceRadius` (Issue 1) and `centerOfForceZ` (Issue 3), so both are wrong in different ways.

Neither formula cleanly expresses the standard gravity destabilization moment: `M_grav = m × g × h_eff × sin(φ)`, where `h_eff` is the perpendicular distance from the pivot axis to the rider's center of mass projected onto the lever arm direction.

---

### ISSUE 9 — Stale test file references (MODERATE)

**File:** [`geometry.test.ts`](../src/geometry/__tests__/geometry.test.ts:19)

**Description:**

- [Line 19](../src/geometry/__tests__/geometry.test.ts:19) imports `icrLocus` from `../turningCenter`, but [`turningCenter.ts`](../src/geometry/turningCenter.ts) does not export any function named `icrLocus`.
- [Line 273](../src/geometry/__tests__/geometry.test.ts:273) accesses `result.turningRadiusMm`, but the [`ICRResult`](../src/geometry/turningCenter.ts:41) interface has `turningCurvature`, not `turningRadiusMm`.
- The test for symmetric trucks ([line 282-289](../src/geometry/__tests__/geometry.test.ts:282)) expects `icr.z ≈ 0`, but with the current code symmetric trucks produce a finite non-zero `icrZ`.

These tests likely do not compile or pass with the current source code.

---

### ISSUE 10 — Duplicate `computeKeyGeometry` implementations (MODERATE)

**Files:**
- [`returnMoment.ts`](../src/physics/returnMoment.ts:105) — older version
- [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:130) — newer version with ICR and precomputed invariants

Both files export a function named `computeKeyGeometry` and a corresponding interface `KeyGeometryResult`. They have diverging formulas for `invPendulumHeight`, `centerOfBoard*`, `centerOfForce*`, and `weightGeometricStiffness`. The test file imports from `keyGeometryDataSet`, making `returnMoment.ts` effectively dead code. It should be removed or consolidated to avoid confusion.

---

### ISSUE 11 — Barrel/cone reference stiffness constants are identical (MODERATE)

**File:** [`bushingModels.ts`](../src/physics/bushingModels.ts:30)

```ts
const K_BARREL_REFERENCE = 0.3  // N·mm per degree at 90A
const K_CONE_REFERENCE   = 0.3  // N·mm per degree at 90A (base)
```

The test at [`physics.test.ts:86-89`](../src/physics/__tests__/physics.test.ts:86) expects:

```ts
expect(bushingBaseStiffness(barrelStd)).toBeGreaterThan(bushingBaseStiffness(coneStd))
```

This asserts `barrel > cone`, but with `K_BARREL = K_CONE = 0.3` and the same durometer exponent, `bushingBaseStiffness` returns identical values for both shapes. This test will fail.

---

### ISSUE 12 — Bottoming-out torque disabled (MODERATE)

**File:** [`bushingModels.ts`](../src/physics/bushingModels.ts:152)

```ts
return baseTorque //+ bottomOutTorque
```

The bottoming-out exponential stiffening curve is entirely commented out. The `bushingMaxAngle` function ([line 105](../src/physics/bushingModels.ts:105)) and the associated constants (`STANDARD_MAX_ANGLE_DEG`, `TALL_MAX_ANGLE_DEG`) still exist but have no effect on the torque output. The test at [`physics.test.ts:152-160`](../src/physics/__tests__/physics.test.ts:152) checks for "torque increases sharply beyond max angle" — this test implicitly passes because the cubic term still increases, but there is no *disproportionate* stiffening beyond the limit.

---

### ISSUE 13 — `rotationAxisDist` computes wrong physical quantity (MODERATE)

**File:** [`rotationAxisDist.ts`](../src/geometry/rotationAxisDist.ts:84)

**Description:**

The function's doc says it computes *"perpendicular distance from the pivot axis line to the board surface plane."* For a typical truck geometry the pivot axis is **not** parallel to the board plane — it intersects it. The perpendicular distance from a line to a plane it intersects is **zero**.

The code handles this in the `else` branch ([line 127-157](../src/geometry/rotationAxisDist.ts:127)) by finding the intersection point, then computing the in-plane distance from the intersection to the board center. This is a different quantity from what the name and docs describe, and it is also not the correct moment arm for the lateral force → steering torque computation in [`lateralForce.ts`](../src/physics/lateralForce.ts:68).

The correct quantity for the steering torque due to a lateral force F at point P about the pivot axis is:

```
M_axis = n̂ · (r × F)
```

where `n̂` is the axis direction, `r = P − Q` for any point Q on the axis, and `F` is the force vector. This scalar triple product is not equivalent to a simple "distance" metric.

---

### ISSUE 14 — Dead `computeRotationAxisDist` call (MINOR)

**File:** [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:168)

```ts
const rotationAxisDist = computeRotationAxisDist(
  pivotAxisAngleDeg, rake, axleToBaseplateDistance, baseplateToBoard, leanAngleDeg,
)
```

The return value `rotationAxisDist` is never referenced after this line. The function call is wasted computation executed for every sample point of every curve generation.

---

### ISSUE 15 — Numerical differentiation for `bushingStiffness` (MINOR)

**File:** [`bushingModels.ts`](../src/physics/bushingModels.ts:161)

```ts
export function bushingStiffness(config: BushingConfig, angleDeg: number): number {
  const delta_angle = 0.1
  const torque_a = bushingTorque(config, angleDeg - 0.5 * delta_angle)
  const torque_b = bushingTorque(config, angleDeg + 0.5 * delta_angle)
  return (torque_b - torque_a) / delta_angle
}
```

The bushing torque formula is fully analytical (polynomial in θ). An exact closed-form derivative is straightforward:

For barrel: `dM/dθ = k' × (1 + 3 c_b θ²)` where `k'` includes the `25.4/4.0` factor.

Using a central difference with `Δθ=0.1°` introduces ~10⁻⁶ relative error per evaluation, which is harmless but unnecessary.

---

### ISSUE 16 — Undocumented magic constant `25.4 / 4.0` (MINOR)

**File:** [`bushingModels.ts`](../src/physics/bushingModels.ts:141)

```ts
baseTorque = (25.4 / 4.0) * k * θ * (1 + BARREL_CUBIC_COEFFICIENT * θ * θ)
```

`25.4` is mm per inch, suggesting a conversion from imperial units. `4.0` might be 4 bushings per board or a quarter-inch reference. This constant (= 6.35) multiplies the entire torque output but is not documented anywhere — neither in code comments, JSDoc, nor `plan.md`.

---

### ISSUE 17 — Misleading variable name `bushingTorqueNm` (MINOR)

**Files:**
- [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:80) (interface field)
- [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts:161) (assignment)
- [`returnMoment.ts`](../src/physics/returnMoment.ts:79)

The field `bushingTorqueNm` strongly implies the unit is Newton-meters. However, the value is produced by [`combinedBushingTorque()`](../src/physics/bushingModels.ts:190) which, per its JSDoc and the base stiffness constant `K_*_REFERENCE` (documented as N·mm/degree), returns a value in **N·mm**.

The [`LeanVsBushingTorqueChart`](../src/components/LeanVsBushingTorqueChart.tsx:93) displays it with the label "N·m", amplifying the confusion. If the actual unit is N·mm, the chart is off by a factor of 1000, or if someone "fixes" the ×1000 in Issue 3 without renaming the variable, the inconsistency will persist.

---

### ISSUE 18 — Comment sign error in lean-to-steer solver (MINOR)

**File:** [`leanToSteer.ts`](../src/geometry/leanToSteer.ts:108)

```ts
// Solutions: θ = -φ0 ± acos(-C/R) [or equivalently: atan2(B,A) ± acos(-C/R)]
```

The first form says `θ = −φ₀ ± acos(…)` but the second says `θ = atan2(B,A) ± acos(…)`. Since `φ₀ = atan2(B, A)`, these are contradictory (one negates, the other doesn't). The **code** on [lines 129-130](../src/geometry/leanToSteer.ts:129) is correct:

```ts
const θ1 = phi0 + offset   // = +atan2(B,A) + acos(−C/R)
const θ2 = phi0 - offset   // = +atan2(B,A) − acos(−C/R)
```

Only the comment is wrong.

---

### ISSUE 19 — Framework simplification: virtual work approach (SIMPLIFICATION)

**Files:** [`keyGeometryDataSet.ts`](../src/physics/keyGeometryDataSet.ts), [`returnMoment.ts`](../src/physics/returnMoment.ts), [`rotationAxisDist.ts`](../src/geometry/rotationAxisDist.ts), [`lateralForce.ts`](../src/physics/lateralForce.ts)

**Description:**

The current code attempts to determine stability by constructing a "center of force" position in 2D space, computing its distance and angle from the axle center, then deriving a "geometric stiffness" via trigonometric projections. This approach requires:

- `centerOfBoardY`, `centerOfBoardZ` (circular-arc projection)
- `centerOfForceY`, `centerOfForceZ` (bushing torque mapped to an equivalent force offset)
- `centerOfForceAngle`, `centerOfForceRadius` (polar decomposition)
- `weightGeometricStiffness` (recomposed trig projection)

This chain involves 6+ intermediate quantities, each with opportunities for sign/unit mistakes — and indeed Issues 1, 3, 4, 5, 7, 8 all originate from this complexity.

**Proposed alternative — virtual work / direct torque-balance:**

All physically relevant quantities can be computed as **torques about the pivot axis** directly:

1. **Bushing restoring torque:** `M_bushing(θ(φ))` — already computed correctly.
2. **Gravitational destabilizing torque about the pivot axis:**
   ```
   M_grav(φ) = −m g × d_perp(φ)
   ```
   where `d_perp(φ)` is the signed perpendicular distance from the rider's center of gravity to the pivot axis line, projected onto the board-normal direction. This is a single scalar triple product `n̂_axis · ((CoG − P_axis) × ĝ)` evaluated in the leaned frame.
3. **Net restoring torque:** `M_net(φ) = M_bushing(θ(φ)) + M_grav(φ)`
4. **Rotational stiffness:** `K(φ) = dM_net/dφ` — either analytically or by numerical differentiation of the above.

This approach:

- Eliminates the center-of-force position concept entirely
- Uses the same 3D rotation machinery already proven in [`leanToSteer.ts`](../src/geometry/leanToSteer.ts)
- Reduces the number of intermediate quantities from ~8 to ~2
- Makes the formula directly verifiable against textbook inverted-pendulum models
- Fixes Issues 1, 3, 4, 5, 7, 8 by construction (they become impossible)

The [`rotationAxisDist.ts`](../src/geometry/rotationAxisDist.ts) module would also become unnecessary — the perpendicular distance from the pivot axis to any external force application point is just part of the scalar triple product, computed inline.

The lateral force steering moment in [`lateralForce.ts`](../src/physics/lateralForce.ts) would similarly reduce to a single scalar triple product: `M_steer = n̂_axis · ( (P_force − P_axis) × F_lat )`, which correctly handles the 3D geometry without needing a separate "effective distance" abstraction.
