// Unit tests (Task 9) for the PURE block of src/install.html. Run:
//   python tools/shelly.py testpage src/install.html tests/install_test.js
//   node tools/puretest.js src/install.html tests/install_test.js
function tb(name, fn) { t(name, fn); }
function F(name, kind, en) { return {name: name, path: "dist/" + name, kind: kind, enable: en, size: 1, crc32: 1}; }
let REL = {version: "1.0.0", tag: "v1.0.0", repo: "x/y", files: [
  F("Meter", "code", true), F("Led", "code", false), F("Page", "code", false), F("PageHtml", "data", false),
  F("SetupHtml", "data", false), F("MailTpl", "data", false), F("Installer", "code", false), F("InstallHtml", "data", false)]};
let MHDR = "// ChargeLens Meter v1.0.0";
function S(id, name, run, en) { return {id: id, name: name, enable: !!en, running: !!run}; }
function ours(running) {  // the 6 stored ChargeLens scripts + the installer, as Script.List shows them
  return [S(1, "Meter", running, true), S(2, "Led", running), S(3, "Page", running), S(4, "PageHtml"), S(5, "SetupHtml"),
    S(6, "MailTpl"), S(7, "Installer", true)];
}
let HS = {Meter: MHDR, Led: "// ChargeLens Led v1.0.0", Page: "// ChargeLens Page v1.0.0", PageHtml: "<!-- ChargeLens PageHtml v1.0.0 -->",
  SetupHtml: "<!-- ChargeLens SetupHtml v1.0.0 -->"};

