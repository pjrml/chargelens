// Unit tests (v2 Task 3: session state machine and records) for the LIB section of src/meter.js. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/session_test.js
let B = 1794735000; // 2026-11-15 09:30 UTC
t("sessOpenClose", function () {
  let r = sessBand(null, 2, {stamp: B, up: 100, c: 1000});
  eq("open", r.ss.c, 1000); eq("no close", r.closed, null);
  r = sessBand(r.ss, 0, {stamp: B + 3600, up: 3700, c: 3300});
  eq("left green", r.ss.g, 3700);
  r = sessTick(r.ss, 3700 + 599); eq("not yet", r.closed, null);
  r = sessTick(r.ss, 3700 + 600);
  eq("closed", r.closed, {s: B, min: 60, wh: 2300, f: ""}); eq("ss cleared", r.ss, null);
});
t("sessDip", function () {
  let r = sessBand(null, 2, {stamp: B, up: 100, c: 1000});
  r = sessBand(r.ss, 1, {stamp: B + 60, up: 160, c: 1100});
  r = sessBand(r.ss, 2, {stamp: B + 300, up: 400, c: 1150});
  eq("still open", r.closed, null); eq("gap cleared", r.ss.g, 0); eq("flag r", r.ss.f, "r");
});
t("sessDurationUptime", function () {
  let r = sessBand(null, 2, {stamp: "~3.100", up: 100, c: 0});
  r = sessBand(r.ss, 0, {stamp: B, up: 1900, c: 500});
  r = sessTick(r.ss, 2500);
  eq("30 min from uptime", r.closed.min, 30); eq("start undated kept", r.closed.s, "~3.100");
});
t("sessPowerCut", function () {
  let r = sessBand(null, 2, {stamp: B, up: 100, c: 1000});
  eq("closed p", sessBootClose(r.ss, B + 1200, 1300, 1800), {s: B, min: 20, wh: 800, f: "p"});
  eq("none open", sessBootClose(null, B, 0, 0), null);
});
t("sessSpike", function () {
  let r = sessBand(null, 2, {stamp: B, up: 0, c: 0});
  let ss = sessSpike(r.ss, 300);
  r = sessBand(ss, 0, {stamp: B + 600, up: 600, c: 1300}); r = sessTick(r.ss, 1200);
  eq("spike out", r.closed.wh, 1000);
});
t("fmtRec", function () {
  eq("dated", fmtRec({s: B, min: 185, wh: 12880, f: ""}, 0), "15,0930,185,12880");
  eq("flags", fmtRec({s: B, min: 5, wh: 9, f: "py"}, 0), "15,0930,5,9,py");
  eq("undated", fmtRec({s: "~3.100", min: 5, wh: 9, f: ""}, 0), "3,100,5,9");
});
t("sessMonthEdge", function () {
  eq("start month", recMonth({s: 1795996740, min: 120, wh: 1, f: ""}, 0), "202611"); // 2026-11-30 23:59 UTC
  eq("undated", recMonth({s: "~1.5", min: 1, wh: 1, f: ""}, 0), null);
});
t("appendRecFull", function () {
  let v = null; let i;
  for (i = 0; i < 40; i++) { let n = appendRec(v, "15,0930,185,12880,py"); if (n === null) break; v = n; }
  eq("stays <= 253", v.length <= 253, true); eq("refuses when full", appendRec(v, "15,0930,185,12880"), null);
});
t("sessResumeSameBoot", function () {
  let r = sessBand(null, 2, {stamp: B, up: 100, c: 1000});
  let again = sessBand(r.ss, 2, {stamp: B + 50, up: 150, c: 1010});
  eq("no second start", again.ss.c, 1000);
});
t("sessBootCloseAfterGreen", function () {
  let r = sessBand(null, 2, {stamp: B, up: 100, c: 1000});
  r = sessBand(r.ss, 0, {stamp: B + 1200, up: 1300, c: 1800});
  eq("ended when green was left, no p", sessBootClose(r.ss, B + 1500, 1600, 1900), {s: B, min: 20, wh: 800, f: ""});
});
