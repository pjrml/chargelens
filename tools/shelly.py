"""ChargeLens dev CLI for Shelly Plus Plug S / Plug S Gen3 (Gen2 RPC over HTTP, no auth).

Usage (from the repo root; --ip is required for every device command):
  python tools/shelly.py --ip IP info
  python tools/shelly.py --ip IP backup [--out DIR]
  python tools/shelly.py --ip IP rpc METHOD ['{"json":"params"}']
  python tools/shelly.py --ip IP put NAME FILE [--temp | --store]
  python tools/shelly.py --ip IP delscript NAME
  python tools/shelly.py --ip IP test LIBFILE TESTFILE
  python tools/shelly.py testpage HTMLFILE TESTFILE [--browser PATH]
  python tools/shelly.py --ip IP install [--dist dist]
  python tools/shelly.py serve [--port 8000]

info      : device info, free RAM (Sys.GetStatus ram_free) and the script list.
backup    : full dump (device info, config, status, scripts with code, KVS, schedules, webhooks) to
            DIR/<timestamp>/ (default ~/.config/chargelens/backups/, outside the repo).
rpc       : calls any RPC method (POST /rpc) and prints the JSON result.
put       : creates/replaces script NAME from FILE (--temp: not enabled at boot; --store: data only).
test      : runs LIBFILE's LIB section plus TESTFILE on the device as a temporary script "Test".
install   : writes the built files of DIST (release.json) like the installer page: scripts created by name,
            chunks of 4000 + read back, only Meter enabled, an existing MailTpl is never overwritten, Meter started.
            Skips InstallHtml (the Installer script fetches that page at run time; no device stores it).
serve     : serves the repo root on 0.0.0.0:PORT with CORS (install page: ?base=http://<pc-ip>:PORT/).
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


def kvs_all(ip):
    """All KVS items: KVS.GetMany is paged (a few items per call), so follow offset until total."""
    items = None
    while True:
        off = 0 if items is None else len(items)
        r = rpc(ip, "KVS.GetMany", {"match": "*", "offset": off})
        page = r.get("items", {})
        if items is None:
            items = type(page)()
        if isinstance(page, dict):
            items.update(page)
        else:
            items.extend(page)
        total = r.get("total", len(items))
        if not page or len(items) >= total:
            break
    if len(items) != total:
        raise RuntimeError("KVS: got %d of %d items" % (len(items), total))
    return {"items": items, "offset": 0, "total": total}


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
        save("kvs.json", kvs_all(ip))
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

RESERVED = frozenset("""break case catch class const continue debugger default delete do else enum export extends false
finally for function if implements import in instanceof interface let new null of as package private protected public
return static super switch this throw true try typeof var void while with yield await async get set""".split())
_TOK = re.compile(r"""(?P<ws>\s+)
  |(?P<str>'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")
  |(?P<num>0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)
  |(?P<id>[A-Za-z_$][A-Za-z0-9_$]*)
  |(?P<p>.)""", re.X | re.S)


def _tokenize(code):
    if "`" in code or "/*" in code:
        raise ValueError("mangle: backtick or block comment in code (unsupported)")
    toks, pos = [], 0
    while pos < len(code):
        m = _TOK.match(code, pos)
        if not m or m.end() == pos:
            raise ValueError("mangle: cannot tokenize at offset %d" % pos)
        toks.append([m.lastgroup, m.group()])
        pos = m.end()
    return toks


def _new_names():
    first = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    rest = first + "0123456789"
    for c in first:
        yield c
    n = 2
    while True:
        def gen(prefix, left):
            if left == 0:
                yield prefix
                return
            for c in rest:
                for r in gen(prefix + c, left - 1):
                    yield r
        for c in first:
            for r in gen(c, n - 1):
                yield r
        n += 1


def mangle(code, keep=()):
    """Shorten every identifier the script declares (functions, parameters, let/var/const, catch).
    Script heap is paid per declared name, comments and whitespace are free. Input: minified ES5-subset JS.
    Never renamed: names in keep, names starting with __, property accesses (after .), object-literal keys
    (name followed by : and preceded by { or ,), builtins (they are never declared) and keywords.
    Renaming is global and bijective (scope-blind), which preserves shadowing. Deterministic.
    Device tests can run mangled too: `shelly.py --ip IP test LIB TEST --mangle`."""
    toks = _tokenize(code)
    sig = [i for i, t in enumerate(toks) if t[0] != "ws"]
    n = len(sig)

    def tv(k):
        return toks[sig[k]][1] if 0 <= k < n else ""

    def ttype(k):
        return toks[sig[k]][0] if 0 <= k < n else ""

    declared = set()

    def declare(k):
        if ttype(k) == "id" and tv(k) not in RESERVED:
            declared.add(tv(k))

    k = 0
    while k < n:
        v = tv(k) if ttype(k) == "id" else ""
        if v == "function":
            j = k + 1
            if ttype(j) == "id":
                declare(j)
                j += 1
            if tv(j) == "(":
                depth, j = 1, j + 1
                while j < n and depth:
                    if tv(j) in "([{" and ttype(j) == "p":
                        depth += 1
                    elif tv(j) in ")]}" and ttype(j) == "p":
                        depth -= 1
                    elif depth == 1 and ttype(j) == "id" and tv(j - 1) in ("(", ","):
                        declare(j)
                    j += 1
        elif v in ("let", "var", "const"):
            j = k + 1
            while j < n:
                declare(j)
                j += 1
                depth = 0
                while j < n:
                    t, x = ttype(j), tv(j)
                    if t == "p" and x in "([{":
                        depth += 1
                    elif t == "p" and x in ")]}":
                        if depth == 0:
                            break
                        depth -= 1
                    elif depth == 0 and ((t == "p" and x in ",;") or (t == "id" and x in ("in", "of", "let", "var", "const"))):
                        break
                    j += 1
                if not (j < n and tv(j) == "," and ttype(j) == "p"):
                    break
                j += 1
        elif v == "catch" and tv(k + 1) == "(":
            declare(k + 2)
        k += 1

    keep = set(keep)
    declared = set(d for d in declared if d not in keep and not d.startswith("__"))
    renamable = []  # token indexes (into toks) of renamable occurrences
    count, first = {}, {}
    for k in range(n):
        if ttype(k) != "id" or tv(k) not in declared:
            continue
        if tv(k - 1) == "." and ttype(k - 1) == "p":
            continue
        if tv(k + 1) == ":" and ttype(k + 1) == "p" and ttype(k - 1) == "p" and tv(k - 1) in "{,":
            continue
        renamable.append(sig[k])
        count[tv(k)] = count.get(tv(k), 0) + 1
        first.setdefault(tv(k), k)
    taken = set(t[1] for t in toks if t[0] == "id")
    order = sorted(count, key=lambda d: (-count[d], first[d]))
    mapping, gen = {}, _new_names()
    for d in order:
        c = next(gen)
        while c in taken or c in RESERVED:
            c = next(gen)
        mapping[d] = c
    for i in renamable:
        toks[i][1] = mapping[toks[i][1]]
    mangle.last_count = len(mapping)
    return "".join(t[1] for t in toks)


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


CL_NAMES = ("Meter", "Led", "Page", "PageHtml", "SetupHtml", "Installer", "InstallHtml")  # scripts that carry the version header


def header(name, ver, html=False):
    """The first line of every built ChargeLens file (build.py and `put` share this one implementation)."""
    return ("<!-- ChargeLens %s v%s -->\n" if html else "// ChargeLens %s v%s\n") % (name, ver)


def src_version():
    with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "version.txt"), encoding="utf-8") as f:
        return f.read().strip()


def put(ip, name, code, start=True, enable=True, mini=True, hdr="", mangle=False):
    """Create (if missing) or replace script NAME with CODE, enable it (start at boot), start it. Returns the id.
    The device allows at most 3 enabled scripts: temporary scripts use enable=False."""
    if mini:
        code = minify(code)
    if mangle:
        code = globals()["mangle"](code)
    code = hdr + code  # after minify: it would strip the comment line
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


FEATURES_KNOWN = ("relay",)
FEATURE_MARK = re.compile(r"^[ 	]*(?://|<!--)[ 	]*@(if|else|end)(?:[ 	]+(!?)(\w+))?[ 	]*(?:-->)?[ 	]*$")


def apply_features(code, features, where=""):
    """Resolve whole-line markers (//@if FLAG, //@if !FLAG, //@else, //@end, or the <!--@if FLAG--> form) for the
    given feature list. Marker lines and dropped lines disappear. No nesting, one @else per block; any mistake
    raises ValueError naming WHERE and the 1-based line number."""
    out = []
    state = None  # None = outside a block, else [keep_if_branch, in_else, opened_line]
    for n, line in enumerate(code.split(chr(10)), 1):
        m = FEATURE_MARK.match(line)
        if not m:
            if state is None or (state[0] != state[1]):
                out.append(line)
            continue
        kind, neg, flag = m.group(1), m.group(2), m.group(3)
        here = "%s line %d" % (where, n)
        if kind == "if":
            if flag is None or flag not in FEATURES_KNOWN:
                raise ValueError("%s: unknown feature flag %r" % (here, flag))
            if state is not None:
                raise ValueError("%s: nested @if (opened at line %d)" % (here, state[2]))
            has = flag in features
            state = [has != bool(neg), False, n]
        else:
            if flag is not None:
                raise ValueError("%s: @%s takes no flag" % (here, kind))
            if state is None:
                raise ValueError("%s: @%s without @if" % (here, kind))
            if kind == "else":
                if state[1]:
                    raise ValueError("%s: second @else" % here)
                state[1] = True
            else:
                state = None
    if state is not None:
        raise ValueError("%s line %d: @if never closed with @end" % (where, state[2]))
    return chr(10).join(out)


def load_builds():
    """tools/builds.json: the list of builds (dir, features, models)."""
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "builds.json"), encoding="utf-8") as f:
        return json.load(f)


def build_features(name):
    b = load_builds()
    if name not in b:
        raise SystemExit("unknown build %r (known: %s)" % (name, ", ".join(sorted(b))))
    return list(b[name]["features"])


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


def run_tests(ip, libfile, testfile, mangle=False, build="plugs"):
    import time
    feats = build_features(build)
    code = TEST_PRELUDE + apply_features(lib_section(libfile), feats, libfile) + "\n" + apply_features(
        open(testfile, encoding="utf-8").read(), feats, testfile)
    # max 3 running scripts and a shared ~25 KB heap: pause Led and Page (never Meter) while the test runs
    paused = []
    for name in ("Led", "Page"):
        sid = script_id(ip, name)
        if sid is not None and rpc(ip, "Script.GetStatus", {"id": sid}).get("running"):
            rpc(ip, "Script.Stop", {"id": sid})
            paused.append(sid)
    try:
        return _run_tests(ip, code, mangle)
    finally:
        for sid in paused:
            rpc(ip, "Script.Start", {"id": sid})


def _run_tests(ip, code, mangle=False):
    import time
    try:
        sid = put(ip, "Test", code, enable=False, mangle=mangle)
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


def run_page_tests(htmlfile, testfile, browser=None, build="plugs"):
    """Run the PURE block of page.html plus TESTFILE in headless Edge; results come back in the DOM."""
    import html as htmlmod
    import tempfile
    feats = build_features(build)
    src = open(htmlfile, encoding="utf-8").read()
    if htmlfile.endswith(".js"):  # a plain .js library: its LIB region is the PURE region
        pure = lib_section(htmlfile)
    else:
        a, b = src.find("/* ==== PURE ==== */"), src.find("/* ==== END PURE ==== */")
        pure = expand_libs(htmlfile, src[a:b]) if a >= 0 and b > a else ""
    pure = apply_features(pure, feats, htmlfile)
    mailf = os.path.join(os.path.dirname(os.path.abspath(htmlfile)), "mail-default.json")
    mail_js = "let MAIL_DEFAULT_JSON = " + json.dumps(open(mailf, encoding="utf-8").read() if os.path.exists(mailf) else "") + ";" + chr(10)
    if not htmlfile.endswith(".js"):  # the whole page script must parse (the PURE tests alone miss a typo outside PURE)
        import re
        bodies = [apply_features(expand_libs(htmlfile, m), feats, htmlfile + " script %d" % i)
                  for i, m in enumerate(re.findall(r"<script>(.*?)</script>", src, re.S))]
        pure += (chr(10) + "t('page script parses', function () { " + json.dumps(bodies).replace("</", r"<\/") +
                 ".forEach(function (b, i) { try { new Function(b); eq('script ' + i + ' parses', true, true); }" +
                 " catch (e) { eq('script ' + i + ' parses', String(e), 'no error'); } }); });" + chr(10))
    pure = mail_js + pure  # tests read the repo default mail template (src/mail-default.json) through this global
    prelude = TEST_PRELUDE.split("HTTPServer.registerEndpoint")[0].replace("Timer.set(200, false, __next);", "")
    prelude = prelude.replace("Timer.set(50, false, __next);", "__next();")
    nl = chr(10)
    js = prelude + pure + nl + apply_features(open(testfile, encoding="utf-8").read(), feats, testfile) + (
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


# release.json lists install.html for the loader (installer.js fetches it from the base at run time and the installer
# page never stores it as a script), so the dev install skips it too: it writes only what the installer page writes.
PAGE_ONLY = ("InstallHtml",)


def install(ip, dist):
    """Same writes as the installer page, from a PC. Never overwrites an existing MailTpl; enables only Meter."""
    import zlib
    rel = json.load(open(os.path.join(dist, "release.json"), encoding="ascii"))
    files = []
    for f in rel["files"]:
        if f["name"] in PAGE_ONLY:
            continue
        data = open(os.path.join(os.path.dirname(os.path.abspath(dist)), f["path"]), "rb").read()
        if len(data) != f["size"] or (zlib.crc32(data) & 0xFFFFFFFF) != f["crc32"]:
            sys.exit("%s: size/crc32 differ from release.json (run tools/build.py)" % f["path"])
        files.append((f, data.decode("ascii")))
    for name in ("Led", "Page", "Meter"):  # update path: stop Led, Page, then Meter
        sid = script_id(ip, name)
        if sid is not None:
            try:
                rpc(ip, "Script.Stop", {"id": sid})
            except RuntimeError:
                pass
    for f, code in files:
        if f["name"] == "MailTpl" and script_id(ip, "MailTpl") is not None:
            print("kept existing MailTpl")
            continue
        sid = put(ip, f["name"], code, start=False, enable=bool(f["enable"]), mini=False)
        if not f["enable"]:  # an existing script may have been enabled by an older install
            rpc(ip, "Script.SetConfig", {"id": sid, "config": {"enable": False}})
        print("%-10s id=%d %6d B%s" % (f["name"], sid, len(code), " enabled" if f["enable"] else ""))
    meter = script_id(ip, "Meter")
    rpc(ip, "Script.Start", {"id": meter})
    print("started Meter id=%d (it starts Led and Page)" % meter)


def serve(port):
    import http.server
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=root, **k)

        def end_headers(self):
            self.send_header("Access-Control-Allow-Origin", "*")
            super().end_headers()
    print("serving %s on http://0.0.0.0:%d/ (Ctrl+C stops)" % (root, port))
    http.server.ThreadingHTTPServer(("0.0.0.0", port), H).serve_forever()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["info", "backup", "rpc", "put", "delscript", "test", "testpage", "install", "serve"])
    ap.add_argument("method", nargs="?")
    ap.add_argument("params", nargs="?")
    ap.add_argument("--ip", help="device IP (required for every device command)")
    ap.add_argument("--out", help="backup: output directory (default ~/.config/chargelens/backups/)")
    ap.add_argument("--browser", help="testpage: path of msedge.exe")
    ap.add_argument("--dist", default="dist", help="install: directory with release.json (default dist)")
    ap.add_argument("--port", type=int, default=8000, help="serve: port (default 8000)")
    ap.add_argument("--temp", action="store_true", help="put: do not enable (start at boot)")
    ap.add_argument("--store", action="store_true", help="put: store as data, never enable/start")
    ap.add_argument("--mangle", action="store_true", help="put/test: shorten declared identifiers before upload")
    ap.add_argument("--build", default="plugs", help="test/testpage/put: build of tools/builds.json whose features resolve the //@if markers (default plugs)")
    a = ap.parse_args()
    if a.cmd == "testpage":  # testpage HTMLFILE TESTFILE (local, headless Edge)
        if not a.method or not a.params:
            sys.exit("testpage needs HTMLFILE TESTFILE")
        sys.exit(0 if run_page_tests(a.method, a.params, a.browser, a.build) else 1)
    if a.cmd == "serve":
        serve(a.port)
        return
    if not a.ip:
        sys.exit("--ip is required for '%s'" % a.cmd)
    ip = a.ip
    if a.cmd == "info":
        info(ip)
    elif a.cmd == "backup":
        backup(ip, a.out)
    elif a.cmd == "install":
        install(ip, a.dist)
    elif a.cmd == "put":  # put NAME FILE
        if not a.method or not a.params:
            sys.exit("put needs NAME FILE")
        code = strip_test_only(apply_features(expand_libs(a.params, expand_includes(a.params, open(a.params, encoding="utf-8").read())),
                                              build_features(a.build), a.params))
        hdr = header(a.method, src_version(), a.params.endswith(".html")) if a.method in CL_NAMES else ""  # so a dev plug is not seen as legacy
        if a.store:  # data stored as a script (e.g. PageHtml): never enabled or started, not minified
            print("stored %s id=%d" % (a.method, put(ip, a.method, code, start=False, enable=False, mini=False, hdr=hdr)))
        else:
            print("script %s id=%d" % (a.method, put(ip, a.method, code, enable=not a.temp, hdr=hdr, mangle=a.mangle)))
    elif a.cmd == "delscript":
        delscript(ip, a.method)
    elif a.cmd == "test":  # test LIBFILE TESTFILE
        sys.exit(0 if run_tests(ip, a.method, a.params, a.mangle, a.build) else 1)
    else:
        if not a.method:
            sys.exit("rpc needs METHOD")
        params = json.loads(a.params) if a.params else None
        print(json.dumps(rpc(ip, a.method, params), indent=2))


if __name__ == "__main__":
    main()
