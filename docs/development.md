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
session 23, session2 20, session3 14, event 9, led 32).

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

User docs are in `docs/*.md` (en-US, for non-developers) and are linked from `README.md`. Screenshots live in
`docs/assets/screenshots/` and must not show personal data (addresses, Wi-Fi names, device locations). Document
what the code does; the charger limit (10 A) must match `CHARGER_A` in `src/install.html` in `README.md`,
`docs/install.md`, `docs/install-manual.md`, `docs/shelly-setup.md` and `docs/configuration.md`.

## Privacy check

```
python tools/check_private.py [paths...]
```

Exits 1 and prints `file:line: term` on any hit. Generic patterns: IPv4 other than `192.168.33.1` and
`0.0.0.0`, MAC addresses, e-mail addresses other than `@users.noreply.github.com` / `example.com`, a Portuguese
`lang` attribute, Windows user paths. Private terms come from `~/.config/chargelens/private-terms.txt`
(outside the repo, one per line, `#` comments, case-insensitive); a missing file is a warning. By default it scans
`git ls-files` plus untracked, non-ignored files. Run it before every commit, plus `git status --ignored`.

## Build, dist and releases

```
python tools/build.py            # src/ -> dist/ (+ library/ once src/installer.js exists)
python tools/build.py --check    # exit 1 if dist/ or library/ differ from a fresh build (CI runs this)
```

`dist/` is committed (devices read it through raw.githubusercontent.com). Each file starts with a version header
(`// ChargeLens <Name> vX.Y.Z`, or `<!-- ... -->` for HTML); the setup page reads the Meter version from that first
line. The build is deterministic (no timestamps), ASCII-only, asserts each file <= 60000 B and Meter+Led+Page
<= 33000 B (a ratchet; the real limit is the free script heap, measure it on a plug after any growth), and
bakes `REPO` (constant in `tools/build.py`) and the tag into `installer.js` (tokens `@REPO@`, `@TAG@`).
Scripts get the core of `cfg_lib` only, pages the full lib; `// ==== TEST ONLY ====` regions are stripped.

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

### Release checklist (design B2)

1. Everything committed; device tests and page tests pass; `python tools/check_private.py` has no hits.
2. Bump `src/version.txt` (`X.Y.Z`) and add the `CHANGELOG.md` entry.
3. `python tools/build.py`; check `git diff dist/` (version headers, sizes in `dist/release.json`).
4. Commit on `main`: `Release vX.Y.Z`.
5. Tag `vX.Y.Z` on that commit; push `main` and the tag together (`git push origin main vX.Y.Z`).
6. CI must be green on both (dist up to date, privacy check, Node tests). Installers read every file from their
   baked tag, so never move or re-create a pushed tag.
