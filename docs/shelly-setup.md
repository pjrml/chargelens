# Shelly setup

What to do with a new plug before installing ChargeLens. You need the plug, a phone or computer, and (once, for the
install) a Wi-Fi network with internet access.

> **Charger requirement.** The Plus Plug S and Plug S Gen3 are rated 12 A / 2500 W. Limit your car or charger
> **below the plug's relay protection values** before you plug it in (the installer shows them). Above them the
> plug's relay cuts the power, and a charger that draws more than the plug is rated for can overheat the plug or
> the socket. The installer asks you to confirm this.
>
> **The Plug PM Gen3 (16 A) has no relay**, so nothing cuts the power if the charger draws too much: the only
> protection is the circuit breaker. Keep the charger below the plug rating and the circuit rating. The installer
> asks you to confirm that you understand this.

Tested models: Shelly **Plus Plug S** (Gen2, `SNPL-00112EU`), Shelly **Plug S Gen3**, including rebranded variants
that run Shelly firmware (for example EcoFlow x Shelly, `EF3PL-00112EU`), and Shelly **Plug PM Gen3**
(`S3PL-30116EU`, metering only, no relay). Anything else is refused by the installer. "Tested" is no warranty of any kind, in particular not about safety: you use ChargeLens at your own
risk (see the [README](../README.md)).

> **Use a plug dedicated to ChargeLens.** We recommend that the plug runs **no other scripts**: ChargeLens needs
> all 3 running script slots and most of the script memory, and it was tested only on plugs without other
> scripts. A new or freshly reset plug is the best start. See the [README](../README.md).

## 1. Power it and join its own network

Menu names and labels are from Plus Plug S firmware 1.7.6; other firmware versions may differ slightly.

1. Plug the plug into a mains socket. A new plug starts its own Wi-Fi access point (a name like
   `ShellyPlusPlugS-XXXXXX` or `ShellyPlugSG3-XXXXXX`), open, without a password.
2. Connect your phone or computer to that network.
3. Open `http://192.168.33.1` in the browser. This is the plug's web UI.

## 2. Join the plug to your Wi-Fi (once, for the install)

ChargeLens itself works offline, but the installer downloads the scripts from GitHub, so for the install your
browser needs internet, and so does the plug for firmware updates. Use a Wi-Fi network you control (your home
router, or a phone hotspot).

> [!IMPORTANT]
> **Watch the countdown.** On a new or freshly reset plug the web UI shows a red banner *"Secure your device by
> connecting to Wi-Fi. Set an Access Point password to keep it available"* with a countdown (*Time left*). When it
> reaches zero, the plug turns off its open access point. If that happens before the plug is on your Wi-Fi,
> unplug the plug, plug it in again, reconnect to its access point and start this section again.

1. Press **Settings** in the menu.
2. Press **Wi-Fi** (under *Network settings*). In *Wi-Fi 1 settings* the **Enable Wi-Fi** switch is greyed out
   (*"You need to set network name before enabling this Wi-Fi!"*); that is expected.
3. Press the **arrow** next to *Network*. The list *Available networks* opens (press *Scan for networks* if yours
   is not listed).
4. Pick your network.
5. Type the Wi-Fi password.
6. Press **Save settings**. **Enable Wi-Fi** turns on by itself and *Wi-Fi status* shows *Connected* with the
   plug's new IPv4 address.

   <img src="assets/screenshots/shelly-wifi.png" alt="Shelly web UI: Wi-Fi 1 settings with Enable Wi-Fi, network and password" width="560">

7. At the top of the page, *Wi-Fi status* shows the network and the plug's new **IPv4 address**. Press **Copy**
   next to it (or write it down).
8. Switch your phone or computer back to your own Wi-Fi.
9. Open `http://<that address>`. From now on `<plug-ip>` means that address.

Only if you missed the address, look for the plug in your router's device list or in the Shelly app.

The **Configure Wi-Fi** button in the banner is not needed (on Plus Plug S firmware 1.7.6 it did nothing).

After step 6 the banner changes to *"Network connected! Set an Access Point password to keep it available. For
your security, Bluetooth RPC access and unprotected Access Point will be disabled automatically in 5 minutes."*
You can ignore it: when that timer runs out, the plug turns off the open access point and Bluetooth RPC by itself
(Bluetooth itself stays on until the installer's hardening step). The ChargeLens installer offers to set an access
point with a WPA2 password later (see [security.md](security.md)).

Your browser must be on the same network as the plug for the next steps.

## 3. Update the firmware (required)

The installer only continues when the firmware is **up to date**. You can also update from the Shelly app.

1. Press **Settings** in the menu.
2. Press **Firmware** (under *Device settings*).
3. Press **Check for updates**. *No updates* means you are done: go to section 4.

   <img src="assets/screenshots/shelly-firmware.png" alt="Shelly web UI: Firmware information showing No updates and the Check for updates button" width="560">

4. If an update is offered under *Official Shelly updates*, install it.
5. Wait for the plug to restart (a few minutes).
6. Go back to step 3. Updates come **in steps**: the next one is offered only after the plug has restarted.

Right after an update the plug may answer "Not committed" (error -109) if you start another update straight
away. Wait about 7 minutes and try again.

The same rule applies to later ChargeLens updates: the installer refuses an update while the firmware is not up to
date.

## 4. Name and recommended settings

Only the name is set here, and it is optional. **Everything else in this section needs no action in the Shelly
web UI**: the ChargeLens installer and setup page do it for you. The table says where each setting lives in the
Shelly web UI, in case you want to check it there.

When you press **Save settings** in the Shelly web UI, a green *Successful!* shows next to the button for a few
seconds.

To set a name (optional; ChargeLens shows it in the mail template as `{device_name}`):

1. Press **Settings** in the menu.
2. Press **Device name** (under *Device settings*).
3. Type a name.
4. Press **Save settings**.

Settings that ChargeLens handles later:

| Setting | Shelly web UI | What ChargeLens does |
|---|---|---|
| Time zone | **Settings -> Location and time** (*Timezones*) | Setup page fills it from your phone (installer does it on the first install). |
| Shelly cloud | **Settings -> Cloud** (*Connectivity settings*) | Installer offers to turn it off. |
| Bluetooth | **Settings -> Bluetooth** (*Enable*, *Enable RPC*) | Installer offers to turn it off. |
| MQTT | **Settings -> MQTT** (*Connectivity settings*) | Installer offers to turn it off. |
| Button | **Home -> Output (0) -> Detach switch**: *Attached* = the button toggles the relay, *Detached* = it does nothing | Installer offers to make the button do nothing (*Detached*). |
| Access point | **Settings -> Access Point** (*Enable Access Point*, *Password protected network*) | Installer offers to turn it on with a WPA2 password, so you can reach the plug without your Wi-Fi. |
| Websocket debug logs | **Settings -> Debug -> Websocket debug** | The installer turns them on to show its address in the script console, and turns them off again at the end (hardening). |

You can apply the same choices later on the ChargeLens setup page (*Hardening* and *Wi-Fi access point*). See
[security.md](security.md) for why they are recommended.

**Cloud off means no Shelly app access from outside the plug's networks.** You can still use the plug from a
device on its Wi-Fi network or on its access point. If you want the Shelly app to reach the plug from anywhere,
leave the cloud on and accept the risk (see security.md).

## 5. Continue

[Install ChargeLens](install.md) (from the browser, recommended) or [install it manually](install-manual.md).
