# Native — TODO i provedeni popravci, 2026-10-22

Status: implementirane izmjene za svih sedam stavki. Determinističke provjere PASS; fizičko slušanje, osjećaj animacija i ponavljanje prijavljenih povremenih događaja na telefonu ostaju NEEDS PHYSICAL TEST. Scope: standalone Stack to Six Native. Originalni asseti i save shema sačuvani.

## 1. Game-board ambient nakon povratka u app

- [x] Postojeći streaming transport pri pokretanju/oporavku aktivira istu postojeću audio-session kategoriju kao music owner.
- [x] Resume provjerava stvarni engine i player node, uz logički playing flag; zaustavljen engine može ponovno dobiti postojeći file voice.
- [x] Jedan engine-configuration observer oporavlja samo aktivne glasove, nikad pauzirane/background glasove; dispose uklanja observer. Dvostruki pause ne prepisuje spremljenu poziciju.
- [x] Zamijenjeni/stari fade timeri se invalidiraju, uključujući generation mismatch. Nema dodatnog enginea, loopa, polinga, asseta ili promjene Sounds/Music postavki.
- [x] Native ambient suite: 19/0, uključujući stvarno offline PCM renderiranje Forest datoteke nakon više pause/resume i engine-stop/configuration ciklusa.

Prijava: nakon odlaska/povratka nedostaje samo game-board ambient; glazba i Forest transition zvukovi ostaju. Fizički događaj nije snimljen u ovom zadatku, pa se njegovo potpuno podudaranje s ispravljenim transportnim propustom ne proglašava dokazanim.

## 2. Journey idle tijekom povratnog flipa kartice

- [x] Kartica zadržava postojeću pause politiku dok je otvorena; početak povratnog leta odmah nastavlja iste Unit/cloud/ambient clockove.
- [x] Povratni let uzorkuje nastavljen postojeći Unit compositor wave, umjesto fiksnog cilja. Bez novog display linka, polinga, resetiranja faze ili promjene flipa/lica kartice.
- [x] Background pauzira i karticu i World; povratak nastavlja istu fazu, uključujući landing barrier. Park/cleanup povlače postojeće vlasnike.
- [x] Sva tri Worlda i postojeći close/back/gameplay/modal/scroll/reminder testovi pokriveni u Journey suiteu.

Automatski post-game reminder zadržava svoj postojeći živi Unit/scroll owner. Subjektivna glatkoća ostaje za fizički pregled.

## 3. Donji padding Journey screena s cjelinama

- [x] Content height računa se iz posljednje cjeline i rotiranih granica njezine ilustracije, uz postojeći safe-area inset. Nakon korisničkog vizualnog pregleda završni extent dodatno je smanjen za 40 viewport točaka na svim Worldovima (`artworkBottom + 24*scale - 40`).
- [x] Dimenzije nedostajućih visina čitaju se iz image metadata bez dekodiranja cijelih slika; rezultat je view-scoped i invalidira se pri reconcileu. Nema preloadanja cijelog Worlda.
- [x] Sve tri lokacije provjerene na širinama 390 i 768; na telefonu se prostor smanjuje, a na tabletu se ne odsijeca oblak koji je stari export već premalo obuhvaćao.
- [x] Pregledane aktualne statične UIKit snimke dna Forest/Beach/Area55: `/tmp/todo7-world-{1,2,3}-bottom.png`. Izolirani World view ima transparentnu podlogu; snimke služe geometriji, ne dokazu pozadine aplikacije.

## 4. Box: Cubero prvi, TNT treći

- [x] Zajednički Arcade katalog sada je Cubero → Balloon → TNT → Magnet; izbor i detalji koriste isti poredak.
- [x] Perspektivni holder prati novo mjesto; referentna veličina ilustracija i dalje se računa prema TNT identitetu, bez ovisnosti o indeksu nula.
- [x] Crate suite 8/0 i catalog test 1/0, uključujući stvarne modal/fullscreen prikaze na 390/320 viewportu. Pregledana aktualna `/tmp/arcade-gameplay-crate-modal.png`.

Stare testne pretpostavke o tri Arcade stavke ažurirane su na postojeća četiri itema, uz zadržane provjere granica i točnog identiteta.

## 5. Balon SVG prema unutrašnjosti boarda

- [x] Izvorni SVG/32 pripremljena framea ostaju isti; pri početku se jednom uhvati mirror/orijentacija hero balona prema centru boarda.
- [x] Ista affine orijentacija primjenjuje se na SVG ilustraciju i njezin pomak oko izvornog birth pivota: lijevo ide udesno, gore prema dolje, kutovi prema odgovarajućem unutarnjem smjeru.
- [x] Točan centar zadržava izvorno lice/smjer. Population od 24 balona, caption, trajanje, slučajni izbori i ostali vlasnici ostaju odvojeni.
- [x] Baloon suite 12/0: devet početnih položaja, točan pivot i pomak, usmjerenje, izvorni SVG, postojeći letovi i cleanup.

## 6. Bottle merge-6: zaostala vidljiva ikona

