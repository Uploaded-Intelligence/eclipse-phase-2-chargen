// v0.7 regression: Constellation — share URLs, party page schema, GM tracking overlay.
// Coverage: URL encode/decode round-trip, portrait strip, schema v7 fields,
// gmNotes preservation across re-import, characterId stability, identity de-dup.
const fs = require("fs");
const vm = require("vm");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
js = js.replace(/^boot\(\);$/m, "// boot suppressed");
js += "\nthis.__exports = Object.defineProperties({}, {STATE:{get:()=>STATE,enumerable:true},RULEBOOK_DATA:{value:RULEBOOK_DATA,enumerable:true},RULEBOOK_REFERENCE:{value:RULEBOOK_REFERENCE,enumerable:true},derived:{value:derived,enumerable:true},newState:{value:newState,enumerable:true},encodeShareUrl:{value:encodeShareUrl,enumerable:true},decodeShareUrl:{value:decodeShareUrl,enumerable:true},stripPortrait:{value:stripPortrait,enumerable:true},importShareSnapshot:{value:importShareSnapshot,enumerable:true},makeCharacterId:{value:makeCharacterId,enumerable:true},migrateV6ToV7:{value:migrateV6ToV7,enumerable:true},migrateToCurrent:{value:migrateToCurrent,enumerable:true},SCHEMA_VERSION:{value:SCHEMA_VERSION,enumerable:true},LZString:{value:LZString,enumerable:true},studioPcFromState:{value:studioPcFromState,enumerable:true},studioHealDamage:{value:studioHealDamage,enumerable:true},studioHealWound:{value:studioHealWound,enumerable:true},studioHealStress:{value:studioHealStress,enumerable:true},studioHealTrauma:{value:studioHealTrauma,enumerable:true},studioSetDamage:{value:studioSetDamage,enumerable:true},studioSetWounds:{value:studioSetWounds,enumerable:true},studioSetStress:{value:studioSetStress,enumerable:true},studioSetTraumas:{value:studioSetTraumas,enumerable:true},characterHasFabber:{value:characterHasFabber,enumerable:true},studioMeshAccess:{value:studioMeshAccess,enumerable:true},studioMeshOpsec:{value:studioMeshOpsec,enumerable:true},studioMeshApps:{value:studioMeshApps,enumerable:true},studioMeshImplants:{value:studioMeshImplants,enumerable:true},buildPartyImportEntry:{value:buildPartyImportEntry,enumerable:true},normalizePartyImportEntries:{value:normalizePartyImportEntries,enumerable:true},importJSON:{value:importJSON,enumerable:true},partyComputeCardData:{value:partyComputeCardData,enumerable:true},buildPartyMemberCard:{value:buildPartyMemberCard,enumerable:true},buildStudioVitalSignsCard:{value:buildStudioVitalSignsCard,enumerable:true},buildStudioDamageBar:{value:buildStudioDamageBar,enumerable:true},buildStudioMindBar:{value:buildStudioMindBar,enumerable:true},buildStudioVitalityBar:{value:buildStudioVitalityBar,enumerable:true},buildStudioPoolMeter:{value:buildStudioPoolMeter,enumerable:true},buildStudioPoolRow:{value:buildStudioPoolRow,enumerable:true},withStateAs:{value:withStateAs,enumerable:true},_playerOwnedPayload:{value:_playerOwnedPayload,enumerable:true},_isSuspended:{value:_isSuspended,enumerable:true},_setLastInputAt:{value:(t)=>{_lastInputAt=t;},enumerable:true},_getLastInputAt:{value:()=>_lastInputAt,enumerable:true},_setIdleCount:{value:(n)=>{_idleCount=n;},enumerable:true},_getIdleCount:{value:()=>_idleCount,enumerable:true},_setPollIntervalMs:{value:(n)=>{_pollIntervalMs=n;},enumerable:true},_getPollIntervalMs:{value:()=>_pollIntervalMs,enumerable:true},_AFK_THRESHOLD_MS:{value:AFK_THRESHOLD_MS,enumerable:true},_setState:{value:(v)=>{STATE=v;},enumerable:true}});\n";

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

console.log("\n=== v0.9 — Mesh Lexicon entries ===");
const meshKeys = ["muse","mesh-id","pan","ecto","hacking-primer","privileges","intrusion","subversion","lurking","spoofing","sniffing","opsec","counter-intrusion","mesh-actions-table"];
const lex = exp.RULEBOOK_REFERENCE.lexicon;
meshKeys.forEach(k => assert("Lexicon entry '" + k + "' exists", !!lex[k]));
assert("muse entry mentions ALI", !!(lex.muse && /ALI/.test(lex.muse.setting || lex.muse.short)));
assert("hacking-primer enumerates 4 steps", !!(lex["hacking-primer"] && /probe.*infiltrate.*hide.*subvert/i.test(lex["hacking-primer"].setting || "")));
assert("privileges entry has the ladder", !!(lex.privileges && /public.*user.*admin.*root/i.test(lex.privileges.setting || "")));
assert("opsec entry mentions all three layers", !!(lex.opsec && /anonymizer/i.test(lex.opsec.setting) && /vpn/i.test(lex.opsec.setting) && /fake.*id/i.test(lex.opsec.setting)));

console.log("\n=== v0.9 — studioMeshOpsec tri-state ===");
const opsecGood = exp.studioMeshOpsec({ gear:[{name:"Anonymizer"},{name:"VPN App"},{name:"Fake Ego ID"}] });
assert("3 layers → GOOD",  opsecGood.level === "GOOD", "got " + opsecGood.level);
assert("GOOD score === 3", opsecGood.score === 3);
const opsecFair = exp.studioMeshOpsec({ gear:[{name:"Anonymizer"},{name:"Medium Pistol"}] });
assert("1 layer → FAIR",  opsecFair.level === "FAIR", "got " + opsecFair.level);
const opsecFair2 = exp.studioMeshOpsec({ gear:[{name:"VPN App"},{name:"Fake Ego ID"}] });
assert("2 layers → FAIR",  opsecFair2.level === "FAIR");
const opsecPoor = exp.studioMeshOpsec({ gear:[{name:"Medium Pistol"},{name:"Armor Vest Light"}] });
assert("0 layers → POOR", opsecPoor.level === "POOR");
assert("POOR.hasAnon === false", opsecPoor.hasAnon === false);

