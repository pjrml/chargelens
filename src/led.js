// ChargeLens "Led" - status colour of the plug's RGB ring from the charging current.
// Design: docs/superpowers/specs/2026-11-19-chargelens-design.md.
//   dark   : relay off
//   blue   : relay on, I <= 0.1 A (idle / residual)
//   green  : 5 A <= I <= 11 A (charging; charger minimum 6 A, cap 10 A)
//   yellow : I > 11 A (above the cap; the plug itself cuts at 12 A = switch current_limit)
//   red    : anything else (residual < I < 5 A, typically a charging error)
//   v2.2: clock unknown -> blue/green/off purple, red/yellow orange (time needs attention)
// PLUGS_UI.SetConfig writes flash: it is called only when the state changes (after a 10 s hold).

// ==== LIB ====
let RESIDUAL_A = 0.1;
let GREEN_A = 5;
let YELLOW_A = 11;
let HYST_RES_A = 0.05;
let HYST_A = 0.3;
let BRIGHTNESS = 50;

function rawBand(a, on) {
  if (!on || a <= RESIDUAL_A) return 0;
  if (a > YELLOW_A) return 3;
  if (a >= GREEN_A) return 2;
  return 1;
}

// band with hysteresis: between adjacent bands, keep prev while I is within the margin of their boundary
function band(a, on, prev) {
  let raw = rawBand(a, on);
  if (!on || prev < 0 || raw === prev) return raw;
  let lo = raw < prev ? raw : prev;
  if ((raw - prev === 1) || (prev - raw === 1)) {
    let edge = lo === 0 ? RESIDUAL_A : (lo === 1 ? GREEN_A : YELLOW_A);
    let h = lo === 0 ? HYST_RES_A : HYST_A;
    if (Math.abs(a - edge) < h) return prev;
  }
  return raw;
}

// v2.2: while the clock is unknown, blue/green/off show purple and red/yellow orange
let PURPLE = [60, 0, 100];
let ORANGE = [100, 30, 0];
let CLOCK_MIN = 1700000000;  // unixtime above this = clock set (same rule as Meter)

function clockOk(sys) { return typeof sys.unixtime === "number" && sys.unixtime > CLOCK_MIN; }

function ledColour(b, noClock) {
  if (noClock) return {rgb: (b === 1 || b === 3) ? ORANGE : PURPLE, brightness: BRIGHTNESS};
  if (b === 1) return {rgb: [100, 0, 0], brightness: BRIGHTNESS};
  if (b === 2) return {rgb: [0, 100, 0], brightness: BRIGHTNESS};
  if (b === 3) return {rgb: [100, 70, 0], brightness: BRIGHTNESS};
  return {rgb: [0, 0, 100], brightness: BRIGHTNESS};  // residual
}

// relay off (PLUGS_UI 'off' colour): dark, or purple while the clock is unknown
function ledOff(noClock) {
  if (noClock) return {rgb: PURPLE, brightness: BRIGHTNESS};
  return {rgb: [0, 0, 0], brightness: 0};
}

// v2: data of the cc_band event Meter uses for sessions (0 off/residual, 1 red, 2 green, 3 yellow)
function bandEventData(b) { return {b: b}; }
// ==== END LIB ====

// ==== DEVICE ====
let SWITCH_ID = 0;
let POLL_MS = 2000;
let HOLD_S = 10;

let cur = -1, cand = -1, candSince = 0, lastErr = "none";
let curNoClock = false;

// writes the ring colours; emits cc_band only when the band changed (Meter saves KVS on band events)
function apply(b, noClock) {
  let emit = b !== cur;
  cur = b; cand = -1; curNoClock = noClock;
  let ch = {};
  ch.on = ledColour(b, noClock);
  ch.off = ledOff(noClock);
  let colors = {};
  colors["switch:0"] = ch;
  let params = {config: {leds: {mode: "switch", colors: colors}}};
  Shelly.call("PLUGS_UI.SetConfig", params, function (r, err, msg) {
    lastErr = err ? String(err) + " " + String(msg) : "";
    if (err) { print("led: SetConfig failed: " + String(msg)); cur = -1; }  // retry on next poll
  });
  if (emit) Shelly.emitEvent("cc_band", bandEventData(b));
}

// v2: Meter asks for the current band when it (re)starts
Shelly.addEventHandler(function (e) {
  if (e && e.info && e.info.event === "cc_ask" && cur >= 0) Shelly.emitEvent("cc_band", bandEventData(cur));
});

function poll() {
  let sw = Shelly.getComponentStatus("switch:" + SWITCH_ID);
  let sys = Shelly.getComponentStatus("sys");
  if (!sw || !sys) return;
  let nc = !clockOk(sys);
  let b = band(sw.current || 0, sw.output === true, cur);
  if (cur < 0) { apply(b, nc); return; }
  if (nc !== curNoClock) { apply(cur, nc); return; }  // clock set or lost: recolour now, same band
  if (b === cur) { cand = -1; return; }
  if (b !== cand) { cand = b; candSince = sys.uptime; return; }
  if (sys.uptime - candSince >= HOLD_S) apply(b, nc);
}

// first poll deferred: a SetConfig issued while the script is still loading is rejected ('bad config')
Timer.set(POLL_MS, true, poll);
