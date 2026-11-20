# Shelly setup

What to do with a new plug before installing ChargeLens. You need the plug, a phone or computer, and (once, for the
install) a Wi-Fi network with internet access.

> **Charger requirement.** The plug is rated 12 A / 2500 W. Set your car or charger to draw **at most 10 A**
> before you plug it in. A charger that draws more can overheat the plug or the socket. The installer asks you
> to confirm this.

Tested models: Shelly **Plus Plug S** (Gen2, `SNPL-00112EU`) and Shelly **Plug S Gen3**, including rebranded variants
that run Shelly firmware (for example EcoFlow x Shelly, `EF3PL-00112EU`). Anything else is refused by the
installer. "Tested" is no warranty of any kind, in particular not about safety: you use ChargeLens at your own
risk (see the [README](../README.md)).

> **Use a plug dedicated to ChargeLens.** We recommend that the plug runs **no other scripts**: ChargeLens needs
> all 3 running script slots and most of the script memory, and it was tested only on plugs without other
> scripts. A new or freshly reset plug is the best start. See the [README](../README.md).

## 1. Power it and join its own network

Menu names and labels vary by firmware version; the paths below are a guide.

1. Plug it into a mains socket. A new plug starts its own Wi-Fi access point (a name like `ShellyPlusPlugS-XXXXXX`
   or `ShellyPlugSG3-XXXXXX`), open, without a password.
2. Connect your phone or computer to that network and open `http://192.168.33.1`. This is the plug's web UI.

## 2. Join the plug to your Wi-Fi (once, for the install)

ChargeLens itself works offline, but the installer downloads the scripts from GitHub, so for the install your
browser needs internet, and so does the plug for firmware updates. Use a Wi-Fi network you control (your home
router, or a phone hotspot).

1. **Be quick.** On a new or freshly reset plug the web UI shows a red banner *"Secure your device by connecting
   to Wi-Fi. Set an Access Point password to keep it available"* with a countdown (*Time left*, a few
   minutes). Join the plug to your Wi-Fi before it reaches zero: when the timer runs out, the plug turns off
   its open access point. If the plug is already on your Wi-Fi, just continue there (step 4). If not, unplug
   the plug, plug it in again, reconnect to its access point and start this section again.
2. Open **Settings -> Wi-Fi** (under *Network settings*). In *Wi-Fi 1 settings* the **Enable Wi-Fi** switch is
   greyed out (*"You need to set network name before enabling this Wi-Fi!"*); that is expected:
   1. Press the **arrow** next to *Network* to open *Available networks* (use *Scan for networks* if yours is
      not listed) and pick your network.
   2. Type the Wi-Fi password and press **Save settings**. **Enable Wi-Fi** turns on by itself and *Wi-Fi status*
      shows *Connected* with the plug's new IPv4 address.

   The **Configure Wi-Fi** button in the banner is not needed (on Plus Plug S firmware 1.7.6 it did nothing).

   <img src="assets/screenshots/shelly-wifi.png" alt="Shelly web UI: Wi-Fi 1 settings with Enable Wi-Fi, network and password" width="560">

3. The banner changes to *"Network connected! Set an Access Point password to keep it available. For your
   security, Bluetooth RPC access and unprotected Access Point will be disabled automatically in 5 minutes."*
   You can ignore it: when that timer runs out, the plug turns off the open access point and Bluetooth RPC by
   itself (verified on Plus Plug S firmware 1.7.6; Bluetooth itself stays on until the installer's hardening
   step), so continue on your own Wi-Fi as in step 4. The ChargeLens installer offers to set an
   access point with a WPA2 password later (see [security.md](security.md)).
4. At the top of the page, *Wi-Fi status* now shows the network and the plug's new **IPv4 address**. Press
   **Copy** next to it (or write it down). Then switch your phone or computer back to your own Wi-Fi and open
   `http://<that address>`. From now on `<plug-ip>` means that address. Only if you missed it, look for the plug
   in your router's device list or in the Shelly app.

Your browser must be on the same network as the plug for the next steps.

## 3. Update the firmware (required)

The installer only continues when the firmware is **up to date**.

1. Web UI: **Settings -> Firmware** (or the Shelly app). Press **Check for updates**; if an update is offered
   under *Official Shelly updates*, install it. *No updates* means you are done.

   <img src="assets/screenshots/shelly-firmware.png" alt="Shelly web UI: Firmware information showing No updates and the Check for updates button" width="560">

2. Updates come **in steps**: after one update the next one is offered only after the plug has restarted. Update,
   wait for the restart (a few minutes), check again, and repeat until no update is offered.
3. Right after an update the plug may answer "Not committed" (error -109) if you start another update straight
   away. Wait about 7 minutes and try again.

The same rule applies to later ChargeLens updates: the installer refuses an update while the firmware is not up to
date.

## 4. Name and recommended settings

Only the name is set here, and it is optional. **Everything else in this section needs no action in the Shelly
web UI**: the ChargeLens installer and setup page do it for you. The table says where each setting lives in the
Shelly web UI, in case you want to check it there.

When you press **Save settings** in the Shelly web UI, a green *Successful!* shows next to the button for a few
seconds.

1. **Name** (optional): **Settings -> Device name**, type a name, **Save settings**. ChargeLens shows it in
   the mail template as `{device_name}`.
2. Settings that ChargeLens handles later:

   | Setting | Shelly web UI | What ChargeLens does |
   |---|---|---|
   | Time zone | Settings -> Location and time | Setup page fills it from your phone (installer does it on the first install). |
   | Shelly cloud | Settings -> Cloud | Installer offers to turn it off. |
   | Bluetooth | Settings -> Bluetooth | Installer offers to turn it off. |
   | MQTT | Settings -> MQTT | Installer offers to turn it off. |
   | Button | Home -> the plug's output -> settings (button / input mode) | Installer offers to make the button do nothing (*detached*). |
   | Access point | Settings -> Access Point | Installer offers to turn it on with a WPA2 password, so you can reach the plug without your Wi-Fi. |

   You can apply the same choices later on the ChargeLens setup page (*Hardening* and *Wi-Fi access point*). See
   [security.md](security.md) for why they are recommended.

**Cloud off means no Shelly app access from outside the plug's networks.** You can still use the plug from a
device on its Wi-Fi network or on its access point. If you want the Shelly app to reach the plug from anywhere,
leave the cloud on and accept the risk (see security.md).

## 5. Continue

[Install ChargeLens](install.md) (from the browser, recommended) or [install it manually](install-manual.md).
