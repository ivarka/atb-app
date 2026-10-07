# Underveis – status og videre plan

Dokumentasjon oppdatert **7. oktober 2026**. Gjeldende implementasjon er **1.0.6**, Android-versjonskode **7**, fra `app.json`.

Dette dokumentet skiller levert funksjonalitet fra videre arbeid. Punkter nedenfor om fremtidige funksjoner er ikke en instruks om å implementere eller publisere dem uten en ny oppgave.

## Mål

En reiseassistent for Trøndelag som følger en valgt reise, vurderer overganger og foreslår bedre alternativer. Brukeren beholder kontroll over rutevalg. Web og Android deler reiselogikk. Første versjon fungerer i forgrunnen uten innlogging eller egen server.

## Levert

- [x] React Native, Expo, React Native Web og TypeScript; lokal oppstart, demo og signert Android-APK.
- [x] Entur-geokoding, klientidentifikasjon, konkrete avgangsoppdateringer og lokal begrensning av API-trafikk.
- [x] Buss, båt og trikk fra AtB samt tog fra SJ Nord, med transportikoner og gangetapper.
- [x] Separate planleggings- og reisesider, tydelig fremdrift, manuelle bekreftelser og bevart reise ved tilbake-navigasjon.
- [x] Raskest, Tryggest og Balansert; overgangsvarsler, tidsriktig forsinkelsesinformasjon og alternativer med godkjenning.
- [x] GPS-vurdering av påstigning, bekreftet avstigning fra faktisk sted og gjenoppretting av videre reise.
- [x] Lokal lagring, bakoverkompatibel innlasting, oppdatering ved gjenåpning og avvisning av utdaterte svar.
- [x] Stedsnavn for «Min posisjon», synlig «Avslutt og start på nytt» og mulighet til å gå resten.
- [x] Flere ordnede stopp med «Direkte videre» eller ubestemt opphold. Passering på samme transportmiddel kan oppfylle et holdeplass-stopp.
- [x] Videreføring etter opphold fra fersk posisjon eller manuelt valgt sted; gamle tider etter opphold brukes ikke som en ferdig videreplan.
- [x] Redigering av gjenstående stopp underveis, med ny plan først etter godkjent forslag. Stopp beholdes ved omplanlegging og gange.
- [x] Demo og regresjonstester for stopprekkefølge, opphold, feil, ny startposisjon og at opphold ikke gir automatisk API-trafikk.

## Nytt i 1.0.6

- [x] Tomme felt for ekte reiser, sist brukte steder med sletting, mellomstopp som åpnes ved behov og samlet Reisevalg.
- [x] Synlig avgangstavle med retning, plattform/kai, innstillinger og datakvalitet; delt oppslag, foreground-pause og 30-sekunders intervall.
- [x] Separate handlinger for planlagt reise med valgt avgang og bekreftet faktisk påstigning.
- [x] Uplanlagt påstigning med lagring før videreplan, konkret avgang og driftsdato, manuelt neste stopp ved ukjent fremdrift og opptil tre avstigningskandidater.
- [x] Videreforslag beholder transport og obligatoriske stopp, krever godkjenning og avvises når forespørselen er utdatert.
- [x] Demo for like linjenumre, forskjellige retninger, innstilling og uplanlagt påstigning.

Verifikasjon 7. oktober 2026: typekontroll og 90 enhetstester passerte. Ekte Entur-oppslag verifiserte nærliggende holdeplasser, avgangstavle, historisk tidsvindu, driftsdato og stoppfølge. Hele nettlesersuiten passerte med 23 tester; den valgfrie ekte API-nettlesertesten ble hoppet over. Mobilbredde, tastatur, historikk, skjult tavle, bekreftet transport ved API-feil og gjenåpning ble kontrollert. APK 1.0.6 / kode 7 er bygget og signaturen verifisert mot samme sertifikat som 1.0.4 (1.0.5-APK-en var ikke tilgjengelig lokalt). SHA-256, pakkenavn og ARM64/ARMv7 er kontrollert. Lokal nedlasting svarte HTTP 200 og filinnholdet samsvarte med APK-en; bare denne utgivelsen deles fra en egen midlertidig mappe.

