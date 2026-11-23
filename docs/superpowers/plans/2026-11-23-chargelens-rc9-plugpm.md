# rc.9 Implementation Plan: Shelly Plug PM Gen3 through per-model builds

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ChargeLens installs and runs on the Shelly Plug PM Gen3 (metering only, no relay) from its own build,
while the Plus Plug S / Plug S Gen3 build and every URL that rc.8 plugs use stay as they are.

**Architecture:** One source. Line markers `//@if relay` / `//@else` / `//@end` (and `<!--@if relay-->` in page
markup) are resolved per build by `tools/build.py`, `tools/shelly.py` and `tools/puretest.js` from
`tools/builds.json`. `dist/` keeps the Plus Plug S build at the same paths; the PM build goes to
`dist/plugpmg3/`; `dist/release.json` gains a `builds` map. The install page (one page for every model, never
stored on the plug) picks the build from `Shelly.GetDeviceInfo` model at every install or update, and branches at
run time for the few installer differences.

**Tech Stack:** Shelly mJS scripts (ES5 subset), static HTML/JS pages, Python 3 stdlib tools, Node for CI tests.

**Spec:** `docs/superpowers/specs/2026-11-19-chargelens-design.md` (sections 3, 5, 6, 7) plus the rc.9 scope
below (owner decision 2026-11-23).

## rc.9 scope (owner, settled)

- Per-model builds, one source with build-time feature blocks stripped by `build.py`, one release entry per
  build; the installer detects the model at install time (`Shelly.GetDeviceInfo`) and picks the build.
  Plus Plug S Gen2 / Plug S Gen3 builds keep today's behaviour.
- PM Gen3 build: main page and setup page adapted now (no relay toggle, no `on` / `er`, no relay-protection card,
  no button setting); LED colour thresholds, mail, CSV, export/import stay. Meter reads `pm1:0`; Led uses the PM
  LED UI component with colour key `pm1:0`; the installer skips the relay protection confirmation for it.
- "No cut-off" warning in the installer and on the setup page: the plug cannot cut the load; overload protection
  is only the circuit breaker.
- Real-load device tests on a dev Plug PM Gen3 wired in series: mains -> Plug PM Gen3 -> Plug S Gen3 -> kettle;
  the load is applied by switching the Plug S Gen3 relay (`Switch.Set`), no person needed per test.
- Out of scope: screenshots and user docs for the PM Gen3 (after rc.9), the release itself (owner decides).

## Device facts (Plug PM Gen3, fw 2.1.1)

- Model `S3PL-30116EU`, app `PlugPMG3`, Gen3, 16 A.
- No `switch:0`, no `Switch.*`, no relay, no `Button` component (no button mode).
- Metering `pm1:0` (`PM1.GetStatus`): `voltage`, `current`, `apower`, `freq`, `aenergy.total` (Wh),
  `ret_aenergy`. No `output`, no `errors`, no `temperature`.
- LED ring: a `*_UI` component of its own (seen as `plugpm_ui`; Task 1 confirms the exact RPC name), same shape as
  `PLUGS_UI`: `leds.mode` = `power` | `switch` | `off`; colour key `pm1:0`; only its `on` colour is kept (an
  `off` colour is dropped). Mode `switch` + `pm1:0.on` = a static colour set by the script.
- Scripts: 10 stored / 3 running, script heap ~25.1 KB (same pool as the Plus Plug S, so the Gen2 limits still
  bind), filesystem 1 MB (~620 KB free), KVS present.

## Design decisions made in this plan

1. **Marker syntax.** A marker is a whole line: optional blanks, then `//` or `<!--`, then `@if FLAG`,
   `@if !FLAG`, `@else` or `@end`, then optional `-->`, nothing else. No nesting; `@else` at most once per block;
   an unknown flag, a stray `@else`/`@end` or an unclosed `@if` is an error naming the file line. Marker lines
   and dropped lines disappear entirely. Known flags: `relay` only (rc.9). Markers may appear in `src/*` and in
   `tests/*` (test files are filtered with the same build).
2. **Where markers are resolved.** After `//@lib` expansion and before `strip_test_only` / `minify` / `mangle` /
   `min_html`, in every consumer: `build.py`, `shelly.py` (`put`, `test`, `testpage`), `puretest.js`.
3. **`tools/builds.json`** is the single list of builds (read by all three tools):
   ```json
   {
     "plugs":    {"dir": "dist",          "features": ["relay"], "models": ["SNPL-00112EU", "EF3PL-00112EU"]},
     "plugpmg3": {"dir": "dist/plugpmg3", "features": [],        "models": ["S3PL-30116EU"]}
   }
   ```
   Default build of every tool is `plugs` (so all existing commands keep their meaning).
4. **Release layout.** `dist/` = `plugs` build at today's paths (manual-install raw links and old tools keep
   working). `dist/plugpmg3/` = the six PM files (`Meter.js`, `Led.js`, `Page.js`, `PageHtml.html`,
   `SetupHtml.html`, `MailTpl.json`). `dist/installer.js`, `dist/install.html` are shared (model-agnostic).
   `dist/release.json` = today's keys, top-level `files` unchanged (= `plugs` files + Installer + InstallHtml),
   plus `"builds": {"plugs": {"models": [...], "files": [...]}, "plugpmg3": {"models": [...], "files": [...]}}`,
   each `files` list = that build's six entries followed by the shared Installer and InstallHtml entries.
   `dist/latest.json` and `library/` (one Library entry: the shared installer) are unchanged.