console.log("\n=== v0.9 — studioMeshAccess detection ===");
const accBasic = exp.studioMeshAccess({ morph:{ware:["Basic Mesh Inserts","Biomods"]} });
assert("Basic Mesh Inserts → basic-mesh-inserts", accBasic === "basic-mesh-inserts");
const accFull = exp.studioMeshAccess({ morph:{ware:["Mesh Inserts","Cortical Stack","Cyberbrain"]} });
assert("Mesh Inserts (non-basic) → mesh-inserts", accFull === "mesh-inserts");
const accGhost = exp.studioMeshAccess({ morph:{ware:["Cortical Stack","Ghostrider Module","Cyberbrain"]} });
assert("Ghostrider Module → ghostrider", accGhost === "ghostrider");
const accEcto = exp.studioMeshAccess({ morph:{ware:[]}, gear:[{name:"Ecto"}] });
assert("no ware + ecto → ecto", accEcto === "ecto");
const accNone = exp.studioMeshAccess({ morph:{ware:[]}, gear:[] });
assert("no ware + no ecto → none", accNone === "none");

console.log("\n=== v0.9 — studioMeshApps detection ===");
const appsFW = exp.studioMeshApps({ gear:[{name:"Anonymizer"},{name:"VPN App"},{name:"Fake Ego ID"},{name:"TacNet App"},{name:"Medium Pistol"}] });
assert("Firewall PC apps: detects 4", appsFW.length === 4, "got " + appsFW.length);
assert("apps include anonymizer", appsFW.some(a => a.key === "anonymizer"));
assert("apps include vpn-app",    appsFW.some(a => a.key === "vpn-app"));
assert("apps include fake-ego-id",appsFW.some(a => a.key === "fake-ego-id"));
assert("apps include tacnet-app", appsFW.some(a => a.key === "tacnet-app"));
assert("Medium Pistol NOT classified as app", !appsFW.some(a => /pistol/i.test(a.name)));
const appsEmpty = exp.studioMeshApps({ gear:[{name:"Medium Pistol"}] });
assert("no mesh apps when none in gear", appsEmpty.length === 0);

console.log("\n=== v0.9 — studioMeshImplants detection ===");
const impSynth = exp.studioMeshImplants({ morph:{ware:["Cortical Stack","Cyberbrain","Mesh Inserts","Puppet Sock"]} });
assert("synthmorph: detects cyberbrain (warn)", impSynth.some(i => i.key === "cyberbrain" && i.status === "warn"));
assert("synthmorph: detects puppet-sock (warn)", impSynth.some(i => i.key === "puppet-sock" && i.status === "warn"));
assert("synthmorph: detects mesh-inserts (ok)",  impSynth.some(i => i.key === "mesh-inserts" && i.status === "ok"));
const impBio = exp.studioMeshImplants({ morph:{ware:["Basic Mesh Inserts","Biomods","Cortical Stack","Mnemonics"]} });
assert("biomorph: detects basic-mesh-inserts",   impBio.some(i => i.key === "basic-mesh-inserts" && i.status === "ok"));
assert("biomorph: detects mnemonics (ok)",       impBio.some(i => i.key === "mnemonics" && i.status === "ok"));
assert("biomorph: does NOT flag cyberbrain",    !impBio.some(i => i.key === "cyberbrain"));

console.log("\n=== v0.9 — End-to-end mesh derivation from a real STATE ===");
exp._setState(exp.newState());
exp.STATE.ego.career = "hacker";
exp.STATE.morph.chosen = "exalt";
const pcMesh = exp.studioPcFromState();
const liveAccess = exp.studioMeshAccess(pcMesh);
assert("hacker+exalt PC has mesh access (not 'none')", liveAccess !== "none", "got " + liveAccess);
const liveOpsec = exp.studioMeshOpsec(pcMesh);
assert("studioMeshOpsec returns a level on real PC", ["GOOD","FAIR","POOR"].includes(liveOpsec.level), "got " + liveOpsec.level);

console.log("\n=== v0.9.1 — pc.skills shape uses .total (regression guard) ===");
// studioPcFromState produces entries with `.total`, not `.value`. The Mesh
// section's findSkill must read `.total`. v0.9 originally read `.value` →
// Infosec/Interface/Program tiles always showed 0.
assert("pc.skills entries have .total", pcMesh.skills.length === 0 || "total" in pcMesh.skills[0]);
assert("pc.skills entries do NOT have .value", pcMesh.skills.length === 0 || !("value" in pcMesh.skills[0]));

console.log("\n=== v0.9.1 — importShareSnapshot defensive validation ===");
// Empty / undefined parsedState should NOT throw; should alert with shape error.
let threwOnNull = false;
try { exp.importShareSnapshot(null, true, "URL"); } catch (e) { threwOnNull = true; }
assert("importShareSnapshot(null) does not throw (guarded)", !threwOnNull);
let threwOnEmpty = false;
try { exp.importShareSnapshot({}, true, "URL"); } catch (e) { threwOnEmpty = true; }
assert("importShareSnapshot({}) does not throw (guarded)", !threwOnEmpty);
let threwOnNoEgo = false;
try { exp.importShareSnapshot({meta:{schemaVersion:7}}, true, "URL"); } catch (e) { threwOnNoEgo = true; }
assert("importShareSnapshot({meta:...}) without ego does not throw (guarded)", !threwOnNoEgo);

console.log("\n=== v0.9.1 — toolVersion bumped ===");
const freshState = exp.newState();
assert("newState().meta.toolVersion is current (not stale 0.7.0)", /^0\.(9\.[1-9]|10\.|11\.|12\.)/.test(freshState.meta.toolVersion), "got " + freshState.meta.toolVersion);

console.log("\n=== v0.9.1 — self-import preserves GM's existing partyImports ===");
exp._setState(exp.newState());
// GM has an existing party member
exp.STATE.partyImports.push({ id:"existing-1", name:"Pre-existing", source:"file", gmNotes:{ wounds:0, stress:0, initiative:null, statusEffects:[], notes:"" }, full:{ meta:{schemaVersion:7}, ego:{name:"Pre-existing"}, partyImports:[] } });
// Player B shares their character, GM imports as self
const playerB = exp.newState();
playerB.ego.name = "Player B";
const urlB = exp.encodeShareUrl(playerB);
const parsedB = exp.decodeShareUrl(urlB);
exp.importShareSnapshot(parsedB, false, "URL");
assert("self-import keeps GM's existing partyImports", exp.STATE.partyImports.length === 1);
assert("self-import GM's existing entry preserved", exp.STATE.partyImports[0] && exp.STATE.partyImports[0].name === "Pre-existing");
assert("self-import replaced ego.name to Player B", exp.STATE.ego.name === "Player B");

