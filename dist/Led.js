// ChargeLens Led v1.0.0-rc.1
let LED_DEF = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50};
function rawBand(a, on, c) {
if (!on || a <= c.r) return 0;
if (a > c.y) return 3;
if (a >= c.g) return 2;
return 1;
}
function band(a, on, prev, c) {
let raw = rawBand(a, on, c);
if (!on || prev < 0 || raw === prev) return raw;
let lo = raw < prev ? raw : prev;
if ((raw - prev === 1) || (prev - raw === 1)) {
let edge = lo === 0 ? c.r : (lo === 1 ? c.g : c.y);
if (Math.abs(a - edge) < (lo === 0 ? c.hr : c.h)) return prev;
}
return raw;
}
function ledWrite(prev, lo) {
if (lo === 0) return prev === "off" ? "none" : "off";
return "band";
}
let PURPLE = [60, 0, 100];
let ORANGE = [100, 30, 0];
let CLOCK_MIN = 1700000000;
function clockOk(sys) { return typeof sys.unixtime === "number" && sys.unixtime > CLOCK_MIN; }
function ledColour(b, noClock, c) {
if (noClock) return {rgb: (b === 1 || b === 3) ? ORANGE : PURPLE, brightness: c.lb};
if (b === 1) return {rgb: [100, 0, 0], brightness: c.lb};
if (b === 2) return {rgb: [0, 100, 0], brightness: c.lb};
if (b === 3) return {rgb: [100, 70, 0], brightness: c.lb};
return {rgb: [0, 0, 100], brightness: c.lb};
}
function ledOff(noClock, c) {
if (noClock) return {rgb: PURPLE, brightness: c.lb};
return {rgb: [0, 0, 0], brightness: 0};
}
function bandEventData(b) { return {b: b}; }
let SWITCH_ID = 0;
let POLL_MS = 2000;
let cur = -1, cand = -1, candSince = 0, lastErr = "none";
let curNoClock = false;
let c = LED_DEF, wrote = "", asked = false;
function apply(b, noClock) {
let emit = b !== cur;
cur = b; cand = -1; curNoClock = noClock;
let w = ledWrite(wrote, c.lo);
if (w !== "none") {
wrote = w;
let params = {config: {leds: {mode: "off"}}};
if (w === "band") {
let ch = {};
ch.on = ledColour(b, noClock, c);
ch.off = ledOff(noClock, c);
let colors = {};
colors["switch:0"] = ch;
params = {config: {leds: {mode: "switch", colors: colors}}};
}
Shelly.call("PLUGS_UI.SetConfig", params, function (r, err, msg) {
lastErr = err ? String(err) + " " + String(msg) : "";
if (err) { print("led: SetConfig failed: " + String(msg)); cur = -1; wrote = ""; }
});
}
if (emit) Shelly.emitEvent("cc_band", bandEventData(b));
}
Shelly.addEventHandler(function (e) {
if (!e || !e.info) return;
if (e.info.event === "cc_ask" && cur >= 0) Shelly.emitEvent("cc_band", bandEventData(cur));
else if (e.info.event === "cc_cfg" && e.info.data) {
let o = c;
c = e.info.data;
if (cur >= 0 && (c.lo !== o.lo || (c.lo === 1 && c.lb !== o.lb))) apply(cur, curNoClock);
}
});
function poll() {
let sw = Shelly.getComponentStatus("switch:" + SWITCH_ID);
let sys = Shelly.getComponentStatus("sys");
if (!sw || !sys) return;
if (!asked) { asked = true; Shelly.emitEvent("cc_cfgq", {}); return; }
let nc = !clockOk(sys);
let b = band(sw.current || 0, sw.output === true, cur, c);
if (cur < 0) { apply(b, nc); return; }
if (nc !== curNoClock) { apply(cur, nc); return; }
if (b === cur) { cand = -1; return; }
if (b !== cand) { cand = b; candSince = sys.uptime; return; }
if (sys.uptime - candSince >= c.hs) apply(b, nc);
}
Timer.set(POLL_MS, true, poll);