5. **Backwards compatibility.** rc.7/rc.8 loaders fetch `dist/install.html` of a tag or `main` and that page reads
   `dist/release.json` next to it: both paths stay. A new install page that meets a `release.json` without
   `builds` (older tag, CDN cache) uses top-level `files` for the `plugs` build and stops for other builds. An old
   install page that meets the new `release.json` reads top-level `files` (= `plugs`), and rejects the PM model
   (not in its `MODELS`).
6. **Update keeps the build.** No state: the build is derived from the device model at every run of the install
   page (and of `shelly.py install`), so *Check for updates* always installs the same model's build.
7. **`MODELS`** (identical literal in `src/setup.html` and `src/install.html`, checked by `build.py`) gains
   `build` and `relay` keys and the PM entry:
   `const MODELS={"SNPL-00112EU":{gen:2,maxA:12,maxW:2500,build:"plugs",relay:1},"EF3PL-00112EU":{gen:3,maxA:12,maxW:2500,build:"plugs",relay:1},"S3PL-30116EU":{gen:3,maxA:16,maxW:3680,build:"plugpmg3",relay:0}};`
   (`maxW` 3680 = 16 A x 230 V; only used to tell plug families apart on import.) `build.py` checks: every
   `MODELS` model is listed in `builds.json` under its `build`, and `relay` is 1 exactly when that build has the
   `relay` feature.
8. **Install page** has no markers (it is downloaded by the browser, never stored, size does not matter): it
   branches at run time on `MODEL.relay`.
9. **Warning text** (one constant, identical in `src/install.html` and in the PM part of `src/setup.html`,
   checked by `build.py` like `idleOk`):
   `const NOCUT='This plug has no relay: it cannot cut the load, and ChargeLens cannot either. Overload protection is only the circuit breaker. Keep your charger below the plug rating (16 A) and the circuit rating.';`
10. **Update gate on the PM** stays (no open session, current <= residual threshold), reading the current from
    `PM1.GetStatus` instead of `Switch.GetStatus`: it protects the meter restart, not the relay.

## Global Constraints

- Work inside `public/` on branch `dev`; commit as the configured identity; the pre-commit hook runs
  `python tools/check_private.py`: never bypass it (`--no-verify`). Nothing private in any file or commit (no IPs,
  device ids, SSIDs, names, locations).
- Commit messages in en-US, ending with the co-author trailer the main session gives.
- ASCII-only script code; never type backslash-u escapes in any file (write the real character or an HTML
  entity; the build converts non-ASCII).
- Pure logic lives between `// ==== LIB ====` / `// ==== END LIB ====` (scripts) and `/* ==== PURE ==== */` /
  `/* ==== END PURE ==== */` (pages). Failing test first.
- Device limits: 3 running scripts, ~25 KB shared script heap, `MAX_CODE_TOTAL` 29000 B (Meter+Led+Page minified
  and mangled) **per build**, KVS values <= 253 B, no `Array.sort` in scripts, `*_UI.SetConfig` writes flash
  (only on a state change, as today).
- The `plugs` build output must stay byte-identical to the pre-rc.9 build except where a task says otherwise
  (only Tasks 7 and 8 change `plugs` bytes, by a few bytes each, and say so).
- If `node` is not on PATH (Windows dev PC), run the Node tests with VS Code's Electron:
  `ELECTRON_RUN_AS_NODE=1 "<VS Code>/Code.exe" tools/puretest.js ...` (see `docs/development.md`).
- Device work only on dev plugs; the main session gives the IPs (`<pm-ip>` = dev Plug PM Gen3, `<load-ip>` =
  dev Plug S Gen3 used as the load switch, `<gen2-ip>` = dev Plus Plug S Gen2) and the expected device ids.
  Before touching a plug, run `python tools/shelly.py --ip <ip> info` and stop if the id is not the one given.
  Back up a plug (`python tools/shelly.py --ip <ip> backup`) before changing it. Keep every plug's Wi-Fi station
  config.

## Review Focus

- A PM plug updated through *Check for updates* must get `dist/plugpmg3/*`, never the `plugs` files (Task 13
  test `relFor` + Task 19 device check of the stored Meter code).
- A Plus Plug S on rc.8 updating to the new release must keep working through the old loader and get the
  `plugs` files at the old paths (Task 5 test: top-level `files` == `builds.plugs.files`; Task 20 device check).
- Setup page on the PM must load although `Switch.GetConfig` and `PLUGS_UI.GetConfig` do not exist (Task 12:
  PM build calls neither; device check in Task 17).
- Validation on the PM must not demand a button mode (`in_mode`) that the PM does not have (Task 11 test).
- A marker typo (`//@if rely`, missing `//@end`) must fail the build and the tests, never ship both branches
  (Task 2 tests; Task 5 check that no `@if` survives in `dist/`).

---

### Task 1: Device facts check on the Plug PM Gen3 (read-only)

**Files:** none (results go into the task report).

- [ ] **Step 1:** `python tools/shelly.py --ip <pm-ip> info` -> model `S3PL-30116EU`, the expected id; list of
  scripts (note what is installed).
