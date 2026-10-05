---
title: Troubleshooting
nav_order: 9
redirect_from:
  - /en/troubleshooting/
  - /en/troubleshooting.html
---

# Troubleshooting
{: .no_toc }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Connection

### Homey doesn't find a gateway

*Connected, but no ramses_esp published anything on this broker.*

- Check in the ramses_esp that it is connected to **the same broker** (address, port, user, password).
- Does the ramses_esp get no Wi-Fi? Check through the [serial console](installation#2-setting-up-the-ramses_esp) that
  the ssid and password are right (case sensitive) and that it is a **2.4 GHz** network.
- Did you enter the password after the ssid or broker line? Run `wifi restart` or `reset` so it connects again.
- Use an MQTT client such as [MQTT Explorer](https://mqtt-explorer.com/) to see whether anything arrives under
  `RAMSES/GATEWAY/`.
- Homey listens for about 4 seconds. A ramses_esp that is just starting up may not be visible yet. In that case enter
  its address (`18:xxxxxx`) under *Gateway address* and try again.

### *No MQTT broker answered at this address*

- Is the IP address right? With the MQTT Broker app it's your Homey's IP address.
- Is the port right? Usually `1883`, or `8883` with TLS.
- Is the broker app running? Open it and check its status.

### The gateway keeps becoming unavailable

- *MQTT broker not reachable*: the broker is gone or its IP address changed. Give Homey (or your NAS) a fixed IP
  address in your router.
- *The ramses_esp reports that it is offline*: the ramses_esp has no power or no Wi-Fi. Check that it's reachable and
  that the Wi-Fi is strong enough where it is.

## Control

### The unit doesn't respond to Homey

This is by far the most common problem. The unit only executes commands from devices it is **bound** to.

1. Check *Settings → Control → Remote address* of the unit. If it's empty, or not an address bound to the unit, the
   unit ignores Homey.
2. Don't know the address of a bound remote? Press that remote and see in the [bus view](dashboard#live-traffic) which
   address sends a `22F1` to your unit.
3. Or [bind Homey itself as a remote](ventilation-unit#option-2-bind-homey-as-a-remote).
4. The command arrives, but the unit does something else (e.g. *high* instead of *auto*)? Then the
   [brand](ventilation-unit#brand) is wrong. Choose the brand manually.

### *No unit answered* while binding

The unit was not in binding mode. On an Orcon: unplug, plug back in, and start binding **within 2 minutes**. Other
brands: see your unit's manual (look for *registering a remote* or *pairing*).

### The mode in Homey doesn't match the unit

- By default Homey asks the unit for its status every 5 minutes. To see it sooner, use the card *Ask the unit for its
  status* or lower *Ask for status every*.
- Some units don't report their mode, only their speed. Homey then derives the mode from what the remotes send.
- Is the mode consistently wrong (e.g. *auto* where it says *high*)? Choose the right [brand](ventilation-unit#brand).

## Finding devices

### My unit, remote or sensor isn't in the list

- **Unit**: press a button on the remote and only then continue. The unit answers and is heard that way.
- **Remote**: press a button while searching.
- **Sensor**: sensors report every few minutes. Press the sensor's button if it has one, or wait a little longer and
  try again.
- Check in the [device finder](dashboard#device-finder) whether the device is heard at all. If not, it's probably too
  far from the ramses_esp.

### I see several ventilation units

In apartment buildings the gateway also hears the neighbours' units. Add **only your own unit**. Its address is on the
type plate or in your old configuration. Never send test commands to other people's units.

### Suddenly I see *Unknown* devices

Those are devices the app can't place yet, for example the neighbours', or a different kind of RAMSES device (such as
an evohome thermostat). They do no harm.

## Values

### Tiles are missing (CO₂, temperature, filter…)

Capabilities only appear once the unit reports them. Give it a few minutes, or use *Ask the unit for its status*. If a
value never shows up, your unit doesn't have that sensor or doesn't report it over RAMSES.

### The fan speed is a number from 0 to 4

Some units don't report a percentage but a **step number**. That's what the unit itself says; the app doesn't convert
it.

### *Parameters: Supported by this unit: No*

Your unit has no parameters that can be read over RAMSES. That's normal for mechanical extract units (such as an Orcon
MVS-15); only heat recovery units have them.

## Logs for a bug report

Something not working as expected? Open an [issue](https://github.com/starredev/homey-ramses-esp/issues) and include:

1. The brand and model of your unit (also shown under *Settings → Bus → Model*).
2. A piece of **live traffic** from the [bus view](dashboard#live-traffic) around the moment it goes wrong. Filter on
   your unit's address.
3. What you did, what you expected and what happened.
4. Optionally a diagnostics report: *Apps → RAMSES ESP → Send diagnostics report*.
