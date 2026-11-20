# ChargeLens v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Turn the private build v2.2 into ChargeLens v1: configurable, English, installable from the browser
through the Shelly Library URL, documented, on Plus Plug S Gen2 and Plug S Gen3.

**Architecture:** Three running scripts (`Meter`, `Led`, `Page`) plus stored, never-started data scripts
(`PageHtml`, `SetupHtml`, `MailTpl`) and an `Installer` script that serves an install page from the plug.
Numbers live in one KVS key `cc:cfg`; text lives in `MailTpl`. Pure logic sits between markers and is tested
on the device (scripts) or in headless Edge (pages). `tools/build.py` writes a committed, ASCII-only `dist/`
that the installer downloads from `raw.githubusercontent.com` by tag.

**Tech Stack:** Shelly mJS scripts (ES5 subset), plain HTML/CSS/JS pages (no framework, no build step beyond
minify), Python 3.8+ stdlib (`tools/`), headless Microsoft Edge for page tests, Node (CI only) for pure tests,
GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-19-chargelens-design.md` (read it with this plan; section numbers
below refer to it).

## Global Constraints

- Device limits (spec section 3, spike 9.1): 3 enabled / 3 running / 10 stored scripts; one script <= 65535 B;
  ~25 KB shared heap, ~1.25 B heap per byte of loaded code; script HTTP reply <= 4096 B; 5 `registerEndpoint`
  per script; KVS 50 keys, value <= 253 B, key <= 42 B; `KVS.GetMany` is paged (loop on `offset` to `total`);
  no `Array.sort`; a `Shelly.call` during script load can be rejected (defer to a timer).
- Script code and everything in `dist/` is ASCII. Non-ASCII is produced by `tools/build.py` (JS escapes inside
  `<script>`/`.js`, `&#x...;` entities in HTML text). **Never type `\uXXXX` escapes by hand** (the tool layer
  turns them into the real character); in code that must emit one, build it as `String.fromCharCode(92) + "u"`.
- `PLUGS_UI.SetConfig` writes flash: only on a state change, never animated.
- Scripts are found by **name**, never by id: `Meter`, `Led`, `Page`, `PageHtml`, `SetupHtml`, `MailTpl`,
  `Installer`. Only `Meter` has `enable: true`.
- Nothing on any page or in reconfiguration toggles the relay except the explicit daily-page toggle (and the
  button in `momentary` mode). Button default `detached`.
