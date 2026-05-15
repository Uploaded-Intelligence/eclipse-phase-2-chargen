// v0.6 regression: corebook morph catalog completeness, schema integrity,
// swarm-form edge case, infomorph framing, and v0.5.3-class projection bugs.
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = { STATE, RULEBOOK_DATA, RULEBOOK_REFERENCE, derived, studioPcFromState, newState, _setState: (v)=>{STATE=v;} };\n";

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

const morphs = exp.RULEBOOK_DATA.morphs;
const morphArr = Object.values(morphs);

console.log("\n=== Catalog completeness (corebook canonical) ===");
assert("morph catalog has 45 entries (21 v0.5.3 + 24 v0.6 new incl. 4 flexbots)",
  morphArr.length === 45, "got " + morphArr.length);

// Per-category counts (additive — tolerates re-categorization)
const byCat = {};
morphArr.forEach(m => {
  const cat = m.subtype === "flexbot" ? "flexbot"
            : m.subtype === "uplift"  ? "uplift"
            : m.type;
  byCat[cat] = (byCat[cat] || 0) + 1;
});
assert("biomorph count >= 14 (common humanoids + advanced)",
  (byCat.biomorph || 0) >= 14, "got " + (byCat.biomorph || 0));
assert("uplift count === 6", (byCat.uplift || 0) === 6, "got " + (byCat.uplift || 0));
assert("pod count === 6", (byCat.pod || 0) === 6, "got " + (byCat.pod || 0));
assert("synthmorph count >= 11", (byCat.synthmorph || 0) >= 11, "got " + (byCat.synthmorph || 0));
assert("flexbot count === 4", (byCat.flexbot || 0) === 4, "got " + (byCat.flexbot || 0));
assert("infomorph count === 4", (byCat.infomorph || 0) === 4, "got " + (byCat.infomorph || 0));

console.log("\n=== Every morph has required fields ===");
let badMorphs = [];
for (const m of morphArr) {
  if (!(m.id && m.name && m.type && m.tier
    && typeof m.cost === "number"
    && typeof m.DUR === "number" && m.DUR > 0
    && typeof m.DR === "number" && m.DR > 0
    && m.pools && typeof m.pools === "object"
    && Array.isArray(m.ware)
    && Array.isArray(m.traits)
    && typeof m.blurb === "string" && m.blurb.length > 0
    && Array.isArray(m.vibes))) {
    badMorphs.push(m.id || JSON.stringify(m).slice(0,40));
  }
}
assert("all morphs have full required-field shape", badMorphs.length === 0, "bad: " + badMorphs.join(", "));

console.log("\n=== WT is number ≥ 1 OR morph has swarm: true ===");
let badWT = [];
for (const m of morphArr) {
  const ok = (typeof m.WT === "number" && m.WT >= 1) || m.swarm === true;
  if (!ok) badWT.push(m.id);
}
assert("WT integrity across catalog", badWT.length === 0, "bad: " + badWT.join(", "));

console.log("\n=== Pool object always has all 4 keys ===");
let badPools = [];
for (const m of morphArr) {
  const p = m.pools;
  if (!(("Insight" in p) && ("Moxie" in p) && ("Vigor" in p) && ("Flex" in p))) {
    badPools.push(m.id);
  }
}
assert("all morphs have full pools{Insight,Moxie,Vigor,Flex}", badPools.length === 0, "bad: " + badPools.join(", "));

console.log("\n=== Swarmanoid edge case ===");
const swarm = morphs.swarmanoid;
assert("swarmanoid exists in catalog", !!swarm);
assert("swarmanoid.swarm === true", swarm && swarm.swarm === true);
assert("swarmanoid.WT === 0 (sentinel; swarm flag handles wound math)", swarm && swarm.WT === 0);
assert("swarmanoid.DUR === 40", swarm && swarm.DUR === 40);
assert("swarmanoid notes mentions Swarm Attack", swarm && swarm.notes && swarm.notes.includes("Swarm Attack"));

