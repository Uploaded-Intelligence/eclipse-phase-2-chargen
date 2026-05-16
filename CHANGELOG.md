# Changelog

All notable changes to this project. Format follows the spirit of [Keep a Changelog](https://keepachangelog.com/), versioned by milestone.

## [0.10.2] — 2026-05-16 — "Click Any Teammate"

**The togetherness piece.** Wave C of v0.10. The team page used to show summary cards; you'd have to ask each player "what's your INT?" to see their real numbers. Now you tap a teammate's banner and their full Studio sheet slides up — every aptitude, every skill, every wound, every piece of gear. Live. Read-only. Yours to see.

### Added
- **Click any teammate card's banner → drawer opens** with their complete Studio sheet (Vital Signs, Aptitudes & Derived, Reputation, Party Coverage, Skills, Gear, Mesh, everything). Renders via `withStateAs(entry.full, () => buildStudioSheet())` — same code path the player uses on their own sheet, just temporarily pointed at the teammate's state.
- **READ-ONLY enforcement**: all interactive elements inside the drawer (rollers, +/- buttons, textareas, section toggles) are disabled via CSS `pointer-events: none`. Text selection + scroll work; everything else is inert.
- **All collapsibles auto-expanded** in the drawer — when viewing someone else's sheet, you want to see everything, not click through their accordions.
- **"▸ VIEW SHEET" affordance** badge added to each imported card's banner — discoverable click target (cursor-pointer alone wasn't a strong-enough signal).
- **Drawer chrome**: bottom-anchored full-height panel, portrait + name + "VIEWING [name]'s SHEET · READ-ONLY" header, close on X / ESC / backdrop click.

### Engine
- New function `showTeamMemberDrawer(entry)`. Reuses `buildStudioSheet`, `studioPcFromState`, `withStateAs` — no parallel sheet implementation.
- Banner click handler attached only to non-self cards.
- Graceful failure: if `buildStudioSheet` throws on a malformed teammate state, the drawer body shows an error message with the exception text, never blocks closing.

### Cross-cutting principle
**Reuse what works.** The Studio sheet is already the canonical view of a character — for the player. To show it to teammates, swap the STATE pointer and re-render. No new "summary view" component. No data duplication. The same code that renders my own sheet renders yours.

---

## [0.10.1] — 2026-05-16 — "Auto-Derive from PC Sheets"

**The trust shift.** Wave B of v0.10. The GM no longer tracks teammates' wounds/stress with +/- buttons — those values now come straight from each player's live sheet. Manual GM tracking was always a tax on executive function; this removes the tax.

### Changed
- **VITAL STATUS block replaces GM TRACKING block** on each teammate card. Reads `entry.full.play.woundsTaken / stress / traumasTaken` directly. No +/- buttons. Three rows:
  - **Wounds**: current / max (where max = `floor(DUR/WT)`). Amber at half, red at max.
  - **Stress**: current / max (where max = lucidity = `WIL × 2`). Amber at half, orange at max.
  - **Traumas**: current / max (where max = trauma threshold = `floor(LUC/5)`). Amber at half, amber at max.
- **Initiative stays manual** (number input + Roll button). Becomes shared in Wave D when team rooms ship.
- **Notes textarea relabeled** to "// personal notes — local only, not shared". Renamed in spirit from "GM notes" — there is no GM mode anymore. The field is still local-only (not synced to team doc).
- **Inline VITALS block** on imported cards is now suppressed (the new VITAL STATUS block supersedes it). Self card still shows the inline VITALS line.
- **Legacy fallback**: if `entry.full.play.woundsTaken` is missing (very old file-import with no play substate), the row falls back to `gmNotes.wounds/stress` and the block header reads "LEGACY (no live play data)".

### Engine
- `partyComputeCardData` now returns `maxWounds`, `lucidity`, `traumaThreshold` — the read-only ratio denominators for the new VITAL STATUS block.

### Tests
- Live-state read paths verified for present and missing play data.
- Test count target: 591 → ~601

### Cross-cutting principle
**The player's sheet is the source of truth for the player's state.** GM-side overrides ("they took 2 wounds but the player hasn't ticked them yet") are removed by design. If they need to land, they land on the player's sheet — which everyone sees update. One source. No reconciliation.

---

