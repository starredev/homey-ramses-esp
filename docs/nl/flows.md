---
title: Flows
parent: Nederlands
nav_order: 6
---

# Flows
{: .no_toc }

Alle flowkaarten van de app, met voorbeelden.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Ventilatie-unit

### Als…

| Kaart | Tags | Toelichting |
|---|---|---|
| **De ventilatiestand veranderde** | *Stand*, *Veranderd door* | Bij elke standwijziging. *Veranderd door* is `homey`, `remote` of `unit`. |
| **De ventilatiestand veranderde naar [stand]** | | Alleen bij een bepaalde stand. |
| **Een boost is gestart** | *Minuten*, *Gestart door* | Ook als iemand de boost op de remote start. |
| **De unit meldde een storing** | | |
| **De storing van de unit is weg** | | |
| **Het filter moet vervangen worden** | | Als de unit zijn filteralarm aanzet. |

### En…

| Kaart |
|---|
| **De ventilatiestand is / is niet [stand]** |
| **De unit heeft / heeft geen storing** |

### Dan…

| Kaart | Toelichting |
|---|---|
| **Zet de ventilatiestand op [stand]** | Laag, midden, hoog, auto, afwezig of uit (wat je merk ondersteunt). |
| **Draai [minuten] minuten op hoog** | Boost van 1–255 minuten; daarna valt de unit terug. |
| **Zet de bypass op [auto / open / dicht]** | Alleen voor units met bypass. |
| **Zet [parameter] op [waarde]** | Voor WTW-units met parameters. Begin te typen om een parameter te zoeken. |
| **Zet de filterteller terug** | Na het vervangen van het filter. |
| **Vraag de status van de unit op** | Laat de unit direct al zijn waarden melden. |

## Afstandsbediening en sensor

### Als…

| Kaart | Tags |
|---|---|
| **De knop [Laag / Midden / Hoog / Auto / Afwezig / Uit / Boost] werd ingedrukt** | *Boost-minuten* |
| **Een willekeurige knop werd ingedrukt** | *Knop*, *Boost-minuten* |

De kaart *Een willekeurige knop* geeft in *Knop* het woord `low`, `medium`, `high`, `auto`, `away`, `off` of `boost`.

## Virtuele CO₂-sensor

### Dan…

| Kaart |
|---|
| **Meld [ppm] ppm CO₂** |
| **Meld [%] % vochtigheid** |
| **Vraag de unit om [%] % ventilatie** |

Zie [Virtuele CO₂-sensor](homey-co2-sensor) voor de uitleg.

## Gateway

Deze kaarten zijn voor wie dieper wil gaan. Je hebt er wat kennis van het [protocol](protocol) voor nodig.

### Als…

| Kaart | Toelichting |
|---|---|
| **Er werd een pakket ontvangen** | Gaat af bij **elk** pakket op de bus. Kan druk zijn! |
| **Er werd een [code]-pakket ontvangen van of naar [adres]** | Filter op berichtcode en adres. Adres `*` past op elk apparaat. |
| **Er werd een nieuw apparaat op de bus gevonden** | Tags *Adres* en *Rol* (`fan`, `remote`, `sensor`, `gateway`, `unknown`). |
| **De gateway ging offline** | |
| **De gateway kwam online** | |

De pakkettriggers hebben deze tags:

| Tag | Voorbeeld |
|---|---|
| *Werkwoord* | `I`, `RQ`, `RP` of `W` |
| *Van* | `29:173894` |
| *Naar* | `29:233244` |
| *Code* | `22F1` |
| *Payload* | `000304` |
| *Frame* | ` I --- 29:173894 29:233244 --:------ 22F1 003 000304` |
| *Signaal (RSSI)* | `45` |

### En…

| Kaart |
|---|
| **De gateway is / is niet online** |

### Dan…

| Kaart | Toelichting |
|---|---|
| **Verstuur frame [frame]** | Een volledig RAMSES II-frame, precies zoals het op de bus hoort. |
| **Verstuur [werkwoord] [code] met payload [payload] naar [adres]** | Wordt verstuurd vanaf het eigen adres van de gateway. |

{: .waarschuwing }
Met ruwe frames kun je alles versturen, ook naar de units van je buren. Stuur alleen commando's naar je eigen
apparaten en test met *RQ* (opvragen) voordat je *W* (schrijven) gebruikt.

## Voorbeelden

### Douche: boost bij hoge luchtvochtigheid

> **Als** de luchtvochtigheid van *Sensor badkamer* veranderde<br>
> **En** de luchtvochtigheid is groter dan 75 %<br>
> **En** *Ventilatie* — de ventilatiestand is niet *Hoog*<br>
> **Dan** *Ventilatie* — Draai **30** minuten op hoog

### Iedereen weg: afwezigstand

> **Als** de laatste persoon het huis verliet<br>
> **Dan** *Ventilatie* — Zet de ventilatiestand op **Afwezig**

> **Als** de eerste persoon thuiskwam<br>
> **Dan** *Ventilatie* — Zet de ventilatiestand op **Auto**

### Koken: boost als de afzuigkap aangaat

> **Als** het vermogen van *Stekker afzuigkap* groter werd dan 50 W<br>
> **Dan** *Ventilatie* — Draai **20** minuten op hoog

### Melding bij een vuil filter

> **Als** *Ventilatie* — Het filter moet vervangen worden<br>
> **Dan** stuur een pushmelding: *Het WTW-filter moet vervangen worden.*

En na het vervangen, met een knop of een spraakopdracht:

> **Dan** *Ventilatie* — Zet de filterteller terug

### Remote als scèneknop

> **Als** *Remote woonkamer* — De knop **Hoog** werd ingedrukt<br>
> **Dan** zet de lampen in de woonkamer op 100 %

De unit reageert ook gewoon op de knop; Homey luistert alleen mee.

### Weten wie de stand veranderde

> **Als** *Ventilatie* — De ventilatiestand veranderde<br>
> **En** *Veranderd door* is `remote`<br>
> **Dan** log: *Iemand zette de ventilatie op [Stand].*

### Waarschuwing bij een offline gateway

> **Als** *Ramses Gateway* — De gateway ging offline<br>
> **Dan** stuur een pushmelding: *De ramses_esp is offline.*

### Elke CO₂-sensor in huis laat de unit reageren

Zie [Virtuele CO₂-sensor](homey-co2-sensor#waarden-doorgeven-met-flows).
