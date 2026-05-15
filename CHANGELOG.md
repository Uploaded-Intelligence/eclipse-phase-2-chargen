# Changelog

All notable changes to this project. Format follows the spirit of [Keep a Changelog](https://keepachangelog.com/), versioned by milestone.

## [0.5.3] — 2026-05-16

### Fixed
- **Critical projection bug, latent since v0.3.** `studioPcFromState()` iterated `Object.keys(derived.finalSkills())` instead of `finalSkills().skills` — treating the structured return as a flat name→value map. Result: `pc.skills` was always empty, so the Studio sheet's Skills · Active / Skills · Knowledge sections showed "No skills allocated yet" for every character built since v0.3, regardless of actual skill state. Six verifier passes missed it because the empty-placeholder Section rendered cleanly and looked intentional. Now reads `fs.skills` array, skips deferred buckets, composes display name as `skill:field` or `skill`.

## [0.5.2] — 2026-05-16

### Added
- **Party-coverage 4-zone radar restored.** `buildStudioPartyCoverage(pc)` renders 4 zone tiles (combat / face / hacker / sci) with self + party union, threshold-colored labels (red <40, amber 40-59, green 60+), progress bars, and a status line ("✓ ALL 4 ZONES COVERED" or "⚠ N/4 zones at 60+ · gap: ..."). Engine `derived.partyCoverage()` survived v0.4 Wave 5's dead-code purge because exportJSON kept it alive; only the render was lost.

## [0.5.1] — 2026-05-15

### Fixed
- **Ware + morph-trait tooltips fire on hover.** `lookupTip()` cross-bucket slug-fallback now triggers for `cat === "ware"` and `cat === "morph_traits"`, not just `gear_items`.
- **Backstory bridges from chargen into the dossier.** `studioPcFromState`'s `backstory` projection now auto-populates from `narrative.backstoryAnswers` when the free-form `backstory` field is empty. Edits to the Studio BACKSTORY panel override the projection.
- **Review pane shows full backstory.** Dropped the 5-answer slice + 80-char truncation in `buildPreviewNarr` — backstory is deliberate narrative content; reviewing it deserves the full text.

### Changed
- **Play mode = full-window character sheet.** Toggling PLAY now hides the chargen wizard entirely (rail + step-view + narrative preview). The Studio sheet expands to fill the layout. Toggle CHARGEN restores the wizard with state intact. **Side benefit:** resolves the v0.5 Studio overflow where mechanical readouts were cramped to a 340px column. Combat-helper discoverability becomes a non-issue.

## [0.5] — 2026-05-15

### Changed
- **Sci-fi pivot.** Replaced Inter (humanist sans) with **Chakra Petch** (geometric sci-fi sans) for body + display, and **Share Tech Mono** for terminal labels + counters. Single-family Chakra Petch is legible at 13-15px body sizes while reading "post-Fall transhumanist" rather than space-opera.
- **Chargen vocabulary flipped to dark lore-tab.** The lifepath cards, buckets, morph cards, buttons, chips, inputs — all routed to a new `.lore-panel` + `.lore-tab` utility-class DNA that generalizes the existing `.gq` (Guiding Question) and `.why` (Why this matters) patterns. Diagonal-hatch corner reticules for the sci-fi signature. `.step-view` itself flips from white paper to a dark "console frame" gradient.

### Added
- `.lore-panel`, `.lore-panel--narrative`, `.lore-panel--morph` utility classes
- `.lore-tab::before` (protruding monospace tab via `data-tab-label` attribute)
- `.lore-corner-bl` / `.lore-corner-br` (diagonal-hatch reticule decoration)

### Preserved
- **Studio Section panels stay white paper** — they're the at-table instrument-readout vocabulary (vitals, skills, gear, reputation, pools, action economy). The deliberate split is: white paper = mechanical readout; dark lore-tab = narrative dossier.

## [0.4] — 2026-05-15

### Added
- **Portrait upload** in the Identity Hero. 96×120 slot with dashed teal placeholder, click-to-upload or drag-and-drop. FileReader → off-screen canvas → JPEG q=0.85 downscale to 400px longest edge → ~30-50KB dataURL → localStorage. Hover surfaces a `× CLEAR` button. Stays on-device.
- **BRIEF + BACKSTORY lore panels** below the gear row on the Studio sheet — protruding-tab dark panels (cyan + narrative-orange accents) with inline-editable bodies.
- **Session Notes** Section bound to `STATE.play.notes`.
- **`// DOSSIER · OFF-FEED` reticule divider** signals the channel switch from live mechanics to narrative content.
- **Schema v6** migration adds `ego.narrative.teamBrief` + `ego.narrative.backstory` (additive, no data loss; v5 saves auto-upgrade).

### Changed
- **Visual unification (initial attempt).** Wizard chrome → Studio command bar; rail → chevron-banner step buttons; step-view → white paper Section with teal top-border; cards / buttons / chips restyled to Studio's white-paper Section vocabulary.

### Note
- v0.4's choice to extend Studio's *white-paper Section* vocabulary to the chargen wizard was reversed in v0.5 — the chargen is narrative work and belongs to the *dark lore-tab* vocabulary instead. v0.5 keeps everything v0.4 added; only the visual identity changes.

## [0.3] — 2026-05-15

### Added
- **The Studio sheet — a designer-grade living character sheet** integrated from Claude Design. Banner with character name + morph + concept; identity panel with metadata grid; vital signs card (wounds, traumas, stress, lucidity); aptitude strip; pool meters; skills · active + skills · knowledge; gear by pack; reputation tiles with favor pips.
- **Live dice rolling** via `EP2.rollD100` + `EP2.evaluate` (00 auto-success, 99 auto-fail, doubles = crit). Click any skill row to roll. RollFlash modal shows the result with outcome badge + MoS.
- **Turn Coach** (combat scaffolding, play mode only): ModifierStrip (auto-applied wounds × -10 + traumas × -10 + status mods); ActionEconomy (COMPLEX / QUICK / MOVE tags + END TURN); BigBtns (ATTACK / DODGE / DODGE RANGED / PERCEIVE with auto-modifier baked in); PoolTactics (VIGOR / INSIGHT spend for extra action or take initiative); AttackPanel (weapon picker + range/mode/aim/cover/adhoc + live d100 target + ROLL ATTACK).
- **Roll Log** showing the last 12 rolls with outcome badges and MoS.
- **Initiative tracker** with round counter and position-in-order indicator.
- **StatusBar** for tracking conditions and their numeric modifiers.

### Schema v5
- Adds `play.woundsTaken` + `play.traumasTaken` (separate from raw `wounds` / `stress` totals), `play.recharge`, `play.notes`, `play.statuses[]`, `play.initiative`. Plus `ego.player`, `ego.muse`, `ego.quote`.

## [0.2] — 2026-05-15

### Added
- **Pedagogy as a first-class affordance.** Every step has a "Why this matters" callout. Every aptitude, skill, faction, morph, ware, and trait is tooltip-aware via `data-tip` + Lexicon overlay.
- **At-table state tracking.** Pool spends, wound + stress counters, mode toggle (CHARGEN ↔ PLAY).
- **Combat 101** reference panel for ranged + melee resolution flow.
- **Lexicon** modal opening from the chrome bar — searchable cross-reference of all rules entities.
- **Schema v4** with migrators chained from v1 forward.

### Deployed
- Vercel ship at https://ep2-chargen.vercel.app for beta playtesting.

## [0.1] — 2026-05-14 to 2026-05-15

### Added
- **Mechanical correctness.** Full chargen procedure (book p.38-49) implemented as a 13-step wizard. Lifepath → Aptitudes → Skills allocation with surplus tracking → Languages → Reputation → Customization (CP spend) → Morph + Gear.
- **`derived.finalSkills()` engine.** Slot allocations → buckets (resolved field, deferred field, no-field) → effective values → CP bumps → 80-cap → surplus tracking (active + knowledge separately).
- **`MATH-SPEC.md`** documents the §A1 through §C3 math (basePackagePts, allocation, effective, aptitude base, CP bumps, 80-cap, surplus, spent, wasted, overspent).
- **First test suite.** 50 assertions in test-hex (single-character math walk) + test-surplus (allocation accounting) + test-deferred-fields (multi-slot deferred Know).

────

For older private prototypes (before v0.1), see commit history in the parent workspace repo.