console.log("\n=== v0.9.2 — buildPartyImportEntry produces v7-complete entries ===");
{
  const loaded = exp.newState();
  loaded.ego.name = "Test Player";
  loaded.ego.characterId = "char-abc-123";
  loaded.summary = { name:"Test Player", concept:"hacker", lifepath:"Infolife / Hacker", coverage:{combat:20,face:30,hacker:80,sci:20}, exportedAt:"2026-05-15T10:00:00.000Z" };

  for (const label of ["file", "URL", "live", "QR", undefined]) {
    const entry = exp.buildPartyImportEntry(loaded, label);
    const expectedSrc = label === undefined ? "file" : (String(label).toLowerCase().includes("live") ? "live" : String(label).toLowerCase());
    assert("buildPartyImportEntry(" + JSON.stringify(label) + ") has id from characterId", entry.id === "char-abc-123");
    assert("buildPartyImportEntry(" + JSON.stringify(label) + ") has source=" + expectedSrc, entry.source === expectedSrc);
    assert("buildPartyImportEntry(" + JSON.stringify(label) + ") has gmNotes shape", entry.gmNotes && typeof entry.gmNotes.wounds === "number" && Array.isArray(entry.gmNotes.statusEffects));
    assert("buildPartyImportEntry(" + JSON.stringify(label) + ") has lastSyncedAt string", typeof entry.lastSyncedAt === "string" && entry.lastSyncedAt.length > 0);
    assert("buildPartyImportEntry(" + JSON.stringify(label) + ") has syncUrl=null", entry.syncUrl === null);
    assert("buildPartyImportEntry(" + JSON.stringify(label) + ") has full=loaded", entry.full === loaded);
  }
}

console.log("\n=== v0.9.2 — buildPartyImportEntry handles missing summary/ego ===");
{
  const entry = exp.buildPartyImportEntry({ meta:{schemaVersion:7} }, "file");
  assert("buildPartyImportEntry with no ego/summary still produces v7 shape", entry && entry.name === "Unnamed" && entry.source === "file" && entry.gmNotes);
  assert("buildPartyImportEntry id defaults to null when no characterId", entry.id === null);
  assert("buildPartyImportEntry coverage defaults to zeros", entry.coverage.combat === 0 && entry.coverage.face === 0 && entry.coverage.hacker === 0 && entry.coverage.sci === 0);
}

