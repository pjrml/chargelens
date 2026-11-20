// Unit tests for the PURE block of src/page.html, run in headless Edge (no device needed):
//   python tools/shelly.py testpage src/page.html tests/page_test.js
// 2026-11-14 12:00 UTC = 1794657600

let U = 1794657600;
function data(st, k, e) { return {unix: U, off: 0, st: st, k: k, e: e}; }

t("dayKeyOf", function () {
  eq("today", dayKeyOf(U, 0), "20261114");
  eq("offset crosses midnight", dayKeyOf(U + 11.5 * 3600, 3600), "20261115");
});

t("prevMonth", function () {
  eq("normal", prevMonth("202611"), "202610");
  eq("january", prevMonth("202601"), "202512");
});

t("todayWh", function () {
  let m = {s: 0, days: [0, 0, 12000]};
  // finding 4: state saved on the 3rd, page opened on the 14th with no charging -> today is 0, not 12 kWh
  eq("stale st.dk", todayWh(data({c: 500, dk: "20261103", dw: 12000}, "202611", 500), m, "20261114"), 0);
  eq("same day uses dw", todayWh(data({c: 500, dk: "20261114", dw: 700}, "202611", 500), m, "20261114"), 700);
  eq("adds unsaved energy", todayWh(data({c: 500, dk: "20261114", dw: 700}, "202611", 509), m, "20261114"), 709);
});

t("monthWh", function () {
  let m = {s: 0, days: [100, 0, 200]};
  eq("sum with dw for st.dk", monthWh(data({c: 0, dk: "20261103", dw: 250}, "202611", 0), m, "202611", "20261114"), 350);
  eq("unsaved only for current month", monthWh(data({c: 0, dk: "20261103", dw: 200}, "202611", 5), m, "202611", "20261114"), 305);
  eq("past month no unsaved", monthWh(data({c: 0, dk: "20261103", dw: 200}, "202611", 5), m, "202611", "20261201"), 300);
});

t("defaultMonth", function () {
  // finding 5: on 2 Dec before any December charge, the report month is November, not ks[1]
  eq("early month, no current key", defaultMonth(["202611", "202610"], "20261202"), "202611");
  eq("early month with current key", defaultMonth(["202612", "202611"], "20261202"), "202611");
  eq("mid month", defaultMonth(["202612", "202611"], "20261215"), "202612");
  eq("mid month, current missing", defaultMonth(["202611"], "20261215"), "202611");
});

// x.xx W below 1 kW, x.xx kW from 1 kW (ds "." or ","); same for Wh/kWh totals; report always x.xx kWh
t("formats", function () {
  eq("W small", fmtW(0.4), "0.40 W");
  eq("W", fmtW(65.237), "65.24 W");
  eq("W comma", fmtW(65.237, ","), "65,24 W");
  eq("W edge", fmtW(999.994), "999.99 W");
  eq("kW", fmtW(2310), "2.31 kW");
  eq("Wh", fmtWh(12.5), "12.50 Wh");
  eq("kWh", fmtWh(7420), "7.42 kWh");
  eq("kWh thousands", fmtWh(1234567, ","), "1234,57 kWh");
  eq("report always kWh", fmtKwh(12.5), "0.01 kWh");
  eq("report kWh", fmtKwh(86900), "86.90 kWh");
});

t("aboutHtml", function () {
  let h = aboutHtml("1.0.0-rc.1", {enable: true, ssid: "chargelens-ab12"}, "/script/4/ui");
  eq("version", h.indexOf("ChargeLens 1.0.0-rc.1") >= 0, true);
  eq("ssid", h.indexOf("<b>chargelens-ab12</b>") >= 0, true);
  eq("ap url link", h.indexOf('<a href="http://192.168.33.1/script/4/ui">http://192.168.33.1/script/4/ui</a>') >= 0, true);
  let off = aboutHtml("1.0.0-rc.1", {enable: false, ssid: "x"}, "/script/4/ui");
  eq("ap off", off.indexOf("Access point: off") >= 0, true);
  eq("ap off no link", off.indexOf("192.168.33.1") < 0, true);
  eq("unknown version", aboutHtml(null, null, "/script/4/ui").indexOf("ChargeLens (version unknown)") >= 0, true);
  eq("unknown ap", aboutHtml("1", null, "/script/4/ui").indexOf("Access point: unknown") >= 0, true);
  eq("escaped", aboutHtml("1", {enable: true, ssid: "<x>"}, "/script/4/ui").indexOf("&lt;x&gt;") >= 0, true);
});
