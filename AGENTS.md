# Utviklingsinstruksjoner for Underveis

Gjelder hele prosjektet. Les `README.md` for oppstart og produktatferd, og `PLAN.md` for status og gjenstående arbeid. Kontroller faktisk kode og konfigurasjon før endringer; dokumentasjonen er ikke en erstatning for kildekoden.

## Arbeidsmåte

- Bruk norsk i brukergrensesnitt og forklaringer til brukeren. Følg eksisterende TypeScript- og React Native-mønstre.
- Hold endringer innen oppgaven. Bevar brukerens eksisterende arbeid. Oppdater dokumentasjon når atferd, oppstart eller levering endres.
- Legg gjenbrukbar reiselogikk i `src/domain`, Entur-integrasjon i `src/api`, livssyklus og asynkron koordinering i `src/state`, og presentasjon i `src/screens` / `src/ui`.
- Bruk plattformadaptere i `src/platform` og plattformspesifikke filer for forskjeller mellom web og Android. Unngå DOM-avhengigheter i delte native-komponenter.
- Ingen ny server, innlogging, bakgrunnstjeneste eller publisering uten at det inngår i brukerens oppgave. Ikke legg til nye biblioteker når eksisterende kode dekker behovet.

## Invarianter som skal bevares

1. Nye ruteforslag tas i bruk etter brukerens godkjenning. Sanntidsoppdateringer og oppdatering av samme valgte gangreise er ikke et automatisk valg av et annet transportalternativ.
2. Klokken alene bekrefter ikke påstigning, avstigning, besøkt stopp eller ankomst. GPS-forslag holdes adskilt fra bekreftet fremdrift; avstigning krever bekreftelse.
3. Om bord beholdes aktuell transport frem til en kommende mulig avstigning. Ikke foreslå påstigning ved et allerede passert stopp.
4. Bevar avgangsidentitet, driftsdato, stopposisjon, planlagte og forventede tider samt datakvalitet. Manglende eller foreldede data må ikke fremstilles som en trygg overgang eller «i rute».
5. Sluttmål og målet for aktuell delreise er forskjellige begreper. Gjenstående planlagte stopp skal beholdes i reisesøk, forbedringsforslag, avstigningsgjenoppretting og gangruter.
6. Beregn bare frem til neste ubestemte opphold. Under opphold skal det ikke kjøres automatisk avgangs- eller alternativsøk. Videreføring bruker fersk faktisk posisjon eller et uttrykkelig valgt startsted.
7. Et ruteforslag fra feil sted eller en eldre stoppliste må ikke overstyre ny fremdrift. Bevar og utvid eksisterende generasjons-/forespørselskontroller ved nye asynkrone operasjoner, også ved pause, avslutning og skjermens opprydding.
8. GPS-målinger skal ikke utløse API-kall per måling. Ikke lagre GPS-historikk. Bevar pause ved bakgrunn og oppdatering før råd ved retur.
9. Migrer lokal lagring bakoverkompatibelt. Ikke konstruer faktisk besøks- eller avstigningssted fra tidligere plan. «Avslutt og start på nytt» skal fjerne lagret aktiv reise og hindre sene svar i å gjenopprette den.

## API og datakilder

- Alle Entur-kall skal bruke den felles transporten i `src/api/rateLimit.ts`, også nye stedssøk og gangruter. Bevar klientidentifikasjon og håndtering av `429` og ventetid.
- Ikke presenter appens lokale trafikkbudsjett som Enturs offisielle kvoter. Flere telefoner har separate budsjetter.
- Bevar filtrering til støttede transportmidler og operatørområde. Sjekk aktuelle API-felter mot Entur ved nye integrasjoner; ikke gjett identifikatorer eller felt.
- Ekte API-tester skal være avgrensede og eksplisitte. Vanlige enhets- og nettlesertester bruker demo eller kontrollerte svar.

## Verifikasjon

- Ved endret reiselogikk: kjør `npm run typecheck` og `npm test`, og legg til relevante regresjonstester for observerbar atferd.
- Ved endret brukerflyt: kjør relevante Playwright-tester med `npm run test:e2e -- e2e/<fil>.spec.ts`. Kontroller mobilbredde og gjenåpning der det er relevant. Kjør hele nettlesersuiten ved endringer som berører mange flyter.
- Ved endret API-integrasjon: bruk relevant skript i `scripts/verify-*.ts` når nett er tilgjengelig. Oppgi tydelig om ekte API-verifikasjon ikke kunne gjennomføres.
- Dokumentasjonsendringer alene krever ikke nytt APK-bygg eller full testsuite; kontroller filreferanser, kommandoer og versjoner mot prosjektet.
- Rapporter hva som faktisk er kjørt, hva som feilet eller ble hoppet over, og hva som gjenstår. Simulert GPS og et vellykket APK-bygg er ikke feltvalidering på en telefon.

## Android og levering

- Appversjon og Android `versionCode` ligger i `app.json`. `package.json` har separat pakkeversjon. Ved en ny Android-utgivelse skal versjonskoden økes.
- Bruk `npm run build:apk` og eksisterende signeringsnøkkel. Endringer i generert `android/` må ikke være eneste kilde til en varig endring; bruk Expo-konfigurasjon eller byggeskriptet.
- Verifiser APK-signatur, versjon og kompatibilitet med tidligere signeringssertifikat før levering. Del APK og eventuell SHA-256-fil fra `artifacts/`.
- `.local/` inneholder SDK, cache og private signeringsfiler. Ikke skriv passord eller nøkkelinnhold til logger, dokumentasjon eller svar. Ikke eksponer prosjektroten gjennom en filserver.
- Kontroller gjeldende lokalnett-IP og at filen faktisk kan hentes før du gir en lokal nedlastingslenke. Ikke gjenbruk gamle IP-adresser fra samtalehistorikk.
