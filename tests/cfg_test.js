// Unit tests for the LIB region of src/cfg_lib.js (shared config). Run:
//   python tools/shelly.py --ip <ip> test src/cfg_lib.js tests/cfg_test.js
//   python tools/shelly.py testpage src/cfg_lib.js tests/cfg_test.js
let BS = String.fromCharCode(92);
function U(hex) { return JSON.parse('"' + BS + 'u' + hex + '"'); }
let EURO = U("20ac");
let EM = JSON.parse('"' + BS + 'ud83d' + BS + 'ude00"');
let DEF = {v: 1, r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, sg: 600, p: 0, cu: "EUR", ds: ".", df: "YMD", lo: 1, lb: 50};
t("cfg_defaults", function () {
  eq("null", cfgParse(null), DEF);
  eq("text", cfgParse("x"), DEF);
  eq("empty", cfgParse(""), DEF);
  eq("array", cfgParse("[1,2]"), DEF);
  eq("number", cfgParse("5"), DEF);
  eq("obj", cfgParse("{}"), DEF);
  eq("unknown dropped", cfgParse('{"zz":1,"w":"a"}'), DEF);
});
t("cfg_bad_range", function () {
  let c = cfgParse('{"r":5,"lb":3}');
  eq("r", c.r, 0.1); eq("lb", c.lb, 50);
  eq("others", [c.g, c.y, c.h, c.hs, c.sg], [5, 11, 0.3, 10, 600]);
  eq("lo 2", cfgParse('{"lo":2}').lo, 1);
  eq("p neg", cfgParse('{"p":-1}').p, 0);
  eq("p 10", cfgParse('{"p":10}').p, 10);
  eq("p 11", cfgParse('{"p":11}').p, 0);
  eq("hs ok", cfgParse('{"hs":2}').hs, 2);
});
t("cfg_bad_order", function () {
  let c = cfgParse('{"g":12,"y":11}');
  eq("g/y", [c.r, c.g, c.y], [0.1, 5, 11]);
  c = cfgParse('{"g":8,"y":8}');
  eq("equal", [c.r, c.g, c.y], [0.1, 5, 11]);
  c = cfgParse('{"r":1,"g":1,"y":9}');
  eq("r>=g", [c.r, c.g, c.y], [0.1, 5, 11]);
  c = cfgParse('{"r":0.2,"g":6,"y":9}');
  eq("good", [c.r, c.g, c.y], [0.2, 6, 9]);
});
t("cfg_bad_types", function () {
  let c = cfgParse('{"g":"7","cu":""}');
  eq("g", c.g, 5); eq("cu", c.cu, "EUR");
  eq("null g", cfgParse('{"g":null}').g, 5);
  eq("bool", cfgParse('{"lo":true}').lo, 1);
  eq("ds", cfgParse('{"ds":";"}').ds, ".");
  eq("df", cfgParse('{"df":"xyz"}').df, "YMD");
  eq("cu num", cfgParse('{"cu":5}').cu, "EUR");
});
t("cfg_bad_json", function () {
  eq("trunc", cfgParse('{"g":7,'), DEF);
  eq("junk", cfgParse("{{{"), DEF);
});
t("cfg_strings", function () {
  let c = cfgParse(JSON.stringify({cu: EURO, ds: ",", df: "DMY"}));
  eq("kept", [c.cu, c.ds, c.df], [EURO, ",", "DMY"]);
  eq("long cu", cfgParse('{"cu":"EURO1"}').cu, "EUR");
  eq("4 chars", cfgParse('{"cu":"EURO"}').cu, "EURO");
  eq("MDY", cfgParse('{"df":"MDY"}').df, "MDY");
});
t("cfg_utf8_len", function () {
  eq("euro", u8len(EURO), 3);
  eq("abc", u8len("abc"), 3);
  eq("empty", u8len(""), 0);
  eq("e acute", u8len(U("00e9")), 2);
  eq("emoji", u8len(EM), 4);
  eq("mixed", u8len("a" + EURO + EM), 8);
});
t("cfg_json_minimal", function () {
  eq("defaults", cfgJson(cfgParse(null)), '{"v":1}');
  eq("p", cfgJson(cfgParse('{"p":0.2}')), '{"v":1,"p":0.2}');
  eq("two", cfgJson(cfgParse('{"g":6,"cu":"zl"}')), '{"v":1,"g":6,"cu":"zl"}');
});
t("cfg_json_limit", function () {
  let em = EM;
  let c = cfgParse(JSON.stringify({r: 0.55, g: 10, y: 12, h: 0.55, hr: 0.25, hs: 55, sg: 3000, p: 9.99,
    cu: em + em + em + em, ds: ",", df: "DMY", lo: 0, lb: 99}));
  let j = cfgJson(c);
  eq("all fields fit", j !== null && u8len(j) <= 253, true);
  eq("roundtrip", cfgParse(j), c);
  let big = cfgParse(null);
  big.cu = "";
  let i; for (i = 0; i < 300; i++) big.cu += "x";
  eq("too long", cfgJson(big), null);
  let m = cfgParse(null);
  m.cu = "";
  for (i = 0; i < 84; i++) m.cu += EURO;
  eq("bytes not chars", cfgJson(m), null);
});
t("cfg_bad_list", function () {
  eq("r", cfgBad({r: 5, g: 3}), ["r"]);
  eq("none", cfgBad({}), []);
  eq("order", cfgBad({g: 8, y: 8}), ["g", "y"]);
  eq("range", cfgBad({g: 12, y: 11}), ["g"]);
  eq("types", cfgBad({g: "7", cu: ""}), ["g", "cu"]);
  eq("same as default", cfgBad({g: 5, cu: "EUR"}), []);
  eq("null", cfgBad(null), []);
});
t("cfg_diff", function () {
  let a = cfgParse(null), b = cfgParse('{"g":6,"cu":"zl"}');
  eq("diff", cfgDiff(a, b), ["g", "cu"]);
  eq("same", cfgDiff(a, a), []);
});

// ---- rc.9: threshold ceilings per build (Plug PM Gen3: 16 A plug, g <= 15 A, y <= 16 A) ----
t("cfg_ceilings", function () {
  //@if relay
  eq("y 16 refused", cfgParse('{"r":0.1,"g":10,"y":16}').y, 11);
  eq("y 12 ok", cfgParse('{"r":0.1,"g":10,"y":12}').y, 12);
  eq("g 12 range", cfgBad({g: 12, y: 12}), ["g"]);
  //@else
  eq("y 16 ok", cfgParse('{"r":0.1,"g":10,"y":16}').y, 16);
  eq("y 17 refused", cfgParse('{"r":0.1,"g":10,"y":17}').y, 11);
  eq("g 15 ok", cfgParse('{"r":0.1,"g":15,"y":16}').g, 15);
  eq("g 16 range", cfgBad({g: 16, y: 16}), ["g"]);
  //@end
});