- [ ] **Step 2:** `python tools/shelly.py --ip <pm-ip> rpc Shelly.ListMethods` -> write down the exact names of
  the LED UI methods (`*UI.GetConfig` / `*UI.SetConfig`) and confirm `PM1.GetStatus`, `PM1.GetConfig` exist and
  `Switch.GetStatus` does not.
- [ ] **Step 3:** `rpc <UI>.GetConfig` -> confirm `leds.mode` and the colour key `pm1:0`.
- [ ] **Step 4:** in a browser or with `curl`: `http://<pm-ip>/rpc/PM1.GetStatus?id=0` returns `current`
  and `aenergy.total` (the pages use GET RPC).
- [ ] **Step 5:** Report the exact LED method name. Later tasks write it as `<PMUI>` (e.g. `PLUGPM_UI`): use the
  name exactly as `Shelly.ListMethods` prints it.

### Task 2: Marker resolver in `tools/shelly.py`

**Files:**
- Modify: `tools/shelly.py` (new function next to `strip_test_only`)
- Create: `tools/test_features.py`

**Interfaces:**
- Produces: `shelly.FEATURES_KNOWN = ("relay",)`; `shelly.apply_features(code: str, features, where="") -> str`
  (raises `ValueError` whose message contains `where` and the 1-based line number);
  `shelly.load_builds() -> dict` (parsed `tools/builds.json`); `shelly.build_features(name: str) -> list`
  (raises `SystemExit` for an unknown build name).
- Create `tools/builds.json` exactly as in design decision 3.

- [ ] **Step 1: Write the failing tests** in `tools/test_features.py` (plain asserts, style of
  `tools/test_mangle.py`):
  - `apply_features("a\n//@if relay\nb\n//@else\nc\n//@end\nd", ["relay"]) == "a\nb\nd"` and with `[]` ->
    `"a\nc\nd"`.
  - `//@if !relay` keeps its body only without `relay`; indented markers (`  //@if relay`) work;
    `<!--@if relay-->` / `<!--@else-->` / `<!--@end-->` work.
  - A comment that merely starts with `//@if` but has more text (`//@if relay x`) does not match the marker
    regex and stays as an ordinary line (assert it is kept unchanged).
  - Errors (`ValueError`, message contains `line N`): unknown flag `//@if rely`; nested `@if`; `@else` twice;
    `@end` without `@if`; unclosed `@if` at end of text.
  - A text without markers is returned unchanged (byte for byte, including a trailing newline).
  - `build_features("plugs") == ["relay"]`, `build_features("plugpmg3") == []`.
- [ ] **Step 2:** `python tools/test_features.py` -> fails (`apply_features` missing).
- [ ] **Step 3:** Implement with one regex per line:
  `^[ \t]*(?://|<!--)[ \t]*@(if|else|end)(?:[ \t]+(!?)(\w+))?[ \t]*(?:-->)?[ \t]*$`; `@if` requires a flag in
  `FEATURES_KNOWN`; `@else`/`@end` take none. Split on `"\n"`, rejoin with `"\n"`.
- [ ] **Step 4:** `python tools/test_features.py` -> prints nothing, exit 0. `python tools/test_mangle.py` still
  passes.
- [ ] **Step 5:** Commit `tools: feature markers (//@if relay) and builds.json`.

### Task 3: Markers in the Node test runner

**Files:**
- Modify: `tools/puretest.js`
- Create: `tests/features_fixture.js`, `tests/features_test.js`

**Interfaces:**
- Consumes: `tools/builds.json`, marker rules of Task 2.
- Produces: `node tools/puretest.js [--build NAME] <libfile> <testfile>` (default `plugs`); markers are resolved
  in the pure part, in the test file and in the "script N parses" bodies.

- [ ] **Step 1: Write the fixture and test.** `tests/features_fixture.js`: a `// ==== LIB ====` region holding
  ```
  //@if relay
  let FX = "relay";
  //@else
  let FX = "norelay";
  //@end
  ```
  and `// ==== END LIB ====`. `tests/features_test.js`:
  `t("build", function () { //@if relay` ... on separate lines: under `//@if relay` an `eq("fx", FX, "relay")`,
  under `//@else` `eq("fx", FX, "norelay")`, then `//@end`, then `});`.
