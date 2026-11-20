// Unit tests (Task 5: formats, price, mail template, mailto, CSV, relay icon, events) for the PURE block of
// src/page.html. Run:
//   python tools/shelly.py testpage src/page.html tests/page_mail_test.js
// Convention: a test that needs navigator/DOM APIs is registered with tb() instead of t(), so a Node runner (CI,
// plan Task 8) can skip exactly those. In headless Edge tb() is t().
function tb(name, fn) { t(name, fn); }
let CFG0 = cfgParse(null);
function cfgOf(o) { return cfgParse(JSON.stringify(o)); }

t("fmt_date_ymd", function () { eq("ymd", fmtDate("20261120", "YMD"), "2026-11-20"); eq("iso input", fmtDate("2026-11-20", "YMD"), "2026-11-20"); });
t("fmt_date_dmy", function () { eq("dmy", fmtDate("20261120", "DMY"), "20/11/2026"); });
t("fmt_date_mdy", function () { eq("mdy", fmtDate("20261120", "MDY"), "11/20/2026"); eq("default", fmtDate("20261120"), "2026-11-20"); });
t("fmt_num_comma", function () {
  eq("comma", fmtNum(1234.5, 2, ","), "1234,50");
  eq("dot", fmtNum(1234.5, 2, "."), "1234.50");
  eq("default dot", fmtNum(0.3, 2), "0.30");
  eq("kwh comma", fmtKwh(86900, ","), "86,90 kWh");
});
t("cost_hidden_without_price", function () {
  eq("no price", fmtCost(1000, cfgParse(null)), "");
  eq("hasPrice false", hasPrice(CFG0), false);
});
t("cost_with_price", function () {
  let c = cfgOf({p: 0.2});
  eq("1500 Wh", fmtCost(1500, c), "0.30");
  eq("hasPrice", hasPrice(c), true);
  eq("comma", fmtCost(1500, cfgOf({p: 0.2, ds: ","})), "0,30");
});

