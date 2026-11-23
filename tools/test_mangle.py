"""Tests for shelly.mangle. Run: python tools/test_mangle.py  (ASCII only, plain asserts)."""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import shelly  # noqa: E402

M = shelly.mangle


def idents(code):
    return [t[1] for t in shelly._tokenize(code) if t[0] == "id"]


# object keys vs ternary
out = M("function f(a,b){let q=a?b:1;return {b:q,a:2};}")
assert "{b:" in out and ",a:2}" in out, out
assert "?b:" not in out and "?" in out

# property access and strings untouched
out = M('function f(abc){return abc.abc+"abc"+x.abc;}')
assert '"abc"' in out and ".abc" in out and out.count("abc") == 3, out

out = M('function f(k){return Shelly.call("switch:0",{id:0},k);}')
assert '"switch:0"' in out and "{id:0}" in out and "Shelly.call" in out

# strings with escapes and identifiers
out = M("function f(xx){return 'it" + chr(92) + "'s xx'+xx;}")
assert "'it" + chr(92) + "'s xx'" in out

# let comma lists with nested commas
out = M("function f(){let i,j,q=[];let a=g(x,y),b=2;return i+j+q+a+b;}")
names = set(idents(out)) - {"function", "let", "return", "g", "x", "y"}
assert len(names) == 6, out  # f, i, j, q, a, b all renamed (x,y,g undeclared)
assert "g(x,y)" in out

# for-in / for-let / catch
out = M("function f(st){for(let k in st){print(k);}for(let i=0;i<3;i++){}try{}catch(err){print(err);}}")
assert "err" not in out and "st" not in re.findall(r"\b\w+\b", out), out

# nested functions and shadowing
src = "function outer(v){function inner(v){return v+1;}return inner(v);}"
out = M(src)
assert "outer" not in out and "inner" not in out and "(v" not in out, out
assert len(shelly._tokenize(out)) == len(shelly._tokenize(src))

# __ names kept, keep= list, builtins
out = M("function __f(a){return JSON.stringify(parseInt(a));}")
assert "__f" in out and "JSON.stringify(parseInt(" in out
out = M("function foo(bar){return bar;}", keep=("foo",))
assert "foo" in out and "bar" not in out

# new names avoid existing identifiers and keywords
src = "function longname(longer,a,b,c){return a+b+c+longer+longname+do_it;}"
out = M(src)
new = set(idents(out)) - {"function", "return", "do_it"}
assert new.isdisjoint({"a_", "do", "if", "in", "of", "as"})
assert len(new) == 5 and all(len(x) <= 2 for x in new), out
# two-char names skip keywords: force > 52 names
many = "function f(){" + "".join("let v%d=%d;" % (i, i) for i in range(60)) + "}"
out = M(many)
ids = [x for x in idents(out) if x not in ("function", "let")]
assert not (set(ids) & shelly.RESERVED), out
assert len(set(ids)) == 61

# existing identifiers are not reused (a, b are builtins here)
out = M("function f(x){return a+b+x;}")
assert re.search(r"function [^ab(]\(", out) and "(a)" not in out, out

# determinism
assert M(many) == M(many)

# unsupported constructs fail loudly
for bad in ("x=`a`;", "x=1;/*c*/"):
    try:
        M(bad)
        assert False
    except ValueError:
        pass

# round trip on the real scripts
root = os.path.dirname(HERE)
for rel in ("meter.js", "led.js", "page.js"):
    path = os.path.join(root, "src", rel)
    with open(path, encoding="utf-8") as f:
        text = f.read().replace("\r\n", "\n")
    code = shelly.minify(shelly.strip_test_only(shelly.expand_libs(path, text)))
    out = M(code)
    a, b = shelly._tokenize(code), shelly._tokenize(out)
    assert len(a) == len(b), rel
    assert [t[1] for t in a if t[0] == "str"] == [t[1] for t in b if t[0] == "str"], rel
    props_a = [a[i + 1][1] for i in range(len(a) - 1) if a[i][1] == "." and a[i + 1][0] == "id"]
    props_b = [b[i + 1][1] for i in range(len(b) - 1) if b[i][1] == "." and b[i + 1][0] == "id"]
    assert props_a == props_b, rel
    ren = {}
    for x, y in zip(a, b):
        if x[0] == "id" and x[1] != y[1]:
            assert ren.setdefault(x[1], y[1]) == y[1], rel
        elif x[1] != y[1]:
            assert False, (rel, x, y)
    assert len(set(ren.values())) == len(ren)
    assert not (set(ren) & {"Shelly", "Timer", "JSON", "Math", "print", "parseInt", "HTTPServer", "String", "Number", "isNaN"}), rel
    print("%s: %d -> %d B, %d names renamed" % (rel, len(code), len(out), len(ren)))
print("test_mangle: ok")
