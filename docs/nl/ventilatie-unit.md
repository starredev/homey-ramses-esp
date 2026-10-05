---
title: Ventilatie-unit
parent: Nederlands
nav_order: 3
redirect_from:
  - /ventilatie-unit/
  - /ventilatie-unit.html
---

# De ventilatie-unit
{: .no_toc }

Toevoegen, bedienen en instellen van je WTW- of mechanische ventilatie-unit.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Toevoegen

1. Ga naar **Apparaten → + → RAMSES ESP → Ventilatie-unit**.
2. Homey laat de units zien die de gateway al gehoord heeft. Staat je unit er niet tussen? Druk op een knop van je
   afstandsbediening, wacht een paar seconden en ga verder. De unit antwoordt en verschijnt in de lijst. Homey zoekt
   tot 30 seconden.
3. Kies je unit en klik op **Volgende**.

{: .waarschuwing }
**Woon je in een appartementencomplex?** Dan hoort de gateway vaak ook de units van de buren. Voeg alleen je eigen
unit toe. Het adres staat op het typeplaatje van de unit, of als *FAN ID* in je oude Home Assistant- of
ramses_cc-configuratie. Twijfel je? Kijk in de [busweergave](dashboard#busweergave) welke unit reageert als je op
je eigen remote drukt.

## Zorgen dat Homey de unit mag bedienen

Een RAMSES-unit voert alleen commando's uit van apparaten waaraan hij **gekoppeld** (*bound*) is. Homey moet zich
daarom voordoen als zo'n apparaat. Er zijn twee manieren:

### Manier 1: het adres van een bestaande remote gebruiken

Homey verstuurt commando's dan *namens* een remote die de unit al kent.

- Heeft de gateway een remote gehoord die met deze unit praat, dan vult Homey het adres bij het toevoegen
  **automatisch** in.
- Anders vul je het zelf in: *Apparaat → Instellingen → Bediening → Adres van de afstandsbediening*, bv.
  `29:173894`.
- Kwam je van Home Assistant met ramses_cc? Gebruik dan hetzelfde (eventueel *gefakete*) remote-adres als daar.

Zolang het veld leeg is, toont het apparaat een waarschuwing: *Stel het adres in van een afstandsbediening waaraan de
unit gekoppeld is.*

### Manier 2: Homey koppelen als afstandsbediening

Homey kan zichzelf ook als nieuwe, eigen afstandsbediening aan de unit koppelen. Je hebt dan geen bestaand
remote-adres nodig.

1. Zet de unit in **koppelmodus**. Bij Orcon: haal de stekker van de unit eruit en steek hem er weer in. De unit
   staat daarna ongeveer 2 minuten open voor nieuwe apparaten.
2. Open in Homey het apparaat → **Instellingen** (tandwiel) → **Onderhoud** → **Koppel Homey als afstandsbediening**.
3. Homey kiest een vrij adres (`29:xxxxxx`), biedt zich elke 5 seconden aan en wacht maximaal 90 seconden tot de
   unit accepteert.
4. Gelukt? Dan staat het nieuwe adres bij *Adres van de afstandsbediening* en kun je de unit bedienen.

Alleen *deze* unit mag de koppeling accepteren, dus een buur-unit die toevallig ook in koppelmodus staat, wordt niet
per ongeluk gekoppeld.

{: .tip }
Krijg je *Geen unit antwoordde*? Dan stond de unit niet (meer) in koppelmodus. Herhaal stap 1 en start de koppeling
binnen 2 minuten.

## Bedienen

### Ventilatiestand

De kaart van het apparaat heeft een keuzelijst **Ventilatiestand**:

| Stand | Betekenis |
|---|---|
| **Laag** | Basisventilatie |
| **Midden** | Normaal |
| **Hoog** | Maximaal |
| **Auto** | De unit regelt zelf op basis van zijn sensoren (CO₂, vocht) |
| **Afwezig** | Minimale ventilatie |
| **Uit** | Alleen als het merk dat ondersteunt |

Niet elk merk kent elke stand. Kies je een stand die jouw merk niet heeft, dan meldt Homey welke standen wel kunnen.

De stand wordt ook bijgewerkt als iemand de **fysieke remote** gebruikt; Homey hoort dat op de bus. Op de tegel in
het dashboard staat de stand als woord (*Status*).

### Boost

Met de flowkaart *Draai N minuten op hoog* draait de unit tijdelijk op hoog en valt daarna terug. Een boost duurt 1 tot
255 minuten. Bij Orcon gebruikt Homey dezelfde lange boost als de echte remote (hoog, daarna auto).

### Bypass

Heeft je unit een bypass (de meeste WTW-units), dan verschijnt de keuzelijst **Bypass** zodra de unit zijn
bypassstand meldt: **Auto**, **Open** of **Dicht**. Ook via de flowkaart *Zet de bypass op …*.

### Filter

- **Filter: dagen over** en **Filter: resterend** tonen hoe lang het filter nog mee kan.
- **Filter vervangen** (alarm) gaat aan als de unit meldt dat het filter vervangen moet worden.
- Na het vervangen zet je de teller terug met de flowkaart **Zet de filterteller terug**.

## Wat de unit laat zien

Capabilities verschijnen **pas als de unit ze meldt**. Een unit zonder CO₂-sensor krijgt dus nooit een lege
CO₂-tegel. Na het toevoegen kan het daarom een paar minuten duren voordat alles er staat.

| Capability | Wanneer |
|---|---|
| Ventilatiestand, Status | Altijd |
| Ventilatorsnelheid, Snelheid toevoerventilator | Als de unit zijn snelheid meldt (`31D9`, `31DA`) |
| CO₂, Luchtvochtigheid, Temperatuur | Units met eigen sensoren |
| Buitentemperatuur, Temperatuur toevoerlucht, Temperatuur afvoerlucht, Buitenluchtvochtigheid | WTW-units |
| Toevoerdebiet, Afvoerdebiet (l/s) | Units die hun debiet melden |
| Bypass-stand (%), Bypass (instelbaar) | Units met bypass |
| Voorverwarmer, Naverwarmer (%) | Units met verwarmingselementen |
| Luchtkwaliteit (%) | Units met een luchtkwaliteitssensor |
| Boost: resterende tijd | Tijdens een boost |
| Filter: dagen over, Filter: resterend, Filter vervangen | Units die hun filterstatus melden (`10D0`, `31DA`) |
| Storing, Vorstbeveiliging | Als de unit die toestand meldt |

Alle numerieke waarden en alarmen worden in **Insights** bijgehouden.

## Instellingen

### Bediening

| Instelling | Standaard | Toelichting |
|---|---|---|
| **Adres van de afstandsbediening** | automatisch | Namens dit adres verstuurt Homey commando's. Zie [hierboven](#zorgen-dat-homey-de-unit-mag-bedienen). |
| **Merk** | Automatisch | Zie [Merk](#merk). |
| **Status opvragen elke** | 5 min | Hoe vaak Homey de unit om zijn status vraagt. `0` zet dat uit; de unit meldt zich daarnaast ook zelf. |

### Merk

Merken gebruiken dezelfde berichten, maar **nummeren hun standen anders**. Hetzelfde commando betekent *Auto* op een
Orcon en *Hoog* op een Itho. Met **Automatisch** gebruikt Homey de Orcon-nummering en schakelt het over zodra de
remotes van de unit een ander merk verraden (Vasco/ClimaRad en Nuaire zijn herkenbaar). Itho is niet van Orcon te
onderscheiden: **heb je een Itho, kies dan zelf Itho.**

| Merk | Standen |
|---|---|
| Orcon | afwezig, laag, midden, hoog, auto, uit |
| Itho | uit, afwezig, laag, midden, hoog |
| Vasco | uit, afwezig, laag, midden, hoog, auto |
| ClimaRad | uit, afwezig, laag, midden, hoog, auto |
| Nuaire | midden, hoog |

### Parameters (WTW)

Warmteterugwinunits (Orcon HRC, Vasco, ClimaRad en andere) hebben interne parameters. Homey leest ze na het
toevoegen uit; *Ondersteund door deze unit* toont daarna **Ja** of **Nee**. Wijzig je een waarde en sla je op, dan
schrijft Homey die naar de unit.

| Parameter | Bereik |
|---|---|
| Filter vervangen na | 0–1800 dagen |
| Afwezig: toevoer / afvoer | 0–40 % |
| Laag: toevoer / afvoer | 0–75 % |
| Midden: toevoer / afvoer | 0–75 % |
| Hoog: toevoer / afvoer | 0–100 % |
| Boost: toevoer en afvoer | 0–100 % |
| Timer nachtstand, afwezig, hoog, laag, minimum | 0–180 min |
| Nalooptijd vochtsensor | 15–60 min |
| Temperatuurgrens afvoer / toevoer | 5–25 °C |
| Comforttemperatuur | 0–30 °C |
| Timer bypass handmatig | 0–180 min |
| Grens zomerstand | 15–25 °C |
| Grens winterstand | 5–15 °C |
| Hysterese bypass | 0,5–5 °C |
| Grens voorverwarmer | −15 tot −5 °C |
| Hysterese voorverwarmer | 0,5–5 °C |

{: .waarschuwing }
Parameters veranderen het gedrag van je unit blijvend. Noteer de oude waarde voordat je iets aanpast. Te lage
ventilatie kan leiden tot vocht- en schimmelproblemen.

Parameters zijn ook vanuit een flow te zetten met **Zet [parameter] op [waarde]**.

### Bus

Alleen ter informatie: het **type** van de unit (als hij dat meldt, bv. `VMC-15RP01`), het **adres** en de
**gateway** waarlangs hij gevonden is.
