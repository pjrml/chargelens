// Unit tests for the LIB section of src/led.js. Run on the device:
//   python tools/shelly.py --ip <ip> test src/led.js tests/led_test.js
// Bands: 0 off, 1 red, 2 green, 3 yellow.

t("bands", function () {
  eq("relay off", band(7, false, 2), 0);
  eq("residual", band(0.05, true, 0), 0);
  eq("red 3 A", band(3, true, 1), 1);
  eq("green 7 A", band(7, true, 2), 2);
  eq("yellow 11.5 A", band(11.5, true, 3), 3);
  eq("green at 5 A exactly", band(5, true, 1), 1);   // hysteresis keeps red right at the edge
  eq("green at 5 A from off", band(5, true, -1), 2);  // no previous state: raw band
});

t("hysteresis", function () {
  eq("green holds at 4.8", band(4.8, true, 2), 2);
  eq("green drops at 4.6", band(4.6, true, 2), 1);
  eq("red holds at 5.2", band(5.2, true, 1), 1);
  eq("red rises at 5.4", band(5.4, true, 1), 2);
  eq("off holds at 0.13", band(0.13, true, 0), 0);
  eq("off -> red at 0.2", band(0.2, true, 0), 1);
  eq("green holds at 11.2", band(11.2, true, 2), 2);
  eq("yellow at 11.4", band(11.4, true, 2), 3);
  eq("off -> green jump", band(7, true, 0), 2);
});

t("colours", function () {
  eq("residual blue", ledColour(0), {rgb: [0, 0, 100], brightness: 50});
  eq("relay off dark", ledOff(false), {rgb: [0, 0, 0], brightness: 0});
  eq("red", ledColour(1).rgb, [100, 0, 0]);
  eq("green", ledColour(2).rgb, [0, 100, 0]);
  eq("yellow", ledColour(3).rgb, [100, 70, 0]);
});

t("bandEvent", function () {
  eq("event data", bandEventData(2), {b: 2});
});

// v2.2: no clock -> alternative colours : blue/green/off -> purple, red/yellow -> orange
t("noClock", function () {
  eq("blue -> purple", ledColour(0, true), {rgb: [60, 0, 100], brightness: 50});
  eq("green -> purple", ledColour(2, true).rgb, [60, 0, 100]);
  eq("red -> orange", ledColour(1, true).rgb, [100, 30, 0]);
  eq("yellow -> orange", ledColour(3, true).rgb, [100, 30, 0]);
  eq("off -> purple", ledOff(true), {rgb: [60, 0, 100], brightness: 50});
  eq("default = clock ok", ledColour(2).rgb, [0, 100, 0]);
  eq("clock null", clockOk({unixtime: null}), false);
  eq("clock missing", clockOk({}), false);
  eq("clock old", clockOk({unixtime: 1000}), false);
  eq("clock set", clockOk({unixtime: 1795118767}), true);
});