- [ ] **Step 2:** `node tools/puretest.js tests/features_fixture.js tests/features_test.js` -> FAIL ("tests did
  not run": `FX` declared twice).
- [ ] **Step 3:** Add `applyFeatures(code, features, where)` to `puretest.js` mirroring Task 2 (same regex, same
  errors), read `builds.json` (path relative to `puretest.js`), parse `--build NAME` (unknown name -> exit 2 with
  a message), apply to `pureOf(...)`, to the test text and to each parsed `<script>` body.
- [ ] **Step 4:** Both `--build plugs` and `--build plugpmg3` print `1 passed, 0 failed`; a fixture with
  `//@if rely` makes the runner exit 1 with the line number (try it, then revert).
- [ ] **Step 5:** Every pair in `.github/workflows/ci.yml` still passes without `--build`.
- [ ] **Step 6:** Commit `puretest: --build and feature markers`.

### Task 4: `--build` in `shelly.py` test, testpage and put

**Files:** Modify `tools/shelly.py` (`run_tests`, `run_page_tests`, `main`, the `put` branch).

**Interfaces:**
- Consumes: `apply_features`, `build_features` (Task 2).
- Produces: `python tools/shelly.py [--build NAME] test|testpage|put ...`, default `plugs`.

- [ ] **Step 1:** Add `--build` (default `plugs`) to the argument parser; `run_tests(ip, libfile, testfile,
  mangle=False, build="plugs")` applies features to `lib_section(libfile)` and to the test text;
  `run_page_tests(htmlfile, testfile, browser=None, build="plugs")` applies them to the pure part, the script
  bodies and the test text; `put` applies them after `expand_libs`.
- [ ] **Step 2:** `python tools/shelly.py testpage tests/features_fixture.js tests/features_test.js` and the same
  with `--build plugpmg3` -> `1 passed` each (headless Edge, no device).
- [ ] **Step 3:** `python tools/shelly.py testpage src/page.html tests/page_test.js` still passes.
- [ ] **Step 4:** Commit `shelly.py: --build for test, testpage and put`.

### Task 5: Per-build output in `tools/build.py`

**Files:**
- Modify: `tools/build.py`, `src/setup.html` (`MODELS` line only), `src/install.html` (`MODELS` line only),
  `tests/install_test.js`, `tests/setup_test.js`
- Create: `tools/test_build.py`
- Generated: `dist/plugpmg3/*`, `dist/release.json`

**Interfaces:**
- Consumes: `apply_features`, `load_builds` (Task 2).
- Produces: `build.build(out_root)` writes every build; `dist/release.json` layout of design decision 4;
  `MODELS` of design decision 7.

- [ ] **Step 1: Failing tests.** `tools/test_build.py` (plain asserts): call `build.build(tmpdir)`, then
  - `release.json` has `builds` with keys `plugs`, `plugpmg3`; `rel["files"] == rel["builds"]["plugs"]["files"]`;
  - `builds.plugs.models == ["SNPL-00112EU","EF3PL-00112EU"]`, `builds.plugpmg3.models == ["S3PL-30116EU"]`;
  - every `plugpmg3` entry except `Installer`/`InstallHtml` has a path starting `dist/plugpmg3/`; both lists end
    with the same `Installer` and `InstallHtml` entries (`dist/installer.js`, `dist/install.html`);
  - every listed file exists under `tmpdir`, with the listed size and crc32;
  - no file under `dist/` contains `@if `, `@else` or `@end` marker text.
  In `tests/install_test.js`: `modelOf({model:"S3PL-30116EU"}).build === "plugpmg3"`, `.relay === 0`;
  `modelOf({model:"SNPL-00112EU"}).relay === 1`. In `tests/setup_test.js`: `MODELS["S3PL-30116EU"].maxA === 16`.
- [ ] **Step 2:** `python tools/test_build.py` and the install/setup pairs -> FAIL.
- [ ] **Step 3:** Implement:
  - `MODELS` lines as in design decision 7 (both pages, identical).
  - `build_script(rel, features)` and `build_page(rel, features)`: `apply_features(expand_libs(...), features,
    rel)` before the existing steps.
  - Loop over `load_builds()`: write the six `FILES` into the build's `dir` (the `plugs` dir is `dist`, so its
    paths do not change); the `INSTALLER` files are written once into `dist/`. Assert `MAX_CODE_TOTAL` per build
    (message names the build). Print one size block per build.
  - New checks: the `MODELS` literal agrees with `builds.json` (design decision 7); `const NOCUT=` line identical
    in `src/install.html` and `src/setup.html` once Task 11 adds it (skip the check while setup has none).
  - `tree()` already walks subfolders; keep `--check` working.
- [ ] **Step 4:** `python tools/build.py` -> both blocks printed, each `Meter+Led+Page` <= 29000.
  `git diff --stat dist/` shows only `release.json` changed among existing files, plus the new
  `dist/plugpmg3/` files (byte-identical to their `plugs` twins at this point: no markers exist yet). `python tools/build.py --check`, `python tools/test_build.py`, install/setup pairs pass.
- [ ] **Step 5:** Commit `build: per-model builds (dist/plugpmg3), builds map in release.json, MODELS per build`.

### Task 6: `shelly.py install` picks the build from the model

**Files:** Modify `tools/shelly.py` (`install`, `main`); test in `tools/test_build.py`.

**Interfaces:**
- Produces: `shelly.pick_files(rel: dict, builds: dict, model: str, override: str|None) -> (name, files)`;
  `python tools/shelly.py --ip IP install [--dist dist] [--build NAME]`.

- [ ] **Step 1: Failing test** (in `tools/test_build.py`): with the built `release.json` and `load_builds()`:
  `pick_files(rel, b, "S3PL-30116EU", None)[0] == "plugpmg3"`; `"EF3PL-00112EU"` -> `"plugs"`;
  override `"plugs"` wins; unknown model without override -> `SystemExit`; a `rel` without `builds` and model of
  the `plugs` build -> `("plugs", rel["files"])`; same `rel` with the PM model -> `SystemExit`.
- [ ] **Step 2:** Run -> FAIL.
- [ ] **Step 3:** Implement; `install()` reads `Shelly.GetDeviceInfo` model unless `--build` is given, prints
  `build: <name>`, then writes that build's files exactly as today.
- [ ] **Step 4:** `python tools/test_build.py` passes.
- [ ] **Step 5:** Commit `shelly.py install: choose the build by device model`.

### Task 7: Meter reads `pm1:0` in the PM build

**Files:** Modify `src/meter.js` (DEVICE part only).

