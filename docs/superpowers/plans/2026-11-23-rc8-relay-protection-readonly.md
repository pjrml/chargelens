# rc.8 plan: relay protection read-only, yellow default from the cut-off

Design: `docs/superpowers/specs/2026-11-23-rc8-relay-protection-readonly-design.md` (owner confirmed the setup
mockup on 2026-11-23: the Relay protection card becomes display-only with a link to the plug's own web UI).

Ground rules (from the repo): pure logic between `/* ==== PURE ==== */` markers, **failing test first**;
ASCII-only script code, non-ASCII in pages is converted by the build (never type `\u` escapes, write the real
character or an HTML entity); keep `SetupHtml` small (Gen2 filesystem has ~4 KB free). Run all commands inside
`public/`. Branch `dev`.

## Facts settled while planning

- Deep link into the Shelly web UI, same route on Gen2 fw 1.7.6 and Gen3 fw 2.2.0 (svelte-spa-router, hash
  routes `/:componentType/:componentId/settings/protections`): `http://<host>/#/switch/0/settings/protections`.
- `cfgJson` omits values equal to the library default, so "no `y` stored" is the same as "`y` = 11 A (library
  default) in use". The setup then proposes `round(0.9 x current_limit, 1)` and says the proposal is not saved yet.

## Task A: code and tests (`src/setup.html`, `src/install.html`, `tools/build.py`, tests)

### A1. Setup PURE block (`src/setup.html`, tests in `tests/setup_test.js`)

1. New `cutOf(sw)`: from a `Switch.GetConfig` result (or null) return
   `{current_limit, power_limit, voltage_limit}`, each a number or null (non-number -> null); `cutOf(null)` ->
   all three null.
2. New `yProposal(cut)`: `Math.round(cut.current_limit*9)/10` when `current_limit` is a number > 0, else
   `cfgDef('y')`. 12 -> 10.8; 11 -> 9.9; null -> 11.
3. New `cutLink(host)`: `'http://'+host+'/#/switch/0/settings/protections'`.
4. `validateForm(f, model, cut)`: drop `current_limit` / `power_limit` from the form, their errors and from
   `native` (native becomes `{in_mode, tz, name}`). New check: when `y` has no range error and
   `cut && typeof cut.current_limit==='number'` and `y >= cut.current_limit` ->
   `e.y = 'Below the relay current cut-off ('+cl+' A): lower it, or raise the cut-off in the plug settings'`.
   No `cut` (or null `current_limit`) -> no such check (the `cfg_lib.js` range still applies).
5. Remove `CHARGER_A` and `limitNotes` (and their tests).
6. `writePlan`: never emits `Switch.SetConfig` (remove the block); tests assert no `Switch.SetConfig` item even
   when old/new states carry different limits.
7. `exportDoc(s, version, now)`: `s.cut` (as `cutOf`) is written for information into `native` as
   `current_limit`, `power_limit`, `voltage_limit` (key order: current_limit, power_limit, voltage_limit,
   in_mode, tz, name, ap, cloud, ble, mqtt); missing `s.cut` -> nulls.
8. `importCheck(doc, model, c)`: `NATK = ['in_mode','tz','name']`; validates with `validateForm(f, model,
   c && c.cut)`; never puts limits into `next`; returns an extra field `relay`: when the file's native has a
   numeric `current_limit` or `power_limit`, the text
   `'Relay protection in the file (shown only, not applied): '+a+' A / '+w+' W'` (missing value -> `?`), else
   `''`. The "different plug family" check stays.

### A2. Setup UI (outside PURE)

- `load()`: `Switch.GetConfig` gets `.catch(e=>null)`; `CUT = cutOf(sw)`; `n` no longer holds the limits;
  `OLD.cut = CUT`. When `raw` (the stored `cc:cfg` text) has no numeric `y` (parse it with `try JSON.parse`),
  the form shows `yProposal(CUT)` instead of `c.y` and a note `PROP` is shown (below).
- Thresholds card, `y` field help: `Above this the ring turns yellow. Proposed: 90% of the relay current
  cut-off (12 A -> 10.8 A, from this plug's value). Set it from your charger: a little above the current it
  draws, and below the cut-off.` (the "12 A -> 10.8 A" part uses this plug's values; when the cut-off is unknown,
  drop the parenthesis). When the proposal is shown, add a warning line under the field:
  `Proposal, not saved yet: the plug uses 11 A until you save.` (11 = `cfgDef('y')`).
