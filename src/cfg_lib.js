// Shared config (cc:cfg) parsing and validation. ES5, no closures; runs in Shelly mJS and in browsers.
// Included in scripts and pages with a line "//@lib cfg_lib.js" (see tools/shelly.py expand_libs).
// ==== LIB ====
// [field, default, min, max]; strings: cu (1-4 chars, "EUR"), ds ("." or ","), df (YMD, DMY, MDY)
// The table is built on demand, so scripts do not keep it in the heap; pages and tests use CFG_NUM / CFG_ORD
// (PAGE ONLY part). Defaults of r, g, y are the first three entries.
function cfgNum() {
  let t = "r,0.1,0.02,1;g,5,1,11;y,11,1,12;h,0.3,0.05,1;hr,0.05,0.01,0.5;hs,10,2,60;sg,600,60,3600;p,0,0,10;lo,1,0,1;lb,50,5,100".split(";");
  let out = [], i, p;
  for (i = 0; i < t.length; i++) { p = t[i].split(","); out.push([p[0], Number(p[1]), Number(p[2]), Number(p[3])]); }
  return out;
}
// Core (scripts and pages): numeric fields only. Pages add the string fields through cfgX (PAGE ONLY part).
let cfgX = null;
function cfgFix(o) {
  let T = cfgNum(), c = {v: 1}, i, a, x;
  if (typeof o !== "object" || o === null) o = {};
  for (i = 0; i < T.length; i++) {
    a = T[i]; x = o[a[0]];
    c[a[0]] = (typeof x === "number" && x >= a[2] && x <= a[3]) ? x : a[1];
  }
  if (!(c.r < c.g && c.g < c.y)) { c.r = T[0][1]; c.g = T[1][1]; c.y = T[2][1]; }
  return cfgX ? cfgX(c, o) : c;
}
function cfgParse(text) {
  let o = null;
  try { o = JSON.parse(text); } catch (e) { o = null; }
  return cfgFix(o);
}
// ==== PAGE ONLY ==== (scripts get only the part above; see tools/shelly.py expand_libs)
let CFG_NUM = cfgNum();
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
function cfgStrOk(k, v) {
  if (k === "cu") { let n; if (typeof v !== "string") return false; n = u8chars(v); return n >= 1 && n <= 4; }
  if (k === "ds") return v === "." || v === ",";
  return v === "YMD" || v === "DMY" || v === "MDY";
}
// string fields validated, keys put back in CFG_ORD order
cfgX = function (c, o) {
  let n = {v: 1}, i, k;
  for (i = 0; i < CFG_ORD.length; i++) {
    k = CFG_ORD[i];
    n[k] = typeof c[k] === "number" ? c[k] : (cfgStrOk(k, o[k]) ? o[k] : cfgDef(k));
  }
  return n;
};
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
