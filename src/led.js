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
// c = the cc_cfg object from Meter {r,g,y,h,hr,hs,lo,lb}; LED_DEF = defaults (until the first cc_cfg arrives)
let LED_DEF = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50};

function rawBand(a, on, c) {
  if (!on || a <= c.r) return 0;
  if (a > c.y) return 3;
  if (a >= c.g) return 2;
  return 1;
}

// band with hysteresis: between adjacent bands, keep prev while I is within the margin of their boundary
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

// what Led writes after a band change or a real config change: "off" (lo 0, once), "none", or "band"
function ledWrite(prev, lo) {
  if (lo === 0) return prev === "off" ? "none" : "off";
  return "band";
}

// v2.2: while the clock is unknown, blue/green/off show purple [60, 0, 100] and red/yellow orange [100, 30, 0].
// Colours are literals inside the functions: global arrays would cost script heap all the time.
let CLOCK_MIN = 1700000000;  // unixtime above this = clock set (same rule as Meter)

function clockOk(sys) { return typeof sys.unixtime === "number" && sys.unixtime > CLOCK_MIN; }

function ledColour(b, noClock, c) {
  if (noClock) return {rgb: (b === 1 || b === 3) ? [100, 30, 0] : [60, 0, 100], brightness: c.lb};
  if (b === 1) return {rgb: [100, 0, 0], brightness: c.lb};
  if (b === 2) return {rgb: [0, 100, 0], brightness: c.lb};
  if (b === 3) return {rgb: [100, 70, 0], brightness: c.lb};
  return {rgb: [0, 0, 100], brightness: c.lb};  // residual
}

// relay off (PLUGS_UI 'off' colour): dark, or purple while the clock is unknown
function ledOff(noClock, c) {
  if (noClock) return {rgb: [60, 0, 100], brightness: c.lb};
  return {rgb: [0, 0, 0], brightness: 0};
}

// v2: data of the cc_band event Meter uses for sessions (0 off/residual, 1 red, 2 green, 3 yellow)
function bandEventData(b) { return {b: b}; }
// ==== END LIB ====

// ==== DEVICE ====
let SWITCH_ID = 0;
let POLL_MS = 2000;

let cur = -1, cand = -1, candSince = 0, lastErr = "none";
let curNoClock = false;
let c = LED_DEF, wrote = "", asked = false;

// writes the ring colours; emits cc_band only when the band changed (Meter saves KVS on band events)
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
      if (err) { print("led: SetConfig failed: " + String(msg)); cur = -1; wrote = ""; }  // retry on next poll
    });
  }
  if (emit) Shelly.emitEvent("cc_band", bandEventData(b));
}

// v2: Meter asks for the current band when it (re)starts
// cc_cfg: new thresholds apply at once; the ring is rewritten (one flash write) only if lo or lb changed
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
  if (!asked) { asked = true; Shelly.emitEvent("cc_cfgq", {}); return; }  // config first, then the first write
  let nc = !clockOk(sys);
  let b = band(sw.current || 0, sw.output === true, cur, c);
  if (cur < 0) { apply(b, nc); return; }
  if (nc !== curNoClock) { apply(cur, nc); return; }  // clock set or lost: recolour now, same band
  if (b === cur) { cand = -1; return; }
  if (b !== cand) { cand = b; candSince = sys.uptime; return; }
  if (sys.uptime - candSince >= c.hs) apply(b, nc);
}

// first poll deferred: a SetConfig issued while the script is still loading is rejected ('bad config')
Timer.set(POLL_MS, true, poll);
