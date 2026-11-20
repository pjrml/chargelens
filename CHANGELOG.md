# Changelog

## Unreleased

First public version (v1, in development; not tagged yet). Evolved from a private build.

- Energy per day and month (six months kept on the plug), charging sessions, relay/boot/restart events, heartbeats
  and manual dating of charges made while the clock was unknown.
- Status LED ring: idle, charging, low/high current, clock unknown.
- Phone page served by the plug with a relay toggle (state icon), monthly report by mail (editable template with
  placeholders) and CSV download; home-screen icon.
- Setup page for every setting: thresholds, relay limits, button mode, price and formats, time zone and clock, LED
  ring, mail, device name, Wi-Fi access point (WPA2), hardening (cloud, Bluetooth, MQTT, button), configuration
  export/import, version and update check.
- Install and update from the browser through the Shelly web UI Library URL, with model and firmware gate, charger
  confirmation (10 A), checksum-verified downloads and no change to the energy log; manual install path;
  developer CLI (`tools/shelly.py install`).
- English UI and documentation, MIT license, build (`tools/build.py`) with committed `dist/`, CI.
- Supported hardware: Shelly Plus Plug S (Gen2) and Plug S Gen3, including EcoFlow x Shelly.
