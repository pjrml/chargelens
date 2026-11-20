// Unit tests (v1 Task 3: config, 6 months, schema version, restart rule) for the LIB section of src/meter.js. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/meter_cfg_test.js
t("boot_rule_real", function () {
  eq("power cut: uptime below saved", isRealBoot(4, 200), true);
  eq("no saved uptime", isRealBoot(5, undefined), true);
  eq("small below saved", isRealBoot(4, 3), true);
  eq("both young", isRealBoot(100, 90), true);
});
t("boot_rule_restart", function () {
  eq("restart late", isRealBoot(5000, 4000), false);
  eq("restart just past 120", isRealBoot(130, 90), false);
});
t("migrate_fresh", function () { eq("sv 1", migrate({}, true).st.sv, 1); eq("not legacy", migrate({}, true).legacy, false); });
t("migrate_legacy", function () {
  let m = migrate({n: 3}, false);
  eq("legacy", m.legacy, true); eq("no sv", m.st.sv, undefined); eq("n kept", m.st.n, 3);
});
t("migrate_idempotent", function () {
  let a = migrate({n: 3, sv: 1}, false);
  eq("sv 1 unchanged", a.st, {n: 3, sv: 1}); eq("not legacy", a.legacy, false);
  let b = migrate(migrate({}, true).st, false);
  eq("again", b.st.sv, 1); eq("again not legacy", b.legacy, false);
  let c = migrate(migrate({n: 1}, false).st, false);
  eq("legacy twice", c.legacy, true); eq("still no sv", c.st.sv, undefined);
});
t("prune_max", function () {
  eq("sv 1", pruneMax({sv: 1}), 6); eq("no sv", pruneMax({}), 0); eq("MAX_MONTHS", MAX_MONTHS, 6);
});
t("month_deletes_6", function () {
  let n = []; let i;
  for (i = 1; i <= 7; i++) { let k = "2026" + (i < 10 ? "0" : "") + i; n.push("cc:m:" + k, "cc:s:" + k, "cc:s:" + k + "-2"); }
  eq("oldest of 7 and its sessions", monthDeletes(n, "202608", MAX_MONTHS),
     ["cc:m:202601", "cc:s:202601", "cc:s:202601-2", "cc:m:202602", "cc:s:202602", "cc:s:202602-2"]);
  let n6 = n.slice(3);
  eq("6 present + new: drop oldest", monthDeletes(n6, "202608", MAX_MONTHS), ["cc:m:202602", "cc:s:202602", "cc:s:202602-2"]);
});
t("sess_gap_param", function () {
  let ss = {s: 1, su: 0, c: 0, g: 100, gc: 50, x: 0, f: ""};
  eq("60 not yet", sessTick(ss, 100 + 59, 60).closed, null);
  eq("60 closes", sessTick(ss, 100 + 60, 60).closed !== null, true);
  eq("3600 not yet", sessTick(ss, 100 + 3599, 3600).closed, null);
  eq("3600 closes", sessTick(ss, 100 + 3600, 3600).closed !== null, true);
});
t("cfg_change_keeps_session", function () {
  let ss = {s: 1, su: 0, c: 1000, g: 500, gc: 1200, x: 7, f: "y"};
  let c1 = cfgParse('{"v":1,"g":5,"sg":600}'); let c2 = cfgParse('{"v":1,"g":8,"sg":3000}');
  eq("gap differs", c1.sg !== c2.sg, true);
  let r = sessTick(ss, 500 + 700, c2.sg);
  eq("still open", r.closed, null); eq("ss kept", r.ss !== null, true);
  eq("c unchanged", r.ss.c, 1000); eq("x unchanged", r.ss.x, 7);
});
t("led_cfg_fields", function () {
  let c = cfgParse('{"v":1,"r":0.2,"g":6,"y":10,"h":0.4,"hr":0.1,"hs":20,"lo":0,"lb":80,"sg":900,"p":1}');
  eq("fields", ledCfg(c), {r: 0.2, g: 6, y: 10, h: 0.4, hr: 0.1, hs: 20, lo: 0, lb: 80});
  eq("defaults", ledCfg(cfgParse(null)), {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50});
});
t("state_json_fits", function () {
  let st = {c: 99999.999, o: 99999.999, t: 1799999999, pb: 99999.999, po: 99999.999, dk: "20261231", dw: 99999.999,
    n: 99999, nb: true, u: 9999999, hi: 2, ei: 2, l: 999, sv: 1};
  eq("<= 253", stateJson(st).length <= 253, true);
});