## Verifisert ved levering av 1.0.5

Følgende ble rapportert gjennomført **21. september 2026**, ikke kjørt på nytt som del av dokumentasjonsoppdateringen 24. september:

| Kontroll | Resultat |
| --- | --- |
| TypeScript | Typekontroll passerte |
| Enhetstester | 75 tester passerte |
| Nettlesertester | 18 tester passerte samlet; den valgfrie ekte API-nettlesertesten var ikke del av standardkjøringen |
| Ekte Entur-oppslag | Direktereise, overgang, konkrete avganger, via-holdeplass, flere via-adresser og gangrute via adresse verifisert |
| Android-APK | 1.0.5 / kode 6 bygget og signert; samme signeringssertifikat som 1.0.4 verifisert |
| Lokal overføring | APK svarte med HTTP 200 på daværende lokalnett |

Kjøringskommandoer står i [README.md](README.md). API-resultater, lokalnett-IP og tilgjengelige servere må kontrolleres på nytt når de brukes. Historiske testresultater garanterer ikke dagens rutetilbud eller en kjørende nedlastingsserver.

## Neste prioritet: feltvalidering

- [ ] Feltprøv avgangsidentifisering, neste-stopp-bekreftelse og bytte til uplanlagt transport, også rundt midnatt.
- [ ] Installer siste APK som oppdatering på fysisk Pixel og kontroller at lagret reise og innstillinger beholdes.
- [ ] Test GPS før påstigning, under kjøring og ved avstigning, inkludert feil kjøretøy på samme trasé, GPS-hopp og manglende tillatelse. Kontroller manuell reserve og angre.
- [ ] Test via-holdeplass uten avstigning og adressebesøk til fots. Kontroller at besøksstatus ikke settes bare fordi rutetiden er passert.
- [ ] Test minst to opphold: besøk første sted, gå videre, fortsett fra ny posisjon, og kontroller at senere stopp beholdes.
- [ ] Test redigering av stopp mens brukeren er om bord; behold aktuell transport frem til en mulig kommende avstigning.
- [ ] Test bakgrunn, låst skjerm, tilbakeknapp, avsluttet app og gjenåpning. Under opphold skal appen forbli i opphold; aktive reiser skal oppdateres før nye råd vises.
- [ ] Test bortfall av nett og gjenoppretting uten tap av bekreftet startsted eller tilbakefall til en gammel plan.

Registrer appversjon, telefon/Android-versjon, scenario, forventet og faktisk resultat. Unngå å lagre eller dele unødvendig posisjonshistorikk. Reproduser funn med kontrollerte tester før feilretting leveres.

**Godkjenning for praktisk bruk:** hovedflytene fungerer på fysisk telefon, GPS-feil kan håndteres manuelt, og ingen feil gir en uriktig trygg overgang, mister stopp eller erstatter en valgt reise uten godkjenning. Dette er ennå ikke dokumentert som fullført.

## Mulige senere utvidelser

Disse krever egen avklaring og prioritering:

- Felles trafikkstyring og cache ved flere brukere; avklar gjeldende Entur-vilkår og kapasitet før offentlig utrulling.
- Bakgrunnsovervåking og pushvarsler, med eksplisitt valg av plattform-/serverløsning og personvernhåndtering.
- Bredere distribusjon, eksempelvis Play Store, med egen publiserings- og driftsplan.
- Kart eller billettinformasjon dersom det etterspørres. Dette inngår ikke i dagens løsning.

## Rutine ved neste endring eller utgivelse

1. Les gjeldende implementasjon og invariantsjekkene i `AGENTS.md`.
2. Gjennomfør avgrenset endring med relevante regresjonstester og oppdatert demo ved nye brukerflyter.
3. Kjør typekontroll, relevante tester og nødvendige API-oppslag. Skill simulering fra fysisk feltprøving i rapporten.
4. Ved Android-utgivelse: velg ny appversjon, øk `versionCode`, bygg og verifiser signatur med eksisterende nøkkel.
5. Oppdater README og denne statusen med faktisk verifikasjonsdato og eventuelle begrensninger. Verifiser en eventuell nedlastingslenke før den deles.
