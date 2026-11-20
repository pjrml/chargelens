// Unit tests (final-review fixes) for the LIB section of src/meter.js; split from meter_test.js because
// the device runs tests inside the shared ~25 KB script heap. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/meter_review_test.js
let D14 = 1794614400; // 2026-11-14 00:00 local
let H = 3600;
function newState() { return {c: 1000, o: 50, t: 0, pb: 0, po: 0, dk: "", dw: 0}; }

// Final review fixes
t("capDeletesBeforeNewMonth", function () {
  let names = []; let i;
  for (i = 0; i < 46; i++) names.push("cc:m:" + String(2021 + ((i - i % 12) / 12)) + pad2(i % 12 + 1));
  eq("full store: delete oldest before writing new", capDeletes(names, "cc:m:202612", 46), ["cc:m:202101"]);
  eq("key already present: nothing", capDeletes(["cc:m:202611"], "cc:m:202611", 1), []);
});

t("monthLoadAction", function () {
  eq("found", monthLoadAction(0, "5|1,2"), "use");
  eq("not found", monthLoadAction(-105, null), "new");
  eq("other error skips the tick", monthLoadAction(-1, null), "skip");
});

t("tickElapsed", function () {
  eq("first tick uses uptime", tickElapsed(-1, 3600), 3600);
  eq("first tick right after boot", tickElapsed(-1, 5), 120);
  eq("later ticks", tickElapsed(100, 160), 60);
});

t("shouldPersist", function () {
  eq("idle noise waits", shouldPersist(0.05, 120, false), false);
  eq("10 Wh unsaved writes", shouldPersist(10, 60, false), true);
  eq("hourly flush of small amounts", shouldPersist(0.5, 3600, false), true);
  eq("nothing unsaved never writes", shouldPersist(0, 99999, false), false);
  eq("forced (new month, adjustment, attribution)", shouldPersist(0, 0, true), true);
});

t("tickReportsDeltaAndForced", function () {
  let st = newState(); let adj = [];
  let r = applyTick(st, {k: "202611", s: 0, days: []}, 1010, D14 + 10 * H, 0, 9999, adj, 100);
  eq("d", r.d, 10); eq("not forced", r.forced, false);
  st.pb = 2;
  let r2 = applyTick(st, r.month, 1010, D14 + 10 * H, 0, 9999, adj, 100);
  eq("attribution forced", r2.forced, true);
});

// v2 Task 1: 12-month history, session keys deleted with their month
t("monthDeletes", function () {
  let n = ["cc:m:202501","cc:s:202501","cc:s:202501-2","cc:m:202502","cc:s:202502"];
  let i; for (i = 3; i <= 12; i++) n.push("cc:m:2025" + (i < 10 ? "0" : "") + i);
  eq("drops oldest month + its sessions", monthDeletes(n, "202601", 12), ["cc:m:202501","cc:s:202501","cc:s:202501-2"]);
  eq("nothing when room", monthDeletes(["cc:m:202601"], "202602", 12), []);
  eq("existing month not counted twice", monthDeletes(n, "202512", 12), []);
});
