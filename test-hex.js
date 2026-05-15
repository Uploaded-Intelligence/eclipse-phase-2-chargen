// Smoke test: replicate Hex from the EP2 corebook worked example (p83)
// and verify our derived.finalSkills() produces the same numbers as the book.

const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!jsMatch) { console.error("no script block found"); process.exit(1); }
let js = jsMatch[1];

// Mock browser globals minimally so the IIFE doesn't blow up
const sandbox = {
  console,
  document: { createElement: () => ({appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{}}), querySelector: () => null, querySelectorAll: () => [], createTextNode: ()=>({}) },
  window: { addEventListener: () => {}, innerWidth: 1400, scrollTo: () => {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout,
  Blob: function(){}, URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  FileReader: function(){},
  alert: () => {},
  confirm: () => false
};
// Replace boot() so it doesn't render
js = js.replace(/^boot\(\);$/m, "// boot() suppressed for test");
// Expose names from `const`/`let` scope (vm doesn't auto-attach those to context)
js += "\nthis.__exports = { STATE, RULEBOOK_DATA, derived, newState, _setState: (v)=>{STATE=v;} };\n";

// Run the script and capture refs
const vm = require("vm");
const ctx = vm.createContext(sandbox);
vm.runInContext(js, ctx);
const exp = sandbox.__exports;
const { RULEBOOK_DATA, derived, newState } = exp;
let STATE = exp.STATE;

function set(s) {
  Object.assign(STATE.meta, s.meta || {});
  Object.assign(STATE.ego, s.ego || {});
  if (s.morph) Object.assign(STATE.morph, s.morph);
}

// Reset by re-running the same script's STATE = newState() flow
// We need to mutate the in-VM STATE so derived (which closes over it) sees changes
// Use the exposed _setState to swap to a fresh object, then keep mutating that
const fresh = newState();
exp._setState(fresh);
STATE = fresh;

// HEX from p83
// Step 1: Lost, with Know fields: Psychology (60) and Mind Hacks (30)
STATE.ego.background = "lost";
// Lost's skills array indices:
//  0 Deceive 40, 1 Infiltrate 20, 2 Kinesics 40, 3 Perceive 20, 4 Psi 50,
//  5 Know(choose1 common Biology/Psychology/Sociology) 60,
//  6 Know(choose1 common Privacy/Serial Killers/Mind Hacks) 30
STATE.ego.fieldChoices["bg.5"] = "Psychology";
STATE.ego.fieldChoices["bg.6"] = "Mind Hacks";

// Step 2: Face, with Know fields: Smuggling (60), Drugs (30)
STATE.ego.career = "face";
// Face's skills:
//  0 Deceive 40, 1 Kinesics 30, 2 Persuade 60,
//  3 Know(choose1 common Fencing/Police Ops/Smuggling) 60,
//  4 Know(choose1 common Black Markets/Drugs/Underground XP) 30
STATE.ego.fieldChoices["ca.3"] = "Smuggling";
STATE.ego.fieldChoices["ca.4"] = "Drugs";

// Step 3: Async, with Know field: Black Markets (40)
STATE.ego.interest = "async_interest";
// Async skills:
//  0 Deceive 40, 1 Perceive 20, 2 Psi 40, 3 Know(choose1) 40
STATE.ego.fieldChoices["in.3"] = "Black Markets";

// Step 4: Lunar
STATE.ego.faction = "lunar";

// Step 5: Survivor, SAV<->SOM swap (SAV 20, SOM 10)
STATE.ego.aptitudeTemplate = "survivor";
STATE.ego.aptitudes = { COG:15, INT:10, REF:15, SAV:20, SOM:10, WIL:20 };

// Compute final skills (pre-CP, pre-customization)
const fs2 = derived.finalSkills();

// Expected values from book p83 (before Step 6 reallocation):
const expected = {
  "Deceive":          140,
  "Infiltrate":       35,
  "Kinesics":         90,
  "Perceive":         60,
  "Persuade":         80,
  "Psi":              110,
  "Know:Black Markets": 55,
  "Know:Drugs":         45,
  "Know:Lunar / Orbital": 45, // book says "Know: Lunars/Orbitals"; our faction grants Know:[faction.name] = "Lunar / Orbital"
  "Know:Mind Hacks":    45,
  "Know:Psychology":    75,
  "Know:Smuggling":     75
};

console.log("\nHex pre-Step-6 final skills (cap NOT YET applied to compare with book pre-cap):\n");
// Print all our results
const actual = {};
fs2.skills.forEach(s => {
  const key = s.skill + (s.field ? ":" + s.field : "");
  actual[key] = s.raw;
  console.log("  " + key.padEnd(28) + " final=" + s.final + " raw=" + s.raw + " cap=" + s.isCapped);
});

console.log("\n--- Compare to book ---");
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(expected)) {
  const got = actual[k];
  if (got === v) { console.log("  ✓ " + k + " = " + v); pass++; }
  else { console.log("  ✗ " + k + " expected " + v + ", got " + got); fail++; }
}
console.log("\nResult: " + pass + " pass, " + fail + " fail");

// Also check derived stats
const ds = derived.derivedStats();
console.log("\nDerived stats:");
console.log("  Initiative:", ds.initiative, "(expected 5)");
console.log("  Lucidity:", ds.lucidity, "(expected 40)");
console.log("  Trauma Threshold:", ds.traumaThreshold, "(expected 8)");
console.log("  Insanity Rating:", ds.insanityRating, "(expected 80)");
console.log("  COG Check:", ds.aptChecks.COG, "(expected 45)");
console.log("  SAV Check:", ds.aptChecks.SAV, "(expected 60)");

process.exit(fail === 0 ? 0 : 1);
