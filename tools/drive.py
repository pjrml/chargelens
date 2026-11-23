"""Drive a plug's ChargeLens pages in headless Edge over the DevTools protocol (Python stdlib only).

Used to run the update procedure end to end, the way a user does it on a phone, without a phone:

    python tools/drive.py --ip <ip> update                 # setup -> Check for updates -> newest -> Update
    python tools/drive.py --ip <ip> steps "open:/script/3/ui?p=setup" click:up "waiturl:/install:30" dump

Steps run in order and stop at the first failed wait:
  open:<path>          navigate to http://<ip><path> and wait for the load
  click:<id>           click the element with that id (fails if missing or disabled)
  click?:<id>          the same, but skipped when the element is missing (e.g. 'newer')
  check:<id>           tick a checkbox and fire 'change'
  wait:<text>[:sec]    wait until the page text contains <text> (default 60 s; CSS upper-cases card titles;
                       a text that ends in ':<digits>' needs the explicit timeout)
  waiturl:<frag>[:sec] wait until the address contains <frag>
  dump                 print the address and the page text
  confirm              answer OK to every confirm() of the pages opened after it (e.g. the loader's ?base= prompt)
  sleep:<sec>
  phone                phone viewport for the pages opened after it (390 px wide, 2x), as the doc screenshots
  js:<expr>            evaluate JavaScript in the page and print the result (e.g. hide a MAC before a shot)
  shot:<file>          PNG of the whole page content (up to the end of <body>) into <file>
Exit code 0 when every step passed.
"""
import argparse
import base64
import json
import os
import socket
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

COMMANDS = ("open", "click", "click?", "check", "wait", "waiturl", "dump", "sleep", "confirm", "phone", "js", "shot")
NEEDS_ARG = ("open", "click", "click?", "check", "wait", "waiturl", "sleep", "js", "shot")


def parse_step(step):
    """'cmd:arg[:seconds]' -> (cmd, arg, seconds or None); seconds only for wait/waiturl."""
    cmd, _, arg = step.partition(":")
    if cmd not in COMMANDS:
        raise ValueError("unknown step %r" % step)
    if cmd in NEEDS_ARG and not arg:
        raise ValueError("step %r needs an argument" % step)
    sec = None
    if cmd in ("wait", "waiturl"):
        head, sep, tail = arg.rpartition(":")
        if sep and head and tail.isdigit():
            arg, sec = head, int(tail)
    return cmd, arg, sec


def update_steps(page_id):
    """The update as a user does it: setup page, Check for updates, the newest version if offered, Update."""
    return ["open:/script/%d/ui?p=setup" % page_id, "wait:Check for updates:30", "click:up",
            "waiturl:/install:30", "wait:Leave without changes:90", "click?:newer", "sleep:1",
            "wait:Leave without changes:90", "dump", "check:c_ok", "click:go", "wait:Open the daily page:300", "dump"]