console.log("\n=== Reaper edge case (12 MP — highest cost in corebook) ===");
const reaper = morphs.reaper;
assert("reaper exists", !!reaper);
assert("reaper.cost === 12", reaper && reaper.cost === 12);
assert("reaper has Heavy Frame armor 12/10", reaper && reaper.armor && reaper.armor.energy === 12 && reaper.armor.kinetic === 10);

console.log("\n=== Neo-Octopus (octomorph) multi-trait edge case ===");
const octo = morphs["neo-octopus"];
assert("neo-octopus exists", !!octo);
assert("octomorph has Exotic Morphology trait", octo && octo.traits.some(t => t.name === "Exotic Morphology"));
assert("octomorph has Limberness trait", octo && octo.traits.some(t => t.name === "Limberness"));
assert("octomorph has Non-Human Biochemistry trait", octo && octo.traits.some(t => t.name === "Non-Human Biochemistry"));
assert("octomorph notes mention Beak Attack", octo && octo.notes && octo.notes.includes("Beak Attack"));

console.log("\n=== studioPcFromState passes through new morph fields ===");
const s = exp.newState();
s.morph.chosen = "swarmanoid";
exp._setState(s);
const pc = exp.studioPcFromState();
assert("pc.morph.id === 'swarmanoid'", pc.morph.id === "swarmanoid");
assert("pc.morph.swarm === true", pc.morph.swarm === true);
assert("pc.morph.notes contains 'Swarm Attack'", pc.morph.notes && pc.morph.notes.includes("Swarm Attack"));
assert("pc.morph.WT === 0 (passed through)", pc.morph.WT === 0);
assert("pc.morph.DUR === 40 (passed through)", pc.morph.DUR === 40);

const s2 = exp.newState();
s2.morph.chosen = "digimorph";
exp._setState(s2);
const pcInfo = exp.studioPcFromState();
assert("infomorph type === 'INFOMORPH' (uppercased)", pcInfo.morph.type === "INFOMORPH");
assert("infomorph swarm === false", pcInfo.morph.swarm === false);

const s3 = exp.newState();
s3.morph.chosen = "flexbot_crafter";
exp._setState(s3);
const pcFlex = exp.studioPcFromState();
assert("flexbot subtype passes through === 'flexbot'", pcFlex.morph.subtype === "flexbot");

console.log("\n=== Lexicon (RULEBOOK_REFERENCE.morphs) coverage ===");
const lex = exp.RULEBOOK_REFERENCE.morphs;
let missingLex = [];
for (const m of morphArr) {
  if (!lex[m.id]) missingLex.push(m.id);
}
assert("every morph has a Lexicon entry for tooltips", missingLex.length === 0, "missing: " + missingLex.join(", "));

console.log("\n=== v0.5.3 regression — studioPcFromState skills projection ===");
// This assertion catches the class of bug where studioPcFromState reads finalSkills()
// as a flat map instead of {skills, surplus, ...}. A hyperelite character with default
// aptitudes WILL allocate skill points via the lifepath; pc.skills must reflect that.
const s4 = exp.newState();
s4.ego.background = "hyperelite";
s4.ego.aptitudes = {COG:15,INT:15,REF:10,SAV:20,SOM:10,WIL:20};
exp._setState(s4);
const pcSkills = exp.studioPcFromState();
assert("v0.5.3 regression — hyperelite + default aptitudes produces non-empty pc.skills",
  Array.isArray(pcSkills.skills) && pcSkills.skills.length > 0,
  "pc.skills.length === " + (pcSkills.skills && pcSkills.skills.length));

console.log("\n=== ID convention sanity ===");
assert("kebab-case uplift IDs (neo-*)", morphs["neo-avian"] && morphs["neo-octopus"] && morphs["neo-orangutan"]);
assert("snake_case multi-word IDs (worker_pod, steel_morph, flexbot_*)",
  morphs.worker_pod && morphs.steel_morph && morphs.flexbot_crafter && morphs.flexbot_fighter);

console.log("\n=========================================");
console.log("FINAL: " + pass + " pass, " + fail + " fail");
console.log("=========================================");
if (fail > 0) process.exit(1);
