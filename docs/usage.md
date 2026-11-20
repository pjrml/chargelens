# Daily use

## The routine

1. Plug the charger's cable into the ChargeLens plug and the plug into the socket. The ring shows the state (see
   [configuration.md](configuration.md#led-ring)).
2. Start charging. The plug counts the energy; a session starts when the current is above the minimum charging
   current and ends when it has been below it for the session gap (10 minutes by default).
3. When you want the numbers, connect your phone to the plug (its access point, or the Wi-Fi it is on) and open
   `http://<plug-ip>/script/<PageId>/ui`. With the access point the address is
   `http://192.168.33.1/script/<PageId>/ui`.
4. On the phone, **add the page to the home screen** (share menu -> Add to Home Screen). It then opens like an
   app, with the ChargeLens icon.

The plug keeps working with no phone connected and with no internet. Power cuts do not lose the totals.

## The daily page

- **Now** (current power), **Relay** (a switch with a lightning icon: yellow on, grey off, red when the plug cut
  itself off for overcurrent or overpower), **Today** and the **Month** total, in kWh and (with a price) in
  money.
- **History**: the months kept on the plug (six).
- **Sessions** of the chosen month, with start, duration, energy and cost.
- **Send the monthly report by mail** and **Download CSV** for the chosen month.
- **Events**: relay changes with their source, boots, script restarts (updates).
- **Set the clock from this phone** and the **Setup** link at the top.

Turning the relay off from the page asks for confirmation, because charging stops. Nothing else on any page
switches the relay.

## The clock and undated charges

The plug has no battery-backed clock. It gets the time from the internet (only when it is online) or from your
phone. Until the time is known the ring shows purple/orange. Energy used in that time is not lost: it is kept
against the plug's uptime and shown as **Undated** charges.

- If you set the clock (button on the page) in the same power-up, the charges are dated automatically.
- Otherwise they stay undated until you assign them. In the **Undated** card pick the charge(s) and the day
  (the page offers the days between the last known date before and the next one) and press **Assign**.

To avoid undated charges, open the page after a power-up, before or during the first charge, and press *Set the
clock from this phone* (or leave the plug on a Wi-Fi with internet).

## The monthly report

1. Choose the month in the list.
2. **Send the monthly report by mail** opens your mail app with the template from the setup page (recipients,
   subject, body with the sessions table). If the report is too long for a mail link, the page copies the body to
   the clipboard and opens a short mail asking you to paste it.
3. **Download CSV** saves a machine-friendly file (ISO dates, `.` decimals; types `day`, `month`, `session`,
   `event`) to attach or open in a spreadsheet.

## Travelling or unplugging

Unplug the plug and the charger as you like; the log stays on the plug. If the plug stays unplugged for a long
time the clock will be unknown at the next power-up: set it from your phone. Do not update ChargeLens while a
charge is running; the installer refuses.
