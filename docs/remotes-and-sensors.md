---
title: Remotes and sensors
nav_order: 5
redirect_from:
  - /en/remotes-and-sensors/
  - /en/remotes-and-sensors.html
---

# Remotes and sensors
{: .no_toc }

Your existing wireless buttons and sensors as Homey devices.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Remote

A physical RAMSES remote (e.g. an Orcon 15RF or an Itho RFT) becomes a Homey device with the capability
**Last button**. Every button press is a flow trigger.

### Adding

1. Go to **Devices → + → RAMSES ESP → Remote**.
2. **Press any button on the remote now** and click *Next*. Homey searches for up to 30 seconds.
3. Pick the remote and add it.

### What you can do with it

- **The [Low / Medium / High / Auto / Away / Off / Boost] button was pressed**
- **Any button was pressed**, with the tokens *Button* and *Boost minutes*

Examples are on the [Flows](flows#examples) page.

### Good to know

- A remote sends every press as **a burst of identical radio frames**. Homey counts that as one press, so your flow
  only fires once.
- Commands that **Homey itself** sends in this remote's name are recognised as an echo and do **not** fire the
  trigger. So you don't get loops when your flows control the unit.
- A remote still controls the unit directly. Homey listens in; it doesn't have to sit in between.

{: .tip }
A remote doesn't have to be bound to your unit to work as a Homey button. A spare, unbound remote makes a fine
wireless scene button for other things in your home.

## Sensor

RAMSES room sensors (e.g. the Orcon CO2 15RF) become a Homey sensor with the values they broadcast:

| Capability | Source |
|---|---|
| CO₂ (ppm) | `1298` |
| Humidity (%) | `12A0` |
| Temperature | `12A0`, `12C0` |
| Ventilation demand (%) | `31E0` |
| Presence | `2E10` |
| Battery, Battery low | `1060` |

Here too, only the capabilities the sensor actually reports appear.

### Adding

1. Go to **Devices → + → RAMSES ESP → Sensor**.
2. Sensors report every few minutes. If your sensor has a button, press it; it then reports right away.
3. Pick the sensor and add it.

### Sensors with buttons

Some sensors are a control as well. The Orcon CO2 15RF, for example, has buttons for *Auto* and *High*. For those
there are the same triggers as for the remote:

- **The […] button was pressed**
- **Any button was pressed**

## Naming

New devices are called *Remote 29:123456* or *Sensor 37:044778*. Rename them to something recognisable
(*Kitchen remote*, *Living room CO₂*). The address stays visible under *Settings → Bus*.

## Recognising addresses

Every RAMSES device has an address `TT:NNNNNN`. The first two digits say something about the kind of device:

| Starts with | Usually |
|---|---|
| `18:` | Gateway (ramses_esp, HGI80) |
| `29:` | Remote, or an Orcon unit |
| `32:` | Ventilation unit (Itho, Vasco, ClimaRad) or remote |
| `37:` | CO₂ sensor / control |

The app doesn't just look at the prefix but mostly at **which messages** a device sends. The role it determines that
way is shown in the [device finder](dashboard#device-finder).
