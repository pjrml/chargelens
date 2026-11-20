"""ChargeLens dev CLI for Shelly Plus Plug S / Plug S Gen3 (Gen2 RPC over HTTP, no auth).

Usage (from the repo root; --ip is required for every device command):
  python tools/shelly.py --ip IP info
  python tools/shelly.py --ip IP backup [--out DIR]
  python tools/shelly.py --ip IP rpc METHOD ['{"json":"params"}']
  python tools/shelly.py --ip IP put NAME FILE [--temp | --store]
  python tools/shelly.py --ip IP delscript NAME
  python tools/shelly.py --ip IP test LIBFILE TESTFILE
  python tools/shelly.py testpage HTMLFILE TESTFILE [--browser PATH]

info      : device info, free RAM (Sys.GetStatus ram_free) and the script list.
backup    : full dump (device info, config, status, scripts with code, KVS, schedules, webhooks) to
            DIR/<timestamp>/ (default ~/.config/chargelens/backups/, outside the repo).
rpc       : calls any RPC method (POST /rpc) and prints the JSON result.
put       : creates/replaces script NAME from FILE (--temp: not enabled at boot; --store: data only).
test      : runs LIBFILE's LIB section plus TESTFILE on the device as a temporary script "Test".
testpage  : runs the PURE block of an HTML page (or the LIB region of a .js file) plus TESTFILE in headless Edge (no device needed).

Stdlib only. ASCII only.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import urllib.request

BACKUPS = os.path.join(os.path.expanduser("~"), ".config", "chargelens", "backups")
TIMEOUT = 8


def rpc(ip, method, params=None):
    body = {"id": 1, "method": method}
    if params is not None:
        body["params"] = params
    req = urllib.request.Request(
        "http://%s/rpc" % ip,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    for attempt in range(3):  # Wi-Fi plug: retry transient connection failures
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                resp = json.loads(r.read().decode("utf-8"))
            break
        except (OSError, ValueError):
            if attempt == 2:
                raise
    if "error" in resp:
        raise RuntimeError("%s: %s" % (method, resp["error"]))
    return resp.get("result")


def script_code(ip, sid):
    code, offset = "", 0
    while True:
        res = rpc(ip, "Script.GetCode", {"id": sid, "offset": offset})
        chunk = res.get("data", "")
        code += chunk
        offset += len(chunk)
        if not res.get("left") or not chunk:
            return code


def backup(ip, out=None):
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
    dest = os.path.join(out or BACKUPS, ts)
    os.makedirs(os.path.join(dest, "scripts"))

    def save(name, data):
        with open(os.path.join(dest, name), "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, indent=2, sort_keys=True)
            f.write("\n")

    for name, method in [
        ("device_info", "Shelly.GetDeviceInfo"),
        ("config", "Shelly.GetConfig"),
        ("status", "Shelly.GetStatus"),
        ("components", "Shelly.GetComponents"),
        ("methods", "Shelly.ListMethods"),
        ("schedules", "Schedule.List"),
        ("webhooks", "Webhook.List"),
    ]:
        try:
            save(name + ".json", rpc(ip, method))
        except Exception as e:
            print("warn: %s failed: %s" % (method, e), file=sys.stderr)
    try:
        save("kvs.json", rpc(ip, "KVS.GetMany", {"match": "*"}))
    except Exception as e:
        print("warn: KVS.GetMany failed: %s" % e, file=sys.stderr)

    scripts = rpc(ip, "Script.List").get("scripts", [])
    save("scripts.json", scripts)
    for s in scripts:
        sid = s["id"]
        safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", s.get("name") or "script")
        cfg = rpc(ip, "Script.GetConfig", {"id": sid})
        save("scripts/%02d_%s.config.json" % (sid, safe), cfg)
        code = script_code(ip, sid)
        with open(os.path.join(dest, "scripts", "%02d_%s.js" % (sid, safe)), "w", encoding="utf-8", newline="\n") as f:
            f.write(code)
        print("script %d %-30s enable=%s running=%s %d bytes" % (
            sid, s.get("name"), s.get("enable"), s.get("running"), len(code)))
    print("backup: %s" % dest)
    return dest


def info(ip):
    d = rpc(ip, "Shelly.GetDeviceInfo")
    print("id=%s model=%s app=%s gen=%s fw=%s" % (d.get("id"), d.get("model"), d.get("app"), d.get("gen"), d.get("ver")))
    print("ram_free=%s" % rpc(ip, "Sys.GetStatus").get("ram_free"))
    for s in rpc(ip, "Script.List").get("scripts", []):
        print("script %s %-12s enable=%s running=%s" % (s["id"], s.get("name"), s.get("enable"), s.get("running")))


def script_id(ip, name_or_id):
    for s in rpc(ip, "Script.List").get("scripts", []):
        if str(s["id"]) == str(name_or_id) or s.get("name") == name_or_id:
            return s["id"]
    return None


def minify(code):
    """Drop full-line // comments, blank lines and indentation: script source lives in the shared ~25 KB
    script heap, so comments cost RAM. (No block comments or multi-line strings in our scripts.)"""
    out = []
    for line in code.splitlines():
        s = strip_trailing_comment(line.strip())
        if s and not s.startswith("//"):
            out.append(s)
    return chr(10).join(out) + chr(10)


def strip_trailing_comment(line):
    """Cut a trailing // comment from one line, quote-aware: a // inside '...' or "..." (e.g. "http://") stays.
    Scripts have no regex literals containing //."""
    q = None
    i = 0
    while i < len(line):
        c = line[i]
        if q:
            if c == chr(92):
                i += 1
            elif c == q:
                q = None
        elif c in "'\"":
            q = c
        elif c == "/" and line[i + 1:i + 2] == "/":
            return line[:i].rstrip()
        i += 1
    return line


