---
title: Homey CO₂ sensor
parent: English
nav_order: 5
---

# The Homey CO₂ sensor
{: .no_toc }

Let your ventilation unit respond to any CO₂ or humidity sensor in Homey, as if it were an original RAMSES sensor.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Why?

A unit in **auto mode** ventilates harder as its sensors ask for more. But maybe you already have a Netatmo, Aqara,
Airthings or Zigbee sensor in the bedroom and no RAMSES sensor. With the **Homey CO₂ sensor**, Homey itself plays a
RAMSES CO₂ sensor (`37:xxxxxx`) and forwards the values of your Homey sensors to the unit. The unit then regulates
itself, in its own auto mode.

```mermaid
flowchart LR
    Z["Any Homey sensor<br/>(Zigbee, Wi-Fi, ...)"] -- flow --> V["Homey CO₂ sensor<br/>37:xxxxxx"]
    V -- "1298 CO₂, 12A0 humidity,<br/>31E0 ventilation demand" --> U["Ventilation unit<br/>in auto"]
```

## Adding and binding

1. Go to **Devices → + → RAMSES ESP → Homey CO₂ sensor**. Homey picks a free address on the bus.
2. Put the unit in **binding mode** (Orcon: unplug and plug back in; you then have 2 minutes).
3. Open the Homey CO₂ sensor → **Settings** → **Maintenance** → **Bind to a unit**.
4. Homey offers itself the way a real Orcon CO2 15RF does. Once accepted, the unit's address is shown under
   *Bound to unit*.

{: .note }
The sensor binds as a *control*, like an Orcon CO2 15RF. An Orcon unit ignored the offer of a plain sensor; it did
accept this form. Other brands may behave differently.

## Passing on values with flows

The sensor has three action cards:

| Card | What it does |
|---|---|
| **Report [ppm] ppm CO₂** | Sends a CO₂ value (`1298`) to the unit. |
| **Report [%] % humidity** | Sends a humidity (`12A0`) to the unit. |
| **Ask the unit for [%] % ventilation** | Sends a ventilation demand (`31E0`) directly. |

A typical flow:

> **When** the CO₂ of *Netatmo bedroom* changed<br>
> **Then** *Homey CO₂ sensor*: Report **[CO₂ token]** ppm CO₂

Do the same for the humidity of, for example, the bathroom sensor.

Homey **repeats the last values every 5 minutes**, as a real sensor does. So if no new value arrives for a while, the
unit doesn't consider the sensor gone.

## Calculating the ventilation demand

Under *Settings → Ventilation demand* you decide how the sensor calculates its demand.

| Setting | Default | Meaning |
|---|---|---|
| **Derive from CO₂ and humidity** | on | Homey calculates the ventilation demand itself from the reported values. Off: only the card *Ask for ventilation* sets the demand. |
| **CO₂ from** | 400 ppm | Below this value the demand is 0 %. |
| **CO₂ full demand at** | 1000 ppm | From here the demand is 100 %. |
| **Humidity from** | 60 % | Below this value the demand is 0 %. |
| **Humidity full demand at** | 80 % | From here the demand is 100 %. |

Between the low and the high point the demand rises **linearly**. Of CO₂ and humidity, **the higher one** counts.

**Example** with the defaults: 700 ppm CO₂ gives (700 − 400) / (1000 − 400) = **50 %**. 65 % humidity gives
(65 − 60) / (80 − 60) = **25 %**. The sensor therefore asks for 50 %.

## What the sensor shows

| Capability | |
|---|---|
| CO₂ | The last reported CO₂ |
| Humidity | The last reported humidity |
| Ventilation demand | What the sensor is asking the unit for now |

Under *Settings → Bus* you find the address Homey plays and the unit the sensor is bound to.

{: .tip }
The unit has to be in **Auto** to respond to the ventilation demand. Set it to low or high manually and it ignores
sensors until you set it back.
