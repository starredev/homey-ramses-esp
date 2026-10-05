---
title: Problemen oplossen
nav_order: 9
---

# Problemen oplossen
{: .no_toc }

<details open markdown="block">
  <summary>Op deze pagina</summary>
  {: .text-delta }
1. TOC
{:toc}
</details>

---

## Verbinding

### Homey vindt geen gateway

*Verbonden, maar geen ramses_esp publiceerde iets op deze broker.*

- Controleer in de ramses_esp of hij met **dezelfde broker** verbonden is (adres, poort, gebruiker, wachtwoord).
- Krijgt de ramses_esp geen wifi? Controleer via de [seriële console](installatie#2-de-ramses_esp-instellen) of de
  ssid en het wachtwoord kloppen (hoofdlettergevoelig) en of het een **2,4 GHz**-netwerk is.
- Heb je het wachtwoord ná de ssid- of brokerregel ingevoerd? Voer `wifi restart` of `reset` uit, zodat hij opnieuw
  verbindt.
- Kijk met een MQTT-client zoals [MQTT Explorer](https://mqtt-explorer.com/) of er iets onder `RAMSES/GATEWAY/`
  binnenkomt.
- Homey luistert ongeveer 4 seconden. Een ramses_esp die net opstart, is dan misschien nog niet zichtbaar. Vul in dat
  geval zijn adres (`18:xxxxxx`) in bij *Gateway-adres* en probeer opnieuw.

### *Geen MQTT-broker antwoordde op dit adres*

- Klopt het IP-adres? Bij de MQTT Broker-app is het het IP-adres van je Homey.
- Klopt de poort? Meestal `1883`, of `8883` met TLS.
- Draait de broker-app? Open hem en controleer de status.

### De gateway wordt steeds onbeschikbaar

- *MQTT-broker niet bereikbaar*: de broker is weg of het IP-adres van de broker is veranderd. Geef Homey (of je
  NAS) een vast IP-adres in je router.
- *De ramses_esp meldt dat hij offline is*: de ramses_esp heeft geen stroom of geen wifi. Kijk of hij bereikbaar is
  en of de wifi op die plek sterk genoeg is.

## Bediening

### De unit reageert niet op Homey

Dit is veruit het meest voorkomende probleem. De unit voert alleen commando's uit van apparaten waaraan hij
**gekoppeld** is.

1. Controleer *Instellingen → Bediening → Adres van de afstandsbediening* van de unit. Is het leeg, of is het niet
   een adres dat aan de unit gekoppeld is, dan negeert de unit Homey.
2. Weet je het adres van een gekoppelde remote niet? Druk op die remote en kijk in de
   [busweergave](dashboard#live-verkeer) welk adres een `22F1` naar je unit stuurt.
3. Of [koppel Homey zelf als afstandsbediening](ventilatie-unit#manier-2-homey-koppelen-als-afstandsbediening).
4. Komt het commando wel aan, maar doet de unit iets anders (bv. *hoog* in plaats van *auto*)? Dan klopt het
   [merk](ventilatie-unit#merk) niet. Kies het merk handmatig.

### *Geen unit antwoordde* bij het koppelen

De unit stond niet in koppelmodus. Bij Orcon: stekker eruit, stekker erin, en **binnen 2 minuten** de koppeling
starten. Bij andere merken: zie de handleiding van je unit (zoek op *remote aanmelden* of *pairing*).

### De stand in Homey klopt niet met de unit

- Homey vraagt de unit standaard elke 5 minuten om zijn status. Wil je het sneller zien, gebruik dan de kaart
  *Vraag de status van de unit op* of zet *Status opvragen elke* lager.
- Sommige units melden hun stand niet zelf, alleen hun snelheid. Homey leidt de stand dan af uit wat de remotes
  versturen.
- Klopt de stand structureel niet (bv. *auto* waar *hoog* staat)? Kies het juiste [merk](ventilatie-unit#merk).

## Apparaten vinden

### Mijn unit, remote of sensor staat niet in de lijst

- **Unit**: druk op een knop van de remote en ga dan pas verder. De unit antwoordt en wordt zo gehoord.
- **Remote**: druk tijdens het zoeken op een knop.
- **Sensor**: sensoren melden zich om de paar minuten. Druk op de knop van de sensor als die er een heeft, of wacht
  wat langer en probeer opnieuw.
- Kijk in de [apparatenzoeker](dashboard#apparatenzoeker) of het apparaat überhaupt gehoord wordt. Zo niet, dan is
  de afstand tot de ramses_esp waarschijnlijk te groot.

### Ik zie meerdere ventilatie-units

In appartementencomplexen hoort de gateway ook de units van de buren. Voeg **alleen je eigen unit** toe. Het adres
staat op het typeplaatje of in je oude configuratie. Stuur nooit testcommando's naar units van anderen.

### Ik zie ineens *Onbekend*-apparaten

Dat zijn apparaten die de app nog niet kan plaatsen, bijvoorbeeld van de buren, of een ander soort RAMSES-apparaat
(zoals een evohome-thermostaat). Ze doen geen kwaad.

## Waarden

### Er ontbreken tegels (CO₂, temperatuur, filter…)

Capabilities verschijnen pas als de unit ze meldt. Geef het een paar minuten, of gebruik *Vraag de status van de unit
op*. Komt een waarde nooit, dan heeft je unit die sensor niet of meldt hij hem niet via RAMSES.

### De ventilatorsnelheid is een getal van 0 tot 4

Sommige units melden geen percentage maar een **standnummer**. Dat is wat de unit zelf zegt; de app rekent het niet
om.

### *Parameters: Ondersteund door deze unit: Nee*

Je unit heeft geen parameters die via RAMSES te lezen zijn. Dat is normaal voor mechanische afzuigunits (zoals een
Orcon MVS-15); alleen WTW-units hebben ze.

## Logs voor een bugmelding

Werkt iets niet zoals verwacht? Open een [issue](https://github.com/starredev/homey-ramses-esp/issues) en voeg toe:

1. Het merk en type van je unit (staat ook onder *Instellingen → Bus → Type*).
2. Een stukje **live verkeer** uit de [busweergave](dashboard#live-verkeer) rond het moment dat het misgaat. Filter
   op het adres van je unit.
3. Wat je deed, wat je verwachtte en wat er gebeurde.
4. Eventueel een diagnoserapport: *Apps → RAMSES ESP → Stuur diagnoserapport*.
