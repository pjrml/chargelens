# How it works

For developers and curious users. The full design is in
[superpowers/specs/2026-11-19-chargelens-design.md](superpowers/specs/2026-11-19-chargelens-design.md).

## Scripts on the plug

Everything runs as Shelly scripts, found by **name**, never by id.

| Name | Source | Enabled at boot | Runs | Role |
|---|---|---|---|---|
| `Meter` | `src/meter.js` | yes (the only one) | always | counts energy, keeps daily/monthly totals, sessions, events; reads `cc:cfg`; starts `Led` and `Page` |
| `Led` | `src/led.js` | no | always | colours the LED ring from the current, using the thresholds sent by Meter |
| `Page` | `src/page.js` | no | always | HTTP endpoints `ui`, `data`, `list`, `time`, `log` |
| `PageHtml` | `src/page.html` | no | never (data) | the daily page, stored as text |
| `SetupHtml` | `src/setup.html` | no | never (data) | the setup page |
| `MailTpl` | `src/mail-default.json` | no | never (data) | mail settings and template, JSON text |
| `Installer` | `src/installer.js` | no | only to install or update | serves the install page |

Seven stored scripts of the ten allowed. `ui` is a small loader that reads `PageHtml` (or `SetupHtml` with
`?p=setup`) through `Script.GetCode` and writes it into the document. The install page is not stored on the plug:
the `Installer` loader fetches it from GitHub for the tag it was built for.

## Device limits that shape the code

Verified on a Plus Plug S (firmware 1.7.x) and a Plug S Gen3; the code targets the smaller Gen2 limits.

- 3 scripts enabled, 3 running, 10 stored; one script at most 65535 bytes.
- About 25 KB of heap shared by all running scripts. Heap is spent on declared functions (~27 B each plus the
  name), parameters, global variables and live objects, arrays and strings; function bodies, locals, string
  literals inside functions and comments are free until executed.
- ChargeLens leaves about 14 KB free with the three running (Plus Plug S Gen2); any growth of `Meter`, `Led` or
  `Page` must be measured.
- A script's HTTP reply is at most 4096 bytes; at most 5 endpoints per script; no `Array.sort`; script code is
  ASCII only (the build converts other characters to escapes); a `Shelly.call` during script load can be rejected,
  so work is deferred to a timer.
- `PLUGS_UI.SetConfig` (the LED ring) writes flash: it is called only when the state changes, never animated.
- KVS: 50 keys, value at most 253 bytes, key at most 42 bytes; `KVS.GetMany` is paged.
- The page is served over plain HTTP, so it has no secure context (no `crypto.subtle`, no service workers).

## The KVS map

32 of the 50 keys, key prefix `cc:`:

| Keys | Count | Content |
|---|---|---|
| `cc:state`, `cc:adj`, `cc:tadj`, `units` | 4 | meter state (last counter, own total, day, boot count, schema version `sv`), adjustments, clock corrections, firmware's own key |
| `cc:m:YYYYMM`, `cc:s:YYYYMM`, `cc:s:YYYYMM-2` | 18 | per month: start total and one integer Wh per day; sessions (two keys) |
| `cc:ss`, `cc:su`, `cc:boot`, `cc:ev0..2`, `cc:hb0..2` | 9 | open session, undated items, boot stamps, three event ring keys, three heartbeat keys |
| `cc:cfg` | 1 | user configuration (JSON, at most 253 bytes) |

Six months are kept: when a new month starts, the oldest month and its session keys are deleted together.
`cc:cfg` fields: `v`, `r`, `g`, `y`, `h`, `hr`, `hs`, `sg`, `p`, `cu`, `ds`, `df`, `lo`, `lb`
([configuration.md](configuration.md)); a missing or invalid field uses its default. The setup page refuses to save
more than 253 bytes (UTF-8), which is why the currency label is short.

## Energy and the clock

Meter reads the plug's own energy counter once per tick and adds the difference to the current day. The plug has
no battery-backed clock, so while the clock is unknown the energy is kept against `~boot.uptime` stamps and dated
later: automatically if the clock is set in the same power-up, by hand (the *Undated* card) otherwise. Counter
spikes and counter resets are recorded in `cc:adj` instead of being counted blindly. Heartbeats and boot stamps let
the page place events and charges in time after a power cut.

## Sessions and events

A session starts when the current is at or above the minimum charging current (`g`) and ends after the session gap
(`sg`) without it. Sessions are written into the month's session keys. Events (relay on/off with source, boot,
script restart `U`, old data format `L`) go into a small ring of three keys. Restarting `Meter` without a reboot
(an update, or Stop/Start in the web UI) is not counted as a boot: the open session is kept and a `U` event is
logged.

The meter tells a reboot from a restart by the plug's uptime: it is a reboot when the uptime is lower than the one
saved last, or when both are under 120 s. One edge follows from this: if the plug rebooted while `Meter` was stopped
and `Meter` is then started by hand more than 120 s after that reboot (uptime already above the saved one), it
counts as a restart (`U` event), not as a boot.

## Configuration flow

Meter checks the etag of `cc:cfg` every tick (60 seconds). On a change it re-parses, applies its own fields and
emits an event with the LED fields; `Led` applies them. A saved change is live within about a minute without
restarting anything. `Page` reads `cc:cfg` per request.

## Installer

The install page runs in your browser from the plug's address: it checks the model and firmware, reads
`dist/release.json` for the tag, downloads each file, checks size and CRC32 (the browser has no SHA-256 over plain
HTTP), writes the scripts with `Script.PutCode` in chunks, reads them back, enables only `Meter`, starts it and
waits for the page. Updates never rewrite KVS state. Since the plug runs at most 3 scripts, the installer stops
itself (and, on updates, `Led` and `Page` first) to make room, and its **Leave without changes** button restarts
them.
