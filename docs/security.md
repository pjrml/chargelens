# Security model

ChargeLens runs on a plug that you place in a socket you do not own, so it is built to need no cloud account and no
internet. It also has **no login**. Read this before you decide where to connect the plug.

## No device authentication

Shelly Gen2 and Gen3 plugs can protect their web interface with a password (HTTP digest with SHA-256), but browsers
do not implement that scheme, so the ChargeLens pages could not call the plug. ChargeLens therefore cannot use
device authentication. **Anyone who can reach the plug on the network can:**

- open the daily and setup pages, read the energy log, switch the relay on and off, change every setting and the
  mail template (which may hold a recipient address);
- use any Shelly RPC call: stop or replace scripts, erase the log, change Wi-Fi, reset the plug.

The pages are served over plain HTTP, so anything on the same network can also read the traffic.

## What protects you

- The plug's **own access point** with a **WPA2 password** (at least 8 characters, required by the installer and
  setup page). Only people who know it can join. Pick a strong one and do not reuse another password.
- **Keeping the plug off untrusted networks.** Join it to a network only if everyone on it is trusted (your home
  network, at most). Do not put it on a guest or shared Wi-Fi, and never forward a port to it from the internet.
- The installer's optional **Forget the home Wi-Fi** step: with no network to join, nobody on that network can reach
  the setup page; you connect through the access point. The cost: no internet clock, and the next update needs the
  plug joined to a Wi-Fi with internet again.

## Hardening the installer offers (all on by default)

| Item | Why | What you lose |
|---|---|---|
| Shelly cloud off | the plug is not reachable from outside | **No Shelly app access from outside the plug's networks.** Only devices on its Wi-Fi network or access point can reach it. |
| Bluetooth off | removes a second way to reconfigure the plug | Shelly app Bluetooth setup. |
| MQTT off | not needed | MQTT integrations. |
| Button does nothing | a press cannot switch the relay by accident | The plug's button no longer toggles the relay (the page's relay toggle still does). |

You can change them any time on the setup page, under *Hardening*.

## Privacy

- Data stays on the plug. ChargeLens sends nothing anywhere; the installer only downloads files from GitHub.
- The install page asks the browser to load `raw.githubusercontent.com`. Only use a `?base=` developer address you
  started yourself; the page asks for confirmation.
- Exports of your configuration contain personal data (mail recipients): keep them private.

## Reporting a problem

Open an issue on the GitHub repository. Do not post device addresses, Wi-Fi names or passwords.
