# RAMSES ESP for Homey

[![CI](https://github.com/starredev/homey-ramses-esp/actions/workflows/ci.yml/badge.svg)](https://github.com/starredev/homey-ramses-esp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Homey app for 868 MHz RAMSES II devices (ventilation units, remotes and CO₂/humidity sensors from brands such as
Orcon, Itho, Vasco and ClimaRad) through a [ramses_esp](https://github.com/IndaloTech/ramses_esp) gateway.
The app talks to the MQTT broker the ramses_esp already publishes to, for example the MQTT Broker app on Homey
itself. No Home Assistant, no websocket bridge, and no reflashing needed.

📖 **Documentation:** [English](https://starredev.github.io/homey-ramses-esp/) · [Nederlands](https://starredev.github.io/homey-ramses-esp/nl/)
— installation, binding, flows, widget and troubleshooting.

> **Unofficial community project.** Not made or endorsed by any of the brands above or by the ramses_esp authors.

## Features

**Gateway**. Enter the broker address and the app finds the ramses_esp gateways on it. The gateway listens to the
bus all the time and remembers every device it hears, across restarts.

**Ventilation unit**
| Capability | Source |
|---|---|
| Fan mode (low / medium / high / auto), settable | `22F1` from remotes, `31DA` from the unit |
| Fan speed (% or speed step), supply fan speed | `31D9`, `31DA` |
| CO₂, humidity, indoor / outdoor / supply / exhaust temperature | `31DA` |
| Bypass position, air quality, boost time left | `31DA` |
| Filter days left | `10D0` |

Capabilities appear when the unit reports them, so a unit without a CO₂ sensor never shows an empty CO₂ tile.
Homey asks the unit for its status every few minutes (configurable).

**Remote**. A physical remote becomes a flow trigger: *the High button was pressed*. A press arrives as a burst
of identical radio frames; the app counts it once. Commands Homey sends in the remote's name do not trigger it.

**Sensor**. CO₂, humidity, temperature and battery of room sensors.

**Homey CO₂ sensor**. Homey plays a RAMSES CO₂ sensor of its own and binds it to your unit from the device's
maintenance menu: power-cycle the unit, tap *Bind to a unit*, done. A flow then passes on the CO₂ or humidity of
any Homey sensor (Zigbee, Wi-Fi, a Sensy, a Netatmo), and the unit in *Auto* ventilates on it next to its own
sensors. Homey derives the ventilation demand from a configurable curve and repeats it every 5 minutes, like a real
sensor. Verified on an Orcon unit with a CO2 15RF already bound; see
[the docs](https://starredev.github.io/homey-ramses-esp/homey-co2-sensor) for the frames.

**Flow cards**

- *When:* the fan mode changed (to …) · a boost started · a button was pressed (any, or a specific one) ·
  a packet was received (any, or with a code from or to an address) · a new device was found on the bus ·
  the gateway went offline / came online
- *And:* the fan mode is … · the gateway is online
- *Then:* set the fan mode · run on high for N minutes · reset the filter counter · ask the unit for its status ·
  send a raw frame · send a command (verb, code, payload, address)

**Bus view** (*Apps → RAMSES ESP → Configure*). Live traffic with decoded values, the device finder with the
role of every device on the bus and whether it is added to Homey, and a form to send a frame.

## Requirements

- A **ramses_esp** (868 MHz) connected to an MQTT broker, publishing on `RAMSES/GATEWAY/<id>/rx`.
- Homey Pro (2023) or Homey Pro mini with firmware **12.4 or newer**.
- To control a unit: the address of a remote (or sensor) the unit is **bound** to. The unit only obeys devices
  it is bound to, so Homey sends commands in that device's name. The app fills it in when it has heard such a
  device on the bus; use the same remote ID as in an old Home Assistant / ramses_cc setup.

## Installation

Install the test version from the Homey App Store:
**[homey.app/a/io.github.starredev.ramses/test](https://homey.app/a/io.github.starredev.ramses/test/)**.
No computer or Homey CLI needed. To run your own build, see [Development](#development).

Then add the devices in this order:

1. **Devices → + → RAMSES ESP → ramses_esp gateway.** Enter the broker (Homey's own address when you use the MQTT
   Broker app), then pick the gateway.
2. **Ventilation unit**, **Remote** and **Sensor**. Homey lists what the gateway heard. When a device is missing,
   press a button on it (or on the remote) and continue.

## Troubleshooting

- **The unit does not react to Homey.** Check *Remote address* in the unit's settings. It must be a device the
  unit is bound to. The device warns you when it is empty.
- **"Connected, but no ramses_esp published anything."** Check the MQTT settings of the ramses_esp, or type its
  address (shown in its web interface, `18:xxxxxx`) in the pairing form.
- **You see several ventilation units.** In apartment buildings the gateway also hears the neighbours' units.
  Add only your own; its address is on the unit's label or in your old configuration.

## Development

```bash
npm install
npm run check      # lint, type-check, tests with coverage, manifest validation
npm test           # tests only
homey app run      # run on your Homey (needs Docker)
```

The code is organised in layers. Everything below `lib/homey` runs under plain `node --test` without Homey.

```
lib/
  ramses/    protocol: Packet (value object), decoders per message code, commands, BusScanner
  mqtt/      connection: BrokerConfig (value object), GatewayConnection, BrokerProbe
  domain/    models: Gateway, FanUnit, Remote, ClimateSensor, domain events, RepeatFilter
  homey/     adapters: GatewayRegistry, capability bindings, flow cards, pairing, presenter, web API
drivers/     thin Homey drivers and devices
settings/    the bus view
```

Dependencies are injected (MQTT `connect`, clock, timers, send function), so tests drive the whole chain with
fakes, from an MQTT message to a flow trigger.

## Protocol notes

- Frames on `rx`/`tx` are wrapped as `{"msg": "<frame>"}`; Homey's own transmissions are heard back and marked as
  echo, so they never count as a remote press.
- `22F1` payload `00 RR 04`: RR 01 low, 02 medium, 03 high, 04 auto. `22F3` payload `00 UU DD`: a boost of DD
  minutes (UU 00) or hours (UU 01).
- `31D9`: with status byte `FF` the speed is in half percent; with `00` (seen as `000000`–`000004` on live
  buses) it is the speed step.
- The `31DA` layout follows [ramses_rf](https://github.com/zxdavb/ramses_rf). Brands differ in details; values
  that a unit marks as unavailable are left out.

## License

[MIT](LICENSE) © 2026 Bryan.
