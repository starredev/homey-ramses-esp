---
title: Widget en busweergave
parent: Nederlands
nav_order: 7
---

# Widget en busweergave
{: .no_toc }

De ventilatie op je dashboard, en een blik onder de motorkap.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Dashboardwidget *Ventilatie*

De app heeft een widget voor de Homey-dashboards.

1. Open een dashboard en kies **Bewerken → + Widget → RAMSES ESP → Ventilatie**.
2. Kies bij *Ventilatie-unit* welke unit de widget toont.

De widget laat zien:

- een **draaiende ventilator** die sneller draait naarmate de stand hoger is,
- de **huidige stand**, en waar beschikbaar snelheid en CO₂,
- een groen of grijs bolletje voor **beschikbaar / onbeschikbaar**,
- **knoppen** om direct een stand te kiezen.

De widget werkt in licht en donker thema.

## Busweergave

Ga naar **Apps → RAMSES ESP → Instellen**. Daar vind je vier onderdelen.

### Gateways

Elke toegevoegde gateway met zijn status: *verbonden*, *niet verbonden* of *gateway offline*.

### Apparatenzoeker

Een tabel met **elk apparaat dat de gateways gehoord hebben**:

| Kolom | Betekenis |
|---|---|
| **Adres** | Het RAMSES-adres, bv. `29:233244` |
| **Rol** | Gateway, Ventilatie-unit, Afstandsbediening, Sensor of Onbekend |
| **Verstuurt** | De berichtcodes die het apparaat verstuurt |
| **Laatst gezien** | Wanneer het apparaat voor het laatst iets zei |
| **In Homey** | Of het apparaat al als Homey-apparaat is toegevoegd |

De rol wordt bepaald aan de hand van welke berichten een apparaat verstuurt. Een apparaat dat `31DA` of `31D9`
meldt is een unit, een apparaat dat `22F1` verstuurt een remote, enzovoort.

{: .tip }
Handig om je **eigen** unit te vinden in een appartementencomplex: druk op je remote en kijk welke unit kort daarna
iets meldt.

### Live verkeer

Een doorlopende lijst van alle pakketten op de bus, **met gedecodeerde waarden** (bv. *stand: hoog*, *CO₂: 612 ppm*).

- **Pauzeren / Hervatten**: zet de lijst stil om rustig te lezen.
- **Wissen**: maak de lijst leeg.
- **Filter**: toon alleen pakketten met een bepaald adres of een bepaalde code, bv. `29:233244` of `31DA`.

Pakketten die Homey zelf verstuurde, worden als **echo** gemarkeerd.

### Een frame versturen

Typ een volledig RAMSES II-frame en klik op **Versturen**. Het gaat ongewijzigd via de eerste verbonden gateway de
lucht in. Bijvoorbeeld:

```text
RQ --- 18:203612 29:233244 --:------ 31DA 001 00
```

vraagt unit `29:233244` om zijn volledige status. Zie [Protocol](protocol) voor de opbouw van een frame.

{: .waarschuwing }
Een verkeerd frame kan de instellingen van een unit veranderen. Stuur alleen naar je eigen apparaten.
