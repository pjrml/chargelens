"""ChargeLens build: src/ -> dist/ (minified, ASCII, versioned) + release manifests + library/.

Usage:
  python tools/build.py           write dist/ and library/
  python tools/build.py --check   build into a temp dir, exit 1 if dist/ or library/ differ (CI)

Deterministic: no timestamps. Reuses expand_libs / strip_test_only / minify from tools/shelly.py.
The installer files (src/installer.js, src/install.html), the library copy and the library manifest are
skipped while src/installer.js does not exist. In installer.js the tokens @REPO@ and @TAG@ are replaced by
REPO and the tag. Stdlib only. ASCII only.
"""
import filecmp
import json
import os
import re
import shutil
import sys
import tempfile
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import shelly  # noqa: E402

REPO = "pjrml/chargelens"  # the one place the GitHub path lives
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BS = chr(92)

# (script name, source, dist file, kind, enable at boot)
FILES = [
    ("Meter", "meter.js", "Meter.js", "code", True),
    ("Led", "led.js", "Led.js", "code", False),
    ("Page", "page.js", "Page.js", "code", False),
    ("PageHtml", "page.html", "PageHtml.html", "data", False),
    ("SetupHtml", "setup.html", "SetupHtml.html", "data", False),
    ("MailTpl", "mail-default.json", "MailTpl.json", "data", False),
]
INSTALLER = [
    ("Installer", "installer.js", "installer.js", "code", False),
    ("InstallHtml", "install.html", "install.html", "data", False),
]
MANGLE = {"meter.js", "led.js", "page.js"}  # scripts whose declared identifiers are shortened (not installer.js yet)
MAX_FILE = 60000
MAX_CODE_TOTAL = 29000  # Meter + Led + Page minified + mangled (ratchet, rc.5: 28154 B; real limit = free heap on the plug)