## [0.10.0] — 2026-05-16 — "The Team is Visible"

**Vocabulary shift: "Party" → "Team" throughout user-facing copy.** Mili-scifi over fantasy. Code identifiers (`partyImports`, `buildPartyMemberCard`) stay legacy for diff hygiene; user-facing text uses Team. This is Wave A of v0.10 "The Team" — three more waves coming.

### Added
- **Portraits on team cards.** Every teammate card now leads with a 64×64 portrait thumbnail (from `ego.narrative.avatarDataUrl`). Missing-portrait fallback: large monospace initial-letter glyph in a dashed-border slot. The team page becomes visceral — faces, not rows.
- **Team name field** in the page header. Inline-editable input, persists in `STATE.team.teamName`. The team name is yours from the moment you type it; promoted to the shared team doc in Wave D when team rooms ship.
- **Drag-and-drop file import.** The whole Team page is now a drop target. Drag one or many `.ep2.json` files onto it; each becomes a team member via `importJSON`. Existing "+ Add Member" button stays as the click-to-pick fallback (and the only mobile path). Visible dropzone hint with active-state highlight ring when you drag over.

### Fixed
- **GM Tracker missing on some team cards** (the PUFT-yes / UNNA-no bug). The render gate was `if (!isSelf && gm)` — entries with falsy `gmNotes` silently skipped the tracker. Defended at two points: (1) `gm` defaults to a fresh tracker object if the entry's `gmNotes` is missing, (2) the gate is now just `if (!isSelf)`. Belt and suspenders. **Wave B will replace this UI entirely with auto-derived display**; this is a holdover so the symptom doesn't ship in v0.10.0.

### Engine
- `STATE.team` field added (additive — schemaVersion stays at v7). Default `{ roomId:null, teamName:"", lastPolledAt:null }` populated via `newState()` and back-filled in `migrateToCurrent` for legacy saves.
- `partyComputeCardData` now returns `avatarDataUrl`, `woundsTaken`, `traumasTaken` — surfaces what Wave B's auto-derive needs.
- `dispatch(mutator, opts)` accepts optional `{skipRerender:true}` so text-input handlers can commit without losing focus + cursor position.

### Cross-cutting principle
**The page is for the team, not the GM.** Wave A is the visible re-framing. Wave B (auto-derive) is the trust shift. Wave C (open any sheet) is the togetherness. Wave D (shared room URL) is the relief.

---

## [0.9.2] — 2026-05-16 — "Load Party defense in depth"