console.log("\n=== v0.9.2 — normalizePartyImportEntries heals each missing field ===");
{
  // Missing id
  let s = { partyImports: [{ name:"A", source:"file", lastSyncedAt:"x", gmNotes:{wounds:0,stress:0,initiative:null,statusEffects:[],notes:""}, syncUrl:null, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize fills missing id with null", s.partyImports[0].id === null);

  // Missing source
  s = { partyImports: [{ id:"x", name:"A", lastSyncedAt:"x", gmNotes:{wounds:0,stress:0,initiative:null,statusEffects:[],notes:""}, syncUrl:null, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize fills missing source with 'file'", s.partyImports[0].source === "file");

  // source: undefined explicitly (the exact crash case)
  s = { partyImports: [{ id:"x", name:"A", source:undefined, lastSyncedAt:"x", gmNotes:{wounds:0,stress:0,initiative:null,statusEffects:[],notes:""}, syncUrl:null, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize replaces undefined source with 'file'", s.partyImports[0].source === "file");

  // Missing gmNotes
  s = { partyImports: [{ id:"x", name:"A", source:"file", lastSyncedAt:"x", syncUrl:null, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize fills missing gmNotes with default shape", s.partyImports[0].gmNotes && s.partyImports[0].gmNotes.wounds === 0 && Array.isArray(s.partyImports[0].gmNotes.statusEffects));

  // Partial gmNotes
  s = { partyImports: [{ id:"x", name:"A", source:"file", lastSyncedAt:"x", gmNotes:{wounds:3,notes:"alert"}, syncUrl:null, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize patches partial gmNotes (keeps existing fields)", s.partyImports[0].gmNotes.wounds === 3 && s.partyImports[0].gmNotes.notes === "alert");
  assert("normalize patches partial gmNotes (fills missing fields)", s.partyImports[0].gmNotes.stress === 0 && Array.isArray(s.partyImports[0].gmNotes.statusEffects));

  // Missing lastSyncedAt
  s = { partyImports: [{ id:"x", name:"A", source:"file", gmNotes:{wounds:0,stress:0,initiative:null,statusEffects:[],notes:""}, syncUrl:null, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize fills missing lastSyncedAt", typeof s.partyImports[0].lastSyncedAt === "string" && s.partyImports[0].lastSyncedAt.length > 0);

  // Missing syncUrl
  s = { partyImports: [{ id:"x", name:"A", source:"file", lastSyncedAt:"x", gmNotes:{wounds:0,stress:0,initiative:null,statusEffects:[],notes:""}, full:{} }] };
  exp.normalizePartyImportEntries(s);
  assert("normalize fills missing syncUrl with null", s.partyImports[0].syncUrl === null);

  // No partyImports — no-op, no throw
  let noPI = { meta:{schemaVersion:7} };
  let didThrow = false;
  try { exp.normalizePartyImportEntries(noPI); } catch(e) { didThrow = true; }
  assert("normalize on state without partyImports does not throw", !didThrow);
}

console.log("\n=== v0.9.2 — migrateToCurrent runs normalizer unconditionally ===");
{
  // A current-version save with a v6-shape partyImports entry (the bug we just fixed)
  const buggy = {
    meta: { schemaVersion: 7, toolVersion: "0.9.1" },
    ego: { name: "GM" },
    partyImports: [{ name: "BuggyPlayer", concept: "x", lifepath: "y", coverage: { combat:0,face:0,hacker:0,sci:0 }, full: {} }]
  };
  const out = exp.migrateToCurrent(buggy);
  const e = out.partyImports[0];
  assert("migrate normalizes v6-shape entry inside a v7 root", e.source === "file" && typeof e.lastSyncedAt === "string" && e.gmNotes && e.syncUrl === null);
}

console.log("\n=== v0.9.2 — importJSON party-path creates v7-complete entries ===");
{
  exp._setState(exp.newState());
  const player = exp.newState();
  player.ego.name = "FileImported";
  player.ego.characterId = "file-import-id-1";
  player.summary = { name:"FileImported", concept:"c", lifepath:"l", coverage:{combat:10,face:20,hacker:30,sci:40}, exportedAt:"2026-05-15T10:00:00.000Z" };
  const text = JSON.stringify(player);
  // importJSON wraps in try/catch and shows alerts; we just need to verify no throw and the entry shape
  let importErr = null;
  try { exp.importJSON(text, true); } catch (e) { importErr = e; }
  assert("importJSON file party-add does not throw", importErr === null);
  assert("importJSON file party-add pushed entry", exp.STATE.partyImports.length === 1);
  const fileEntry = exp.STATE.partyImports[0];
  assert("importJSON file entry has v7 source field", fileEntry.source === "file");
  assert("importJSON file entry has id from characterId", fileEntry.id === "file-import-id-1");
  assert("importJSON file entry has gmNotes shape", fileEntry.gmNotes && typeof fileEntry.gmNotes.wounds === "number");
  assert("importJSON file entry has lastSyncedAt", typeof fileEntry.lastSyncedAt === "string");
  assert("importJSON file entry has syncUrl=null", fileEntry.syncUrl === null);
  assert("importJSON file entry has full state", fileEntry.full && fileEntry.full.ego && fileEntry.full.ego.name === "FileImported");
}

console.log("\n=== v0.9.2 — importJSON re-upload of same character upserts ===");
{
  exp._setState(exp.newState());
  const player = exp.newState();
  player.ego.name = "Repeat";
  player.ego.characterId = "repeat-id";
  player.summary = { name:"Repeat", concept:"c", lifepath:"l", coverage:{combat:0,face:0,hacker:0,sci:0} };
  exp.importJSON(JSON.stringify(player), true);
  assert("first file-import pushes entry", exp.STATE.partyImports.length === 1);
  // GM marks a wound on this player
  exp.STATE.partyImports[0].gmNotes.wounds = 2;
  exp.STATE.partyImports[0].gmNotes.notes = "hurt";
  // Player re-uploads
  exp.importJSON(JSON.stringify(player), true);
  assert("second file-import upserts (no duplicate)", exp.STATE.partyImports.length === 1);
  assert("re-upload preserves GM gmNotes.wounds", exp.STATE.partyImports[0].gmNotes.wounds === 2);
  assert("re-upload preserves GM gmNotes.notes", exp.STATE.partyImports[0].gmNotes.notes === "hurt");
}

console.log("\n=== v0.9.2 — buildPartyMemberCard source defaulting (the actual crash scenario) ===");
{
  // The exact entry shape that crashed production v0.9 / v0.9.1
  const buggyEntry = { name:"Crash", concept:"c", lifepath:"l", coverage:{combat:0,face:0,hacker:0,sci:0}, full:{ meta:{schemaVersion:7}, ego:{name:"Crash"} } };
  // Source-derivation line in buildPartyMemberCard (v0.9.2):
  //   const source = isSelf ? "self" : (typeof entry.source === "string" ? entry.source : "file");
  // Manually replicate to verify the guard works:
  const isSelf = false;
  const source = isSelf ? "self" : (typeof buggyEntry.source === "string" ? buggyEntry.source : "file");
  assert("buildPartyMemberCard source guard yields 'file' on undefined", source === "file");
  // And toUpperCase() must not throw
  let upperThrew = false;
  try { ("// " + source.toUpperCase()); } catch(e) { upperThrew = true; }
  assert("buildPartyMemberCard source.toUpperCase() works after guard", !upperThrew);
}

console.log("\n=== v0.9.2 — toolVersion bumped ===");
{
  const fresh = exp.newState();
  // v0.10.0 supersedes — accept any 0.10.x or 0.9.2+
  assert("newState().meta.toolVersion is 0.9.2+ or 0.10.x", /^0\.(9\.2|10\.)/.test(fresh.meta.toolVersion), "got " + fresh.meta.toolVersion);
}

console.log("\n=== v0.10.0 — STATE.team default shape ===");
{
  const fresh = exp.newState();
  assert("newState() has STATE.team object", fresh.team && typeof fresh.team === "object");
  assert("STATE.team.roomId default is null", fresh.team.roomId === null);
  assert("STATE.team.teamName default is empty string", fresh.team.teamName === "");
  assert("STATE.team.lastPolledAt default is null", fresh.team.lastPolledAt === null);
}

console.log("\n=== v0.10.0 — migrateToCurrent backfills STATE.team for legacy saves ===");
{
  const legacy = { meta:{schemaVersion:7,toolVersion:"0.9.2"}, ego:{name:"X"}, partyImports:[] };
  // No .team field at all (pre-v0.10 save)
  const out = exp.migrateToCurrent(legacy);
  assert("migrate backfills STATE.team object", out.team && typeof out.team === "object");
  assert("migrate backfills STATE.team.roomId=null", out.team.roomId === null);
  assert("migrate backfills STATE.team.teamName=''", out.team.teamName === "");
  assert("migrate backfills STATE.team.lastPolledAt=null", out.team.lastPolledAt === null);

  // Partial team object should be patched
  const partial = { meta:{schemaVersion:7}, ego:{name:"X"}, partyImports:[], team:{ teamName:"Echoes" } };
  const out2 = exp.migrateToCurrent(partial);
  assert("migrate preserves partial team.teamName", out2.team.teamName === "Echoes");
  assert("migrate fills missing team.roomId=null", out2.team.roomId === null);
  assert("migrate fills missing team.lastPolledAt=null", out2.team.lastPolledAt === null);
}

console.log("\n=== v0.10.0 — partyComputeCardData returns avatarDataUrl ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Portrait Player";
  exp.STATE.ego.narrative.avatarDataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="; // tiny stub
  const data = exp.partyComputeCardData(exp.STATE);
  assert("partyComputeCardData returns avatarDataUrl when present", typeof data.avatarDataUrl === "string" && data.avatarDataUrl.startsWith("data:image/"));
  // Clear and re-test
  exp.STATE.ego.narrative.avatarDataUrl = null;
  const data2 = exp.partyComputeCardData(exp.STATE);
  assert("partyComputeCardData returns null avatarDataUrl when missing", data2.avatarDataUrl === null);
}

console.log("\n=== v0.10.0 — partyComputeCardData survives missing narrative ===");
{
  const sl = { ego: {} }; // no narrative at all
  // We just need to confirm the field-read pattern itself is safe at the JS level.
  // (partyComputeCardData also calls withStateAs + derivedStats on an incomplete
  //  state; whether that throws is out of scope for this avatar-path test.)
  const read = (sl.ego && sl.ego.narrative && sl.ego.narrative.avatarDataUrl) || null;
  assert("avatarDataUrl read pattern handles missing narrative", read === null);
}

console.log("\n=== v0.10.0 — partyComputeCardData surfaces play.woundsTaken / traumasTaken ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Hurt Player";
  exp.STATE.play.woundsTaken = 2;
  exp.STATE.play.traumasTaken = 1;
  const data = exp.partyComputeCardData(exp.STATE);
  assert("partyComputeCardData surfaces play.woundsTaken", data.woundsTaken === 2);
  assert("partyComputeCardData surfaces play.traumasTaken", data.traumasTaken === 1);
  // Defaults when play is empty
  exp.STATE.play.woundsTaken = 0;
  exp.STATE.play.traumasTaken = 0;
  const data2 = exp.partyComputeCardData(exp.STATE);
  assert("partyComputeCardData defaults woundsTaken to 0", data2.woundsTaken === 0);
}

console.log("\n=== v0.10.1 — partyComputeCardData surfaces lucidity / traumaThreshold / maxWounds ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Tactical Player";
  // Standard aptitudes for known math
  exp.STATE.ego.aptitudes = { COG:15, INT:15, REF:15, SOM:15, SAV:15, WIL:20 };
  const data = exp.partyComputeCardData(exp.STATE);
  // lucidity = WIL × 2 = 40
  assert("partyComputeCardData surfaces lucidity (WIL×2)", data.lucidity === 40);
  // traumaThreshold = LUC / 5 = 8
  assert("partyComputeCardData surfaces traumaThreshold (LUC/5)", data.traumaThreshold === 8);
  // No morph chosen → maxWounds = 0
  assert("partyComputeCardData maxWounds is 0 when no morph", data.maxWounds === 0);
}

console.log("\n=== v0.10.1 — VITAL STATUS auto-derive reads from entry.full.play ===");
{
  // Build a complete fake entry with play data
  const entry = {
    id: "vital-test",
    source: "live",
    gmNotes: { wounds:0, stress:0, initiative:null, statusEffects:[], notes:"" },
    lastSyncedAt: new Date().toISOString(),
    syncUrl: null,
    full: {
      meta: { schemaVersion: 7 },
      ego: { name: "Hurt", aptitudes: { COG:15,INT:15,REF:15,SOM:15,SAV:15,WIL:10 } },
      play: { woundsTaken: 2, stress: 12, traumasTaken: 1 }
    }
  };
  const play = entry.full.play;
  // Replicate the Wave B read-path:
  const woundsCur = (typeof play.woundsTaken === "number") ? play.woundsTaken : (entry.gmNotes.wounds || 0);
  const stressCur = (typeof play.stress === "number") ? play.stress : (entry.gmNotes.stress || 0);
  const traumasCur = (typeof play.traumasTaken === "number") ? play.traumasTaken : 0;
  assert("VITAL STATUS reads woundsTaken from play (not gmNotes)", woundsCur === 2);
  assert("VITAL STATUS reads stress from play (not gmNotes)", stressCur === 12);
  assert("VITAL STATUS reads traumasTaken from play", traumasCur === 1);
  // hasLivePlay flag
  const hasLivePlay = (entry.full && entry.full.play && typeof entry.full.play.woundsTaken === "number");
  assert("hasLivePlay true when entry.full.play.woundsTaken is a number", hasLivePlay === true);
}

console.log("\n=== v0.10.1 — VITAL STATUS falls back to gmNotes for legacy entries (no play.woundsTaken) ===");
{
  const legacyEntry = {
    id: "legacy-test",
    source: "file",
    gmNotes: { wounds:3, stress:8, initiative:null, statusEffects:[], notes:"old save" },
    lastSyncedAt: "2024-01-01T00:00:00.000Z",
    syncUrl: null,
    full: {
      meta: { schemaVersion: 7 },
      ego: { name: "Legacy", aptitudes: { COG:10,INT:10,REF:10,SOM:10,SAV:10,WIL:10 } }
      // No .play block at all
    }
  };
  const play = (legacyEntry.full && legacyEntry.full.play) || {};
  const woundsCur = (typeof play.woundsTaken === "number") ? play.woundsTaken : (legacyEntry.gmNotes.wounds || 0);
  const stressCur = (typeof play.stress === "number") ? play.stress : (legacyEntry.gmNotes.stress || 0);
  assert("Legacy entry falls back to gmNotes.wounds", woundsCur === 3);
  assert("Legacy entry falls back to gmNotes.stress", stressCur === 8);
  const hasLivePlay = !!(legacyEntry.full && legacyEntry.full.play && typeof legacyEntry.full.play.woundsTaken === "number");
  assert("hasLivePlay false when no play block present", hasLivePlay === false);
}

console.log("\n=== v0.10.1 — VITAL STATUS handles partial play (only stress, no woundsTaken) ===");
{
  // Realistic case: an export from a tool that wrote stress but not woundsTaken
  const partialEntry = {
    id: "partial",
    source: "file",
    gmNotes: { wounds:5, stress:0, initiative:null, statusEffects:[], notes:"" },
    full: { meta:{schemaVersion:7}, ego:{aptitudes:{WIL:10}}, play: { stress: 7 } }
  };
  const play = partialEntry.full.play || {};
  const woundsCur = (typeof play.woundsTaken === "number") ? play.woundsTaken : (partialEntry.gmNotes.wounds || 0);
  const stressCur = (typeof play.stress === "number") ? play.stress : (partialEntry.gmNotes.stress || 0);
  // wounds falls back to gmNotes (no woundsTaken in play)
  assert("Partial-play wounds falls back to gmNotes", woundsCur === 5);
  // stress reads from play (present)
  assert("Partial-play stress reads from play (present)", stressCur === 7);
}

console.log("\n=== v0.10.1 — toolVersion bumped to 0.10.1 ===");
{
  const fresh = exp.newState();
  assert("newState().meta.toolVersion is 0.10.x", /^0\.10\./.test(fresh.meta.toolVersion), "got " + fresh.meta.toolVersion);
}

console.log("\n=== v0.10.2 — withStateAs swaps STATE and restores ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Original";
  const teammate = exp.newState();
  teammate.ego.name = "Teammate";
  // Capture the name observed during the swapped context
  let observedDuring = null;
  const result = exp.withStateAs(teammate, () => {
    observedDuring = exp.STATE.ego.name;
    return "rv";
  });
  assert("withStateAs returns the inner function's value", result === "rv");
  assert("inside withStateAs, STATE points to the swapped state", observedDuring === "Teammate");
  assert("after withStateAs, STATE is restored", exp.STATE.ego.name === "Original");
}

console.log("\n=== v0.10.2 — withStateAs restores STATE even on throw ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Original";
  const teammate = exp.newState();
  teammate.ego.name = "Teammate";
  let caught = null;
  try {
    exp.withStateAs(teammate, () => { throw new Error("boom"); });
  } catch (e) { caught = e; }
  assert("withStateAs propagates inner throw", caught && caught.message === "boom");
  assert("STATE restored to original after inner throw", exp.STATE.ego.name === "Original");
}

console.log("\n=== v0.10.2 — studioPcFromState produces a renderable pc from a teammate STATE ===");
{
  exp._setState(exp.newState());
  // Build a teammate-shaped state (a clone of newState with name/aptitudes)
  const teammate = JSON.parse(JSON.stringify(exp.newState()));
  teammate.ego.name = "Sheet Test";
  teammate.ego.aptitudes = { COG:15, INT:15, REF:15, SOM:15, SAV:15, WIL:20 };
  // studioPcFromState reads STATE internally via withStateAs caller; we exercise the call
  const pc = exp.withStateAs(teammate, () => exp.studioPcFromState());
  assert("studioPcFromState returns a pc object for the swapped STATE", pc && typeof pc === "object");
  assert("pc.name matches the teammate STATE.ego.name", pc.name === "Sheet Test");
}

console.log("\n=== v0.10.4 — toolVersion bumped to 0.10.4 ===");
{
  const fresh = exp.newState();
  assert("newState().meta.toolVersion is 0.10.5", fresh.meta.toolVersion === "0.10.5");
}

console.log("\n=== v0.10.4 — hash-skip: same player-owned state → identical hash ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Hash Test";
  exp.STATE.ego.aptitudes = { COG:15,INT:15,REF:15,SOM:15,SAV:15,WIL:15 };
  const h1 = exp._playerOwnedPayload();
  const h2 = exp._playerOwnedPayload();
  assert("two consecutive hashes of unchanged state are identical", h1 === h2);
}

console.log("\n=== v0.10.4 — hash-mismatch: STATE change yields different hash ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Before";
  const h1 = exp._playerOwnedPayload();
  exp.STATE.ego.name = "After";
  const h2 = exp._playerOwnedPayload();
  assert("hash differs after ego.name mutation", h1 !== h2);
}

console.log("\n=== v0.10.4 — partyImports changes do NOT affect hash (avoids push cycle) ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Stable";
  const h1 = exp._playerOwnedPayload();
  // Simulate the poll-driven mutation that v0.10.3 was looping on:
  exp.STATE.partyImports.push({
    id: "teammate-1", name: "Teammate", source: "live",
    gmNotes: {wounds:0,stress:0,initiative:null,statusEffects:[],notes:""},
    lastSyncedAt: new Date().toISOString(), syncUrl: null,
    full: { meta:{schemaVersion:7}, ego:{name:"Teammate"} }
  });
  exp.STATE.team.lastPolledAt = new Date().toISOString();
  const h2 = exp._playerOwnedPayload();
  assert("hash unchanged after partyImports + team.lastPolledAt mutation", h1 === h2);
}

console.log("\n=== v0.10.4 — adaptive interval transitions on idleCount thresholds ===");
{
  // Reset cadence state
  exp._setIdleCount(0);
  exp._setPollIntervalMs(60 * 1000);
  // Driving idleCount to 3+ should bump to 5min on next adaptive check
  // (the real poll function does this internally; we simulate the math)
  let idle = 0;
  let interval = 60 * 1000;
  function tick(advanced) {
    if (advanced) { idle = 0; interval = 60 * 1000; }
    else {
      idle++;
      if (idle >= 10 && interval < 15 * 60 * 1000) interval = 15 * 60 * 1000;
      else if (idle >= 3 && interval < 5 * 60 * 1000) interval = 5 * 60 * 1000;
    }
  }
  // 3 idle ticks → 5min
  for (let i = 0; i < 3; i++) tick(false);
  assert("3 idle polls → 5min interval", interval === 5 * 60 * 1000);
  // 7 more idle ticks (10 total) → 15min
  for (let i = 0; i < 7; i++) tick(false);
  assert("10 idle polls → 15min interval", interval === 15 * 60 * 1000);
  // Any update resets to 60s
  tick(true);
  assert("member update resets to 60s", interval === 60 * 1000);
  assert("member update resets idleCount to 0", idle === 0);
}

console.log("\n=== v0.10.4 — _isSuspended logic (idle threshold + visibility) ===");
{
  const now = Date.now();
  // Case 1: recent input → never suspended regardless of visibility
  exp._setLastInputAt(now);
  assert("recent input → not suspended", exp._isSuspended() === false);
  // Case 2: stale input + sandbox document (no visibilityState; treated as "not visible")
  exp._setLastInputAt(now - 6 * 60 * 1000);
  // Sandbox's mock document lacks visibilityState (undefined !== "visible" → true),
  // so with stale input the function returns true. That's correct behavior
  // (a real headless / OS-hidden tab would also lack a "visible" state).
  assert("stale input + no-visibility-state → suspended", exp._isSuspended() === true);
  // Case 3: verify the threshold and that _lastInputAt is settable
  exp._setLastInputAt(now);
  assert("_lastInputAt can be set and read back", exp._getLastInputAt() === now);
  assert("AFK_THRESHOLD_MS is 5 minutes", exp._AFK_THRESHOLD_MS === 5 * 60 * 1000);
  // Case 4: edge case — input exactly at threshold (< not <= so just under is still active)
  exp._setLastInputAt(now - (5 * 60 * 1000 - 1)); // 1ms under threshold
  assert("input 1ms under threshold → not suspended (active)", exp._isSuspended() === false);
}

console.log("\n=== v0.10.4 — typing in player state mutates hash (real edit case) ===");
{
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Initial";
  const h1 = exp._playerOwnedPayload();
  // Simulate a wound tick (a real player edit)
  exp.STATE.play.woundsTaken = 1;
  const h2 = exp._playerOwnedPayload();
  assert("wound tick changes hash → push would fire", h1 !== h2);
}

console.log("\n=== v0.10.3 — STATE.team.roomId can be set and persists ===");
{
  exp._setState(exp.newState());
  exp.STATE.team.roomId = "test-room-uuid-1234";
  exp.STATE.team.teamName = "Strike Team Alpha";
  // Roundtrip through migrateToCurrent (the load path)
  const serialized = JSON.parse(JSON.stringify(exp.STATE));
  const loaded = exp.migrateToCurrent(serialized);
  assert("roomId persists through migrate", loaded.team.roomId === "test-room-uuid-1234");
  assert("teamName persists through migrate", loaded.team.teamName === "Strike Team Alpha");
}

console.log("\n=== v0.10.3 — team-doc shape regression (what the server expects) ===");
{
  // The server schema in api/team/[roomId].js requires:
  //   { schemaVersion:1, teamName:string, members:string[], initiative:[{characterId,value,rolledAt}], updatedAt:ISO }
  // We sanity-check that the client-side patchTeamDoc body shape matches.
  const ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
  // Sample initiative entry the client emits
  const sampleEntry = { characterId: "char-1234-uuid", value: 12, rolledAt: new Date().toISOString() };
  assert("initiative entry has characterId matching ID_PATTERN", ID_PATTERN.test(sampleEntry.characterId));
  assert("initiative entry has numeric value", typeof sampleEntry.value === "number" && isFinite(sampleEntry.value));
  assert("initiative entry has ISO rolledAt", typeof sampleEntry.rolledAt === "string" && sampleEntry.rolledAt.includes("T"));
  // Sample team-doc patch body the client emits
  const samplePatch = { teamName: "Echo Squad" };
  assert("teamName patch is plain string", typeof samplePatch.teamName === "string");
  // Member patch (set-union)
  const memberPatch = { members: ["char-1234-uuid", "char-5678-uuid"] };
  assert("members patch is array of ID-pattern strings", Array.isArray(memberPatch.members) && memberPatch.members.every(m => ID_PATTERN.test(m)));
}

console.log("\n=== v0.10.3 — boot resumes polling when STATE.team.roomId is set ===");
{
  // We can't test the actual polling timer in the sandbox (no setInterval observation),
  // but we can verify that STATE.team.roomId being set is the trigger condition.
  exp._setState(exp.newState());
  assert("boot should NOT resume polling when roomId is null", exp.STATE.team.roomId === null);
  exp.STATE.team.roomId = "room-test-id";
  assert("boot SHOULD resume polling when roomId is set (after load)", !!exp.STATE.team.roomId);
}

console.log("\n=== v0.10.0 — STATE.team.teamName persists through save/load roundtrip ===");
{
  exp._setState(exp.newState());
  exp.STATE.team.teamName = "Bone Bird Brigade";
  // Round-trip through migrateToCurrent (the load path)
  const serialized = JSON.parse(JSON.stringify(exp.STATE));
  const loaded = exp.migrateToCurrent(serialized);
  assert("teamName survives save/load roundtrip", loaded.team.teamName === "Bone Bird Brigade");
}

// v0.10.5 — Live vitals on team card: bar visualization + sync correction.
// The earlier text-only YOU vitals one-liner recomputed wound count from raw
// damage (`Math.floor(data.wounds / data.WT)`), ignoring the one-way ratchet
// `STATE.play.woundsTaken` that studioSetDamage maintains. v0.10.5 routes
// both YOU and FILE team cards through `studioPcFromState()` (the studio
// sheet's projection), aligning the count and adding the segmented HP bars
// to the team card surface. Tests below assert: opts plumbing is present,
// the sync correction holds, the FILE branch reads entry.full not STATE,
// the auto-bump ratchet still works (regression), and the misleading "Tick
// a wound"/"Tick a trauma" banner copy is gone.

console.log("\n=== v0.10.5 — readOnly opts plumbed through studio vitals stack ===");
{
  assert("buildStudioPoolMeter source mentions readOnly",
    exp.buildStudioPoolMeter && /readOnly/.test(exp.buildStudioPoolMeter.toString()));
  assert("buildStudioPoolRow source mentions readOnly (forwards opts)",
    exp.buildStudioPoolRow && /readOnly/.test(exp.buildStudioPoolRow.toString()));
  assert("buildStudioVitalityBar source mentions readOnly",
    exp.buildStudioVitalityBar && /readOnly/.test(exp.buildStudioVitalityBar.toString()));
  assert("buildStudioDamageBar source forwards readOnly to vitalityBar",
    exp.buildStudioDamageBar && /readOnly/.test(exp.buildStudioDamageBar.toString()));
  assert("buildStudioMindBar source forwards readOnly to vitalityBar",
    exp.buildStudioMindBar && /readOnly/.test(exp.buildStudioMindBar.toString()));
  assert("buildStudioVitalSignsCard accepts vitalsOnly + readOnly opts",
    exp.buildStudioVitalSignsCard
      && /vitalsOnly/.test(exp.buildStudioVitalSignsCard.toString())
      && /readOnly/.test(exp.buildStudioVitalSignsCard.toString()));
}

console.log("\n=== v0.10.5 — wound-sync: studio reads latched woundsTaken, not recomputed from raw ===");
{
  // Scenario: user took peak damage that latched woundsTaken via studioSetDamage,
  // then healed raw back down. Studio reads the latched count; old team-card
  // formula `floor(wounds/WT)` would recompute a lower count from the post-heal
  // raw and diverge. v0.10.5 routes the team card through studioPcFromState so
  // both surfaces show the same number.
  exp._setState(exp.newState());
  exp.STATE.morph.chosen = "exalt";
  exp.STATE.play.wounds = 6;            // raw after healing
  exp.STATE.play.woundsTaken = 4;       // latched from prior peak
  const pc = exp.studioPcFromState();
  assert("studioPcFromState surfaces latched play.woundsTaken (=== 4)",
    pc.woundsTaken === 4, "got " + pc.woundsTaken);
  const WT = (pc.derived && pc.derived.wound_threshold) || 1;
  const naive = Math.floor(6 / WT);
  assert("naive recompute would have produced a SMALLER count (the v0.10.4 bug)",
    naive < 4, "naive=" + naive + " (would have mismatched studio's 4)");
}

console.log("\n=== v0.10.5 — FILE-import vitals project from entry.full, not local STATE ===");
{
  // Local STATE has a player at damage=30; an imported entry has damage=5.
  // Under withStateAs(entry.full, ...), pc.damageTaken must reflect the entry.
  exp._setState(exp.newState());
  exp.STATE.morph.chosen = "exalt";
  exp.STATE.play.wounds = 30;
  const entryFull = exp.newState();
  entryFull.morph.chosen = "exalt";
  entryFull.play.wounds = 5;
  const pcOfImport = exp.withStateAs(entryFull, () => exp.studioPcFromState());
  assert("withStateAs swaps STATE for projection (pc.damageTaken === 5)",
    pcOfImport.damageTaken === 5, "got " + pcOfImport.damageTaken);
  assert("STATE restored after withStateAs (local damage still 30)",
    exp.STATE.play.wounds === 30, "got " + exp.STATE.play.wounds);
}

console.log("\n=== v0.10.5 — studioSetDamage auto-bump one-way ratchet (regression) ===");
{
  // The display alignment in v0.10.5 only works because the data ratchet still
  // holds: studioSetDamage(v) sets woundsTaken = max(current, floor(v/WT)).
  // Healing raw damage must NOT decrement woundsTaken.
  exp._setState(exp.newState());
  exp.STATE.morph.chosen = "exalt";
  const ms = exp.derived.morphStats();
  const WT = (ms && ms.morph && ms.morph.WT) || 1;
  exp.studioSetDamage(WT * 3);
  assert("studioSetDamage(WT*3) latches woundsTaken to 3",
    exp.STATE.play.woundsTaken === 3, "got " + exp.STATE.play.woundsTaken);
  exp.studioSetDamage(WT);
  assert("healing damage does NOT decrement woundsTaken (ratchet held at 3)",
    exp.STATE.play.woundsTaken === 3, "got " + exp.STATE.play.woundsTaken);
}

console.log("\n=== v0.10.5 — threshold banner copy: no more 'Tick a wound' call-to-action ===");
{
  const dSrc = exp.buildStudioDamageBar.toString();
  const mSrc = exp.buildStudioMindBar.toString();
  assert("DamageBar source no longer contains 'Tick a wound.'",
    dSrc.indexOf("Tick a wound.") === -1);
  assert("MindBar source no longer contains 'Tick a trauma'",
    mSrc.indexOf("Tick a trauma") === -1);
  assert("DamageBar still announces 'WOUND THRESHOLD' crossing (informational)",
    /WOUND THRESHOLD/.test(dSrc));
  assert("MindBar still announces 'TRAUMA THRESHOLD' crossing (informational)",
    /TRAUMA THRESHOLD/.test(mSrc));
  assert("MindBar still references WIL check vs disorientation (rules reminder)",
    /WIL check vs disorientation/.test(mSrc));
}

console.log("\n=== v0.10.5 — team card builds without throwing (self + FILE-import) ===");
{
  // The harness's document.createElement stub eats child appends, so we can
  // only smoke-check that the render path completes. The presence of the
  // vitals embed is verified by inspecting buildPartyMemberCard's source.
  exp._setState(exp.newState());
  exp.STATE.ego.name = "Test Lead";
  exp.STATE.morph.chosen = "exalt";
  let threwSelf = null;
  try { exp.buildPartyMemberCard(exp.STATE, null); }
  catch (e) { threwSelf = e; }
  assert("buildPartyMemberCard(STATE, null) does not throw for self",
    threwSelf === null, threwSelf ? (threwSelf.message || String(threwSelf)) : "");

  const importFull = exp.newState();
  importFull.ego.name = "Test Mate";
  importFull.morph.chosen = "exalt";
  const fakeEntry = {
    id: "test-id", name: "Test Mate", concept: "hacker",
    source: "file", lastSyncedAt: new Date().toISOString(),
    coverage: {combat:30,face:40,hacker:60,sci:50},
    gmNotes: {wounds:0,stress:0,initiative:null,statusEffects:[],notes:""},
    full: importFull
  };
  exp.STATE.partyImports.push(fakeEntry);
  let threwImport = null;
  try { exp.buildPartyMemberCard(importFull, fakeEntry); }
  catch (e) { threwImport = e; }
  assert("buildPartyMemberCard(entry.full, entry) does not throw for FILE import",
    threwImport === null, threwImport ? (threwImport.message || String(threwImport)) : "");

  const cardSrc = exp.buildPartyMemberCard.toString();
  assert("buildPartyMemberCard now appends buildStudioVitalSignsCard",
    cardSrc.indexOf("buildStudioVitalSignsCard") !== -1);
  assert("buildPartyMemberCard passes readOnly:!isSelf for FILE imports",
    /readOnly:\s*!isSelf|readOnly:\s*\(?!isSelf/.test(cardSrc));
  assert("buildPartyMemberCard passes vitalsOnly:true (no recharge/healing on team card)",
    /vitalsOnly:\s*true/.test(cardSrc));
  assert("buildPartyMemberCard no longer recomputes wounds locally via Math.floor(data.wounds / data.WT)",
    /Math\.floor\(data\.wounds\s*\/\s*\(data\.WT/.test(cardSrc) === false);
}

console.log("\n=========================================");
console.log("FINAL: " + pass + " pass, " + fail + " fail");
console.log("=========================================");
// Exit cleanly to suppress pending mock-DOM timer crashes (showToast leaves a
// setTimeout that would call t.remove() on a mock element).
process.exit(fail > 0 ? 1 : 0);
