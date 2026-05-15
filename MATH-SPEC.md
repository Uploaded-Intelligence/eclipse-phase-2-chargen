# Eclipse Phase 2 Character Creation — Math Specification

**Source of truth for Step 6 (Total Skills) and adjacent math.**
Every numbered claim below is asserted as a test in `test-spec.js`. Disagreements between this doc and the implementation are bugs — fix the implementation, not the doc.

Book references are to *Eclipse Phase: Second Edition* (Posthuman Studios, 2019), page numbers as printed.

---

## A. Skill points (Step 6)

### A1. Skill point sources
A character's pre-aptitude skill points come from:
- Background package (Step 1, p38–p41)
- Career package (Step 2, p42–p43)
- Interest package (Step 3, p44–p45)
- Faction (Step 4, p46) — grants `Know: [Faction Name] 30`
- Customization Points (Step 10, p46) — `1 CP = 5 skill points`

These are the ONLY pre-aptitude sources. CP-bought aptitude bumps modify aptitudes (which then add to skill totals), not skill points directly.

### A2. Active vs. Know skill pools
- Skill points are classified by destination skill: **Active** if the destination is an Active skill, **Know** if the destination is a Know skill.
- **Active points may be applied to Active OR Know skills.** (book p47)
- **Know points may ONLY be applied to Know skills.** (book p47)
- This is a one-way fungibility: active → either; know → know only.

### A3. Same-skill stacking and redistribution
- If the same `(skill, field)` is granted by multiple packages, its points either stack into that one skill OR can be redirected to any other skill of the player's choice. (book p47)
- More generally: "Players should feel free to switch their skills for any other skills as long as the number of points remains the same, and as long as Know skill points only go toward other Know skills." (book p47)
- **The total skill points (active and know separately) is conserved.** Redistribution doesn't create or destroy points.

### A4. Deferred field skills
- Field skills (`Hardware`, `Know`, `Medicine`, `Pilot`, `Exotic`) require a field choice (e.g. `Hardware: Robotics`). (book p48)
- The player may "leave the field unassigned for now and decide on it during game play" (book p38). This is the **deferred** state.
- **Each deferred slot is its own skill until named.** Multiple deferred slots from different sources do NOT aggregate into one mega-skill; they are distinct, each with its own value.
- When the player picks a field, the slot resolves to `(skillName, fieldName)`. If two slots resolve to the same `(skillName, fieldName)`, they stack per A3.

### A5. Aptitude bases
After all skill points are distributed, the linked aptitude's value is added to each skill total. (book p47)

- Aptitude × 1 for most skills.
- **Fray** and **Perceive** use aptitude × 2 instead. (book p47)

### A6. The 80 cap
- "No final skill total (including aptitude) may exceed 80." (book p47)
- If `(skill points) + (aptitude base) > 80`, the skill is capped at 80, and the over-cap points "must be applied to another skill of the player's choosing." (book p47)
- Know-point over-cap can only go to other Know skills; active-point over-cap can go to either.
- Final consequence: **no skill ends up above 80 at character creation.** The "must redirect" rule means there is no such thing as "wasted over-cap" at chargen — every point lands somewhere ≤ 80.

### A7. Customization Points contribution (Step 10, p46)
- Each `1 CP` spent on skills buys `5 skill points`.
- These are *new* skill points (not redistributed from packages). They are added to a chosen skill.
- The 80 cap applies (CP-bought skill points + package contribution + aptitude ≤ 80).
- The active/know distinction also applies: 1 CP can buy 5 of either type, declared at purchase.

---

## B. Derived state shape (specification, not implementation detail)