- [ ] **Step 1:** Replace `let SWITCH_ID = 0;` by
  ```
  //@if relay
  let MC = "switch:0";  // metering component
  //@else
  let MC = "pm1:0";
  //@end
  ```
  and every `"switch:" + SWITCH_ID` by `MC` (in `onBand`, `tick`, `start`; keep the heap comment above `start`
  accurate). Wrap the whole `Shelly.addStatusHandler(...)` block (relay `R` events) in `//@if relay` ...
  `//@end`. Update the header comment (line 2) to name both plug families.
- [ ] **Step 2:** All Meter pairs of `ci.yml` pass with `--build plugs` and `--build plugpmg3`
  (`node tools/puretest.js --build plugpmg3 src/meter.js tests/meter_test.js`, etc.).
- [ ] **Step 3:** `python tools/build.py`; `dist/Meter.js` changes only by the `SWITCH_ID` -> `MC` rename;
  `dist/plugpmg3/Meter.js` contains `"pm1:0"`, no `addStatusHandler`, no `switch:`.
  `python tools/build.py --check` passes.
- [ ] **Step 4:** Commit `meter: pm1:0 metering and no relay events in the Plug PM Gen3 build`.

### Task 8: Led on the PM LED component

**Files:** Modify `src/led.js`, `tests/led_test.js`.

**Interfaces:**
- Produces (LIB): `ledParams(w: string, b: number, noClock: bool, c: object) -> object`, the `SetConfig` params
  for a `ledWrite` result `w` (`"band"` or the off mode): relay build
  `{config:{leds:{mode:"switch",colors:{"switch:0":{on:ledColour(b,noClock,c),off:ledOff(noClock,c)}}}}}`, PM
  build `{config:{leds:{mode:"switch",colors:{"pm1:0":{on:ledColour(b,noClock,c)}}}}}`; for `w !== "band"`
  both return `{config:{leds:{mode:"off"}}}`.

- [ ] **Step 1: Failing tests** in `tests/led_test.js`: under `//@if relay`, `ledParams("band",2,false,LED_DEF)`
  equals the relay object above with green on and dark off; under `//@else`, the PM object (no `off` key, key
  `pm1:0`); for both, `ledParams("off",2,false,LED_DEF)` -> mode `off`. Wrap the existing `ledOff` assertions
  (every line calling `ledOff(`) in `//@if relay` blocks (Step 3 removes `ledOff` from the PM build). The
  `rawBand` / `band` "relay off" assertions stay unwrapped (those functions stay in both builds).
- [ ] **Step 2:** `node tools/puretest.js src/led.js tests/led_test.js` (both builds) -> FAIL.
- [ ] **Step 3:** Implement `ledParams` in LIB with a marker block inside; wrap `ledOff` (definition and its
  tests) in `//@if relay`. DEVICE: `apply()` uses `ledParams(w, b, noClock, c)`; the RPC name is a marker pair:
  `//@if relay` `let UI_SET = "PLUGS_UI.SetConfig";` `//@else` `let UI_SET = "<PMUI>.SetConfig";` `//@end`
  (exact name from Task 1). `poll()` reads `MC` (same marker pair as Task 7) and passes
  `sw.output === true` in the relay build, `true` in the PM build (marker pair on that line). Update the header
  comment (PM: no dark/off colour, the ring always shows a band colour).
- [ ] **Step 4:** led pair passes in both builds; `python tools/build.py`: `dist/Led.js` changes by the refactor
  only, `dist/plugpmg3/Led.js` has `pm1:0`, the PM UI name, no `off:` colour; per-build totals <= 29000.
- [ ] **Step 5:** Commit `led: Plug PM Gen3 LED component (pm1:0, on colour only)`.

### Task 9: Page script `data` endpoint on the PM

**Files:** Modify `src/page.js`.

- [ ] **Step 1:** In the `data` handler: marker pair for `Shelly.getComponentStatus("switch:0")` vs
  `("pm1:0")`; the PM build's `out` object has no `on` and no `er` keys (marker pair over the `let out = ...`
  line, both variants complete). Update the header comment (endpoint list: `on`, `er` only on relay plugs; the
  relay toggle note).
- [ ] **Step 2:** `python tools/build.py`: `dist/Page.js` unchanged; `dist/plugpmg3/Page.js` reads `pm1:0`;
  `--check` passes. (Behaviour is checked on the device in Task 17.)
- [ ] **Step 3:** Commit `page.js: pm1:0 data without relay fields in the Plug PM Gen3 build`.

### Task 10: Daily page without relay controls on the PM

**Files:** Modify `src/page.html`, `tests/page_mail_test.js`.

- [ ] **Step 1: Failing test:** in `tests/page_mail_test.js` wrap the four `relayIcon` assertions in
  `//@if relay` ... `//@else` with `eq("no relayIcon", typeof relayIcon, "undefined")` ... `//@end`.
- [ ] **Step 2:** `node tools/puretest.js --build plugpmg3 src/page.html tests/page_mail_test.js` -> FAIL.
- [ ] **Step 3:** Wrap in `relay` blocks: the Relay row in the markup (`<!--@if relay-->` / `<!--@end-->`), the
  PURE `relayIcon` line, the relay part of `show()` (split that line so the relay statements stand on their own
  line inside the block), and the `$('rel').onclick=...` line. The `.sw` CSS may stay. The `tick()` refresh on a
  changed `D.on` stays (it never fires on the PM).
