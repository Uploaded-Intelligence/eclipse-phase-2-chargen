# Changelog

All notable changes to this project. Format follows the spirit of [Keep a Changelog](https://keepachangelog.com/), versioned by milestone.

## [0.7] — 2026-05-16 — "Constellation"

The party becomes visible. Sharing becomes one click. The GM gets a Command Centre.

### Added — Sharing (four mechanisms, each for a different context)
- **URL share link** (`#share=<lz-base64>`). Vendored LZ-string compresses the entire character into a URL fragment. Typical: ~4KB without portrait, ~10-15KB with. Click button → URL on clipboard → paste in Discord/anywhere → recipient clicks → app prompts "Sara wants to join your party: [Add to Party] [Replace] [Dismiss]".
- **QR code modal**. Vendored qr-creator renders the share-link URL as a scannable QR for at-table phone scanning. Auto-strips portrait if URL exceeds QR capacity (~2.3KB at ECC M).
- **Push Live** (Vercel KV backend). Player clicks "Push Live Update" → state stored on Vercel KV under anonymous UUID, 30-day TTL → returns `?live=<id>` URL. GM opens URL once, then their Party Page polls every 30s for updates. Unidirectional: player → GM. Manual push (intentional, low-quota).
- **File export/import** (preserved). Original Export/Import/Load Party file flow remains for archival + offline use.
- **Auto-import flow**. On page load, if URL has `#share=` or `?live=`, app shows the import-prompt modal automatically.

### Added — Party Page · GM Command Centre
- **New `Party` mode** in chrome bar (Chargen / Play / Party). Hides chargen + Studio sheet (v0.5.1 full-window pattern); shows party-page grid.
- **Member cards** for self + each `STATE.partyImports[i]`: name, morph badge, source pill (`FILE`/`LINK`/`QR`/`LIVE`/`YOU`), concept, lifepath, aptitudes, top 5 skills, 4-zone coverage badges, vitals (wounds/stress), "updated 23s ago" timestamps. Self card distinguished by green border; live members get pulsing 🟢 LIVE badge.
- **4-zone party-coverage radar** at the top (reuses `buildStudioPartyCoverage`).
- **GM Tracking overlay** per imported member: inline +/- wound and stress controls, initiative input + per-card "Roll" button (d10 + REF), GM-private notes textarea. Edits write to `STATE.partyImports[i].gmNotes` — never pushed back to the player. Initiative-sorted view: cards reorder by current initiative.
- **Per-card actions**: `↻ Refresh` (force-poll for live members), `↗ Share` (self), `✕ Remove`.
- **Header actions**: 🎲 Roll Initiative · All, + Add Member (file).
- **Empty state**: friendly prompt with "↗ Share Your Character" button to bootstrap a session.

### Added — Schema v7 (additive, forward-compatible for full live-sync)
- `STATE.ego.characterId` — UUID generated on first share. Stable identity across re-shares enables identity-based de-dup (re-importing same character updates `.full`, preserves `gmNotes`).
- `STATE.ego.liveShareUrl` — last pushed `?live=` URL so player can recopy without re-pushing.
- `STATE.partyImports[i]` gains: `id` (matches source character's `characterId`), `source` (`file`/`url`/`qr`/`live`), `lastSyncedAt` (ISO timestamp), `gmNotes` (wounds/stress/initiative/statusEffects/notes — GM-local overlay), `syncUrl` (for live polling).
- `migrateV6ToV7` chained into `migrateToCurrent`. All v6 saves auto-upgrade. Idempotent.

### Added — Live-sync backend
- **`api/share/[id].js`** — Vercel serverless function. GET/POST/DELETE on Vercel KV with 30-day TTL, 200KB payload ceiling, ID pattern validation `/^[a-zA-Z0-9_-]{8,64}$/`, anonymous (no auth — the UUID is the access token, same trust model as URL share). CORS-enabled.
- **`package.json`** — declares `@vercel/kv` dependency. Vercel autoinstalls during build.
- **Live polling client** — `startPartyPolling()` runs while in Party mode, polls each live member's URL every 30s, updates `.full` if `updatedAt` changed. Aborts cleanly on mode-switch (saves quota, saves mobile battery). Toast on each update.
- **One-time user action required to enable**: Vercel dashboard → Storage → Create KV → bind to project. ~2 minutes. Until then, "Push Live" button shows toast "Live push failed — try Copy Link instead" and gracefully degrades. Snapshot/QR/file all work independently.

### Added — Tests
- `test-share-party.js` — 47 new assertions covering: schema v7 fields, LZ-string compression round-trip, encodeShareUrl/decodeShareUrl round-trip, stripPortrait integrity, makeCharacterId uniqueness, migrateV6ToV7 (partyImports get gmNotes shape), **identity-based de-dup preserves gmNotes** (the key party-page invariant — GM marks wounds, player re-shares, wounds survive), source-field flow, URL size budgets.
- `test-play-state.js` updated for SCHEMA_VERSION === 7, added v6→v7 migration + makeCharacterId assertions.

### Total counts
- **45 morphs** (unchanged from v0.6)
- **406 test assertions** (was 359) — `test-share-party.js` adds 47, `test-play-state.js` adds 2
- **Total `index.html` size**: ~625KB (vendored libs ~17KB; Party Page + GM Centre + share infra ~25KB)

### Privacy posture (be honest with users)
- **Copy Link share** = URL contains all data; nothing stored on server.
- **Push Live share** = JSON stored anonymously on Vercel KV, accessible to anyone with the URL, auto-deleted after 30 days.
- Players choose per-share. Snapshot stays default for sensitive backstories.
- Live URLs: "treat like a session password — share only with party + GM".

## [0.6] — 2026-05-16 — "Bodies & Becoming"

### Added
- **22 new morphs** transcribed from corebook (p054–p069), bringing the catalog from 21 to 45 entries total — including **Swarmanoid** (the user's specifically-flagged missing morph), **Neo-Octopus / octomorph** (eight-armed cephalopod with chameleon skin + ink attack), **Reaper** (12 MP combat disc, Heavy Frame, four weapon mounts), **Fury** / **Ghost** / **Remade** (advanced biomorphs), **Neotenic** / **Ruster** (common biomorphs), **Neo-Bonobo** / **Neo-Neanderthal** / **Neo-Orangutan** (uplift biomorphs), **Basic Pod** / **Novacrab** / **Shaper Pod** (pods), **Spare** / **Dragonfly** / **Slitheroid** / **Galatea** / **Steel Morph** / **Arachnoid** (synthmorphs), and 4 **Flexbot** variants (Crafter / Fighter / Rogue / Wizard, modular).
- **Three optional morph schema fields:** `armor:{energy,kinetic}` for synthmorphs with built-in Frame armor (Light 6/4, Medium 8/6, Heavy 12/10); `notes:""` for special attacks / size / hive notes; `swarm:true` flag (Swarmanoid only) that branches wound math.
- **Category filter pills** on the morph picker (Step 12): `ALL · BIOMORPH · UPLIFT · POD · SYNTH · FLEXBOT · INFOMORPH` with live count badges. State persisted to `STATE.meta.morphFilter`.
- **MP-budget status strip** above the picker: live "AFFORDABLE: 27 / 45 MORPHS" computed against the player's MP budget, with cost-ascending sort.
- **`// SWARM FORM` badge** on the Studio sheet morph banner when Swarmanoid is selected — surfaces distributed-damage semantics next to the morph name.
- **`// DIGITAL FORM` badge** on the Studio sheet morph banner for infomorphs (Digimorph / Ikon / Operator / Agent) — clarifies the "no body" framing.
- **`test-morph-catalog.js`** — 35 new assertions covering catalog completeness, per-category counts, required-field shape, WT integrity (swarm flag), Swarmanoid / Reaper / Octomorph edge cases, `studioPcFromState` pass-through, Lexicon coverage, and a permanent regression test for the v0.5.3-class projection bug (hyperelite + default aptitudes → non-empty `pc.skills`).

### Fixed (data drift in existing 21 morphs)
Cross-referenced every existing morph entry against `data/raw/morphs/p054–p069.txt`. Confirmed drift fixed in:
- **Bouncer** — WT/DUR/DR all bumped to corebook values (6/30/45 → 7/35/53); pools.Flex was 0, corebook says 2; movement "Walker 4/20" → "Walker 4/12"; added Cold Tolerance + Prehensile Feet ware; added Limberness L1 trait
- **Hibernoid** — pools.Vigor was 1, corebook says 0; Flex was 0, says 2; ware list rebuilt
- **Menton** — ware list reconciled (corebook is minimal — Mnemonics is the core augmentation)
- **Olympian** — WT/DUR/DR were 7/35/53, corebook says 8/40/60; pools.Flex was 0, says 1
- **Sylph** — ware reduced to corebook canonical (5 items)
- **Worker Pod / Pleasure Pod / Security Pod** — multiple stat/pool/ware reconciles; Security Pod swapped Industrial Armor → Bioweave Armor (+2/+3); Pleasure Pod added Scent Alteration + Sex Switch ware
- **Neo-Avian** — Insight pool 1→2, Flex 1→0, ware expanded substantially (added Claws, Direction Sense, Enhanced Vision, Prehensile Feet, Wings); Exotic Morphology L1 → L3; added Non-Human Biochemistry L2
- **Neo-Gorilla** — WT/DUR/DR 8/40/60 → 9/45/68; Insight 1→0, Flex 0→1; movement 4/16 → 4/12; ware expanded; added Non-Human Biochemistry
- **Case** — movement "Walker 4/20" → "Walker 4/12"; added Lidar + Mnemonics + Puppet Sock ware; added Exotic Morphology L1 + Inherent Flaws traits; added Light Frame (Armor 6/4) notes + armor field
- **Synth** — WT/DUR/DR 6/30/60 → 8/40/80; pools.Vigor 2→1, Flex 0→1; ware rebuilt; added Light Frame armor
- **Savant** — WT/DUR/DR 5/25/50 → 7/35/70; pools.Vigor 0→1; ware rebuilt; added Light Frame armor
- **Digimorph / Ikon / Operator / Agent** — ware rename `Mnemonic Augmentation` → `Mnemonics` (corebook shorthand); Operator's Insight pool corrected 4→3
- **Vocabulary unification:** `Mnemonic Augmentation` → `Mnemonics`, `Basic Mesh Inserts` / `Basic Biomods` → `Mesh Inserts` / `Biomods` throughout

### Changed (engine)
- **Wound math branches on `morph.swarm`** in `buildVitalSignsCard` and `studioSetDamage`. Swarmanoid (WT=0 sentinel) gets `woundCount=0`, `woundCap=1`, no `damage / WT` divide-by-zero, no `wounds × -10` Action Test penalty cascade. The swarm takes accumulated damage against DUR; when damage ≥ DUR the swarm is "broken".
- **`studioPcFromState` morph projection** now passes through `id`, `subtype`, `notes`, `swarm`, `WT`, `DUR`, `DR` in addition to the existing fields. Backward-compatible defaults preserved.

### Total counts
- **45 morphs** (was 21) — corebook canonical, 4 Flexbot variants modeled as discrete entries
- **357 test assertions** (was 322) — `test-morph-catalog.js` adds 35 new

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
