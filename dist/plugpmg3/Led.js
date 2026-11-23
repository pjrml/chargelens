// ChargeLens Led v1.0.0-rc.8
let L = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50};
function M(n, s, d) {
if (!s || n <= d.r) return 0;
if (n > d.y) return 3;
if (n >= d.g) return 2;
return 1;
}
function N(n, s, j, d) {
let k = M(n, s, d);
if (!s || j < 0 || k === j) return k;
let q = k < j ? k : j;
if ((k - j === 1) || (j - k === 1)) {
let O = q === 0 ? d.r : (q === 1 ? d.g : d.y);
if (Math.abs(n - O) < (q === 0 ? d.hr : d.h)) return j;
}
return k;
}
function P(j, q) {
if (q === 0) return j === "off" ? "none" : "off";
return "band";
}
let Q = 1700000000;
function R(l) { return typeof l.unixtime === "number" && l.unixtime > Q; }
function S(f, m, d) {
if (m) return {rgb: (f === 1 || f === 3) ? [100, 30, 0] : [60, 0, 100], brightness: d.lb};
if (f === 1) return {rgb: [100, 0, 0], brightness: d.lb};
if (f === 2) return {rgb: [0, 100, 0], brightness: d.lb};
if (f === 3) return {rgb: [100, 70, 0], brightness: d.lb};
return {rgb: [0, 0, 100], brightness: d.lb};
}
function T(m, d) {
if (m) return {rgb: [60, 0, 100], brightness: d.lb};
return {rgb: [0, 0, 0], brightness: 0};
}
function E(f) { return {b: f}; }
let U = 0;
let V = 2000;
let i = -1, t = -1, F = 0, W = "none";
let x = false;
let d = L, z = "", G = false;
function u(f, m) {
let X = f !== i;
i = f; t = -1; x = m;
let A = P(z, d.lo);
if (A !== "none") {
z = A;
let H = {config: {leds: {mode: "off"}}};
if (A === "band") {
let B = {};
B.on = S(f, m, d);
B.off = T(m, d);
let I = {};
I["switch:0"] = B;
H = {config: {leds: {mode: "switch", colors: I}}};
}
Shelly.call("PLUGS_UI.SetConfig", H, function (Z, C, J) {
W = C ? String(C) + " " + String(J) : "";
if (C) { print("led: SetConfig failed: " + String(J)); i = -1; z = ""; }
});
}
if (X) Shelly.emitEvent("cc_band", E(f));
}
Shelly.addEventHandler(function (p) {
if (!p || !p.info) return;
if (p.info.event === "cc_ask" && i >= 0) Shelly.emitEvent("cc_band", E(i));
else if (p.info.event === "cc_cfg" && p.info.data) {
let K = d;
d = p.info.data;
if (i >= 0 && (d.lo !== K.lo || (d.lo === 1 && d.lb !== K.lb))) u(i, x);
}
});
function Y() {
let D = Shelly.getComponentStatus("switch:" + U);
let l = Shelly.getComponentStatus("sys");
if (!D || !l) return;
if (!G) { G = true; Shelly.emitEvent("cc_cfgq", {}); return; }
let v = !R(l);
let f = N(D.current || 0, D.output === true, i, d);
if (i < 0) { u(f, v); return; }
if (v !== x) { u(i, v); return; }
if (f === i) { t = -1; return; }
if (f !== t) { t = f; F = l.uptime; return; }
if (l.uptime - F >= d.hs) u(f, v);
}
Timer.set(V, true, Y);
