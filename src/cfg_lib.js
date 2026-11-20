// Shared config (cc:cfg) parsing and validation. ES5, no closures; runs in Shelly mJS and in browsers.
// Included in scripts and pages with a line "//@lib cfg_lib.js" (see tools/shelly.py expand_libs).
// ==== LIB ====
// [field, default, min, max]; strings: cu (1-4 chars, "EUR"), ds ("." or ","), df (YMD, DMY, MDY)
let CFG_NUM = [["r", 0.1, 0.02, 1], ["g", 5, 1, 11], ["y", 11, 1, 12], ["h", 0.3, 0.05, 1], ["hr", 0.05, 0.01, 0.5],
  ["hs", 10, 2, 60], ["sg", 600, 60, 3600], ["p", 0, 0, 10], ["lo", 1, 0, 1], ["lb", 50, 5, 100]];
let CFG_ORD = ["r", "g", "y", "h", "hr", "hs", "sg", "p", "cu", "ds", "df", "lo", "lb"];
// mJS strings are bytes (length = UTF-8 bytes); browser strings are UTF-16
let U8B = JSON.parse('"' + String.fromCharCode(92) + 'u00e9"').length === 2;
function u8len(s) {
  if (U8B) return s.length;
  let n = 0, i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c < 128) n += 1; else if (c < 2048) n += 2; else if (c >= 55296 && c < 56320) { n += 4; i++; } else n += 3;
  }
  return n;
}
function u8chars(s) {
  let n = 0, i, c;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (U8B ? (c & 192) !== 128 : (c < 56320 || c > 57343)) n++;
  }
  return n;
}
function cfgDef(k) {
  let i;
  for (i = 0; i < CFG_NUM.length; i++) if (CFG_NUM[i][0] === k) return CFG_NUM[i][1];
  return k === "cu" ? "EUR" : k === "ds" ? "." : "YMD";
}
function cfgOk(k, v) {
  let i, n;
  if (k === "cu") { if (typeof v !== "string") return false; n = u8chars(v); return n >= 1 && n <= 4; }
  if (k === "ds") return v === "." || v === ",";
  if (k === "df") return v === "YMD" || v === "DMY" || v === "MDY";
  if (typeof v !== "number") return false;
  for (i = 0; i < CFG_NUM.length; i++) if (CFG_NUM[i][0] === k) return v >= CFG_NUM[i][2] && v <= CFG_NUM[i][3];
  return false;
}
function cfgFix(o) {
  let c = {v: 1}, i, k;
  if (typeof o !== "object" || o === null) o = {};
  for (i = 0; i < CFG_ORD.length; i++) { k = CFG_ORD[i]; c[k] = cfgOk(k, o[k]) ? o[k] : cfgDef(k); }
  if (!(c.r < c.g && c.g < c.y)) { c.r = cfgDef("r"); c.g = cfgDef("g"); c.y = cfgDef("y"); }
  return c;
}
function cfgParse(text) {
  let o = null;
  try { o = JSON.parse(text); } catch (e) { o = null; }
  return cfgFix(o);
}
function cfgBad(o) {
  let bad = [], c = cfgFix(o), i, k;
  if (typeof o !== "object" || o === null) return bad;
  for (i = 0; i < CFG_ORD.length; i++) {
    k = CFG_ORD[i];
    if (typeof o[k] !== "undefined" && JSON.stringify(o[k]) !== JSON.stringify(c[k])) bad.push(k);
  }
  return bad;
}
function cfgDiff(a, b) {
  let d = [], i, k;
  for (i = 0; i < CFG_ORD.length; i++) {
    k = CFG_ORD[i];
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push(k);
  }
  return d;
}
function cfgJson(cfg) {
  let s = '{"v":1', i, k;
  for (i = 0; i < CFG_ORD.length; i++) {
    k = CFG_ORD[i];
    if (JSON.stringify(cfg[k]) !== JSON.stringify(cfgDef(k))) s += ',"' + k + '":' + JSON.stringify(cfg[k]);
  }
  s += "}";
  return u8len(s) > 253 ? null : s;
}
// ==== END LIB ====