t("model_known_gen2", function () {
  eq("gen2", modelOf({model: "SNPL-00112EU", gen: 2}), {gen: 2, maxA: 12, maxW: 2500, build: "plugs", relay: 1});
});
t("model_known_gen3", function () {
  eq("gen3", modelOf({model: "EF3PL-00112EU", gen: 3}), {gen: 3, maxA: 12, maxW: 2500, build: "plugs", relay: 1});
});
t("model_unknown", function () {
  eq("other", modelOf({model: "SNSW-001X16EU"}), null);
  eq("null", modelOf(null), null);
  eq("proto key", modelOf({model: "constructor"}), null);
});
t("models_literal", function () {
  eq("gen2", MODELS["SNPL-00112EU"], {gen: 2, maxA: 12, maxW: 2500, build: "plugs", relay: 1});
});
t("model_build", function () {
  eq("pm build", modelOf({model: "S3PL-30116EU"}).build, "plugpmg3");
  eq("pm relay", modelOf({model: "S3PL-30116EU"}).relay, 0);
  eq("plus relay", modelOf({model: "SNPL-00112EU"}).relay, 1);
  eq("plus build", modelOf({model: "SNPL-00112EU"}).build, "plugs");
  eq("gen3 plug build", modelOf({model: "EF3PL-00112EU"}).build, "plugs");
});
t("cut_text", function () {
  eq("full", cutText({current_limit: 12, power_limit: 2500, voltage_limit: 280}), "12 A / 2500 W / 280 V");
  eq("one missing", cutText({current_limit: 12, voltage_limit: 280}), "12 A / ? W / 280 V");
  eq("non-number", cutText({current_limit: "12", power_limit: 2500, voltage_limit: null}), "? A / 2500 W / ? V");
  eq("null", cutText(null), null);
  eq("not an object", cutText("x"), null);
  eq("undefined", cutText(undefined), null);
});
t("fw_up_to_date", function () {
  eq("empty", fwUpToDate({}), true);
  eq("stable", fwUpToDate({stable: {version: "1.7.7"}}), false);
  eq("beta only", fwUpToDate({beta: {version: "1.8.0-beta1"}}), true);
  eq("null", fwUpToDate(null), false);
});
t("plan_fresh", function () {
  let p = planInstall([], {}, REL);
  eq("mode", p.mode, "fresh");
  eq("create", p.create, ["Meter", "Led", "Page", "PageHtml", "SetupHtml", "MailTpl"]);
  eq("write", p.write, ["Meter", "Led", "Page", "PageHtml", "SetupHtml", "MailTpl"]);
  eq("stop", p.stop, []);
  eq("disable", p.disable, []);
});
t("plan_fresh_with_installer", function () {
  let p = planInstall([S(7, "Installer", true, false)], {}, REL);
  eq("mode", p.mode, "fresh");
  eq("create", p.create.length, 6);
  eq("installer untouched", p.stop.concat(p.disable, p.write).indexOf("Installer"), -1);
});
t("plan_update_keeps_mailtpl", function () {
  let p = planInstall(ours(true), HS, REL);
  eq("mode", p.mode, "update");
  eq("write", p.write, ["Meter", "Led", "Page", "PageHtml", "SetupHtml"]);
  eq("create", p.create, []);
});
t("plan_update_order", function () {
  let p = planInstall(ours(true), HS, REL);
  eq("stop order", p.stop, ["Led", "Page", "Meter"]);
  eq("only running", planInstall(ours(false), HS, REL).stop, []);
});
t("plan_update_partial", function () {
  let sc = ours(false).filter(function (s) { return s.name !== "SetupHtml"; });
  let p = planInstall(sc, HS, REL);
  eq("mode", p.mode, "update");
  eq("create", p.create, ["SetupHtml"]);
  eq("write has it", p.write.indexOf("SetupHtml") >= 0, true);
});
t("plan_legacy", function () {
  let p = planInstall([S(1, "Meter", true, true), S(2, "Led", true)], {Meter: "// private build header", Led: ""}, REL);
  eq("mode", p.mode, "legacy");
  eq("nothing written", p.write.concat(p.create), []);
  eq("reason", typeof p.reason, "string");
  eq("mixed", planInstall(ours(false), {Meter: MHDR, Led: "let x = 1;"}, REL).mode, "legacy");
  eq("header missing in map", planInstall(ours(false), {}, REL).mode, "legacy");
});
t("plan_user_scripts", function () {
  let sc = [S(1, "mine1", true, true), S(2, "mine2", true, true), S(3, "idle", false, true), S(4, "off")];
  let p = planInstall(sc, {}, REL);
  eq("mode", p.mode, "fresh");
  eq("stop", p.stop, ["mine1", "mine2"]);
  eq("disable", p.disable, ["mine1", "mine2", "idle"]);
  eq("never deleted", p.write.concat(p.create).indexOf("mine1"), -1);
  eq("create", p.create.length, 6);
});
t("plan_blocked_slots", function () {
  let sc = [], i;
  for (i = 0; i < 9; i++) sc.push(S(i + 1, "u" + i));
  let p = planInstall(sc, {}, REL);
  eq("mode", p.mode, "blocked");
  eq("reason", typeof p.reason, "string");
  eq("write", p.write, []);
  let sc4 = [];
  for (i = 0; i < 4; i++) sc4.push(S(i + 1, "u" + i));
  eq("4 user + 6 = 10 fits", planInstall(sc4, {}, REL).mode, "fresh");
  eq("5 user + 6 = 11", planInstall(sc4.concat([S(9, "u9")]), {}, REL).mode, "blocked");
});
t("idle_gate_session", function () {
  eq("idle", idleOk({}, null, 0, {r: 0.1}), true);
  eq("session", idleOk({}, {s: 1}, 0, {r: 0.1}), false);
  eq("unreadable", idleOk({}, "?", 0, {r: 0.1}), false);
  eq("undefined session", idleOk({}, undefined, 0, {r: 0.1}), true);
});
t("idle_gate_current", function () {
  eq("below", idleOk(null, null, 0.05, {r: 0.1}), true);
  eq("equal", idleOk(null, null, 0.1, {r: 0.1}), true);
  eq("above", idleOk(null, null, 0.11, {r: 0.1}), false);
  eq("not a number", idleOk(null, null, NaN, {r: 0.1}), false);
  eq("missing", idleOk(null, null, undefined, {r: 0.1}), false);
});
t("crc32_known", function () {
  eq("check value", crc32("123456789"), 3421780262);
  eq("empty", crc32(""), 0);
  eq("fox", crc32("The quick brown fox jumps over the lazy dog"), 1095738169);
});
t("semver", function () {
  eq("patch", semverGt("1.0.1", "1.0.0"), true);
  eq("minor", semverGt("1.1.0", "1.0.9"), true);
  eq("major", semverGt("2.0.0", "1.9.9"), true);
  eq("equal", semverGt("1.0.0", "1.0.0"), false);
  eq("older", semverGt("1.0.0", "1.0.1"), false);
  eq("numeric", semverGt("1.10.0", "1.9.0"), true);
  eq("tag prefix", semverGt("v1.0.1", "v1.0.0"), true);
  eq("garbage", semverGt("x", "1.0.0"), false);
  eq("release > rc", semverGt("1.0.0", "1.0.0-rc.1"), true);
  eq("rc > dev", semverGt("1.0.0-rc.1", "1.0.0-dev"), true);
  eq("rc.2 > rc.1", semverGt("1.0.0-rc.2", "1.0.0-rc.1"), true);
  eq("rc.10 > rc.9 numeric", semverGt("1.0.0-rc.10", "1.0.0-rc.9"), true);
  eq("dev < release", semverGt("1.0.0-dev", "1.0.0"), false);
  eq("rc > older release", semverGt("1.0.0-rc.1", "0.9.9"), true);
  eq("equal pre", semverGt("1.0.0-rc.1", "1.0.0-rc.1"), false);
  eq("more fields", semverGt("1.0.0-rc.1.1", "1.0.0-rc.1"), true);
  eq("numeric < alpha", semverGt("1.0.0-rc", "1.0.0-1"), true);
  eq("tag pre", semverGt("v1.0.1-dev", "v1.0.0"), true);
  eq("bad pre", semverGt("1.0.0-", "0.1.0"), false);
});
t("ap_and_harden_reused", function () {
  eq("ssid", apSsid("A0B1C2D3E4F5"), "chargelens-e4f5");
  eq("ble", bleState({rpc: {enable: false}}), {en: null, rpc: false});
  eq("harden", hardenPlan({cloud: true, mqtt: false, ble: null, in_mode: "momentary"}, {cloud: true, button: true}).map(function (p) { return p.rpc; }),
    ["Cloud.SetConfig", "PLUGS_UI.SetConfig"]);
  eq("debug logs off", hardenPlan({dbg: true}, {dbg: true}), [{rpc: "Sys.SetConfig", params: {config: {debug: {websocket: {enable: false}}}}, label: "Websocket debug logs off"}]);
  eq("debug already off", hardenPlan({dbg: false}, {dbg: true}), []);
});
t("default_cfg", function () {
  eq("cfg", DEF_CFG, cfgJson(cfgParse(null)));
  eq("cfg text", DEF_CFG, '{"v":1}');
});
t("base_url", function () {
  eq("slash added", baseUrl("http://dev.example.com:8000"), "http://dev.example.com:8000/");
  eq("kept", baseUrl("http://dev.example.com:8000/"), "http://dev.example.com:8000/");
  eq("default", baseUrl("", "a/b", "v1.0.0"), "https://raw.githubusercontent.com/a/b/v1.0.0/");
  eq("custom flag", isDefaultBase("https://raw.githubusercontent.com/a/b/v1.0.0/", "a/b", "v1.0.0"), true);
  eq("custom flag no", isDefaultBase("http://evil/", "a/b", "v1.0.0"), false);
  eq("main of the repo is official", isDefaultBase("https://raw.githubusercontent.com/a/b/main/", "a/b", "v1.0.0"), true);
  eq("main of another repo is not", isDefaultBase("https://raw.githubusercontent.com/x/y/main/", "a/b", "v1.0.0"), false);
  eq("other branch is not", isDefaultBase("https://raw.githubusercontent.com/a/b/dev/", "a/b", "v1.0.0"), false);
});
t("verify_file", function () {
  let txt = "abc";
  eq("ok", verifyFile({name: "X", size: 3, crc32: crc32("abc")}, txt), null);
  eq("size", typeof verifyFile({name: "X", size: 4, crc32: crc32("abc")}, txt), "string");
  eq("crc", typeof verifyFile({name: "X", size: 3, crc32: 1}, txt), "string");
  eq("non-ascii", typeof verifyFile({name: "X", size: 2, crc32: 0}, "a" + String.fromCharCode(233)), "string");
});
t("chunks", function () {
  eq("empty", chunks("", 4), [""]);
  eq("split", chunks("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  eq("exact", chunks("abcd", 4), ["abcd"]);
});
t("tag_regex", function () {
  eq("ok", tagOk("v1.0.0"), true);
  eq("big", tagOk("v10.20.300"), true);
  eq("no v", tagOk("1.0.0"), false);
  eq("branch", tagOk("main"), false);
  eq("pre-release", tagOk("v1.0.0-rc.1"), true);
  eq("dev", tagOk("v1.0.0-dev"), true);
  eq("empty pre", tagOk("v1.0.0-"), false);
  eq("empty field", tagOk("v1.0.0-a..b"), false);
  eq("bad char", tagOk("v1.0.0-a_b"), false);
  eq("path", tagOk("v1.0.0/../x"), false);
  eq("undefined", tagOk(undefined), false);
});
t("plan_half_written", function () {
  let p = planInstall(ours(false), {Meter: "", Led: "// ChargeLens Led v1.0.0", Page: "// ChargeLens Page v1.0.0", PageHtml: "<!-- ChargeLens PageHtml v1.0.0 -->", SetupHtml: ""}, REL);
  eq("empty code is ours", p.mode, "update");
  eq("rewritten", p.write.indexOf("Meter") >= 0, true);
  eq("private build still legacy", planInstall(ours(false), {Meter: "let x;", Led: ""}, REL).mode, "legacy");
});
t("hdr_line", function () {
  eq("completely empty", hdrLine(""), "");
  eq("header", hdrLine("// ChargeLens Meter v1.0.0\nlet x;"), "// ChargeLens Meter v1.0.0");
  eq("blank first line is not ours", HDR.test(hdrLine("\nlet x;")), false);
  eq("blank first line is not empty", hdrLine("\nlet x;") === "", false);
  eq("only a newline is not empty", hdrLine("\n") === "", false);
  eq("legacy through plan", planInstall(ours(false), {Meter: hdrLine("\nlet x;"), Led: ""}, REL).mode, "legacy");
});
t("hdr_ver", function () {
  eq("script", hdrVer("// ChargeLens Meter v1.2.3"), "1.2.3");
  eq("html", hdrVer("<!-- ChargeLens PageHtml v10.0.1 -->"), "10.0.1");
  eq("none", hdrVer("let x;"), null);
  eq("pre-release", hdrVer("// ChargeLens Meter v1.0.0-rc.1"), "1.0.0-rc.1");
  eq("dev html", hdrVer("<!-- ChargeLens PageHtml v1.0.0-dev -->"), "1.0.0-dev");
  eq("undefined", hdrVer(undefined), null);
});
t("downgrade_blocked", function () {
  eq("newer installed", downgradeBlocked("1.2.0", "1.1.9"), true);
  eq("tag with v", downgradeBlocked("1.2.0", "v1.1.9"), true);
  eq("same", downgradeBlocked("1.2.0", "v1.2.0"), false);
  eq("older installed", downgradeBlocked("1.0.0", "v1.2.0"), false);
  eq("unknown installed", downgradeBlocked(null, "v1.2.0"), false);
  eq("unknown tag", downgradeBlocked("1.2.0", "main"), false);
  eq("10 > 9", downgradeBlocked("1.10.0", "1.9.0"), true);
});
t("idle_ss_state", function () {
  eq("missing key", ssState(-105, ""), null);
  eq("other error", ssState(-114, ""), "?");
  eq("null value", ssState(0, "null"), null);
  eq("session", ssState(0, '{"s":1}'), {s: 1});
  eq("garbage", ssState(0, "{x"), "?");
  eq("busy on unknown", idleOk(null, ssState(-114, ""), 0, {r: 0.1}), false);
  eq("idle when absent", idleOk(null, ssState(-105, ""), 0, {r: 0.1}), true);
});
t("restore_list", function () {
  eq("order", restoreList(["Page", "Led", "Meter"]), ["Meter", "Led", "Page"]);
  eq("user scripts last", restoreList(["mine", "Meter", "Page"]), ["Meter", "Page", "mine"]);
  eq("empty", restoreList([]), []);
});
t("safe_link", function () {
  eq("github", safeLink("https://github.com/a/b/blob/v1/CHANGELOG.md"), "https://github.com/a/b/blob/v1/CHANGELOG.md");
  eq("other", safeLink("https://evil.example.com/"), null);
  eq("js", safeLink("javascript:alert(1)"), null);
  eq("lookalike", safeLink("https://github.com.evil.example/x"), null);
});

t("planLine", function () {
  let f = planLine("fresh", null, "1.0.0-rc.2", "Meter, Led");
  eq("fresh ok", f.ok, true); eq("fresh btn", f.btn, "Install");
  eq("fresh text", f.t, "First installation of ChargeLens 1.0.0-rc.2: Meter, Led.");
  let u = planLine("update", "1.0.0-rc.1", "1.0.0-rc.2", "Meter");
  eq("update warn", u.ok, null); eq("update btn", u.btn, "Update");
  eq("update text", u.t, "Update of ChargeLens 1.0.0-rc.1 to 1.0.0-rc.2: Meter.");
  let s = planLine("update", "1.0.0-rc.2", "1.0.0-rc.2", "Meter");
  eq("same ok", s.ok, true); eq("same btn", s.btn, "Reinstall");
  eq("same text", s.t, "ChargeLens 1.0.0-rc.2 is installed and up to date. Reinstall writes the same version again (repair): Meter.");
  eq("unknown installed", planLine("update", null, "1.0.0", "Meter").t, "Update of ChargeLens ? to 1.0.0: Meter.");
});

t("loader_entry", function () {
  eq("found", loaderEntry(REL).name, "Installer");
  eq("none", loaderEntry({files: [F("Meter", "code", true)]}), null);
  eq("data named Installer", loaderEntry({files: [F("Installer", "data", false)]}), null);
  eq("no release", loaderEntry(null), null);
});
t("loader_action", function () {
  let e = F("Installer", "code", false);
  eq("stale", loaderAction("7", e, "old", "new"), "write");
  eq("same", loaderAction("7", e, "new", "new"), "same");
  eq("not opened through the loader", loaderAction(undefined, e, "old", "new"), "skip");
  eq("release without a loader", loaderAction("7", null, "old", "new"), "skip");
  eq("download missing", loaderAction("7", e, "old", undefined), "skip");
  eq("stored unreadable still written", loaderAction("7", e, null, "new"), "write");
});

// ---- rc.9: per-model builds ----
function FP(name, kind, en) { return {name: name, path: "dist/plugpmg3/" + name, kind: kind, enable: en, size: 1, crc32: 1}; }
let SH = [F("Installer", "code", false), F("InstallHtml", "data", false)];
let PMF = [FP("Meter", "code", true), FP("Led", "code", false), FP("Page", "code", false), FP("PageHtml", "data", false),
  FP("SetupHtml", "data", false), FP("MailTpl", "data", false)].concat(SH);
let REL2 = {version: "1.0.0", tag: "v1.0.0", repo: "x/y", files: REL.files, builds: {
  plugs: {models: ["SNPL-00112EU", "EF3PL-00112EU"], files: REL.files}, plugpmg3: {models: ["S3PL-30116EU"], files: PMF}}};
t("relFor", function () {
  let pm = relFor(REL2, "plugpmg3");
  eq("pm files", pm.files, PMF);
  eq("keeps version", [pm.version, pm.tag, pm.repo], ["1.0.0", "v1.0.0", "x/y"]);
  eq("plugs files", relFor(REL2, "plugs").files, REL.files);
  eq("old release plugs", relFor(REL, "plugs"), REL);
  eq("old release pm", relFor(REL, "plugpmg3"), null);
  eq("unknown build", relFor(REL2, "nope"), null);
  eq("proto key", relFor(REL2, "constructor"), null);
});
t("meterUrl", function () {
  eq("relay", meterUrl(MODELS["SNPL-00112EU"]), "/rpc/Switch.GetStatus?id=0");
  eq("pm", meterUrl(MODELS["S3PL-30116EU"]), "/rpc/PM1.GetStatus?id=0");
});
t("plan_pm_build", function () {
  let r = relFor(REL2, "plugpmg3"), p = planInstall([], {}, r);
  eq("mode", p.mode, "fresh");
  eq("writes the six pm files", p.write, ["Meter", "Led", "Page", "PageHtml", "SetupHtml", "MailTpl"]);
  eq("loader", loaderEntry(r).name, "Installer");
  eq("pm path", r.files[0].path, "dist/plugpmg3/Meter");
});

t("fs_short", function () {
  var fl = function (n, size) { return {name: n, size: size}; };
  eq("fits, growth within free", fsShort(4096, [fl("A", 1000), fl("B", 500)], {A: 700, B: 600}), null);
  eq("shrink needs nothing", fsShort(0, [fl("A", 100)], {A: 500}), null);
  eq("new file too big", fsShort(4096, [fl("A", 6000)], {}), 1904);
  eq("growth sums", fsShort(500, [fl("A", 1000), fl("B", 1000)], {A: 700, B: 700}), 100);
  eq("unknown free = no check", fsShort(undefined, [fl("A", 99999)], {}), null);
});
