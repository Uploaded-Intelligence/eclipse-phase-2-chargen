// Regression test: surplus-pool semantics. Driven by the JALTA bug report.
// The key invariant: spending from surplus must MONOTONICALLY DECREASE remaining surplus.
// Pre-fix bug: clicking +5 on a capped skill kept surplus constant (over-cap fed back into the pool).
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

function freshJalta() {
  const s = exp.newState();
  s.ego.background = "hyperelite";
  s.ego.career = "techie";
  s.ego.interest = "artist";
  s.ego.faction = "extropian";
  s.ego.fieldChoices = { "ca.0": "Robotics", "ca.3": "Habitat Ops", "ca.4": "Nanotechnology" };
  s.ego.aptitudeTemplate = "facilitator";
  s.ego.aptitudes = { COG: 15, INT: 15, REF: 10, SAV: 20, SOM: 10, WIL: 20 };
  s.ego.cp.aptitudeBumps = { COG: 9, INT: 6 };
  exp._setState(s);
  return s;
}

let pass = 0, fail = 0;
const assert = (label, cond, extra) => { if (cond) { console.log("  ✓", label); pass++; } else { console.log("  ✗", label, extra||""); fail++; } };

console.log("\n=== JALTA: initial surplus computed from packages+aptitudes ONLY ===");
const s1 = freshJalta();
const fs1 = exp.derived.finalSkills();
// Hand-computed expected (post deferred-field-aggregation fix):
//   Active overflow: Deceive 10 + Hardware:Robotics 4 + Kinesics 10 + Provoke 10 = 34
//   Know overflow:   Hyperelite's 60-pt deferred Know overflows 4 + Know:Habitat Ops 4 = 8
//     (NOT 78 — that was the buggy mega-Know-bucket result)
assert("initial active surplus = 34", fs1.initialSurplus.active === 34, "got " + fs1.initialSurplus.active);
assert("initial know surplus = 8 (deferred slots don't aggregate)", fs1.initialSurplus.know === 8, "got " + fs1.initialSurplus.know);
assert("nothing spent yet", fs1.spent.active === 0 && fs1.spent.know === 0);
assert("remaining active = 34", fs1.surplus.active === 34);
assert("remaining know = 8", fs1.surplus.know === 8);

console.log("\n=== Spending 5 active on Athletics (uncapped) reduces surplus by 5 ===");
const s2 = freshJalta();
// Athletics is Hyperelite's first skill (bg.0). Allocate 5 to its slot.
s2.ego.slotAllocations = { "bg.0": 5 };
exp._setState(s2);
const fs2 = exp.derived.finalSkills();
assert("remaining active = 29 (was 34, spent 5)", fs2.surplus.active === 29, "got " + fs2.surplus.active);
assert("initial unchanged (still 34)", fs2.initialSurplus.active === 34);
assert("spent active = 5", fs2.spent.active === 5);
assert("nothing wasted (Athletics had room)", fs2.wasted.active === 0);

console.log("\n=== Bug case: spending 90 on Athletics (already at 80 cap after just 50) ===");
const s3 = freshJalta();
s3.ego.slotAllocations = { "bg.0": 90 };
exp._setState(s3);
const fs3 = exp.derived.finalSkills();
// Athletics preAlloc = 30 pkg + 10 apt = 40. Headroom = 40. 90 allocated → 40 effective, 50 wasted.
assert("Athletics final = 80 (capped)", fs3.skills.find(s => s.skill === "Athletics").final === 80);
assert("spent active = 90", fs3.spent.active === 90);
assert("wasted active = 50", fs3.wasted.active === 50);
assert("remaining active = -56 (overspent)", fs3.surplus.active === 0 && fs3.overspent.active === 56,
  "got surplus.active=" + fs3.surplus.active + " overspent=" + fs3.overspent.active);

console.log("\n=== Full JALTA save: detects overspending in user's actual character ===");
const s4 = freshJalta();
// JALTA's allocations mapped to slot IDs:
// Athletics = bg.0, Infosec = ca.1, Persuade = bg.3, Program = ca.2,
// Know:Extropian = fa.0, Know:Nanotechnology = ca.4
s4.ego.slotAllocations = { "bg.0": 90, "ca.1": 20, "fa.0": 45, "ca.4": 40, "bg.3": 40, "ca.2": 70 };
exp._setState(s4);
const fs4 = exp.derived.finalSkills();
assert("active spent = 90+20+40+70 = 220", fs4.spent.active === 220);
assert("know spent = 45+40 = 85", fs4.spent.know === 85);
assert("overspent active = 220-34 = 186", fs4.overspent.active === 186);
assert("overspent know = 85-8 = 77 (post-fix)", fs4.overspent.know === 77, "got " + fs4.overspent.know);
assert("remaining clamps at 0", fs4.surplus.active === 0 && fs4.surplus.know === 0);

console.log("\n=== Monotonicity: clicking +5 N times → surplus decreases monotonically ===");
const s5 = freshJalta();
let prevActiveSurplus = 999;
for (let n = 0; n < 8; n++) {
  s5.ego.slotAllocations = { "bg.3": n * 5 }; // Persuade slot
  exp._setState(s5);
  const cur = exp.derived.finalSkills();
  if (n > 0 && cur.surplus.active >= prevActiveSurplus) {
    fail++; console.log("  ✗ surplus did NOT decrease at step", n, "prev=" + prevActiveSurplus, "cur=" + cur.surplus.active);
  }
  prevActiveSurplus = cur.surplus.active;
}
console.log("  ✓ surplus decreased monotonically through 8 allocations (final remaining=" + prevActiveSurplus + ")");
pass++;

console.log("\nResult: " + pass + " pass, " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
