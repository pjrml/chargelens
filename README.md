<p align="center"><img src="docs/assets/logo.svg" alt="ChargeLens logo" width="120"></p>

# ChargeLens

<p align="center"><img src="docs/assets/disclaimer.svg" alt="USE AT YOUR OWN RISK. No warranty and no liability of any kind. You alone are responsible for the plug, the charger, the socket and this software." width="880"></p>

> [!CAUTION]
> **Use at your own risk, now and in every future version.** ChargeLens is provided "as is", without warranty of
> any kind, express or implied ([MIT License](LICENSE)). The author accepts no responsibility or liability, express
> or implied, for any damage, injury, fire, loss of data, wrong readings or wrong bills that may result from using
> the plug, the charger, the socket or this software. Charging a car draws high current for hours: check the
> ratings of everything involved and follow the charger and plug manufacturers' instructions. "Tested hardware"
> below lists the models ChargeLens was tested on; it is not a statement or guarantee that using them is safe.

> **Status: in development.** ChargeLens is not released yet (no `v1.0.0` tag). The install instructions point to
> releases that do not exist yet; do not use it on a plug you rely on.

Offline energy logger for charging an electric car from a socket someone else pays for (a condominium, an
employer, a landlord, family). ChargeLens runs as scripts on a **Shelly Plus Plug S**: it keeps daily and monthly
totals and charging sessions on the plug itself (no cloud, no hub, no internet needed, survives power cuts), shows
them on a phone page served by the plug, and prepares a monthly report by e-mail or CSV.

<p align="center"><img src="docs/assets/screenshots/daily-page.png" alt="ChargeLens daily page on a phone: power now, relay, today, month and history" width="300"></p>

<p align="center"><sub>Example data: the numbers in the screenshots are random.</sub></p>

## Why it exists

I charge my car from a shared socket and have to report, every month, how much energy I used so it can be billed
fairly. I could not find a ready-made solution that works offline, at a socket with no Wi-Fi, without a cloud
account or a home-automation hub. So I built one on a Shelly plug for my own use (a private build). It solved the
problem well, so I decided to share it: ChargeLens is that build, made configurable and documented for anyone.

## How it was built

The code was developed with [Claude](https://claude.com/claude-code) (Anthropic's AI coding assistant), under my
supervision: I specified it, reviewed the design decisions, and tested the private build in production on my own
car charging before publishing. Tests run on real devices and in a headless browser
([docs/development.md](docs/development.md)).

## Features

- Energy per day and month (6 months kept on the plug), charging sessions, relay/boot events.
- Status LED ring: idle, low current, charging, high current, clock unknown.
- Phone page from the plug's own Wi-Fi access point; relay toggle; setup page with export/import.
- Monthly report by e-mail (editable template) and CSV download.
- Install from the browser through the Shelly web UI "Library" (no PC needed), or manually.
- English UI. No cloud, no account, no hub.

## Tested hardware

ChargeLens was developed and tested on the Shelly **Plus Plug S** (Gen2) and the Shelly **Plug S Gen3**,
including rebranded variants that run Shelly firmware (e.g. EcoFlow x Shelly). The installer accepts only these
models. "Tested" means only that the software was tested on them; it is no warranty of any kind, in particular
not about safety (see the caution at the top). Other Shelly devices with metering may follow.

> **Charger requirement: at most 10 A.** These plugs are rated 12 A / 2500 W. Set your car or charger to draw **no
> more than 10 A**. A charger that draws more can overheat the plug or the socket. The installer asks you to
> confirm it. See [docs/configuration.md](docs/configuration.md).

> **Use a plug dedicated to ChargeLens.** We recommend that the plug runs **no other scripts**. ChargeLens needs
> all 3 running script slots and most of the plug's small script memory (about 25 KB shared), and it was tested
> only on plugs without other scripts. Other scripts can make it run out of memory, miss readings or fail to
> start, and problems on such a plug cannot be reproduced or investigated. Details:
> [docs/how-it-works.md](docs/how-it-works.md).

## Quick start

1. Set the charger to at most 10 A, power the plug, join it to your Wi-Fi and update its firmware:
   [docs/shelly-setup.md](docs/shelly-setup.md).
2. In the plug's web UI add the Library URL
   `https://raw.githubusercontent.com/pjrml/chargelens/main/library/manifest.json`, start the *ChargeLens
   Installer* script and open its install page: [docs/install.md](docs/install.md) (or the
   [manual path](docs/install-manual.md)).
3. Open the setup page and set your thresholds, price and mail: [docs/configuration.md](docs/configuration.md).
4. Use it: [docs/usage.md](docs/usage.md).

## Documentation

| Document | What |
|---|---|
| [docs/shelly-setup.md](docs/shelly-setup.md) | Unbox, Wi-Fi, firmware (stepwise updates), recommended settings |
| [docs/install.md](docs/install.md) | Install and update from the browser (Library URL) |
| [docs/install-manual.md](docs/install-manual.md) | Install by hand, script by script |
| [docs/configuration.md](docs/configuration.md) | Every setup field, choosing thresholds, mail placeholders |
| [docs/usage.md](docs/usage.md) | Daily routine, undated charges, monthly report |
| [docs/security.md](docs/security.md) | No device login: what that means and how to stay safe |
| [docs/troubleshooting.md](docs/troubleshooting.md) | Common problems |
| [docs/how-it-works.md](docs/how-it-works.md) | Scripts, key-value map, clock, limits |
| [docs/development.md](docs/development.md) | Build, tests, release checklist |
| [CHANGELOG.md](CHANGELOG.md) | Changes |

## Layout

| Path | What |
|---|---|
| `src/` | Script and page sources |
| `tests/` | Device tests and page tests |
| `tools/` | Build and dev CLI (Python stdlib only), privacy check |
| `dist/` | Committed build output (devices read it through raw.githubusercontent.com) |
| `library/` | Shelly Library URL manifest |
| `docs/` | User and developer docs; `docs/assets/` logo and screenshots; `docs/superpowers/` design and plans |

## License

MIT, see [LICENSE](LICENSE).
