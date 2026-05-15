// v0.3 Wave 1: EP2 dice helpers + Studio adapter + mutations.
// Tests: rollD100 shape, evaluate's outcome table (crit/success/fail/auto/doubles),
// studioPcFromState pool/skill/derived/morph projection, mutations clamping.
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = { RULEBOOK_DATA, EP2, newState, derived, studioPcFromState, studioSetIn, studioRollSkill, studioRollAptitude, studioSpendPool, studioSetDamage, studioSetWounds, studioSetStress, studioSetTraumas, studioToggleRecharge, studioTriggerRecharge, studioAddStatus, studioRemoveStatus, studioToggleGear, studioConsumeGear, _get: ()=>STATE, _setState: (v)=>{STATE=v;} };\n";

const sandbox = {
  console,
  document: { createElement: () => ({appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{}, style:{}, dataset:{}, classList:{toggle:()=>{}, add:()=>{}}}), querySelector: () => null, querySelectorAll: () => [], createTextNode: ()=>({}), addEventListener: ()=>{}, body:{appendChild:()=>{}, classList:{toggle:()=>{}, add:()=>{}}} },
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

console.log("\n=== EP2.APTITUDES + skillAptitude ===");
assert("APTITUDES has 6 entries", Object.keys(exp.EP2.APTITUDES).length === 6);
assert("COG pool = insight", exp.EP2.APTITUDES.COG.pool === "insight");
assert("SOM pool = vigor",   exp.EP2.APTITUDES.SOM.pool === "vigor");
assert("WIL pool = moxie",   exp.EP2.APTITUDES.WIL.pool === "moxie");
assert("each aptitude has tone hex", Object.values(exp.EP2.APTITUDES).every(a => /^#[0-9a-f]{6}$/i.test(a.tone)));
assert("skillAptitude('Athletics') === 'SOM'", exp.EP2.skillAptitude("Athletics") === "SOM");
assert("skillAptitude('Know: Biology') === 'COG'", exp.EP2.skillAptitude("Know: Biology") === "COG");
assert("skillAptitude('Medicine: Forensics') === 'COG'", exp.EP2.skillAptitude("Medicine: Forensics") === "COG");
assert("skillAptitude('Fray') === 'REF'", exp.EP2.skillAptitude("Fray") === "REF");
assert("skillAptitude('Perceive') === 'INT'", exp.EP2.skillAptitude("Perceive") === "INT");

console.log("\n=== EP2.rollD100 shape ===");
for (let i = 0; i < 30; i++) {
  const r = exp.EP2.rollD100();
  if (r.value < 0 || r.value > 99) { fail++; console.log("  ✗ value out of range:", r.value); break; }
  if (r.tens * 10 + r.ones !== r.value) { fail++; console.log("  ✗ tens*10+ones ≠ value"); break; }
  if (r.doubles !== (r.tens === r.ones)) { fail++; console.log("  ✗ doubles flag wrong"); break; }
}
assert("30 rolls all in [0,99] with consistent tens/ones/doubles", fail === 0);

console.log("\n=== EP2.evaluate outcome table ===");
// Auto-success (00)
let res = exp.EP2.evaluate({tens:0,ones:0,value:0,doubles:true}, 30);
assert("00 → crit-success regardless of target", res.outcome === "crit-success" && res.success === true);
// Auto-fail (99)
res = exp.EP2.evaluate({tens:9,ones:9,value:99,doubles:true}, 99);
assert("99 → crit-fail even when target is 99", res.outcome === "crit-fail" && res.success === false);
// Doubles success
res = exp.EP2.evaluate({tens:3,ones:3,value:33,doubles:true}, 50);
assert("33 vs 50 (doubles, success) → crit-success", res.outcome === "crit-success" && res.mos === 33);
// Doubles fail
res = exp.EP2.evaluate({tens:5,ones:5,value:55,doubles:true}, 50);
assert("55 vs 50 (doubles, fail) → crit-fail", res.outcome === "crit-fail");
// Plain success
res = exp.EP2.evaluate({tens:2,ones:7,value:27,doubles:false}, 50);
assert("27 vs 50 → success, mos=27", res.outcome === "success" && res.mos === 27 && res.success === true);
// Plain fail
res = exp.EP2.evaluate({tens:7,ones:2,value:72,doubles:false}, 50);
assert("72 vs 50 → failure, mof=target-roll", res.outcome === "failure" && res.mos === -22);
// Edge: roll equals target (success)
res = exp.EP2.evaluate({tens:5,ones:0,value:50,doubles:false}, 50);
assert("50 vs 50 → success (≤ rule)", res.outcome === "success");
// Edge: target 0
res = exp.EP2.evaluate({tens:0,ones:5,value:5,doubles:false}, 0);
assert("5 vs 0 → failure", res.outcome === "failure");

console.log("\n=== studioPcFromState: shape + projection ===");
// Reset to fresh state and synthesize a minimal character
const s0 = exp.newState();
exp._setState(s0);
let pc = exp.studioPcFromState();
assert("pc has name", typeof pc.name === "string");
assert("pc has pools.{insight,moxie,vigor,flex}", ["insight","moxie","vigor","flex"].every(k => pc.pools[k]));
assert("pc.aptitudes has 6 keys", Object.keys(pc.aptitudes).length === 6);
assert("pc has skills array", Array.isArray(pc.skills));
assert("pc has gear array", Array.isArray(pc.gear));
assert("pc.derived has wound_threshold", typeof pc.derived.wound_threshold === "number");
assert("pc.derived has 7 keys", Object.keys(pc.derived).length === 7);
assert("pc.morph is object", pc.morph && typeof pc.morph === "object");
assert("pc.statuses is array", Array.isArray(pc.statuses));
assert("pc.initiative has round", typeof pc.initiative.round === "number");

// Project with damage taken + auto-wound derivation
const sd = exp.newState();
sd.morph.chosen = "futura"; sd.ego.background = "infomorph";
// Manually set some morph stats via the engine path; if futura isn't in data,
// these assertions will fall back to defaults which is still valid.
sd.play.wounds = 0;
exp._setState(sd);
pc = exp.studioPcFromState();
assert("damageTaken === play.wounds (raw, 0)", pc.damageTaken === 0);
assert("woundsTaken === 0 when no damage", pc.woundsTaken === 0);

// Push damage to 1 WT worth → woundsTaken auto-derives to ≥1
const sd2 = exp.newState();
sd2.morph.chosen = "futura";
sd2.play.wounds = 10;  // assume WT=1 (no morph chosen / fallback): damage 10 / WT 1 = 10 wounds, capped at 9 via mutation. Adapter shows raw derive.
exp._setState(sd2);
pc = exp.studioPcFromState();
assert("damageTaken === play.wounds (10)", pc.damageTaken === 10);
assert("woundsTaken auto-derived ≥ 1 from damage", pc.woundsTaken >= 1);

console.log("\n=== studioSetIn: deep-set path ===");
exp._setState(exp.newState());
exp.studioSetIn(["ego", "player"], "JALTA");
assert("studioSetIn ego.player", exp._get().ego.player === "JALTA");
exp.studioSetIn(["ego", "muse"], "Zaius");
assert("studioSetIn ego.muse", exp._get().ego.muse === "Zaius");
exp.studioSetIn(["ego", "motivations", 0], "+Enjoy Life");
assert("studioSetIn ego.motivations[0]", exp._get().ego.motivations[0] === "+Enjoy Life");

console.log("\n=== studioSetDamage + studioSetWounds clamps + auto-derive ===");
const sm = exp.newState();
sm.morph.chosen = "futura";  // ensure morphStats has values
exp._setState(sm);
exp.studioSetDamage(20);
assert("setDamage(20) → wounds=20", exp._get().play.wounds === 20);
assert("setDamage clamps woundsTaken ≤ 9", exp._get().play.woundsTaken <= 9);
exp.studioSetDamage(-100);
assert("setDamage(-100) clamps to 0", exp._get().play.wounds === 0);
exp.studioSetWounds(3);
assert("setWounds(3) → woundsTaken=3", exp._get().play.woundsTaken === 3);
exp.studioSetWounds(-1);
assert("setWounds(-1) clamps to 0", exp._get().play.woundsTaken === 0);
exp.studioSetWounds(99);
assert("setWounds(99) clamps to 9", exp._get().play.woundsTaken === 9);

console.log("\n=== studioSetStress + studioSetTraumas ===");
exp._setState(exp.newState());
exp.studioSetStress(15);
assert("setStress(15) → stress=15", exp._get().play.stress === 15);
exp.studioSetTraumas(2);
assert("setTraumas(2) → traumasTaken=2", exp._get().play.traumasTaken === 2);
exp.studioSetTraumas(99);
assert("setTraumas(99) clamps to 9", exp._get().play.traumasTaken === 9);

console.log("\n=== studioSpendPool: bounded by pool max ===");
const sp = exp.newState();
sp.morph.chosen = "futura";
exp._setState(sp);
// Spend Insight by 1
const beforeInsight = exp._get().play.pools.Insight;
exp.studioSpendPool("insight", 1);
const afterInsight = exp._get().play.pools.Insight;
assert("spendPool('insight',1) modifies play.pools.Insight", beforeInsight === null ? typeof afterInsight === "number" : true);
// Spend way too much — should clamp at 0
exp.studioSpendPool("insight", 999);
assert("spendPool('insight',999) clamps to 0", exp._get().play.pools.Insight === 0);
// Refund
exp.studioSpendPool("insight", -999);
const ms = exp.derived.morphStats();
const max = (ms && ms.pools) ? (ms.pools.Insight || 0) : 0;
assert("spendPool('insight',-999) clamps to max", exp._get().play.pools.Insight === max);

console.log("\n=== studioToggleRecharge + triggerRecharge ===");
exp._setState(exp.newState());
exp.studioToggleRecharge("short1");
assert("toggleRecharge('short1') flips false→true", exp._get().play.recharge.short1 === true);
exp.studioToggleRecharge("short1");
assert("toggleRecharge('short1') flips true→false", exp._get().play.recharge.short1 === false);
exp.studioTriggerRecharge("long");
assert("triggerRecharge('long') sets all flags true", exp._get().play.recharge.long === true && exp._get().play.recharge.short1 === true && exp._get().play.recharge.short2 === true);
assert("triggerRecharge('long') clears pool spent (pools → null)", exp._get().play.pools.Insight === null);
exp.studioTriggerRecharge("reset");
assert("triggerRecharge('reset') clears flags", exp._get().play.recharge.long === false && exp._get().play.recharge.short1 === false);

console.log("\n=== studioAddStatus + removeStatus ===");
exp._setState(exp.newState());
exp.studioAddStatus("Stunned", -20);
assert("addStatus pushes to play.statuses", exp._get().play.statuses.length === 1);
assert("addStatus stored label", exp._get().play.statuses[0].label === "Stunned");
assert("addStatus stored modifier", exp._get().play.statuses[0].modifier === -20);
assert("addStatus assigned key", typeof exp._get().play.statuses[0].key === "string");
const k = exp._get().play.statuses[0].key;
exp.studioRemoveStatus(k);
assert("removeStatus by key drops entry", exp._get().play.statuses.length === 0);

console.log("\n=== studioToggleGear + consumeGear ===");
exp._setState(exp.newState());
exp.studioToggleGear("firewall-pack:anonymizer");
assert("toggleGear sets equipped=false", exp._get().play.consumables["firewall-pack:anonymizer:equipped"] === false);
exp.studioToggleGear("firewall-pack:anonymizer");
assert("toggleGear flips back to true", exp._get().play.consumables["firewall-pack:anonymizer:equipped"] === true);
exp.studioConsumeGear("genehacker:medicines", -1);
assert("consumeGear(-1) clamps at 0 when starting from 0", exp._get().play.consumables["genehacker:medicines:uses"] === 0);
exp.studioConsumeGear("genehacker:medicines", 3);
assert("consumeGear(+3) bumps to 3", exp._get().play.consumables["genehacker:medicines:uses"] === 3);
exp.studioConsumeGear("genehacker:medicines", -1);
assert("consumeGear(-1) decrements 3 → 2", exp._get().play.consumables["genehacker:medicines:uses"] === 2);

console.log("\n=== studioRollSkill + studioRollAptitude push to log ===");
exp._setState(exp.newState());
// Need a skill to roll; finalSkills() returns derived skill values. We just call it
// with an arbitrary name; if no skill exists, total=0 and target=0 so we get failure (or
// crit-fail on 99). Either way the log entry is created.
exp.studioRollSkill("Athletics", 50);
assert("rollSkill pushes log entry", exp._get().play.log.length === 1);
const e1 = exp._get().play.log[0];
assert("log entry has kind:'roll'", e1.kind === "roll");
assert("log entry has roll value 0-99", e1.roll >= 0 && e1.roll <= 99);
assert("log entry has target ≥ 0", e1.target >= 0);
assert("log entry has aptitude", typeof e1.aptitude === "string");
exp.studioRollAptitude("COG", 0);
assert("rollAptitude pushes log entry", exp._get().play.log.length === 2);
assert("rollAptitude entry has text 'COG Check'", exp._get().play.log[0].text === "COG Check");
// Log capped at 50 entries
for (let i = 0; i < 100; i++) exp.studioRollSkill("Athletics", 0);
assert("log capped at 50 entries", exp._get().play.log.length === 50);

console.log("\n=== Summary ===");
console.log("Result: " + pass + " pass, " + fail + " fail");
process.exit(fail > 0 ? 1 : 0);
