// Unit tests (v2 Task 10: sessions, cost, events, undated, CSV) for the PURE block of src/page.html. Run:
//   python tools/shelly.py testpage src/page.html tests/page2_test.js
t("dur", function () { eq("dur", fmtDur(185), "3h05"); });
t("sessions", function () {
  let l = parseSessions(["15,0930,185,12880;15,1400,60,5590,p", "15,----,5,9,d"], "202611");
  eq("count", l.length, 3); eq("time", l[0].hhmm, "09:30"); eq("manual date", l[2].hhmm, null);
  eq("day", l[1].day, "2026-11-15"); eq("flags", l[1].f, "p");
  eq("interrupted", pairInterrupted([{day:"2026-11-15",hhmm:"09:30",min:30,wh:1,f:"p"},{day:"2026-11-15",hhmm:"10:10",min:5,wh:1,f:""}])[0].int, true);
  eq("not interrupted", pairInterrupted([{day:"2026-11-15",hhmm:"09:30",min:30,wh:1,f:"p"},{day:"2026-11-15",hhmm:"11:10",min:5,wh:1,f:""}])[0].int, false);
});
t("end_time", function () {
  eq("end", endHm({day: "2026-11-15", hhmm: "09:30", min: 185, wh: 12880, f: ""}), "12:35");
  eq("no time", endHm({day: "2026-11-15", hhmm: null, min: 5, wh: 9, f: "d"}), "");
});
t("events", function () {
  let l = evLines(["R,1794735000,0/HTTP_in;B,~4.3,1/~3.7200", null, "R,1794700000,1/HTTP_in"], 0, "4:1794740000:s");
  eq("count", l.length, 3);
  eq("oldest first from key ei+1", l[0].when, 1794700000);
  eq("boot resolved", l[2].when, 1794740003);
  eq("relay text", l[1].text, "Relay off (HTTP_in)");
});
