# rc.8: relay protection shown read-only, colour thresholds from the cut-off (design)

Status: approved scope (owner, 2026-11-23); the setup mockup below waits for the owner's confirmation before code.

## Why

Bench tests on a Plus Plug S Gen2 (fw 1.7.6) showed that the Shelly firmware already protects the plug:

- `Switch` `current_limit`, `power_limit` and `voltage_limit` each cut the relay when the **measured** value
  passes the limit, ~1-2 s after it does; precision ~0.01 A and a few W.
- The relay stays off until someone switches it on; `switch:0.errors` / `source` say `overcurrent`,
  `overpower` or `overvoltage`. Switching on, or writing the config again, clears `errors`.
- The firmware accepts 0..12 A, 0..2500 W, >0..280 V (the plug rating); above that it returns -103.
  **`current_limit` 0 cuts at once** (it does not disable the protection).
- Meter already logs every cut (`R,<t>,0/overcurrent` ...) and the page shows "Cut by protection".

So ChargeLens does not need to manage the cut-off. Choosing cut-off values well needs more data (line
voltage swings vs. the 2500 W rating at 10 A charging); that work is parked until after v1.0.

## Goals

1. The setup page **shows** the relay cut-off values (current, power, voltage) read from the plug, **without
   editing them**, plus a link that opens the plug's own web UI in a new tab for anyone who wants to change
   them.
2. An alert: the charger must be limited below the values shown, otherwise the Shelly relay cuts the power.
3. On the relay protection card nothing is editable; the LED colour thresholds (Thresholds card) stay
   editable. All other setup cards (device name, button, price, mail, LED, AP/hardening, export/import)
   stay as they are.
4. Default green -> yellow threshold `y` = **90% of the relay current cut-off** (`current_limit`, in A) read
   from the plug, with a note on how it is computed and that it should be set from the charger's own limits.
5. The installer drops "My charger is set to draw at most 10 A" and shows the same alert as goal 2, with the
   values read from the plug.

## Non-goals

- Writing `current_limit` / `power_limit` / `voltage_limit` anywhere in ChargeLens (setup, installer, import).
- A ChargeLens-side cut-off, an orange LED or a red banner on a cut.
- Per-model default cut-off values, "effective current" maths, charger-step suggestions (parked post-1.0).

## Decisions

- Owner: the 10 A charger figure (`CHARGER_A`) was the owner's own choice, not a product rule. It leaves the
  product: remove `CHARGER_A` from `setup.html` and `install.html`, the build check that both match
  (`tools/build.py`), the setup `limitNotes` warnings, and the installer confirmation.
- Owner: if the user later lowers the cut-off in the Shelly UI, the stored `y` does **not** change by
  itself; when `y` >= the current cut-off the setup shows an error on `y` asking to correct it (Save stays
  blocked until fixed, as other field errors do today).
- Owner: link to the Shelly UI. If a deep link to the *Output protections* settings works on both models,
  use it; otherwise link to the plug's root page (`http://<plug>/`) and the note says where to click.
- Claude's call: the setup reads the three limits from `Switch.GetConfig` (it already reads the config);
  `voltage_limit` is shown although ChargeLens never touched it.
- Claude's call: `y` default. When `cc:cfg` has no stored `y`, the setup proposes `round(0.9 x current_limit,
  1)` (12 A -> **10.8 A**) instead of the library default (11 A), and shows it as a proposal the user saves.
  The library default in `cfg_lib.js` and the scripts' fallback stay 11 A (scripts do not read the switch
  config for this). The installer writes nothing new.
- Claude's call: the `y` upper bound becomes the plug's `current_limit` (exclusive) on the setup page,
  instead of the fixed 12 in the `cfg_lib.js` table; the table bound stays as the scripts' sanity range.
- Claude's call: config export keeps the native limits in the file **for information**; import shows them
  but never writes them (today import applies `current_limit` / `power_limit`). The "different plug family"
  check on import stays.
- Claude's call: the bands bar (`bands()`) keeps using `current_limit` as its right end, now the value read
  from the plug.

## Note the setup shows next to `y` (text to refine in the plan)

> Default: 90% of the relay current cut-off (12 A -> 10.8 A). Set it from your charger: a little above the
> current your charger draws, and below the cut-off. On a 12 A / 2500 W plug the power cut-off (2500 W) is
> reached at about 10.4-10.9 A (240-230 V), so the ring may never turn yellow before the relay cuts.

## Setup mockup (Claude's interpretation; owner to confirm)

```
+-- Thresholds -----------------------------------------------+
| [====blue====|====red====|=====green=====|==yellow==]        |
|  idle          below min     charging      above normal     |
|                                                             |
| Residual current (A)            [ 0.1  ]                    |
| Minimum charging current (A)    [ 5    ]                    |
| Maximum normal current (A)      [ 10.8 ]                    |
|   Above this the ring turns yellow. Default: 90% of the     |
|   relay current cut-off (12 A -> 10.8 A). Set it from your  |
|   charger's limits, below the cut-off.                      |
| > Advanced                                                  |
+-------------------------------------------------------------+

+-- Relay protection (set in the plug) -----------------------+
|  Current cut-off     12 A                                   |
|  Power cut-off       2500 W                                 |
|  Voltage cut-off     280 V                                  |
|                                                             |
|  /!\ Limit your charger below these values. Above them the  |
|      plug's relay switches the power off by itself, and it  |
|      stays off until you switch it on again.                |
|                                                             |
|  These are the plug's own settings. To change them:         |
|  [Open the plug settings ->]  (new tab: Output protections) |
+-------------------------------------------------------------+
```

Installer "Charger" card (replaces the 10 A checkbox; the checkbox stays as the confirmation that unblocks
Install):

```
+-- Charger --------------------------------------------------+
| The plug cuts the power above 12 A / 2500 W / 280 V          |
| (its relay protection).                                      |
| [ ] My charger is limited below these values.                |
+-------------------------------------------------------------+
```

## Constraints

- Gen2 limits (design section 3): `SetupHtml` grows by text only; keep it small. The filesystem on an
  installed Gen2 has only ~4 KB free: the update test must cover a bigger `SetupHtml` (TODO item on the full
  Gen2 filesystem).
- Page logic stays between `/* ==== PURE ==== */` markers with tests first (`tests/setup_test.js`,
  `tests/install_test.js` or equivalents).
- Docs to update: `docs/configuration.md` (Relay protection, `y` default), `docs/install.md` (charger step),
  `docs/manual-tests.md`, screenshots of the setup and installer cards that change.

## Left to the builder

- Exact wording of notes and alert; placement of the link.
- Verifying a deep link into the Shelly web UI on Gen2 (fw 1.7.x) and Gen3 (fw 2.x).
- How the read-only values render on a plug whose `Switch.GetConfig` fails (show "unknown", do not block
  the other cards).
