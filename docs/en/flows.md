---
title: Flows
parent: English
nav_order: 6
---

# Flows
{: .no_toc }

All flow cards of the app, with examples.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Ventilation unit

### When…

| Card | Tokens | Notes |
|---|---|---|
| **The fan mode changed** | *Mode*, *Changed by* | On every mode change. *Changed by* is `homey`, `remote` or `unit`. |
| **The fan mode changed to [mode]** | | Only for a particular mode. |
| **A boost started** | *Minutes*, *Started by* | Also when someone starts the boost on the remote. |
| **The unit reported a fault** | | |
| **The fault of the unit is gone** | | |
| **The filter needs replacing** | | When the unit turns on its filter alarm. |

### And…

| Card |
|---|
| **The fan mode is / isn't [mode]** |
| **The unit has / has no fault** |

### Then…

| Card | Notes |
|---|---|
| **Set the fan mode to [mode]** | Low, medium, high, auto, away or off (what your brand supports). |
| **Run on high for [minutes] minutes** | Boost of 1–255 minutes; the unit then falls back. |
| **Set the bypass to [auto / open / closed]** | Only for units with a bypass. |
| **Set [parameter] to [value]** | For heat recovery units with parameters. Start typing to search for a parameter. |
| **Reset the filter counter** | After replacing the filter. |
| **Ask the unit for its status** | Makes the unit report all its values right away. |

## Remote and sensor

### When…

| Card | Tokens |
|---|---|
| **The [Low / Medium / High / Auto / Away / Off / Boost] button was pressed** | *Boost minutes* |
| **Any button was pressed** | *Button*, *Boost minutes* |

The card *Any button was pressed* gives in *Button* the word `low`, `medium`, `high`, `auto`, `away`, `off` or `boost`.

## Homey CO₂ sensor

### Then…

| Card |
|---|
| **Report [ppm] ppm CO₂** |
| **Report [%] % humidity** |
| **Ask the unit for [%] % ventilation** |

See [Homey CO₂ sensor](homey-co2-sensor) for the explanation.

## Gateway

These cards are for those who want to go deeper. You'll need some knowledge of the [protocol](protocol).

### When…

| Card | Notes |
|---|---|
| **A packet was received** | Fires for **every** packet on the bus. Can be busy! |
| **A [code] packet was received from or to [address]** | Filter on message code and address. Address `*` matches any device. |
| **A new device was found on the bus** | Tokens *Address* and *Role* (`fan`, `remote`, `sensor`, `gateway`, `unknown`). |
| **The gateway went offline** | |
| **The gateway came online** | |

The packet triggers have these tokens:

| Token | Example |
|---|---|
| *Verb* | `I`, `RQ`, `RP` or `W` |
| *From* | `29:173894` |
| *To* | `29:233244` |
| *Code* | `22F1` |
| *Payload* | `000304` |
| *Frame* | ` I --- 29:173894 29:233244 --:------ 22F1 003 000304` |
| *Signal (RSSI)* | `45` |

### And…

| Card |
|---|
| **The gateway is / isn't online** |

### Then…

| Card | Notes |
|---|---|
| **Send frame [frame]** | A complete RAMSES II frame, exactly as it appears on the bus. |
| **Send [verb] [code] with payload [payload] to [address]** | Sent from the gateway's own address. |

{: .warning }
With raw frames you can send anything, including to your neighbours' units. Only send commands to your own devices
and test with *RQ* (request) before using *W* (write).

## Examples

### Shower: boost on high humidity

> **When** the humidity of *Bathroom sensor* changed<br>
> **And** the humidity is greater than 75 %<br>
> **And** *Ventilation* — the fan mode isn't *High*<br>
> **Then** *Ventilation* — Run on high for **30** minutes

### Everybody out: away mode

> **When** the last person left home<br>
> **Then** *Ventilation* — Set the fan mode to **Away**

> **When** the first person came home<br>
> **Then** *Ventilation* — Set the fan mode to **Auto**

### Cooking: boost when the cooker hood turns on

> **When** the power of *Cooker hood plug* became greater than 50 W<br>
> **Then** *Ventilation* — Run on high for **20** minutes

### Notification for a dirty filter

> **When** *Ventilation* — The filter needs replacing<br>
> **Then** send a push notification: *The ventilation filter needs replacing.*

And after replacing it, with a button or a voice command:

> **Then** *Ventilation* — Reset the filter counter

### Remote as a scene button

> **When** *Living room remote* — The **High** button was pressed<br>
> **Then** set the living room lights to 100 %

The unit still responds to the button as usual; Homey only listens in.

### Knowing who changed the mode

> **When** *Ventilation* — The fan mode changed<br>
> **And** *Changed by* is `remote`<br>
> **Then** log: *Someone set the ventilation to [Mode].*

### Warning for an offline gateway

> **When** *Ramses Gateway* — The gateway went offline<br>
> **Then** send a push notification: *The ramses_esp is offline.*

### Any CO₂ sensor in your home drives the unit

See [Homey CO₂ sensor](homey-co2-sensor#passing-on-values-with-flows).
