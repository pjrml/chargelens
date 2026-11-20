// Unit tests (v2.1: manual dating, sorted sessions, mail report) for the PURE block of src/page.html. Run:
//   python tools/shelly.py testpage src/page.html tests/page3_test.js
t("handDated", function () {
  let l = parseSessions(["16,~4.7,60,800,pd;15,----,0,5590,i"], "202611");
  eq("no time", l[0].hhmm, null); eq("boot", l[0].b, 4); eq("up", l[0].up, 7); eq("imported", l[1].b, undefined);
  let s = sortS(parseSessions(["16,0900,5,1;15,1400,5,2;15,----,0,3,i;15,0800,5,4"], "202611"));
  eq("sorted", s.map(x => x.wh), [3, 4, 2, 1]);
});
t("undatedItems", function () {
  let it = undatedItems("5,T,0,40;4,4000,30,50;4,7,60,800,p;4,T,0,900;6,9,1,2", 6);
  eq("ordered, T hidden while sessions, current boot hidden", it.map(x => x.n + "." + x.up), ["4.7", "4.4000", "5.T"]);
  eq("fields", it[0], {n: 4, up: "7", min: 60, wh: 800, f: "p"});
  eq("empty", undatedItems(null, 1), []);
});
t("boundsOf", function () {
  // boots 3 and 7 dated (15/11 and 18/11 08:00 UTC); boot 4 dated by hand on 16/11 at up 100
  let boots = {"3": 1794729600 + 8 * 3600, "7": 1794988800 + 8 * 3600};
  let man = [{day: "2026-11-16", b: 4, up: 100}, {day: "2026-11-15", wh: 1}];
  eq("after hand-dated", boundsOf({n: 4, up: "200"}, boots, man, "2026-11-20", "2026-11-01", 0), {lo: "2026-11-16", hi: "2026-11-18"});
  eq("before hand-dated", boundsOf({n: 4, up: "50"}, boots, man, "2026-11-20", "2026-11-01", 0), {lo: "2026-11-15", hi: "2026-11-16"});
  eq("T after all of its boot", boundsOf({n: 5, up: "T"}, boots, man, "2026-11-20", "", 0), {lo: "2026-11-16", hi: "2026-11-18"});
  eq("nothing known", boundsOf({n: 9, up: "1"}, {}, [], "2026-11-20", "", 0), {lo: "", hi: "2026-11-20"});
  eq("range", rangeOf([{lo: "2026-11-15", hi: "2026-11-18"}, {lo: "2026-11-16", hi: "2026-11-20"}]), {lo: "2026-11-16", hi: "2026-11-18", ok: true});
  eq("empty range", rangeOf([{lo: "2026-11-17", hi: "2026-11-18"}, {lo: "", hi: "2026-11-16"}]).ok, false);
});
t("dayList", function () {
  eq("range", daysIn("2026-10-30", "2026-11-02", 120), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  eq("no lower bound = max days", daysIn("", "2026-11-02", 3), ["2026-10-31", "2026-11-01", "2026-11-02"]);
});
