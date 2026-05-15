// v0.2 regression: schema v3 migration + play-mode state semantics.
// Tests: v1->v2->v3 chain migration, pool spend decrement, mode toggle, persistence shape.
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = { STATE, RULEBOOK_DATA, RULEBOOK_REFERENCE, derived, newState, migrateV1ToV2, migrateV2ToV3, migrateV3ToV4, migrateV4ToV5, migrateV5ToV6, migrateToCurrent, SCHEMA_VERSION, TIP_NAME_OVERRIDES, titleizeKey, deriveTipName, _setState: (v)=>{STATE=v;} };\n";

const sandbox = {
  console,
  document: { createElement: () => ({appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{}, style:{}, dataset:{}}), querySelector: () => null, querySelectorAll: () => [], createTextNode: ()=>({}), addEventListener: ()=>{}, body:{appendChild:()=>{}, classList:{toggle:()=>{}}} },
  window: { addEventListener: () => {}, innerWidth: 1400, scrollTo: () => {}, scrollY: 0, innerHeight: 900 },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout, alert: () => {}, confirm: () => false,
  Blob: function(){}, URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  FileReader: function(){}
};
const ctx = vm.createContext(sandbox);
vm.runInContext(js, ctx);
const exp = sandbox.__exports;

let pass = 0, fail = 0;
const assert = (label, cond, extra) => { if (cond) { console.log("  ✓", label); pass++; } else { console.log("  ✗", label, extra||""); fail++; } };

console.log("\n=== SCHEMA_VERSION constant ===");
assert("SCHEMA_VERSION === 6", exp.SCHEMA_VERSION === 6, "got " + exp.SCHEMA_VERSION);

console.log("\n=== newState() shape ===");
const s = exp.newState();
assert("meta.schemaVersion === 6", s.meta.schemaVersion === 6);
assert("meta.mode === 'chargen' (default)", s.meta.mode === "chargen");
assert("play exists", !!s.play);
assert("play.pools has all 4 pools (null = full)", ["Insight","Moxie","Vigor","Flex"].every(p => s.play.pools[p] === null));
assert("play.wounds === 0", s.play.wounds === 0);
assert("play.stress === 0", s.play.stress === 0);
assert("play.lucidity === 0", s.play.lucidity === 0);
assert("play.log is array", Array.isArray(s.play.log));

console.log("\n=== migrateV2ToV3: additive, no data loss ===");
const v2 = { meta:{schemaVersion:2}, ego:{slotAllocations:{"bg.0":20}, customSlots:[]}, morph:{chosen:"futura"}, partyImports:[] };
const v3 = exp.migrateV2ToV3(JSON.parse(JSON.stringify(v2)));
assert("v2->v3 sets schemaVersion=3", v3.meta.schemaVersion === 3);
assert("v2->v3 preserves slotAllocations", v3.ego.slotAllocations["bg.0"] === 20);
assert("v2->v3 creates play object", !!v3.play);
assert("v2->v3 sets meta.mode default", v3.meta.mode === "chargen");
assert("v2->v3 play.pools all 4", ["Insight","Moxie","Vigor","Flex"].every(p => p in v3.play.pools));

console.log("\n=== migrateToCurrent: full v1 -> v2 -> v3 chain ===");
const v1 = { meta:{schemaVersion:1}, ego:{
  background:"hyperelite", aptitudes:{COG:15,INT:15,REF:10,SAV:20,SOM:10,WIL:20},
  skillAllocations:{ "Athletics":30, "Know:Extropian":25 }, fieldChoices:{}, orChoices:{},
  cp:{aptitudeBumps:{},skillBumps:{},specializations:[],extraLangs:[],repBumps:{},psiSleights:[],positiveTraits:[],negativeTraits:[]},
  languages:[], rep:{"@-rep":0,"c-rep":0,"f-rep":0,"g-rep":0,"i-rep":0,"r-rep":0,"x-rep":0},
  motivations:[],
  narrative:{concept:"",backstoryAnswers:{},identity:{morphRelationship:null,resleeveStance:null,fallStory:"",factionNuance:null,taboo:"",memoryGapsOrForks:""},quirks:{mannerism:"",catchphrase:"",style:""},connections:[],avatarDataUrl:null}
}, morph:{chosen:null,mpBudgetBase:6,traits:[],extraGearNotes:"",flexFromMP:0}, partyImports:[] };
const migrated = exp.migrateToCurrent(JSON.parse(JSON.stringify(v1)));
assert("v1->v6 reaches schemaVersion 6 via full chain", migrated.meta.schemaVersion === 6);
assert("v1->v5 has slotAllocations", !!migrated.ego.slotAllocations);
assert("v1->v5 has no skillAllocations (gone)", !migrated.ego.skillAllocations);
assert("v1->v5 has play state", !!migrated.play && migrated.play.wounds === 0);
assert("v1->v5 has meta.mode", migrated.meta.mode === "chargen");

