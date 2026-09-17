# Stack to Six — nalazi običnog igranja, 17. rujna 2026.

Status: **SOURCE/BUILD PASS — ciljani popravci završeni; fizička potvrda nove verzije još nije provedena.**

Instalirano: `index-DexNUnBn.js`, SHA256 `ced1435514dbd68e621986dd96f6858a0a4c83a5c54fcbf5f31f7ae6bd8aa96d`, Stack to Six na iPhone 13 blue. Prethodni popravak koordinata foreground kockica ne zatvara probleme s laserom, HUD-om ili performansama.

## Popravci nakon snimke

- Laser ponovno cilja prema stvarnim skrivenim DOM markerima nakon svake transformacije; uklonjena je aritmetička projekcija koja je u testu uspoređivala isti model sa samim sobom. Već ušao, legalno prihvaćen hitac više se ne odbacuje zbog kasnijeg pomaka cilja i mora prikazati zraku.
- WebGL/GPU oporavak prije ponovnog reveala zaustavlja sve aktivne posebne idle renderere, oslobađa njihove zero-ref Pixi sheetove, ponovo gradi core teksture i kompletan HUD/Text, pa nakon layouta ponovno pokreće sve još žive specijalne kockice. Pri forced HUD obnovi posebno se uništavaju generirani Text rasteri, pa novi HUD ne može ponovno upotrijebiti crnu teksturu iz starog GPU konteksta; PNG ikone ostaju u dijeljenom cacheu.
- iOS/mobile idle decoded-audio budget smanjen je sa 64MiB na32MiB. Prijelaz ploče oslobađa neaktivne dekodirane buffere prije alokacije iduće scene, bez prekida aktivnih glasova.
- Aktivni Forest/Beach/Area55 Board Transition PNG slojevi moraju završiti `Image.decode()` prije pokretanja animacijskog sata. Journey donji dekor također više nije proglašen spremnim samo na `load`.
- Dokaz: fokusirani testovi plus HUD recovery23/23; Gameplay KING24 suitea/306 testova; `qa:fast`202/1603; završni `qa:full`372/2407 i production build `index-DgsfRM-s.js`. Web.bundle i iPhone još nisu ažurirani, stoga fizički simptomi ostaju **NEEDS PHYSICAL TEST**.

## Snimka i ograničenja

- KRENI 22:55:14.819 CEST; GOTOVO 23:01:11.800. Zajednička prijava simptoma stigla je 23:00:57.487; to nije točan timestamp svakog simptoma.
- CPU trace 22:54:41.579–23:01:17.828, 396.249 s; analiza prirodne igre isključuje pripremu/debugger prije KRENI.
- 841735 numeric CPU rows. Raw `natural-cpu.xml` sačuvan; analiza ignorira dva nevažeća XML kontrolna bajta u imenima simbola, bez promjene izvornog izvoza. Mnogi native/JIT simboli nisu razriješeni, pa se ne može pošteno imenovati svaka skupa JS funkcija.
- CPU uzorci nisu GPU vrijeme ni potrošnja u vatima. Power tablice nisu snimljene. Instrumentacija ima vlastiti trošak; ovo nije čista usporedba prethodne i nove verzije.
- Konzola, CPU trace, procesna vremenska crta, iOS memorijski izvještaj i analiza nalaze se u `logs/foreground-natural-play-20260917/`.
- Tijekom prirodnog igranja svjetlina100%, baterija100%, termalna klasa `nominal`; početnih50% bilo je prije KRENI. `nominal` ne znači da kućište nije toplo.
- Konzola pročitana prije zatvaranja. CPU snimka uredno spremljena. Namjerni prekid devicectl konzole23:04:31 završio je aplikaciju signalom2; to nije spontani pad. Nema aktivnog snimanja i nije instaliran drugi build nakon ove sesije.

## Potvrđeni nalazi

| Vrijeme CEST | Dokaz | Što potvrđuje |
| --- | --- | --- |
|22:56:35.746|Native memory warning|Sustav traži oslobađanje memorije.|
|22:58:42.060|Drugi memory warning; audio cache61.08MB, od toga59.02MB idle; idle sheet8.97MB|Velika količina neaktivnih resursa zadržana do pritiska; cleanup ih tada oslobađa. Brojevi nisu ukupna memorija procesa.|
|22:58:43.83|iOS Jetsam izvještaj, `largestProcess=WebContent`, PID65339|Naš WebContent ima46271 rezidentnu stranicu ×16384B =723.0MiB; GPU PID65341 ima137.4MiB; host PID65337 ima32.6MiB. U tom izvještaju nijedan od ta tri procesa nema kill reason; nije dokaz da je kasniji GPU prekid uzrokovan jetsamom.|
|22:58:55.729|Treći memory warning|Pritisak se ponavlja nakon cleanup-a.|
|22:59:51–54|Laser merge141: najgori frame374ms,4 framea iznad50ms|Stvarni zastoj uz laser. Ne dokazuje je li JS, raster, GPU ili decoder jedini uzrok.|
|22:59:55–57|GPU PID65341→65717, host65337 i WebContent65339 ostaju isti|Zamjena GPU procesa, bez potpunog restarta igre. Točan termination reason nije pronađen.|
|22:59:56.393|`recovery:webglcontextrestored:before-repair`: `tile.png` i `tile_numbers.png` imaju0 netransparentnih probe piksela|Nakon obnove konteksta core teksture bile su prazne.|
|22:59:56.780|Reload18 core asseta; obje probe ponovno zdrave|Core recovery reagira; ne dokazuje zdravlje svih drugih tekstura, fontova, SVG/video slojeva.|
|22:59:59.962 zapis prozora|Frame1021ms koji obuhvaća context recovery|Vidljiv zastoj od približno jedne sekunde.|