assert strip_trailing_comment('x = "http://a"; // c') == 'x = "http://a";'
assert strip_trailing_comment("y = 'a" + chr(92) + "'//b'; // c") == "y = 'a" + chr(92) + "'//b';"
assert strip_trailing_comment("z = 1;  // c") == "z = 1;"


def put(ip, name, code, start=True, enable=True, mini=True):
    """Create (if missing) or replace script NAME with CODE, enable it (start at boot), start it. Returns the id.
    The device allows at most 3 enabled scripts: temporary scripts use enable=False."""
    if mini:
        code = minify(code)
    bad = [i for i, ch in enumerate(code) if ord(ch) > 127]
    if bad:
        raise RuntimeError("non-ASCII character at offset %d: the device rejects it (use JS unicode escapes or HTML entities)" % bad[0])
    sid = script_id(ip, name)
    if sid is None:
        sid = rpc(ip, "Script.Create", {"name": name})["id"]
    else:
        try:
            rpc(ip, "Script.Stop", {"id": sid})
        except RuntimeError:
            pass  # not running
    chunk = 4000
    for i in range(0, max(len(code), 1), chunk):
        rpc(ip, "Script.PutCode", {"id": sid, "code": code[i:i + chunk], "append": i > 0})
    if script_code(ip, sid) != code:
        raise RuntimeError("uploaded code differs from source")
    if enable:
        rpc(ip, "Script.SetConfig", {"id": sid, "config": {"enable": True}})
    if start:
        rpc(ip, "Script.Start", {"id": sid})
    return sid


def expand_includes(path, code):
    """Replace /*@include FILE*/"" with FILE's content as a JS string literal (FILE relative to path)."""
    marker = "/*@include "
    while marker in code:
        a = code.index(marker)
        b = code.index("*/", a)
        name = code[a + len(marker):b].strip()
        end = b + 2
        if code[end:end + 2] == '""':
            end += 2
        inc = open(os.path.join(os.path.dirname(os.path.abspath(path)), name), encoding="utf-8").read()
        if any(ord(ch) > 127 for ch in inc):
            raise RuntimeError("%s has non-ASCII characters: use HTML entities or JS escapes" % name)
        code = code[:a] + json.dumps(inc) + code[end:]
    return code


def delscript(ip, name_or_id):
    sid = script_id(ip, name_or_id)
    if sid is None:
        sys.exit("no script %s" % name_or_id)
    try:
        rpc(ip, "Script.Stop", {"id": sid})
    except RuntimeError:
        pass
    rpc(ip, "Script.Delete", {"id": sid})
    print("deleted script %s" % sid)


def strip_test_only(code):
    """Drop '// ==== TEST ONLY ====' .. '// ==== END TEST ONLY ====' regions (code only tests use) from deployed scripts."""
    return re.sub(r"// ==== TEST ONLY ====.*?// ==== END TEST ONLY ====" + chr(92) + "n?", "", code, flags=re.S)


PAGE_ONLY_MARK = "// ==== PAGE ONLY ===="


def lib_section(path, page_only=True):
    """LIB region of PATH (between the LIB markers), with //@lib includes expanded. '' when there is none.
    page_only=False cuts the region at the PAGE ONLY marker (code only pages need, to save script heap)."""
    src = open(path, encoding="utf-8").read()
    a, b = src.find("// ==== LIB ===="), src.find("// ==== END LIB ====")
    if a < 0 or b < a:
        return ""  # no LIB yet: tests must fail
    region = src[a:b]
    if not page_only and PAGE_ONLY_MARK in region:
        region = region[:region.find(PAGE_ONLY_MARK)]
    return expand_libs(path, region)


