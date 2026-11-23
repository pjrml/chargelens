// Runs the pure logic of a ChargeLens source plus a test file in Node (no dependencies, no device, no browser).
//   node tools/puretest.js [--build NAME] <libfile> <testfile>
// --build NAME (default plugs): the build of tools/builds.json whose features resolve the //@if markers.
// <libfile>: a .js script/library (its "// ==== LIB ====" region) or an .html page (its "/* ==== PURE ==== */"
// block). Same prelude as TEST_PRELUDE / run_page_tests in tools/shelly.py. Tests registered with tb() (they need
// navigator/DOM, so only a browser can run them) are skipped and counted.
// Prints "N passed, M failed" (+ skipped count); exit code 1 on any failure or when nothing ran.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PAGE_ONLY = "// ==== PAGE ONLY ====";
const LIB_MARK = /^[ \t]*(?:\/\/@lib[ \t]+(\S+)|\/\*@lib[ \t]+(\S+?)\*\/)[ \t]*$/gm;

function read(p) { return fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n"); }

// LIB region of a .js file with //@lib includes expanded (mirrors lib_section / expand_libs in shelly.py)
function libSection(file, pageOnly) {
  const src = read(file);
  const a = src.indexOf("// ==== LIB ===="), b = src.indexOf("// ==== END LIB ====");
  if (a < 0 || b < a) return "";
  let region = src.slice(a, b);
  if (!pageOnly && region.indexOf(PAGE_ONLY) >= 0) region = region.slice(0, region.indexOf(PAGE_ONLY));
  return expandLibs(file, region, file.endsWith(".html"));
}

function expandLibs(file, code, pageOnly) {
  const base = path.dirname(path.resolve(file));
  return code.replace(LIB_MARK, function (m, n1, n2) {
    const name = n1 || n2;
    const lib = libSection(path.join(base, name), pageOnly);
    if (!lib) throw new Error("@lib " + name + ": no LIB region");
    return lib.slice(lib.indexOf("\n") + 1).replace(/\n+$/, "");
  });
}

// Feature markers: whole lines //@if FLAG, //@if !FLAG, //@else, //@end (or the <!--@if FLAG--> form).
// Mirrors apply_features in tools/shelly.py (same regex, same errors).
const FEATURES_KNOWN = ["relay"];
const FEATURE_MARK = /^[ \t]*(?:\/\/|<!--)[ \t]*@(if|else|end)(?:[ \t]+(!?)(\w+))?[ \t]*(?:-->)?[ \t]*$/;
function applyFeatures(code, features, where) {
  const out = [];
  let state = null;  // [keepIfBranch, inElse, openedLine]
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1, m = FEATURE_MARK.exec(lines[i]);
    if (!m) {
      if (state === null || state[0] !== state[1]) out.push(lines[i]);
      continue;
    }
    const kind = m[1], neg = m[2], flag = m[3], here = where + " line " + n;
    if (kind === "if") {
      if (flag === undefined || FEATURES_KNOWN.indexOf(flag) < 0) throw new Error(here + ": unknown feature flag " + flag);
      if (state !== null) throw new Error(here + ": nested @if (opened at line " + state[2] + ")");
      state = [(features.indexOf(flag) >= 0) !== !!neg, false, n];
    } else {
      if (flag !== undefined) throw new Error(here + ": @" + kind + " takes no flag");
      if (state === null) throw new Error(here + ": @" + kind + " without @if");
      if (kind === "else") {
        if (state[1]) throw new Error(here + ": second @else");
        state[1] = true;
      } else state = null;
    }
  }
  if (state !== null) throw new Error(where + " line " + state[2] + ": @if never closed with @end");
  return out.join("\n");
}

let FEATURES = ["relay"];

function pureOf(file) {
  if (file.endsWith(".js")) return applyFeatures(libSection(file, true), FEATURES, file);
  const src = read(file);
  const a = src.indexOf("/* ==== PURE ==== */"), b = src.indexOf("/* ==== END PURE ==== */");
  return a >= 0 && b > a ? applyFeatures(expandLibs(file, src.slice(a, b), true), FEATURES, file) : "";
}

