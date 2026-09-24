# Underveis

En uavhengig reiseassistent for buss, båt, trikk og tog i Trøndelag. Appen planlegger reisen, følger oppdaterte tider og foreslår alternativer når reisen endrer seg. Bygget med React Native, Expo, React Native Web og TypeScript, for nettleser og Android.

**Gjeldende appversjon: 1.0.5 · Android-versjonskode: 6.** Versjonen styres av `app.json`; `package.json` har separat pakkeversjon.

Ingen innlogging, API-nøkkel eller egen server kreves. Appen bruker Entur direkte. Overvåking fungerer mens appen er åpen og aktiv; bakgrunnsovervåking og pushvarsler er ikke implementert.

- [Utviklingsinstruksjoner](AGENTS.md)
- [Status, videre plan og godkjenning](PLAN.md)

## Start lokalt

Bruk Node.js 22.13 eller nyere og npm.

```sh
npm install
npm run dev
```

Åpne [appen lokalt](http://localhost:8081). Velg **Ekte reiser** eller **Prøv demo**.

```sh
npm run build
```

Dette eksporterer nettsiden til `dist/`, uten å publisere den. Posisjon i nettleseren krever tilgang og normalt localhost eller HTTPS. En vanlig HTTP-adresse på lokalnettet kan derfor vise appen uten å gi tilgang til GPS.

## Slik brukes appen

1. Velg fra- og tilsted, avreisetid og prioritering: **Balansert**, **Raskest** eller **Tryggest**. «Min posisjon» viser et stedsnavn når navneoppslaget lykkes, men beholder de faktiske GPS-koordinatene.
2. Legg eventuelt til planlagte stopp i ønsket rekkefølge.
3. Søk og velg **Følg reisen**. En egen reiseside viser gjeldende steg, neste handling, tider og varsler.
4. Bekreft fremdrift med «Jeg er på holdeplassen», «Jeg er om bord», «Jeg har gått av» og «Jeg er fremme». Klokken alene flytter aldri brukeren videre.
5. Godta et alternativ for å bytte reise. Tilbake til planlegging bevarer reisen; **Avslutt og start på nytt** fjerner aktiv reise og gamle søkeresultater, men beholder prioriteringen.

### Planlagte stopp og opphold

Hvert stopp har ett av to valg:

- **Direkte videre:** Ved holdeplasser er passering på samme transportmiddel nok. En adresse besøkes via veinettet. Ingen bestemt oppholdstid legges til.
- **Opphold:** Reisen planlegges frem til dette stedet. Senere stopp beholdes, men videre avganger beregnes først når du trykker **Klar til å fortsette**. Sluttankomst merkes «Beregnes når du fortsetter».

Ved videreføring brukes posisjon yngre enn 30 sekunder med nøyaktighet innen 50 meter, eller et startsted du selv velger. Har du gått videre fra butikken, skal den nye posisjonen brukes. Uten brukbar GPS tilbys det gamle stoppet som et valg, aldri som en antatt faktisk posisjon. Ved feil beholdes opphold og valgt startsted.

Under **Reisevalg → Endre stopp** kan gjenstående stopp legges til, flyttes og fjernes. Endringene tas i bruk sammen med et godkjent ruteforslag. Omplanlegging og gangforslag beholder gjenstående stopp. Under opphold pauses GPS-sporing og automatiske avgangs- og alternativsøk; posisjon kan hentes når du vil fortsette.

### Avstigning og gange

Avstigning bruker fersk GPS eller et manuelt valgt sted. Ved annet avstigningssted enn planlagt, eller en videreplan som ikke lenger kan gjennomføres, vises **Må oppdateres fra der du er**. Gamle overgangsmarginer og sluttankomst vises ikke som gyldige råd. Velg blant opptil tre videreforslag, inkludert gange, uten krav om tidsgevinst.

**Jeg vil gå resten** viser faktisk gangrute, startsted, avstand og tid før du bekrefter. Om bord må du først bekrefte avstigning for å velge denne handlingen. Automatiske alternativer kan også foreslå gange fra en kommende avstigning, med aktuell transportetappe bevart. Korte gangalternativer vurderes ved høyst 2,5 km i luftlinje, maksimalt 30 minutters beregnet gange og minst ett minutts gevinst. Eksplisitt forespørsel om gange har ikke 30-minuttersgrensen.

## Sanntid, GPS og lagring

- Aktive avganger oppdateres normalt hvert **30. sekund**, alternativer hvert **60. sekund**, ved endret risiko eller manuell oppdatering. Opphold og avsluttede reiser er unntatt.
- Konkrete avganger følges med avgangs-ID, driftsdato og stopposisjon. En valgt reise beholdes selv om den forsvinner fra nye søkeresultater.
- Overgangsmargin er forventet avgang minus forventet ankomst og nødvendig gangtid. Under tre minutter gir «Knapp overgang»; negativ margin gir varsel om tapt overgang.
- Før påstigning gjelder forsinkelse avgangen. Om bord gjelder den forventet ankomst til avstigningsstedet. Eget forsinkelsesvarsel har en terskel på to minutter.
- Manglende, usikre eller over 90 sekunder gamle sanntidsdata gir usikker vurdering. «Reisedata oppdatert» er tidspunktet for klientens oppslag, ikke kjøretøyets posisjonsrapport.
- Balansert foreslår normalt bytte ved minst fem minutters gevinst eller bedre overgang ved risiko. Raskest bruker ett minutts gevinst. Tryggest prioriterer kjente marginer på minst fem minutter, færre bytter og tidligere ankomst. Gangforslag har unntaket beskrevet over.

GPS kan foreslå påstigning og, ved sterkere bevegelsesgrunnlag, registrere påstigning automatisk på buss. Andre transportmidler krever bekreftelse. «Angre påstigning» og manuelle handlinger er tilgjengelige. GPS kan foreslå «Har du gått av her?», men avstigning krever alltid bekreftelse. Stillstand alene er utilstrekkelig. Via-passering kan registreres fra bekreftet fremdrift, faktisk avgangsinformasjon eller GPS-observasjoner, med manuell reserve.

GPS er en bevegelsesvurdering, ikke sikker identifikasjon av kjøretøyet. **Deteksjonen må fortsatt valideres på ekte reiser med fysisk telefon.** GPS-historikk finnes bare i minnet. Målingene utløser ikke ekstra API-kall; vanlige rutinesøk kan bruke siste posisjon.

Aktiv reise, stopp, opphold og prioritering lagres lokalt under `underveis.v1`. Android bruker en SQLite-basert adapter for lokal lagring. Eldre reiser migreres uten å konstruere et faktisk avstigningssted fra planen. Ved gjenåpning oppdateres data før nye råd vises. Det finnes ingen egen server med reisehistorikk, men søk og koordinater sendes til Entur.

## Entur og API-trafikk

Integrasjonen bruker Journey Planner v3 og Geocoder med `ET-Client-Name: ika-underveis`. Søk inkluderer buss, båt og trikk fra `ATB:Authority:2` samt tog fra `SJN:Authority:SJN`. Stedssøket er avgrenset til Trøndelag. Dette sier ikke noe om hvilke billetter som gjelder.

Direkte-stopp bruker Enturs `passThrough` for holdeplasser og `visit` for adresser. Rene gangruter via flere steder beregnes i ordnede delstrekninger. Ingen private AtB-endepunkter benyttes.

Alle kall går gjennom samme lokale begrensning: **60 kall per rullerende minutt**, hvorav **12 reisesøk**, minst **500 ms mellom kall**, maksimalt 12 ventende forespørsler og 15 sekunders køtid. Dette er appens eget trafikkbudsjett, ikke en garanti om Enturs gjeldende kvoter.

Ved `429` respekteres `Retry-After` og `Rate-Limit-Expiry-Time`; uten lesbare headere brukes 61 sekunders pause. Ingen automatisk retry-bølge sendes etter pausen. Faner på samme origin deler budsjett via Web Locks og lokal lagring når dette er tilgjengelig; ellers gjelder begrensningen per fane. Separate enheter deler ikke budsjett. Felles trafikkstyring for større offentlig bruk er fremtidig arbeid.

## Demo og tester

Demo bruker fiktive reiser og tider, uten ekte API-kall. Test forsinkelse, knapp/tapt overgang, innstilling, manglende sanntid, nettverksfeil, innhentet forsinkelse og kombinerte transportmidler. Gjenåpning av demo tilbakestiller hendelsesscenarioet til «I rute».

For stopp: legg til et demosted, velg Opphold, følg reisen og bekreft besøket. «Jeg har gått til Studentersamfundet» tester videreføring fra et annet sted. Reisevalg lar deg teste endring og avbrytelse av stopplisten.

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Nettlesertestene starter Expo ved behov. En eksisterende Chrome-installasjon kan brukes på macOS:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e
```

Disse kontrollene bruker ekte Entur-data og krever nett. Resultater avhenger av rutetilbud og tilgjengelighet:

```sh
npm run verify:live
npx tsx scripts/verify-modes.ts
npx tsx scripts/verify-stops.ts
ATB_LIVE=1 npm run test:e2e -- e2e/live.spec.ts
```

Historisk leveringsstatus og gjenstående feltprøving er dokumentert i [PLAN.md](PLAN.md). Testtall der er ikke en påstand om at tester er kjørt på nytt ved hver dokumentasjonsendring.

## Android-APK og lokal deling

```sh
npm run build:apk
```

Bygget krever JDK 17 eller nyere, Android SDK-plattform 36, Build Tools 36.0.0, NDK 27.1.12297006 og CMake 3.22.1. Sett `JAVA_HOME` og `ANDROID_HOME` ved andre installasjonssteder. Skriptets lokale standard er `.local/android-sdk` og en Homebrew-installasjon av JDK 17; Gradle-bufferen ligger under `.local`.

Skriptet kjører Expo prebuild og lager `artifacts/underveis-1.0.5.apk` med SHA-256-fil. APK-en inneholder ARM64 og ARMv7, bruker pakkenavnet `no.ika.underveis` og kjører uten Metro eller PC. Den trenger internett for Entur-oppslag. Ingen publisering til Google Play eller Expo skjer.

Signeringsnøkkelen gjenbrukes for kompatible oppdateringer. Ta privat sikkerhetskopi av `.local/underveis.keystore` og `.local/android-signing-password`. **Ikke legg disse i Git, logg passordet eller del `.local`-mappen.**

Del bare artefaktmappen på et betrodd lokalnett:

```sh
python3 -m http.server 8082 --bind <PC-ens-lokalnett-IP> --directory artifacts
```

Bytt ut plassholderen med maskinens nåværende IP, og åpne `http://<PC-ens-lokalnett-IP>:8082/underveis-1.0.5.apk` på telefonen. Begge må være på samme nett, og nettverket må tillate forbindelsen. Stopp serveren med Ctrl+C etter overføring. IP-adressen er ikke fast. APK-en kan installeres som oppdatering når signeringsnøkkelen er den samme.

## Kodestruktur

| Område | Ansvar |
| --- | --- |
| `App.tsx`, `src/screens` | Skjermbytte, planlegging, aktiv reise og tilbakeknapp |
| `src/domain` | Delte typer, fremdrift, stopp, reisevurdering og GPS-vurderinger |
| `src/api` | Entur-oppslag, normalisering, konkrete avganger og trafikkbegrensning |
| `src/state/useTravel.ts` | Overvåking, bekreftelser, alternativer og avvisning av gamle svar |
| `src/ui` | Delte React Native-komponenter, ikoner, stedssøk og stoppeditor |
| `src/platform` | Plattformadaptere for posisjon, synlighet og lagring |
| `src/demo`, `tests`, `e2e` | Demo, enhetstester og nettlesertester |
| `scripts` | Ekte API-verifikasjon og lokalt signert APK-bygg |

Kart, billetter, innlogging, serverdrift, bakgrunnsovervåking og pushvarsler inngår ikke i denne versjonen.
