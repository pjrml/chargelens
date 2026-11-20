// Unit tests (Task 6) for the PURE block of src/setup.html. Run:
//   python tools/shelly.py testpage src/setup.html tests/setup_test.js
function tb(name, fn) { t(name, fn); }
let M2 = MODELS["SNPL-00112EU"];
function form(o) {
  let f = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, sg: 600, p: 0, cu: "EUR", ds: ".", df: "YMD", lo: 1, lb: 50,
    current_limit: 12, power_limit: 2500, in_mode: "detached", tz: "Europe/Lisbon", name: "Plug",
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
  eq("native", v.native, {current_limit: 12, power_limit: 2500, in_mode: "detached", tz: "Europe/Lisbon", name: "Plug"});
});
t("validate_y_vs_limit", function () {
  let v = validateForm(form({y: 11, current_limit: 11}), M2);
  eq("limit flagged", typeof v.errors.current_limit, "string");
  eq("y fine", v.errors.y, undefined);
  eq("ok at 12", validateForm(form({y: 11, current_limit: 12}), M2).errors, {});
});
t("validate_limit_max", function () {
  eq("13 A", typeof validateForm(form({current_limit: 13}), M2).errors.current_limit, "string");
  eq("0 W", typeof validateForm(form({power_limit: 0}), M2).errors.power_limit, "string");
  eq("2501 W", typeof validateForm(form({power_limit: 2501}), M2).errors.power_limit, "string");
  eq("NaN", typeof validateForm(form({power_limit: NaN}), M2).errors.power_limit, "string");
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
  let b = st({r: 0.2, g: 6, p: 1, current_limit: 11.5, y: 10, power_limit: 2000, in_mode: "momentary", tz: "UTC", name: "X",
    mail: {to: "a@b", cc: "", bcc: "", subject: "s", body: "b"}});
  let pl = writePlan(a, b), i, names = [];
  for (i = 0; i < pl.length; i++) names.push(pl[i].rpc);
  eq("order", names, ["KVS.Set", "Script.PutCode", "Switch.SetConfig", "PLUGS_UI.SetConfig", "Sys.SetConfig"]);
  eq("no Switch.Set", names.indexOf("Switch.Set"), -1);
  eq("switch cfg", pl[2].params, {id: 0, config: {current_limit: 11.5, power_limit: 2000}});
  eq("ui cfg", pl[3].params, {config: {controls: {"switch:0": {in_mode: "momentary"}}}});
  eq("sys cfg", pl[4].params, {config: {location: {tz: "UTC"}, device: {name: "X"}}});
});
t("write_plan_native_partial", function () {
  let a = st({});
  eq("limit only", writePlan(a, st({power_limit: 2000}))[0].params, {id: 0, config: {power_limit: 2000}});
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
