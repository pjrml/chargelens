// Runs the pure logic of a ChargeLens source plus a test file in Node (no dependencies, no device, no browser).
//   node tools/puretest.js <libfile> <testfile>
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

function pureOf(file) {
  if (file.endsWith(".js")) return libSection(file, true);
  const src = read(file);
  const a = src.indexOf("/* ==== PURE ==== */"), b = src.indexOf("/* ==== END PURE ==== */");
  return a >= 0 && b > a ? expandLibs(file, src.slice(a, b), true) : "";
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
  const libfile = process.argv[2], testfile = process.argv[3];
  if (!libfile || !testfile) {
    console.error("usage: node tools/puretest.js <libfile> <testfile>");
    process.exit(2);
  }
  const mailf = path.join(path.dirname(path.resolve(libfile)), "mail-default.json");
  const mail = "let MAIL_DEFAULT_JSON = " + JSON.stringify(fs.existsSync(mailf) ? read(mailf) : "") + ";\n";
  let test = read(testfile);
  // browser-only tests: the test file defines "function tb(name, fn) { t(name, fn); }"; skip them here
  test = test.replace(/function tb\(name, fn\)\s*\{[^}]*\}/, "function tb(name, fn) { __SKIPPED++; }");
  const code = PRELUDE + mail + pureOf(libfile) + "\n" + test + "\n__next();\n";
  const ctx = vm.createContext({console: console});
  try {
    vm.runInContext(code, ctx, {filename: path.basename(testfile)});
  } catch (e) {
    console.log("FAIL: tests did not run: " + (e && e.stack ? e.stack : e));
    process.exit(1);
  }
  const res = JSON.parse(vm.runInContext("JSON.stringify(__R)", ctx));
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
