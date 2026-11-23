"""Tests for shelly.apply_features / load_builds. Run: python tools/test_features.py  (ASCII only, plain asserts)."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import shelly  # noqa: E402

A = shelly.apply_features


def fails(code, text, features=("relay",)):
    try:
        A(code, list(features), "f")
    except ValueError as e:
        assert text in str(e), str(e)
        return
    raise AssertionError("no error for %r" % code)


assert shelly.FEATURES_KNOWN == ("relay",)
src = "a\n//@if relay\nb\n//@else\nc\n//@end\nd"
assert A(src, ["relay"]) == "a\nb\nd"
assert A(src, []) == "a\nc\nd"
neg = "a\n//@if !relay\nb\n//@end\nd"
assert A(neg, []) == "a\nb\nd"
assert A(neg, ["relay"]) == "a\nd"
assert A("a\n  //@if relay\n  b\n  //@end\nd", ["relay"]) == "a\n  b\nd"
html = "a\n<!--@if relay-->\nb\n<!--@else-->\nc\n<!--@end-->\nd"
assert A(html, ["relay"]) == "a\nb\nd" and A(html, []) == "a\nc\nd"
assert A("a\n<!-- @if relay -->\nb\n<!--@end-->", []) == "a"
odd = "a\n//@if relay x\nb"
assert A(odd, []) == odd
fails("//@if rely\nx\n//@end", "line 1")
fails("a\n//@if relay\n//@if relay\n//@end", "line 3")
fails("//@if relay\n//@else\n//@else\n//@end", "line 3")
fails("a\n//@end", "line 2")
fails("a\n//@else", "line 2")
fails("a\n//@if relay\nb", "line 2")
for txt in ("", "x", "x\n", "a\nb\n\n"):
    assert A(txt, ["relay"]) == txt
assert A("//@if relay\nb\n//@end\n", ["relay"]) == "b\n"
assert shelly.build_features("plugs") == ["relay"]
assert shelly.build_features("plugpmg3") == []
try:
    shelly.build_features("nope")
    raise AssertionError("no SystemExit")
except SystemExit:
    pass
