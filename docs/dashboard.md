---
title: Widget and bus view
parent: English
nav_order: 7
---

# Widget and bus view
{: .no_toc }

The ventilation on your dashboard, and a look under the hood.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>On this page</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Dashboard widget *Ventilation*

The app has a widget for Homey dashboards.

1. Open a dashboard and choose **Edit → + Widget → RAMSES ESP → Ventilation**.
2. Under *Ventilation unit*, choose which unit the widget shows.

The widget shows:

- a **spinning fan** that turns faster the higher the mode,
- the **current mode**, and where available the speed and CO₂,
- a green or grey dot for **available / unavailable**,
- **buttons** to pick a mode right away.

The widget works in the light and dark theme.

## Bus view

Go to **Apps → RAMSES ESP → Configure**. There you'll find four parts.

### Gateways

Every gateway you added, with its status: *connected*, *not connected* or *gateway offline*.

### Device finder

A table of **every device the gateways have heard**:

| Column | Meaning |
|---|---|
| **Address** | The RAMSES address, e.g. `29:233244` |
| **Role** | Gateway, Ventilation unit, Remote, Sensor or Unknown |
| **Sends** | The message codes the device sends |
| **Last seen** | When the device last said something |
| **In Homey** | Whether the device has been added as a Homey device |

The role is determined from the messages a device sends. A device reporting `31DA` or `31D9` is a unit, a device
sending `22F1` is a remote, and so on.

{: .tip }
Handy to find your **own** unit in an apartment building: press your remote and see which unit reports something
shortly after.

### Live traffic

A running list of all packets on the bus, **with decoded values** (e.g. *mode: high*, *CO₂: 612 ppm*).

- **Pause / Resume**: freeze the list to read it at your leisure.
- **Clear**: empty the list.
- **Filter**: only show packets with a certain address or code, e.g. `29:233244` or `31DA`.

Packets Homey sent itself are marked as **echo**.

### Sending a frame

Type a complete RAMSES II frame and click **Send**. It goes on air unchanged through the first connected gateway. For
example:

```text
RQ --- 18:203612 29:233244 --:------ 31DA 001 00
```

asks unit `29:233244` for its full status. See [Protocol](protocol) for how a frame is built.

{: .warning }
A wrong frame can change a unit's settings. Only send to your own devices.
