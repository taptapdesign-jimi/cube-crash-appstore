# Forest ranking — offline experiment, 2026-10-21

**36.000 simuliranih pokušaja; 3.000 početnih rasporeda; 9.000 putanja poteza, svaka ponovljena s četiri različita ritma.** Svaki nivo počinje s 0 bodova. Journey Continue nakon Clean Boarda otvara zaseban nivo; prijenos bodova nije pretpostavka ovog testa.

## Metoda

- Forest 01–10, 300 seedova po nivou, tri heuristike koje vide samo trenutačno stanje: čuvanje special kockica, dublji stackovi, ranija aktivacija special kockica.
- Četiri ritma na identičnim potezima: neprekinuti combo, približno pola njegova vrha, ručno nizanje do 4 i pauza poslije svakog poteza.
- Stvarni Swift gameplay core, reward picker i matematika bodovanja. TNT/Flower/Barrel: activation → reserve live targets → impacts → board commit → delayed meter → HUD coin arrivals.
- Do 600 poteza; postojeći resolver odlučuje o završetku/neuspjehu. Ne uspjeh po broju bodova i ne proizvoljno dovršavanje ploče.
- 180 seedova za određivanje kandidata pragova; drugih 120 za odvojenu provjeru. Tri heuristike na istom seedu nisu tri neovisna slučajna rasporeda.
- Svi pokušaji sačuvani: **9.248 završetaka i 26.752 neuspjeha**. To je 2.312 završenih putanja × 4 ritma. Neuspjeh ima 0 zvjezdica; medijani ispod odnose se samo na završene partije.

## Izmjereni završni rezultati

Brojevi su medijani, zaokruženi na cijeli bod; najbolji je najbolji pronađeni rezultat, ne dokazani maksimum. Neprekinuti combo je idealizirani ritam bota, ne potvrđena ljudska vrhunska igra.

| Forest | Završene putanje / 900 | Pauza svaki potez | Nizanje do 4* | Polovica comba | Neprekinuti combo | Najbolji pronađeni |
|---|---:|---:|---:|---:|---:|---:|
| 01 | 346 | 1.387 | 5.068 | 23.574 | 46.060 | 59.184 |
| 02 | 370 | 1.678 | 6.050 | 32.559 | 62.791 | 123.153 |
| 03 | 392 | 2.813 | 7.620 | 41.784 | 80.512 | 171.175 |
| 04 | 244 | 2.787 | 5.761 | 24.040 | 46.494 | 102.381 |
| 05 | 259 | 2.944 | 6.658 | 33.194 | 64.808 | 139.160 |
| 06 | 288 | 2.586 | 6.093 | 26.062 | 50.519 | 104.925 |
| 07 | 101 | 3.484 | 7.438 | 35.746 | 69.933 | 159.059 |
| 08 | 104 | 3.464 | 7.386 | 34.718 | 69.082 | 159.137 |
| 09 | 104 | 3.572 | 7.470 | 34.797 | 69.161 | 159.216 |
| 10 | 104 | 3.718 | 7.556 | 34.876 | 69.240 | 159.295 |

*Honey jednim potezom može sam dodati do pet combo koraka. Od Foresta 04 ni pauza između svakog ručnog poteza ne jamči doslovan vrh 1 ili 4. Takve iznimke evidentirane su u CSV-u, bez mijenjanja igre.

## Početni kandidati pragova — nisu ugrađeni u aplikaciju

Jedna zvjezdica za završetak ispod praga dvije. Prag dvije je sredina medijana kratkog i polovičnog comba na trening uzorku; prag tri sredina polovičnog i neprekinutog comba. Zaokruživanje naviše na 500. To nisu postoci teorijskog maksimuma ni kvote koje se mijenjaju igraču.

| Forest | ⭐⭐ od | ⭐⭐⭐ od | Završene putanje u odvojenoj provjeri |
|---|---:|---:|---:|
| 01 | 14.500 | 35.000 | 121 |
| 02 | 19.500 | 48.000 | 152 |
| 03 | 25.500 | 62.500 | 142 |
| 04 | 15.500 | 37.000 | 89 |
| 05 | 20.000 | 48.000 | 99 |
| 06 | 16.000 | 38.000 | 120 |
| 07 | 22.000 | 54.000 | 41 |
| 08 | 21.000 | 52.000 | 43 |
| 09 | 21.000 | 52.000 | 43 |
| 10 | 21.500 | 52.000 | 43 |

U odvojenoj provjeri, uz umjetno jednak broj triju stilova (bez dodatnog single-potez dijagnostičkog stila), dobiveno je: **1⭐ 36.4%, 2⭐ 34.7%, 3⭐ 29.0%**. To nisu procijenjene vjerojatnosti za ljude.

## Zaključci za fer rangiranje

1. Jedna zvjezdica ne mora nestati: svi završeni cap4 pokušaji iz odvojene provjere ostaju na jednoj s ovim kandidatima. Polovični combo uglavnom daje dvije; neprekinuti često tri, ali ne uvijek.
2. Combo je već snažan dio bodovanja: povećava live merge bodove, HUD coin nagrade i završni combo bonus. Ne dodavati još jedan poseban combo uvjet ili bonus za zvjezdice.
3. Ne određivati prag prema najboljem pronađenom rezultatu: na Forestu 03 uzorak uključuje rezultat 171.175, dok je medijan neprekinutih završetaka oko 80.512. Rekord nije razuman obavezan cilj.
4. Pragovi ne trebaju automatski rasti s brojem nivoa. Forest 04 mijenja pool i stil čišćenja; u ovom uzorku donosi manje bodova od 03.
5. Koristiti isti postupak rangiranja za sva tri svijeta, ali zasebno provjeriti njihove dostupne special kockice i ostvarive rezultate. Ista funkcija ne dokazuje iste pravedne brojke.
6. Prije stvarne promjene: potvrditi representative replaye na aktivnom Native runtimeu, dodati realistične razmake poteza / prekide uz special animacije i usporediti s ljudskim partijama. Posebno proširiti uspješne uzorke za 07–10. Sačuvati već osvojene zvjezdice i Legendary kartice.

## Provjere i granice

**PASS — offline integritet:** 36.000 jedinstvenih zapisa; 0 grešaka stanja/receiptova; sve četiri varijante dijele identičnu putanju, broj poteza/dropova i ishod; svaki final score neovisno provjeren kao base + combo bonus + efficiency uz postojeći cap.

**PASS — opći qa:full:** Gameplay KING 24 suite / 330 testova; ukupni Jest 530 suite / 4.010 testova, build bez native synca i ostali odabrani gates. Log `/tmp/forest-ranking-oct21/qa-full.log`.

**Nije dokazano:** optimalna igra, apsolutni maksimum, ljudske vjerojatnosti, identičan rezultat montiranog Source runtimea ili spremnost pragova za produkciju. Botovi su ograničene greedy heuristike i često ne završavaju; njihove stope neuspjeha nisu težina nivoa za čovjeka. Core serijalizacija nema stvarni drag, prikazane animacije ni njihovu potrošnju zajedničkog random streama.

Runtime bodovanje/pragovi, saveovi, iPhone i postojeći Simulator nisu mijenjani. Nema nove instalacije. Raniji piloti s drukčijim redoslijedom TNT receiptova su odbačeni; priloženi podaci koriste ispravni redoslijed.

Podaci: `runs.csv`, `summary.csv`, `analysis.json`, `representative-traces.json`, `raw-runs.jsonl.gz`, `source-provenance.json`. Ponovljivi alat: `scripts/qa/forest-ranking/README.md`.
