# ChargeLens v1 — design

Status: **approved by the owner 2026-11-19**; builder check done (answers folded in, see "Builder check" at the
end); **owner review done 2026-11-19** (see "Owner review" at the end). Next step: the implementation plan
(`docs/superpowers/plans/`).

## 1. Intent

ChargeLens turns a **Shelly Plus Plug S** (Gen2) or **Plug S Gen3** into an offline energy logger for charging an electric car from a
socket someone else pays for (condominium, employer, landlord, family). It keeps daily and monthly totals and
charging sessions on the plug itself (survives power cuts, needs no cloud, no hub, no internet), shows them on a
phone page served by the plug, and produces a monthly report by e-mail / CSV to settle the bill.

It already exists and runs in production as the owner's **private build** (v2.2, 2026-11-19), made for the
owner's own car and socket. **Why this repo:** publish it as a standalone public
project others can install and configure without editing code. Everything the owner hard-coded for their own
case (thresholds, price, Portuguese UI, condominium mail) becomes configuration, the UI goes to English, and a
browser-based installer replaces the owner's Python upload tool.

## 2. Goals, non-goals, anti-goals

**Goals (v1)**
- Same logging behaviour as the private build v2.2 (energy, sessions, events, heartbeats, manual dating of charges
  that happened without a clock, status LED ring, phone page, mail + CSV report).
- English UI; mail template in English by default, editable by the user.
- A **setup page** on the plug for all user settings (section 6), with **export/import** of the configuration.
- **Install from the browser** through the Shelly web UI "Library URL" bootstrap (section 7), plus a documented
  manual path and a developer CLI.
- English documentation good enough for a non-developer: Shelly basic setup, installation (very detailed for
  the Library URL step, with screenshots), configuration, daily use, limits, troubleshooting.
- Name **ChargeLens**, a simple logo (magnifier over a plug / charging socket).

**Non-goals (v1)**
- Other hardware (Plug PM Gen3, Pro PM, other Shelly with metering). Later, only after v1 succeeds and the owner
  has the devices. Candidates (owner 2026-11-19): **Pro PM** (owner has one installed, for tests) and
  **Plug PM Gen3** (16 A). The Plus Plug S (12 A) is supported (owner 2026-11-19: proven in production with a
  charger limited to 10 A); support rules by current/power rating are to be re-evaluated later (TODO).
- Price periods / tariff history (they depend on the real-time clock, the weakest point of the solution).
  Possible v2 if users ask. v1 = one price, applied to everything shown.