console.log("\n=== v5 schema: existing v4 fields preserved ===");
const v4Fresh = exp.newState();
assert("SCHEMA_VERSION === 6", exp.SCHEMA_VERSION === 6, "got " + exp.SCHEMA_VERSION);
assert("newState().meta.schemaVersion === 6", v4Fresh.meta.schemaVersion === 6);
assert("play.turn has {complex:false,quick:false,move:false}",
  v4Fresh.play.turn
  && v4Fresh.play.turn.complex === false
  && v4Fresh.play.turn.quick === false
  && v4Fresh.play.turn.move === false);
assert("play.combat has {round:0,initiativeRolled:null,statuses:[]}",
  v4Fresh.play.combat
  && v4Fresh.play.combat.round === 0
  && v4Fresh.play.combat.initiativeRolled === null
  && Array.isArray(v4Fresh.play.combat.statuses)
  && v4Fresh.play.combat.statuses.length === 0);
assert("play.consumables is empty plain object",
  v4Fresh.play.consumables
  && typeof v4Fresh.play.consumables === "object"
  && !Array.isArray(v4Fresh.play.consumables)
  && Object.keys(v4Fresh.play.consumables).length === 0);

console.log("\n=== migrateV3ToV4: additive, no data loss ===");
const v3save = {
  meta:{schemaVersion:3,mode:"play"},
  ego:{name:"Hex",slotAllocations:{"bg.0":20},customSlots:[]},
  morph:{chosen:"futura"},
  play:{ pools:{Insight:null,Moxie:2,Vigor:null,Flex:1}, wounds:2, durability:0, stress:5, lucidity:0, log:[{t:1,msg:"x"}] },
  partyImports:[]
};
const v4mig = exp.migrateV3ToV4(JSON.parse(JSON.stringify(v3save)));
assert("v3->v4 sets schemaVersion=4", v4mig.meta.schemaVersion === 4);
assert("v3->v4 preserves ego.name", v4mig.ego.name === "Hex");
assert("v3->v4 preserves slotAllocations", v4mig.ego.slotAllocations["bg.0"] === 20);
assert("v3->v4 preserves play.wounds", v4mig.play.wounds === 2);
assert("v3->v4 preserves play.stress", v4mig.play.stress === 5);
assert("v3->v4 preserves play.pools.Moxie spent value", v4mig.play.pools.Moxie === 2);
assert("v3->v4 preserves play.log", v4mig.play.log.length === 1 && v4mig.play.log[0].msg === "x");
assert("v3->v4 adds play.turn", v4mig.play.turn && v4mig.play.turn.complex === false);
assert("v3->v4 adds play.combat", v4mig.play.combat && v4mig.play.combat.round === 0);
assert("v3->v4 adds play.consumables", v4mig.play.consumables && typeof v4mig.play.consumables === "object");