LIB_MARK = re.compile(r"^[ 	]*(?://@lib[ 	]+(\S+)|/\*@lib[ 	]+(\S+?)\*/)[ 	]*$", re.M)


def expand_libs(path, code, page_only=None):
    """Replace a line '//@lib NAME' or '/*@lib NAME*/' with the LIB region of NAME (a file next to PATH),
    without its marker lines. Rule: the PAGE ONLY part of NAME is kept only when the target PATH is an .html
    page (override with page_only); scripts (.js) get the part above the marker. Also used by tools/build.py."""
    if page_only is None:
        page_only = path.endswith(".html")
    base = os.path.dirname(os.path.abspath(path))

    def repl(m):
        lib = lib_section(os.path.join(base, m.group(1) or m.group(2)), page_only)
        if not lib:
            raise RuntimeError("@lib %s: no LIB region" % (m.group(1) or m.group(2)))
        return lib.split(chr(10), 1)[1].rstrip(chr(10))
    return LIB_MARK.sub(repl, code)


TEST_PRELUDE = """
let __R = [];
function __s(x) { return JSON.stringify(x); }
function __add(label, ok, g, e) { __R.push(ok ? {n: label, ok: true} : {n: label, ok: false, g: g, e: e}); }
function eq(label, got, exp) { let g = __s(got), e = __s(exp); __add(label, g === e, g, e); }
function near(label, got, exp, tol) { __add(label, Math.abs(got - exp) <= tol, __s(got), __s(exp)); }
let __Q = [], __done = false;
function t(name, fn) { __Q.push([name, fn]); }
function __next() {
  if (__Q.length === 0) { __done = true; return; }
  let job = __Q.splice(0, 1)[0];
  try { job[1](); } catch (e) { __R.push({n: job[0], ok: false, g: "EXC " + String(e), e: ""}); }
  Timer.set(50, false, __next);
}
Timer.set(200, false, __next);
HTTPServer.registerEndpoint("r", function (req, res) {
  res.code = 200; res.body = JSON.stringify({done: __done, r: __R}); res.send();
});
"""


def run_tests(ip, libfile, testfile):
    import time
    code = TEST_PRELUDE + lib_section(libfile) + "\n" + open(testfile, encoding="utf-8").read()
    # max 3 running scripts and a shared ~25 KB heap: pause Led and Page (never Meter) while the test runs
    paused = []
    for name in ("Led", "Page"):
        sid = script_id(ip, name)
        if sid is not None and rpc(ip, "Script.GetStatus", {"id": sid}).get("running"):
            rpc(ip, "Script.Stop", {"id": sid})
            paused.append(sid)
    try:
        return _run_tests(ip, code)
    finally:
        for sid in paused:
            rpc(ip, "Script.Start", {"id": sid})


def _run_tests(ip, code):
    import time
    try:
        sid = put(ip, "Test", code, enable=False)
    except RuntimeError as e:
        sid = script_id(ip, "Test")
        st = rpc(ip, "Script.GetStatus", {"id": sid}) if sid is not None else {}
        print("FAIL: %s\n%s" % (e, st.get("error_msg", "")))
        if sid is not None:
            delscript(ip, sid)
        return False
    try:
        res = None
        for _ in range(60):
            time.sleep(1)
            st = rpc(ip, "Script.GetStatus", {"id": sid})
            if not st.get("running"):
                print("FAIL: script stopped: %s %s" % (st.get("errors"), st.get("error_msg", "")))
                return False
            try:
                with urllib.request.urlopen("http://%s/script/%d/r" % (ip, sid), timeout=TIMEOUT) as r:
                    res = json.loads(r.read().decode("utf-8"))
            except Exception:
                continue
            if res.get("done"):
                break
        if not res or not res.get("done"):
            print("FAIL: tests did not finish")
            return False
        fails = [x for x in res["r"] if not x["ok"]]
        for x in res["r"]:
            print("%s %s%s" % ("ok  " if x["ok"] else "FAIL", x["n"],
                               "" if x["ok"] else "  got=%s exp=%s" % (x.get("g", x.get("x")), x.get("e"))))
        if st.get("errors"):
            print("script errors: %s" % st["errors"])
        print("%d passed, %d failed" % (len(res["r"]) - len(fails), len(fails)))
        return not fails and bool(res["r"]) and not st.get("errors")
    finally:
        delscript(ip, sid)


EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_edge(override=None):
    for p in ([override] if override else EDGE_PATHS):
        if os.path.isfile(p):
            return p
    sys.exit("msedge.exe not found (tried %s); pass --browser PATH" % (override or EDGE_PATHS))


