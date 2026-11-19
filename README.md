# ChargeLens

Offline energy logger for charging an electric car from a socket someone else pays for (a condominium, an
employer, a landlord, family). ChargeLens runs as scripts on a **Shelly Plus Plug S**: it keeps daily and
monthly totals and charging sessions on the plug itself (no cloud, no hub, no internet needed, survives power
cuts), shows them on a phone page served by the plug, and prepares a monthly report by e-mail or CSV.

> **Status: in design.** Nothing to install yet. Design:
> [docs/superpowers/specs/2026-11-19-chargelens-design.md](docs/superpowers/specs/2026-11-19-chargelens-design.md).

## Why it exists

I charge my car from a shared socket and have to report, every month, how much energy I used so it can be
billed fairly. I could not find a ready-made solution that works offline, at a socket with no Wi-Fi, without a
cloud account or a home-automation hub. So I built one on a Shelly plug for my own use. It solved the problem
well, so I decided to share it: ChargeLens is that private build, made configurable and documented for anyone.

## How it was built

The code was developed with [Claude](https://claude.com/claude-code) (Anthropic's AI coding assistant), under my
supervision: I specified it, reviewed the design decisions, and tested it in production on my own car charging
before publishing. Tests run on real devices and in a headless browser (see `docs/development.md` once
available).

## Planned features (v1)

- Energy per day and month (6 months kept on the plug), charging sessions, relay/boot events.
- Status LED ring: idle, low current, charging, high current, clock unknown.
- Phone page from the plug's own Wi-Fi access point; relay toggle; setup page with export/import.
- Monthly report by e-mail (editable template) and CSV download.
- Install from the browser through the Shelly web UI "Library" (no PC needed), or manually.

## Supported hardware

v1: Shelly Plus Plug S (Gen2), including rebranded variants that run Shelly firmware. Other Shelly devices with
metering may follow (see `TODO.md`).

## Layout

| Path | What |
|---|---|
| `CLAUDE.md` | Working rules for Claude Code in this repo |
| `TODO.md` | Pending work and change log (`Done`) |
| `_chargelens.code-workspace` | VS Code workspace |
| `docs/superpowers/specs/` | Designs |
| `docs/superpowers/plans/` | Implementation plans |
| `src/`, `tests/`, `tools/`, `dist/`, `library/` | Planned (see the design, section 5.5) |

## License

MIT, see [LICENSE](LICENSE).

---

## Maintainer notes

### Secrets and where they live

Secrets are never stored in the repo.

| Secret | Location (outside the repo) | How to recreate |
|---|---|---|
| none | | The plugs have no device auth by design; Wi-Fi/AP passwords are set on the device and never stored here. |

Device backups and configuration exports hold personal data: keep them outside the repo (they are also
git-ignored as a safety net).

### Recover on a new PC

1. **Tools:** Git, VS Code with the Claude Code extension, Python 3.8+ (stdlib only), Microsoft Edge or Chrome
   (headless page tests), GitHub CLI (`gh`).
2. **Clone** outside any cloud-synced folder:
   `git clone https://github.com/pjrml/chargelens.git "$env:USERPROFILE\Projects\chargelens"`, then set the
   identity used for this repo: `git config user.name pjrml` and
   `git config user.email 25982611+pjrml@users.noreply.github.com`; `gh auth login`.
3. **Open** `_chargelens.code-workspace` and **trust** the folder (Claude Code does not start in Restricted Mode).
4. **Claude Code plugins:** the maintainer's baseline plugin (installed as described in the maintainer's private
   notes) and `superpowers` (official marketplace) for the design/plan workflow.
5. **Environment:** `python -m venv .venv` (no packages needed so far).
6. **Secrets:** none.
7. **Verify:** TODO (after the port: `python tools/build.py` and a device test against the dev plug).
8. **Not recovered, by design:** Claude Code session history and memory (rules are in `CLAUDE.md`, state in
   `TODO.md`). Start the first session with "read `TODO.md`".