- [ ] **Step 4:** All page pairs pass in both builds (Node), and
  `python tools/shelly.py --build plugpmg3 testpage src/page.html tests/page_test.js` passes (scripts parse).
  `python tools/build.py`: `dist/PageHtml.html` unchanged.
- [ ] **Step 5:** Commit `page: no relay row on the Plug PM Gen3`.

### Task 11: Setup page pure logic for the PM

**Files:** Modify `src/setup.html` (PURE block), `tests/setup_test.js`.

**Interfaces:**
- Produces (PM build only): `NOCUT` (design decision 9); `validateForm` without the `in_mode` check and without
  the cut-off check, `native = {tz, name}`; `writePlan` without the Button item; `NATK = ['tz','name']`;
  `exportDoc` native without `current_limit`/`power_limit`/`voltage_limit`/`in_mode`; `importCheck` without
  the `relay` text (field `relay` is `''`); `hardenPlan` without the button item. `cutOf`, `yProposal`,
  `cutLink` exist only in the relay build. The relay build is unchanged.

- [ ] **Step 1: Failing tests** in `tests/setup_test.js`: wrap every existing assertion that uses `in_mode`,
  `cutOf`, `yProposal`, `cutLink`, the `Button` plan item, the button hardening item, or the relay limits in
  export/import in `//@if relay` blocks. Add under `//@if !relay`:
  - `validateForm(f, MODELS["S3PL-30116EU"])` with a valid form that has no `in_mode` -> no errors,
    `native` deep-equals `{tz:..., name:...}`; `y` = 15 is still a range error (range 1..12 in `cfg_lib.js`).
  - `writePlan(old, next)` with changed tz -> no item with `rpc` `PLUGS_UI.SetConfig`.
  - `NATK` equals `['tz','name']`.
  - `exportDoc(...)`.native has no key `current_limit` and no key `in_mode`.
  - `importCheck` of a Plus Plug S export into the PM model -> `ok:false`, error mentions "different plug family";
    a PM export into the PM -> `ok:true`, `relay === ''`.
  - `typeof NOCUT === 'string'` and it contains `circuit breaker`.
- [ ] **Step 2:** `node tools/puretest.js --build plugpmg3 src/setup.html tests/setup_test.js` -> FAIL;
  `--build plugs` still passes.
- [ ] **Step 3:** Implement with marker blocks inside the PURE block (split one-line functions into lines where a
  block must start; keep the relay variant text byte-identical in meaning). Add the same `NOCUT` line to
  `src/install.html` PURE (Task 13 uses it) so the `build.py` check of Task 5 now compares both.
- [ ] **Step 4:** setup pair passes in both builds; `python tools/build.py`; `dist/SetupHtml.html` byte-identical
  to before (`git diff --quiet dist/SetupHtml.html`).
- [ ] **Step 5:** Commit `setup: pure logic for the Plug PM Gen3 build (no relay, no button)`.

### Task 12: Setup page UI for the PM

**Files:** Modify `src/setup.html` (outside PURE).

- [ ] **Step 1:** Marker blocks so that the PM build:
  - `load()`: does not call `Switch.GetConfig` nor `PLUGS_UI.GetConfig`; `n = {tz, name}`; no proposal (`PROP`
    false), `CUT` unused.
  - `draw()`: no Relay protection card and no Button card; instead, right after the Thresholds card, a card
    `<div class="c"><div class="lab">No cut-off</div><div class="mu" style="color:var(--warn)">&#9888; ' + NOCUT + '</div></div>`;
    the `y` help text is `Above this the ring turns yellow. Set it from your charger: a little above the current it draws.`
  - `bands()`: right end `Math.max(MODEL.maxA, y||0, 1)`.
  - `readForm()`: no `in_mode`. `more()`: no button hardening line. The `hf` click handler passes no `in_mode`.
  - Check for updates: current from `/rpc/PM1.GetStatus?id=0`.
  - The footer line under Save drops "Nothing on this page switches the relay."
- [ ] **Step 2:** `python tools/shelly.py --build plugpmg3 testpage src/setup.html tests/setup_test.js` and the
  `plugs` run pass (all scripts parse).
- [ ] **Step 3:** `python tools/build.py`: `dist/SetupHtml.html` byte-identical; report
  `dist/plugpmg3/SetupHtml.html` size; `--check` passes; `grep -c "Switch\.\|PLUGS_UI\|in_mode"
  dist/plugpmg3/SetupHtml.html` -> 0.
- [ ] **Step 4:** Commit `setup: Plug PM Gen3 page (no-cut-off card, no relay or button settings)`.

### Task 13: Install page picks the build and adapts to the PM

**Files:** Modify `src/install.html`, `tests/install_test.js`.

**Interfaces:**
- Produces (PURE): `relFor(rel, build) -> rel view | null`: `rel.builds && rel.builds[build]` ->
  `Object.assign({}, rel, {files: rel.builds[build].files})`; no `builds` and `build === 'plugs'` -> `rel`;
  otherwise `null`. `meterUrl(model) -> string`: `'/rpc/Switch.GetStatus?id=0'` when `model.relay`, else
  `'/rpc/PM1.GetStatus?id=0'`.

