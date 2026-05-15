// Test the v1 -> v2 migrator against JALTA's three actual save files.
// Each save was produced by the buggy v1 engine. Migration must:
//   1. Re-key allocations from bucket-keyed to slot-keyed
//   2. Drop the leaky synthetic "Know:_deferred_bg.6" key, restoring to the bg.6 slot
//   3. Produce a semantically-sensible character (no orphaned allocations, no negative surplus from migration alone)
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = { STATE, RULEBOOK_DATA, derived, newState, migrateV1ToV2, _setState: (v)=>{STATE=v;} };\n";

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

function loadSaveV1(filePath) {
  // The .json files in Downloads were produced by the old engine and are schemaVersion=1
  // but they have summary blocks. Strip the summary and force migration.
  const raw = fs.readFileSync(filePath, "utf8");
  const obj = JSON.parse(raw);
  delete obj.summary;
  obj.meta.schemaVersion = 1; // force migration regardless of original tag
  return obj;
}

function testJaltaSave(filename, description, expectations) {
  console.log("\n=== " + description + " (" + filename + ") ===");
  const filePath = "/mnt/c/Users/Tze Dean/Downloads/" + filename;
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠ file not found, skipping:", filePath);
    return;
  }
  let save;
  try { save = loadSaveV1(filePath); } catch(e) { console.log("  ✗ parse failed:", e.message); fail++; return; }
  const migrated = exp.migrateV1ToV2(save);

  assert("schema version bumped to 2", migrated.meta.schemaVersion === 2);
  assert("old skillAllocations field gone", !migrated.ego.skillAllocations);
  assert("slotAllocations exists", !!migrated.ego.slotAllocations);
  assert("no key in slotAllocations contains _deferred_", Object.keys(migrated.ego.slotAllocations).every(k => !k.includes("_deferred_")));

  // Apply migrated state and compute final
  exp._setState(migrated);
  const r = exp.derived.finalSkills();

  // No skill should have a synthetic field name like "_deferred_bg.6"
  const leaked = r.skills.filter(s => s.field && s.field.startsWith("_deferred_"));
  assert("no synthetic deferred keys leak into skills array", leaked.length === 0,
    leaked.length ? "leaked: " + leaked.map(s => s.field).join(", ") : "");

  // No skill should appear with field === "" (the old empty-string bug)
  const emptyField = r.skills.filter(s => s.field === "");
  assert("no skill has empty-string field", emptyField.length === 0);

  // Custom expectations per save
  if (expectations) expectations(migrated, r);
}

testJaltaSave("jalta.ep2(1).json", "JALTA save (1): heavy over-allocation under bug", (m, r) => {
  // (1).json had: Athletics 90, Infosec 20, Know:Extropian 45, Know:Nanotechnology 40, Persuade 40, Program 70
  // After migration, these should re-key to slot IDs
  const allocs = m.ego.slotAllocations;
  assert("Athletics allocation maps to bg.0", allocs["bg.0"] === 90, "got " + allocs["bg.0"]);
  assert("Persuade allocation maps to bg.3", allocs["bg.3"] === 40, "got " + allocs["bg.3"]);
  assert("Infosec allocation maps to ca.1", allocs["ca.1"] === 20, "got " + allocs["ca.1"]);
  assert("Know:Nanotechnology maps to ca.4", allocs["ca.4"] === 40, "got " + allocs["ca.4"]);
  assert("Know:Extropian maps to fa.0", allocs["fa.0"] === 45, "got " + allocs["fa.0"]);
});

testJaltaSave("jalta.ep2(2).json", "JALTA save (2): clean 80-point allocation", (m, r) => {
  // (2).json had: Athletics 30, Know:Extropian 25, Know:Nanotechnology 25
  const allocs = m.ego.slotAllocations;
  assert("Athletics → bg.0 (30 pts)", allocs["bg.0"] === 30);
  assert("Know:Extropian → fa.0 (25 pts)", allocs["fa.0"] === 25);
  assert("Know:Nanotechnology → ca.4 (25 pts)", allocs["ca.4"] === 25);
});

testJaltaSave("jalta.ep2(3).json", "JALTA save (3): contains the leaky synthetic key", (m, r) => {
  // (3).json had Athletics 20, Infosec 5, Know:_deferred_bg.6: 5
  const allocs = m.ego.slotAllocations;
  assert("Athletics → bg.0 (20 pts)", allocs["bg.0"] === 20);
  assert("Infosec → ca.1 (5 pts)", allocs["ca.1"] === 5);
  assert("synthetic Know:_deferred_bg.6 → bg.6 (5 pts, no longer orphaned)",
    allocs["bg.6"] === 5, "bg.6 alloc: " + allocs["bg.6"]);
  assert("no '_deferred_' prefix in slot keys", Object.keys(allocs).every(k => !k.includes("_deferred_")));
});

console.log("\nResult: " + pass + " pass, " + fail + " fail");
process.exit(fail === 0 ? 0 : 1);
