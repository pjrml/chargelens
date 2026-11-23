"""Tests for tools/build.py (per-model builds, release.json). Run: python tools/test_build.py  (ASCII only)."""
import json
import os
import shutil
import sys
import tempfile
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402
import shelly  # noqa: E402

tmp = tempfile.mkdtemp()
try:
    build.build(tmp)
    rel = json.load(open(os.path.join(tmp, "dist", "release.json"), encoding="ascii"))
    b = rel["builds"]
    assert sorted(b) == ["plugpmg3", "plugs"], sorted(b)
    assert rel["files"] == b["plugs"]["files"]
    assert b["plugs"]["models"] == ["SNPL-00112EU", "EF3PL-00112EU"]
    assert b["plugpmg3"]["models"] == ["S3PL-30116EU"]
    shared = ("Installer", "InstallHtml")
    for f in b["plugpmg3"]["files"]:
        if f["name"] not in shared:
            assert f["path"].startswith("dist/plugpmg3/"), f
    for f in b["plugs"]["files"]:
        if f["name"] not in shared:
            assert f["path"].startswith("dist/") and not f["path"].startswith("dist/plugpmg3/"), f
    for name in b:
        tail = b[name]["files"][-2:]
        assert [f["name"] for f in tail] == list(shared), name
        assert [f["path"] for f in tail] == ["dist/installer.js", "dist/install.html"], name
        assert len(b[name]["files"]) == 8, name
    assert b["plugs"]["files"][-2:] == b["plugpmg3"]["files"][-2:]
    for name in b:
        for f in b[name]["files"]:
            data = open(os.path.join(tmp, f["path"]), "rb").read()
            assert len(data) == f["size"] and (zlib.crc32(data) & 0xFFFFFFFF) == f["crc32"], f
    for dp, _, fs in os.walk(os.path.join(tmp, "dist")):
        for fn in fs:
            text = open(os.path.join(dp, fn), "rb").read().decode("ascii")
            for bad in ("@if ", "@else", "@end"):
                assert bad not in text, "%s contains %r" % (fn, bad)
finally:
    shutil.rmtree(tmp, ignore_errors=True)