Drugi registrirani merge zastoji: obični merge6 do170ms; Spaceship137ms; Robo126ms. Nije problem samo LaserGun.

CPU prozor22:58:30–44 odabran je prema navigacijskim događajima, ne kao savršeno označen board-transition span. WebContent ima2919ms uzorkovanog CPU rada; među leafovima su `png_read_filter_row_paeth_neon`100ms i `inflate`60ms, uz renderer/layout posao. To opravdava audit dekodiranja i pripreme resursa tijekom prijelaza, ali ne dokazuje da PNG dekodiranje objašnjava cijelo trzanje.

CPU prozor lasera22:59:51–55: WebContent1030ms uzorkovanog CPU rada, GPU proces1292ms CPU rada. Među razriješenim leafovima su `JSC::JSFinalObject::visitChildren`33ms i `JSC::JSObject::visitChildren`20ms; postoji GC rad, ali nema dokaza da baš on sam objašnjava374ms frame. CPU GPU-procesa nije GPU rad niti energija.

## Simptomi čiji puni uzrok još nije potvrđen

**Nestale laserske zrake:** korisnički potvrđen simptom. Nema per-shot loga razloga odbijanja ni frame snimke. `lasergun-finale-scene.ts` ima odvojene paint/pose/target/angle gateove; `prepareImpact()` može vratiti false, a `revealRequestedBeam()` odustati zbog lifetime ili readiness stanja. Recentna promjena `solveLaserGunMeasuredLayout()` također zahtijeva provjeru stvarnim DOM markerima. Nijedan konkretan gate još nije dokazan kao uzrok. Ne uklanjati zaštite naslijepo.

**Crna slova HUD-a:** korisnički potvrđen simptom. Zamjena GPU procesa i prazne teksture mogu biti povezane, ali bez točnog vremena/screenshota nije dokazana uzročnost. `recoverCoreRenderTextures()` obnavlja core slike, prisiljava HUD recreate i radi layout; to nije dokaz da su svi text rasteri/styleovi/gradijenti i specijalne teksture ispravno obnovljeni. Zaštita mora usporediti stvarni prikaz prije i poslije context restore.

## Prioritetni plan popravaka

1. **P0 — Oporavak renderera kao cjelina.** Vlasnik `app-core.ts` recovery + HUD + shared/custom artwork runtime. Reproducirati context loss u izoliranom web scenariju s običnim kockicama, svim specijalima i kompletnim HUD-om. Provjeriti core textures, Text rastere, Graphics, atlase, pointer/drag i postojeće generacijske leaseove. Popraviti samo dokazano nepokrivene vlasnike. Kriterij: sadržaj/boje/koordinate ostaju jednaki poslije obnove, rezultat i drag ostaju ispravni, nema nepotpunog reveal-a niti zaostalih ownera. Zasebno istražiti izvještaj razloga prekida GPU procesa; oporavak ne sprječava sam uzrok prekida.
2. **P0 — Laser end-to-end.** Reproducirati2→3→4 s realnim DOM geometrijama, lijevim/desnim topovima, skalom i shakeom. Za svaki shot zabilježiti target drift, zaključane/stvarne kutove, pose/paint readiness, beam opacity/bounds, launch i cleanup reason. Usporediti novi aritmetički solver s izvornom izmjerenom geometrijom. Kriterij: svaki legalno prihvaćeni shot stvarno prikazuje zraku od cijevi do cilja; nema stale launch-a nakon izlaska i nema gubitka gameplay handoffa. Dodati stvarnu browser provjeru uz unit test.
3. **P1 — Smanjiti zadržanu radnu memoriju.** Pripisati rast WebContent723MiB aktivnim/skrivenim Journey površinama, image decodeovima, DOM/video/compositor resursima, atlasima i audio bufferima. Trenutni audio/sheet brojači nisu potpuni inventar. Uklanjati nepotrebno zadržavanje pri izlasku i pripremati samo nadolazeće potrebne resurse kroz postojeće vlasnike/generacije. Ne mijenjati asset datoteke. Kriterij: poslije više jednakih ulazaka/izlazaka memorija se stabilizira, nema monotone akumulacije ni ponovljenih memory warninga u usporedivoj sesiji; aktivni efekti i zvukovi ostaju očuvani.
4. **P1 — Area55 prijelaz i merge burstovi.** Dodati precizne oznake za decode/upload/preload, izgradnju prijelaza, pop-in i final cleanup; povezati ih s CPU stackovima. Odgoditi samo nekritičnu pripremu iz kritičnog framea, izbjegavati ponovne decodeove i read/write layout petlje. Kriterij: nema ponavljajućih >50ms frameova koje uzrokuje ovaj prijelaz, bez smanjenja prihvaćene animacije; pratiti p95/p99 i maksimum, ne samo prosječni FPS.
5. **Završna zaštita svih kockica.** Zadržati novi shared-foreground geometry gate. Proširiti postojeću matricu na realno renderiranje, context restore, hladne resurse, drag, merge, interrupt i ponovni ulazak za core Star/Juice/TNT/Magnet i sve13 varijanti. Admission metadata sama nije dokaz vizualne ispravnosti. Nakon ciljanih popravaka: gameplay-lock, qa:fast/full, web pregled, dopuštena native isporuka i jedna usporediva fizička provjera.

Ovaj dokument ne tvrdi da je uzrok zagrijavanja potpuno poznat. Laser, cjeloviti renderer recovery, audio-retention granica i dekodiranje prijelaza popravljeni su i deterministički provjereni u source/buildu, ali instalirana fizička verzija još je stari `index-DexNUnBn.js`. Sljedeći korak je web pregled, zatim odobrena native isporuka i usporediva fizička provjera zraka, HUD boja, Area55 FPS-a, memory warninga i temperature.
