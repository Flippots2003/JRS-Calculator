# JRS Offertecalculator

Een Nederlandstalige, mobiele offertecalculator voor Jarne's Ramenservice. Installeerbaar als Android-PWA, met alle bedrijfsgegevens lokaal in IndexedDB. Geen account, backend, analytics of online routeplanner.

## Gebouwd in vier fases

1. **Fundament:** React, TypeScript, Vite, gegevensmodellen, centrale berekeningen met gehele centen en rekentests.
2. **Dagelijks gebruik:** één scrollbare calculator, vijf dienstcategorieën, instelbare tarieven, klantenbeheer, offertebeheer, conceptopslag en historische versies.
3. **Documenten en offline:** lokale A4-PDF's, Android-deelmenu waar ondersteund, gevalideerde JSON-back-ups, prijslijstimport, service worker en PWA-manifest.
4. **Oplevering:** productiebuild, mobiele browsertests, controles van PDF-inhoud en offlineherstart, deze handleiding en herbruikbare cloudinstructies.

Er worden **geen voorbeeldklanten of verzonnen bedrijfsprijzen** in de database gezet. Alleen €45 inclusief btw per arbeidsuur, €35 inclusief btw per opdracht en 21% btw staan vooraf ingesteld. Toeslagen en frequentiekortingen beginnen op 0%. Stukprijzen en werktijden blijven leeg totdat de eigenaar ze configureert. Ook een bewust ingesteld nultarief is mogelijk.

De groene kleuren en het JRS-teksticoon zijn tijdelijke, neutrale vormgeving, geen nieuw bedrijfslogo. Kleuren staan als CSS-variabelen en tokens in `src/styles.css`; het echte logo kan via Instellingen worden geüpload.

## Ontwikkelen en testen

Node.js 24.19.0 is in `.nvmrc` vastgelegd; minimaal Node 22.12 is nodig. Gebruik de bestaande checkout. Een cloudtaak is al geïsoleerd: maak alleen een Git-worktree wanneer de gebruiker dat uitdrukkelijk vraagt.

```sh
cd /workspace/JRS-Calculator
npm ci
npm run dev
```

```sh
npm test           # rekenscenario's, historische offertes, nummering en herstel
npm run build      # TypeScript en productie-PWA naar dist/
npm run test:e2e   # browserworkflow tegen de productiebuild
```

Playwright gebruikt `/usr/bin/chromium` wanneer dat bestaat. Anders installeer je de browser eenmalig met `npx playwright install chromium`. Met `PLAYWRIGHT_CHROMIUM_EXECUTABLE` kun je een ander Chromium-pad opgeven. De PDF-inhoudstest gebruikt `pdftotext` uit Poppler (`poppler-utils` op Debian/Ubuntu). De browsertests draaien met Pixel 7-scherminstellingen; dat is geen test op een fysieke telefoon.

Vite-ontwikkeling gebruikt geen productie-service-worker. Test offlinewerking met de productiebuild:

```sh
npm run build
npm run preview -- --port 4173 --strictPort
```

De previewserver is uitsluitend voor lokale validatie. Een HTTP-adres op een ander toestel ondersteunt geen volledige PWA-installatie; publiceer via HTTPS.

## Eerste gebruik

1. Open **Instellingen → Tarieven**. Vul de prijzen en gemiddelde minuten in voor de diensten die je gebruikt. Andere diensten mogen ongeconfigureerd blijven; een offerte met zulke diensten wordt geblokkeerd.
2. Controleer **Prijsregels**: uurtarief, minimumopdracht, voorbereidingstijd, toeslagen, onderhoudskortingen, gratis kilometerstraal en kilometervergoeding. Afstand is steeds de handmatig ingevoerde enkele rit.
3. Vul onder **Bedrijf** je adres, contactgegevens, ondernemingsnummer, btw-nummer, echte logo, standaardtekst, voorwaarden en betalingsinformatie in. Ontbrekende bedrijfsgegevens worden op de PDF als nog aan te vullen aangeduid.
4. Maak een offerte: vul naam en adres in, voeg aantallen toe en controleer de live totaalprijs. Sla een klant eventueel afzonderlijk op.
5. Sla de offerte op. Open **Offertes** om de PDF te bekijken, downloaden, dupliceren, bewerken of de status te wijzigen.
6. Maak een eerste back-up via **Instellingen → Back-up & app**.

