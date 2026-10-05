---
title: Ventilation unit
parent: English
nav_order: 3
---

# The ventilation unit
{: .no_toc }

Adding, controlling and configuring your heat recovery or mechanical ventilation unit.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Adding

1. Go to **Devices → + → RAMSES ESP → Ventilation unit**.
2. Homey lists the units the gateway has already heard. Is your unit missing? Press a button on your remote, wait a few
   seconds and continue. The unit answers and shows up in the list. Homey searches for up to 30 seconds.
3. Pick your unit and click **Next**.

{: .warning }
**Living in an apartment building?** The gateway often hears the neighbours' units too. Only add your own unit. Its
address is on the unit's type plate, or listed as *FAN ID* in your old Home Assistant or ramses_cc configuration.
Not sure? Check in the [bus view](dashboard#bus-view) which unit responds when you press your own remote.

## Making sure Homey may control the unit

A RAMSES unit only executes commands from devices it is **bound** to. Homey therefore has to pose as such a device.
There are two ways:

### Option 1: use the address of an existing remote

Homey then sends commands *in the name of* a remote the unit already knows.

- If the gateway has heard a remote talking to this unit, Homey fills in its address **automatically** when you add
  the unit.
- Otherwise enter it yourself: *Device → Settings → Control → Remote address*, e.g. `29:173894`.
- Coming from Home Assistant with ramses_cc? Use the same (possibly *faked*) remote address as there.

While the field is empty, the device shows a warning: *Set the address of a remote the unit is bound to (device
settings) so Homey can control it.*

### Option 2: bind Homey as a remote

Homey can also bind itself to the unit as a new remote of its own. You then don't need an existing remote address.

1. Put the unit in **binding mode**. On an Orcon: unplug the unit and plug it back in. The unit then accepts new
   devices for about 2 minutes.
2. In Homey, open the device → **Settings** (gear) → **Maintenance** → **Bind Homey as a remote**.
3. Homey picks a free address (`29:xxxxxx`), offers itself every 5 seconds and waits up to 90 seconds for the unit to
   accept.
4. Done? The new address is shown under *Remote address* and you can control the unit.

Only *this* unit may accept the binding, so a neighbour's unit that happens to be in binding mode too is not bound by
accident.

{: .tip }
Getting *No unit answered*? The unit was not (or no longer) in binding mode. Repeat step 1 and start binding within 2
minutes.

## Controlling

### Fan mode

The device card has a **Fan mode** picker:

| Mode | Meaning |
|---|---|
| **Low** | Base ventilation |
| **Medium** | Normal |
| **High** | Maximum |
| **Auto** | The unit regulates itself based on its sensors (CO₂, humidity) |
| **Away** | Minimal ventilation |
| **Off** | Only if the brand supports it |

Not every brand has every mode. Choose a mode your brand doesn't have and Homey tells you which modes are available.

The mode is also updated when someone uses the **physical remote**; Homey hears it on the bus. On the dashboard tile
the mode is shown as a word (*Status*).

### Boost

With the flow card *Run on high for N minutes* the unit temporarily runs on high and then falls back. A boost lasts 1
to 255 minutes. On an Orcon, Homey uses the same long boost as the real remote (high, then auto).

### Bypass

If your unit has a bypass (most heat recovery units), the **Bypass** picker appears as soon as the unit reports its
bypass state: **Auto**, **Open** or **Closed**. Also through the flow card *Set the bypass to …*.

### Filter

- **Filter days left** and **Filter left** show how much longer the filter will last.
- **Replace filter** (alarm) turns on when the unit reports that the filter needs replacing.
- After replacing it, reset the counter with the flow card **Reset the filter counter**.

## What the unit shows

Capabilities appear **only once the unit reports them**. A unit without a CO₂ sensor never gets an empty CO₂ tile.
After adding, it can therefore take a few minutes before everything shows up.

| Capability | When |
|---|---|
| Fan mode, Status | Always |
| Fan speed, Supply fan speed | When the unit reports its speed (`31D9`, `31DA`) |
| CO₂, Humidity, Temperature | Units with their own sensors |
| Outdoor temperature, Supply air temperature, Exhaust air temperature, Outdoor humidity | Heat recovery units |
| Supply air flow, Exhaust air flow (l/s) | Units that report their air flow |
| Bypass position (%), Bypass (settable) | Units with a bypass |
| Pre-heater, Post-heater (%) | Units with heating elements |
| Air quality (%) | Units with an air quality sensor |
| Boost time left | During a boost |
| Filter days left, Filter left, Replace filter | Units that report their filter state (`10D0`, `31DA`) |
| Fault, Frost protection | When the unit reports that state |

All numeric values and alarms are logged in **Insights**.

## Settings

### Control

| Setting | Default | Notes |
|---|---|---|
| **Remote address** | automatic | Homey sends commands in the name of this address. See [above](#making-sure-homey-may-control-the-unit). |
| **Brand** | Automatic | See [Brand](#brand). |
| **Ask for status every** | 5 min | How often Homey asks the unit for its status. `0` turns this off; the unit also reports on its own. |

### Brand

Brands use the same messages, but **number their modes differently**. The same command means *Auto* on an Orcon and
*High* on an Itho. With **Automatic**, Homey uses the Orcon numbering and switches as soon as the unit's remotes reveal
another brand (Vasco/ClimaRad and Nuaire are recognisable). Itho cannot be told apart from Orcon: **if you have an
Itho, choose Itho yourself.**

| Brand | Modes |
|---|---|
| Orcon | away, low, medium, high, auto, off |
| Itho | off, away, low, medium, high |
| Vasco | off, away, low, medium, high, auto |
| ClimaRad | off, away, low, medium, high, auto |
| Nuaire | medium, high |

### Parameters (heat recovery)

Heat recovery units (Orcon HRC, Vasco, ClimaRad and others) have internal parameters. Homey reads them after adding the
unit; *Supported by this unit* then shows **Yes** or **No**. Change a value and save, and Homey writes it to the unit.

| Parameter | Range |
|---|---|
| Time to change filter | 0–1800 days |
| Away: supply / exhaust fan | 0–40 % |
| Low: supply / exhaust fan | 0–75 % |
| Medium: supply / exhaust fan | 0–75 % |
| High: supply / exhaust fan | 0–100 % |
| Boost: supply and exhaust | 0–100 % |
| Night, away, high, low, trickle mode timer | 0–180 min |
| Humidity sensor overrun | 15–60 min |
| Exhaust / supply temperature limit | 5–25 °C |
| Comfort temperature | 0–30 °C |
| Bypass override timer | 0–180 min |
| Summer mode limit | 15–25 °C |
| Winter mode limit | 5–15 °C |
| Bypass hysteresis | 0.5–5 °C |
| Pre-heater limit | −15 to −5 °C |
| Pre-heater hysteresis | 0.5–5 °C |

{: .warning }
Parameters change the behaviour of your unit permanently. Note the old value before you change anything. Too little
ventilation can cause damp and mould problems.

Parameters can also be set from a flow with **Set [parameter] to [value]**.

### Bus

For information only: the **model** of the unit (if it reports one, e.g. `VMC-15RP01`), the **address** and the
**gateway** it was found through.
