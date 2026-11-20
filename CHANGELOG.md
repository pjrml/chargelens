# Changelog

## Unreleased

## 1.0.0-rc.2 (2026-11-20)

- Daily page: *About* card with the installed version and the access point (network name and the page address on
  it, `http://192.168.33.1/script/<id>/ui`).
- Daily and setup pages: logo in the header and a *Daily | Setup* switch.
- Install page: the same version shows *installed and up to date* and a **Reinstall** button; an update shows
  the installed and the new version with a warning sign; fixed a syntax error that stopped the page.
- Installer script prints the install address 4 times (0, 3, 10, 30 s) instead of every 3 s.

## 1.0.0-rc.1 (2026-11-20)

First release candidate of v1 (first public version; evolved from a private build).

- Energy per day and month (six months kept on the plug), charging sessions, relay/boot/restart events, heartbeats
  and manual dating of charges made while the clock was unknown.
- Status LED ring: idle, charging, low/high current, clock unknown.
- Phone page served by the plug with a relay toggle (state icon), monthly report by mail (editable template with
  placeholders) and CSV download; home-screen icon.
- Setup page for every setting: thresholds, relay limits, button mode, price and formats, time zone and clock, LED
  ring, mail, device name, Wi-Fi access point (WPA2), hardening (cloud, Bluetooth, MQTT, button, websocket debug logs), configuration
  export/import, version and update check.
- Install and update from the browser through the Shelly web UI Library URL, with model and firmware gate, charger
  confirmation (10 A), checksum-verified downloads and no change to the energy log; manual install path;
  developer CLI (`tools/shelly.py install`).
- English UI and documentation, MIT license, build (`tools/build.py`) with committed `dist/`, CI.
- Tested hardware (no warranty of any kind): Shelly Plus Plug S (Gen2) and Plug S Gen3, including EcoFlow x Shelly.
