# Development

Python 3.8+ (stdlib only) and, for the page tests, Microsoft Edge (looked up in both `Program Files` paths;
`--browser <path>` overrides). No Node needed.

## Tests

Pure logic lives between `// ==== LIB ====` / `// ==== END LIB ====` markers in the scripts and between
`/* ==== PURE ==== */` / `/* ==== END PURE ==== */` in `src/page.html`. Test files use `t(name, fn)`,
`eq(label, got, exp)` and `near(label, got, exp, tol)`. Write the failing test first.

Device tests (run on a development plug, never on a production plug; `<ip>` is passed, never committed):

```
python tools/shelly.py --ip <ip> test src/meter.js tests/meter_test.js
python tools/shelly.py --ip <ip> test src/meter.js tests/<name>_test.js   # meter_review, stamp, session, session2, session3, event
python tools/shelly.py --ip <ip> test src/led.js tests/led_test.js
```

The runner pauses `Led` and `Page`, uploads a temporary script `Test`, polls its results and deletes it.
Expected last line of each file: `N passed, 0 failed` (v2.2 counts: meter 49, meter_review 19, stamp 12,
session 23, session2 20, session3 14, event 9, led 53, cfg 54, meter_cfg 34; cfg runs as
`test src/cfg_lib.js tests/cfg_test.js`).

The dist code is mangled (see below), so before a release run the device tests both ways: plain and with
`--mangle` (also accepted by `put`), e.g. `python tools/shelly.py --ip <ip> test src/meter.js tests/meter_test.js --mangle`.

On a Plus Plug S Gen2 with ChargeLens installed (7 scripts) only ~4 KB of the 384 KB filesystem is free, so the
temporary `Test` script cannot be stored (`Script.PutCode` error -113 "Failed to write code"): run device tests
on a plug without ChargeLens, or remove the data scripts first. The Gen3 has ~300 KB free.

If a run stops with `out_of_memory` on a plug that was used for many test runs, the script heap is fragmented:
reboot the plug (`python tools/shelly.py --ip <ip> rpc Shelly.Reboot`) and run again.

Page tests (local, headless Edge, no device):

```
python tools/shelly.py testpage src/page.html tests/page_test.js   # page2, page3 as well
python tools/shelly.py testpage src/install.html tests/install_test.js
```

Other commands: `info`, `backup --out <dir>`, `rpc <Method> [json]`, `put <Name> <file> [--temp|--store]` (adds the
version header to ChargeLens script names, like the build),
`delscript <Name>`.

## Logo and icons

`docs/assets/logo.svg` is the source. `src/page.html` and `src/setup.html` carry it inline in `<head>` as an SVG
favicon (a `data:image/svg+xml` URI, ASCII, `#` written as `%23`) plus an `apple-touch-icon`: a 180 px PNG on the
dark page background, reduced to a 16-colour palette (about 1.2 KB, `docs/assets/icon-180.png`). To regenerate it,
render the logo at 180 px with headless Edge (`--screenshot`), quantize to 16 colours, base64 it into both pages
and run the build. iOS ignores SVG icons, which is why the PNG exists.

## Documentation

