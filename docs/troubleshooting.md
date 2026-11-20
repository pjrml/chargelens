# Troubleshooting

## Install

**The installer says the plug is not supported.** ChargeLens v1 accepts only the models it was tested on: the Shelly
Plus Plug S (Gen2) and Plug S Gen3 (including EcoFlow x Shelly). Other models are refused on purpose.

**"The firmware is not up to date."** Update first, step by step as in
[shelly-setup.md, section 3](shelly-setup.md#3-update-the-firmware-required). Updates come in steps, and right after
an update a new one can fail with "Not committed" (-109) for about 7 minutes.

**The library list is empty or the URL is rejected.** Check the URL
(`https://raw.githubusercontent.com/pjrml/chargelens/main/library/manifest.json`), that the plug has internet
(Settings -> Wi-Fi shows an IP and "connected"), and that the repository is public and has the file. Otherwise use
the [manual path](install-manual.md).

**The installer will not start ("too many scripts").** The plug runs at most 3 scripts at once.

- If ChargeLens is already installed: stop `Led`, then stop `Page`, then start `Installer`.
- Otherwise: stop another running script, then start `Installer`.

**The install page shows "Could not load the install page".** The browser needs internet (it downloads the page
from GitHub).

1. Check the browser's internet connection.
2. Reload the page. Or press **Back**: it restarts the stopped scripts.

**The page says scripts with the ChargeLens names exist but were not installed by this installer.** An older or
private build was found. Nothing was changed. Back it up and delete those scripts yourself, or use the
[manual path](install-manual.md).

**"The plug is charging or a session is open."** Updates restart the meter, so they wait until the car is
unplugged and no session is open.

**The install stops half-way.** The page says what was written. The energy log is not touched. If it says the
meter is stopped:

1. Start `Meter` in the web UI (*Scripts*), or unplug the plug and plug it in again (the meter starts at power-up).
2. Run the installer again.

## Daily use

**I cannot open the page.** Use the right address: `http://<plug-ip>/script/<PageId>/ui` (id of the `Page` script
in the Scripts list). Join the plug's access point or the network it is on. With the access point, the address is
`http://192.168.33.1/...`. Use `http`, not `https`.

**The page loads but shows nothing, or the Scripts list shows fewer than 3 running.** Open Scripts and make sure
`Meter`, `Led` and `Page` run. If not, start `Meter`: it starts the others. The plug may have been restarted by an
update that was interrupted.

**The ring is purple or orange.** The clock is unknown. Press *Set the clock from this phone* on the page
([usage.md](usage.md)).

**There are "Undated" charges.** The plug logged energy before it knew the date. Assign them on the page, or set the
clock in the same power-up next time.

**The relay is red / the plug cut itself off.** The current or power limit was exceeded.

1. Lower the current in the car or charger (at most 10 A).
2. Unplug the car.
3. Turn the relay on from the page.

**A setting is not saved.** The setup page shows the field that is wrong. The settings may not exceed 253 bytes
(shorten the currency label).

**I lost the access point password.** Open the setup page through the home Wi-Fi if the plug is still on it, or
factory-reset the plug (a long press of the button, about 10 s on most models; check Shelly's guide for your model) and install again. A factory reset erases the plug's
settings and scripts; the energy log is lost with it.

**The mail button does nothing or the body is empty.** Long reports are copied to the clipboard and a short mail
opens asking you to paste. Allow your browser to open the mail app. The CSV download is the alternative.

## Still stuck

Open a GitHub issue with the firmware version (setup page, *About*), what you did and what the page said. Leave out
IP addresses, Wi-Fi names and passwords.