def run_page_tests(htmlfile, testfile, browser=None):
    """Run the PURE block of page.html plus TESTFILE in headless Edge; results come back in the DOM."""
    import html as htmlmod
    import tempfile
    src = open(htmlfile, encoding="utf-8").read()
    if htmlfile.endswith(".js"):  # a plain .js library: its LIB region is the PURE region
        pure = lib_section(htmlfile)
    else:
        a, b = src.find("/* ==== PURE ==== */"), src.find("/* ==== END PURE ==== */")
        pure = expand_libs(htmlfile, src[a:b]) if a >= 0 and b > a else ""
    mailf = os.path.join(os.path.dirname(os.path.abspath(htmlfile)), "mail-default.json")
    mail_js = "let MAIL_DEFAULT_JSON = " + json.dumps(open(mailf, encoding="utf-8").read() if os.path.exists(mailf) else "") + ";" + chr(10)
    pure = mail_js + pure  # tests read the repo default mail template (src/mail-default.json) through this global
    prelude = TEST_PRELUDE.split("HTTPServer.registerEndpoint")[0].replace("Timer.set(200, false, __next);", "")
    prelude = prelude.replace("Timer.set(50, false, __next);", "__next();")
    nl = chr(10)
    js = prelude + pure + nl + open(testfile, encoding="utf-8").read() + (
        nl + "__next();document.getElementById('r').textContent=JSON.stringify(__R);" + nl)
    page = "<!DOCTYPE html><html><body><pre id='r'>NOT RUN</pre><script>" + js + "</script></body></html>"
    d = tempfile.mkdtemp()
    path = os.path.join(d, "t.html")
    open(path, "w", encoding="utf-8").write(page)
    out = subprocess.run([find_edge(browser), "--headless=new", "--disable-gpu", "--dump-dom", "file:///" + path.replace(os.sep, "/")],
                         capture_output=True, text=True, timeout=60).stdout
    i, j = out.find("<pre id=\"r\">"), out.find("</pre>")
    raw = htmlmod.unescape(out[i + len("<pre id=\"r\">"):j]) if i >= 0 else "NOT RUN"
    if raw == "NOT RUN":
        print("FAIL: tests did not run (script error?)")
        return False
    res = json.loads(raw)
    fails = [x for x in res if not x["ok"]]
    for x in res:
        print("%s %s%s" % ("ok  " if x["ok"] else "FAIL", x["n"], "" if x["ok"] else "  got=%s exp=%s" % (x.get("g", x.get("x")), x.get("e"))))
    print("%d passed, %d failed" % (len(res) - len(fails), len(fails)))
    return not fails and bool(res)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["info", "backup", "rpc", "put", "delscript", "test", "testpage"])
    ap.add_argument("method", nargs="?")
    ap.add_argument("params", nargs="?")
    ap.add_argument("--ip", help="device IP (required for every device command)")
    ap.add_argument("--out", help="backup: output directory (default ~/.config/chargelens/backups/)")
    ap.add_argument("--browser", help="testpage: path of msedge.exe")
    ap.add_argument("--temp", action="store_true", help="put: do not enable (start at boot)")
    ap.add_argument("--store", action="store_true", help="put: store as data, never enable/start")
    a = ap.parse_args()
    if a.cmd == "testpage":  # testpage HTMLFILE TESTFILE (local, headless Edge)
        if not a.method or not a.params:
            sys.exit("testpage needs HTMLFILE TESTFILE")
        sys.exit(0 if run_page_tests(a.method, a.params, a.browser) else 1)
    if not a.ip:
        sys.exit("--ip is required for '%s'" % a.cmd)
    ip = a.ip
    if a.cmd == "info":
        info(ip)
    elif a.cmd == "backup":
        backup(ip, a.out)
    elif a.cmd == "put":  # put NAME FILE
        if not a.method or not a.params:
            sys.exit("put needs NAME FILE")
        code = strip_test_only(expand_libs(a.params, expand_includes(a.params, open(a.params, encoding="utf-8").read())))
        if a.store:  # data stored as a script (e.g. PageHtml): never enabled or started, not minified
            print("stored %s id=%d" % (a.method, put(ip, a.method, code, start=False, enable=False, mini=False)))
        else:
            print("script %s id=%d" % (a.method, put(ip, a.method, code, enable=not a.temp)))
    elif a.cmd == "delscript":
        delscript(ip, a.method)
    elif a.cmd == "test":  # test LIBFILE TESTFILE
        sys.exit(0 if run_tests(ip, a.method, a.params) else 1)
    else:
        if not a.method:
            sys.exit("rpc needs METHOD")
        params = json.loads(a.params) if a.params else None
        print(json.dumps(rpc(ip, a.method, params), indent=2))


if __name__ == "__main__":
    main()
