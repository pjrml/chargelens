// Unit tests for the LIB section of src/led.js. Run on the device:
//   python tools/shelly.py --ip <ip> test src/led.js tests/led_test.js
// Bands: 0 off, 1 red, 2 green, 3 yellow.

t("bands", function () {
  eq("relay off", band(7, false, 2, LED_DEF), 0);
  eq("residual", band(0.05, true, 0, LED_DEF), 0);
  eq("red 3 A", band(3, true, 1, LED_DEF), 1);
  eq("green 7 A", band(7, true, 2, LED_DEF), 2);
  eq("yellow 11.5 A", band(11.5, true, 3, LED_DEF), 3);
  eq("green at 5 A exactly", band(5, true, 1, LED_DEF), 1);   // hysteresis keeps red right at the edge
  eq("green at 5 A from off", band(5, true, -1, LED_DEF), 2);  // no previous state: raw band
});

t("hysteresis", function () {
  eq("green holds at 4.8", band(4.8, true, 2, LED_DEF), 2);
  eq("green drops at 4.6", band(4.6, true, 2, LED_DEF), 1);
  eq("red holds at 5.2", band(5.2, true, 1, LED_DEF), 1);
  eq("red rises at 5.4", band(5.4, true, 1, LED_DEF), 2);
  eq("off holds at 0.13", band(0.13, true, 0, LED_DEF), 0);
  eq("off -> red at 0.2", band(0.2, true, 0, LED_DEF), 1);
  eq("green holds at 11.2", band(11.2, true, 2, LED_DEF), 2);
  eq("yellow at 11.4", band(11.4, true, 2, LED_DEF), 3);
  eq("off -> green jump", band(7, true, 0, LED_DEF), 2);
});

t("colours", function () {
  eq("residual blue", ledColour(0, false, LED_DEF), {rgb: [0, 0, 100], brightness: 50});
  //@if relay
  eq("relay off dark", ledOff(false, LED_DEF), {rgb: [0, 0, 0], brightness: 0});
  //@end
  eq("red", ledColour(1, false, LED_DEF).rgb, [100, 0, 0]);
  eq("green", ledColour(2, false, LED_DEF).rgb, [0, 100, 0]);
  eq("yellow", ledColour(3, false, LED_DEF).rgb, [100, 70, 0]);
});

t("bandEvent", function () {
  eq("event data", bandEventData(2), {b: 2});
});

// v2.2: no clock -> alternative colours : blue/green/off -> purple, red/yellow -> orange
t("noClock", function () {
  eq("blue -> purple", ledColour(0, true, LED_DEF), {rgb: [60, 0, 100], brightness: 50});
  eq("green -> purple", ledColour(2, true, LED_DEF).rgb, [60, 0, 100]);
  eq("red -> orange", ledColour(1, true, LED_DEF).rgb, [100, 30, 0]);
  eq("yellow -> orange", ledColour(3, true, LED_DEF).rgb, [100, 30, 0]);
  //@if relay
  eq("off -> purple", ledOff(true, LED_DEF), {rgb: [60, 0, 100], brightness: 50});
  //@end
  eq("default = clock ok", ledColour(2, false, LED_DEF).rgb, [0, 100, 0]);
  eq("clock null", clockOk({unixtime: null}), false);
  eq("clock missing", clockOk({}), false);
  eq("clock old", clockOk({unixtime: 1000}), false);
  eq("clock set", clockOk({unixtime: 1795118767}), true);
});

// Task 4: thresholds and LED settings come from cc:cfg (object c)
t("bands_custom", function () {
  let c = {r: 0.2, g: 6, y: 10, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50};
  eq("6.0 A green", band(6, true, -1, c), 2);
  eq("10.5 A yellow", band(10.5, true, -1, c), 3);
  eq("0.15 A off", band(0.15, true, -1, c), 0);
  eq("raw 5.5 red", rawBand(5.5, true, c), 1);
  eq("relay off", rawBand(9, false, c), 0);
});

t("hyst_custom", function () {
  let c = {r: 0.1, g: 5, y: 11, h: 1, hr: 0.5, hs: 10, lo: 1, lb: 50};
  eq("green holds at 4.2", band(4.2, true, 2, c), 2);
  eq("green drops at 3.9", band(3.9, true, 2, c), 1);
  eq("off holds at 0.5", band(0.5, true, 0, c), 0);
  eq("off -> red at 0.7", band(0.7, true, 0, c), 1);
  eq("default h differs", band(4.2, true, 2, LED_DEF), 1);
});

t("brightness_cfg", function () {
  let c = {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 20};
  eq("on", ledColour(2, false, c).brightness, 20);
  eq("no clock", ledColour(0, true, c).brightness, 20);
  //@if relay
  eq("no clock off", ledOff(true, c).brightness, 20);
  eq("dark off", ledOff(false, c).brightness, 0);
  //@end
});

t("led_off_cfg", function () {
  eq("first write lo 0", ledWrite("", 0), "off");
  eq("band written, lo 0", ledWrite("band", 0), "off");
  eq("already off", ledWrite("off", 0), "none");
  eq("lo back to 1", ledWrite("off", 1), "band");
  eq("lo 1 normal", ledWrite("band", 1), "band");
  eq("lo 1 first", ledWrite("", 1), "band");
});

t("led_def", function () {
  eq("defaults", LED_DEF, {r: 0.1, g: 5, y: 11, h: 0.3, hr: 0.05, hs: 10, lo: 1, lb: 50});
});

t("ledParams", function () {
  let on = ledColour(2, false, LED_DEF);
  //@if relay
  eq("band", ledParams("band", 2, false, LED_DEF),
     {config: {leds: {mode: "switch", colors: {"switch:0": {on: on, off: {rgb: [0, 0, 0], brightness: 0}}}}}});
  eq("band no clock", ledParams("band", 0, true, LED_DEF).config.leds.colors["switch:0"].off,
     {rgb: [60, 0, 100], brightness: 50});
  //@else
  eq("band", ledParams("band", 2, false, LED_DEF),
     {config: {leds: {mode: "switch", colors: {"pm1:0": {on: on}}}}});
  eq("no off colour", typeof ledParams("band", 0, true, LED_DEF).config.leds.colors["pm1:0"].off, "undefined");
  //@end
  eq("off mode", ledParams("off", 2, false, LED_DEF), {config: {leds: {mode: "off"}}});
});
