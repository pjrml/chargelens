// Unit tests (Task 6) for the PURE block of src/setup.html. Run:
//   python tools/shelly.py testpage src/setup.html tests/setup_test.js
function tb(name, fn) { t(name, fn); }
let M2 = MODELS["SNPL-00112EU"];
function form(o) {
  let f = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, sg: 600, p: 0, cu: "EUR", ds: ".", df: "YMD", lo: 1, lb: 50,
    in_mode: "detached", tz: "Europe/Berlin", name: "Plug",
    mail: {to: "", cc: "", bcc: "", subject: "S {year}", body: "B"}};
  for (let k in o) f[k] = o[k];
  return f;
}
function st(o) { let v = validateForm(form(o), M2); return {cfg: v.cfg, mail: v.mail, native: v.native}; }
function U(h) { return String.fromCharCode(parseInt(h, 16)); }
function esc(n) { return String.fromCharCode(92) + "u" + n; }

t("models_literal", function () {
  eq("gen2", MODELS["SNPL-00112EU"], {gen: 2, maxA: 12, maxW: 2500});
  eq("gen3", MODELS["EF3PL-00112EU"], {gen: 3, maxA: 12, maxW: 2500});
});
t("validate_ok_defaults", function () {
  let v = validateForm(form({}), M2);
  eq("no errors", v.errors, {});
  eq("cfg", v.cfg, '{"v":1}');
  eq("native", v.native, {in_mode: "detached", tz: "Europe/Berlin", name: "Plug"});
});
t("validate_y_vs_cutoff", function () {
  let c = cutOf({current_limit: 12, power_limit: 2500, voltage_limit: 280});
  eq("below", validateForm(form({y: 11}), M2, c).errors, {});
  eq("equal", typeof validateForm(form({y: 12}), M2, c).errors.y, "string");
  eq("above", typeof validateForm(form({y: 13}), M2, c).errors.y, "string");
  eq("msg", validateForm(form({y: 12}), M2, c).errors.y, "Below the relay current cut-off (12 A): lower it, or raise the cut-off in the plug settings");
  eq("no cut", validateForm(form({y: 12}), M2).errors, {});
  eq("null cut", validateForm(form({y: 12}), M2, null).errors, {});
  eq("null limit", validateForm(form({y: 12}), M2, cutOf(null)).errors, {});
  eq("range error wins", validateForm(form({y: 99}), M2, c).errors.y, RNG("y"));
  eq("no limits in form", validateForm(form({current_limit: 99, power_limit: 0}), M2).errors, {});
});
t("cut_of", function () {
  eq("full", cutOf({current_limit: 12, power_limit: 2500, voltage_limit: 280, x: 1}), {current_limit: 12, power_limit: 2500, voltage_limit: 280});
  eq("null", cutOf(null), {current_limit: null, power_limit: null, voltage_limit: null});
  eq("non-number", cutOf({current_limit: "12", power_limit: undefined, voltage_limit: 280}), {current_limit: null, power_limit: null, voltage_limit: 280});
});
t("y_proposal", function () {
  eq("12", yProposal({current_limit: 12}), 10.8);
  eq("11", yProposal({current_limit: 11}), 9.9);
  eq("null", yProposal({current_limit: null}), 11);
  eq("zero", yProposal({current_limit: 0}), 11);
  eq("cutOf null", yProposal(cutOf(null)), 11);
});
t("cut_link", function () {
  eq("link", cutLink("plug.local"), "http://plug.local/#/switch/0/settings/protections");
});
t("validate_cfg_rules", function () {
  eq("g >= y", typeof validateForm(form({g: 8, y: 7}), M2).errors.g, "string");
  eq("r range", typeof validateForm(form({r: 2}), M2).errors.r, "string");
  eq("cu empty", typeof validateForm(form({cu: ""}), M2).errors.cu, "string");
  eq("cu 5 chars", typeof validateForm(form({cu: "ABCDE"}), M2).errors.cu, "string");
  eq("ds", typeof validateForm(form({ds: ";"}), M2).errors.ds, "string");
  let v = validateForm(form({p: 0.25, lb: 80, ds: ","}), M2);
  eq("ok", v.errors, {});
  eq("cfg", v.cfg, '{"v":1,"p":0.25,"ds":",","lb":80}');
  eq("cfg null on error", validateForm(form({r: 2}), M2).cfg, null);
});
t("validate_misc", function () {
  eq("tz empty", typeof validateForm(form({tz: " "}), M2).errors.tz, "string");
  eq("in_mode", typeof validateForm(form({in_mode: "x"}), M2).errors.in_mode, "string");
  eq("ap short", typeof validateForm(form({ap: {on: true, pass: "short"}}), M2).errors.ap_pass, "string");
  eq("ap off", validateForm(form({ap: {on: false, pass: "x"}}), M2).errors, {});
  eq("ap ok", validateForm(form({ap: {on: true, pass: "12345678"}}), M2).errors, {});
});
t("ascii_json_roundtrip", function () {
  let o = {s: U("20ac") + " a" + U("00e7") + U("00e3") + "o"};
  let a = asciiJson(o), i, ok = true;
  for (i = 0; i < a.length; i++) if (a.charCodeAt(i) > 126) ok = false;
  eq("ascii only", ok, true);
  eq("roundtrip", JSON.parse(a), o);
  eq("escape form", asciiJson({s: U("00e9")}), '{"s":"' + esc("00e9") + '"}');
  let e = {s: U("d83d") + U("de00")};
  eq("pair as two escapes", asciiJson(e), '{"s":"' + esc("d83d") + esc("de00") + '"}');
  eq("pair roundtrip", JSON.parse(asciiJson(e)), e);
  eq("del char 127", asciiJson({s: "\u007f"}).indexOf(esc("007f")) > 0, true);
});
t("cfg_utf8_stored_ascii", function () {
  let v = validateForm(form({cu: U("20ac")}), M2), i, ok = true;
  eq("no errors", v.errors, {});
  for (i = 0; i < v.cfg.length; i++) if (v.cfg.charCodeAt(i) > 126) ok = false;
  eq("ascii", ok, true);
  eq("reads back", cfgParse(v.cfg).cu, U("20ac"));
  let w = validateForm(form({cu: U("d83d") + U("de00") + U("d83d") + U("de00") + U("d83d") + U("de00") + U("d83d") + U("de00")}), M2);
  eq("4 emoji ok", w.errors, {});
  eq("within 253", w.cfg.length <= 253, true);
});
t("cfg_too_long_refused", function () {
  let keep = cfgJson;
  cfgJson = function () { return null; };
  let v = validateForm(form({}), M2);
  cfgJson = keep;
  eq("error", typeof v.errors.cfg, "string");
  eq("cfg null", v.cfg, null);
  // the stored (escaped) form is what counts: 250 raw bytes that grow past 253 when escaped
  cfgJson = function () { let s = '{"v":1,"cu":"', i; for (i = 0; i < 80; i++) s += U("20ac"); return s.slice(0, 247) + '"}'; };
  let w = validateForm(form({}), M2);
  cfgJson = keep;
  eq("escaped length refused", typeof w.errors.cfg, "string");
});
t("write_plan_only_changed", function () {
  let a = st({}), b = st({p: 0.3});
  let pl = writePlan(a, b);
  eq("one item", pl.length, 1);
  eq("kvs set", pl[0].rpc, "KVS.Set");
  eq("params", pl[0].params, {key: "cc:cfg", value: '{"v":1,"p":0.3}'});
  eq("none when equal", writePlan(a, st({})), []);
});
t("write_plan_never_switch_set", function () {
  let a = st({});
  let b = st({r: 0.2, g: 6, p: 1, y: 10, in_mode: "momentary", tz: "UTC", name: "X",
    mail: {to: "a@b", cc: "", bcc: "", subject: "s", body: "b"}});
  b.native.current_limit = 5; b.native.power_limit = 100;
  a.native.current_limit = 12; a.native.power_limit = 2500;
  let pl = writePlan(a, b), i, names = [];
  for (i = 0; i < pl.length; i++) names.push(pl[i].rpc);
  eq("order", names, ["KVS.Set", "Script.PutCode", "PLUGS_UI.SetConfig", "Sys.SetConfig"]);
  eq("no Switch.Set", names.indexOf("Switch.Set"), -1);
  eq("no Switch.SetConfig", names.indexOf("Switch.SetConfig"), -1);
  eq("ui cfg", pl[2].params, {config: {controls: {"switch:0": {in_mode: "momentary"}}}});
  eq("sys cfg", pl[3].params, {config: {location: {tz: "UTC"}, device: {name: "X"}}});
});
t("write_plan_native_partial", function () {
  let a = st({});
  eq("tz only", writePlan(a, st({tz: "UTC"}))[0].params, {config: {location: {tz: "UTC"}}});
  eq("name only", writePlan(a, st({name: "Z"}))[0].params, {config: {device: {name: "Z"}}});
});
t("write_plan_mailtpl_chunks", function () {
  let a = st({}), body = "", i;
  for (i = 0; i < 9000; i++) body += "a";
  let b = st({mail: {to: "", cc: "", bcc: "", subject: "s", body: body}});
  let pl = writePlan(a, b), n = 0, text = "";
  for (i = 0; i < pl.length; i++) if (pl[i].rpc === "Script.PutCode") {
    n++;
    eq("append " + n, pl[i].params.append, n > 1 ? true : undefined);
    eq("name", pl[i].params.name, "MailTpl");
    text += pl[i].params.code;
  }
  eq("3 chunks", n, 3);
  eq("whole text", text, b.mail);
  eq("chunk size", pl[0].params.code.length, 4000);
  eq("parses", JSON.parse(text).body, body);
});
t("mail_text_accents", function () {
  let v = validateForm(form({mail: {to: "", cc: "", bcc: "", subject: "Relat" + U("00f3") + "rio " + U("20ac"), body: "ol" + U("00e1") + "\nlinha"}}), M2), i, ok = true;
  for (i = 0; i < v.mail.length; i++) if (v.mail.charCodeAt(i) > 126) ok = false;
  eq("ascii", ok, true);
  eq("back", JSON.parse(v.mail).subject, "Relat" + U("00f3") + "rio " + U("20ac"));
  eq("body", JSON.parse(v.mail).body, "ol" + U("00e1") + "\nlinha");
});
t("mail_too_long", function () {
  let b = "", i;
  for (i = 0; i < 20000; i++) b += "a";
  eq("refused", typeof validateForm(form({mail: {to: "", cc: "", bcc: "", subject: "s", body: b}}), M2).errors.body, "string");
});
t("mail_default_single_source", function () {
  eq("MAILD matches src/mail-default.json", {subject: MAILD.subject, body: MAILD.body}, {subject: JSON.parse(MAIL_DEFAULT_JSON).subject, body: JSON.parse(MAIL_DEFAULT_JSON).body});
});
t("skip_after_failed_chunk", function () {
  eq("putcode skipped", skipItem({rpc: "Script.PutCode"}, ["Script.PutCode"]), true);
  eq("other continues", skipItem({rpc: "Sys.SetConfig"}, ["Script.PutCode"]), false);
  eq("nothing failed", skipItem({rpc: "Script.PutCode"}, []), false);
});
// ---- Task 7: access point, hardening, export/import ----
function cur(o) {
  let s = {model: "SNPL-00112EU", cfg: '{"v":1,"p":0.3}', mail: JSON.stringify({v: 1, to: "a@b", cc: "", bcc: "", subject: "S", body: "B"}),
    cut: {current_limit: 12, power_limit: 2500, voltage_limit: 280},
    native: {in_mode: "detached", tz: "Europe/Berlin", name: "My plug",
      ap: {ssid: "chargelens-ab12", enable: true}, cloud: false, ble: {en: false, rpc: false}, mqtt: false}};
  for (let k in o) s[k] = o[k];
  return s;
}
let NOW = new Date(2026, 10, 20, 12, 0, 0);
t("ap_ssid", function () {
  eq("plain", apSsid("A0B1C2D3E4F5"), "chargelens-e4f5");
  eq("lower", apSsid("AABBCCDDEEFF"), "chargelens-eeff");
  eq("colons", apSsid("a0-b1.c2d3E4F5"), "chargelens-e4f5");
  eq("via ap", viaAp("192.168.33.1"), true);
  eq("via sta", viaAp("localhost"), false);
  eq("not prefix", viaAp("192.168.33.1x"), false);
});
t("export_no_password", function () {
  let s = cur({}), d = exportDoc(s, "1.0.0", NOW), j = JSON.stringify(d);
  eq("app", d.app, "chargelens");
  eq("fv", d.fv, 1);
  eq("version", d.version, "1.0.0");
  eq("model", d.model, "SNPL-00112EU");
  eq("native keys", Object.keys(d.native), ["current_limit", "power_limit", "voltage_limit", "in_mode", "tz", "name", "ap", "cloud", "ble", "mqtt"]);
  eq("cut shown", [d.native.current_limit, d.native.power_limit, d.native.voltage_limit], [12, 2500, 280]);
  eq("no cut: nulls", [exportDoc(cur({cut: undefined}), "dev", NOW).native.current_limit, exportDoc(cur({cut: undefined}), "dev", NOW).native.voltage_limit], [null, null]);
  eq("ap keys", Object.keys(d.native.ap), ["ssid", "enable"]);
  eq("ble kept", d.native.ble, {en: false, rpc: false});
  eq("cfg obj", d.cfg, {v: 1, p: 0.3});
  eq("mail to", d.mail.to, "a@b");
  eq("top keys", Object.keys(d), ["app", "fv", "version", "exported", "model", "cfg", "mail", "native"]);
  eq("file name", exportFile(s, NOW), "chargelens-config-My-plug-20261120.json");
  eq("file name model", exportFile(cur({native: {name: ""}}), NOW), "chargelens-config-SNPL-00112EU-20261120.json");
});
t("export_import_roundtrip", function () {
  let s = cur({}), d = JSON.parse(JSON.stringify(exportDoc(s, "dev", NOW))), r = importCheck(d, MODELS["SNPL-00112EU"], s);
  eq("errors", r.errors, []);
  eq("ok", r.ok, true);
  eq("no changes", r.changes, []);
  eq("empty plan", writePlan({cfg: s.cfg, mail: s.mail, native: s.native}, r.next).length, 0);
});
t("import_changes_listed", function () {
  let s = cur({}), d = JSON.parse(JSON.stringify(exportDoc(s, "dev", NOW)));
  d.cfg.p = 0.5; d.native.power_limit = 2000; d.native.name = "Other"; d.mail.subject = "T";
  eq("relay text", importCheck(d, MODELS["SNPL-00112EU"], s).relay, "Relay protection in the file (shown only, not applied): 12 A / 2000 W");
  let r = importCheck(d, MODELS["SNPL-00112EU"], s), f = r.changes.map(function (c) { return c.field; });
  eq("ok", r.ok, true);
  eq("fields", f, ["p", "name", "subject"]);
  eq("limits never in next", r.next.native, {in_mode: "detached", tz: "Europe/Berlin", name: "Other"});
  let pl = writePlan({cfg: s.cfg, mail: s.mail, native: s.native}, r.next), n = pl.map(function (x) { return x.rpc; });
  eq("plan", n, ["KVS.Set", "Script.PutCode", "Sys.SetConfig"]);
});
t("import_wrong_app", function () {
  let d = exportDoc(cur({}), "dev", NOW);
  d.app = "other";
  let r = importCheck(d, MODELS["SNPL-00112EU"], cur({}));
  eq("not ok", r.ok, false);
  eq("has error", r.errors.length > 0, true);
  eq("garbage", importCheck(null, M2).ok, false);
  eq("array", importCheck([], M2).ok, false);
});
t("import_other_fv", function () {
  let d = exportDoc(cur({}), "dev", NOW);
  d.fv = 2;
  eq("not ok", importCheck(d, M2, cur({})).ok, false);
  d.fv = undefined;
  eq("missing", importCheck(d, M2, cur({})).ok, false);
});
t("import_out_of_range", function () {
  let d = exportDoc(cur({}), "dev", NOW);
  d.native.current_limit = 20; d.cfg.r = 5; d.cfg.y = 13;
  let r = importCheck(d, M2, cur({}));
  eq("not ok", r.ok, false);
  eq("two errors", r.errors.length >= 2, true);
  let c = exportDoc(cur({}), "dev", NOW); c.cfg.y = 12;
  eq("y at cut-off refused", importCheck(c, M2, cur({})).ok, false);
  c.cfg.y = 11;
  eq("y below cut-off ok", importCheck(c, M2, cur({})).ok, true);
  eq("relay none when absent", importCheck(exportDoc(cur({cut: undefined}), "dev", NOW), M2, cur({})).relay, "");
  let q = exportDoc(cur({}), "dev", NOW); delete q.native.power_limit;
  eq("relay missing value", importCheck(q, M2, cur({})).relay, "Relay protection in the file (shown only, not applied): 12 A / ? W");
  let e = exportDoc(cur({}), "dev", NOW);
  e.model = "OTHER-1";
  eq("unknown model ok if values fit", importCheck(e, M2, cur({})).ok, true);
  let o = {"SNPL-00112EU": MODELS["SNPL-00112EU"]};
  eq("other family limits", importCheck(exportDoc(cur({}), "dev", NOW), {gen: 2, maxA: 16, maxW: 3500}, cur({})).ok, false);
});
t("import_unknown_fields_ignored", function () {
  let d = exportDoc(cur({}), "dev", NOW);
  d.extra = 1; d.native.zzz = 2; d.cfg.zzz = 3;
  let r = importCheck(d, M2, cur({}));
  eq("ok", r.ok, true);
  eq("no changes", r.changes, []);
});
t("ble_state", function () {
  eq("gen3", bleState({rpc: {enable: false}}), {en: null, rpc: false});
  eq("gen2 en on", bleState({enable: true, rpc: {enable: false}}), {en: true, rpc: false});
  eq("gen2 rpc on", bleState({enable: false, rpc: {enable: true}}), {en: false, rpc: true});
  eq("none", bleState({}), null);
  eq("null", bleState(null), null);
  eq("on gen3", bleOn({en: null, rpc: true}), true);
  eq("off gen3", bleOn({en: null, rpc: false}), false);
  eq("on gen2", bleOn({en: false, rpc: true}), true);
  eq("unknown", bleOn(null), null);
});
t("harden_plan_only_needed", function () {
  let c = {cloud: true, ble: {en: null, rpc: false}, mqtt: true, in_mode: "momentary"};
  eq("all boxes", hardenPlan(c, {cloud: true, ble: true, mqtt: true, button: true}).map(function (p) { return p.rpc; }),
    ["Cloud.SetConfig", "MQTT.SetConfig", "PLUGS_UI.SetConfig"]);
  eq("cloud params", hardenPlan(c, {cloud: true})[0].params, {config: {enable: false}});
  eq("button params", hardenPlan(c, {button: true})[0].params, {config: {controls: {"switch:0": {in_mode: "detached"}}}});
  eq("unchecked skipped", hardenPlan(c, {ble: true, mqtt: false}), []);
  eq("already ok", hardenPlan({cloud: false, ble: {en: false, rpc: false}, mqtt: false, in_mode: "detached"}, {cloud: true, ble: true, mqtt: true, button: true}), []);
  eq("unknown state skipped", hardenPlan({cloud: null, ble: null}, {cloud: true, ble: true}), []);
});
t("harden_plan_ble_shapes", function () {
  eq("gen3 rpc on", hardenPlan({ble: {en: null, rpc: true}}, {ble: true}), [{rpc: "BLE.SetConfig", params: {config: {rpc: {enable: false}}}, label: "Bluetooth off"}]);
  eq("gen2 both on", hardenPlan({ble: {en: true, rpc: true}}, {ble: true})[0].params, {config: {enable: false, rpc: {enable: false}}});
  eq("gen2 en only", hardenPlan({ble: {en: true, rpc: false}}, {ble: true})[0].params, {config: {enable: false}});
  eq("gen2 rpc only", hardenPlan({ble: {en: false, rpc: true}}, {ble: true})[0].params, {config: {rpc: {enable: false}}});
  eq("unchecked", hardenPlan({ble: {en: true, rpc: true}}, {ble: false}), []);
});
t("harden_plan_debug_logs", function () {
  eq("on", hardenPlan({dbg: true}, {dbg: true}), [{rpc: "Sys.SetConfig", params: {config: {debug: {websocket: {enable: false}}}}, label: "Websocket debug logs off"}]);
  eq("already off", hardenPlan({dbg: false}, {dbg: true}), []);
  eq("unknown", hardenPlan({dbg: null}, {dbg: true}), []);
  eq("unchecked", hardenPlan({dbg: true}, {dbg: false}), []);
  eq("read on", dbgOn({debug: {websocket: {enable: true}}}), true);
  eq("read off", dbgOn({debug: {websocket: {enable: false}}}), false);
  eq("read absent", dbgOn({debug: {}}), null);
  eq("read null", dbgOn(null), null);
});
// ---- final review: update gate copied from install.html (build.py checks both copies are identical) ----
t("idle_gate", function () {
  eq("idle", idleOk(null, null, 0, {r: 0.1}), true);
  eq("session", idleOk(null, {s: 1}, 0, {r: 0.1}), false);
  eq("above residual", idleOk(null, null, 0.11, {r: 0.1}), false);
  eq("not a number", idleOk(null, null, undefined, {r: 0.1}), false);
  eq("missing key", ssState(-105, ""), null);
  eq("other error", ssState(-114, ""), "?");
  eq("garbage", ssState(0, "{x"), "?");
  eq("unknown is busy", idleOk(null, ssState(-114, ""), 0, {r: 0.1}), false);
  eq("absent is idle", idleOk(null, ssState(-105, ""), 0, {r: 0.1}), true);
});
// optional mail language (MailTpl "lang", used for {month_name}); empty = the phone's language, not stored
t("mail_lang", function () {
  let v = validateForm(form({mail: {to: "", cc: "", bcc: "", subject: "s", body: "b", lang: "pt-PT"}}), M2);
  eq("stored", JSON.parse(v.mail).lang, "pt-PT");
  let e = validateForm(form({mail: {to: "", cc: "", bcc: "", subject: "s", body: "b", lang: ""}}), M2);
  eq("empty not stored", JSON.parse(e.mail).lang, undefined);
  eq("no lang same text as before", e.mail, validateForm(form({}), M2).mail.replace('"S {year}","body":"B"', '"s","body":"b"'));
  let b = validateForm(form({mail: {to: "", cc: "", bcc: "", subject: "s", body: "b", lang: "not a tag!"}}), M2);
  eq("bad lang refused", typeof b.errors.lang, "string");
  eq("no mail written", b.mail, null);
});
t("import_mail_lang", function () {
  eq("lang is a mail key", MAILK.indexOf("lang") >= 0, true);
});