- Never lose or silently delete logged energy; KVS state is never rewritten by the installer.
- `cc:cfg` <= 253 B (UTF-8 bytes), defaults = v2.2 values (table 5.3); missing/invalid field = its default.
- Public repo: nothing may name the owner's private projects, repos, hosts, networks, IPs, MACs, SSIDs, names,
  address or condominium text. The private build source location is `<private-build>` in this plan (real path
  in the maintainer's private notes). Run `python tools/check_private.py` before every commit (Task 1).
- Development devices only: dev plug (Gen3, EcoFlow) and second plug (Gen2). Never the production plug. Their
  Wi-Fi station config is kept. IPs are passed as `--ip`, never committed.
- Repo text en-US; commits as `pjrml` with the no-reply e-mail; after each task: `TODO.md` -> `Done` line,
  commit (push once the remote exists).
- GitHub path `pjrml/chargelens`, one constant in `tools/build.py`; version `X.Y.Z` in `src/version.txt`;
  tag `vX.Y.Z`.

## Review Focus

1. **A broken or hand-edited `cc:cfg`** (invalid JSON, wrong types, `g >= y`, over 253 B, unknown fields,
   `cu` = `€`): every script and page keeps working with per-field defaults; the setup page refuses to save
   anything over 253 B. Tests: Task 2 (`cfg_bad_*`).
2. **A config change while a session is open** (e.g. `g` or `sg` changed mid-charge): the open session is not
   closed or reset by the change itself, energy keeps counting, the relay is untouched. Test: Task 3
   (`cfg_change_keeps_session`).
3. **Meter restarted without a reboot** (installer update, user pressing Stop/Start in the web UI): no boot
   counted, no `B` event, open session kept, a `U` event logged. Tests: Task 3 (`boot_rule_*`).
4. **Non-ASCII in user text** (`€`, accents in the mail subject/body, device name): stored ASCII-only, read back
   identical, shown correctly in the mail. Tests: Task 6 (`ascii_json_roundtrip`), Task 2 (`cfg_utf8_len`).
5. **Update over a configured plug**: `MailTpl`, `cc:cfg`, device settings and the energy log survive; the
   update is refused while charging or when a private v2.2 build is found. Tests: Task 9 (`plan_update_*`,
   `plan_legacy`, `idle_gate_*`).

---

## File structure

| Path | Responsibility |
|---|---|
| `src/meter.js` | energy, sessions, events, boots, clock handling, config watch; starts Led and Page |
| `src/led.js` | current bands -> LED ring, band events to Meter |
| `src/page.js` | 5 endpoints (`ui`, `data`, `list`, `time`, `log`) |
| `src/page.html` | daily page (`PageHtml`) |
| `src/setup.html` | setup page (`SetupHtml`) |
| `src/cfg_lib.js` | shared pure config code (parse, validate, serialise), included into Meter and both pages |
| `src/mail-default.json` | default mail settings + template (source of `MailTpl`) |
| `src/installer.js` | tiny `Installer` script: serves the install loader on endpoint `install` |
| `src/install.html` | install/update page logic (fetched by the loader from GitHub; never stored on the plug) |
| `src/version.txt` | `X.Y.Z` |
| `tests/*_test.js` | device tests (LIB) and page tests (PURE) |
| `tools/shelly.py` | dev CLI: `info`, `backup`, `rpc`, `put`, `delscript`, `test`, `testpage`, `install`, `serve` |
| `tools/build.py` | builds `dist/`, `library/`, release manifests; `--check` for CI |
| `tools/check_private.py` | public-repo guard (generic patterns + private term list kept outside the repo) |
| `tools/puretest.js` | Node runner of the same tests (CI) |
| `dist/` | committed build output + `release.json`, `latest.json` |
| `library/manifest.json`, `library/chargelens-installer.js` | Shelly Library URL index and the installer copy it points to |
| `.github/workflows/ci.yml` | rebuild check + Node pure tests |
| `docs/*.md`, `docs/assets/` | user docs (spec section 8), logo, screenshots |

---

### Task 1: Port the private build, scrubbed, tests green

Copy files only (no history). Behaviour unchanged except what the scrub removes.

**Files:**
- Create: `src/meter.js`, `src/led.js`, `src/page.js`, `src/page.html` (from `<private-build>/scripts/`)
- Create: `tests/{meter,meter_review,stamp,session,session2,session3,event,led,page,page2,page3}_test.js`
- Create: `tools/shelly.py`, `tools/check_private.py`, `docs/development.md`
- Not ported: `probe.js`, `import_sheet.py`, the private README, backups.

**Interfaces:**
- Produces: `python tools/shelly.py --ip <ip> test <libfile> <testfile>` (device),
  `python tools/shelly.py testpage <htmlfile> <testfile>` (Edge), `put <Name> <file> [--temp|--store]`,
  `info`, `backup --out <dir>`, `rpc <Method> [json]`, `delscript <Name>`. Test API in every test file:
  `t(name, fn)`, `eq(label, got, exp)`, `near(label, got, exp, tol)`.
- Produces: `python tools/check_private.py [paths...]` exits 1 and prints `file:line: term` on any hit.

- [ ] **Step 1: Copy the four scripts and the 11 test files into `src/` and `tests/`.** Remove from comments:
  private spec paths, "owner request/change" notes, repo/venv paths in test headers (replace with the
  `tools/shelly.py` command line).
- [ ] **Step 2: Scrub `src/page.html`.** `PRICES` becomes `[['200001', 0, '']]` (no tariff text); the mail
  body in `mailText` becomes a neutral two-line text (no condominium, parking, address, name, fraction); title
  and heading become `ChargeLens` (rest of the UI stays Portuguese until Task 6). Same for `page.js` BOOT title.
  Adjust `page2_test.js` / `page3_test.js` expectations that quoted the removed text and the 0.1866 price.
- [ ] **Step 3: Port `tools/shelly.py`.** Remove `find()` and the MAC/NAME/POOL/SSH constants; `--ip` is
  required for every device command; `backup` writes to `--out` (default `~/.config/chargelens/backups/`);
  Edge is looked up in both `Program Files` paths and `--browser <path>` overrides; add `info` (device info +
  `Sys.GetStatus` `ram_free`, `Script.List`). Chunk size for `PutCode` becomes 4000 (spike S4). Keep
  `TEST_PRELUDE`, `lib_section`, `minify`, `expand_includes` as they are.
- [ ] **Step 4: Write `tools/check_private.py`.** Generic patterns (always): IPv4 other than `192.168.33.1`
  and `0.0.0.0`, MAC addresses, e-mail addresses other than `@users.noreply.github.com` and `example.com`,
  a Portuguese `lang` attribute (regex `lang="pt`, built in the script so the script does not match itself),
  Windows user paths. Private terms: one per line from `~/.config/chargelens/private-terms.txt`
  (outside the repo; the maintainer fills it with project/host/network/person names); missing file = warning,
  not failure. Scans `git ls-files` plus untracked non-ignored files by default.
- [ ] **Step 5: Create the private terms file** at `~/.config/chargelens/private-terms.txt` (names of the
  private repo, hosts, SSIDs, router alias, device names, the owner's personal data) — never in the repo.
- [ ] **Step 6: Run the device tests on the dev plug.**
  Run, for each pair: `python tools/shelly.py --ip <dev-ip> test src/meter.js tests/meter_test.js` (and
  `meter_review`, `stamp`, `session`, `session2`, `session3`, `event` against `src/meter.js`; `led_test.js`
  against `src/led.js`). Expected: every file ends `N passed, 0 failed` (counts as v2.2: 49, 19, 12, 23, 21,
  14, 9, 22).
- [ ] **Step 7: Run the page tests.** `python tools/shelly.py testpage src/page.html tests/page_test.js` (and
  `page2`, `page3`). Expected: `0 failed`.
- [ ] **Step 8: Run `python tools/check_private.py`.** Expected: no hits. Write `docs/development.md` (first
  version): test commands, the check tool, where the private terms file lives (path only).
- [ ] **Step 9: Commit** `Port the private build v2.2 (scrubbed), device and page tests green`.

### Task 2: Shared config library `cfg_lib.js`

**Files:**
- Create: `src/cfg_lib.js`, `tests/cfg_test.js`
- Modify: `tools/shelly.py` (code include)

**Interfaces:**
- Produces (ES5, works in mJS and browsers; all inside `// ==== LIB ====` markers):
  - `CFG_NUM`: array of `[field, default, min, max]` for `r 0.1 0.02 1.0`, `g 5 1 11`, `y 11 1 12`,
    `h 0.3 0.05 1.0`, `hr 0.05 0.01 0.5`, `hs 10 2 60`, `sg 600 60 3600`, `p 0 0 10`, `lo 1 0 1`,
    `lb 50 5 100`.
  - `cfgParse(text) -> cfg`: always returns a full object `{v:1, r,g,y,h,hr,hs,sg,p,cu,ds,df,lo,lb}`; null,
    bad JSON or non-object -> all defaults; each field out of range / wrong type -> its default; then if not
    `r < g < y`, all three -> defaults. Strings: `cu` 1-4 chars (default `EUR`), `ds` `.`|`,`, `df`
    `YMD`|`DMY`|`MDY`. Unknown fields dropped.
  - `cfgBad(obj) -> [field,...]`: fields of a raw object that `cfgParse` would replace (for the setup page).
  - `u8len(s) -> int`: UTF-8 byte length.
  - `cfgJson(cfg) -> string|null`: compact JSON of the fields that differ from the default plus `v`; null when
    `u8len` > 253.
  - `cfgDiff(a, b) -> [field,...]`: fields whose values differ.
- Produces in `tools/shelly.py`: a line `//@lib cfg_lib.js` inside a LIB region is replaced by the LIB region
  of `src/cfg_lib.js` (in `put`, `test`, `testpage`, and later in `build.py`); `/*@lib cfg_lib.js*/` is the
  same marker for HTML `<script>` blocks.

- [ ] **Step 1: Write `tests/cfg_test.js`** with at least:
  `cfg_defaults` (`cfgParse(null)` eq the full default object; `cfgParse("x")` same);
  `cfg_bad_range` (`cfgParse('{"r":5,"lb":3}')` gives `r` 0.1, `lb` 50, others default);
  `cfg_bad_order` (`{"g":12,"y":11}` -> r/g/y defaults); `cfg_bad_types` (`{"g":"7","cu":""}` -> defaults);
  `cfg_strings` (`{"cu":"€","ds":",","df":"DMY"}` kept; `{"cu":"EURO1"}` -> `EUR`);
  `cfg_utf8_len` (`u8len("€")` eq 3; `u8len("abc")` eq 3);
  `cfg_json_minimal` (`cfgJson(cfgParse(null))` eq `'{"v":1}'`; with `p:0.2` eq `'{"v":1,"p":0.2}'`);
  `cfg_json_limit` (a cfg whose JSON exceeds 253 B -> null; build it with all fields set to non-defaults and
  a 4-char `cu` of 4-byte characters if needed, otherwise assert the all-fields JSON is <= 253);
  `cfg_bad_list` (`cfgBad({"r":5,"g":3})` eq `["r"]`); `cfg_diff`.
- [ ] **Step 2: Add the `//@lib` include to `tools/shelly.py`** and a tiny wrapper so a test can target
  `src/cfg_lib.js` directly.
- [ ] **Step 3: Run** `python tools/shelly.py --ip <dev-ip> test src/cfg_lib.js tests/cfg_test.js` -> FAIL
  (functions not defined).
- [ ] **Step 4: Implement `src/cfg_lib.js`.** Keep it small (it is loaded into Meter's heap): table-driven,
  no closures per field.
- [ ] **Step 5: Run the device test again -> `0 failed`; run it in Edge too** with
  `python tools/shelly.py testpage src/cfg_lib.js tests/cfg_test.js` (testpage accepts a `.js` file: the LIB
  region is used as the PURE region) -> `0 failed`.
- [ ] **Step 6: Commit** `Add shared config library cfg_lib.js`.

### Task 3: Meter — config, 6 months, schema version, restart rule

**Files:**
- Modify: `src/meter.js`
- Create: `tests/meter_cfg_test.js`; modify `tests/session_test.js`, `tests/meter_review_test.js`,
  `tests/stamp_test.js`

**Interfaces:**
- Consumes: `cfgParse`, `CFG_NUM` (Task 2, via `//@lib cfg_lib.js` in Meter's LIB).
- Produces (LIB):
  - `sessTick(ss, up, gap)` (was `SESS_GAP` constant; `SESS_GAP` removed).
  - `isRealBoot(up, savedU) -> bool`: `true` when `savedU` is not a number, or `up < savedU`, or
    (`up < 120` and `savedU < 120`). Replaces `isRealBoot(up)`.
  - `migrate(st, fresh) -> {st, legacy}`: fresh state gets `sv: 1`; existing state with `sv` 1 unchanged;
    existing state without `sv` -> `legacy: true`, `sv` stays absent. Idempotent.
  - `pruneMax(st) -> int`: 6 when `st.sv >= 1`, 0 (never prune) otherwise. `MAX_MONTHS = 6`.
  - `ledCfg(cfg) -> {r,g,y,h,hr,hs,lo,lb}`.
- Produces (device): event `cc_cfg` with `ledCfg(cfg)` as data — emitted after a config change and in answer
  to `cc_cfgq`. New event lines in the `cc:ev` ring: `U,<stamp>,` (script restart without reboot) and
  `L,<stamp>,` (legacy state found, once per Meter start).
- `cc:state` gains `sv`; `stateJson` must still fit 253 B (existing test extended).

- [ ] **Step 1: Write the failing tests** in `tests/meter_cfg_test.js`:
  `boot_rule_real` (`isRealBoot(4, 200)` true; `isRealBoot(5, undefined)` true; `isRealBoot(4, 3)` true);
  `boot_rule_restart` (`isRealBoot(5000, 4000)` false; `isRealBoot(130, 90)` false);
  `migrate_fresh` (`migrate({}, true).st.sv` eq 1); `migrate_legacy` (`migrate({n:3}, false)` gives
  `legacy` true and no `sv`); `migrate_idempotent`; `prune_max` (6 / 0);
  `month_deletes_6` (`monthDeletes` with 7 month keys + their `cc:s:` keys and `MAX_MONTHS` 6 deletes exactly
  the oldest month and its session keys); `sess_gap_param` (`sessTick` closes at `gap`, not before; gap 60
  and 3600); `cfg_change_keeps_session` (an open `ss`, then a new `cfgParse` with other `g`/`sg`, then
  `sessTick(ss, up, newGap)` with `up - ss.g < newGap`: session still open, `ss.c` and `ss.x` unchanged);
  `led_cfg_fields`; `state_json_fits` (state with `sv` and maximal values <= 253).
  Update the existing tests that call `sessTick(ss, up)` / `isRealBoot(up)` to the new signatures.
- [ ] **Step 2: Run** the Meter test files on the dev plug -> new tests FAIL.
- [ ] **Step 3: Implement in `src/meter.js`.**
  - Start: read `cc:cfg` (deferred timer), keep `cfg` and its `etag`; each tick does `KVS.Get cc:cfg` and, when
    the etag differs, re-parses, sets the session gap, emits `cc_cfg`. Missing key (-105) = defaults.
  - Handle `cc_cfgq` -> emit `cc_cfg`.
  - `start`: decide boot vs restart with `isRealBoot(sys.uptime, st.u)`; on a real boot `newBoot` saves
    `cc:state` at once (so `u` is fresh); on a restart log `U` and keep `ss`, `n`, `nb`.
  - Run `migrate` after loading `cc:state`; log `L` when legacy; pass `pruneMax(st)` to `monthDeletes`.
- [ ] **Step 4: Run all Meter test files** (`meter`, `meter_review`, `stamp`, `session`, `session2`,
  `session3`, `event`, `meter_cfg`) -> `0 failed`.
- [ ] **Step 5: Device check.** `put` Meter, Led, Page (`--temp` off for Meter only), `put PageHtml
  src/page.html --store`; wait 2 min; `python tools/shelly.py --ip <dev-ip> rpc KVS.Set
  '{"key":"cc:cfg","value":"{\"v\":1,\"sg\":120}"}'`; within 60 s the Meter console shows the new gap
  (add one `print` line on config change). Restart Meter by `Script.Stop`/`Script.Start`: `cc:ev*` gains a `U`
  line, `cc:state.n` unchanged. Record `Sys.GetStatus.ram_free` with the 3 scripts running in `TODO.md`.
- [ ] **Step 6: Commit** `Meter reads cc:cfg, keeps 6 months, schema version, restart is not a boot`.

### Task 4: Led — thresholds and LED settings from config

**Files:**
- Modify: `src/led.js`, `tests/led_test.js`

**Interfaces:**
- Consumes: event `cc_cfg` data `{r,g,y,h,hr,hs,lo,lb}` (Task 3).
- Produces (LIB): `rawBand(a, on, c)`, `band(a, on, prev, c)`, `ledColour(b, noClock, c)`, `ledOff(noClock, c)`
  where `c` is the `cc_cfg` object; constants `RESIDUAL_A`, `GREEN_A`, `YELLOW_A`, `HYST_*`, `BRIGHTNESS`
  become the default object `LED_DEF` (same values). Hold time `HOLD_S` comes from `c.hs`.

- [ ] **Step 1: Update `tests/led_test.js`**: existing assertions pass `LED_DEF`; add `bands_custom` (with
  `{r:0.2,g:6,y:10,...}` a 6.0 A reading is band 2, 10.5 A band 3, 0.15 A band 0), `hyst_custom`,
  `brightness_cfg` (`ledColour(2,false,{...lb:20}).brightness` eq 20), `led_off_cfg` (`lo` 0: Led does one
  off write — test the pure decision `ledWrite(prevWritten, lo) -> "off"|"none"|"band"`).
- [ ] **Step 2: Run** `python tools/shelly.py --ip <dev-ip> test src/led.js tests/led_test.js` -> FAIL.
- [ ] **Step 3: Implement.** Led starts with `LED_DEF`, emits `cc_cfgq` on its first poll, replaces `c` on
  `cc_cfg` and re-applies the current band once (one flash write). With `lo` 0 it writes `leds.mode "off"`
  once and stops writing until `lo` returns to 1.
- [ ] **Step 4: Run** -> `0 failed`. Device check: set `lb` 20 in `cc:cfg`; within ~60 s the ring dims, the
  relay output is unchanged (`Switch.GetStatus`).
- [ ] **Step 5: Commit** `Led takes thresholds and LED settings from cc:cfg`.

### Task 5: Daily page in English, formats, toggle, mail template

**Files:**
- Modify: `src/page.html`, `src/page.js`, `tests/page_test.js`, `tests/page2_test.js`, `tests/page3_test.js`
- Create: `src/mail-default.json`, `tests/page_mail_test.js`

**Interfaces:**
- Consumes: `cfgParse` (Task 2, via `/*@lib cfg_lib.js*/` in the PURE region); `/rpc/KVS.Get?key=cc:cfg`;
  `MailTpl` read with `Script.GetCode` by name (same loop as the `ui` loader).
- Produces (PURE):
  - `fmtNum(x, dec, ds)`, `fmtDate(dayKey, df)` (`YMD` -> `2026-11-20`, `DMY` -> `20/11/2026`, `MDY` ->
    `11/20/2026`), `fmtCost(wh, cfg) -> string|""` (`""` when `cfg.p` is 0), `hasPrice(cfg)`.
  - `mailVars(ctx) -> {month_name, month, year, total_kwh, total_cost, currency, price, outside_kwh,
    session_count, sessions_table, device_name}`; `sessionsTable(sessions, cfg) -> string` (one line per
    session `date | kWh | cost`, cost column only with a price); `renderTpl(tpl, vars) -> string` (unknown
    placeholders left as they are).
  - `mailUrl(mt, subject, body) -> {url, copy}`: `mailto:` with `cc`/`bcc` when set; when the URL is over 1800
    characters, `url` carries the short body `"The report is on the clipboard: paste it here."` and `copy` holds
    the full body (the DOM copies it with `navigator.clipboard.writeText` first).
  - `csvText(days, months, sessions, events) -> string`: header `type,date,start,end,min,wh,kwh,cost,flags`
    / text column for events, ISO dates, `.` decimals, comma separator, CRLF, no BOM; file
    `chargelens-<YYYYMMDD>.csv`.
  - `relayIcon(sw) -> "on"|"off"|"cut"` (`cut` when `sw.errors` contains `overcurrent` or `overpower`).
  - `evText(line)` labels for `R`, `B`, `U` ("Script restarted (update)"), `L` ("Old data format found").
- `src/mail-default.json`: `{"v":1,"to":"","cc":"","bcc":"","subject":"Charging report | {month_name}
  {year}","body":"..."}` — English body: greeting, totals line, `{sessions_table}`, `Energy outside sessions:
  {outside_kwh} kWh`, request to confirm receipt, `Signature: replace this line`. No personal data.
- `page.js`: `data` reply adds `er` (`switch:0` `errors` array or `[]`); BOOT text English (`lang="en"`, title
  `ChargeLens`, "Loading..."); the BOOT loader loads `SetupHtml` when `location.search` has `p=setup`,
  else `PageHtml`. Endpoint count stays 5.

- [ ] **Step 1: Write `tests/page_mail_test.js`** and update the three page tests to English: `fmt_date_*`
  (three formats), `fmt_num_comma`, `cost_hidden_without_price` (`fmtCost(1000, cfgParse(null))` eq `""`),
  `cost_with_price` (`p` 0.2, 1500 Wh -> `"0.30"`), `tpl_render` (all 11 placeholders filled from a fixture,
  `{nope}` kept), `tpl_month_name` (`month_name` for `202611` with `navigator.language` forced to `en-US` is
  `November`), `sessions_table_no_price`, `mailto_cc_bcc`, `mailto_long` (a 60-session month gives `copy`
  non-empty and `url.length` < 1800), `csv_header_iso` (first line exact; a day row `day,2026-11-20,,,,1500,
  1.500,,`), `relay_icon_cut`, `ev_text_u`.
- [ ] **Step 2: Run** `python tools/shelly.py testpage src/page.html tests/page_mail_test.js` -> FAIL.
- [ ] **Step 3: Implement.** Translate every UI string (keep the v2.2 dark style and cards); remove `PRICES`,
  `MN`, `WD`, the old `mailText`, the pt-PT CSV; month names via `toLocaleString(navigator.language,
  {month:'long'})`. Relay control = toggle switch with a lightning icon (yellow on, grey off, red cut); off
  still asks to confirm; it calls `/rpc/Switch.Set?id=0&on=...` exactly as before. Add a "Setup" link to
  `ui?p=setup`.
- [ ] **Step 4: Run all page tests** (`page`, `page2`, `page3`, `page_mail`, `cfg_test` via testpage) ->
  `0 failed`.
- [ ] **Step 5: Device check on the dev plug:** `put` Page and `PageHtml`, write a `MailTpl` data script from
  `src/mail-default.json` (`put MailTpl src/mail-default.json --store`), open `http://<dev-ip>/script/<PageId>/ui`
  on a phone: English text, toggle shows state, mail opens with the template, CSV downloads.
- [ ] **Step 6: Commit** `Daily page in English with formats, relay toggle, mail template and CSV`.

### Task 6: Setup page — settings and save

**Files:**
- Create: `src/setup.html`, `tests/setup_test.js`

**Interfaces:**
- Consumes: `cfgParse`, `cfgBad`, `cfgJson`, `cfgDiff` (Task 2); `relayIcon` not needed.
- Produces (PURE):
  - `MODELS`: `{"SNPL-00112EU": {gen:2, maxA:12, maxW:2500}, "EF3PL-00112EU": {gen:3, maxA:12, maxW:2500}}`
    (shared copy with Task 10; keep the literal identical in both files, `tools/build.py` checks they match).
  - `validateForm(f, model) -> {cfg, native, errors:{field: message}}`: `cfgBad` rules plus `y < current_limit
    <= maxA`, `0 < power_limit <= maxW`, AP password >= 8 characters when the AP is enabled, `tz` non-empty.
  - `asciiJson(obj) -> string`: `JSON.stringify` with every char > 126 written as a JSON Unicode escape (built
    with `String.fromCharCode(92) + "u"` + 4 hex digits; surrogate pairs as two escapes).
  - `writePlan(oldState, newState) -> [{rpc, params, label}]`: only changed items, in this order: `KVS.Set
    cc:cfg`, `Script.PutCode MailTpl` (whole text, chunks of 4000, first without `append`), `Switch.SetConfig`
    (`current_limit`, `power_limit`), `PLUGS_UI.SetConfig controls["switch:0"].in_mode`, `Sys.SetConfig`
    (`location.tz`, `device.name`). Never `Switch.Set`.
- Sections 1-7 of spec 6.1 (Thresholds with band diagram and *Advanced*, Relay protection, Button, Price, Time
  with "Use this phone's time zone" and "Set clock from this phone", LED ring, Mail with the placeholder line).
  Save runs `writePlan` and shows each write's result; the page says changes are live within ~60 s.

- [ ] **Step 1: Write `tests/setup_test.js`:** `validate_ok_defaults`, `validate_y_vs_limit` (`y` 11,
  limit 11 -> error on `current_limit`), `validate_limit_max` (13 A on `SNPL-00112EU` -> error),
  `ascii_json_roundtrip` (`JSON.parse(asciiJson({s:"€ ação"}))` eq the original; every char code of the output
  <= 126), `write_plan_only_changed` (changing only `p` -> exactly one `KVS.Set`), `write_plan_never_switch_set`
  (a plan from defaults to all-changed contains no `Switch.Set`), `write_plan_mailtpl_chunks` (a 9000-char
  body -> 3 `PutCode` items, first without `append`), `cfg_too_long_refused` (`validateForm` with a cfg whose
  `cfgJson` is null -> error).
- [ ] **Step 2: Run** `python tools/shelly.py testpage src/setup.html tests/setup_test.js` -> FAIL.
- [ ] **Step 3: Implement `src/setup.html`** (same style as the daily page; reads current values with
  `KVS.Get cc:cfg`, `Script.GetCode MailTpl`, `Switch.GetConfig`, `PLUGS_UI.GetConfig`, `Sys.GetConfig`,
  `Shelly.GetDeviceInfo`).
- [ ] **Step 4: Run** -> `0 failed`. Check the minified size: `python tools/shelly.py put SetupHtml
  src/setup.html --store` reports bytes; must be < 60000.
- [ ] **Step 5: Device check:** change each field on the dev plug with a load idle; confirm each write's
  result is shown, the relay never toggles (`Switch.GetStatus.output` before/after), Meter and Led apply within
  60 s.
- [ ] **Step 6: Commit** `Setup page: settings with per-field validation and minimal writes`.

### Task 7: Setup page — device, access point, hardening, backup, about

**Files:**
- Modify: `src/setup.html`, `tests/setup_test.js`

**Interfaces:**
- Consumes: Task 6 functions.
- Produces (PURE):
  - `apSsid(mac) -> "chargelens-" + last 4 hex of the MAC, lowercase`.
  - `viaAp(locationHost) -> bool` (`192.168.33.1`).
  - `exportDoc(state, version, now) -> object`: `{app:"chargelens", fv:1, version, model, cfg, mail, native:
    {current_limit, power_limit, in_mode, tz, name, ap:{ssid, enable}, cloud, ble, mqtt}}`; no passwords.
    File name `chargelens-config-<device name or model>-<YYYYMMDD>.json`.
  - `importCheck(doc, model) -> {ok, errors:[...], changes:[{field, from, to}]}`: rejects `app` other than
    `chargelens`, `fv` other than 1, other model family max limits, out-of-range values (via `validateForm`);
    unknown fields ignored.
  - `hardenPlan(current, boxes) -> [{rpc, params}]` (`Cloud.SetConfig enable false`, `BLE.SetConfig enable
    false`, `MQTT.SetConfig enable false`, `in_mode detached`), only for checked boxes that differ.
- AP section (`WiFi.SetConfig {config:{ap:{ssid, pass, is_open:false, enable}}}`), warning + confirm when
  `viaAp`; hardening status with "Fix"; Export (download), Import (file input -> diff list -> apply through
  `writePlan`, never touches `cc:` energy keys); About (version from the Meter header line, firmware,
  `ram_free`, KVS use n/50 via paged `KVS.List`, docs link, *Check for updates* = `Script.Start Installer` then
  open `/script/<InstallerId>/install`).

- [ ] **Step 1: Add tests:** `ap_ssid`, `export_no_password`, `export_import_roundtrip` (export then
  `importCheck` on the same model -> `ok`, no changes), `import_wrong_app`, `import_out_of_range`,
  `import_other_fv`, `harden_plan_only_needed`.
- [ ] **Step 2: Run** -> FAIL. **Step 3: Implement.** **Step 4: Run** -> `0 failed`.
- [ ] **Step 5: Device check on the dev plug:** set an AP with WPA2 while on STA (STA stays up); export; change
  three settings; import the export; the three settings are back, `cc:m:*` unchanged.
- [ ] **Step 6: Commit** `Setup page: access point, hardening, export/import, about`.

### Task 8: Build, dist, releases, dev install, CI

**Files:**
- Create: `tools/build.py`, `tools/puretest.js`, `src/version.txt` (`1.0.0`), `.github/workflows/ci.yml`,
  `dist/*`, `library/manifest.json`, `library/chargelens-installer.js` (generated once Task 9 exists; until then
  the build skips the installer)
- Modify: `tools/shelly.py` (`install`, `serve`)

**Interfaces:**
- Produces: `python tools/build.py` writes:
  - `dist/Meter.js`, `dist/Led.js`, `dist/Page.js`, `dist/PageHtml.html`, `dist/SetupHtml.html`,
    `dist/MailTpl.json` (via the Python equivalent of `asciiJson`), `dist/installer.js`, `dist/install.html`.
    Each code/HTML file starts with a version header: `// ChargeLens <Name> vX.Y.Z` (JS) or
    `<!-- ChargeLens <Name> vX.Y.Z -->` (HTML). `MailTpl.json` has no header (user data, see Task 9).
  - `dist/release.json`: `{version, tag, repo, files:[{name, path, kind:"code"|"data", enable, size, crc32}]}`
    (`enable` true only for Meter; `crc32` = zlib CRC32 of the exact bytes).
  - `dist/latest.json`: `{version, tag, changelog:"https://github.com/pjrml/chargelens/blob/<tag>/CHANGELOG.md"}`.
  - `library/manifest.json`: `[{"fname":"chargelens-installer.js","title":"ChargeLens Installer",
    "description":"Installs or updates ChargeLens on this plug."}]` and `library/chargelens-installer.js`
    (copy of `dist/installer.js`).
  - Steps: `//@lib` / `/*@lib*/` includes, minify (port of `shelly.py minify`; HTML: drop comments and
    indentation, keep `<pre>`/strings), non-ASCII conversion, ASCII assertion, size assertions (scripts and
    data <= 60000 B; Meter+Led+Page code <= 20000 B total), `MODELS` literal identical in `setup.html` and
    `install.html`, `REPO`/`TAG` baked into `installer.js`.
  - `python tools/build.py --check`: builds into a temp dir and exits 1 if it differs from `dist/` / `library/`.
- Produces: `python tools/shelly.py --ip <ip> install [--dist dist]` (same writes as the installer: create
  missing scripts by name, PutCode chunks of 4000, read back length, `enable` only Meter, never overwrite an
  existing `MailTpl`, start Meter); `python tools/shelly.py serve [--port 8000]` serves the repo root with
  `Access-Control-Allow-Origin: *` (lets the install page run against local files: `?base=http://<pc-ip>:8000/`).
- Produces: `node tools/puretest.js <libfile> <testfile>`: same prelude as `TEST_PRELUDE`, runs LIB/PURE in
  Node, prints `N passed, M failed`, exit code 1 on failure (page tests that need `navigator`/DOM are skipped
  by a `t.browser` flag in the test).

- [ ] **Step 1: Write a failing build check:** run `python tools/build.py --check` with no `dist/` -> exit 1.
- [ ] **Step 2: Implement `tools/build.py`**; run it; assert with `python -c` that every byte in `dist/` is
  < 128 and `release.json` sizes match the files.
- [ ] **Step 3: Implement `tools/shelly.py install` and `serve`.** Install on the dev plug from `dist/`;
  expected: 6 scripts, only Meter enabled, Page answers `ui`, `ram_free` recorded in `TODO.md` (acceptance:
  not below ~10 KB).
- [ ] **Step 4: Write `tools/puretest.js` and `.github/workflows/ci.yml`** (Ubuntu, Python 3 + Node LTS:
  `python tools/build.py --check`, `python tools/check_private.py --generic-only`, `node tools/puretest.js` for
  every LIB/PURE test file). Run the Node tests locally if Node is installed; otherwise CI is their first run.
- [ ] **Step 5: Add the release checklist to `docs/development.md`** (spec B2: bump `src/version.txt` ->
  build -> commit -> tag `vX.Y.Z` -> push both; CI must be green).
- [ ] **Step 6: Commit** `Build, dist, release manifests, dev install and CI`.

### Task 9: Installer and install page

**Files:**
- Create: `src/installer.js`, `src/install.html`, `tests/install_test.js`
- Modify: `tools/build.py` (no longer skips the installer); rebuild `dist/`, `library/`

**Interfaces:**
- Consumes: `dist/release.json`, `dist/latest.json` (Task 8), `MODELS` (Task 6), `cfgJson(cfgParse(null))`.
- Produces `src/installer.js` (target < 3 KB): constants `REPO`, `TAG` (baked by the build); on start (deferred
  timer) renames itself to `Installer` with `Script.SetConfig` if its name differs (the Library names it
  `chargelens-installer.js`), registers endpoint `install`, prints `Open http://<sta_ip or 192.168.33.1>/script/
  <id>/install`. The endpoint returns a < 4 KB loader page that fetches `install.html` from
  `<base>dist/install.html` (`base` = `?base=` query or `https://raw.githubusercontent.com/<REPO>/<TAG>/`) and
  `document.write`s it, passing `REPO`, `TAG`, `base`.
- Produces (PURE in `install.html`):
  - `modelOf(devInfo) -> MODELS entry | null` (by `model`).
  - `fwUpToDate(checkResult) -> bool` (true only when there is no `stable` key; spike S1).
  - `planInstall(scripts, headers, release) -> {mode:"fresh"|"update"|"legacy"|"blocked", write:[name],
    create:[name], stop:[name], disable:[name], reason}`: `scripts` = `Script.List`, `headers` = first line of
    each ChargeLens-named script. Names of `release.files` present without a `ChargeLens` header -> `legacy`
    (stop, spec B3). Other user scripts running/enabled beyond the 3-slot budget -> listed in `stop`/`disable`
    (never deleted). `MailTpl` already present -> not in `write` (user data). Fewer than the needed free
    stored slots (10 total) -> `blocked`.
  - `idleOk(st, ss, current, cfg) -> bool`: false when `ss` (open session) is non-null or `current > cfg.r`
    (spec B4 rule a).
  - `crc32(str) -> uint32` (table-based, matches Python `zlib.crc32`).
  - `semverGt(a, b) -> bool`.
- Page flow (spec 7.2): gate (model, firmware up to date with the stepwise-update explanation, free slots) ->
  charger confirmation checkbox ("My charger is set to draw at most N A", N = `MODELS` max minus margin as
  stated in `docs/configuration.md`) -> plan shown, user confirms stops/disables -> download each file, check
  size + `crc32` -> update path: stop Led, Page, then Meter -> write (`PutCode` POST JSON, 4000-char chunks,
  read back length) -> set `enable` -> first install only: `KVS.Set cc:cfg` if missing (`{"v":1}`), `MailTpl`
  if missing, time zone from the phone, AP (WPA2 required) and hardening (Task 7 functions, copied PURE),
  button `detached`, optional "forget home Wi-Fi" (off by default, only after the AP has WPA2) -> start Meter
  -> wait until `Page` answers -> open `ui?p=setup`. Updates: fetch `main/dist/latest.json` first; if
  `semverGt(latest, TAG)`, show version + changelog link and reload the loader with that tag's `install.html`.

- [ ] **Step 1: Write `tests/install_test.js`:** `model_known_gen2`, `model_known_gen3`, `model_unknown`,
  `fw_up_to_date` (`{}` true; `{stable:{version:"1.7.7"}}` false), `plan_fresh` (empty list -> create all 6,
  MailTpl included), `plan_update_keeps_mailtpl`, `plan_update_order` (stop has Led, Page before Meter),
  `plan_legacy` (a `Meter` without header -> `legacy`), `plan_user_scripts` (2 running user scripts -> both in
  `stop`, none deleted), `plan_blocked_slots` (9 user scripts stored -> `blocked`), `idle_gate_session`,
  `idle_gate_current`, `crc32_known` (`crc32("123456789")` eq 3421780262), `semver`.
- [ ] **Step 2: Run** `python tools/shelly.py testpage src/install.html tests/install_test.js` -> FAIL.
- [ ] **Step 3: Implement `src/installer.js` and `src/install.html`**; rebuild.
- [ ] **Step 4: Run** -> `0 failed`; `python tools/build.py --check` clean.
- [ ] **Step 5: Device check, local base:** on the Gen2 plug (wiped first, backup outside the repo):
  `python tools/shelly.py serve`; put `dist/installer.js` as a script by hand (simulating the Library),
  start it, open `.../install?base=http://<pc-ip>:8000/` on a phone; fresh install completes and opens setup.
  Run it again: update path, `MailTpl` and `cc:cfg` unchanged, `cc:state.n` unchanged, `U` event logged.
  Start a test load above `r`: update refused. Confirm `Script.SetConfig` rename works on fw 1.7.x; if not,
  the docs tell the user to name the script `Installer` and the code stops renaming (record the result).
- [ ] **Step 6: Commit** `Installer script and install/update page`.

### Task 10: Documentation, logo, README

**Files:**
- Create: `docs/shelly-setup.md`, `docs/install.md`, `docs/install-manual.md`, `docs/configuration.md`,
  `docs/usage.md`, `docs/how-it-works.md`, `docs/security.md`, `docs/troubleshooting.md`, `CHANGELOG.md`,
  `docs/assets/logo.svg` (from the chosen draft)
- Modify: `src/page.html`, `src/setup.html` (icon)
- Modify: `README.md`, `docs/development.md`

- [ ] **Step 1: Write the docs** per spec section 8. Must contain: the charger requirement (maximum charger
  current for the supported plugs, a clear warning, the same N as the installer checkbox) in `README.md`,
  `docs/install.md` and `docs/configuration.md`; the firmware gate and stepwise updates (7.2) in
  `docs/shelly-setup.md`; cloud off = no Shelly app access from outside the plug's networks in
  `docs/security.md` and `docs/shelly-setup.md`; the security model (no device auth, WPA2 AP); KVS map and
  limits in `docs/how-it-works.md`; the Library URL path with screenshot placeholders (filled in Task 11);
  the manual path (7 scripts, exact names, only Meter on startup, raw links per file of the tag).
- [ ] **Step 2: Logo.** Drafts exist since 2026-11-20 (round 4: `docs/assets/logo-g1.svg`, `-g2`, `-g3`, `-d2l`; the owner
  chooses before this task, see `TODO.md`). The chosen one becomes `docs/assets/logo.svg` (drafts deleted), the
  README header image, and the home-screen / favicon icon of the daily and setup pages (inline data URI, ASCII;
  `apple-touch-icon` needs a PNG: render a 180 px PNG once and inline it as base64 if it stays under ~4 KB,
  otherwise use the SVG favicon only).
- [ ] **Step 3: README**: what/who/features/hardware/quick start/links, status updated, maintainer sections
  kept ("Secrets and where they live", "Recover on a new PC" with the baseline plugin install lines).
- [ ] **Step 4: Run** `python tools/check_private.py` -> no hits. **Commit** `User documentation and logo
  variants`.

### Task 11: Validation on both plugs and release

- [ ] **Step 1: Gen2 (second plug), from the docs only, on a phone:** factory reset -> `docs/shelly-setup.md`
  -> Library URL (needs the public repo or a temporary public copy: owner's call, see Notes) -> installer ->
  setup -> a real charge or a test load: sessions, LED colours, daily page, mail, CSV.
- [ ] **Step 2: Power-cut test** during a session (pull the plug for > 2 min): one `B` event, the session closed
  with flag `p`, energy before the cut kept; undated energy dated after the clock is set.
- [ ] **Step 3: Export -> factory reset -> install -> import** restores the configuration.
- [ ] **Step 4: Gen3 (dev plug):** fresh install from the Library URL, then an update from `v1.0.0-rc1` to
  `v1.0.0` (two tags) keeps log, config and `MailTpl`.
- [ ] **Step 5: Heap:** `ram_free` with the 3 scripts running >= the v2.2 level minus 1 KB (~10.7 KB on Gen2);
  record values in `docs/how-it-works.md`.
- [ ] **Step 6: Screenshots** into `docs/assets/` (phone + desktop), no personal data visible; fill the docs
  placeholders.
- [ ] **Step 7: Release `v1.0.0`** per `docs/development.md`; publishing the repo is the owner's call.

## Notes for the executor

- Tasks 1-8 need only the dev plugs and this PC. Task 9 runs against `tools/shelly.py serve`; the real GitHub
  path (Library URL, raw links by tag) is first exercised in Task 11, so the repo (or a temporary public copy)
  must be public by then — ask the owner.
- Heap is the main risk. Measure `ram_free` after Tasks 3, 4 and 8; if Meter + `cfg_lib` pushes below ~10 KB,
  first trim Meter's comments-free size (minify), then drop `cfgBad`/`cfgDiff` from the Meter build (they are
  page-only: split `cfg_lib.js` with a `// ==== PAGE ONLY ====` marker the build strips for scripts).
- Spec items intentionally not in v1: migration of a plug running the private build (spec 10.9), more
  hardware, tariff periods.
