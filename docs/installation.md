---
title: Installation
parent: English
nav_order: 1
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
| **ramses_esp** | An ESP32 with an 868 MHz radio and the [ramses_esp](https://github.com/IndaloTech/ramses_esp) firmware, connected to your Wi-Fi. |
| **MQTT broker** | Where the ramses_esp publishes to. The easiest is the *MQTT Broker* app on Homey itself; Mosquitto on a NAS or Raspberry Pi works just as well. |
| **A RAMSES II ventilation system** | Orcon, Itho, Vasco, ClimaRad or Nuaire on 868 MHz. |

{: .tip }
Place the ramses_esp somewhere between your Homey Wi-Fi and the ventilation unit. 868 MHz passes walls well, but an
attic with a concrete floor in between can be just too much. The [bus view](dashboard#bus-view) shows the signal
strength (RSSI) of every packet.

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
     *Device Manager → Ports (COM & LPT)*.
   - **macOS / Linux**: for example `screen /dev/ttyUSB0 115200` (on macOS something like `/dev/tty.usbserial-…`).
3. Press **Enter**. You get the ramses_esp prompt.

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
4. **[Homey CO₂ sensor](homey-co2-sensor)** (optional)

Ready? Continue with [adding the gateway](gateway).
