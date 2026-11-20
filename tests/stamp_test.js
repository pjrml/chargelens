// Unit tests (v2 Task 2: boot counter, stamps, boot map) for the LIB section of src/meter.js. Run:
//   python tools/shelly.py --ip <ip> test src/meter.js tests/stamp_test.js
let B = 1794950000;
t("stamp", function () {
  eq("unix", stamp(B, 3, 50), B);
  eq("undated", stamp(0, 3, 50.7), "~3.50");
  eq("real boot", isRealBoot(30, 20), true); eq("restart", isRealBoot(900, 800), false);
});
t("boots", function () {
  let l = addBoot(parseBoots("2:1794900000:p"), 3, B, "s");
  eq("fmt", fmtBoots(l), "2:1794900000:p;3:1794950000:s");
  eq("replace", fmtBoots(addBoot(l, 3, B + 5, "r")), "2:1794900000:p;3:1794950005:r");
  let big = []; let i; for (i = 0; i < 40; i++) big = addBoot(big, i, B + i, "s");
  eq("fits 253", fmtBoots(big).length <= 253, true);
  eq("keeps newest", parseBoots(fmtBoots(big))[0][0] > 0, true);
  eq("empty", parseBoots(null), []);
});
t("resolveMixed", function () {
  let l = parseBoots("3:1794950000:s");
  eq("unix", resolveStamp(B + 9, l), B + 9);
  eq("dated boot", resolveStamp("~3.120", l), B + 120);
  eq("unknown boot", resolveStamp("~2.120", l), null);
});
