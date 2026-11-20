// Unit tests for the LIB section of src/meter.js. Run on the device:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/meter_test.js
// Local times below are "local unix" (unix + utc_offset); 2026-11-14 00:00 = 1794614400.

let D14 = 1794614400; // 2026-11-14 00:00 local
let H = 3600;

function newState() { return {c: 1000, o: 50, t: 0, pb: 0, po: 0, dk: "", dw: 0}; }

t("civil", function () {
  eq("civil epoch", civil(0), {y: 1970, m: 1, d: 1});
  eq("civil 2026-11-14", civil(20771), {y: 2026, m: 11, d: 14});
  eq("civil leap 2024-02-29", civil(19782), {y: 2024, m: 2, d: 29});
  eq("dayKey", dayKey(D14 + 22 * H), "20261114");
});

t("month fmt/parse", function () {
  let m = {s: 1234, days: [0, 5, 77]};
  eq("fmt", fmtMonth(m), "1234|0,5,77");
  eq("parse", parseMonth("1234|0,5,77"), m);
  eq("parse empty days", parseMonth("9|"), {s: 9, days: []});
  eq("parse missing", parseMonth(null), null);
  let big = {s: 99999999, days: []}; let i;
  for (i = 0; i < 31; i++) big.days.push(55000);
  eq("31 x 55000 fits 253", fmtMonth(big).length <= 253, true);
});

t("delta", function () {
  eq("normal", computeDelta(1010, 1000, 100), {d: 10, code: ""});
  eq("zero", computeDelta(1000, 1000, 100), {d: 0, code: ""});
  eq("reset", computeDelta(7, 1000, 100), {d: 7, code: ""});
  eq("spike", computeDelta(1500, 1000, 100), {d: 0, code: "s", x: 500});
  eq("back", computeDelta(990, 1000, 100), {d: 0, code: "b", x: 10});
});

t("splitPending", function () {
  eq("same day", splitPending(4, D14 + 10 * H, D14 + 12 * H), [["20261114", 4]]);
  eq("over midnight", splitPending(2, D14 + 23.5 * H, D14 + 24.5 * H), [["20261114", 1], ["20261115", 1]]);
  eq("nothing", splitPending(0, D14, D14 + H), []);
});

t("noClock", function () {
  let st = newState(); let adj = [];
  let r = applyTick(st, null, 1010, 0, 0, 30, adj, 100);
  eq("pb", st.pb, 10); eq("o", st.o, 60); eq("c", st.c, 1010);
  eq("changed", r.changed, true); eq("month", r.month, null);
});

t("noClockIdle", function () {
  let st = newState(); let adj = [];
  let r = applyTick(st, null, 1000, 0, 0, 30, adj, 100);
  eq("idle no write", r.changed, false);
});

t("clockTick", function () {
  let st = newState(); let adj = [];
  let m = {k: "202611", s: 0, days: [1, 2]};
  let r = applyTick(st, m, 1010, D14 + 10 * H, 0, 9999, adj, 100);
  eq("days", r.month.days, [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10]);
  eq("dk", st.dk, "20261114"); eq("t", st.t, D14 + 10 * H);
  eq("created", r.created, false);
});

t("utcOffset", function () {
  let st = newState(); let adj = [];
  // 23:30 UTC on the 14th with +1 h offset = 00:30 local on the 15th
  let r = applyTick(st, {k: "202611", s: 0, days: []}, 1003, D14 + 23.5 * H, H, 9999, adj, 100);
  eq("goes to 15th", r.month.days.length, 15);
});

t("pendingBoot", function () {
  let st = newState(); st.pb = 2; let adj = [];
  let m = {k: "202611", s: 0, days: []};
  // clock set at 00:30 on the 15th, booted 1 h earlier (23:30 on the 14th)
  let r = applyTick(st, m, 1000, D14 + 24.5 * H, 0, H, adj, 100);
  eq("14th", r.month.days[13], 1); eq("15th", r.month.days[14], 1);
  eq("pb cleared", st.pb, 0); eq("no adj", adj.length, 0); eq("changed", r.changed, true);
});

t("pendingOld", function () {
  let st = newState(); st.po = 5; let adj = [];
  let r = applyTick(st, {k: "202611", s: 0, days: []}, 1000, D14 + 10 * H, 0, 60, adj, 100);
  // v2.1: energy of boots that never saw a clock waits for manual dating (no u adjustment)
  eq("not on today", r.month.days[13] || 0, 0); eq("po kept", st.po, 5); eq("no adj", adj.length, 0);
});

t("pendingOtherMonth", function () {
  let st = newState(); st.pb = 10; let adj = [];
  // booted 2026-10-31 12:00, clock set 2026-11-01 12:00: half belongs to October -> day 1 + adj "m"
  let n1 = D14 - 13 * 24 * H + 12 * H;
  let r = applyTick(st, {k: "202611", s: 0, days: []}, 1000, n1, 0, 24 * H, adj, 100);
  eq("day1", r.month.days, [10]);
  eq("adj m", adj, [["20261031", 5, "m"]]);
});

t("monthRoll", function () {
  let st = newState(); st.o = 5000; st.dk = "20261130"; st.dw = 7; let adj = [];
  let old = {k: "202611", s: 100, days: [7]};
  let d1 = D14 + 17 * 24 * H + H; // 2026-12-01 01:00
  let r = applyTick(st, old, 1004, d1, 0, 9999, adj, 100);
  eq("new key", r.month.k, "202612"); eq("start = o before tick", r.month.s, 5000);
  eq("day1", r.month.days, [4]); eq("created", r.created, true);
});

t("spikeLogged", function () {
  let st = newState(); let adj = [];
  let r = applyTick(st, {k: "202611", s: 0, days: []}, 1500, D14 + 10 * H, 0, 9999, adj, 100);
  eq("not counted", r.month.days[13] || 0, 0); eq("c follows", st.c, 1500);
  eq("adj s", adj, [["20261114", 500, "s"]]);
});

t("adjRing", function () {
  let st = newState(); let adj = []; let i;
  for (i = 0; i < 10; i++) adj.push(["20261101", i, "s"]);
  applyTick(st, {k: "202611", s: 0, days: []}, 1500, D14, 0, 60, adj, 100);
  eq("ring 8", adj.length, 8); eq("newest last", adj[7], ["20261114", 500, "s"]);
});

t("excessOldest", function () {
  eq("under cap", excessOldest(["cc:m:202611", "cc:m:202610"], 46), []);
  eq("two oldest", excessOldest(["cc:m:202611", "cc:m:202509", "cc:m:202612", "cc:m:202510"], 2),
     ["cc:m:202509", "cc:m:202510"]);
});
