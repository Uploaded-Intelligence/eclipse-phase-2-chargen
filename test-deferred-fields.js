// Regression test: deferred field-skill slots must NOT aggregate into a single mega-skill.
// Bug: multiple "Know (choose 1)" entries with no field picked were colliding on the empty-string key
// and stacking, inflating surplus by 70+ points. Caught from JALTA's character.
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = { STATE, RULEBOOK_DATA, derived, newState, _setState: (v)=>{STATE=v;} };\n";

const sandbox = {
  console,
  document: { createElement: () => ({appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{}, style:{}}), querySelector: () => null, querySelectorAll: () => [], createTextNode: ()=>({}) },
  window: { addEventListener: () => {}, innerWidth: 1400, scrollTo: () => {} },
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

console.log("\n=== JALTA with ALL Know fields deferred (the actual bug) ===");
// Hyperelite + Techie + Artist with field choices ONLY for Techie's career fields
const s = exp.newState();
s.ego.background = "hyperelite";
s.ego.career = "techie";
s.ego.interest = "artist";
s.ego.faction = "extropian";
// Only career-side field choices, leave Hyperelite's two Knows and Artist's Know deferred
s.ego.fieldChoices = { "ca.0": "Robotics", "ca.3": "Habitat Ops", "ca.4": "Nanotechnology" };
s.ego.aptitudeTemplate = "facilitator";
s.ego.aptitudes = { COG: 15, INT: 15, REF: 10, SAV: 20, SOM: 10, WIL: 20 };
s.ego.cp.aptitudeBumps = { COG: 9, INT: 6 };
exp._setState(s);

const fs1 = exp.derived.finalSkills();
// Count separate "Know:(pick field →)" buckets — there should be 3, one per deferred slot.
const deferredKnow = fs1.skills.filter(sk => sk.skill === "Know" && (sk.field === "" || sk.field == null));
assert("3 separate deferred-Know buckets (one per slot)", deferredKnow.length === 3,
  "got " + deferredKnow.length + " bucket(s) — they're still colliding");

// Each individual deferred-Know slot should NOT cap on its own (60 + COG24 = 84 caps, 30+24=54 doesn't, 40+24=64 doesn't)
// Specifically: book values are Hyperelite Know 60, Hyperelite Know 30, Artist Know 40
const deferredFinals = deferredKnow.map(s => ({ pkg: s.fromPackages, final: s.final })).sort((a,b)=>b.pkg-a.pkg);
console.log("  deferred-know slots:", deferredFinals);
assert("the 60-point deferred Know has final = 80 (capped, 60+24=84)", deferredFinals[0].final === 80);
assert("the 40-point deferred Know has final = 64 (not capped)", deferredFinals[1].final === 64);
assert("the 30-point deferred Know has final = 54 (not capped)", deferredFinals[2].final === 54);

// Know surplus drops from the buggy 78 to 8: Hyperelite 60-pt deferred Know (60+24=84, overflow 4)
// + Techie's Know:Habitat Ops 60 (60+24=84, overflow 4). 4 + 4 = 8.
assert("initial know surplus = 8 (was 78 with the bug)", fs1.initialSurplus.know === 8,
  "got " + fs1.initialSurplus.know);

// Active surplus unchanged by this fix
assert("initial active surplus = 34 (unchanged)", fs1.initialSurplus.active === 34);

console.log("\n=== Same-field stacking still works: pick same field for two slots → stack ===");
const s2 = exp.newState();
s2.ego.background = "hyperelite";
s2.ego.career = "techie";
s2.ego.aptitudeTemplate = "facilitator";
s2.ego.aptitudes = { COG: 15, INT: 15, REF: 10, SAV: 20, SOM: 10, WIL: 20 };
// Pick the same field for Hyperelite bg.5 and Techie ca.3 — they SHOULD stack
s2.ego.fieldChoices = { "bg.5": "Administration", "ca.3": "Administration", "ca.0": "Robotics" };
exp._setState(s2);
const fs2 = exp.derived.finalSkills();
const knowAdmin = fs2.skills.find(s => s.skill === "Know" && s.field === "Administration");
assert("Know:Administration stacks 60+60 = 120 pkg", knowAdmin && knowAdmin.fromPackages === 120,
  "got " + JSON.stringify(knowAdmin));

console.log("\nResult: " + pass + " pass, " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