class WS:
    """Just enough of RFC 6455 for one DevTools page connection."""

    def __init__(self, url):
        host, rest = url[len("ws://"):].split("/", 1)
        h, p = host.split(":")
        self.s = socket.create_connection((h, int(p)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall(("GET /%s HTTP/1.1\r\nHost: %s\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                        "Sec-WebSocket-Key: %s\r\nSec-WebSocket-Version: 13\r\n\r\n" % (rest, host, key)).encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(1)
        if b" 101 " not in buf.split(b"\r\n", 1)[0]:
            raise RuntimeError("websocket handshake failed: %r" % buf[:80])
        self.n = 0

    def _recvn(self, n):
        b = b""
        while len(b) < n:
            c = self.s.recv(n - len(b))
            if not c:
                raise EOFError("DevTools connection closed")
            b += c
        return b

    def send(self, obj):
        data = json.dumps(obj).encode()
        hdr = bytearray([0x81])
        n = len(data)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126)
            hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127)
            hdr += struct.pack(">Q", n)
        m = os.urandom(4)
        self.s.sendall(bytes(hdr) + m + bytes(b ^ m[i % 4] for i, b in enumerate(data)))

    def recv(self):
        msg = b""
        while True:
            b0, b1 = self._recvn(2)
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._recvn(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._recvn(8))[0]
            msg += self._recvn(n)
            if b0 & 0x80:
                return json.loads(msg)

    def call(self, method, params=None):
        self.n += 1
        self.send({"id": self.n, "method": method, "params": params or {}})
        while True:
            r = self.recv()
            if r.get("id") == self.n:
                if "error" in r:
                    raise RuntimeError(r["error"])
                return r.get("result", {})


def ev(ws, js):
    r = ws.call("Runtime.evaluate", {"expression": js, "returnByValue": True, "awaitPromise": True})
    return r.get("result", {}).get("value")


def run(ip, steps, browser=None, port=9333):
    from shelly import find_edge
    prof = tempfile.mkdtemp()
    p = subprocess.Popen([find_edge(browser), "--headless=new", "--disable-gpu", "--remote-debugging-port=%d" % port,
                          "--user-data-dir=" + prof, "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        tab = None
        for _ in range(50):
            try:
                tabs = json.load(urllib.request.urlopen("http://localhost:%d/json" % port))
                tab = [t for t in tabs if t["type"] == "page"][0]
                break
            except Exception:
                time.sleep(0.2)
        if not tab:
            sys.exit("Edge did not open its DevTools port %d" % port)
        ws = WS(tab["webSocketDebuggerUrl"])
        ws.call("Page.enable")
        ws.call("Runtime.enable")
        ok = True
        for st in steps:
            cmd, arg, sec = parse_step(st)
            print(">>", st, flush=True)
            if cmd == "open":
                ws.call("Page.navigate", {"url": "http://%s%s" % (ip, arg)})
                time.sleep(1)
                for _ in range(60):
                    if ev(ws, "document.readyState") == "complete":
                        break
                    time.sleep(0.5)
            elif cmd in ("click", "click?"):
                r = ev(ws, "(()=>{const e=document.getElementById(%s);if(!e)return 'missing';if(e.disabled)return 'disabled';"
                           "e.click();return 'ok'})()" % json.dumps(arg))
                print("   click", r)
                if not (r == "ok" or (cmd == "click?" and r == "missing")):
                    ok = False
                    break
            elif cmd == "check":
                r = ev(ws, "(()=>{const e=document.getElementById(%s);if(!e)return 'missing';e.checked=true;"
                           "e.dispatchEvent(new Event('change',{bubbles:true}));return 'ok'})()" % json.dumps(arg))
                print("   check", r)
                if r != "ok":
                    ok = False
                    break
            elif cmd in ("wait", "waiturl"):
                t0, hit = time.time(), False
                expr = "location.href" if cmd == "waiturl" else "document.body?document.body.innerText:''"
                while time.time() - t0 < (sec or 60):
                    try:
                        v = ev(ws, expr) or ""
                    except Exception:  # the page is navigating
                        v = ""
                    if arg in v:
                        hit = True
                        break
                    time.sleep(1)
                print("   %s after %.0f s" % ("found" if hit else "TIMEOUT", time.time() - t0))
                if not hit:
                    ok = False
                    print("   URL:", ev(ws, "location.href"))
                    print("   " + (ev(ws, "document.body?document.body.innerText:''") or "").replace("\n", "\n   "))
                    break
            elif cmd == "dump":
                print("   URL:", ev(ws, "location.href"))
                print("   " + (ev(ws, "document.body?document.body.innerText:''") or "").replace("\n", "\n   "))
            elif cmd == "confirm":
                ws.call("Page.addScriptToEvaluateOnNewDocument", {"source": "window.confirm=function(){return true}"})
            elif cmd == "sleep":
                time.sleep(float(arg))
            elif cmd == "phone":
                ws.call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2,
                                                               "mobile": True})
            elif cmd == "js":
                print("   =", ev(ws, arg))
            elif cmd == "shot":
                w, h = ev(ws, "[document.documentElement.clientWidth,Math.ceil(document.body.getBoundingClientRect().bottom+"
                              "parseFloat(getComputedStyle(document.body).marginBottom))]")
                r = ws.call("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True,
                                                       "clip": {"x": 0, "y": 0, "width": w, "height": h, "scale": 1}})
                with open(arg, "wb") as f:
                    f.write(base64.b64decode(r["data"]))
                print("   saved", arg)
        return ok
    finally:
        p.terminate()


def main():
    if hasattr(sys.stdout, "reconfigure"):  # page text has check marks; a cp1252 console cannot print them
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cmd", choices=["update", "steps"])
    ap.add_argument("steps", nargs="*")
    ap.add_argument("--ip", required=True, help="device IP")
    ap.add_argument("--browser", help="path of msedge.exe")
    ap.add_argument("--port", type=int, default=9333, help="DevTools port (default 9333)")
    a = ap.parse_args()
    if a.cmd == "update":
        from shelly import script_id
        pid = script_id(a.ip, "Page")
        if pid is None:
            sys.exit("no Page script on %s: is ChargeLens installed?" % a.ip)
        steps = update_steps(pid)
    else:
        if not a.steps:
            sys.exit("steps needs at least one step")
        steps = a.steps
    for st in steps:
        parse_step(st)  # refuse a typo before the browser starts
    sys.exit(0 if run(a.ip, steps, a.browser, a.port) else 1)


if __name__ == "__main__":
    main()
