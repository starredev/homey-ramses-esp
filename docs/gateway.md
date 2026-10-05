---
title: Adding the gateway
nav_order: 3
redirect_from:
  - /en/gateway/
  - /en/gateway.html
---

# Adding the gateway
{: .no_toc }

The gateway is the link between Homey and your ramses_esp. All other devices go through it.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Adding

1. Go to **Devices → + → RAMSES ESP → Ramses Gateway**.
2. Fill in the details of the **MQTT broker**:

   | Field | Example | Notes |
   |---|---|---|
   | Broker address | `192.168.1.20` | With the MQTT Broker app this is your Homey's IP address. Homey often fills it in already. |
   | Port | `1883` | `8883` with TLS, unless your broker is set up differently. |
   | User name / password | | Leave empty if your broker needs no login. |
   | Use TLS (mqtts) | off | Only turn on if your broker listens encrypted. |
   | Gateway address (optional) | `18:203612` | Only needed when Homey doesn't find the ramses_esp by itself. |

3. Click **Find gateways**. Homey connects to the broker, listens a few seconds to all `RAMSES/GATEWAY/...` topics and
   shows every ramses_esp it hears.
4. Pick your gateway and click **Next**.

The new device is called *Ramses Gateway*. Feel free to rename it.

## What the gateway shows

| Capability | Meaning |
|---|---|
| **Gateway address** | The RAMSES address of the ramses_esp, e.g. `18:203612`. |
| **Devices on the bus** | How many different devices the gateway has heard so far. |
| **Last packet** | The last packet received, in readable form. |

The gateway listens all the time and **remembers every device** it hears, also after a Homey restart. That's why Homey
can show a list right away when you add a unit, remote or sensor.

### Availability

| Situation | What you see |
|---|---|
| Homey is still connecting to the broker | *Connecting to the MQTT broker…* |
| The broker cannot be reached | Device unavailable: *MQTT broker not reachable*. Homey keeps retrying. |
| Wrong user name or password | *The MQTT broker refused the user name or password.* Change them in the settings. |
| The ramses_esp reports offline | *The ramses_esp reports that it is offline. Check its power and WiFi.* |

## Settings

Under *Device → Settings* you can change the broker details later (host, port, user, password, TLS). After saving, the
gateway reconnects. The gateway address is for information only.

## Several gateways

You can add more than one ramses_esp, for example when your home is too large for one radio. Every ventilation unit,
remote and sensor remembers the gateway it was found through and also sends its commands through that gateway.

## Gateway flow cards

The gateway has cards for advanced use: reacting to any packet on the bus, sending raw frames and knowing whether the
gateway is online. See [Flows → Gateway](flows#gateway).

## When it doesn't work

| Message while searching | Solution |
|---|---|
| *No MQTT broker answered at this address.* | Check IP address and port, and that the broker app is running. |
| *The broker refused the user name or password.* | Check the credentials in the broker app. |
| *Connected, but no ramses_esp published anything on this broker.* | The ramses_esp is not connected to this broker. Check its MQTT settings, or enter its address (`18:xxxxxx`) under *Gateway address*. |

More in [Troubleshooting](troubleshooting).
