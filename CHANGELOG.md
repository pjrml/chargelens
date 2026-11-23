# Changelog

## Unreleased

## 1.0.0-rc.10 (2026-11-23)

- Installer: *Leave without changes* now puts the websocket debug logs back off when the installer had turned them
  on (it remembers that in the plug's `cc:dbgon` key; a finished install or update deletes the key).
- Installer: before writing, it checks that the plug's file system has room for the growth of the files it rewrites,
  and stops with nothing changed when it does not (the Plus Plug S keeps only a few KB free).
- Installer: a "Use at your own risk" card with the README disclaimer is shown before anything is written.
- Docs: the Plug PM Gen3 is in the supported-models list and the model table of the README, with its no-relay
  warning; screenshots of the Plug PM Gen3 pages and a retaken mail card and install page.

## 1.0.0-rc.9 (2026-11-23)

- New model: the Shelly Plug PM Gen3 (metering only, no relay). The meter reads its `pm1:0` component, the LED ring
  follows the same colours, and the pages and the installer adapt: no relay toggle, no relay protection or button
  settings, a "No cut-off" notice (the plug cannot switch the load off; overload protection is only the circuit
  breaker) and a required "I understand" tick in the installer. Colour thresholds go up to 15 A / 16 A on this plug.
- Per-model builds: one source, feature blocks resolved at build time (`tools/builds.json`); `dist/` keeps the Plus Plug
  S files where they were, the Plug PM Gen3 files are in `dist/plugpmg3/`, and `release.json` lists both. The
  installer picks the build from the plug's model at every install and update.
- Plus Plug S and Plug S Gen3: no change in behaviour.

## 1.0.0-rc.8 (2026-11-23)

- Setup: the Relay protection card now only shows the plug's own cut-off values (current, power, voltage), with a
  warning to limit the charger below them and a link that opens *Output protections* in the Shelly web UI.
  ChargeLens no longer changes these values (setup and import); the export keeps them for information.
- Setup: when no maximum normal current is saved, the page proposes 90% of the relay current cut-off
  (12 A -> 10.8 A); a maximum at or above the cut-off is an error.
- Installer: the charger confirmation shows the cut-off values read from the plug instead of a fixed 10 A.
- Developer CLI: `tools/drive.py` steps `phone`, `js:` and `shot:` for the doc screenshots.

## 1.0.0-rc.7 (2026-11-23)

- Update: the install page now also updates the `Installer` script on the plug (it kept the version of the first
  install), so *Check for updates* after an update shows the installed version as up to date instead of offering it
  again next to a "newer than this installer" error.
- Developer CLI: `tools/drive.py` runs the update (or any click sequence) through a plug's pages in headless
  Edge; its `confirm` step answers OK to the loader's test-source prompt (`?base=`).

## 1.0.0-rc.6 (2026-11-23)

- No functional change: a test release for the update procedure (install page, *Check for updates*).

## 1.0.0-rc.5 (2026-11-23)

- More free memory on the plug: about 14.5 KB instead of 10 KB on a Plus Plug S, so pages and counting have more
  headroom.
- The build shortens names inside the plug scripts (Meter, Led, Page) to save memory.
- Developer CLI: `tools/shelly.py test` and `put` accept `--mangle`; `python tools/test_mangle.py` tests the
  name shortener.

## 1.0.0-rc.4 (2026-11-20)

- Mail: the report goes whole in the mail link up to 8000 characters (was 1800); longer reports are copied to the
  clipboard in a way that works on the plug's http page (before, the body was lost).
- Mail: optional **Language of {month_name}** on the setup page (e.g. `pt-PT`); empty keeps the phone's language.

## 1.0.0-rc.3 (2026-11-20)

- Docs: LED ring colour table in daily use (`docs/usage.md`); use cases in the README.
- Developer CLI: `tools/shelly.py backup` now saves every KVS key (it kept only the first page of `KVS.GetMany`).

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
