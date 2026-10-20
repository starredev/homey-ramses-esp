---
title: Installation
nav_order: 2
redirect_from:
  - /en/installation/
  - /en/installation.html
---

# Installation
{: .no_toc }

From a bare ramses_esp to a working app on your Homey.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## What you need

| Part | Notes |
|---|---|
| **Homey Pro (2023)** or **Homey Pro mini** | Firmware **12.4 or newer**. The app runs locally; Homey Cloud is not supported. |
| **ramses_esp** | An ESP32 with an 868 MHz radio and the [ramses_esp](https://github.com/IndaloTech/ramses_esp) firmware, connected to your Wi-Fi. See [which gateway](#which-gateway) for boards you can buy. |
| **MQTT broker** | Where the ramses_esp publishes to. The easiest is the *MQTT Broker* app on Homey itself; Mosquitto on a NAS or Raspberry Pi works just as well. |
| **A RAMSES II ventilation system** | Orcon, Itho, Vasco, ClimaRad or Nuaire on 868 MHz. |

{: .tip }
Place the ramses_esp somewhere between your Homey Wi-Fi and the ventilation unit. 868 MHz passes walls well, but an
attic with a concrete floor in between can be just too much. The [bus view](dashboard#bus-view) shows the signal
strength (RSSI) of every packet.

### Which gateway?

These boards are tested with the app. Both come with the right firmware, so you only set up Wi-Fi and MQTT
(step 2 below).

| Board | Chip | Firmware | Where |
|---|---|---|---|
| **Elecram Sub-GHz 855–925 MHz Bridge** | ESP32-C6 + TI CC1101 | [ramses_esp for ESP32-C6](https://github.com/IMMRMKW/ramses_esp) (reports as `ramses_esp_c6`) | [elecram.com](https://elecram.com/products/esp32-c6-wifi-zigbee-to-855-925mhz-wireless?variant=52605637132621). Order the 868 MHz antenna with it. |
| **Indalo-Tech RAMSES_ESP** | ESP32-S3 + TI CC1101 | [ramses_esp](https://github.com/IndaloTech/ramses_esp) (reports as `ramses_esp`) | [indalotech.co.uk](https://indalotech.co.uk), when the shop is open. |

The app reads both firmwares the same way: it finds gateways by their MQTT topics, not by firmware name. Setting up
the Elecram board has a few extra points; see [Elecram ESP32-C6 board](#elecram-esp32-c6-board).

## 1. The MQTT broker

The ramses_esp and Homey don't talk to each other directly, but through an MQTT broker.

### Option A: the MQTT Broker app on Homey (recommended)

1. Install the **MQTT Broker** app from the Homey App Store.
2. Open *Apps → MQTT Broker → Configure* and check that the broker listens on port **1883**.
3. Create a user (recommended) and note the user name and password.
4. Note the **IP address of your Homey** (*Settings → General → About*). That will be the broker address.

{: .note }
Give your Homey a fixed IP address in your router (DHCP reservation). If the address changes, the ramses_esp loses
its connection to the broker.

### Option B: an existing broker

Already running Mosquitto (for example from an old Home Assistant setup)? You can simply keep it. Just make sure
Homey can reach the broker and that you have the user name and password. TLS (`mqtts`) is supported.

## 2. Setting up the ramses_esp

Homey cannot talk to the stick over USB serial, so the ramses_esp has to connect to the MQTT broker over **Wi-Fi**.
You set this up **once** through the serial console. After that the stick only needs power: a USB charger or a free
USB port will do.

{: .background }
**Coming from Home Assistant?** There the stick usually hung off the Raspberry Pi over USB serial. Unplug it and
configure it as below. You won't need your ramses_cc configuration any more, but keep the *FAN ID* and the remote
address: you'll need them [in Homey](ventilation-unit#option-1-use-the-address-of-an-existing-remote).

### Opening the serial console

1. Plug the ramses_esp into a Windows, macOS or Linux computer.
2. Open a serial terminal on the right port at **115200 baud**:
   - **Windows**: [PuTTY](https://www.putty.org/), connection type *Serial*. Find the COM port in
     *Device Manager → Ports (COM & LPT)*. Set PuTTY up as below before you click *Open*.
   - **macOS / Linux**: for example `screen /dev/ttyUSB0 115200` (on macOS something like `/dev/tty.usbserial-…`).
3. Press **Enter**. You get the ramses_esp prompt.

#### PuTTY settings

| Where in PuTTY | Setting | Why |
|---|---|---|
| *Session* | Connection type **Serial**, serial line **COM…**, speed **115200** | The port of the board. |
| *Connection → Serial* | Flow control **None** | With the default *XON/XOFF* the board receives nothing you type. |
| *Terminal* | **Implicit CR in every LF** on | Lines start at the left instead of running down like stairs. |
| *Terminal* | Local echo **Force on**, local line editing **Force on** | You see what you type and can correct it before *Enter*. |

Save these under a name on the *Session* page, so you can open them with a double click next time. Close PuTTY before
you flash the board: only one program can use the COM port at a time.

### Setting up Wi-Fi and MQTT

Type the commands one by one. They are **case sensitive**.

```text
wifi password YOUR_WIFI_PASSWORD
wifi ssid YOUR_WIFI_SSID
wifi restart
mqtt user YOUR_MQTT_USER
mqtt password YOUR_MQTT_PASSWORD
mqtt broker mqtt://192.168.1.20:1883
sntp server pool.ntp.org
timezone CET
reset
```

| Command | What it does |
|---|---|
| `wifi password` / `wifi ssid` | The password and name of your Wi-Fi network. Use a **2.4 GHz** network; an ESP32 does not support 5 GHz. |
| `wifi restart` | Reconnects with the new Wi-Fi details. |
| `mqtt user` / `mqtt password` | The user you created in the broker app. Leave out if your broker needs no login. |
| `mqtt broker` | The address of the broker. With the MQTT Broker app that is `mqtt://<IP of your Homey>:1883`. |
| `sntp server` / `timezone` | Time synchronisation, so the timestamps in the messages are right. Use your own time zone. |
| `reset` | Restarts the ramses_esp with the new settings. |

{: .note }
**Always set the password before the ssid or broker line.** As soon as the ramses_esp gets an ssid or a broker, it
tries to connect right away. If the password isn't there yet, that first attempt fails.

After the `reset` the stick connects to your Wi-Fi and the broker. You can then unplug it from the computer and power
it somewhere else, ideally halfway between your Homey Wi-Fi and the ventilation unit.

More commands and firmware updates are in the [ramses_esp documentation](https://github.com/IndaloTech/ramses_esp).

### Elecram ESP32-C6 board

The Elecram board takes the same commands, with these differences:

| Point | What to do |
|---|---|
| **Network mode** | The firmware can run over Wi-Fi or Zigbee; MQTT only works in Wi-Fi mode. Type `network show`. If it says `zigbee`, type `network wifi`; the board saves it and restarts. |
| **Broker address** | Type it in full, with `mqtt://` and the port: `mqtt broker mqtt://192.168.1.20:1883`. |
| **Changing the MQTT login** | Type `reset` after `mqtt user` and `mqtt password`. Until then the board keeps retrying with the old login and the console shows `MQTT: Disonnected` over and over. |
| **Time** | The firmware has no time server by default, so the timestamps say `1970-01-01`. Set one with `sntp server pool.ntp.org` and a time zone, for example `timezone CET-1CEST,M3.5.0,M10.5.0/3` (Amsterdam with daylight saving), then `reset`. Homey does not use the timestamps, so this is optional. |

When it works, the console shows:

```text
# Connected to SSID:YOUR_WIFI_SSID
# MQTT: Connecting to mqtt://192.168.1.20:1883
# MQTT: Connected
```

In MQTT Explorer the board shows up as `RAMSES/GATEWAY/18:xxxxxx = online` with `info/firmware = ramses_esp_c6`.

{: .note }
**Over Zigbee instead of Wi-Fi (experimental, untested).** In Zigbee mode the board can join
[Zigbee2MQTT](https://www.zigbee2mqtt.io/). The fork has a Zigbee2MQTT extension (branch `z2m_support`,
`z2m/external_extensions/ramses-esp-bridge.mjs`) that passes the packets on to the same `RAMSES/GATEWAY/18:xxxxxx/rx`
and `/tx` topics, so the app can read them as usual. Zigbee2MQTT must use the same broker as Homey. The extension is
not in a release yet and also needs the board's device definition in Zigbee2MQTT. Over Zigbee there is no
online/offline status topic, so the gateway's online card and offline warning don't work. Use Wi-Fi unless you
want to experiment.

### Topics

If all is well, the ramses_esp then publishes on these topics:

| Topic | Direction | Content |
|---|---|---|
| `RAMSES/GATEWAY/<id>` | ramses_esp → broker | Online/offline status (also as *last will*) |
| `RAMSES/GATEWAY/<id>/rx` | ramses_esp → broker | Every packet the radio hears, as `{"msg": "<frame>"}` |
| `RAMSES/GATEWAY/<id>/tx` | broker → ramses_esp | Frames the ramses_esp should send |

`<id>` is the ramses_esp's own address, something like `18:203612`. You see it in the ramses_esp itself and in the
topics; Homey usually finds it [by itself](gateway).

{: .background }
Want to check that the ramses_esp publishes before installing the app? Subscribe to `RAMSES/#` with an MQTT client
such as [MQTT Explorer](https://mqtt-explorer.com/). Within a minute you'll see traffic from your unit, your sensors
and, in an apartment building, your neighbours too.

## 3. Installing the app

The app is available as a **test version** in the Homey App Store. Install it with one click:

[Install RAMSES ESP on your Homey](https://homey.app/a/io.github.starredev.ramses/test/){: .btn .btn-primary }

1. Open the link above and sign in with your Homey account.
2. Click **Install** and choose your Homey.
3. After a few seconds the app is listed under *Apps* on your Homey.

You don't need a computer, Node.js or the Homey CLI.

{: .background }
A test version has not been reviewed by Athom yet and can't be found through the App Store search, only through this
link. Once the app is officially published, you can also find it by searching for **RAMSES ESP**.

Want to tinker with the app yourself? See [Development](development).

## 4. Adding devices

Always add the devices in this order:

1. **[Ramses Gateway](gateway)**: without a gateway Homey hears nothing from the bus.
2. **[Ventilation unit](ventilation-unit)**
3. **[Remotes and sensors](remotes-and-sensors)** (optional)
4. **[Virtual CO₂ sensor](homey-co2-sensor)** (optional)

Ready? Continue with [adding the gateway](gateway).
