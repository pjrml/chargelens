# Manual tests

Checks that need a person, a phone and a real plug. Automated tests (pure logic in Node and Edge, device tests)
are in [development.md](development.md). Run these before every release, and whenever the install flow or a page
changes visibly. Use a development plug only, never one you rely on.

Each test lists what to do (one action per step) and what you should see. Tick the box when it passes; note the
firmware version, the ChargeLens version and the date of the run in the commit or issue that records it.

## 1. Fresh install from the Library

Start: a plug with no scripts, no ChargeLens keys and no Library URL, already on Wi-Fi with up-to-date firmware
(the steps before the Library are in [shelly-setup.md](shelly-setup.md)). Follow [install.md](install.md) on a
phone, from Step 1.

- [ ] **1.1 Library.** The Library dialog shows *ChargeLens Installer* after **Save**; **Import code** opens the
      editor with `chargelens-installer.js`.
- [ ] **1.2 Save.** After **Save**, **Start** and **Delete** appear and the console says *Websocket debug logs are
      disabled* (as in the Step 2 screenshot).
- [ ] **1.3 Start without Enable.**
  1. Do not press **Enable**.
  2. Press **Start**.
  3. Watch the console for 10 seconds.

  Expected: the script turns the logs on by itself. Write down whether the address shows **without** a reload
  (then `docs/install.md` Step 2 must drop the reload step) or only after reloading the page.
- [ ] **1.4 Save after the rename.**
  1. Wait until the *Scripts* list (after a reload) shows `Installer`.
  2. Go back to the editor, which still shows `chargelens-installer.js`.
  3. Press **Save**.

  Write down whether the name goes back to `chargelens-installer.js` (then the docs must warn against it).
- [ ] **1.5 Address.** The address in the console opens the install page (no 404) and the page shows the version
      that was imported (the version in `main/dist/release.json`, e.g. `1.0.0-rc.1`).
- [ ] **1.6 Checks.** Tested model, firmware up to date, charger confirmation; **Install** stays disabled until the
      10 A box is ticked.
- [ ] **1.7 Hardening.** Cloud, Bluetooth, MQTT, button and *Turn the websocket debug logs off* are ticked by
      default (only the ones that are on are listed); *Forget the home Wi-Fi at the end (recommended)* is **not**
      ticked and stays disabled until an access point password of 8 or more characters is typed.
- [ ] **1.8 Progress.** After **Install**, a progress bar and *Working... keep this page open* show under the button
      and each progress line scrolls into view.
- [ ] **1.9 End.** *Installed* with a link; the setup page opens by itself after a few seconds.
- [ ] **1.10 Result.**
  1. Open the Shelly web UI.
  2. Press **Scripts**.

  Expected: `Meter`, `Led`, `Page` running, only `Meter` with run on startup; `Installer` stopped. In
  **Settings -> Debug**, *Websocket debug* is off.

## 2. Setup page

Open `http://<plug-ip>/script/<PageId>/ui?p=setup`.

- [ ] **2.1 Limits while typing.**
  1. Type `13` in *Current limit*.
  2. Type `11` in *Current limit*.
  3. Type `2600` in *Power limit*.
  4. Type `2300` in *Power limit*.

  Expected: 13 A and 2600 W show an error (above the 12 A / 2500 W rating) and **Save** refuses them; 11 A and
  2300 W show a warning (below the rating: the relay cuts earlier; under about 2400 W a 10 A charge can be cut).
- [ ] **2.2 Saved message.**
  1. Change one setting.
  2. Press **Save**.

  Expected: a green *Saved. Live within about a minute.* for about 5 seconds, then it disappears. A failed
  write keeps its error list on screen.
- [ ] **2.3 Hardening card.** It lists Cloud, Bluetooth, MQTT, websocket debug logs and the button, each either
      with a tick (off) or a box to turn it off. **Fix** turns the ticked ones off and the card reloads.
- [ ] **2.4 Wrong value.** A value out of range shows its message next to the field and nothing is saved.
- [ ] **2.5 Time zone.** *Use this phone's time zone* fills the field.
- [ ] **2.6 Writes listed.** While saving, each write is listed with its result.

## 3. Daily page

Open `http://<plug-ip>/script/<PageId>/ui` on a phone.

- [ ] **3.1 Language and state.** Everything in English; the relay toggle shows the real state (do not toggle
      under load).
- [ ] **3.2 Mail.** **Send the monthly report by mail** opens the mail app with the template.
- [ ] **3.3 CSV.** **Download CSV** downloads the file.
- [ ] **3.4 Home screen.** Add to Home Screen shows the ChargeLens icon.

## 4. Update

Needs two versions: the one on the plug and a newer one published on GitHub (a `vX.Y.Z-rc.N` test release; the
maintainer publishes it when the test is due). Start from a plug installed by test 1.

- [ ] **4.1 Newer version offered.**
  1. Open the setup page.
  2. Press **Check for updates** in *About*.

  Expected: `Led` and `Page` stop, the install page opens with the version that is installed and the new
  version (or *A newer version is available* with a *What changed* link and a button for it).
- [ ] **4.2 Refused while charging.**
  1. Plug in a load above the residual current (or start a charge).
  2. Press **Update**.

  Expected: *The plug is charging or a session is open*; nothing is written (the *About* version and the
  energy log are unchanged).
- [ ] **4.3 Same version.** Open the install page again after the update.

  Expected: *ChargeLens X is installed and up to date* with a check mark; the button says **Reinstall**; no
  *A newer version is available* row and no *newer than the version of this installer* error (fixed in rc.7: the
  update rewrites the `Installer`; its log ends with *Installer updated.* or *The installer is up to date.*).
- [ ] **4.4 Leave without changes.**
  1. Press **Leave without changes**.

  Expected: `Led` and `Page` run again and the daily page works.
- [ ] **4.5 Update when idle.**
  1. Unplug the load.
  2. Press **Check for updates** again.
  3. Press **Update**.

  Expected: progress, *Updated*, the daily page opens. Then check:
  - *About* on the daily page shows the new version and the access point address;
  - *About* on the setup page shows the new version;
  - the settings, the mail template and the energy history are unchanged;
  - *Events* on the daily page has a restart (`U`) event;
  - `Meter`, `Led`, `Page` run; `Installer` is stopped;
  - **Settings -> Debug** in the Shelly web UI: *Websocket debug* is off.
- [ ] **4.6 No downgrade.** Open the install page with `?tag=` set to an older published tag
      (`http://<plug-ip>/script/<InstallerId>/install?tag=vX.Y.Z-rc.N`). Expected: it refuses (*going back to an
      older version is not supported*) and changes nothing.

## 5. Release validation (plan Task 11)

Before `v1.0.0`, also: a real charge (sessions, LED colours, daily page, mail, CSV), the power-cut test, export ->
factory reset -> install -> import, and the heap figures. Details in
`docs/superpowers/plans/2026-11-20-chargelens-v1.md`, Task 11.