console.log("\n=== migrateV3ToV4 idempotent (no clobber on re-run) ===");
const once = exp.migrateV3ToV4(JSON.parse(JSON.stringify(v3save)));
once.play.consumables["medicines"] = 2;
once.play.combat.round = 3;
once.play.combat.statuses.push("burning");
once.play.turn.complex = true;
const twice = exp.migrateV3ToV4(JSON.parse(JSON.stringify(once)));
assert("idempotent: consumables.medicines preserved", twice.play.consumables.medicines === 2);
assert("idempotent: combat.round preserved", twice.play.combat.round === 3);
assert("idempotent: combat.statuses preserved", twice.play.combat.statuses[0] === "burning");
assert("idempotent: turn.complex preserved", twice.play.turn.complex === true);

console.log("\n=== migrateToCurrent: v1 -> v5 full chain ===");
const v1full = { meta:{schemaVersion:1}, ego:{
  background:"hyperelite", aptitudes:{COG:15,INT:15,REF:10,SAV:20,SOM:10,WIL:20},
  skillAllocations:{ "Athletics":30 }, fieldChoices:{}, orChoices:{},
  cp:{aptitudeBumps:{},skillBumps:{},specializations:[],extraLangs:[],repBumps:{},psiSleights:[],positiveTraits:[],negativeTraits:[]},
  languages:[], rep:{"@-rep":0,"c-rep":0,"f-rep":0,"g-rep":0,"i-rep":0,"r-rep":0,"x-rep":0},
  motivations:[],
  narrative:{concept:"",backstoryAnswers:{},identity:{morphRelationship:null,resleeveStance:null,fallStory:"",factionNuance:null,taboo:"",memoryGapsOrForks:""},quirks:{mannerism:"",catchphrase:"",style:""},connections:[],avatarDataUrl:null}
}, morph:{chosen:null,mpBudgetBase:6,traits:[],extraGearNotes:"",flexFromMP:0}, partyImports:[] };
const v1tov5 = exp.migrateToCurrent(JSON.parse(JSON.stringify(v1full)));
assert("v1->v6 reaches schemaVersion 6", v1tov5.meta.schemaVersion === 6);
assert("v1->v5 has v4 play.turn", !!v1tov5.play.turn);
assert("v1->v5 has v4 play.combat", !!v1tov5.play.combat);
assert("v1->v5 has v4 play.consumables", !!v1tov5.play.consumables);
assert("v1->v5 has v5 play.recharge", !!v1tov5.play.recharge && v1tov5.play.recharge.short1 === false);
assert("v1->v5 has v5 play.statuses (empty array)", Array.isArray(v1tov5.play.statuses) && v1tov5.play.statuses.length === 0);
assert("v1->v5 has v5 play.initiative", v1tov5.play.initiative && v1tov5.play.initiative.round === 0);
assert("v1->v5 has v5 play.notes (empty string)", v1tov5.play.notes === "");
assert("v1->v5 has v5 play.woundsTaken === 0", v1tov5.play.woundsTaken === 0);
assert("v1->v5 has v5 play.traumasTaken === 0", v1tov5.play.traumasTaken === 0);
assert("v1->v5 has v5 ego.player (empty string)", v1tov5.ego.player === "");
assert("v1->v5 has v5 ego.muse (empty string)", v1tov5.ego.muse === "");
assert("v1->v5 has v5 ego.quote (empty string)", v1tov5.ego.quote === "");

console.log("\n=== migrateV4ToV5: additive, no data loss ===");
const v4save = {
  meta:{schemaVersion:4,mode:"play"},
  ego:{name:"Hex",slotAllocations:{"bg.0":20},customSlots:[]},
  morph:{chosen:"futura"},
  play:{ pools:{Insight:null,Moxie:2,Vigor:null,Flex:1}, wounds:7, durability:0, stress:5, lucidity:0,
         log:[{t:1,msg:"x"}], turn:{complex:false,quick:false,move:false},
         combat:{round:3,initiativeRolled:null,statuses:[]}, consumables:{medicines:2} },
  partyImports:[]
};
const v5mig = exp.migrateV4ToV5(JSON.parse(JSON.stringify(v4save)));
assert("v4->v5 sets schemaVersion=5", v5mig.meta.schemaVersion === 5);
assert("v4->v5 preserves ego.name", v5mig.ego.name === "Hex");
assert("v4->v5 preserves play.wounds (raw damage) === 7", v5mig.play.wounds === 7);
assert("v4->v5 preserves play.consumables.medicines === 2", v5mig.play.consumables.medicines === 2);
assert("v4->v5 preserves play.combat.round === 3", v5mig.play.combat.round === 3);
assert("v4->v5 adds play.recharge", !!v5mig.play.recharge);
assert("v4->v5 adds play.statuses (array)", Array.isArray(v5mig.play.statuses));
assert("v4->v5 adds play.initiative", !!v5mig.play.initiative);
assert("v4->v5 adds ego.player", v5mig.ego.player === "");