### B1. Slots
Every package skill grant produces one **slot** with:
- `source` — unique within the character; conventionally `"bg.{idx}"`, `"ca.{idx}"`, `"in.{idx}"`, `"fa.0"`, or `"custom.{N}"`
- `skillName` — e.g. `"Athletics"`, `"Know"`, `"Hardware"`
- `field` — `null` if not applicable, a string if assigned, the literal `null`/missing if deferred (NEVER the string `""` — that's a representation bug)
- `basePackagePts` — points from the originating package (immutable for package slots; 0 for custom slots)
- `reassigned` — points added (positive) or removed (negative) by the player; default 0

### B2. Custom slots
The player may create a slot for a skill not in any package (paying with CP or with redistributed surplus). Custom slots:
- Have `basePackagePts: 0`
- Have `reassigned >= 0` (all their points come from redistribution / CP)
- Are otherwise identical in shape to package slots

### B3. Slot effective value
`slot.effective = max(0, basePackagePts + reassigned)`. Cannot go negative — a slot at 0 with no contribution disappears from display.

### B4. Bucket aggregation (display only — never stored)
For display, slots are grouped by `(skillName, fieldDisplayKey)` where:
- For a slot with a resolved field: `fieldDisplayKey = fieldName`
- For a deferred slot: `fieldDisplayKey = "_deferred:{source}"` — UNIQUE per slot, so they don't collide

Per group: `groupPackagePts = sum(slot.effective for slots in group)`.

**Buckets are derived, not stored.** No persistent state keyed by bucket — only by slot. (This was the bug in the previous implementation.)

---

## C. Surplus pool (player-facing budget)

### C1. Initial surplus
Compute *before* any allocation:
- For each bucket, compute pre-allocation raw = `basePackagePts(bucket) + aptitude_base`
- If pre-allocation raw > 80: overflow = `raw - 80`
- `initialSurplus.active = sum(overflow over active buckets)`
- `initialSurplus.know = sum(overflow over know buckets)`

### C2. Spending
The player can move points from the surplus pool to any uncapped skill, subject to A2 (active→either, know→know-only).

### C3. Remaining surplus
`remaining.active = initialSurplus.active - active_points_spent_via_allocations`
`remaining.know = initialSurplus.know - know_points_spent_via_allocations`

### C4. Invariant: monotonic spending
Each `+5` allocation event (subject to A2 type rules and cap C5) MUST decrease `remaining` of the appropriate type by exactly 5. No allocation may INCREASE remaining (the positive-feedback bug class).

### C5. Cap enforcement on allocation
A `+5` allocation to a skill is allowed only if that skill's resulting total stays ≤ 80. If the skill is already at 80, the `+5` button is disabled. (Per A6's "must redirect to another skill.")

---

## D. Storage semantics (anti-corruption)

### D1. Allocations stored by slot, never by bucket
The persisted state stores reassignments against `slot.source` (a stable, unique slot ID like `"bg.5"`), NEVER against a derived bucket key like `"Know:Fine Art"`. Reason: if the player changes the field on slot `bg.5`, the allocation stays with the slot. If we keyed by bucket, the allocation would orphan.

### D2. No leaky synthetic keys
Internal aggregation helpers (e.g. unique keys for deferred slots) MUST NOT appear in: persisted state, JSON export, UI labels. They are computation-only.

### D3. Schema versioning + migration
Schema version 2 (this spec). Loaders detect older versions and migrate. JALTA's existing v1 save (with synthetic-keyed allocations) must load under v2 and produce a *semantically equivalent* character with no orphaned data.

---

## E. Known prior bugs (regression test mandates)

Each of these MUST have a permanent test:

1. **`appendChild(null)` blank page** (Pass 1) — render helpers that return "nothing" must return `DocumentFragment`, never `null`.
2. **Field information hidden behind `?` placeholder** (Pass 2) — cards show actual common-field options at decision time.
3. **Surplus positive-feedback loop** (Pass 3) — `+5` on a capped skill no longer regenerates surplus via over-cap spillover.
4. **Deferred-field bucket collision** (Pass 4) — three deferred Know slots produce three separate skills, not one mega-skill.
5. **Synthetic-key leak into allocations** (Pass 5 — current) — `+5` on a deferred slot stores the allocation against the *slot source*, not a synthetic bucket name; field-pick doesn't orphan the allocation.

---

## F. What this spec does NOT cover (out of scope)

- Step 5 aptitude template + redistribution (separate spec if needed)
- Step 10 customization beyond `cp.skillBumps` math (full CP economy is its own concern)
- Step 12 morph + MP economy (separate)
- Step 13 motivations (no math)
- Async / Psi / sleights (separate sub-system)
- Pool, derived stat formulas (book p37 — already tested in `test-hex.js`)