def read(rel):
    with open(os.path.join(ROOT, "src", rel), encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")


def version():
    v = read("version.txt").strip()
    if not re.match(r"^\d+\.\d+\.\d+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?$", v):
        raise SystemExit("src/version.txt: not X.Y.Z or X.Y.Z-pre (e.g. 1.0.0-dev, 1.0.0-rc.1): %r" % v)
    return v


def js_escape(s):
    """Non-ASCII -> JS escapes (surrogate pairs for astral characters)."""
    out = []
    for ch in s:
        o = ord(ch)
        if o < 128:
            out.append(ch)
        elif o > 0xFFFF:
            o -= 0x10000
            out.append(BS + "u%04x" % (0xD800 + (o >> 10)) + BS + "u%04x" % (0xDC00 + (o & 0x3FF)))
        else:
            out.append(BS + "u%04x" % o)
    return "".join(out)


def html_escape(s):
    return "".join(ch if ord(ch) < 128 else "&#x%x;" % ord(ch) for ch in s)


def ascii_html(s):
    """HTML entities in text, JS escapes inside <script> blocks."""
    parts = re.split(r"(<script[^>]*>.*?</script>)", s, flags=re.S)
    return "".join(js_escape(p) if i % 2 else html_escape(p) for i, p in enumerate(parts))


def min_html(s):
    """Drop HTML comments, full-line JS comments and indentation; keep <pre> blocks untouched."""
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    out, in_pre, in_block = [], False, False
    for line in s.split("\n"):
        if in_pre:
            out.append(line)
            in_pre = "</pre>" not in line
            continue
        t = line.strip()
        if in_block:
            in_block = "*/" not in t
            continue
        if t.startswith("/*"):
            in_block = "*/" not in t
            continue
        if not t or t.startswith("//"):
            continue
        out.append(t)
        in_pre = "<pre" in t and "</pre>" not in t
    return "\n".join(out) + "\n"


def build_script(rel, features=()):
    path = os.path.join(ROOT, "src", rel)
    code = shelly.expand_libs(path, read(rel))  # .js: core cfg_lib only
    code = shelly.strip_test_only(shelly.apply_features(code, features, rel))
    code = shelly.minify(code)
    return shelly.mangle(code) if rel in MANGLE else code


def build_page(rel, features=()):
    path = os.path.join(ROOT, "src", rel)
    return min_html(shelly.apply_features(shelly.expand_libs(path, read(rel)), features, rel))  # pages get the full lib


def build_mail(rel):
    """Python equivalent of asciiJson(mailText(...)): compact JSON, every non-ASCII char escaped."""
    m = json.loads(read(rel))
    keys = ["v", "to", "cc", "bcc", "subject", "body"]
    return json.dumps({k: m[k] for k in keys}, separators=(",", ":"), ensure_ascii=True)


def models_literal(text):
    m = re.search(r"const MODELS=(\{.*?\});?\n", text)
    return m.group(1) if m else None


def check_models(builds):
    """MODELS (identical in setup.html and install.html): every model is listed under its build in builds.json,
    and relay is 1 exactly when that build has the relay feature."""
    a, b = models_literal(read("setup.html")), models_literal(read("install.html"))
    assert a and a == b, "MODELS differs between setup.html and install.html"
    models = json.loads(re.sub(r"([{,])(\w+):", r'\1"\2":', a))
    for model, m in models.items():
        assert m["build"] in builds, "MODELS %s: unknown build %s" % (model, m["build"])
        assert model in builds[m["build"]]["models"], "MODELS %s: not listed in builds.json under %s" % (model, m["build"])
        assert m["relay"] == (1 if "relay" in builds[m["build"]]["features"] else 0), "MODELS %s: relay flag" % model
    for name, bd in builds.items():
        for model in bd["models"]:
            assert model in models and models[model]["build"] == name, "builds.json %s: %s missing in MODELS" % (name, model)


def const_line(text, name):
    m = re.search(r"const " + name + r"=.*?;\n", text)
    return m.group(0) if m else None


def gate_lines(text):
    """The update-gate code copied into setup.html from install.html (idleOk, ssState): must be identical."""
    a = re.search(r"const idleOk=.*?;\n", text)
    b = re.search(r"function ssState\(.*?\n", text)
    return (a.group(0), b.group(0)) if a and b else None


def make_blob(name, src, kind, ver, tag, features):
    if src.endswith(".json"):
        text = build_mail(src)  # user data: no header
    elif src.endswith(".html"):
        text = ascii_html(shelly.header(name, ver, True) + build_page(src, features))
    else:
        body = build_script(src, features)
        if src == "installer.js":
            body = body.replace("@REPO@", REPO).replace("@TAG@", tag)
        text = shelly.header(name, ver) + js_escape(body)
    bad = [i for i, ch in enumerate(text) if ord(ch) > 127]
    assert not bad, "%s: non-ASCII at %d" % (src, bad[0])
    return text.encode("ascii")


def build(out_root):
    """Write every build of tools/builds.json under OUT_ROOT. Returns (build entries, per-build code totals)."""
    ver = version()
    tag = "v" + ver
    builds = shelly.load_builds()
    have_installer = os.path.isfile(os.path.join(ROOT, "src", "installer.js"))
    if have_installer:
        check_models(builds)
        a, b = gate_lines(read("setup.html")), gate_lines(read("install.html"))
        assert a and a == b, "idleOk/ssState differ between setup.html and install.html"
        a, b = const_line(read("setup.html"), "NOCUT"), const_line(read("install.html"), "NOCUT")
        assert a == b, "NOCUT differs between setup.html and install.html"
    os.makedirs(os.path.join(out_root, "dist"))
    blobs, shared, per_build, totals = {}, [], {}, {}

    def entry(name, path, kind, enable, data):
        return {"name": name, "path": path, "kind": kind, "enable": enable,
                "size": len(data), "crc32": zlib.crc32(data) & 0xFFFFFFFF}
    if have_installer:
        for name, src, dst, kind, enable in INSTALLER:  # model-agnostic, written once into dist/
            data = make_blob(name, src, kind, ver, tag, ["relay"])  # no markers of its own; cfg_lib's table is irrelevant to it
            assert len(data) <= MAX_FILE, "%s: %d B > %d" % (dst, len(data), MAX_FILE)
            blobs["dist/" + dst] = data
            shared.append(entry(name, "dist/" + dst, kind, enable, data))
    for bname, bd in builds.items():
        feats, entries, code = bd["features"], [], 0
        for name, src, dst, kind, enable in FILES:
            data = make_blob(name, src, kind, ver, tag, feats)
            assert len(data) <= MAX_FILE, "%s: %s: %d B > %d" % (bname, dst, len(data), MAX_FILE)
            path = bd["dir"] + "/" + dst
            blobs[path] = data
            entries.append(entry(name, path, kind, enable, data))
            if dst in ("Meter.js", "Led.js", "Page.js"):
                code += len(data)
        assert code <= MAX_CODE_TOTAL, "build %s: Meter+Led+Page = %d B > %d" % (bname, code, MAX_CODE_TOTAL)
        per_build[bname] = {"models": bd["models"], "files": entries + shared}
        totals[bname] = code
    for path, data in blobs.items():
        full = os.path.join(out_root, *path.split("/"))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "wb") as f:
            f.write(data)

    def dump(path, obj):
        with open(path, "w", encoding="ascii", newline="\n") as f:
            json.dump(obj, f, indent=2)
            f.write("\n")
    dump(os.path.join(out_root, "dist", "release.json"), {
        "version": ver, "tag": tag, "repo": REPO, "files": per_build["plugs"]["files"], "builds": per_build})
    dump(os.path.join(out_root, "dist", "latest.json"), {
        "version": ver, "tag": tag,
        "changelog": "https://github.com/%s/blob/%s/CHANGELOG.md" % (REPO, tag)})
    if have_installer:
        lib = os.path.join(out_root, "library")
        os.makedirs(lib)
        shutil.copyfile(os.path.join(out_root, "dist", "installer.js"), os.path.join(lib, "chargelens-installer.js"))
        dump(os.path.join(lib, "manifest.json"), [{
            "fname": "chargelens-installer.js", "title": "ChargeLens Installer",
            "description": "Installs or updates ChargeLens on this plug."}])
    return per_build, totals