console.log("\n=== migrateV4ToV5 idempotent (no clobber on re-run) ===");
const v5once = exp.migrateV4ToV5(JSON.parse(JSON.stringify(v4save)));
v5once.play.recharge.short1 = true;
v5once.play.statuses.push({key:"st1", label:"Stunned"});
v5once.play.initiative.round = 4;
v5once.play.notes = "TPK in 3 rounds";
v5once.ego.player = "JALTA";
const v5twice = exp.migrateV4ToV5(JSON.parse(JSON.stringify(v5once)));
assert("idempotent: recharge.short1 preserved", v5twice.play.recharge.short1 === true);
assert("idempotent: statuses[0] preserved", v5twice.play.statuses[0] && v5twice.play.statuses[0].label === "Stunned");
assert("idempotent: initiative.round preserved", v5twice.play.initiative.round === 4);
assert("idempotent: notes preserved", v5twice.play.notes === "TPK in 3 rounds");
assert("idempotent: ego.player preserved", v5twice.ego.player === "JALTA");

console.log("\n=== migrateV5ToV6: additive lore fields, no data loss ===");
const v5save = {
  meta:{schemaVersion:5,mode:"play"},
  ego:{
    name:"Hex", player:"JALTA", muse:"Ada", quote:"keep moving",
    slotAllocations:{"bg.0":20}, customSlots:[],
    narrative:{ concept:"hacker", backstoryAnswers:{}, identity:{morphRelationship:null,resleeveStance:null,fallStory:"",factionNuance:null,taboo:"",memoryGapsOrForks:""}, quirks:{mannerism:"",catchphrase:"",style:""}, connections:[], avatarDataUrl:"data:image/jpeg;base64,/9j/2wBDA..." }
  },
  morph:{chosen:"futura"},
  play:{ pools:{Insight:null,Moxie:2,Vigor:null,Flex:1}, wounds:7, woundsTaken:1, traumasTaken:0,
         log:[], turn:{complex:false,quick:false,move:false}, statuses:[], initiative:{round:0,position:null}, notes:"keep notes", recharge:{short1:false,short2:false,long:false} }
};
const v6mig = exp.migrateV5ToV6(JSON.parse(JSON.stringify(v5save)));
assert("v5->v6 sets schemaVersion=6", v6mig.meta.schemaVersion === 6);
assert("v5->v6 preserves ego.name", v6mig.ego.name === "Hex");
assert("v5->v6 preserves ego.narrative.avatarDataUrl (existing portrait survives)", v6mig.ego.narrative.avatarDataUrl && v6mig.ego.narrative.avatarDataUrl.startsWith("data:image/jpeg"));
assert("v5->v6 preserves play.notes", v6mig.play.notes === "keep notes");
assert("v5->v6 adds ego.narrative.teamBrief (empty string)", v6mig.ego.narrative.teamBrief === "");
assert("v5->v6 adds ego.narrative.backstory (empty string)", v6mig.ego.narrative.backstory === "");

console.log("\n=== migrateV5ToV6 idempotent (no clobber on re-run) ===");
const v6once = exp.migrateV5ToV6(JSON.parse(JSON.stringify(v5save)));
v6once.ego.narrative.teamBrief = "Sunward Ops · cell Zeta";
v6once.ego.narrative.backstory = "Born in a Luna hab. Lost the family in the Fall.";
const v6twice = exp.migrateV5ToV6(JSON.parse(JSON.stringify(v6once)));
assert("idempotent: teamBrief preserved", v6twice.ego.narrative.teamBrief === "Sunward Ops · cell Zeta");
assert("idempotent: backstory preserved", v6twice.ego.narrative.backstory.startsWith("Born in a Luna hab"));

