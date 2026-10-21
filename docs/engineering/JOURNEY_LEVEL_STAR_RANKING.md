# Journey rangiranje nivoa za zvjezdice — v1

Aktivirano odlukom korisnika 2026-10-21, globalno za svih 30 Native Journey
nivoa: Forest, Beach i Area 55. Ovo je **rangiranje završetka pojedinog nivoa
za 1, 2 ili 3 zvjezdice**, a ne Arcade rangiranje ili novi izračun bodova.

## Pravilo

- Neuspješan pokušaj: 0 zvjezdica.
- Uspješan Clean Board: najmanje 1 zvjezdica, uključujući rezultat 0.
- Završni rezultat doseže prvi prag: 2 zvjezdice.
- Završni rezultat doseže drugi prag: 3 zvjezdice i Legendary kartica.
- Završni rezultat već sadrži postojeće gameplay bodove, combo bonus i efficiency
  bonus. Ne dodaje se drugi combo bonus niti obavezan minimalni combo.
- Svaki Journey nivo ocjenjuje se zasebno. Continue nakon Clean Boarda znači
  sljedeći nivo. Arcade rangiranje i postojeća pravila bodovanja nisu predmet
  ove promjene. Ova implementacija ne mijenja navigaciju ni početak boarda.

Ista tablica vrijedi po **lokalnom broju nivoa** u svakom svijetu: globalni
boardovi 3, 13 i 23 koriste redak 03. Prag je uključiv (`>=`).

| Lokalni nivo | Dvije zvjezdice od | Tri zvjezdice / Legendary od |
|---|---:|---:|
| 01 | 14.500 | 35.000 |
| 02 | 19.500 | 48.000 |
| 03 | 25.500 | 62.500 |
| 04 | 15.500 | 37.000 |
| 05 | 20.000 | 48.000 |
| 06 | 16.000 | 38.000 |
| 07 | 22.000 | 54.000 |
| 08 | 21.000 | 52.000 |
| 09 | 21.000 | 52.000 |
| 10 | 21.500 | 52.000 |

## Zašto ovako

Polazište je Forest eksperiment sa 300 početnih rasporeda po nivou, tri ograničene
strategije i četiri ritma na identičnim potezima: ukupno 36.000 simuliranih pokušaja.
Sredina medijana kratkog i polovičnog comba određuje početni prag dvije zvjezdice;
sredina medijana polovičnog i neprekinutog comba prag tri. Zaokruženo naviše na 500.
Prvih 180 seedova služi određivanju, preostalih 120 zasebnoj provjeri.

Rekord ili teoretski maksimum nisu uvjet za Legendary. Pragovi ne moraju rasti
redom jer special pool i način čišćenja mijenjaju ostvarive bodove.

Korisnik je izričito odabrao istu tablicu za sva tri svijeta. Beach/Area55 nemaju
zasebnu kalibraciju u ovom eksperimentu. Raspodjela 36,4% / 34,7% / 29,0% odnosi
se na jednaku umjetnu mješavinu triju uspješnih stilova, ne na ljudske vjerojatnosti.
Procjena balansa ostaje otvorena za stvarnu igru i buduće podešavanje.

Izvorni podaci i ograničenja:
[Forest izvještaj](../../output/forest-ranking-2026-10-21/REPORT.md).

## Jedan vlasnik i trajno osvojene nagrade

`NativeJourneyContent.starRankingVersion` i `starThresholds(board:)` jedini su
vlasnik tablice. `earnedStars(score:board:completed:)` računa ocjenu pokušaja.
Clean Board rezultat prikazuje ocjenu upravo odigrane partije.

`NativeBoardStats.awardedStars` trajno pamti najbolju uspješno osvojenu ocjenu;
`starRankingVersion` pamti verziju pravila pri zadnjem zapisu rezultata.
`NativeProgressionState.journeyStars(board:)` služi kolekciji, karticama i World
zvjezdicama. High score ostaje statistika i može uključiti neuspješne pokušaje;
sam ne dodjeljuje ni ne podiže zvjezdice. Slabiji replay ili fail ne oduzima nagrade.

Stari saveovi bez novih opcionalnih polja zadržavaju zvjezdice prema zamrznutim
pre-v1 pragovima, samo za već završene nivoe. Pri dekodiranju ta se ocjena trajno
zabilježi s verzijom 0. Nema resetiranja, izmjene originalnih asseta ili promjene
schemaVersion. Nove uspješne partije mogu ocjenu povećati; postojeća Legendary
ostaje Legendary i nakon promjene tablice.

## Kako kasnije ažurirati

1. Promatrati završene i neuspješne partije po svijetu/nivou, odvojeno od osobnih
   rekorda; obuhvatiti obične i povoljne dropove i realno trajanje poteza.
2. Predložiti novu tablicu, provjeriti je na drugim partijama, zatim zatražiti
   odluku korisnika. Ne mijenjati prag tijekom pokušaja ili prema osobnom rekordu.
3. Ažurirati jedinu tablicu, povećati verziju i ovdje zapisati razlog i dokaze.
4. Sačuvati zamrznuti legacy importer i trajne nagrade. Ne preračunavati stare
   kartice prema novoj tablici i ne koristiti neuspješan high score za promociju.
5. Provjeriti svih 30 granica, Clean Board/fail, novi save i stari save, slabiji
   replay, poboljšanje, obje gustoće kartica i Arcade izolaciju. Pokrenuti state
   testove, pogođene montirane Native testove, KING/full QA i osvježiti isti Simulator.