let SESS = [{day: "2026-11-03", wh: 15800}, {day: "2026-11-04", wh: 10450}];
function ctx(o) {
  let c = {k: "202611", sessions: SESS, totalWh: 26250, cfg: cfgOf({p: 0.2, cu: "USD", ds: ",", df: "DMY"}), name: "Garage", lang: "en-US"};
  for (let k in o) c[k] = o[k];
  return c;
}
t("sessions_table_no_price", function () {
  eq("lines", sessionsTable(SESS, CFG0), "2026-11-03 | 15.80\n2026-11-04 | 10.45");
  eq("empty", sessionsTable([], CFG0), "");
});
t("sessions_table_price", function () {
  eq("lines", sessionsTable(SESS, cfgOf({p: 0.2, ds: ",", df: "DMY"})), "03/11/2026 | 15,80 | 3,16\n04/11/2026 | 10,45 | 2,09");
});
t("tpl_render", function () {
  let v = mailVars(ctx({}));
  let names = ["month_name", "month", "year", "total_kwh", "total_cost", "currency", "price", "outside_kwh", "session_count", "sessions_table", "device_name"];
  eq("keys", Object.keys(v).sort(), names.slice().sort());
  let tpl = names.map(n => "{" + n + "}").join("|") + "|{nope}";
  let out = renderTpl(tpl, v);
  eq("nope kept", out.slice(-6), "{nope}");
  eq("no other placeholder left", out.slice(0, -7).indexOf("{"), -1);
  eq("month", v.month, "11"); eq("year", v.year, "2026");
  eq("total_kwh", v.total_kwh, "26,25"); eq("total_cost", v.total_cost, "5,25");
  eq("currency", v.currency, "USD"); eq("price", v.price, "0,2");
  eq("outside", v.outside_kwh, "0,00"); eq("count", v.session_count, "2"); eq("device", v.device_name, "Garage");
  eq("table", v.sessions_table, sessionsTable(SESS, ctx({}).cfg));
  eq("no price: cost empty", mailVars(ctx({cfg: CFG0})).total_cost, "");
  eq("outside energy", mailVars(ctx({totalWh: 28250})).outside_kwh, "2,00");
});
tb("tpl_month_name", function () {
  Object.defineProperty(navigator, "language", {value: "en-US", configurable: true});
  eq("november", mailVars(ctx({lang: undefined, k: "202611"})).month_name, "November");
  delete navigator.language;
  eq("explicit lang", mailVars(ctx({lang: "en-US", k: "202603"})).month_name, "March");
});
t("mailto_cc_bcc", function () {
  let r = mailUrl({to: "a@example.com", cc: "b@example.com", bcc: "c@example.com"}, "Sub ject", "Line1\nLine2");
  eq("copy empty", r.copy, "");
  eq("url", r.url, "mailto:a@example.com?subject=Sub%20ject&body=Line1%0ALine2&cc=b@example.com&bcc=c@example.com");
  let n = mailUrl({to: ""}, "S", "B");
  eq("no cc/bcc", n.url, "mailto:?subject=S&body=B");
});
t("mailto_long", function () {
  let l = []; for (let i = 0; i < 60; i++) l.push({day: "2026-11-" + pad(i % 28 + 1), wh: 1000 + i});
  let body = sessionsTable(l, cfgOf({p: 0.2}));
  let r = mailUrl({to: "a@example.com"}, "Report", body);
  eq("copy is the full body", r.copy, body);
  eq("short", r.url.length < 1800, true);
  eq("short body text", r.url.indexOf(encodeURIComponent("The report is on the clipboard: paste it here.")) > 0, true);
});
t("csv_header_iso", function () {
  let c = csvText([["2026-11-20", 1500]], [["2026-11", 1500]],
    [{day: "2026-11-20", hhmm: "09:30", end: "12:35", min: 185, wh: 12880, cost: 2.58, f: ""}],
    [{date: "2026-11-20", time: "10:00", text: "Relay on, (HTTP_in)"}]);
  let L = c.split("\r\n");
  eq("header", L[0], "type,date,start,end,min,wh,kwh,cost,flags");
  eq("day", L[1], "day,2026-11-20,,,,1500,1.500,,");
  eq("month", L[2], "month,2026-11,,,,1500,1.500,,");
  eq("session", L[3], "session,2026-11-20,09:30,12:35,185,12880,12.880,2.58,");
  eq("event quoted", L[4], 'event,2026-11-20,10:00,,,,,,"Relay on, (HTTP_in)"');
  eq("trailing CRLF", L[5], "");
  eq("no BOM", c.charCodeAt(0), 116);
});
t("relay_icon_cut", function () {
  eq("on", relayIcon({output: true, errors: []}), "on");
  eq("off", relayIcon({output: false}), "off");
  eq("overcurrent", relayIcon({output: false, errors: ["overcurrent"]}), "cut");
  eq("overpower", relayIcon({output: false, errors: ["x", "overpower"]}), "cut");
  eq("other error", relayIcon({output: true, errors: ["overtemp"]}), "on");
});
t("ev_text_u", function () {
  eq("U", evText("U,1794735000"), "Script restarted (update)");
  eq("L", evText("L,1794735000"), "Old data format found");
  eq("R", evText("R,1794735000,1/HTTP_in"), "Relay on (HTTP_in)");
  eq("B", evText("B,~4.3,1/~3.7200"), "Boot (reason 1)");
  eq("unknown", evText("Z,1"), "Z,1");
});

// ---- final review: MailTpl missing subject/body falls back field by field to the default template ----
t("mailtpl_default_is_single_source", function () {
  let d = JSON.parse(MAIL_DEFAULT_JSON);
  eq("subject", MAILD.subject, d.subject);
  eq("body", MAILD.body, d.body);
});
t("mailtpl_fallback", function () {
  eq("null", mailTpl(null).subject, MAILD.subject);
  eq("not an object", mailTpl("x").body, MAILD.body);
  let m = mailTpl({to: "a@b", subject: "S"});
  eq("keeps subject", m.subject, "S");
  eq("default body", m.body, MAILD.body);
  eq("keeps to", m.to, "a@b");
  eq("default subject", mailTpl({body: "B", cc: "c@d"}).subject, MAILD.subject);
  eq("bad types", mailTpl({subject: 5, body: null}).body, MAILD.body);
  eq("empty subject kept", mailTpl({subject: "", body: "B"}).subject, "");
  eq("recipients default empty", mailTpl({}).to, "");
});
