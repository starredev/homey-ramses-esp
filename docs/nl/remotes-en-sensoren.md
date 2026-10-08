---
title: Remotes en sensoren
parent: Nederlands
nav_order: 4
redirect_from:
  - /remotes-en-sensoren/
  - /remotes-en-sensoren.html
---

# Afstandsbedieningen en sensoren
{: .no_toc }

Je bestaande draadloze knoppen en sensoren als Homey-apparaten.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Afstandsbediening

Een fysieke RAMSES-remote (bv. een Orcon 15RF of een Itho RFT) wordt in Homey een apparaat met de capability
**Laatste knop**. Elke knopdruk is een flow-trigger.

### Toevoegen

1. Ga naar **Apparaten → + → RAMSES ESP → Afstandsbediening**.
2. **Druk nu op een willekeurige knop van de remote** en klik op *Volgende*. Homey zoekt tot 30 seconden.
3. Kies de remote en voeg hem toe.

### Wat je ermee kunt

- **De knop [Laag / Midden / Hoog / Auto / Afwezig / Uit / Boost] werd ingedrukt**
- **Een willekeurige knop werd ingedrukt**, met de tags *Knop* en *Boost-minuten*

Voorbeelden staan op de pagina [Flows](flows#voorbeelden).

### Goed om te weten

- Een remote verstuurt elke druk als **een reeks identieke radioberichten**. Homey telt dat als één druk; je flow
  gaat dus maar één keer af.
- Commando's die **Homey zelf** namens deze remote verstuurt, worden herkend als echo en starten de trigger
  **niet**. Zo krijg je geen lussen als je flows de unit bedienen.
- Een remote stuurt de unit nog steeds rechtstreeks aan. Homey luistert mee; het hoeft niet tussen te zitten.

{: .tip }
Een remote hoeft niet aan je unit gekoppeld te zijn om als Homey-knop te werken. Een losse, ongekoppelde remote is
een prima draadloze scèneknop voor andere dingen in huis.

## Sensor

RAMSES-ruimtesensoren (bv. de Orcon CO2 15RF) worden een Homey-sensor met de waarden die ze uitzenden:

| Capability | Bron |
|---|---|
| CO₂ (ppm) | `1298` |
| Luchtvochtigheid (%) | `12A0` |
| Temperatuur | `12A0`, `12C0` |
| Ventilatievraag (%) | `31E0` |
| Aanwezigheid | `2E10` |
| Batterij, Batterij bijna leeg | `1060` |

Ook hier verschijnen alleen de capabilities die de sensor echt meldt.

### Toevoegen

1. Ga naar **Apparaten → + → RAMSES ESP → Ruimtesensor**.
2. Sensoren melden zich om de paar minuten. Wil je dat de jouwe zich meteen meldt, druk dan op een knop of zet hem
   in een andere stand (bv. van 1 naar 2, of naar auto).
3. Kies de sensor en voeg hem toe.

### Sensoren met knoppen

Sommige sensoren zijn tegelijk een bediening. De Orcon CO2 15RF heeft bijvoorbeeld knoppen voor *Auto* en *Hoog*.
Daarvoor zijn er dezelfde triggers als bij de remote:

- **De knop […] werd ingedrukt**
- **Een willekeurige knop werd ingedrukt**

## Naamgeving

Nieuwe apparaten heten *Afstandsbediening 29:123456* of *Sensor 37:044778*. Hernoem ze naar iets herkenbaars
(*Remote keuken*, *CO₂ woonkamer*). Het adres blijft zichtbaar onder *Instellingen → Bus*.

## Adressen herkennen

Elk RAMSES-apparaat heeft een adres `TT:NNNNNN`. De eerste twee cijfers zeggen iets over het soort apparaat:

| Begint met | Meestal |
|---|---|
| `18:` | Gateway (ramses_esp, HGI80) |
| `29:` | Afstandsbediening, of een Orcon-unit |
| `32:` | Ventilatie-unit (Itho, Vasco, ClimaRad) of remote |
| `37:` | CO₂-sensor / -bediening |

De app kijkt niet alleen naar het voorvoegsel maar vooral naar **welke berichten** een apparaat verstuurt. De rol die
hij zo bepaalt, zie je in de [apparatenzoeker](dashboard#apparatenzoeker).