- Relay protection card replaces the two inputs (no `f_current_limit` / `f_power_limit` inputs any more):
  ```
  Relay protection
  Current cut-off   12 A        (unknown when null)
  Power cut-off     2500 W
  Voltage cut-off   280 V
  ⚠ Limit your charger below these values. Above them the plug's relay switches the power off by itself, and
    it stays off until you switch it on again.
  These are the plug's own settings; ChargeLens does not change them.
  [Open the plug settings]  (link, target=_blank rel=noopener, href=cutLink(location.host))
  Opens the Shelly web UI in a new tab: Output protections.
  ```
  Reuse existing classes (`c`, `lab`, `f`, `mu`, warn colour `var(--warn)`); no new CSS unless needed.
- `readForm()`: drop `current_limit`, `power_limit`. `bands()`: right end
  `Math.max(CUT&&CUT.current_limit||MODEL.maxA, y||0, 1)`.
- `lims()`: now shows the live `y` error from `validateForm(readForm(), MODEL, CUT).errors.y` in `e_y`; call it
  once at the end of `load()` so a stored `y` >= cut-off shows at once. Remove `limitNotes` use.
- `save()`, `apApply()`: pass `CUT` to `validateForm`.
- Export: `exportNow` passes `cut: OLD.cut`. Import: pass `cut: OLD.cut` in `c`; show `r.relay` (when not
  empty) as a `mu` line above the changes.

### A3. Installer (`src/install.html`, tests in `tests/install_test.js`)

- Remove `CHARGER_A` (and its tests). New PURE `cutText(sw)`: null/non-object -> null; else
  `a+' A / '+w+' W / '+v+' V'` from `current_limit`, `power_limit`, `voltage_limit` (non-number -> `?`).
  Tests: full values, one missing, null.
- Read `Switch.GetConfig?id=0` with `.catch(()=>null)` where the device info is read; keep it in a variable.
- Charger card, checkbox id stays `c_ok` (tools/drive.py ticks it), still required for Install:
  - text known: `The plug cuts the power above <t> (its relay protection, set in the Shelly web UI).`
    checkbox `My charger is limited below these values.`
  - unknown: `The plug's relay protection could not be read: check it in the Shelly web UI (Output
    protections).` same checkbox.
  No hint about 10 A.

### A4. Build and checks

- `tools/build.py`: remove the `CHARGER_A` assertion.
- Run: `node tools/puretest.js src/setup.html tests/setup_test.js`, the install pair, every pair in
  `.github/workflows/ci.yml`, `python tools/build.py`, `python tools/build.py --check`,
  `python tools/check_private.py`, `python -m unittest` for tools tests if the repo has them (see `docs/development.md`).
  Report `dist/SetupHtml*` and installer sizes before/after.

## Task B: docs (no code)

Replace the fixed "set the charger to at most 10 A" requirement with "limit the charger below the plug's relay
protection values (the setup page and the installer show them)". Useful fact to keep as an example, not a
rule: on the tested 12 A / 2500 W plugs the power cut-off is reached at about 10.4-10.9 A (240-230 V line), so
10 A is the largest common charger step that fits. Files (grep `10 A`, `CHARGER_A`, `Current limit`,
`Power limit`, `current_limit`, `power_limit` in `README.md` and `docs/` to find all):

- `docs/configuration.md`: Relay protection section = read-only values + link (Output protections) +
  alert; ChargeLens never writes them; import shows but never applies them; `y` default proposal (90% of the
  current cut-off, e.g. 12 A -> 10.8 A; not saved until you save; error when `y` >= cut-off) and that it should
  be set from the charger's own limits; the power note (ring may never turn yellow before a 2500 W cut on a
  10 A+ charge at a high line).
- `docs/install.md` (charger step table row, requirement box), `docs/install-manual.md`, `docs/shelly-setup.md`,
  `docs/troubleshooting.md` (relay cut: what to do), `docs/usage.md` (yellow row: above the maximum normal
  current, not "11 A"), `docs/development.md` (CHARGER_A line), `README.md` if it quotes 10 A.
- `docs/manual-tests.md`: 1.6 (charger confirmation shows the values read from the plug); section 2 relay
  limit tests become: values shown read-only, link opens Output protections in a new tab (Gen2 and Gen3),
  `y` proposal on a plug with no stored `y`, `y` >= cut-off error blocks Save, import file with other limits
  does not change them.
- Every user action its own numbered step (docs style). en-US. Nothing private (no IPs, names, SSIDs).
- Screenshots `setup-*` (relay card) and `install-checks.png` must be retaken: add nothing to the images now;
  list them in the final report.

## After A and B (main session)

Build, review the diff, commit/push `dev`; device check on the Gen2 and Gen3 via `shelly.py install` (setup
card values, link, proposal, error); update test with the bigger `SetupHtml` on the full Gen2 filesystem when
the release is cut (owner decides the merge to `main`).
