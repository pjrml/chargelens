# Manual install

Use this if the Library step fails or you prefer not to run the installer. It creates the scripts by hand in the
plug's web UI. It is longer, but always works.

> **Status: release candidate.** There is no final `v1.0.0` yet. Replace `<tag>` below with the newest tag on the
> GitHub *Releases* page (a release candidate, `v1.0.0-rc.N`).
>
> **Charger requirement.** Limit the car or charger **below the plug's relay protection values** first (the plug
> is rated 12 A / 2500 W). Read them in the Shelly web UI (Output protections); the setup page shows them too,
> after the install.

**Plug PM Gen3:** use the files in `dist/plugpmg3/` (same names; the `Installer` stays in `dist/`) instead of `dist/`; the raw link pattern becomes
`https://raw.githubusercontent.com/pjrml/chargelens/<tag>/dist/plugpmg3/<file>`. That plug has no relay and cannot
cut the load.

Prerequisites as in [install.md](install.md): a tested plug model, firmware up to date, and no other scripts running
(the plug runs at most 3 at once).

## The scripts

Create **seven** scripts with exactly these names (the code finds them by name) and paste the contents of the
file from the tag you install. Raw link pattern:
`https://raw.githubusercontent.com/pjrml/chargelens/<tag>/dist/<file>`

| Script name | File in `dist/` | Run on startup | Started |
|---|---|---|---|
| `Meter` | `Meter.js` | **yes** | yes (it starts the next two) |
| `Led` | `Led.js` | no | by Meter |
| `Page` | `Page.js` | no | by Meter |
| `PageHtml` | `PageHtml.html` | no | never (data) |
| `SetupHtml` | `SetupHtml.html` | no | never (data) |
| `MailTpl` | `MailTpl.json` | no | never (data) |
| `Installer` (optional) | `installer.js` | no | only to update |

For each script in the table:

1. Open `http://<plug-ip>` in the browser.
2. Press **Scripts** in the menu.
3. Press **Create script**.
4. Type the script name from the table in *Script name*.
5. Open the raw link of its file in another browser tab.
6. Select all the text in that tab.
7. Copy it.
8. Go back to the script editor and paste it.
9. Press **Save**.

Then:

1. In the *Scripts* list, turn on **Run on startup** (the *enable* switch) for `Meter` only.
2. Leave the data scripts (`PageHtml`, `SetupHtml`, `MailTpl`) stopped: they only hold text and must never run.
3. Leave `Installer` stopped. Do not start it while `Meter`, `Led` and `Page` run (three scripts is the limit).

`dist/install.html` is not a script on the plug: the `Installer` script fetches that page from GitHub every time
it runs, and the installer page never stores it. The manual install and `tools/shelly.py install` skip it too.

To check a script, compare its size with `dist/release.json` (it also lists a `crc32` for each file).

## Start

1. In the *Scripts* list, press **Start** for `Meter`. Within a few seconds it starts `Led` and `Page`; the list
   then shows three running.
2. Note the id of the `Page` script (shown as `script:<id>`).
3. Open the setup page: `http://<plug-ip>/script/<id>/ui?p=setup`.
4. Set your settings there ([configuration.md](configuration.md)). Without a saved configuration ChargeLens uses
   its defaults.
5. In *Hardening* on the same page, press **Fix** (cloud, Bluetooth, MQTT and websocket debug logs off, button
   does nothing).

The daily page is `http://<plug-ip>/script/<id>/ui`.

## Updating by hand

Never while the plug is charging. The energy log lives in the plug's key-value store and is not touched.

1. Stop `Led`.
2. Stop `Page`.
3. Stop `Meter`.
4. Replace the code of each script with the new file (as in *The scripts*, steps 5 to 9). Keep `MailTpl` as it is
   unless you want the default template back.
5. Start `Meter`. It starts `Led` and `Page`.

For developers: `tools/shelly.py install` does the same from a PC ([development.md](development.md)).
