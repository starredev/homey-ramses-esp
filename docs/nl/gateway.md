---
title: Gateway toevoegen
nav_order: 3
---

# De gateway toevoegen
{: .no_toc }

De gateway is de verbinding tussen Homey en je ramses_esp. Alle andere apparaten lopen erdoorheen.
{: .fs-6 .fw-300 }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Toevoegen

1. Ga naar **Apparaten → + → RAMSES ESP → Ramses Gateway**.
2. Vul de gegevens van de **MQTT-broker** in:

   | Veld | Voorbeeld | Toelichting |
   |---|---|---|
   | Brokeradres | `192.168.1.20` | Met de MQTT Broker-app is dit het IP-adres van je Homey. Homey vult het vaak al in. |
   | Poort | `1883` | `8883` bij TLS, tenzij je broker anders is ingesteld. |
   | Gebruikersnaam / wachtwoord | | Leeg laten als je broker geen inlog vraagt. |
   | TLS gebruiken (mqtts) | uit | Alleen aanzetten als je broker versleuteld luistert. |
   | Gateway-adres (optioneel) | `18:203612` | Alleen nodig als Homey de ramses_esp niet zelf vindt. |

3. Klik op **Gateways zoeken**. Homey verbindt met de broker, luistert een paar seconden naar alle
   `RAMSES/GATEWAY/...`-topics en toont elke ramses_esp die het hoort.
4. Kies je gateway en klik op **Volgende**.

Het nieuwe apparaat heet *Ramses Gateway*. Hernoem het gerust.

## Wat de gateway laat zien

| Capability | Betekenis |
|---|---|
| **Gateway-adres** | Het RAMSES-adres van de ramses_esp, bv. `18:203612`. |
| **Apparaten op de bus** | Hoeveel verschillende apparaten de gateway tot nu toe heeft gehoord. |
| **Laatste pakket** | Het laatste ontvangen pakket, in leesbare vorm. |

De gateway luistert continu en **onthoudt elk apparaat** dat hij hoort, ook na een herstart van Homey. Daardoor kan
Homey bij het toevoegen van een unit, remote of sensor meteen een lijst laten zien.

### Beschikbaarheid

| Situatie | Wat je ziet |
|---|---|
| Homey verbindt nog met de broker | *Verbinden met de MQTT-broker…* |
| De broker is onbereikbaar | Apparaat onbeschikbaar: *MQTT-broker niet bereikbaar*. Homey blijft opnieuw proberen. |
| Gebruikersnaam of wachtwoord fout | *De MQTT-broker weigerde de gebruikersnaam of het wachtwoord.* Pas ze aan in de instellingen. |
| De ramses_esp meldt zich offline | *De ramses_esp meldt dat hij offline is. Controleer stroom en wifi.* |

## Instellingen

Onder *Apparaat → Instellingen* kun je de brokergegevens later wijzigen (host, poort, gebruiker, wachtwoord, TLS).
Na opslaan verbindt de gateway opnieuw. Het gateway-adres is alleen ter informatie.

## Meerdere gateways

Je kunt meer dan één ramses_esp toevoegen, bijvoorbeeld als je huis te groot is voor één radio. Elke ventilatie-unit,
remote en sensor onthoudt via welke gateway hij gevonden is en verstuurt zijn commando's ook via die gateway.

## Flowkaarten van de gateway

De gateway heeft kaarten voor geavanceerd gebruik: reageren op elk pakket op de bus, ruwe frames versturen en
weten of de gateway online is. Zie [Flows → Gateway](flows#gateway).

## Als het niet lukt

| Melding bij het zoeken | Oplossing |
|---|---|
| *Geen MQTT-broker antwoordde op dit adres.* | Controleer IP-adres en poort, en of de broker-app draait. |
| *De broker weigerde de gebruikersnaam of het wachtwoord.* | Controleer de inloggegevens in de broker-app. |
| *Verbonden, maar geen ramses_esp publiceerde iets op deze broker.* | De ramses_esp is niet met deze broker verbonden. Controleer zijn MQTT-instellingen, of vul zijn adres (`18:xxxxxx`) in bij *Gateway-adres*. |

Meer in [Problemen oplossen](problemen-oplossen).
