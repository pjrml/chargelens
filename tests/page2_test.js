// Unit tests (v2 Task 10: sessions, cost, events, undated, CSV) for the PURE block of src/page.html. Run:
//   python tools/shelly.py testpage src/page.html tests/page2_test.js
t("cost", function () {
  eq("price", priceFor("202611"), 0);
  eq("cost 12.88 kWh", costEur(12880, "202611"), 0);
  eq("dur", fmtDur(185), "3h05");
  eq("eur", fmtEur(2.4), "2,40 \u20ac");
});
t("sessions", function () {
  let l = parseSessions(["15,0930,185,12880;15,1400,60,5590,p", "15,----,5,9,d"], "202611");
  eq("count", l.length, 3); eq("time", l[0].hhmm, "09:30"); eq("manual date", l[2].hhmm, null);
  eq("day", l[1].day, "2026-11-15"); eq("flags", l[1].f, "p");
  eq("interrupted", pairInterrupted([{day:"2026-11-15",hhmm:"09:30",min:30,wh:1,f:"p"},{day:"2026-11-15",hhmm:"10:10",min:5,wh:1,f:""}])[0].int, true);
  eq("not interrupted", pairInterrupted([{day:"2026-11-15",hhmm:"09:30",min:30,wh:1,f:"p"},{day:"2026-11-15",hhmm:"11:10",min:5,wh:1,f:""}])[0].int, false);
});
t("csv", function () {
  eq("row", csvSessRows([{day:"2026-11-15",hhmm:"09:30",min:185,wh:12880,f:""}], "202611")[0],
     "sessao;2026-11-15;09:30;12:35;185;12880;12,88;0,00;");
  eq("no time", csvSessRows([{day:"2026-11-15",hhmm:null,min:5,wh:9,f:"d"}], "202611")[0],
     "sessao;2026-11-15;;;5;9;0,01;0,00;d");
});
t("events", function () {
  let l = evLines(["R,1794735000,0/HTTP_in;B,~4.3,1/~3.7200", null, "R,1794700000,1/HTTP_in"], 0, "4:1794740000:s");
  eq("count", l.length, 3);
  eq("oldest first from key ei+1", l[0].when, 1794700000);
  eq("boot resolved", l[2].when, 1794740003);
  eq("relay text", l[1].text, "Tomada desligada (HTTP_in)");
});
