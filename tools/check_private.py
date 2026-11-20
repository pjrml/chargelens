"""Fail if the repo text leaks anything private (public repo rule).

Usage: python tools/check_private.py [--generic-only] [paths...]
--generic-only: skip the private terms file (CI, where it does not exist; no warning).
Exit 1 and print `file:line: term` for every hit. Default scope: `git ls-files` plus untracked,
non-ignored files. Generic patterns always apply; private terms are read, one per line (# = comment,
case-insensitive), from the first file found of: $CHARGELENS_PRIVATE_TERMS, private-terms.txt in the folder
that contains this repo (a maintainer's private parent folder), ~/.config/chargelens/private-terms.txt
(never inside the repo; no file found is only a warning). Stdlib only.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TERMS_FILES = [x for x in (
    os.environ.get("CHARGELENS_PRIVATE_TERMS"),
    os.path.join(os.path.dirname(ROOT), "private-terms.txt"),
    os.path.join(os.path.expanduser("~"), ".config", "chargelens", "private-terms.txt"),
) if x]
ALLOWED_IPS = {"192.168.33.1", "0.0.0.0"}
ALLOWED_MAIL = ("@users.noreply.github.com", "@example.com", ".example.com")
BINARY_EXT = {".png", ".jpg", ".jpeg", ".gif", ".ico", ".pdf", ".woff", ".woff2", ".zip"}

IPV4 = re.compile(r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.]*\d)")
MAC = re.compile(r"(?<![0-9A-Fa-f:-])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:-])")
MAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
# built from pieces so that this file does not match its own patterns
LANG_PT = re.compile("lang" + "=" + '"' + "pt", re.I)
BS2 = chr(92) * 2  # regex for one backslash
WIN_USER = re.compile("[A-Za-z]:[" + BS2 + "/]+Users[" + BS2 + "/]", re.I)


def load_terms():
    found = [x for x in TERMS_FILES if os.path.isfile(x)]
    if not found:
        print("warning: no private terms file (%s), private terms not checked" % ", ".join(TERMS_FILES),
              file=sys.stderr)
        return []
    out = []
    with open(found[0], encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                out.append(line.lower())
    return out


def default_files():
    r = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT,
                       capture_output=True, text=True, check=True)
    return sorted(set(x for x in r.stdout.splitlines() if x))


def scan_line(line, terms):
    hits = []
    for m in IPV4.finditer(line):
        parts = m.group(0).split(".")
        if all(int(p) < 256 for p in parts) and m.group(0) not in ALLOWED_IPS:
            hits.append(m.group(0))
    hits += [m.group(0) for m in MAC.finditer(line)]
    for m in MAIL.finditer(line):
        if not m.group(0).lower().endswith(ALLOWED_MAIL):
            hits.append(m.group(0))
    hits += [m.group(0) for m in LANG_PT.finditer(line)]
    hits += [m.group(0) for m in WIN_USER.finditer(line)]
    low = line.lower()
    hits += [t for t in terms if t in low]
    return hits


def scan(paths, terms):
    found = []
    for rel in paths:
        full = rel if os.path.isabs(rel) else os.path.join(ROOT, rel)
        if os.path.splitext(full)[1].lower() in BINARY_EXT or not os.path.isfile(full):
            continue
        try:
            with open(full, encoding="utf-8", errors="replace") as f:
                for n, line in enumerate(f, 1):
                    for h in scan_line(line, terms):
                        found.append("%s:%d: %s" % (rel.replace(os.sep, "/"), n, h))
        except OSError as e:
            print("warning: cannot read %s: %s" % (rel, e), file=sys.stderr)
    return found


def main():
    args = sys.argv[1:]
    generic_only = "--generic-only" in args
    paths = []
    for a in [x for x in args if x != "--generic-only"]:
        if os.path.isdir(a):
            for d, _, fs in os.walk(a):
                if "__pycache__" not in d and ".git" not in d.split(os.sep):
                    paths += [os.path.join(d, f) for f in sorted(fs)]
        else:
            paths.append(a)
    paths = paths or default_files()
    found = scan(paths, [] if generic_only else load_terms())
    for h in found:
        print(h)
    if found:
        print("%d hit(s)" % len(found), file=sys.stderr)
        return 1
    print("check_private: no hits (%d files)" % len(paths))
    return 0


if __name__ == "__main__":
    sys.exit(main())