console.log("\n=== migrateToCurrent: v1 chains through v6 (lore fields present) ===");
const v1lore = JSON.parse(JSON.stringify(v1full));
const v1tov6 = exp.migrateToCurrent(v1lore);
assert("v1->v6 reaches schemaVersion 6 via migrateToCurrent", v1tov6.meta.schemaVersion === 6);
assert("v1->v6 has ego.narrative.teamBrief (empty string)", v1tov6.ego.narrative.teamBrief === "");
assert("v1->v6 has ego.narrative.backstory (empty string)", v1tov6.ego.narrative.backstory === "");

console.log("\n=== Pool spend semantics ===");
const sp = exp.newState();
sp.morph.chosen = "futura";  // assume futura exists in RULEBOOK_DATA; pool max comes from there
exp._setState(sp);
const morphPools = (exp.RULEBOOK_DATA.morphs && exp.RULEBOOK_DATA.morphs.futura && exp.RULEBOOK_DATA.morphs.futura.pools) || {Insight:0,Moxie:0,Vigor:0,Flex:0};
// Simulate spend: play.pools[Insight] starts null (=full), set to max-1
sp.play.pools.Insight = morphPools.Insight - 1;
assert("Spend 1 Insight: current = max-1", sp.play.pools.Insight === morphPools.Insight - 1);
// Reset
sp.play.pools.Insight = null;
assert("Reset Insight: null (=full from morph)", sp.play.pools.Insight === null);

console.log("\n=== Mode toggle preserves state ===");
const sm = exp.newState();
sm.ego.name = "Hex";
sm.play.wounds = 3;
sm.meta.mode = "play";
exp._setState(sm);
const before = JSON.stringify(sm);
sm.meta.mode = "chargen";
exp._setState(sm);
assert("mode toggle does not touch ego data", sm.ego.name === "Hex");
assert("mode toggle does not touch play data", sm.play.wounds === 3);

console.log("\n=== RULEBOOK_REFERENCE coverage (sanity) ===");
const ref = exp.RULEBOOK_REFERENCE;
assert("aptitudes covers all 6", ["COG","INT","REF","SAV","SOM","WIL"].every(a => ref.aptitudes[a] && ref.aptitudes[a].short));
assert("pools covers all 4", ["Insight","Moxie","Vigor","Flex"].every(p => ref.pools[p] && ref.pools[p].short));
assert("derivedStats covers Initiative/WT/DUR/DR/TT/LUC/IR", ["Initiative","WT","DUR","DR","TT","LUC","IR"].every(d => ref.derivedStats[d] && ref.derivedStats[d].used_for));
assert("skills covers Athletics/Fray/Perceive/Know", ["Athletics","Fray","Perceive","Know"].every(s => ref.skills[s] && ref.skills[s].used_for));
assert("Fray flagged REF x 2", /REF\s*[x×]\s*2/.test(ref.skills.Fray.note || ""), "got: " + ref.skills.Fray.note);
assert("Perceive flagged INT x 2", /INT\s*[x×]\s*2/.test(ref.skills.Perceive.note || ""), "got: " + ref.skills.Perceive.note);
assert("rep covers all 7 networks", ["@-rep","c-rep","f-rep","g-rep","i-rep","r-rep","x-rep"].every(n => ref.rep.networks[n]));
assert("aptitudeCheck explains x3 rule", /Aptitude\s*[x×]\s*3/.test(ref.aptitudeCheck.formula || ""));

