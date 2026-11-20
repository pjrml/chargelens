// Unit tests (v2 Tasks 5/8: Meter wiring helpers, dating undated boots) for the LIB section of src/meter.js. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/session2_test.js
let B = 1794735000; // 2026-11-15 09:30 UTC
t("tickSpikeWh", function () {
  let st = {c: 1000, o: 0, t: 0, pb: 0, po: 0, dk: "", dw: 0};
  let r = applyTick(st, {k: "202611", s: 0, days: []}, 1900, B, 0, 9999, [], 100);
  eq("spike Wh reported", r.sx, 900);
  r = applyTick(st, r.month, 1910, B + 60, 0, 9999, [], 100);
  eq("no spike", r.sx, 0);
});
t("suTake", function () {
  let r = suTake("3,100,5,9;4,7,60,800,p;4,4000,2,1", 4, B);
  eq("recs of boot 4", r.recs, [{s: B + 7, min: 60, wh: 800, f: "p"}, {s: B + 4000, min: 2, wh: 1, f: ""}]);
  eq("rest", r.rest, "3,100,5,9");
  eq("nothing left", suTake("4,7,60,800", 4, B).rest, null);
  eq("none", suTake(null, 4, B).recs, []);
  let x = suTake("4,T,0,900;4,7,60,800;3,T,0,5", 4, B);
  eq("T of boot 4 taken", x.t, 900); eq("T not a record", x.recs.length, 1); eq("other T kept", x.rest, "3,T,0,5");
});
t("validDay", function () {
  eq("ok", validDay("20261115", "20261118"), true);
  eq("future", validDay("20261119", "20261118"), false);
  eq("31 Nov", validDay("20261131", "20261231"), false);
  eq("29 Feb 2028", validDay("20280229", "20281231"), true);
  eq("29 Feb 2027", validDay("20270229", "20271231"), false);
  eq("junk", validDay("2026111", "20261118"), false);
});
// final review fixes
t("stateJsonFits", function () {
  let w = {c: 1234567.891, o: 1234567.891, t: 1794962914, pb: 12345.678, po: 12345.678, dk: "20261118", dw: 12345.678,
    n: 1234, nb: true, u: 12345678, ei: 2, hi: 2, l: 123,
    ss: {s: "~1234.12345678", su: 12345678, c: 1234567.891, g: 12345678, gc: 1234567.891, x: 12345, f: "yrpo"}};
  let j = stateJson(w);
  eq("no ss in cc:state", j.indexOf("ss") < 0, true);
  eq("worst case <= 253", j.length <= 253, true);
  eq("ss alone <= 253", JSON.stringify(w.ss).length <= 253, true);
});
t("recKeys", function () {
  eq("two keys per month", recKeys("202611"), ["cc:s:202611", "cc:s:202611-2"]);
});
t("orphanSessions", function () {
  let n = ["cc:s:202412", "cc:s:202412-2"]; let i;
  for (i = 1; i <= 12; i++) n.push("cc:m:2025" + (i < 10 ? "0" : "") + i);
  eq("orphans older than the oldest kept month go too", monthDeletes(n, "202601", 12),
     ["cc:m:202501", "cc:s:202412", "cc:s:202412-2"]);
});