def tree(base):
    out = {}
    for sub in ("dist", "library"):
        for dp, _, fs in os.walk(os.path.join(base, sub)):
            for f in fs:
                p = os.path.join(dp, f)
                out[os.path.relpath(p, base).replace(os.sep, "/")] = p
    return out


def check():
    tmp = tempfile.mkdtemp()
    try:
        build(tmp)
        a, b = tree(tmp), tree(ROOT)
        bad = [k for k in sorted(set(a) | set(b))
               if k not in a or k not in b or not filecmp.cmp(a[k], b[k], shallow=False)]
        for k in bad:
            print("stale: %s (%s)" % (k, "missing in repo" if k not in b else "not built" if k not in a else "differs"))
        if bad:
            print("build --check: dist/ or library/ is out of date: run python tools/build.py")
            return 1
        print("build --check: ok (%d files)" % len(a))
        return 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    if "--check" in sys.argv[1:]:
        sys.exit(check())
    tmp = tempfile.mkdtemp()
    try:
        per_build, totals = build(tmp)
        for sub in ("dist", "library"):
            shutil.rmtree(os.path.join(ROOT, sub), ignore_errors=True)
            if os.path.isdir(os.path.join(tmp, sub)):
                shutil.copytree(os.path.join(tmp, sub), os.path.join(ROOT, sub))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    for bname, bd in per_build.items():
        print("build %s (%s)" % (bname, ", ".join(bd["models"])))
        for e in bd["files"]:
            print("  %-10s %-26s %6d B  crc32=%08x%s" % (e["name"], e["path"], e["size"], e["crc32"],
                                                          "  enable" if e["enable"] else ""))
        print("  Meter+Led+Page code: %d B (max %d)" % (totals[bname], MAX_CODE_TOTAL))


if __name__ == "__main__":
    main()