User docs are in `docs/*.md` (en-US, for non-developers) and are linked from `README.md`. **Every user action is its own
numbered item** (one click, one field, one choice per item; owner rule 2026-11-20): a sentence with two actions
gets one of them skipped. Screenshots live in
`docs/assets/screenshots/` and must not show personal data (addresses, Wi-Fi names, device locations, MAC
addresses: the Shelly web UI, the default AP name and the installer's SSID field all contain the MAC).
The current set was taken on the Gen2 dev plug (fw 1.7.6, 2026-11-20; the daily, setup-thresholds and install
screenshots retaken on the Gen3 dev plug for 1.0.0-rc.2) with headless Edge driven over the
DevTools protocol: phone viewport 390 px at 2x for the ChargeLens pages, 1280 px for the Shelly web UI; six
months of random energy and sessions written into the KVS with `Meter` stopped; the live power on the daily
page faked by rewriting the `data` response in the browser; the MAC (and the dev plug's address) replaced in
the DOM before each capture; the install page loaded with `?base=` on `main` (the developer-base notice
hidden, since no tag existed). For 1.0.0-rc.8 `setup-thresholds.png` and `install-checks.png` were retaken on the Gen3 with `tools/drive.py` steps `phone`, `js:` (hide the device name, the test-source notice, the AP name and the time zone) and `shot:`; the install page from `?base=` on `dev` with the ChargeLens scripts removed (first-install view). For 1.0.0-rc.10 `setup-mail.png`, `install-checks.png` (Gen3) and the new `daily-page-plugpm.png`, `setup-thresholds-plugpm.png` and `install-checks-plugpm.png` (Plug PM Gen3, with the six months of data of the Gen3 copied into its KVS, the live power faked by wrapping `fetch` for `data`, and the other cards hidden with `js:`) were taken the same way; check the time zone text (use `Europe/Berlin`, never the real one). Retake them when a page changes visibly. Document
what the code does. There is no fixed charger limit in the code: the installer and the setup page show the
relay protection values read from the plug (`Switch.GetConfig`), and the docs say "below the plug's relay
protection values" (`README.md`, `docs/install.md`, `docs/install-manual.md`, `docs/shelly-setup.md`,
`docs/configuration.md`).

## Privacy check

```
python tools/check_private.py [paths...]
```

Exits 1 and prints `file:line: term` on any hit. Generic patterns: IPv4 other than `192.168.33.1` and
`0.0.0.0`, MAC addresses, e-mail addresses other than `@users.noreply.github.com` / `example.com`, a Portuguese
`lang` attribute, Windows user paths. Private terms (one per line, `#` comments, case-insensitive) come from
the first file found of: `$CHARGELENS_PRIVATE_TERMS`, `private-terms.txt` in the folder that contains this
repo (the maintainer keeps this clone inside a private parent repo), `~/.config/chargelens/private-terms.txt`;
never inside this repo; no file is a warning. By default it scans `git ls-files` plus untracked, non-ignored
files. Run it before every commit, plus `git status --ignored`.

The pre-commit hook in `tools/hooks/` runs it on every commit; enable it once per clone with
`git config core.hooksPath tools/hooks`. CI runs it with `--generic-only`.

## Build, dist and releases

```
python tools/build.py            # src/ -> dist/ (+ library/ once src/installer.js exists)
python tools/build.py --check    # exit 1 if dist/ or library/ differ from a fresh build (CI runs this)
```

`dist/` is committed (devices read it through raw.githubusercontent.com). Each file starts with a version header
(`// ChargeLens <Name> vX.Y.Z`, or `<!-- ... -->` for HTML); the setup page reads the Meter version from that first
line. The build is deterministic (no timestamps), ASCII-only, asserts each file <= 60000 B and Meter+Led+Page
<= 29000 B (a ratchet; the real limit is the free script heap, measure it on a plug after any growth), and
bakes `REPO` (constant in `tools/build.py`) and the tag into `installer.js` (tokens `@REPO@`, `@TAG@`).
Scripts get the core of `cfg_lib` only, pages the full lib; `// ==== TEST ONLY ====` regions are stripped.
The build also mangles `Meter`, `Led` and `Page` (`mangle` in `tools/shelly.py`): it shortens every identifier the
script declares (functions, parameters, let/var/const, catch), never property names, object keys, strings or
builtins; names starting with `__` are kept. `Installer` is not mangled. Unit tests: `python tools/test_mangle.py`.

### Script heap rules

Heap is spent on declared functions, parameters, globals and live objects/strings, not on code size (see
`docs/how-it-works.md`). So:

- No status objects or tables in globals (e.g. a `Shelly.getComponentStatus` result costs ~1.2 KB); keep them local.
- Big literals (HTML, colour tables) go inside the function that uses them; a global string costs its length.
- Prefer fewer functions and fewer parameters; short names help (the build mangles them).
- Measure after any change with `Script.GetStatus` (`mem_used`, `mem_peak`, `mem_free`), after a reboot.

Install from a PC onto a development plug (same writes as the install page; never overwrites `MailTpl`; only
`Meter` enabled and started):

```
python tools/shelly.py --ip <ip> backup --out ~/.config/chargelens/backups/
python tools/shelly.py --ip <ip> install [--dist dist]
python tools/shelly.py serve [--port 8000]     # repo root with CORS, for the install page: ?base=http://<pc-ip>:8000/
```

Pure-logic tests in Node (what CI runs; no dependencies). Browser-only tests are registered with `tb()` and skipped:

```
node tools/puretest.js src/meter.js tests/meter_test.js     # see .github/workflows/ci.yml for every pair
```

Without Node installed, VS Code's bundled one works:
`ELECTRON_RUN_AS_NODE=1 "<VS Code>/Code.exe" tools/puretest.js <src> <test>`.

The `Installer` loader (in `src/installer.js`) fetches `dist/install.html` from `main` while `main/dist/release.json`
has its own tag, otherwise from its tag, and falls back to `main` when that tag has no `install.html` (a safety
net: every published version has its tag). An explicit `?tag=` or `?base=` never falls back; a failed load names
the URL. After an install or update, the install page rewrites the `Installer` script with the installed
release's `dist/installer.js` (only when it differs), so the loader's tag follows the installed version.

Manual checks with a phone and a plug (install, setup page, daily page, update): [manual-tests.md](manual-tests.md).

The update can also be run from a PC, through the plug's real pages in headless Edge (DevTools protocol, stdlib
only; Edge as for the page tests):

