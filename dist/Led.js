// ChargeLens Led v1.0.0-rc.9
let K = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50};
function L(n, t, d) {
if (!t || n <= d.r) return 0;
if (n > d.y) return 3;
if (n >= d.g) return 2;
return 1;
}
function M(n, t, j, d) {
let l = L(n, t, d);
if (!t || j < 0 || l === j) return l;
let q = l < j ? l : j;
if ((l - j === 1) || (j - l === 1)) {
let N = q === 0 ? d.r : (q === 1 ? d.g : d.y);
if (Math.abs(n - N) < (q === 0 ? d.hr : d.h)) return j;
}
return l;
}
function O(j, q) {
if (q === 0) return j === "off" ? "none" : "off";
return "band";
}
let P = 1700000000;
function Q(m) { return typeof m.unixtime === "number" && m.unixtime > P; }
function R(f, k, d) {
if (k) return {rgb: (f === 1 || f === 3) ? [100, 30, 0] : [60, 0, 100], brightness: d.lb};
if (f === 1) return {rgb: [100, 0, 0], brightness: d.lb};
if (f === 2) return {rgb: [0, 100, 0], brightness: d.lb};
if (f === 3) return {rgb: [100, 70, 0], brightness: d.lb};
return {rgb: [0, 0, 100], brightness: d.lb};
}
function S(k, d) {
if (k) return {rgb: [60, 0, 100], brightness: d.lb};
return {rgb: [0, 0, 0], brightness: 0};
}
function T(s, f, k, d) {
if (s !== "band") return {config: {leds: {mode: "off"}}};
let z = {};
z.on = R(f, k, d);
z.off = S(k, d);
let E = {};
E["switch:0"] = z;
return {config: {leds: {mode: "switch", colors: E}}};
}
function F(f) { return {b: f}; }
let U = "switch:0";
let V = "PLUGS_UI.SetConfig";
let W = 2000;
let i = -1, u = -1, G = 0, X = "none";
let A = false;
let d = K, B = "", H = false;
function v(f, k) {
let Y = f !== i;
i = f; u = -1; A = k;
let s = O(B, d.lo);
if (s !== "none") {
B = s;
Shelly.call(V, T(s, f, k, d), function (aa, C, I) {
X = C ? String(C) + " " + String(I) : "";
if (C) { print("led: SetConfig failed: " + String(I)); i = -1; B = ""; }
});
}
if (Y) Shelly.emitEvent("cc_band", F(f));
}
Shelly.addEventHandler(function (p) {
if (!p || !p.info) return;
if (p.info.event === "cc_ask" && i >= 0) Shelly.emitEvent("cc_band", F(i));
else if (p.info.event === "cc_cfg" && p.info.data) {
let J = d;
d = p.info.data;
if (i >= 0 && (d.lo !== J.lo || (d.lo === 1 && d.lb !== J.lb))) v(i, A);
}
});
function Z() {
let D = Shelly.getComponentStatus(U);
let m = Shelly.getComponentStatus("sys");
if (!D || !m) return;
if (!H) { H = true; Shelly.emitEvent("cc_cfgq", {}); return; }
let x = !Q(m);
let f = M(D.current || 0, D.output === true, i, d);
if (i < 0) { v(f, x); return; }
if (x !== A) { v(i, x); return; }
if (f === i) { u = -1; return; }
if (f !== u) { u = f; G = m.uptime; return; }
if (m.uptime - G >= d.hs) v(f, x);
}
Timer.set(W, true, Z);
