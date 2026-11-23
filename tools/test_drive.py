"""Tests for the step parser of tools/drive.py (no browser, no device). Run: python tools/test_drive.py"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drive import parse_step, update_steps  # noqa: E402

CASES = [
    ("dump", ("dump", "", None)),
    ("confirm", ("confirm", "", None)),
    ("open:/script/4/ui?p=setup", ("open", "/script/4/ui?p=setup", None)),
    ("click:up", ("click", "up", None)),
    ("click?:newer", ("click?", "newer", None)),
    ("check:c_ok", ("check", "c_ok", None)),
    ("wait:Leave without changes", ("wait", "Leave without changes", None)),
    ("wait:Leave without changes:90", ("wait", "Leave without changes", 90)),
    ("wait:Time 12:30:5", ("wait", "Time 12:30", 5)),  # text ending in :digits needs an explicit timeout
    ("wait:a:b", ("wait", "a:b", None)),  # a non-number after the last colon is part of the text
    ("waiturl:/install:30", ("waiturl", "/install", 30)),
    ("sleep:2.5", ("sleep", "2.5", None)),
    ("phone", ("phone", "", None)),
    ("js:document.title='a:b'", ("js", "document.title='a:b'", None)),
    ("shot:docs/x.png", ("shot", "docs/x.png", None)),
]


def main():
    fails = 0
    for step, exp in CASES:
        got = parse_step(step)
        ok = got == exp
        fails += not ok
        print("%s %s%s" % ("ok  " if ok else "FAIL", step, "" if ok else "  got=%r exp=%r" % (got, exp)))
    for bad in ("", "frobnicate:x", "open", "click:"):
        try:
            parse_step(bad)
            print("FAIL %r should be refused" % bad)
            fails += 1
        except ValueError:
            print("ok   refused %r" % bad)
    st = update_steps(3)
    ok = st[0] == "open:/script/3/ui?p=setup" and "click?:newer" in st and "click:go" in st
    fails += not ok
    print("%s update_steps uses the Page id" % ("ok  " if ok else "FAIL"))
    print("%d failed" % fails)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