const PRELUDE = `
let __R = [];
let __SKIPPED = 0;
function __s(x) { return JSON.stringify(x); }
function __add(label, ok, g, e) { __R.push(ok ? {n: label, ok: true} : {n: label, ok: false, g: g, e: e}); }
function eq(label, got, exp) { let g = __s(got), e = __s(exp); __add(label, g === e, g, e); }
function near(label, got, exp, tol) { __add(label, Math.abs(got - exp) <= tol, __s(got), __s(exp)); }
let __Q = [];
function t(name, fn) { __Q.push([name, fn]); }
function __next() {
  while (__Q.length) {
    let job = __Q.splice(0, 1)[0];
    try { job[1](); } catch (e) { __R.push({n: job[0], ok: false, g: "EXC " + String(e), e: ""}); }
  }
}
`;

function main() {
  const args = process.argv.slice(2);
  let build = "plugs";
  const bi = args.indexOf("--build");
  if (bi >= 0) { build = args[bi + 1]; args.splice(bi, 2); }
  const builds = JSON.parse(read(path.join(__dirname, "builds.json")));
  if (!build || !Object.prototype.hasOwnProperty.call(builds, build)) {
    console.error("unknown build " + build + " (known: " + Object.keys(builds).join(", ") + ")");
    process.exit(2);
  }
  FEATURES = builds[build].features;
  const libfile = args[0], testfile = args[1];
  if (!libfile || !testfile) {
    console.error("usage: node tools/puretest.js [--build NAME] <libfile> <testfile>");
    process.exit(2);
  }
  const mailf = path.join(path.dirname(path.resolve(libfile)), "mail-default.json");
  const mail = "let MAIL_DEFAULT_JSON = " + JSON.stringify(fs.existsSync(mailf) ? read(mailf) : "") + ";\n";
  let test;
  try { test = applyFeatures(read(testfile), FEATURES, testfile); }
  catch (e) { console.log("FAIL: " + e.message); process.exit(1); }
  // browser-only tests: the test file defines "function tb(name, fn) { t(name, fn); }"; skip them here
  test = test.replace(/function tb\(name, fn\)\s*\{[^}]*\}/, "function tb(name, fn) { __SKIPPED++; }");
  let pure;
  try { pure = pureOf(libfile); }
  catch (e) { console.log("FAIL: " + e.message); process.exit(1); }
  const code = PRELUDE + mail + pure + "\n" + test + "\n__next();\n";
  const ctx = vm.createContext({console: console});
  try {
    vm.runInContext(code, ctx, {filename: path.basename(testfile)});
  } catch (e) {
    console.log("FAIL: tests did not run: " + (e && e.stack ? e.stack : e));
    process.exit(1);
  }
  const res = JSON.parse(vm.runInContext("JSON.stringify(__R)", ctx));
  if (libfile.endsWith(".html")) {  // the whole page script must parse (the PURE tests alone miss a typo outside PURE)
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m, i = 0;
    while ((m = re.exec(read(libfile))) !== null) {
      const n = "script " + i++ + " parses";
      try { new vm.Script(applyFeatures(expandLibs(libfile, m[1], true), FEATURES, libfile + " " + n)); res.push({n: n, ok: true}); }
      catch (e) { res.push({n: n, ok: false, g: String(e), e: "no error"}); }
    }
  }
  const skipped = vm.runInContext("__SKIPPED", ctx);
  let fails = 0;
  for (const x of res) {
    if (!x.ok) {
      fails++;
      console.log("FAIL " + x.n + "  got=" + x.g + " exp=" + x.e);
    }
  }
  console.log(path.basename(testfile) + ": " + (res.length - fails) + " passed, " + fails + " failed" +
    (skipped ? " (" + skipped + " browser-only test(s) skipped)" : ""));
  process.exit(fails || !res.length ? 1 : 0);
}

main();