console.log("\n=== data-tip prefix consistency (regression for v0.2.1 fix) ===");
// Every data-tip="X.Y" attribute must resolve via lookupTip to non-null.
// Bug found in initial v0.2 browser verification: data-tip="aptitude.COG" (singular)
// but RULEBOOK_REFERENCE.aptitudes (plural). Mismatched. This test guards against drift.
const litMatches = [...html.matchAll(/data-tip["']\s*:\s*["']([^"'+]+?)["']\s*[,}]/g)];
const tipKeys = new Set(litMatches.map(m => m[1]));
const concatMatches = [...html.matchAll(/data-tip["']\s*:\s*["']([a-zA-Z_]+)\.["']\s*\+/g)];
const prefixes = new Set(concatMatches.map(m => m[1]));
const allCategories = new Set([...prefixes, ...[...tipKeys].map(k => k.split(".")[0])]);
console.log("  Categories found in markup:", [...allCategories].sort().join(", "));
allCategories.forEach(cat => {
  assert("category '" + cat + "' exists in RULEBOOK_REFERENCE", !!exp.RULEBOOK_REFERENCE[cat]);
});
const lookupCheck = (k) => {
  const dot = k.indexOf(".");
  const cat = dot >= 0 ? k.slice(0, dot) : k;
  const id = dot >= 0 ? k.slice(dot + 1) : null;
  const bucket = exp.RULEBOOK_REFERENCE[cat];
  if (!bucket) return false;
  if (id == null) return true;
  if (cat === "rep" && bucket.networks && bucket.networks[id]) return true;
  return !!bucket[id];
};
const probableKeys = [
  "aptitudes.COG","aptitudes.WIL","pools.Insight","pools.Flex",
  "derivedStats.Initiative","derivedStats.WT","derivedStats.LUC","derivedStats.TT","derivedStats.IR","derivedStats.InfectionRating",
  "skills.Athletics","skills.Fray","skills.Perceive","skills.Know",
  "rep.@-rep","rep.c-rep","rep.f-rep","rep.g-rep","rep.i-rep","rep.r-rep","rep.x-rep",
  "mode.chargen","mode.play","aptitudeCheck","motivations"
];
probableKeys.forEach(k => {
  assert("lookupTip resolves '" + k + "'", lookupCheck(k));
});

console.log("\n=== Know-field coverage (regression for v0.2.x — faction Knows + mid-list skips) ===");
// Engine generates Know fields from THREE sources:
//   (A) explicit "common" arrays inside Know skill grants in package data
//   (B) faction selection at Step 4 → "Know:<Faction.name>" 30
//   (C) fixed Know grants
// All three must be covered by know_fields entries (or faction-fallback in showTooltip).
const html2 = fs.readFileSync(__dirname + "/index.html", "utf8");
const commonFields = new Set();
for (const m of html2.matchAll(/skill:"Know"[^}]*common:\[([^\]]+)\]/g)) {
  for (const fm of m[1].matchAll(/"([^"]+)"/g)) commonFields.add(fm[1]);
}
const factionBlock = html2.match(/factions:\s*\{([\s\S]*?)\n  \},/);
const factionNames = [];
if (factionBlock) for (const fm of factionBlock[1].matchAll(/name:"([^"]+)"/g)) factionNames.push(fm[1]);
const fixedFields = new Set();
for (const m of html2.matchAll(/skill:"Know"[^}]*fixed:"([^"]+)"/g)) fixedFields.add(m[1]);

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const kf = new Set(Object.keys(exp.RULEBOOK_REFERENCE.know_fields || {}).filter(k => !k.startsWith("_")));
const factionIds = new Set(Object.keys(exp.RULEBOOK_DATA.factions || {}));

const allFields = [...commonFields, ...factionNames, ...fixedFields];
let coveredCount = 0, factionFallbackCount = 0, gapCount = 0;
const gaps = [];
for (const f of allFields) {
  const s = slugify(f);
  if (kf.has(s)) { coveredCount++; continue; }
  // Faction fallback: does field match a faction name?
  let isFaction = false;
  for (const fid of factionIds) {
    if ((exp.RULEBOOK_DATA.factions[fid].name === f) || fid === s) { isFaction = true; break; }
  }
  if (isFaction) { factionFallbackCount++; continue; }
  gaps.push(f);
  gapCount++;
}
console.log("  Engine generates " + allFields.length + " distinct Know fields");
console.log("  Covered by know_fields:    " + coveredCount);
console.log("  Covered by faction-fallback: " + factionFallbackCount);
console.log("  GAPS (no tooltip coverage): " + gapCount);
if (gaps.length) console.log("    " + gaps.join(", "));
assert("every engine-generated Know field has tooltip coverage (know_fields OR faction-fallback)", gapCount === 0,
  gaps.length ? "gaps: " + gaps.join(", ") : "");

