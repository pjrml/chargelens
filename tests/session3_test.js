// Unit tests (v2.1: manual dating of undated charges) for the LIB section of src/meter.js. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/session3_test.js
t("suAddT", function () {
  eq("new", suAddT(null, 4, 900), "4,T,0,900");
  eq("appended", suAddT("4,7,60,800", 4, 900), "4,7,60,800;4,T,0,900");
  eq("merged", suAddT("4,T,0,900;5,T,0,1", 4, 100), "4,T,0,1000;5,T,0,1");
});
t("suDateSession", function () {
  let x = suDate("4,7,60,800,p;4,4000,30,50;4,T,0,900", 4, "7", "20261115");
  eq("day gets session", x.wh, 800); eq("line", x.line, "15,~4.7,60,800,pd");
  eq("T drops", x.rest, "4,4000,30,50;4,T,0,100");
});
t("suDateLast", function () {
  let x = suDate("4,4000,30,50;4,T,0,100;5,1,2,3", 4, "4000", "20261116");
  eq("last session takes the rest", x.wh, 100); eq("line", x.line, "16,~4.4000,30,50,d");
  eq("T gone", x.rest, "5,1,2,3");
});
t("suDateT", function () {
  eq("T alone is an item", suDate("6,T,0,40", 6, "T", "20261116"), {wh: 40, line: null, rest: null});
  eq("T refused while sessions", suDate("6,1,2,3;6,T,0,40", 6, "T", "20261116"), null);
  eq("no T line", suDate("6,1,2,3", 6, "1", "20261116").wh, 3);
  eq("unknown", suDate("6,1,2,3", 6, "9", "20261116"), null);
  eq("empty", suDate(null, 6, "1", "20261116"), null);
});
