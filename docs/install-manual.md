# Manual install

Use this if the Library step fails or you prefer not to run the installer. It creates the scripts by hand in the
plug's web UI. It is longer, but always works.

> **Status: in development.** No release exists yet (no `v1.0.0` tag). Replace `<tag>` below with a released tag
> once there is one.
>
> **Charger requirement.** Set the car or charger to draw **at most 10 A** first (the plug is rated 12 A).

Prerequisites as in [install.md](install.md): a supported plug, firmware up to date, and no other scripts running
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

For each script:

1. Web UI -> **Scripts** -> **Create script**, set the name from the table, open the raw link in another tab,
   select all, copy, paste into the editor, **Save**.
2. Only `Meter` gets **Run on startup**. Never start the data scripts (`PageHtml`, `SetupHtml`, `MailTpl`): they
   only hold text.
3. `Installer` is optional. Do not start it while `Meter`, `Led` and `Page` run (three scripts is the limit).

To check a script, compare its size with `dist/release.json` (it also lists a `crc32` for each file).

## Start

1. Start **Meter**. Within a few seconds it starts `Led` and `Page`; the Scripts list then shows three running.
2. Note the id of the `Page` script and open `http://<plug-ip>/script/<id>/ui`. The setup page is
   `http://<plug-ip>/script/<id>/ui?p=setup`.
3. On the setup page set the time zone, the thresholds and the access point. Without a saved configuration
   ChargeLens uses its defaults ([configuration.md](configuration.md)).
4. Hardening (cloud, Bluetooth, MQTT off, button does nothing) is on the setup page under *Hardening*.

## Updating by hand

Never while the plug is charging. Stop `Led`, `Page`, then `Meter`; replace the code of each script with the new
files; start `Meter`. The energy log lives in the plug's key-value store and is not touched. Keep `MailTpl` as it
is unless you want the default template back.

For developers: `tools/shelly.py install` does the same from a PC ([development.md](development.md)).