## Berekening

Alle bedragen worden als gehele centen bewaard. Percentages gebruiken basispunten (100 basispunten = 1%). Vermenigvuldigingen en afrondingen gebruiken `BigInt`-verhoudingen: afronding op de dichtstbijzijnde cent, halve centen naar boven.

De volgorde is: stukprijzen → opgetelde arbeidstoeslagen → frequentiekorting → extra arbeidskorting → minimumarbeidsvergoeding → materiaal voor klant en verplaatsing → resterende minimumopdrachtcorrectie. Er wordt geen dubbele minimumcorrectie toegepast. Een vast kortingsbedrag wordt begrensd op de beschikbare arbeid. Interne materiaalkosten worden nooit automatisch doorgerekend.

De arbeidsuurnorm en minimumopdracht zijn altijd **inclusief btw**, ook wanneer stukprijzen exclusief worden ingevoerd. Bij exclusieve invoer worden arbeidsregels en klantkosten naar inclusief omgerekend. De PDF toont arbeidsregels en aanpassingen inclusief btw; het netto totaal en btw-bedrag worden afzonderlijk weergegeven. Bij exclusieve invoer kan de afgeronde bruto eenheidsprijs een cent verschil geven tegenover het bruto regeltotaal, omdat de volledige regel wordt omgerekend.

Een handmatige eindprijs is altijd inclusief btw. Ze blijft behouden bij herberekening. Bij prijzen onder de minimumgrenzen is expliciete bevestiging nodig; gewijzigde aantallen of kosten maken die bevestiging opnieuw noodzakelijk. Een afwijkend btw-regime moet per offerte worden bevestigd. Ramenwas krijgt nooit automatisch 6% op grond van de ouderdom van een gebouw.

De app kan niet herkennen welke fysieke ramen hetzelfde zijn. Wanneer ramen binnen/buiten én enkel buiten voor hetzelfde type geselecteerd zijn, of ramen samen met een veranda/tuinhuis, verschijnt een waarschuwing en is een bevestiging nodig dat de onderdelen elkaar niet overlappen.

## Lokale gegevens en historische offertes

De database `jrs-offertecalculator` bevat klanten, offertes en metadata. Conceptinvoer wordt automatisch opgeslagen; **Concept bewaard** verschijnt nadat IndexedDB de opslag bevestigt. Ontbrekende klantgegevens of ongeldige e-mailadressen blokkeren offerteopslag. Klanten mogen afzonderlijk met alleen een naam worden opgeslagen.

Offertenummers worden transactioneel toegekend als `JRS-jaar-volgnummer`. Import telt bestaande nummers mee, zodat nieuwe nummers niet conflicteren. Verwijderen geeft oude nummers in dezelfde database niet opnieuw vrij.

Iedere offerte bewaart klantgegevens, alle gebruikte instellingen, tarieven, btw-behandeling en de volledige berekening. Prijswijzigingen veranderen bestaande offertes niet. Bewerken vraagt bevestiging en bewaart de vorige versie. Eerdere versies blijven als PDF beschikbaar. **Actuele tarieven gebruiken** is een bewuste, afzonderlijke actie. PDF's van bewaarde offertes gebruiken de opgeslagen berekeningsresultaten.

Gegevens horen bij het browserprofiel én de website-oorsprong. Een andere domeinnaam, browser of telefoon heeft een eigen database. Gebruik back-ups om gegevens over te zetten. Gebruik bij voorkeur één actieve app-tab; open schermen in andere tabs worden niet automatisch gesynchroniseerd.

## Back-up en prijslijsten

Een JSON-back-up bevat klanten, offertes, eerdere versies, instellingen, tarieven en het huidige werkconcept. Dataschemaversie 1 wordt ondersteund. Onbekende toekomstige versies worden met uitleg geweigerd; velden, dubbele nummers, bedragen en opgeslagen berekeningen worden gevalideerd voordat er gegevens worden vervangen. Het herstel gebeurt in één IndexedDB-transactie, na een bevestiging.

