// Unit tests (v2 Task 6: event and heartbeat rings) for the LIB section of src/meter.js. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/event_test.js
t("events", function () {
  eq("boot", fmtEv("B", "~4.3", "1/~3.7200"), "B,~4.3,1/~3.7200");
  eq("relay", fmtEv("R", 1794735000, "0/button"), "R,1794735000,0/button");
  eq("ring", ringNext(2, 3), 0);
  let p = evPush(null, "R,1,0/http"); eq("first", p, {value: "R,1,0/http", full: false});
  let v = ""; let i; for (i = 0; i < 30; i++) v = (v ? v + ";" : "") + "R,1794735000,0/HTTP_in";
  v = v.slice(0, 240);
  eq("full -> next key", evPush(v, "R,1794735000,1/HTTP_in"), {value: "R,1794735000,1/HTTP_in", full: true});
});
t("lossEstimate", function () {
  eq("prev boot newest", lossEstimate(["~3.600", "~3.1200", "~4.10"], 4), "~3.1200");
  eq("unix wins by value", lossEstimate(["1794735000", "1794735600"], 4), 1794735600);
  eq("none", lossEstimate([], 4), null);
  eq("prev undated ignores older unix", lossEstimate(["1794735600", "~3.300", null], 4, true), "~3.300");
});
