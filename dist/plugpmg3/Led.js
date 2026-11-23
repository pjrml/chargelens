// ChargeLens Led v1.0.0-rc.9
let K = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50};
function L(m, t, d) {
if (!t || m <= d.r) return 0;
if (m > d.y) return 3;
if (m >= d.g) return 2;
return 1;
}
function M(m, t, j, d) {
let k = L(m, t, d);
if (!t || j < 0 || k === j) return k;
let q = k < j ? k : j;
if ((k - j === 1) || (j - k === 1)) {
let N = q === 0 ? d.r : (q === 1 ? d.g : d.y);
if (Math.abs(m - N) < (q === 0 ? d.hr : d.h)) return j;
}
return k;
}
function O(j, q) {
if (q === 0) return j === "off" ? "none" : "off";
return "band";
}
let P = 1700000000;
function Q(l) { return typeof l.unixtime === "number" && l.unixtime > P; }
function R(f, n, d) {
if (n) return {rgb: (f === 1 || f === 3) ? [100, 30, 0] : [60, 0, 100], brightness: d.lb};
if (f === 1) return {rgb: [100, 0, 0], brightness: d.lb};
if (f === 2) return {rgb: [0, 100, 0], brightness: d.lb};
if (f === 3) return {rgb: [100, 70, 0], brightness: d.lb};
return {rgb: [0, 0, 100], brightness: d.lb};
}
function S(s, f, n, d) {
if (s !== "band") return {config: {leds: {mode: "off"}}};
let C = {};
C.on = R(f, n, d);
let D = {};
D["pm1:0"] = C;
return {config: {leds: {mode: "switch", colors: D}}};
}
function E(f) { return {b: f}; }
let T = "pm1:0";
let U = "plugpm_ui.SetConfig";
let V = 2000;
let i = -1, u = -1, F = 0, W = "none";
let z = false;
let d = K, A = "", G = false;
function v(f, n) {
let X = f !== i;
i = f; u = -1; z = n;
let s = O(A, d.lo);
if (s !== "none") {
A = s;
Shelly.call(U, S(s, f, n, d), function (Z, B, H) {
W = B ? String(B) + " " + String(H) : "";
if (B) { print("led: SetConfig failed: " + String(H)); i = -1; A = ""; }
});
}
if (X) Shelly.emitEvent("cc_band", E(f));
}
Shelly.addEventHandler(function (p) {
if (!p || !p.info) return;
if (p.info.event === "cc_ask" && i >= 0) Shelly.emitEvent("cc_band", E(i));
else if (p.info.event === "cc_cfg" && p.info.data) {
let I = d;
d = p.info.data;
if (i >= 0 && (d.lo !== I.lo || (d.lo === 1 && d.lb !== I.lb))) v(i, z);
}
});
function Y() {
let J = Shelly.getComponentStatus(T);
let l = Shelly.getComponentStatus("sys");
if (!J || !l) return;
if (!G) { G = true; Shelly.emitEvent("cc_cfgq", {}); return; }
let x = !Q(l);
let f = M(J.current || 0, true, i, d);
if (i < 0) { v(f, x); return; }
if (x !== z) { v(i, x); return; }
if (f === i) { u = -1; return; }
if (f !== u) { u = f; F = l.uptime; return; }
if (l.uptime - F >= d.hs) v(f, x);
}
Timer.set(V, true, Y);
