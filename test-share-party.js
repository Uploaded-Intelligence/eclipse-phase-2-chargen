// v0.7 regression: Constellation — share URLs, party page schema, GM tracking overlay.
// Coverage: URL encode/decode round-trip, portrait strip, schema v7 fields,
// gmNotes preservation across re-import, characterId stability, identity de-dup.
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = Object.defineProperties({}, {STATE:{get:()=>STATE,enumerable:true},RULEBOOK_DATA:{value:RULEBOOK_DATA,enumerable:true},RULEBOOK_REFERENCE:{value:RULEBOOK_REFERENCE,enumerable:true},derived:{value:derived,enumerable:true},newState:{value:newState,enumerable:true},encodeShareUrl:{value:encodeShareUrl,enumerable:true},decodeShareUrl:{value:decodeShareUrl,enumerable:true},stripPortrait:{value:stripPortrait,enumerable:true},importShareSnapshot:{value:importShareSnapshot,enumerable:true},makeCharacterId:{value:makeCharacterId,enumerable:true},migrateV6ToV7:{value:migrateV6ToV7,enumerable:true},migrateToCurrent:{value:migrateToCurrent,enumerable:true},SCHEMA_VERSION:{value:SCHEMA_VERSION,enumerable:true},LZString:{value:LZString,enumerable:true},studioPcFromState:{value:studioPcFromState,enumerable:true},studioHealDamage:{value:studioHealDamage,enumerable:true},studioHealWound:{value:studioHealWound,enumerable:true},studioHealStress:{value:studioHealStress,enumerable:true},studioHealTrauma:{value:studioHealTrauma,enumerable:true},characterHasFabber:{value:characterHasFabber,enumerable:true},_setState:{value:(v)=>{STATE=v;},enumerable:true}});\n";