- [ ] **Step 1: Failing tests** in `tests/install_test.js`: `relFor` with a release having `builds` returns the
  PM files for `plugpmg3` and keeps `version`/`tag`; without `builds` returns the same object for `plugs` and
  `null` for `plugpmg3`; unknown build with `builds` -> `null`. `meterUrl` for both models.
  `planInstall(..., relFor(rel,'plugpmg3'))` writes `Meter, Led, Page, PageHtml, SetupHtml, MailTpl` (paths of the
  PM build). `loaderEntry(relFor(rel,'plugpmg3'))` finds `Installer`.
- [ ] **Step 2:** install pair -> FAIL.
- [ ] **Step 3:** Implement and wire:
  - `init()`: after reading `release.json`, `REL=relFor(raw, MODEL.build)`; `null` -> halt with
    `This release has no build for this plug (<model>). Use a newer version.`
  - `Switch.GetConfig` only when `MODEL.relay`. `idle()` reads `meterUrl(MODEL)`.
  - Charger card: relay plugs unchanged; PM:
    `<div class="lab">No cut-off</div><div class="mu" style="color:var(--warn)">&#9888; '+NOCUT+'</div>'+ck('c_ok','I understand: this plug cannot switch the power off.',false)`
    (same checkbox id, still required, so `tools/drive.py` keeps working).
  - `curState()`: no `PLUGS_UI.GetConfig` call on the PM (`in_mode:null`).
  - Model rejection text: `... (Shelly Plus Plug S, Plug S Gen3 and Plug PM Gen3 only).`
  - "Nothing here switches the relay." only on relay plugs.
- [ ] **Step 4:** install pair passes in both builds; `python tools/shelly.py testpage src/install.html
  tests/install_test.js` passes; `python tools/build.py` and `--check`.
- [ ] **Step 5:** Commit `install: choose the build by model; no-cut-off confirmation on the Plug PM Gen3`.

### Task 14: CI runs every build

**Files:** Modify `.github/workflows/ci.yml`.

- [ ] **Step 1:** Add steps `python tools/test_features.py` and `python tools/test_build.py`. Wrap the whole
  "pure logic tests (Node)" block in `for b in plugs plugpmg3; do ... done`, passing `--build $b` to every
  `puretest.js` call, and add `node tools/puretest.js --build $b tests/features_fixture.js tests/features_test.js`.
- [ ] **Step 2:** Run the same commands locally (Node or Electron) -> all pass.
- [ ] **Step 3:** Full local check: `python tools/build.py --check`, `python tools/check_private.py`, both test
  scripts, all pairs both builds, Edge `testpage` for page, setup and install in both builds. Report per-build
  sizes (`Meter+Led+Page`, `SetupHtml`, `PageHtml`).
- [ ] **Step 4:** Commit `ci: test both builds`, push `dev`, confirm CI green (`gh run list --branch dev`).

### Task 15 (only if the owner answers yes to open question 3): thresholds up to 16 A on the PM

**Files:** `src/cfg_lib.js`, `tests/cfg_test.js`.

- [ ] **Step 1:** Failing test under `//@if !relay`: `cfgParse('{"r":0.1,"g":10,"y":16}').y === 16`; under
  `//@if relay` the existing 12 A ceiling test stays.
- [ ] **Step 2:** Marker pair over the `cfgNum()` table line: PM variant `g,5,1,15;y,11,1,16`, rest identical.
- [ ] **Step 3:** cfg, setup and Meter pairs pass in both builds; `plugs` dist unchanged; commit.

### Task 16: Pure tests on the PM device

**Files:** none. Device: `<pm-ip>` (check id, back up first).

- [ ] **Step 1:** If ChargeLens runs on the PM, `test` pauses Led/Page itself. Run
  `python tools/shelly.py --ip <pm-ip> --build plugpmg3 test src/meter.js tests/meter_test.js`, the same for
  every Meter test file of `ci.yml`, `src/led.js tests/led_test.js`, `src/cfg_lib.js tests/cfg_test.js`; then
  the same set with `--mangle`. Expected: `N passed, 0 failed` each.
- [ ] **Step 2:** Report results.

### Task 17: Dev install of the PM build, idle checks, heap

**Device:** `<pm-ip>` (id check, backup). Starting state: delete leftover test scripts if any (keep the backup).

- [ ] **Step 1:** `python tools/shelly.py --ip <pm-ip> install` -> prints `build: plugpmg3`; Meter enabled;
  after ~30 s `info` shows Meter, Led, Page running.
- [ ] **Step 2:** `http://<pm-ip>/script/<PageId>/data` -> JSON with `w`, `a`, `v`, `e`, no `on`, no `er`.
- [ ] **Step 3:** `rpc <PMUI>.GetConfig` -> `leds.mode` `switch`, `pm1:0.on` = blue `[0,0,100]` (idle) or purple
  if the clock is unknown; `rpc Script.GetStatus {"id":<LedId>}` has no errors.
- [ ] **Step 4:** Pages through `python tools/drive.py --ip <pm-ip> steps "open:/script/<PageId>/ui" "wait:History" dump
  "open:/script/<PageId>/ui?p=setup" "wait:No cut-off" dump`: no "Relay" row; setup shows the No cut-off card,
  no Relay protection and no Button card; Save of a changed price works (`wait:Saved`).