- [x] Retirement animation bindinga uključuje Bottle idle; stari vlasnik ne može naknadno pomicati ponovno upotrijebljeni face.
- [x] Potrošeni Magnet/Bottle six gubi stare idle/skin upload receipte, skriva outer i unutarnje vizuale, ali zadržava rezerviranu grid ćeliju do obične konverzije.
- [x] Final hide također povlači Bottle idle. Ordinary survivor ponovno uspostavlja vidljivost i ispravan face/input.
- [x] Mounted test s pravim Bottle idleom i ponovljenim synchronizeom, četiri Magnet backinga kroz hidden/resume/survivor, te Special idle suite 13/0.
- [x] Dodatni actual-app root test prolazi sva četiri scenarija: Bottle kao source/destination u običnom i završnom mergeu; nastavak igre ili rezultat/progres ostaju ispravni, stara ilustracija nije vidljiva.

Dokaz prijave: screenshot Slow Burn - 01, score 2480, energy ×21, Bottle s ×2 uz lijevi rub. Screenshot sam ne potvrđuje trajanje ni konačni fizički uzrok. Ispravljene lifecycle granice i actual-app scenariji su provjereni; potvrda povremenog telefonskog slučaja ostaje fizička.

## 7. Arcade fail: sive pozadinske zvjezdice u exitu

- [x] Potvrđena ruta: fail nakon dosegnutog drugog kruga koristi clean-style rezultat s osvojenim zvjezdicama.
- [x] U toj putanji sive zvjezdice više se ne gase u prvom exit kadru; neosvojene zvjezdice dobivaju postojeći izlazak zdesna ulijevo, uz zadržanu kompoziciju.
- [x] Native Result suite 19/0, uključujući stvarne UIView alpha/transform provjere s jednom, dvije i tri zvjezdice. Bodovanje i nagrade nisu mijenjani.

Korisnička referenca `assets/sound/star-animation.mp4` nije bila prisutna na navedenoj lokalnoj putanji. Popravak se temelji na prijavljenom slijedu i potvrđenoj Native putanji, ne na izmišljenoj analizi videa.

## Dokazi provjere i granice

- PASS `SKIP_NATIVE_BUNDLE_SYNC=true npm run qa:full`: 530 suites / 4010 tests i svi odabrani gateovi, uključujući KING 24 suites / 330 tests, build/audite. Konačni log `/tmp/todo7-full-final.log`.
- PASS `qa:audio-runtime`, `qa:gameplay-lock`, konačni `qa:ios`, diff/JSON provjere. Logovi `/tmp/todo7-audio.log`, `/tmp/todo7-king.log`, `/tmp/todo7-ios-final.log`.
- 123 jedinstvena pogođena Native testa potvrđena kroz integrirani run i ciljane završne rerunove: `/tmp/todo7-final-sdk.log`, `/tmp/todo7-final-sdk-corrected.log`, `/tmp/todo7-bottle-root-sdk.log`.
- Povijest nije prebrisana: prvi build imao je pogrešan novi initializer; prvi star test mjerio je nakon već dovršenog izlaska; prvi viewport test pogrešno je tražio smanjenje i na već prekratkom tablet exportu. Korigirani fixturei/završni testovi prolaze. Nema preostalog poznatog pada u odabranim provjerama.
- Post-implementation review: postojeći runtime vlasnici i konačni caller/cleanup putovi; nema novog recurring render rada, globalnog cachea, gameplay pravila, save sheme ili originalnih asset promjena.
- Normalni Native Simulator build/install/launch i provjera saveova bilježe se u `CURRENT_HANDOFF.md`. Fizičko slušanje, osjećaj motiona, touch i dulji FPS/thermal pregled: NEEDS PHYSICAL TEST.

Simulator isporuka: normalni Debug build/install-over/launch PID85682, trenutni QA Simulator307A, byte-identične obje save datoteke prije/poslije installa i launcha. Aktualni Home pregledan. Silent Mode je na završnoj provjeri ON; CUA UI veza ne radi pa automatsko isključivanje nije bilo moguće. Za slušanje je potrebno isključiti Silent Mode u Simulator UI-ju. To nije zamijenjeno mijenjanjem game audio postavki ili macOS volumea.

Dopuna nakon pregleda korisnika: još40px manje donjeg scroll prostora na sva3Worlda. PASS točna viewport provjera6slučajeva(390/768), fullQA530/4010 i normalni Simulator build/install/launchPID86777; obje save datoteke byte-identične. Logovi `/tmp/journey-bottom-minus40-{sdk,full,preview,ios}.log`; aktualni handoff supersedira raniju isporuku. Silent Mode ON za ovaj layout-only zadatak.

Naknadni poredak Arcade Boxa po zahtjevu korisnika: Cubero → Balloon → TNT → Magnet. Provjereni stvarni prikaz i izbor9/0 te detail/preview fixturei4/0; fullQA PASS. Normalni Simulator previewPID88400, obje save datoteke byte-identične. Detalji u aktualnom handoffu.