const sandbox = {
  console,
  self: {},
  globalThis: {},
  document: { createElement: () => ({appendChild:()=>{}, setAttribute:()=>{}, addEventListener:()=>{}, style:{}, dataset:{}, classList:{toggle:()=>{}}}), querySelector:()=>null, querySelectorAll:()=>[], createTextNode:()=>({}), addEventListener:()=>{}, getElementById:()=>null, body:{appendChild:()=>{}, classList:{toggle:()=>{}}} },
  window: { addEventListener: () => {}, innerWidth: 1400, scrollTo: () => {}, scrollY: 0, innerHeight: 900 },
  location: { hash: "", pathname: "/", origin: "https://test.example", search: "" },
  history: { replaceState: () => {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout, alert: () => {}, confirm: () => true,
  Blob: function(){}, URL: { createObjectURL: () => "", revokeObjectURL: () => {} },
  FileReader: function(){},
  fetch: () => Promise.reject(new Error("network mocked off"))
};
const ctx = vm.createContext(sandbox);
vm.runInContext(js, ctx);
const exp = sandbox.__exports;

let pass = 0, fail = 0;
const assert = (label, cond, extra) => { if (cond) { console.log("  ✓", label); pass++; } else { console.log("  ✗", label, extra||""); fail++; } };

console.log("\n=== Schema v7 fields present in newState ===");
const fresh = exp.newState();
assert("ego.characterId === null (lazy)", fresh.ego.characterId === null);
assert("ego.liveShareUrl === null", fresh.ego.liveShareUrl === null);
assert("partyImports is array (still)", Array.isArray(fresh.partyImports));

console.log("\n=== LZString vendored + functional ===");
assert("LZString exposed as global", typeof exp.LZString === "object" || typeof exp.LZString === "function");
assert("LZString.compressToEncodedURIComponent is callable", typeof exp.LZString.compressToEncodedURIComponent === "function");
// LZ compression has dictionary overhead, so tiny inputs aren't shorter.
// Use a realistic character-sized payload (~3KB JSON) to test actual compression.
const sample = JSON.stringify({
  ego:{name:"Test",skills:Array.from({length:20},(_, i)=>({skill:"Skill"+i,total:50+i,aptitude:"COG"})),
       narrative:{backstory:"Born on Luna. ".repeat(40), concept:"shadowy operative", quote:"keep moving"}},
  morph:{name:"Exalt",ware:["Biomods","Cortical Stack","Mesh Inserts","Mnemonics"]}
});
const compressed = exp.LZString.compressToEncodedURIComponent(sample);
const back = exp.LZString.decompressFromEncodedURIComponent(compressed);
assert("LZ round-trip preserves JSON", back === sample);
assert("LZ compression actually compresses realistic payloads (~3KB → typically 30-50% smaller)",
  compressed.length < sample.length, "sample=" + sample.length + " compressed=" + compressed.length);

console.log("\n=== encodeShareUrl / decodeShareUrl round-trip ===");
const builtChar = exp.newState();
builtChar.ego.name = "Test Hero";
builtChar.ego.background = "hyperelite";
builtChar.ego.aptitudes = {COG:15,INT:15,REF:10,SAV:20,SOM:10,WIL:20};
builtChar.morph.chosen = "exalt";
exp._setState(builtChar);
const shareUrl = exp.encodeShareUrl(builtChar, {});
assert("encodeShareUrl returns a non-empty string", typeof shareUrl === "string" && shareUrl.length > 0);
assert("encodeShareUrl URL contains #share=", shareUrl.indexOf("#share=") >= 0);
const decoded = exp.decodeShareUrl(shareUrl);
assert("decodeShareUrl returns the parsed state object", decoded && typeof decoded === "object");
assert("decoded.ego.name preserved", decoded.ego.name === "Test Hero");
assert("decoded.ego.background preserved", decoded.ego.background === "hyperelite");
assert("decoded.morph.chosen preserved", decoded.morph.chosen === "exalt");
assert("decoded.meta.schemaVersion === 7", decoded.meta.schemaVersion === 7);

console.log("\n=== decodeShareUrl tolerates raw payload and malformed input ===");
const rawPayload = shareUrl.slice(shareUrl.indexOf("#share=") + 7);
const decodedRaw = exp.decodeShareUrl(rawPayload);
assert("decodeShareUrl(rawPayload) decodes the raw payload", decodedRaw && decodedRaw.ego && decodedRaw.ego.name === "Test Hero");
assert("decodeShareUrl(null) returns null", exp.decodeShareUrl(null) === null);
assert("decodeShareUrl('') returns null", exp.decodeShareUrl("") === null);
assert("decodeShareUrl('#share=garbage!!!') returns null", exp.decodeShareUrl("#share=garbage!!!") === null);

console.log("\n=== stripPortrait actually strips ===");
const withPortrait = exp.newState();
withPortrait.ego.name = "Portrait Test";
withPortrait.ego.narrative.avatarDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRgABA" + "x".repeat(20000); // ~20KB fake portrait
const stripped = exp.stripPortrait(withPortrait);
assert("stripPortrait clears avatarDataUrl", stripped.ego.narrative.avatarDataUrl === null);
assert("stripPortrait does NOT mutate the input", withPortrait.ego.narrative.avatarDataUrl && withPortrait.ego.narrative.avatarDataUrl.length > 1000);

const urlWithPortrait = exp.encodeShareUrl(withPortrait, {stripPortrait: false});
const urlStripped = exp.encodeShareUrl(withPortrait, {stripPortrait: true});
assert("stripped URL is meaningfully shorter than with-portrait URL", urlStripped.length < urlWithPortrait.length);
assert("stripped URL is < 6KB for typical character without portrait", urlStripped.length < 6000, "got " + urlStripped.length + " bytes");

console.log("\n=== makeCharacterId is unique + stable ===");
const id1 = exp.makeCharacterId();
const id2 = exp.makeCharacterId();
assert("makeCharacterId() returns a string", typeof id1 === "string");
assert("makeCharacterId() returns unique values", id1 !== id2);
assert("makeCharacterId() returns 'id-...' fallback or UUID pattern", id1.length >= 8);

console.log("\n=== migrateV6ToV7 — partyImports get gmNotes shape ===");
const v6state = {
  meta:{schemaVersion:6,mode:"chargen"},
  ego:{name:"Old", narrative:{teamBrief:"",backstory:""}},
  morph:{chosen:null},
  partyImports:[{
    name:"Old Ally", concept:"hacker", lifepath:"hyperelite",
    coverage:{combat:30,face:20,hacker:60,sci:40},
    full:{summary:{exportedAt:"2026-05-10T00:00:00Z"}}
  }]
};
const v7state = exp.migrateV6ToV7(JSON.parse(JSON.stringify(v6state)));
assert("v6->v7 sets schemaVersion=7", v7state.meta.schemaVersion === 7);
assert("v6->v7 ego.characterId === null (lazy)", v7state.ego.characterId === null);
assert("v6->v7 partyImports[0].id === null (lazy)", v7state.partyImports[0].id === null);
assert("v6->v7 partyImports[0].source === 'file'", v7state.partyImports[0].source === "file");
assert("v6->v7 partyImports[0].gmNotes.wounds === 0", v7state.partyImports[0].gmNotes.wounds === 0);
assert("v6->v7 partyImports[0].gmNotes.statusEffects is array", Array.isArray(v7state.partyImports[0].gmNotes.statusEffects));
assert("v6->v7 partyImports[0].syncUrl === null", v7state.partyImports[0].syncUrl === null);
assert("v6->v7 lastSyncedAt derived from summary.exportedAt", v7state.partyImports[0].lastSyncedAt === "2026-05-10T00:00:00Z");

console.log("\n=== importShareSnapshot — identity-based de-dup preserves gmNotes ===");
// Build a fresh state with one existing party member (id = 'aaa') who has gmNotes
const stateWithParty = exp.newState();
stateWithParty.partyImports.push({
  id: "aaa", name: "Sara", concept: "hacker", lifepath: "hyperelite",
  coverage: { combat: 30, face: 20, hacker: 70, sci: 50 },
  source: "url", lastSyncedAt: "2026-05-15T00:00:00Z",
  gmNotes: { wounds: 3, stress: 1, initiative: 12, statusEffects:[], notes: "Hidden in next room" },
  syncUrl: null,
  full: { meta:{schemaVersion:7}, ego:{characterId:"aaa", name:"Sara"} }
});
exp._setState(stateWithParty);

// Now re-import the same character with updated stats — should preserve gmNotes
const reImport = exp.newState();
reImport.ego.characterId = "aaa";
reImport.ego.name = "Sara Updated";
reImport.morph.chosen = "ghost"; // changed morph
// importShareSnapshot dispatches state mutations via dispatch(); we hand it a state-like
// object that mimics what decodeShareUrl returns.
exp.importShareSnapshot(reImport, true, "URL");
const finalState = exp.STATE || sandbox.__exports.STATE;
const after = finalState.partyImports[0];
assert("after re-import, partyImports length is still 1 (de-duped)", finalState.partyImports.length === 1);
assert("after re-import, .full.ego.name updated to 'Sara Updated'", after.full.ego.name === "Sara Updated");
assert("after re-import, gmNotes.wounds=3 preserved", after.gmNotes.wounds === 3);
assert("after re-import, gmNotes.initiative=12 preserved", after.gmNotes.initiative === 12);
assert("after re-import, gmNotes.notes='Hidden in next room' preserved", after.gmNotes.notes === "Hidden in next room");
assert("after re-import, .id stays 'aaa'", after.id === "aaa");

console.log("\n=== Different characterId creates a NEW partyImport entry ===");
const newPC = exp.newState();
newPC.ego.characterId = "bbb"; // different id
newPC.ego.name = "Jax";
exp.importShareSnapshot(newPC, true, "URL");
assert("after importing different id, partyImports length === 2", exp.STATE.partyImports.length === 2);
const jax = exp.STATE.partyImports.find(p => p.id === "bbb");
assert("Jax import has id 'bbb'", jax && jax.id === "bbb");
assert("Jax import has fresh gmNotes (wounds=0)", jax && jax.gmNotes && jax.gmNotes.wounds === 0);
assert("Sara's gmNotes still preserved on the OTHER entry", exp.STATE.partyImports.find(p => p.id === "aaa").gmNotes.wounds === 3);

console.log("\n=== Source field flows through importShareSnapshot ===");
// Reset
exp._setState(exp.newState());
const livePC = exp.newState();
livePC.ego.characterId = "ccc";
livePC.ego.name = "Mia";
exp.importShareSnapshot(livePC, true, "LIVE");
assert("import via LIVE label → source='live'", exp.STATE.partyImports[0].source === "live");
exp._setState(exp.newState());
exp.importShareSnapshot(livePC, true, "URL");
assert("import via URL label → source='url'", exp.STATE.partyImports[0].source === "url");

console.log("\n=== URL size budgets ===");
const minimal = exp.newState();
minimal.ego.name = "Min";
minimal.ego.background = "hyperelite";
const minUrl = exp.encodeShareUrl(minimal, {});
assert("minimal-character URL < 2KB", minUrl.length < 2000, "got " + minUrl.length);

const big = exp.newState();
big.ego.name = "Big Hero";
big.ego.background = "hyperelite";
big.ego.aptitudes = {COG:18,INT:15,REF:12,SAV:18,SOM:14,WIL:20};
big.ego.narrative.backstory = "Long backstory. ".repeat(100); // ~1.6KB narrative
const bigUrl = exp.encodeShareUrl(big, {});
assert("character with long backstory URL still < 10KB", bigUrl.length < 10000, "got " + bigUrl.length);

console.log("\n=== v0.8 — Weapons flow through pc.gear to attack panel ===");
const sw = exp.newState();
sw.ego.career = "soldier";
sw.morph.chosen = "olympian";
exp._setState(sw);
const pcSoldier = exp.studioPcFromState();
const soldierWeapons = (pcSoldier.gear || []).filter(g => g.weapon);
assert("soldier career + olympian morph produces at least one weapon in pc.gear", soldierWeapons.length > 0, "weapons=" + JSON.stringify(soldierWeapons.map(w => w.name)));

const sf = exp.newState();
// Firewall is the default campaign; pick any career.
sf.ego.career = "hacker";
sf.morph.chosen = "exalt";
exp._setState(sf);
const pcFirewall = exp.studioPcFromState();
const firewallWeapons = (pcFirewall.gear || []).filter(g => g.weapon);
assert("firewall campaign + any career has Medium Pistol from campaign pack", firewallWeapons.some(g => /medium pistol/i.test(g.name)));

console.log("\n=== v0.8 — Healing dispatchers ===");
const sh = exp.newState();
sh.ego.background = "hyperelite";
sh.ego.aptitudes = {COG:15,INT:15,REF:10,SAV:20,SOM:10,WIL:20};
sh.morph.chosen = "galatea";
sh.play.wounds = 16;       // raw damage
sh.play.woundsTaken = 2;   // wound count
sh.play.stress = 12;
sh.play.traumasTaken = 1;
exp._setState(sh);

// Heal damage by 1: wounds should drop to 15, woundsTaken stays at 2
exp.studioHealDamage(1);
assert("studioHealDamage(1) reduces raw damage by 1", exp.STATE.play.wounds === 15);
assert("studioHealDamage does NOT touch woundsTaken", exp.STATE.play.woundsTaken === 2);

// Heal one wound: woundsTaken drops by 1 AND raw damage drops by WT (Galatea WT=8)
exp.studioHealWound(1);
assert("studioHealWound(1) reduces woundsTaken by 1", exp.STATE.play.woundsTaken === 1);
assert("studioHealWound(1) reduces raw damage by morph WT (8 for Galatea)", exp.STATE.play.wounds === 7, "got " + exp.STATE.play.wounds);

// Heal stress: stress drops, traumasTaken stays
exp.studioHealStress(1);
assert("studioHealStress(1) reduces stress by 1", exp.STATE.play.stress === 11);
assert("studioHealStress does NOT touch traumasTaken", exp.STATE.play.traumasTaken === 1);

// Heal trauma: traumasTaken drops AND stress drops by TT
exp.studioHealTrauma(1);
assert("studioHealTrauma(1) reduces traumasTaken by 1", exp.STATE.play.traumasTaken === 0);
const tt = exp.derived.derivedStats().traumaThreshold || 1;
assert("studioHealTrauma(1) reduces stress by TT (=" + tt + ")", exp.STATE.play.stress === Math.max(0, 11 - tt), "stress=" + exp.STATE.play.stress + " expected=" + Math.max(0, 11 - tt));

// Underflow guards
exp.studioHealDamage(99999);
assert("studioHealDamage underflow guard", exp.STATE.play.wounds === 0);

console.log("\n=== v0.8 — characterHasFabber detection ===");
const pcNoFab = { gear: [{name:"Medium Pistol"},{name:"Mesh Inserts"}] };
assert("no fabber detected", exp.characterHasFabber(pcNoFab) === null);
const pcMedFab = { gear: [{name:"Medium Fabber"},{name:"Tool Kit"}] };
assert("medium fabber detected", exp.characterHasFabber(pcMedFab) === "medium");
const pcCompactFab = { gear: [{name:"Compact Fabber"}] };
assert("compact fabber detected", exp.characterHasFabber(pcCompactFab) === "compact");

console.log("\n=== v0.8 — Updated combat.healing entry has rates ===");
const heal = exp.RULEBOOK_REFERENCE.combat.healing;
assert("combat.healing has structured used_for with rates", !!(heal && heal.used_for && /biomorph/i.test(heal.used_for) && /1d10/.test(heal.used_for)));
assert("combat.healing references stress recovery + Moxie", !!(heal && heal.used_for && /Moxie/.test(heal.used_for) && /Psychosurgery/.test(heal.used_for)));

console.log("\n=== v0.8 — ALI Lexicon entry exists ===");
assert("Lexicon entry 'ali' exists", !!exp.RULEBOOK_REFERENCE.lexicon.ali);
assert("ALI entry mentions Combat ALI", !!(exp.RULEBOOK_REFERENCE.lexicon.ali.short && /Combat ALI/i.test(exp.RULEBOOK_REFERENCE.lexicon.ali.short)));

console.log("\n=========================================");
console.log("FINAL: " + pass + " pass, " + fail + " fail");
console.log("=========================================");
// Exit cleanly to suppress pending mock-DOM timer crashes (showToast leaves a
// setTimeout that would call t.remove() on a mock element).
process.exit(fail > 0 ? 1 : 0);