```
python tools/drive.py --ip <ip> update     # setup page -> Check for updates -> newest version if offered -> Update
python tools/drive.py --ip <ip> steps "open:/script/<PageId>/ui?p=setup" click:up "waiturl:/install:30" dump
```

`update` finds the `Page` script id, ticks the charger box and waits for *Open the daily page*; exit code 0 when
every step passed. `steps` takes any sequence (`open`, `click`, `click?`, `check`, `wait`, `waiturl`, `dump`,
`sleep`; `python tools/drive.py -h`). It changes the plug like a user would, so only on a dev plug: take a backup
first (`shelly.py backup`) and compare the KVS afterwards. Unit tests of the step parser:
`python tools/test_drive.py`.

### Versions and publishing (design B2)

Versions are semver, and **every build that reaches `main` has its own version number** (owner rule,
2026-11-20). Plugs install from `main`, and the installer compares version numbers to offer an update, to refuse a
downgrade and to tell an update from a reinstall, so two different builds must never share a number: a changed
comma or logo is a new version. Tags and the changelog describe a version; they do not replace the number.
Commits on `dev` between two publications need no number of their own.

- While a release is being validated: `X.Y.Z-rc.N`, tag `vX.Y.Z-rc.N`, GitHub pre-release. Every push to `main`
  takes the next `N`.
- The release: `X.Y.Z` (the last rc, unchanged, once [manual-tests.md](manual-tests.md) and the validation passed).
- After a release, the next publication is the next version's `-rc.1` (or a patch `X.Y.Z+1`).
- Precedence: `1.0.0-dev` < `1.0.0-rc.1` < `1.0.0-rc.2` < `1.0.0-rc.10` < `1.0.0`. The installer refuses to go
  back to an older version, so a plug on a newer number must be cleaned before an older build can be installed.

Publishing checklist (every rc and every release):

1. Everything committed on `dev`; device tests and page tests pass; `python tools/check_private.py` has no hits.
   For a release (not an rc), [manual-tests.md](manual-tests.md) also passed on a plug.
2. Set `src/version.txt` to the new number and move the `CHANGELOG.md` "Unreleased" items under it.
3. `python tools/build.py`; check `git diff dist/` (version headers, sizes in `dist/release.json`).
4. Screenshots: retake every screenshot in `docs/assets/screenshots/` whose page changed visibly since the last
   publication (header, wording, layout, icons; method under [Documentation](#documentation)), so the docs on
   `main` always show what a plug installed from `main` shows.
5. Commit on `dev`: `Release vX.Y.Z[-rc.N]`; push `dev`.
6. Fast-forward `main` to it: `git push origin dev:main`.
7. Tag that commit and push the tag: `git tag vX.Y.Z[-rc.N]` and `git push origin vX.Y.Z[-rc.N]`.
8. GitHub release from the tag with the changelog entry (`gh release create vX.Y.Z-rc.N --prerelease` for an rc).
9. CI must be green on both (dist up to date, privacy check, Node tests). Installers read every file from their
   baked tag, so never move or re-create a pushed tag.