**The bug that wouldn't die.** v0.9.1 fixed the URL-share import path but missed that "Load Party" (file upload) goes through a *different* function — `importJSON` — that still produced v6-shape partyImports entries. The next render hit `buildPartyMemberCard`, called `.toUpperCase()` on the undefined `source` field, and threw — wrapped in the import try/catch as `Import failed: can't access property "toUpperCase", source is undefined`. **Same symptom, different producer.** v0.9.2 fixes it systemically.

### Fixed
- **"Load Party" (file upload) crashed with `source is undefined`.** `importJSON` party-path was creating entries with only `{name, concept, lifepath, coverage, full}` — missing the five v7 fields (`id`, `source`, `lastSyncedAt`, `gmNotes`, `syncUrl`) that `buildPartyMemberCard` assumed. Root cause: the producer never got updated when v7 schema added those fields. Now both producers (file + URL) call the same helper.

### Engine (defense in depth)
- **`buildPartyImportEntry(loaded, sourceLabel)`** — single source of truth for partyImports entry shape. Used by both `importJSON` (file) and `importShareSnapshot` (URL/QR/live). Produces a v7-complete entry; callers can overlay specific fields (e.g. preserving existing gmNotes on upsert) after the call.
- **`normalizePartyImportEntries(loaded)`** — runs unconditionally at the end of `migrateToCurrent`. Heals partial entries from any source: legacy saves, hand-edited JSON, future schema bumps. Same field-backfill logic as `migrateV6ToV7`'s partyImports step, plus partial-`gmNotes` shape patching.
- **`buildPartyMemberCard` made defensive** — defaults `source` to `"file"` when entry has no string source field, and guards the `.toUpperCase()` fallback against non-string values. No future producer regression can crash the card render.
- **File-import party-path now upserts by characterId**, matching URL-import behavior. Re-loading the same player's file updates instead of duplicating.

### Tests
- 9+ new assertions covering the three layers — entry shape produced by `buildPartyImportEntry` for every `sourceLabel` variant, `normalizePartyImportEntries` healing each field individually, and the defensive render path tolerating a `source: undefined` entry.

### Cross-cutting principle
**Producer correctness AND reader resilience.** When a single invariant ("every partyImports entry has v7 shape") is enforced at multiple points, no single regression can break the system. The next schema bump will normalize partial entries via the post-migration pass even if a new producer drops a field.

---

## [0.9.1] — 2026-05-16 — "Mesh skill-lookup bugfix + defensive imports"

Three real bugs + one diagnosis aid.

### Fixed
- **Mesh skill tiles always showed 0.** `buildStudioMesh`'s `findSkill` read `pc.skills[i].value` but `studioPcFromState` produces entries with `.total`. Result: Infosec / Interface / Program tiles displayed `—` regardless of actual values. Fixed to read `.total` (with `.value` fallback for safety) and accept `"Skill:field"` prefix-match for parameterized skills.
- **Mesh + Gear Guide sections gated behind gear.** Both lived inside `if (packNames.length > 0)`. Imported PCs with no gear yet saw neither. Hoisted out — Mesh access derives from morph ware + skills (not gear); GP/Complexity primer is useful pre-gear too.
- **Stale footer.** `newState().meta.toolVersion` was hardcoded to `"0.7.0"`. Bumped to `"0.9.1"`.

### Engine (diagnosis aid)
- `importShareSnapshot` and `importJSON` now run pre-flight validation that rejects empty/malformed parsedState with explicit shape-error messages **before** mutating STATE.
- `console.error(e)` in both catch blocks dumps full stack to F12 console.
- Friendlier alert text directing users to copy the trace.
- Self-import preserves GM's existing `partyImports` (doesn't clobber).
- v6→v7 `gmNotes` shape defensively rebuilt if existing entry has partial fields.

### Tests
- 506 → 515 assertions (+9). New regression guards on `.total` vs `.value`, empty-input defensive validation, toolVersion bump, self-import preserving existing partyImports.

---

## [0.9] — 2026-05-16 — "The Mesh"

EP2's biggest subsystem made legible. Every PC interacts with the mesh constantly — hacker or not — but most of that surface was buried in gear lists, skill rows, and corebook references. v0.9 surfaces it as a single legible page: Muse, OPSEC posture, hacking dice, your mesh apps with what they do at the table, common actions cheat-sheet, privilege ladder, and a mesh-implant audit on the morph. **Pure projection layer — no schema change.**

### Added
- **The Mesh section** (`buildStudioMesh(pc)`) — new collapsible Studio panel between Gear Guide and the Dossier. Seven subsections:
  - **Header strip**: Mesh Access (Basic Mesh Inserts / Mesh Inserts / Ghostrider / Ecto / Offline — detected from morph ware) · OPSEC badge (GOOD/FAIR/POOR) · Muse name (data-tip on each).
  - **Hacking Toolkit**: three large stat tiles for Infosec / Interface / Program with the linked Cognition aptitude, plus per-skill "what this rolls for" subtitle. Tap → existing skill tooltip.
  - **OPSEC Stack**: auto-computed score (0-3) with row-by-row ✓/○ status for Anonymizer, VPN App, Fake Ego ID. POOR/FAIR cards include a "Suggestion: acquire X + Y" line.
  - **Mesh Toolkit**: detects mesh apps in gear (Anonymizer, VPN App, Fake Ego ID, TacNet App, Sniffer App, Tracker App, Exploit, Scout, Firewall App) with a one-line "// what it does at the table" summary per app.
  - **Common Mesh Actions**: 5-row cheat sheet (Lurking, Intrusion, Sniffing, Spoofing, Subversion) with skill name + one-line primer + tooltip per action.
  - **Privilege Ladder**: visual `Public → User → Read/Write → Admin → Security → Root` pill row with the privileges Lexicon entry tooltip.
  - **Mesh-Aware Implants**: detects mesh-relevant ware on the morph (Basic Mesh Inserts, Mnemonics, Ghostrider Module, Access Jacks, Puppet Sock, Cyberbrain, Enhanced Security, Sniffer App, Tracker App, Radio Booster, E-Veil, Copylock, Memory Lock) — `✓` green or `⚠` amber based on whether the implant is empowering or a risk-surface.
- **14 new Lexicon entries** in `RULEBOOK_REFERENCE.lexicon` — `muse`, `mesh-id`, `pan`, `ecto`, `hacking-primer`, `privileges`, `intrusion`, `subversion`, `lurking`, `spoofing`, `sniffing`, `opsec`, `counter-intrusion`, `mesh-actions-table`. Each with `setting` (corebook prose) + `implications` (what it means at the table) + page refs to EP2 corebook §240-260. New GMs can hover any term in the Mesh section and read the rule in context.

### Engine
- `studioMeshAccess(pc)` — detects Mesh Inserts / Basic Mesh Inserts / Ghostrider Module from morph ware, falls back to Ecto detection in gear, then "none".
- `studioMeshOpsec(pc)` — returns `{level, hasAnon, hasVPN, hasFakeID, score}`. Loose regex detection (e.g. `/anonymizer/i`) so variants (Anonymizer Pro, etc.) still count.
- `studioMeshApps(pc)` — pattern-matches 9 known mesh-app categories against gear names, returns `{name, key, tipKey, summary}` per detection, dedupes by category.
- `studioMeshImplants(pc)` — walks morph ware, flags 13 mesh-relevant implants as `ok` (empowering) or `warn` (hackable surface like Cyberbrain / Puppet Sock).
- `_wareNames(pc)` — normalizes ware shape between studioPcFromState (objects with `.name`) and raw test fixtures (strings).

### Tests
- **506 total assertions** (was 461 — +45 covering OPSEC tri-state, mesh access detection across biomorph/synthmorph/ecto/none, mesh-app detection on Firewall PC, mesh-implant detection on synthmorph vs biomorph, all 14 new Lexicon keys present + content sanity checks, end-to-end derivation from a real STATE via studioPcFromState).

### Cross-cutting principle
**Make the implicit explicit.** The PC's mesh posture was already in STATE (gear, ware, skills, muse). v0.9 doesn't add mechanics — it just stops hiding what's there. The OPSEC badge is the most-condensed example: three boolean checks become a single GOOD/FAIR/POOR judgment that a new GM can read at a glance. Same pattern as v0.8's GP/Complexity guide and Fabrication detection: derive from existing state, teach in context.

---

## [0.8] — 2026-05-17 — "Combat ALI"

Three systemic bugs identified, three root causes fixed, plus a new Gear Guide section. The character creator becomes a session co-pilot that doesn't ghost on you.

### Fixed (systemic — not just patches)
- **Tooltip silent-fail eliminated.** `RULEBOOK_REFERENCE.ware` was missing 44 entries (incl. Chameleon Skin — the user-reported failure). Added them all + 5 new `morph_traits` entries (Enhanced Behavior, Limberness, Non-Human Biochemistry, Planned Obsolescence, Inherent Flaws). `RULEBOOK_REFERENCE.ware` grew from 30 → 74 entries. **Plus**: `showTooltip` now renders an amber "⚠ Data Gap" tooltip when an entry is missing — surfaces future gaps visibly instead of silently failing. **Plus**: new coverage assertion in `test-morph-catalog.js` — "every ware/trait referenced by a morph must have a Lexicon entry" — would have caught the chameleon-skin bug on day one of v0.6.
- **Attack panel weapons fixed at the data layer.** `RULEBOOK_REFERENCE.gear_items` weapon entries had `short` text with "DV 2d10, SA/BF/FA, Range 30" but no structured `weapon: {dv, modes, range, ammo, skill, ranged, twoHanded, reach}` object. `studioPcFromState` reads `ref.weapon || null` → always null → attack panel saw nothing. Added structured metadata to all 10 weapons in the catalog (medium-pistol, assault-rifle-railgun, shredder, club, knife, claws-implant, flex-cutter, shock-glove, eelware, diamond-axe). **Firewall PCs now see their Medium Pistol; soldiers see their Assault Rifle Railgun.** No code changes needed downstream — the data was the bug.
- **Wound/damage divergence clarified + healable.** The `Math.max(current, auto)` ratchet was actually EP2-correct (wounds are permanent until healed). What was missing: a healing UI. Added new **Healing mini-section** in Vital Signs with explicit `−1 dmg / −5 dmg / Heal wound (−WT dmg, −1 wound) / Long rest / −1 stress / Untick trauma` buttons. Each comes with a `ⓘ` tooltip linking to `combat.healing`. Plus: inline note "Damage and wounds heal at different rates — raw damage recovers with rest; wounds require active healing." **The user's confusion ("wounds not following damage") was a UI gap, now closed.**
- **Bioweave/Carapace Armor data normalization.** Morph data had `"Bioweave Armor (+2/+3)"` and `"Carapace Armor (+6/+7)"` strings with armor values embedded in the name. Armor values are already captured in `morph.armor: {energy, kinetic}`. Stripped the redundant paren suffix from morph ware lists; Lexicon now resolves cleanly.

### Added
- **Combat ALI rename.** "Turn Coach" → **"Combat ALI"** (Artificial Limited Intelligence). Subtitle "combat scaffolding" → "// onboard combat AI · auto-applied modifiers + roll helper". Plus: new Lexicon entry for `ali` explaining the in-character framing — your combat ALI is the software watching your wounds, your status effects, your action economy — and adjusting your rolls in real time. The character creator's combat helper now has its proper EP2 vocabulary.
- **Updated `combat.healing` Lexicon entry.** Replaced bare prose with structured rates: biomorph damage (1d10/day rest, 1d10/12h with Biomods, 1d10/hour with medichines, 2d10/hour in healing vat); biomorph wounds (1/week natural, 1/3 days with Biomods, 1/day with medichines, 1/2h vat); first aid (Medicine: Paramedic 10min + 10min/wound = 1 wound + 1d10 damage); synthmorph (Hardware: Robotics test, 1h per 5 dmg + 8h per wound, fixer swarms automate); stress (1d10/hour relaxation, 1 Moxie = 1d10 immediate); trauma (8h Psychosurgery). Players now know HOW LONG things take.
- **Gear Guide section (Track E).** New panel after the Gear row that:
  - Categorizes loadout (Weapons / Armor / Implants / Apps / Tools / Misc) with item counts
  - Explains Gear Points (GP) and Complexity ratings (Min/Mod/Maj) inline with a `ⓘ` link to `gear_avail_cost`
  - Detects fab capability — `characterHasFabber(pc)` checks for Compact / Medium / Large fabbers
  - Surfaces fab guidance: ✓ green "Fabrication available — Medium fabber detected" with item-class breakdown / ✗ amber "Pick up a Medium Fabber (Mod/1) for in-play crafting"
  - Notes "v0.9 will add live GP budget customization at chargen"
- **44 ware Lexicon entries + 5 morph_trait entries** with corebook-derived `short` + `used_for` + `page` content.
- **Defensive tooltip pattern** (`tip-warn` CSS class). Amber-bordered tooltips when an entry is missing, showing the slug + a GitHub issue link so users can help fix.

### Changed (engine)
- `studioHealDamage(n)`, `studioHealWound(n)`, `studioHealStress(n)`, `studioHealTrauma(n)` — explicit healing dispatchers. `studioHealWound` decrements BOTH `woundsTaken` AND raw damage by `WT * n` (the "surgery happened" path EP2 rules describe but the UI never exposed). `studioHealTrauma` mirrors for mental side.
- `studioLongRestHeal(pc)` — rolls 1d10 damage + 1d10 stress recovery; surfaces morph-type hint (synthmorph needs Hardware: Robotics for full effect).
- `characterHasFabber(pc)` — gear-string heuristic detecting Compact / Medium / Large fabbers for the Gear Guide.

### Total counts
- **74 ware Lexicon entries** (was 30 — +44)
- **9 morph_trait Lexicon entries** (was 4 — +5)
- **10 weapons with structured metadata** (was 0)
- **461 test assertions** (was 406 — +55 covering ware coverage, weapon flow-through, healing dispatchers, Combat ALI lexicon, fabber detection)

### Cross-cutting principle
The three systemic bugs shared one root: **silent failure when data should be there**. The defensive tooltip + the coverage assertion turn that into an audit-able invariant going forward. No more "feature looks fine but the data layer is empty".

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