Een prijslijstbestand bevat tarieven en prijsregels, zonder klanten en offertes. Bij import blijven bedrijfsgegevens en historische offertes behouden. Sla wijzigingen op voordat je exporteert. Per tarief kun je niet-opgeslagen invoer terugzetten naar de laatst opgeslagen waarde.

Bewaar back-ups buiten de app, bijvoorbeeld in een beveiligde map. Exports zijn niet versleuteld en bevatten vertrouwelijke klantgegevens. De browser kan persistente opslag toestaan, maar sitegegevens wissen of bepaalde acties bij het verwijderen van de app kunnen gegevens alsnog vernietigen.

## Via HTTPS publiceren

```sh
npm ci
npm run build
```

Publiceer **de volledige inhoud van `dist/`** op een statische HTTPS-host, bijvoorbeeld een eigen webserver of een statische hostingdienst. Geen backend of geheime sleutels nodig. De app is geconfigureerd voor de hoofdmap van een eigen domein/subdomein; voor een pad zoals `/calculator/` moeten Vite `base`, manifestpaden en service-worker-scope eerst consequent aangepast worden.

Host HTML, `sw.js` en `manifest.webmanifest` met hervalidatie; bestanden met een hash onder `assets/` mogen langdurig gecachet worden. Behoud oude assets tijdens een publicatie totdat bestaande clients de update kunnen installeren. Publiceer alle bestanden samen. Voorbeeld van een Nginx-configuratiefragment binnen je bestaande HTTPS-server:

```nginx
root /var/www/jrs/dist;
index index.html;
location / { try_files $uri $uri/ /index.html; }
location = /sw.js { add_header Cache-Control "no-cache"; }
location = /index.html { add_header Cache-Control "no-cache"; }
location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "no-cache";
}
location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }
```

Er is in deze workspace geen publieke HTTPS-deployment gemaakt. De cloudomgeving publiceren via omgevingsinstellingen bewaart de ontwikkelomgeving; dat publiceert de app niet automatisch op een publiek domein.

## Installeren op Android

1. Open de **gepubliceerde HTTPS-URL** in Chrome op Android.
2. Tik op het schildicoon bovenaan of open **Instellingen → Back-up & app**.
3. Kies **Installeer app** als Chrome die knop ondersteunt. Anders: browsermenu ⋮ → **App installeren** / **Toevoegen aan startscherm**.
4. Open de app en wacht op **Offline beschikbaar**. Alle nodige bestanden, inclusief de PDF-module, worden vooraf gecachet.
5. Herstart in vliegtuigmodus en maak een testofferte. Controleer de PDF-download en herstel van een back-up op je eigen toestel.

PDF-delen verschijnt alleen als het native deelmenu PDF-bestanden ondersteunt. Sommige mobiele browsers tonen een PDF niet in het ingebouwde voorbeeld; downloaden en openen met een PDF-app is dan de fallback. De fysieke Android-installatie, het native deelmenu en de PDF-viewer zijn nog niet op een echte telefoon geverifieerd.

Updates tonen een melding in de app en worden bewust geïnstalleerd nadat het concept is opgeslagen. Updates wissen de IndexedDB-database niet. Houd bij toekomstige ontwikkeling databaseversies additief en voorziet expliciete migraties voor nieuwe back-up- of berekeningsversies.

## Projectstructuur

```text
src/
  domain/       modellen, dienstencatalogus, centenberekening en tests
  components/   invoervelden, klantformulier, prijsoverzicht, modals, PDF-voorbeeld
  pages/        calculator, klanten, offertes en instellingen
  storage/      IndexedDB, historische snapshots, back-upvalidatie en tests
  pdf/          lokale A4-PDF-generatie
  offline/      Android-installatiehulp
tests/          Playwright-browserworkflow
public/         lokale PWA-iconen
```

De rekenmodule staat in `src/domain/calculate.ts`. Voeg nieuwe financiële regels daar toe, met een concrete rekentest. Bedrijfsgegevens en bedragen hoeven voor normaal gebruik niet in broncode te worden aangepast.
