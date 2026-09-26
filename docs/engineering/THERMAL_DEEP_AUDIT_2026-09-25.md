# Stack to Six — dubinski audit grijanja i merge-6 zastoja

> Ovo je sačuvani nalaz prije popravaka. Naknadno odobrene implementacije i aktualna validacija opisane su u [THERMAL_REPAIR_2026-09-25.md](THERMAL_REPAIR_2026-09-25.md).

Datum: 2026-09-25. Izvor: `main`, HEAD `2e6277fdbe83759f2d7807420de51a6d834c9104` uz postojeće lokalne Beach kartice/nazive. Tri paralelna specijalistička audita i integracijski pregled glavnog agenta. Ovo je audit bez popravaka runtime koda.

**Verdikt audita: FAIL — postoje reproducirani propusti. Dominantni uzrok današnjeg grijanja i stvarno poboljšanje na telefonu: NEEDS PHYSICAL TEST.**

Korisnik je danas igrao Beach, nekoliko puta izgubio i odabrao Play Again. Mobitel **nije bio na punjaču**. Zastoj pri merge 6 ne može povezati s određenom kockom. Današnji događaj nema vremenski usklađenu snimku uređaja; prethodne snimke nisu zamjena za nju.

## Najvažniji rezultat

Izravno za prijavljenu rutu potvrđeni su **nepotrebno pripremanje Arcade zvukova pri Journey retryju** i **Pixi renderiranje koje ostaje aktivno iza Fail ekrana**. U Bottle pullu dodatno se priprema pogrešna Honey audio obitelj. To su uklonjivi izvori rada, ali njihova veličina nije fizički izmjerena i ne dokazuje dominantni toplinski uzrok.

Poseban test pokazao je da nevidljivi Special idle sustavi ne prestaju stvarati rad samo zato što je tile skriven. Međutim, dodatna provjera resolvera pokazala je da zdrav Fail ne bi smio sadržavati igrivi Special. Zato taj nalaz ostaje uvjetni lifecycle propust, a ne dokaz normalnog Beach-Fail ponašanja ili neograničenog retry leaka.

Odvojeno postoje dokazani audio pozivi koji pripremaju pogrešnu obitelj zvukova te Forest cache politika koja može sustavno poništiti preloading. Propusti pri abortiranoj navigaciji stvarno zadržavaju listenere, ali obični Play Again ne prolazi tom neispravnom putanjom.

## Nalazi po prioritetu

### 1. P2 — Fail ostavlja nepotreban Pixi render; Special idle problem je uvjetan