- [ ] **Step 5:** Heap: `rpc Script.GetStatus` for Meter, Led, Page (`mem_used`, `mem_peak`, `mem_free`) at rest
  and after a page load; `rpc Sys.GetStatus` (`ram_free`, `fs_free`). Acceptance: script heap free at rest
  >= 10.7 KB (Gen2 rc.5 had ~14.4-15.5 KB).
- [ ] **Step 6:** `rpc Shelly.Reboot`, wait 60 s: Meter starts Led and Page; a `B` event in `log`.

### Task 18: Real-load test with the series wiring

**Devices:** `<pm-ip>` (ChargeLens PM build) and `<load-ip>` (load switch; its relay is the only thing switched).
Water in the kettle is the owner's set-up; never keep the load on longer than 90 s per period; switch off at once
if `PM1.GetStatus.current` reads above 12 A.

- [ ] **Step 1:** Baseline: `rpc PM1.GetStatus {"id":0}` on the PM and `rpc Switch.GetStatus {"id":0}` on the
  load plug; note `aenergy.total` of both and the PM's `cc:state` (`rpc KVS.Get {"key":"cc:state"}`).
- [ ] **Step 2:** `rpc Switch.Set {"id":0,"on":true}` on `<load-ip>`; poll the PM every 5 s for 60 s: current
  ~8-9 A; after the 10 s band hold the PM LED colour is green `[0,100,0]`; `KVS.Get cc:ss` is non-null (session
  open). Switch off; after the hold the colour is blue.
- [ ] **Step 3:** Update gate under load: switch the load on, run
  `python tools/drive.py --ip <pm-ip> steps "open:/script/<PageId>/ui?p=setup" "wait:Check for updates:30" click:up "wait:update after charging:30" dump`
  -> refused. Switch off.
- [ ] **Step 4:** Yellow band: write `cc:cfg` `{"v":1,"g":3,"y":6}` (`rpc KVS.Set`), wait 70 s (Meter polls once a
  minute), load on 40 s -> yellow `[100,70,0]`; off; restore the previous `cc:cfg` value (or delete the key if
  there was none).
- [ ] **Step 5:** Wait past the session gap (`sg`, default 600 s): `cc:ss` null and a record in
  `cc:s:<YYYYMM>`; the daily page lists the session(s). Compare energy: PM Meter's counted Wh for the test vs the
  PM `aenergy.total` delta vs the load plug's delta (expected within ~3 %).
- [ ] **Step 6:** Leave the load plug relay as found (on or off); report all figures.

### Task 19: Install page end to end on the PM

**Device:** `<pm-ip>`. Source: `python tools/shelly.py serve` on the PC and `?base=http://<pc-ip>:8000/`, or
public `dev` after a push (`?base=https://raw.githubusercontent.com/pjrml/chargelens/dev/`; the raw CDN caches up
to 300 s).

- [ ] **Step 1:** First install: back up; delete the ChargeLens scripts except `Installer`
  (`python tools/shelly.py --ip <pm-ip> delscript <name>`); if `Installer` is missing, write it with
  `python tools/shelly.py --ip <pm-ip> put Installer dist/installer.js --temp` (stored, not enabled at boot) and
  start it (`rpc Script.Start {"id":<InstallerId>}`); then
  `python tools/drive.py --ip <pm-ip> steps confirm "open:/script/<InstallerId>/install?base=<base>" "wait:No cut-off:90" dump check:c_ok click:go "wait:Open the setup page:300" dump`
  -> the plan line lists the six files; install ends; the stored Meter code equals `dist/plugpmg3/Meter.js`
  (`rpc Script.GetCode`, compare length and first line). Restore the KVS from the backup if the history matters
  (it does not on a dev plug).
- [ ] **Step 2:** Update path: `python tools/drive.py --ip <pm-ip> update` (with the same base via the setup page's
  installer, or `steps` with `?base=`) -> "installed and up to date", Reinstall, "The installer is up to date".
- [ ] **Step 3:** Hardening on the PM: no "button" line offered.

### Task 20: Regression on the Plus Plug S build

**Devices:** `<gen2-ip>` (and optionally `<load-ip>`, restoring its relay state afterwards).

- [ ] **Step 1:** Back up the Gen2; record `fs_free`.
- [ ] **Step 2:** `drive.py` update with the dev base (as Task 19 Step 2) -> Reinstall of the `plugs` build; the
  stored Meter code equals `dist/Meter.js`; the install page shows the relay protection Charger card as in rc.8.
- [ ] **Step 3:** `fs_free` unchanged; Meter, Led, Page running; setup page shows the Relay protection card.
- [ ] **Step 4:** Report. The main session records the results in the private TODO and decides the release with
  the owner (version bump, changelog, docs and screenshots are later work).

## Open questions (owner)

1. Update gate on the PM: the plan keeps it (no update while a session is open or current > residual), reading
   `PM1.GetStatus`; "skips the relay idle check" in the scope is read as "no `Switch.GetStatus`". Recommendation:
   keep the gate.
2. Installer confirmation on the PM: the plan shows the no-cut-off warning with a required tick ("I understand:
   this plug cannot switch the power off."), replacing the relay-protection confirmation. Recommendation: keep
   the tick (the user acknowledges the risk; `drive.py` keeps working).
3. Threshold ranges are shared (`g` <= 11 A, `y` <= 12 A), too low for a 16 A plug with a 13-16 A charger.
   Recommendation: yes, Task 15 (PM build only, one marker pair).
