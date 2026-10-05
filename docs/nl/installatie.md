---
title: Installatie
nav_order: 2
---

# Installatie
{: .no_toc }

Van een losse ramses_esp tot een werkende app op je Homey.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Wat heb je nodig?

| Onderdeel | Toelichting |
|---|---|
| **Homey Pro (2023)** of **Homey Pro mini** | Firmware **12.4 of nieuwer**. De app draait lokaal; Homey Cloud wordt niet ondersteund. |
| **ramses_esp** | Een ESP32 met 868 MHz-radio en de [ramses_esp](https://github.com/IndaloTech/ramses_esp)-firmware, verbonden met je wifi. |
| **MQTT-broker** | Waar de ramses_esp naartoe publiceert. Het makkelijkst is de *MQTT Broker*-app op Homey zelf; Mosquitto op een NAS of Raspberry Pi werkt net zo goed. |
| **Een RAMSES II-ventilatiesysteem** | Orcon, Itho, Vasco, ClimaRad of Nuaire op 868 MHz. |

{: .tip }
Plaats de ramses_esp ergens tussen je Homey-wifi en de ventilatie-unit in. 868 MHz komt goed door muren, maar een
zolder met een betonvloer ertussen kan net te veel zijn. De [busweergave](dashboard#busweergave) laat de
signaalsterkte (RSSI) van elk pakket zien.

## 1. De MQTT-broker

De ramses_esp en Homey praten niet rechtstreeks met elkaar, maar via een MQTT-broker.

### Optie A: de MQTT Broker-app op Homey (aanbevolen)

1. Installeer de app **MQTT Broker** uit de Homey App Store.
2. Open *Apps → MQTT Broker → Instellen* en controleer dat de broker op poort **1883** luistert.
3. Maak een gebruiker aan (aanbevolen) en noteer gebruikersnaam en wachtwoord.
4. Noteer het **IP-adres van je Homey** (*Instellingen → Algemeen → Over*). Dat is straks het brokeradres.

{: .let_op }
Geef je Homey een vast IP-adres in je router (DHCP-reservering). Verandert het adres, dan verliest de ramses_esp
de verbinding met de broker.

### Optie B: een bestaande broker

Gebruik je al Mosquitto (bijvoorbeeld van een oude Home Assistant-installatie)? Dan kun je die gewoon houden.
Zorg alleen dat Homey de broker kan bereiken en dat je de gebruikersnaam en het wachtwoord hebt. TLS (`mqtts`) wordt
ondersteund.

## 2. De ramses_esp instellen

Homey kan niet via USB-serial met de stick praten, dus de ramses_esp moet via **wifi** naar de MQTT-broker. Dat stel
je **één keer** in via de seriële console. Daarna heeft de stick alleen nog stroom nodig: een USB-lader of een vrije
USB-poort volstaat.

{: .info }
**Kom je van Home Assistant?** Daar hing de stick meestal via USB-serial aan de Raspberry Pi. Haal hem eruit en
configureer hem zoals hieronder. Je ramses_cc-configuratie heb je daarna niet meer nodig, maar bewaar het
*FAN ID* en het remote-adres: die heb je straks [in Homey](ventilatie-unit#manier-1-het-adres-van-een-bestaande-remote-gebruiken) nodig.

### Seriële console openen

1. Stop de ramses_esp in een pc met Windows, macOS of Linux.
2. Open een seriële terminal op de juiste poort met **115200 baud**:
   - **Windows**: [PuTTY](https://www.putty.org/), verbindingstype *Serial*. De COM-poort vind je in
     *Apparaatbeheer → Poorten (COM & LPT)*.
   - **macOS / Linux**: bijvoorbeeld `screen /dev/ttyUSB0 115200` (op macOS iets als `/dev/tty.usbserial-…`).
3. Druk op **Enter**. Je krijgt de prompt van de ramses_esp.

### Wifi en MQTT instellen

Typ de commando's één voor één. Ze zijn **hoofdlettergevoelig**.

```text
wifi password JOUW_WIFI_WACHTWOORD
wifi ssid JOUW_WIFI_SSID
wifi restart
mqtt user JOUW_MQTT_GEBRUIKER
mqtt password JOUW_MQTT_WACHTWOORD
mqtt broker mqtt://192.168.1.20:1883
sntp server pool.ntp.org
timezone CET
reset
```

| Commando | Wat het doet |
|---|---|
| `wifi password` / `wifi ssid` | Het wachtwoord en de naam van je wifinetwerk. Gebruik een **2,4 GHz**-netwerk; een ESP32 ondersteunt geen 5 GHz. |
| `wifi restart` | Verbindt opnieuw met de nieuwe wifigegevens. |
| `mqtt user` / `mqtt password` | De gebruiker die je in de broker-app hebt aangemaakt. Laat weg als je broker geen inlog vraagt. |
| `mqtt broker` | Het adres van de broker. Met de MQTT Broker-app is dat `mqtt://<IP van je Homey>:1883`. |
| `sntp server` / `timezone` | Tijdsynchronisatie, zodat de tijdstempels in de berichten kloppen. |
| `reset` | Herstart de ramses_esp met de nieuwe instellingen. |

{: .let_op }
**Zet het wachtwoord altijd vóór de ssid- of brokerregel.** Zodra de ramses_esp een ssid of broker krijgt, probeert
hij meteen te verbinden. Staat het wachtwoord er dan nog niet in, dan mislukt die eerste poging.

Na de `reset` verbindt de stick met je wifi en de broker. Je kunt hem dan loskoppelen van de pc en ergens anders aan
de stroom hangen, het liefst halverwege je Homey-wifi en de ventilatie-unit.

Meer commando's en firmware-updates staan in de [documentatie van ramses_esp](https://github.com/IndaloTech/ramses_esp).

### Topics

Als het goed is, publiceert de ramses_esp daarna op deze topics:

| Topic | Richting | Inhoud |
|---|---|---|
| `RAMSES/GATEWAY/<id>` | ramses_esp → broker | Online/offline-status (ook als *last will*) |
| `RAMSES/GATEWAY/<id>/rx` | ramses_esp → broker | Elk pakket dat de radio hoort, als `{"msg": "<frame>"}` |
| `RAMSES/GATEWAY/<id>/tx` | broker → ramses_esp | Frames die de ramses_esp moet versturen |

`<id>` is het eigen adres van de ramses_esp, iets als `18:203612`. Dat zie je in de ramses_esp zelf en in de
topics; Homey vindt het meestal [vanzelf](gateway).

{: .info }
Wil je controleren of de ramses_esp publiceert voordat je de app installeert? Abonneer met een MQTT-client zoals
[MQTT Explorer](https://mqtt-explorer.com/) op `RAMSES/#`. Je hoort dan binnen een minuut verkeer van je unit,
je sensoren en, in een appartementencomplex, ook van de buren.

## 3. De app installeren

De app staat als **testversie** in de Homey App Store. Je installeert hem met één klik:

[Installeer RAMSES ESP op je Homey](https://homey.app/a/io.github.starredev.ramses/test/){: .btn .btn-primary }

1. Open de link hierboven en log in met je Homey-account.
2. Klik op **Installeren** en kies je Homey.
3. Na een paar seconden staat de app onder *Apps* op je Homey.

Je hebt geen computer, Node.js of Homey CLI nodig.

{: .info }
Een testversie is nog niet door Athom gekeurd en is niet te vinden via de zoekfunctie van de App Store, alleen via
deze link. Zodra de app officieel gepubliceerd is, vind je hem ook door op **RAMSES ESP** te zoeken.

Wil je zelf aan de app sleutelen? Zie dan [Ontwikkelen](ontwikkelen).

## 4. Apparaten toevoegen

Voeg de apparaten altijd in deze volgorde toe:

1. **[Ramses Gateway](gateway)**: zonder gateway hoort Homey niets van de bus.
2. **[Ventilatie-unit](ventilatie-unit)**
3. **[Afstandsbedieningen en sensoren](remotes-en-sensoren)** (optioneel)
4. **[Homey CO₂-sensor](homey-co2-sensor)** (optioneel)

Klaar? Ga verder met [de gateway toevoegen](gateway).