- Cloud, Home Assistant integration, MQTT, multi-device dashboards.
- Importing data from spreadsheets (the private build's import tool stays private).
- Restoring an energy log onto another plug.

**Anti-goals (would be a failure even if it works)**
- Losing or silently corrupting logged energy (on power cuts, on reconfiguration, on updates).
- A plug that switches the relay unexpectedly (the button default stays `detached`; reconfiguration never
  toggles the relay).
- Exceeding the device limits (heap, KVS, running scripts) so that scripts crash in the field.
- An open access point by default (the installer insists on a WPA2 password).
- Any personal data of the owner in the public repo (address, names, condominium text, network names).

## 3. Constraints (device facts, verified on the owner's plug, fw 1.7.x)

**Supported hardware (owner 2026-11-19):** Shelly Plus Plug S (Gen2) and Shelly Plug S Gen3, including
rebranded variants that run Shelly firmware (e.g. EcoFlow x Shelly, model `EF3PL-00112EU`, app `PlugSG3EF`).
**The code targets the Gen2 limits below** (the owner's production plug); the Gen3 has more room (~150 KB free
RAM on fw 2.0.0) but must run the same code. Gen3 differences are measured in spike S10.

- Shelly Plus Plug S (SNPL-00112EU, Gen2), frozen firmware branch 1.7.x, no HTTPS server, relay `switch:0`
  rated 12 A / 2500 W, LED ring driven only by `PLUGS_UI.SetConfig` (each call writes flash: never animate).
- Scripts: **max 3 enabled and 3 running**; ~25 KB heap shared by all running scripts *including their source
  text*; script HTTP response <= ~4 KB; max 5 `registerEndpoint` per script; no `Array.sort`; no `\uXXXX`
  literals in source; tiny stack; a `Shelly.call` during script load can be rejected (defer to a timer).
- KVS: 50 keys, values <= 253 bytes. Gen2 RPC shapes: `KVS.List.keys` is an object, `KVS.GetMany.items` an array.
- Script code must be **ASCII** (`Script.PutCode` rejects other bytes): non-ASCII goes as JS escapes generated
  by the build (never typed by hand; Claude Code's tool layer turns typed escapes into real characters) or as
  HTML entities.
- Detached button presses emit **no event** at all (probe 2026-11-18): presses cannot be logged.
- **No device authentication can be used**: Gen2 auth is HTTP digest with SHA-256, which browsers do not
  implement, so the page's own `/rpc` calls would fail. Security = WPA2 password of the plug's AP (and keeping
  it off untrusted networks). Documented as the security model.
- The page is served over plain HTTP from a private IP, so it is **not a secure context**: no `crypto.subtle`
  (no SHA-256 in the browser), no service workers.
- The clock: the plug has no battery-backed RTC. Time comes from SNTP (only when the plug has internet) or from
  the phone (the page sets it). Energy used while the clock is unknown is kept against `~boot.uptime` stamps and
  dated later (automatically when the clock is set in the same boot, by hand otherwise). This stays as in v2.2.
- Devices: **dev** = an EcoFlow x Shelly plug, a rebranded **Plug S Gen3** (verified 2026-11-19: gen 3, fw 2.x;
  earlier notes calling it a rebranded Plus Plug S were wrong), free to change; **second** = a genuine Plus Plug
  S (Gen2), bought together with the production plug, that can be wiped. **The owner's production
  plug (private build) is never used for development.**

## 4. Approaches considered

**Installation**
1. *HTTPS installer page on GitHub Pages talking to the plug* — rejected: an HTTPS page cannot call
   `http://192.168.33.1` (mixed content) and Chromium's Private Network Access blocks public-to-private calls.
2. *Python CLI only* — rejected as the main path: most users have only a phone. Kept as a developer tool.
3. **Library URL bootstrap (chosen, owner liked it):** the Shelly web UI can load a script from a custom library
   URL (fw >= 0.14). The library offers one tiny script, *ChargeLens Installer*. Started, it serves an install
   page **from the plug itself** (same origin as `/rpc`, no CORS issue for RPC); that page downloads the release
   files from `raw.githubusercontent.com` (which allows CORS) and writes the other scripts with
   `/rpc/Script.*`. Needs the plug and the browser on a network with internet only during installation.
   Fallback when the Library step fails: paste the installer (small, ASCII) into a new script by hand.

**Configuration storage**
1. *Everything in KVS* — rejected: the mail template does not fit in 253 B and KVS keys are counted.
2. *Browser `localStorage`* — rejected: per phone, lost with a new phone, invisible to the scripts.
3. **Numbers in one KVS key + text in a stored, never-started "data script" (chosen):** the same trick the page
   already uses (`PageHtml`). Data scripts cost no heap and no KVS key.

**Applying a configuration change**
1. *Restart Meter/Led* — rejected: a Meter restart is counted as a boot (boot counter, boot event, session
   closing logic).
2. **Meter re-reads `cc:cfg` when it changes (chosen):** see 6.3.

## 5. Architecture

### 5.1 Scripts on the plug (found by **name**, never by id)

| Name | Source | Enabled at boot | Runs | Role |
|---|---|---|---|---|
| `Meter` | `src/meter.js` | yes (only enabled script) | always | as v2.2 + reads `cc:cfg` (thresholds, session gap) and forwards LED settings to Led |
| `Led` | `src/led.js` | no (Meter starts it) | always | as v2.2, thresholds/brightness/LED on-off from config |
| `Page` | `src/page.js` | no (Meter starts it) | always | as v2.2 endpoints; `ui` loader takes `?p=setup` to load `SetupHtml` instead of `PageHtml` |
| `PageHtml` | `src/page.html` | no | never (data) | daily page, English |
| `SetupHtml` | `src/setup.html` | no | never (data) | setup page (section 6) |
| `MailTpl` | built from `src/mail-default.json` | no | never (data) | mail settings + template (JSON text) |
| `Installer` | `src/installer.js` | no | only when the user starts it | install / update page (section 7) |

7 stored scripts. **Spike S2** confirms the maximum number of stored scripts on the device (expected 10). If it
is lower, `MailTpl` content moves into the `SetupHtml`/`PageHtml` pair or the Installer deletes itself after use
(builder's call, record the decision).

Page endpoints stay 5/5 (`ui`, `data`, `list`, `time`, `log`). The setup page writes configuration with plain
`/rpc` calls (`KVS.Set`, `Script.PutCode` for `MailTpl`, `Switch.SetConfig`, `Sys.SetConfig`, `PLUGS_UI.*`,
`WiFi.SetConfig`, `BLE/Cloud/MQTT.SetConfig`), so no new endpoint is needed.

### 5.2 KVS map (v1, history reduced to 6 months — owner decision 2026-11-19)

| Keys | Count |
|---|---|
| `cc:state`, `cc:adj`, `cc:tadj`, `units` (firmware) | 4 |
| `cc:m:YYYYMM` + `cc:s:YYYYMM` + `cc:s:YYYYMM-2`, **6 months** | 18 |
| `cc:ss`, `cc:su`, `cc:boot`, `cc:ev0..2`, `cc:hb0..2` | 9 |
| `cc:cfg` (new, replaces `cc:mail`) | 1 |
| **Total** | **32 of 50** (18 free; v2.2 used ~50) |

`MAX_MONTHS = 6`: the oldest month and its session keys are deleted together, as today. The key prefix stays
`cc:` (fits ChargeLens). A schema version `sv` is added to `cc:state` (v1 = 1) so future updates can migrate.

### 5.3 `cc:cfg` (JSON, must stay <= 253 B; defaults = private build v2.2 values)

| Field | Meaning | Default | Range / rule |
|---|---|---|---|
| `v` | config schema version | 1 | |
| `r` | residual current: at or below = idle (blue) | 0.1 A | 0.02-1.0 |
| `g` | minimum charging current: session starts / green band | 5 A | > `r`, 1-11 |
| `y` | maximum normal current: above = yellow | 11 A | > `g`, < relay current limit |
| `h` | hysteresis of the bands | 0.3 A | 0.05-1.0 |
| `hr` | hysteresis of the residual threshold | 0.05 A | 0.01-0.5 |
| `hs` | band hold time | 10 s | 2-60 |
| `sg` | session gap: session ends after this long without green | 600 s | 60-3600 |
| `p` | price per kWh | 0 (unset: page shows kWh only) | 0-10 |
| `cu` | currency label shown after amounts | `EUR` | 1-4 characters, any (e.g. `EUR`, `€`, `zł`); UTF-8 bytes count towards the 253 B |
| `ds` | decimal separator | `.` | `.` or `,` |
| `df` | date format | `YMD` | `YMD`, `DMY`, `MDY` |
| `lo` | LED ring used | 1 | 0/1 (0 = Led leaves the ring alone after one "off" write) |
| `lb` | LED brightness | 50 | 5-100 |

Settings that live in the **device's own config** (read/written by the setup page, not copied to `cc:cfg`):
relay current limit and power limit (`Switch.SetConfig`, defaults 12 A / 2500 W as on the owner's plug), button
mode (section 6.2), time zone (`Sys.SetConfig location.tz`), device name (`Sys.SetConfig device.name`), AP and
hardening (section 7.4).

Missing / unreadable `cc:cfg` = defaults (a fresh install works before setup). Invalid fields are replaced by
their default field by field.

### 5.4 `MailTpl` (data script, JSON text)

```
{"v":1,"to":"","cc":"","bcc":"","subject":"Charging report | {month_name} {year}","body":"..."}
```
- **Stored ASCII-only:** `Script.PutCode` rejects non-ASCII bytes, so the setup page writes the JSON with every
  non-ASCII character turned into a JSON Unicode escape; `JSON.parse` gives the original text back. Accents and
  `€` in the subject/body therefore work (pure function + test).
- Placeholders: `{month_name}`, `{month}` (MM), `{year}`, `{total_kwh}`, `{total_cost}`, `{currency}`,
  `{price}`, `{outside_kwh}` (energy outside sessions), `{session_count}`, `{sessions_table}` (plain-text
  table: date | kWh | cost, one line per session, as the owner's v2.1 table), `{device_name}`.
- `{month_name}` is the month name in the phone's language (`toLocaleString(navigator.language, {month:
  'long'})`), so there is no month-names setting; `{month}` gives the number for anyone who wants it fixed.
- Default body (English): short report, totals, the table, a polite request to confirm receipt, a signature
  line the user replaces. No personal data in the repo default.
- Personal data (recipient, name in the signature) lives only on the plug and in the user's export file.
- The page builds a `mailto:` link as today, with `cc` / `bcc` when set. Long months can exceed what some mail apps accept in a `mailto:`
  URL: when the encoded URL is over ~1800 characters the page copies the body to the clipboard and opens the
  mail with a short body asking to paste (builder: test on iPhone Mail).

### 5.5 Repo layout

| Path | What |
|---|---|
| `src/` | source of the scripts and pages (readable, commented, tests' LIB/PURE markers as today) |
| `tests/` | device tests (`*_test.js`, run with the dev tool) and page tests (headless browser) |
| `tools/build.py` | Python stdlib only: minifies JS, converts non-ASCII to escapes, assembles `MailTpl`, writes `dist/` and the manifests |
| `tools/shelly.py` | dev CLI generalised from the private build (`--ip` required; `info`, `backup`, `rpc`, `put`, `test`, `testpage`, `install`); no network-specific discovery |
| `dist/` | **committed** build output (minified, ASCII) + `release.json` (version, files, sizes, CRC32) |
| `library/manifest.json` | Shelly Library URL index (one entry: ChargeLens Installer -> `dist/installer.js`) |
| `docs/` | user docs (section 8), `assets/` (logo, screenshots), `superpowers/` (specs, plans) |

`dist/` is committed because the Library URL and the installer read files through
`raw.githubusercontent.com/<owner>/chargelens/<tag>/...`; GitHub release assets do not send CORS headers.
A CI job (GitHub Actions) rebuilds and fails if `dist/` differs from the committed one, and runs the pure-logic
tests under Node with a small Shelly shim where possible.

## 6. Setup page (`http://<ip>/script/<PageId>/ui?p=setup`, linked from the daily page)

### 6.1 Sections and fields
1. **Thresholds** — residual, minimum, maximum (with a small diagram of the bands and LED colours);
   *Advanced* (collapsed): hysteresis, residual hysteresis, hold time, session gap.
2. **Relay protection** — current limit (relay cuts above; device native), power limit. Validation:
   maximum (yellow) < current limit <= device maximum (read from the device; spike S7).
3. **Button** — `detached` (default: the button does nothing, as on the owner's plug) or `toggle` (the button
   switches the relay, same as the page toggle). Relay changes from the button are logged with their source like
   any other relay change. Exact `Switch.SetConfig` field/values: spike S6.
4. **Price** — price per kWh, currency, decimal separator, date format.
5. **Time** — time zone (Olson name; "Use this phone's time zone" fills it from
   `Intl.DateTimeFormat().resolvedOptions().timeZone`), clock status, "Set clock from this phone".
6. **LED ring** — on/off, brightness, legend of colours (including the purple/orange "clock unknown" colours).
7. **Mail** — minimum essential (owner 2026-11-19): to, cc, bcc, subject, body (plain multi-line field), and a
   static line listing the placeholders. No preview, no editor, no month names.
8. **Device** — device name; Wi-Fi access point (SSID, WPA2 password, on/off; warning and confirm when the
   browser is connected through that AP); hardening status (cloud, BLE, MQTT off) with a "Fix" button.
9. **Backup** — *Export configuration* (downloads `chargelens-config-<device>-<date>.json`: `cc:cfg`, `MailTpl`,
   and the device-native settings above except passwords, which Gen2 never returns) and *Import configuration*
   (shows a diff, validates schema version and ranges, applies, never touches the energy log).
10. **About / update** — version, firmware, free heap, KVS use (n/50), link to docs, *Check for updates* (starts
   `Installer` and opens its page).

Save writes only what changed and reports each write's result. Nothing on the setup page toggles the relay.

### 6.2 Daily page changes (besides English)
- Relay control becomes a **toggle switch with a state icon**: lightning bolt yellow when the relay is on, grey
  when off, red when the relay was cut by protection (overcurrent/overpower error in `switch:0` status).
  Turning it off still asks for confirmation (charging stops).
- Amounts use `cc:cfg` price/currency/decimal separator/date format; with no price set, cost columns are hidden.
- Mail and CSV use `MailTpl` and the formats above. CSV stays machine-friendly (ISO dates, `.` decimals) with a
  header row, independent of the display formats.
- A "Setup" link. All other v2.2 behaviour (undated charges card, events card, clock setting) stays, translated.

### 6.3 How a change reaches the running scripts
Meter reads `cc:cfg` at start and then checks its etag every tick (60 s; one small `KVS.Get`). On change it
re-parses, applies its own fields (session gap, green threshold for sessions) and emits `cc_cfg` with the LED
fields and thresholds; Led applies them on the event (and asks with `cc_ask`-style request at its own start).
Result: a saved change is live within ~60 s, without restarting Meter. The setup page says so. Page reads
`cc:cfg` per request (the page itself is just HTML, it reads config through `/rpc/KVS.Get`).

## 7. Installation and updates

### 7.1 Bootstrap through the Library URL
1. User gives the plug internet once (joins it to home Wi-Fi in the Shelly app or web UI; doc 8.1).
2. Shelly web UI (`http://<ip>`) -> Scripts -> Create script -> Library -> configure library URL ->
   `https://raw.githubusercontent.com/<owner>/chargelens/main/library/manifest.json` -> pick *ChargeLens
   Installer* -> save with the name `Installer` -> Start.
3. Open `http://<ip>/script/<id>/install` (the installer's console line / the docs show the exact link).

The manifest format is not documented by Shelly; **spike S3** derives it from Shelly's own library
(`ALLTERCO/shelly-script-examples`, its manifest) and checks whether the library inserts the code as-is.

### 7.2 What the install page does (all from the browser, same origin)
1. Checks the device: model/app (`Shelly.GetDeviceInfo`; allow-list of Plus Plug S Gen2 and Plug S Gen3 ids
   incl. the EcoFlow one, spike S1), firmware **up to date** (no update offered, `Shelly.CheckForUpdate`;
   Gen2: frozen 1.7.x branch, Gen3: 2.x), free script slots, scripts already running. The same gate applies
   to **updates** (owner 2026-11-19). Unknown model or firmware not up to date = stop with an explanation
   (update first via the Shelly app / web UI; no "force" in v1). Firmware updates come **in steps** (dev plug
   2026-11-19: 2.0.0 -> 2.1.1 -> 2.2.0, each offered only after the previous one), and right after an update
   `Shelly.Update` fails with `-109 "Not committed"` for a few minutes (accepted again at ~7 min uptime). The
   installer message and `docs/shelly-setup.md` say: update, wait for the restart, re-check, repeat until no
   update is offered. Asks the user to confirm the charger's maximum current setting
   (requirement stated in the docs).
2. Shows what it will do: fresh install or update (existing ChargeLens scripts found by name and version
   header), and **other running/enabled scripts** that must be stopped/disabled to fit the 3-script limit (asks;
   never deletes user scripts).
3. Downloads `dist/release.json` and the files from the **same tag** the installer was built for (updates: reads
   `main/dist/latest.json` first, shows the version and changelog link, then that tag). Checks length + CRC32
   (no `crypto.subtle` here).
4. Writes each script: create if missing, `Script.PutCode` in chunks, read back length, set `enable` (only
   Meter true). Data scripts are never started.
5. First install: writes default `cc:cfg` if missing; offers time zone from the phone; **AP setup** (7.4) and
   **hardening**; button mode default `detached`.
6. Starts Meter (Meter starts Led and Page), waits until Page answers, then opens the setup page.
7. Updates: stops Led and Page, then Meter, writes, starts Meter. Meter's KVS state is untouched; schema
   migrations (`cc:state.sv`) run in Meter at start, idempotent, tested.

The installer stays stored and disabled after use (for updates; *Check for updates* on the setup page starts it).

### 7.3 Manual path and developer path
- Manual: `docs/install-manual.md` — create each script in the Shelly web UI with its exact name, paste the
  file from `dist/` (raw link per file), set "run on startup" only for Meter, start Meter.
  Heavy (7 scripts) but always works; also used if the Library step fails.
- Developer: `tools/shelly.py install --ip <ip> [--dist dist/]` does the same from a PC.

### 7.4 Access point and hardening (owner decision 2026-11-19)
- The installer/setup can configure the plug's own AP (`WiFi.SetConfig ap`): SSID (suggested
  `chargelens-<last 4 MAC>`), **WPA2 password required (>= 8 chars)**, enable. Setting it while connected
  through STA keeps the STA link (verify: spike S9); when the browser is connected through the AP itself the
  page warns that it will disconnect and how to reconnect.
- Hardening offered (checkboxes, all on by default): cloud off, BLE off, MQTT off; button `detached`. Each box
  says what is lost; **cloud off = no Shelly app access from outside the plug's networks** (explicit note in
  `docs/security.md` and `docs/shelly-setup.md`).
- **Forget the home Wi-Fi** (owner 2026-11-19): last step of a first install, offered, off by default. With
  no STA nobody on the home network can reach the unauthenticated setup; the cost is no SNTP clock and that
  the next update needs the plug joined to a Wi-Fi with internet again (docs). Only allowed once the AP is
  configured with WPA2; the page warns that the browser will lose the plug and says to reconnect through the
  AP.
- Device authentication: explained as not supported (section 3), with the security model.

## 8. Documentation (English)

- `README.md`: what it is, who it is for, features, screenshots, hardware, quick start, links; maintainer
  recovery section at the end (owner's baseline rule).
- `docs/shelly-setup.md`: unbox, power, connect to the plug's AP, web UI, firmware check, join Wi-Fi (for
  install), name, recommended settings.
- `docs/install.md`: Library URL path step by step with screenshots (phone and desktop), what each installer
  screen means, common failures. `docs/install-manual.md`: manual path.
- `docs/configuration.md`: every setup field, defaults, how to choose thresholds for a given charger (look at
  the charger's standby and charging current), mail placeholders, export/import.
- `docs/usage.md`: daily routine (plug in, connect to the AP, open the page, home-screen icon), undated charges
  and how to date them, monthly report, unplugging when travelling.
- `docs/how-it-works.md`: scripts, KVS map, clock handling, sessions, events, limits.
- `docs/security.md`: no auth possible, AP password, keep off untrusted networks, what someone on the AP can do.
- `docs/troubleshooting.md`, `docs/development.md` (build, tests on a device, release checklist),
  `CHANGELOG.md`, `LICENSE` (MIT).
- Logo: SVG in `docs/assets/` (magnifier over a plug or charging socket, works at 32 px and as the page's
  home-screen icon), 2-3 variants for the owner to choose.

## 9. Spike on the dev plug (first task of the plan; EcoFlow x Shelly plug)

| # | Question |
|---|---|
| S1 | `Shelly.GetDeviceInfo` of each plug (model, app, fw, update offered?) to build the model allow-list (Gen2 Plus Plug S, Gen3 Plug S, EcoFlow `EF3PL-00112EU` / `PlugSG3EF`) |
| S2 | Max stored scripts; **max size of one script** vs the minified `SetupHtml` (if it does not fit: split into two data scripts, one more slot; builder's call, recorded); free heap with Meter+Led+Page running and 4 data scripts stored |
| S3 | Library URL: manifest format, fetch from raw.githubusercontent, code inserted as-is?, size limit, name kept? |
| S4 | `Script.PutCode` from a page served by a script: method (GET vs POST JSON), max chunk, speed |
| S5 | `fetch` to raw.githubusercontent.com from `http://<ip>/script/...` on desktop Edge/Chrome and iPhone Safari |
| S6 | Button mode field and values on Plus Plug S fw 1.7.x (detached vs toggle) |
| S7 | `current_limit` / `power_limit` accepted ranges |
| S8 | `Sys.SetConfig location.tz` -> `sys.utc_offset` updates without reboot? (Meter uses `utc_offset` for days) |
| S9 | `WiFi.SetConfig ap` while connected through STA: STA link kept? |
| S10 | Gen3 (dev plug, fw 2.2.0; adds e.g. `power_restore_delay*` in `Switch` config) vs Gen2 on the same code: script limits (enabled/running/stored, endpoints, size, response size), `PLUGS_UI` LED API, `Switch` config/status fields (errors, button mode), KVS limits and RPC shapes, `Script.PutCode`, Library URL; anything that differs needs a per-generation branch, kept minimal |

Each answer is recorded in `docs/how-it-works.md` / this spec before building on it.

## 10. Order of work (detail in the plan)

0. Spike (section 9) on the dev plug (Gen3) and the second plug (Gen2) for the Gen2-only facts, then **go/no-go with the owner** (Builder check B1).
1. Port: copy the private build v2.2 sources (location in the maintainer's private notes) into `src/`,
   `tests/`, `tools/shelly.py`, **scrubbing personal and private data** (condominium text in the price table and
   the mail, home network names, router-based discovery, names of private projects and hosts). Grep the result before the first commit.
2. Config: `cc:cfg`, 6 months, `sv`, Meter/Led reading config (tests first, on the device).
3. Daily page in English + toggle + formats + `MailTpl`.
4. Setup page + export/import.
5. Build + `dist/` + CI.
6. Installer + Library manifest + manual path.
7. Docs + logo + screenshots.
8. Validation on the dev plug (fresh install from the Library URL, a real charge or a test load, power-cut
   test, update from one tag to the next), then publish (GitHub repo public: owner's call).
9. Optional, separate: move the owner's production plug to ChargeLens (export CSVs of months older than 6 first:
   the 6-month pruning deletes them).

## 11. Acceptance (v1)

- On **both generations** (second plug = Gen2, dev plug = Gen3), from the docs only: Shelly setup -> Library URL -> installer ->
  setup -> logging works, on a phone, without a PC.
- All private build v2.2 device and page tests pass after the port (adapted to English and config), plus new
  tests for config parsing/validation, the 6-month pruning, migrations and mail placeholders.
- Changing each setup field is live within ~60 s and never toggles the relay nor loses energy.
- Export -> factory reset -> install -> import restores the configuration (not the log, by design).
- Heap `mem_free` with the 3 scripts running not below the v2.2 level (~11 KB) minus 1 KB.
- `dist/` reproducible (CI green); no non-ASCII in `dist/`; no personal data in the repo (grep list in
  `docs/development.md`).

## 12. Left to the builder

Exact UI layout and styling (keep the v2.2 dark style), the plain-text table format, how Led gets config at
start, chunk sizes, CI details, the CRC32 implementation, wording of docs, screenshot tooling.

## Builder check (2026-11-19, independent reviewer)

Six questions came back. Four are settled below as **Claude's calls** (owner may overrule in the review); two are
the owner's and stay open (B5, B6).

- **B1 — Spike results that break the design (Claude's call).** The plan has a **go/no-go gate after the spike**:
  results are recorded and shown to the owner before building tasks 6-8. Fallbacks, decided now:
  S3 fails (Library URL unusable) -> the main path becomes "paste the installer by hand" (small, ASCII, copyable
  from a raw GitHub link on a phone); acceptance then reads "from the docs only, on a phone, without a PC" with
  that path. S5 fails on iPhone Safari only -> installation is documented for a desktop/Android browser and the
  daily use stays on the iPhone; acceptance is adjusted accordingly. S8 needs a reboot -> the time zone is set
  by the installer *before* Meter first runs, and the setup page marks it "applied at next restart" (a device
  reboot is a real boot, logged as such).
- **B2 — Releases and versions (Claude's call).** GitHub path `pjrml/chargelens` (personal account), baked into
  `dist/`, the manifest and the docs by `build.py` from one constant. Version `X.Y.Z` in `src/version.txt`.
  Release sequence: bump version -> `build.py` (writes `dist/` with the tag `vX.Y.Z` baked into
  `dist/installer.js`, `dist/release.json`, and `dist/latest.json` = `{version, tag, changelog URL}`) -> commit on
  `main` -> tag `vX.Y.Z` -> push both. The Library manifest on `main` points to `main/dist/installer.js`, so a new
  install always gets the latest installer, which then reads every file from its own baked tag (immutable).
  Update check = fetch `main/dist/latest.json`; if newer, load that tag's `installer.js` page logic. CI fails if
  `dist/` is stale.
- **B3 — Plugs already running the private build v2.2 (Claude's call).** Not supported by the v1 installer: scripts with
  the ChargeLens names but no ChargeLens version header -> the installer stops and explains (manual migration
  doc later, step 10.9). Meter: missing `cc:state.sv` *with* an existing `cc:state` -> treated as legacy, **no
  pruning beyond what exists**, logs an event and keeps running; only `sv = 1` prunes to 6 months. No silent
  deletion of data in any path.
- **B4 — An update restarts Meter (Claude's call).** Two rules: (a) the installer refuses to update while a
  session is open or the current is above the residual threshold (asks to retry when idle); (b) **a Meter
  restart without a device reboot must not count as a boot** (no boot counter increment, no boot event, open
  session state preserved): Meter tells a script restart from a device boot by comparing `sys.uptime` with the
  uptime saved in `cc:state.u` of the same boot (exact rule: builder, with tests). It logs an "update/restart"
  event instead. This also makes any accidental Meter restart harmless.
- **B5 — Hardware for acceptance (owner, 2026-11-19; corrected the same day).** The EcoFlow dev plug is a Plug
  S **Gen3**; the second plug is a genuine Plus Plug S **Gen2**. Acceptance runs on both: dev (Gen3) for
  day-to-day development; the second (Gen2) for the Gen2 limits, factory reset, fresh install from the docs,
  export/reset/import and power-cut tests. The model allow-list is the ids seen on the two (spike S1).
- **B6 — Identity in the public repo (owner, 2026-11-19: "propose best practice", Claude's call).** The owner's
  GitHub profile shows no real name and no e-mail, so the project keeps that: author name `pjrml`, commit e-mail
  the ID-based GitHub no-reply address (`<id>+pjrml@users.noreply.github.com`, repo-local git config), `LICENSE`
  "Copyright (c) 2026 pjrml" (a pseudonym is valid for MIT). The owner turns on GitHub "Keep my email addresses
  private" and "Block command line pushes that expose my email". Nothing public names private projects, repos,
  hosts or networks (owner rule 2026-11-19): the origin is described only as "a private build"; the port copies
  files only, no git history; the port source location lives in the maintainer's private notes.

## Owner review (2026-11-19)

- Hardware: Plus Plug S Gen2 and Plug S Gen3 (incl. EcoFlow) are supported, the code targets the Gen2 limits
  (dev plug found to be Gen3; spike S10 added). Both are 12 A; support rules by current/power rating are re-evaluated later
  (TODO "Later"), including the inconsistent default limits (2500 W trips at ~10.9 A, before 12 A and `y`).
- Installer gate (7.2): supported model and firmware up to date, also on updates; the user confirms the
  charger's maximum current (docs state the requirement).
- Mail template stored ASCII-only with JSON Unicode escapes (5.4); currency label accepts any characters (5.3).
- Mail settings reduced to to / cc / bcc / subject / body (6.1); month names follow the phone's language.
- Spike S2 also measures the maximum script size against `SetupHtml`.
- AP hardening keeps cloud off by default, with an explicit note in the docs; the installer offers to forget
  the home Wi-Fi after install (7.4).