Putanja: [showFinalScreen](../../src/modules/app-core.ts#L15638) → game-over exit → [animateBoardExit](../../src/modules/app-core.ts#L6289) → [sweetPopOut](../../src/modules/app-board.ts#L526) → čekanje Fail CTA-a. Pixi aplikacija se na toj granici ne zaustavlja; ostaje na 30 FPS nakon isteka aktivnog cadence prozora. Trošak praznog/nevidljivog boarda nije jednak trošku vidljivog gameplaya, ali raspoređivanje/render prolazi ostaju nepotrebni iza neprozirnog rezultata. Opći `memoryManager.performCleanup()` uklanja samo već uništene reference.

[Idle bubbles](../../src/modules/fx.ts#L167) provjeravaju postoji li parent i je li sustav disposed. Ne provjeravaju je li kocka/board vidljiv. Kontrolirani test izvršio je stvarne start/stop funkcije: nakon skrivanja kocke deset sljedećih spawn callbackova stvorilo je **10 novih mjehurića i 30 tweenova** za Fish/Ball/Juice, odnosno **40 tweenova za Bottle**. Stvarni stop zatim ostavlja nula živih sustava, animacija i spawn callbackova. Ovo su brojevi rada u kontroliranom testu, ne izmjerene iPhone sekunde/FPS.

Ako skriveni Special vlasnik preživi, neki orbit/idle poslovi rade na zasebnom GSAP satu, a registrirani sheet kontroleri drže resurse iako preskaču crtanje nevidljive kocke. Fish HEVC se pri skrivanju ispravno pauzira.

**Važna granica nalaza:** [gameplay-resolution-engine.ts:105](../../src/modules/gameplay-resolution-engine.ts#L105) daje nastavak kada postoje igrivi Wild/Special sudionici, a finalni merge prije Faila rješava kao completion. Zdrav običan Fail stoga nema takav Special. Skriveni/neinteraktivni residual može biti izuzet iz snapshot klasifikacije, ali tada prethodno mora postojati još jedan propust čišćenja; takav konkretan propust u današnjoj ruti nije dokazan. Test mjehurića dokazuje ponašanje skrivenog vlasnika, ne njegovu prisutnost u normalnom Failu. [Restart](../../src/modules/app-core.ts#L15813) zaista zaustavlja Special idle prije novog boarda. Nije dokazan rast broja vlasnika kroz normalno dovršene Play Again cikluse. Ako korisnik CTA pritisne odmah, doprinos rada iza Faila može biti malen.

Smjer popravka: nakon dovršenog prihvaćenog board-exita suspendirati nepotreban gameplay render; zatvoriti i skrivene idle vlasnike kroz njihovo postojeće cleanup sučelje. Postojeći entry ostaje vlasnik povratka. Sačuvati cijelu vidljivu izlaznu animaciju i result ekran. Ne gasiti globalni GSAP timeline.

### 2. P2 — Beach retry priprema Arcade Crate zvukove koje neće koristiti

[preloadWildSpawnDropAssets](../../src/modules/wild-spawn-drop.ts#L56) poziva i Crate i Backpack audio prije provjere već pripremljenih vizualnih resursa. Poziva se iz svakog [startLevel](../../src/modules/app-core.ts#L6613), uključujući Fail → restart → Play Again, te kod Wild dropa.

Journey koristi Backpack; nepotrebni Crate paket sadrži četiri WAV-a, **1.875 MiB dekodiranih podataka pri 48 kHz**. Cache hit sprječava novo dekodiranje, ali nakon izbacivanja iz cachea isti poziv ponovno stvara rad. Vizualni cache guard ga ne sprječava. Obrnuto, Arcade nepotrebno priprema Backpack.

Smjer popravka: pripremu zvuka birati po istom mode/carrier vlasniku koji bira prikaz i playback; testirati hladan cache, cache hit i retry nakon evikcije. Asseti ostaju nepromijenjeni.

### 3. P2 — Bottle i Spaceship tijekom mergea pripremaju Honey audio

U zajedničkoj Magnet pull grani [app-core.ts:9761](../../src/modules/app-core.ts#L9761) bez provjere vizualne varijante poziva se `preloadHoneyMerge6Sounds()`. To za Beach Bottle i Area 55 Spaceship priprema četiri Honey WAV-a: **3.220 MiB pri 48 kHz**.

Potvrđena je pogrešna eligibility putanja i stvarni popis zahtjeva; nije dokazano da se dekodiranje ponovi pri svakom pullu ili da je upravo ono izazvalo današnji frame zastoj. Playback zvukova na merge putanji nije `await` prepreka animaciji; hladno dekodiranje je moguća konkurencija za CPU/memoriju.

Smjer popravka: zajednička Magnet podloga ostaje, Honey priprema dobiva stvarni variant gate. Testirati pravog pozivatelja za Bottle/Honey/Spaceship, ne samo izolirani warmup helper.

### 4. P1 — Forest dugi loop može istisnuti svaki kratki SFX iz mobilnog cachea

[gameplay-audio-buffer-player](../../src/modules/gameplay-audio-buffer-player.ts#L49) dijeli mobilnih 32 MiB između aktivnog Forest loopa i kratkih efekata. Izvorni Forest WAV traje 87.982 s, stereo/44.1 kHz. Float32 decode pri 48 kHz iznosi približno **32.220 MiB**, više od cijelog limita. Aktivni loop je zaštićen, pa svaki neaktivni efekt postaje kandidat za izbacivanje.

Test stvarnog cache vlasnika s kontroliranim Web Audio primitvima i veličinama iz pravih WAV zaglavlja:

| Scenarij | Rezultat |
| --- | --- |
| 44.1 kHz, Forest + isti 3-sekundni efekt tri puta | Forest decode jednom, efekt jednom, bez evikcija |
| 48 kHz, preload Forest | Sam sebe odmah izbaci iz cachea |
| 48 kHz, zatim loop + isti efekt tri puta | Forest se ponovno dekodira; efekt se dekodira sva tri puta |

**Forest je isključen za Beach/Area 55. Ovaj nalaz ne objašnjava Beach-only sesiju.** Stvarni sampleRate današnjeg iPhone konteksta nije zabilježen. Postojeći test Forest ponavljanja koristi desktop cache od 64 MiB i zato ne pokriva ovaj problem.

Smjer popravka: definirati zasebno računovodstvo dugog aktivnog ambijenta i korisnog skupa kratkih efekata, s ukupno ograničenom memorijom. Ne podizati napamet cijeli budget; prijašnji resident-set eksperiment već je pokazao veliki churn i bio povučen. Ne mijenjati audio assete.

### 5. P2 — Prekinuti Fail ostavlja listenere; Clean Board također propušta CTA dispose

[Fail navigation-abort](../../src/modules/board-fail-modal.ts#L306) poziva `cleanupFailModalLifecycle`, ali je taj `const` definiran unutar kasnijeg `try` bloka na [liniji 586](../../src/modules/board-fail-modal.ts#L586). Handler je izvan tog leksičkog scopea. `ReferenceError` se proguta u praznom catchu; `@ts-nocheck` skriva ga od TypeScripta.

Tri kontrolirana montiranja i vanjska `cc-navigation` aborta, uz stvarni Fail i CTA kod, ostavila su **3 keydown, 6 pointerup i 6 pointercancel listenera**, iako overlay više nije postojao. Nijedan abort nije pozvao stop Fail zvuka. Početni entrance RAF dodatno nije praćen/zaštićen protiv zastarjelog modal vlasnika.

Clean Board nema isti scope problem, ali njegov abort preskače lokalni `disposeCtas`; to je potvrđeno call-site pregledom, bez pune zasebne reprodukcije.

**Normalni Play Again poziva ispravni cleanup i dispose.** Ovaj nalaz nije dokaz curenja u današnjoj običnoj retry ruti. Smjer popravka: jedan idempotentan modal cleanup dostupan normalnom završetku i abortu, s CTA disposalom i praćenim entrance RAF-om.

### 6. P2 — Frame-budget nadzor prešućuje stvarne zastoje kada je cilj 30 FPS

[board-frame-budget.ts:108](../../src/modules/board-frame-budget.ts#L108) preskače sve mobilne uzorke kada je `maxFPS < 55`. Time očekivanih 33 ms i stvarnih 100 ms prolaze istim putem.

Test stvarnog vlasnika: 150 callbackova po 100 ms uz postavljeni maxFPS=30 nije objavilo perf snapshot niti aktiviralo pressure reakciju. Uz maxFPS=60, istih 100 ms nakon 60 uzoraka objavi average/worst=100 ms i uključi reducedFx. **Aktivni gameplay na 60 FPS nije potpuno slijep; ovo je nedostatak idle nadzora i reakcije.**

Smjer popravka: mjeriti promašaj relativno stvarno zadanom cadence cilju, bez proglašavanja zdrave 30 FPS idle animacije problemom.

### 7. P2 — Prvi Juice finale serijski čeka osam slika prije stvaranja scene

[wild-juice-bubbles-explosion.ts:468](../../src/modules/wild-juice-bubbles-explosion.ts#L468) u `for` petlji čeka pojedinačni `Assets.load`, pa tek nakon svih osam dolazi do stvaranja finale kontejnera. Entry warmup priprema čašu/poklopac/slamku; ne priprema tih osam osnovnih bubble spriteova. Poziv dolazi nakon početka merge FX-a iz [app-core.ts:11540](../../src/modules/app-core.ts#L11540), odnosno završnog handoffa na liniji 7745.

Probe izvršava točan produkcijski load blok s kontroliranim Promise završecima: prije prvog resolvea zatražena je samo prva slika; dalje redom 2…8. Za prve finale vizuale potrebno je svih osam završetaka. Njihov ukupan procijenjeni RGBA sadržaj je 1,204,000 bajtova, pa ovo nije dokaz goleme teksture. **To je hladna latencija, ne izmjereni iPhone zastoj niti dokaz da svaki retry opet dekodira slike.** Topli Pixi cache i već pripremljene Ball teksture bitno mijenjaju put. Cancellation nakon trećeg loada ispravno sprječava četvrti.

Smjer popravka: pripremu vezati uz stvarni Juice vlasnik/eligibility i osigurati cache-ready finale prije njegove vidljive faze; izbjeći serijsko čekanje na kritičnom trenutku. Ne uvoditi neograničeni pool-wide preload.

### 8. P2 — Next-board Continue nepotrebno prazni sav idle audio

[endgame-flow.ts:418](../../src/modules/endgame-flow.ts#L418) poziva `releaseIdleDecodedGameplayAudio()`, koji izvršava `trimDecodedCache(0)`, i bez OS memory warninga. Isprazni i podlimitne ponovno korisne efekte, pa ih iduće interakcije moraju ponovno pripremiti.

**Ta grana nije Fail Play Again niti Clean Board Play Again.** Zadržati legitimni OS-pressure cleanup u `src/main.ts`; preispitati samo granicu rutinskog Continue handoffa.

## Što audit nije potvrdio

- Nema dokaza da svaki normalni Fail → Play Again gradi još jedan skriveni Beach/Forest/Area 55 World. Fail priprema Journey tek na Exit grani. Journey canvasi/Unit vlasnici imaju teardown i culling. Nevidljivi **board iza Faila** iz nalaza 1 zaseban je sustav od skrivenog Journey mapa-ekrana.
- Nije pronađen AudioContext koji se umnaža sa svakim retryjem. SFX i soundtrack imaju namjerno odvojene, centralizirane kontekste.
- Fish idle video ispravno se pauzira kada njegova grana nije vidljiva. Shared atlas cache ima brojače vlasnika, generacije i ograničenje za idle resurse; nije univerzalni neograničeni leak.
- Main theme + puni SFX cache može držati približno 53.86 MiB dekodiranog zvuka prije decoder/native/encoded podataka. Limit 32 MiB nije limit cijelog audio sustava. Sama ta veličina nije dokaz toplinskog uzroka.
- Core GPU provjere su ograničene na lifecycle barijere; nisu pronađene u svakom merge frameu. Native file cache je ograničen; file I/O radi na svojoj queue. Native audio recovery prati događaje, ne radi u stalnoj render petlji.
- Ugašeni legacy card-idle kod nije aktivan izvor topline. Modul sadrži i aktivno korišten smoke helper: masovno brisanje nije opravdano. Postojanje nekorištenog asseta u aplikaciji samo po sebi ne stvara runtime rad.
- Starije termalne snimke i popravljeni Beach canvas collapse ostaju važni povijesni dokazi, ali ne dokazuju današnjeg krivca. Najnoviji relevantni postojeći pregled je `logs/journey-return-live-20260922/REPORT.md`; ni tamo vremenska gustoća audio uzoraka ne omogućuje pripisivanje pojedinačnog hicha dekodiranju.

## Validacija, reprodukcija i stanje isporuke

`npm run qa:full`: **PASS svih 16 gateova, 388 suiteova / 2.530 testova**. Uključuje Gameplay KING **24 / 306**, TypeScript, unused-code provjeru, lint, production build s `SKIP_NATIVE_BUNDLE_SYNC=true`, bundle/startup audite i native-source guard. Log: `logs/thermal-deep-audit-20260925/qa-full.log`.

Specijalisti su dodatno izvršili postojeće ciljane testove: audio 7 suiteova/61 test; Journey 11/74; render 5/23. Sve PASS. Ti prolazi ne provjeravaju opisane neispravne kombinacije vlasnika. Nalazi su poduprti odvojenim kontroliranim probeovima, koji potvrđuju kvar, a ne uspješni popravak.

Detaljni dokazi i ponovljivi probeovi:

- [Audio audit](../../logs/thermal-deep-audit-20260925/audio-audit.md), `audio-owner-probe.cjs`, `audio-owner-probe-output.txt`.
- [Render audit](../../logs/thermal-deep-audit-20260925/render-lifecycle-audit.md) i njegovi bubble/frame-budget probeovi.
- [Journey audit](../../logs/thermal-deep-audit-20260925/journey-screens-audit.md), `journey-fail-abort-probe.cjs`, `journey-fail-abort-probe.json`.
- [Juice load probe](../../logs/thermal-deep-audit-20260925/juice-load-order-probe.cjs), [rezultat](../../logs/thermal-deep-audit-20260925/juice-load-order-result.json).

Probeovi zamjenjuju platformu kontroliranim primitivima; ne mjere realni WebKit/GPU/audio decode ili temperaturu. Pokreću se s `node logs/thermal-deep-audit-20260925/<ime-probea>.cjs` iz korijena repozitorija. Lokalne logove sačuvati uz nastavak istrage.

Runtime kod i asseti nisu mijenjani u ovom auditu. Lokalni `dist` obnovljen je QA buildom. Službeni Stack to Six Web.bundle, native projekt, potpisani app i telefon nisu mijenjani; nije bilo restarta ni nove snimke uređaja, commita ili pusha. Ažurirani su ovaj izvještaj, dokazni artefakti i CURRENT_HANDOFF.

## Sljedeći dokaz koji zatvara uzrok

Prioritet je kontrolirani unplugged Beach → nekoliko mergeova → Fail → kratko čekanje → Play Again, uz broj aktivnih board idle/GSAP/particle vlasnika prije Faila, iza Faila i nakon retryja. Usporediti broj resursa između dovršenih ciklusa; početni snapshot nije dovoljan.

U isti zapis trebaju stvarni AudioContext sampleRate, izvor/početak/kraj dekodiranja, razlog evikcije, pending loadovi, board/variant/generation i merge vizualni milestoneovi. Mjeriti najgore frameove i vidljivi zastoj uz native thermal/memory stanje. Forest provjeriti zasebno; time se njegov dokazani cache kvar neće pogrešno pripisati Beachu.

Ako slijedi popravak, prvo mali zahvat na terminal idle vlasniku i uklanjanje pogrešnih preload poziva, s pravim lifecycle/work-count regresijama. Zatim web provjera i odobrenje prema LIVE_DEBUG_WORKFLOW prije isporuke na telefon, pa isti fizički test. Ne mijenjati gameplay pravila, prihvaćeni motion, assete ili globalnu rezoluciju radi sintetičkog rezultata. Trenutni audit ne zatvara fizičko grijanje kao riješeno.