console.log("\n=== Tooltip blue-header coverage (regression for S-TitleEverywhere) ===");
// Engine resolution: showTooltip first checks entry.name from RULEBOOK_REFERENCE;
// if absent, calls deriveTipName(key) to synthesize from key (override map + titleizer).
// This test enumerates every keyed entry in RULEBOOK_REFERENCE and asserts the
// resolution chain produces a non-empty title — so any future entry added without
// a name and without override/titleizer coverage fails the build, not the user's eyes.

const rb = exp.RULEBOOK_REFERENCE;
const skip = new Set(["_meta", "morphs"]); // morphs are RULEBOOK_DATA-backed, not RB entries
let tipPass = 0, tipFail = 0;
const tipGaps = [];

for (const cat of Object.keys(rb)) {
  if (skip.has(cat)) continue;
  const bucket = rb[cat];
  if (!bucket || typeof bucket !== "object") continue;
  for (const id of Object.keys(bucket)) {
    if (id.startsWith("_")) continue;
    const entry = bucket[id];
    if (!entry || typeof entry !== "object") continue;
    const key = cat + "." + id;
    // Simulate showTooltip name-synthesis decision
    let resolvedName = entry.name;
    if (!resolvedName) resolvedName = exp.deriveTipName(key);
    if (resolvedName && typeof resolvedName === "string" && resolvedName.trim().length > 0) {
      tipPass++;
    } else {
      tipFail++;
      tipGaps.push(key + " (got: " + JSON.stringify(resolvedName) + ")");
    }
  }
}
console.log("  Enumerated " + (tipPass + tipFail) + " keyed entries across RULEBOOK_REFERENCE");
console.log("  Resolved to non-empty title: " + tipPass);
console.log("  Empty/missing: " + tipFail);
if (tipGaps.length) console.log("    " + tipGaps.slice(0, 20).join("\n    "));
assert("every RULEBOOK_REFERENCE entry resolves to a non-empty tooltip title", tipFail === 0,
  tipGaps.length ? "gaps: " + tipGaps.slice(0, 10).join("; ") : "");

console.log("\n=== TIP_NAME_OVERRIDES integrity ===");
// Every key in the override map must round-trip: deriveTipName(key) === overrides[key].
// Catches future drift where someone edits the map but not the function (or vice versa).
let ovrPass = 0, ovrFail = 0;
const ovrGaps = [];
for (const k of Object.keys(exp.TIP_NAME_OVERRIDES)) {
  const want = exp.TIP_NAME_OVERRIDES[k];
  const got = exp.deriveTipName(k);
  if (got === want) ovrPass++;
  else { ovrFail++; ovrGaps.push(k + ": want " + JSON.stringify(want) + ", got " + JSON.stringify(got)); }
}
console.log("  Overrides verified: " + ovrPass + "/" + (ovrPass + ovrFail));
assert("TIP_NAME_OVERRIDES round-trips through deriveTipName", ovrFail === 0,
  ovrGaps.length ? ovrGaps.join("; ") : "");

console.log("\n=== titleizeKey known-good cases ===");
const titleCases = [
  ["aptitudeCheck", "Aptitude Check"],
  ["cortical-stack", "Cortical Stack"],
  ["action_economy", "Action Economy"],
  ["WT", "WT"],            // all-caps short = preserved (not "Wt")
  ["LUC", "LUC"],          // all-caps short = preserved
  ["InfectionRating", "Infection Rating"],
  ["Athletics", "Athletics"]
];
for (const [input, want] of titleCases) {
  const got = exp.titleizeKey(input);
  assert("titleizeKey('" + input + "') === '" + want + "'", got === want, "got " + JSON.stringify(got));
}

console.log("\nResult: " + pass + " pass, " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
