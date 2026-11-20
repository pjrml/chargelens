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
```

Other commands: `info`, `backup --out <dir>`, `rpc <Method> [json]`, `put <Name> <file> [--temp|--store]`,
`delscript <Name>`.

## Privacy check

```
python tools/check_private.py [paths...]
```

Exits 1 and prints `file:line: term` on any hit. Generic patterns: IPv4 other than `192.168.33.1` and
`0.0.0.0`, MAC addresses, e-mail addresses other than `@users.noreply.github.com` / `example.com`, a Portuguese
`lang` attribute, Windows user paths. Private terms come from `~/.config/chargelens/private-terms.txt`
(outside the repo, one per line, `#` comments, case-insensitive); a missing file is a warning. By default it scans
`git ls-files` plus untracked, non-ignored files. Run it before every commit, plus `git status --ignored`.
