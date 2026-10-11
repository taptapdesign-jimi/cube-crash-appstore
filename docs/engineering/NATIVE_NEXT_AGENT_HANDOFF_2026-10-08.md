# Stack to Six Native — preuzimanje rada u drugom prozoru

## Current continuation override — 2026-10-10
Read CURRENT_HANDOFF.md first: original Oct8 draft below is historical. Latest private Bee/App/entry-interruption code is consolidated in native-continuation-2026-10-09/NativeCurrentCodeSnapshot.tar.gz with matching manifest. SDK63/63 and full frozen QA terminal PASS; no live checks. Restore into a NEW isolated directory with preserved original assets, never overwrite dirty main. Full migration remains OPEN; source flags OFF, not installed or physical acceptance. Next: original Wild restore constructor and full save rehydration owners, then remaining full Native plan. Phone huge-cube bug OPEN; grey flash LAST. Retain tutorial, Magnet, regular-six, persistence/statistics, TNT and all required validation in original scope.


Stanje: 2026-10-08, Europe/Zagreb. Ovaj dokument pripremljen je na izričit zahtjev korisnika. U ovom prozoru razvoj ostaje pauziran. Drugi agent treba pročitati ovaj dokument i aktualni CURRENT_HANDOFF prije rada; provjeriti stanje na disku, ne pretpostaviti da su `/tmp` putanje trajne.

## Cilj i pravila

Dovršiti 100% Native Stack to Six uz ponašanje i izgled production-benchmark-v9 te kasnije izričito prihvaćene promjene: svi boardovi, četiri Wild archetypea, sve Special varijante, animacije, CTA, teksture, audio, haptics, progression i save. Testovi i postojeći Swift preview ne znače da je cijela migracija završena.

Obavezno čitati:
- AGENTS.md i docs/engineering/PROJECT_CONTEXT.md
- docs/engineering/CURRENT_HANDOFF.md
- docs/engineering/APPROVED_PRODUCTION_BASELINE.md
- docs/engineering/GAMEPLAY_KING_CONTRACT.md
- docs/engineering/NATIVE_100_PERCENT_PLAN.md
- Journey, Special Dice Performance, Background Work i Feature Architecture ugovore za odgovarajuće promjene
- .agents/skills/stack-to-six-qa/SKILL.md i relevantne feature/audio skills
- docs/engineering/dev-production-modes.md prije builda/instalacije

Aktivni Native projekt: `native/standalone/Stack to Six.xcodeproj`, scheme `Stack to Six`, bundle `com.taptapdesign.stacktosix.native`. PWA `/Users/user/Stack to Six` i njegov save potpuno su odvojeni. Ne syncati/buildati/instalirati PWA kao nuspojavu. Ne dirati Kockice Crash. Sačuvati sve originalne asset/audio byteove; bez optimizacije, konverzije, brisanja ili preimenovanja.

Korisnik je ranije zatražio sve agente. Ako drugi prozor nastavlja implementaciju, korisno je podijeliti Board/Magnet, Rules/Entry/Tutorial i State/Merge6; glavni agent drži integraciju, input/statistiku i zajednički QA. Jedan vlasnik po datoteci; nema paralelnih buildova nad izvorom koji se mijenja. Za samu pripremu ove datoteke agenti nisu ponovno pokrenuti.

## Koji kod je stvarno spremljen

| Sloj | Lokacija / stanje |
| --- | --- |
| Git checkpoint | `055c15339074112f8f4d68a6c844439494cbc6b5`, ONLINE na `native/continuation-20261008-owned` |
| Origin | https://github.com/taptapdesign-jimi/cube-crash-appstore — javni, korisnik odobrio objavu ondje |
| Main pri checkpointu | `3f1b776268542fdc55ca38db072ac2361a04f5da`, nije pomaknut |
| Točna testirana privatna Native kompozicija | `/tmp/native-app-source-context-draft/native` |
| CLOSED izvor za source QA / usku Core objavu | `/tmp/native-resume-owned-snapshot` |
| Trajni recovery | `docs/engineering/native-pause-2026-10-08/` |

VAŽNO: checkpoint ne promovira cijelu privatnu Scene/UI kompoziciju kao završeni aktivni Source mode. Sadrži uske inactive Core promjene i recovery arhive točnog privatnog izvora/draftova. Live radni direktorij ima druge dirty promjene; ne prepisivati ga cijelim privatnim stablom niti koristiti reset/clean za njihovo uklanjanje.

Recovery: prvo pročitati README u pause direktoriju. `NativeSource.tar.gz` sadrži kod; `AgentDrafts.tar.gz` deset frozen/nedovršenih grupa. `RecoveryManifest.json` sadrži SHA svakog izvora/drafta/arhive te reference na 1889 izvornih media datoteka (1868 runtime +21 icon/media). Arhive nemaju originalne media byteove, buildove ili Git. Ako `/tmp` izvor nedostaje, izdvojiti recovery u NOVI izolirani direktorij i vratiti samo neizmijenjene assete iz postojećeg repozitorija, uz provjeru svih hashova. Nedovršene draftove ne primjenjivati kao gotove patcheve.

## Potvrđene provjere i telefon

- SDK146: **190/190 PASS**, `/tmp/native-owned-qa146.log`, actual povezani Native testovi.
- Pure Core337: **337/337 PASS**, `/tmp/native-owned-core337-root.log`.
- Sourcefull25: svih **19 determinističkih gateova PASS**, KING330, 530 suites /4010 testova; `/tmp/native-owned-source-full25.log`. Ovo je CLOSED source provjera, ne puna privatna Scene kompozicija.
- Privatni audio-runtime i feature-runtime admission PASS; logovi `/tmp/native-owned-private-audio-runtime2.log` i `/tmp/native-owned-private-feature-runtime.log`.
- Release139: **124/124 PASS**, predates novije entry/token/pull promjene. Nije aktualni puni Release dokaz za190.
- SDK145 originalni jedan FAIL ostaje u logu: testu nedostajao stvarni `await f.prepare()` prije Magnet scenarija; SDK146 ispravlja samo pripremu fixturea, ne runtime/assertions.
- Sourcefull24 dva Git hygiene FAIL ostaju sačuvana; full25 ima ispravan izolirani Git environment i private index.

Na izričit zahtjev korisnika instaliran je ovaj privatni preview preko USB na **iPhone 13 blue**, bez uninstall/reset/fresh-profile argumenata. Build Debug `DEBUG NATIVE_GAMEPLAY_PHONE_PREVIEW`, bundle `.native`, naziv Stack to Six Native, 1868 byte-identičnih runtime asseta, bez Web.bundle. Potpis/build/install/startup PASS; Swift startup potvrđuje `webRuntime=absent`. Dylib SHA `1ccc30470ee1694177a1507e0cf790fccaaff431fffb5f656200fe1aa34014d7`; container `A15B4151-3F29-4812-904C-50FFB4E0D32A`. Dokazi `logs/native-pause21-phone-20261008/`, build `/tmp/native-pause21-phone-build.log`. Postojeći Native sandbox sačuvan.

Whole Source flags ostaju **OFF**; najnoviji helperi nisu svi aktivni u normalnom gameplayu. Ne obećavati da se svi današnji portovi vide na telefonu. Native-only one-time legacy profile exporter još postoji; treba ga završno razriješiti nakon provjerene Native migracije, ne brisati na silu. Generic qa:ios je javio NEEDS SYNC za sačuvani PWA; slijedila se eksplicitna Native iznimka bez PWA synca.

## Preostali posao — preporučeni redoslijed

### 1. Source board entry i tutorial (Rules lane)
- [ ] Frozen `/tmp/native-source-board-entry-v1-draft/HASHES.json`, SHA `f737fd35350d2fd1421a9467573e8c6c82a4903bcc4f9ab7dc942667ae64c232`: pregledati i usko integrirati Node patch protiv aktualnog08560e6e.
- [ ] Plan/Owner imaju pure/original GSAP dokaze; **9 SDK testova su authored/parser-only, nisu izvršeni**. Izvršiti stvarne povezane Native SDK testove prije admissiona.
- [ ] `/tmp/native-source-entry-caller-v1-draft` je unfrozen/parser-only. Razriješiti Float32 jednakost kanonske geometrije i očuvanje stvarnog Source base-z umjesto row-z.
- [ ] Povezati puni ctor roster, isti APP RNG/RAF/GSAP scope, sync plan i Math prije početnog face RAF, midpoint, haptics, actual final .03 delayedCall i real-wall watchdog. Normal/forced/abort/retire completion nisu isto.
- [ ] Spojiti postojeći Root `startSourceBoardEntrySound(duration:receipt:generation:)`; bez dodatnog audio ownera ili replaya. API je testiran, stvarni entry Scene caller još nije.
- [ ] Tutorial focus/preparation0d0994 već integrirani/testirani, ali stvarna Scene aktivacija nije. Povezati genuine entry completion →2RAF/1250 pripremu/focus/paint retention →monitor/sheet/pointer/korake.
- [ ] Dovršiti HUD entry/exit/close i nested paint callbacks prema originalu; originalni helper/pose proof nije dokaz stvarne povezane cijele rute.

### 2. Magnet cjelina (Board lane)
Već dokazano: stvarni painted-position nearest selection bez RNG sorta, pull motion/owner i captured Force sound stop;14 pull +5 force testova u kombiniranom190. To NIJE puna Magnet cjelina.
- [ ] `/tmp/native-magnet-accounting-draft/PAUSED_HASHES.json`, SHA `d22872a0076c735c63ce7d6c47fd0806f1e597a24ecbeb9a06f37cff33a44871`: original48 JS scenarija PASS; Native draft samo parser, nije Core/SDK admission.
- [ ] Testirati main/helper exactly-once, reentry/generation i STATE-after-lock. Source main80 debit moves, +6×min(4,pulled+1)×livecombo, crack1; helper prije respawn await dodatno24, combo+1+pulled i drugi crack1. Usporediti doslovni source prije integracije.
- [ ] Povezati statistiku `helpersUsed`: main1 +helper1 =2; ne resetirati već zarađene countere starim pre-snapshotom.
- [ ] Shortage/retry, partial/post-main abort, stvarni helper child-tween retirement, vector FX/smoke i selected meter-holder ctor/replacement.
- [ ] Testirati retained survivor isti ID/objekt, lazy ctor/reserve/RNG ordering, FIFO convergence i sljedeći kontakt.
- [ ] Posebno testirati post-helper rootove/prazne containere; dosadašnji pull14 ne pokriva cijeli kasniji helper lifecycle.

### 3. Regular merge-six, endgame i input (State + glavni agent)
- [ ] `/tmp/native-source-regular-six-cleanup-draft` je unfrozen/unadmitted; Core4 authored, Swift/SDK nije izvršen.
- [ ] Stvarni per-object `_ccMerge6CleanupToken`, reprotection nakon setValue6, wall1200 watchdog i obavezni physical final/lastMerge supplier.
- [ ] Watchdog smije ukloniti samo dst bez scorea dok je main80 GSAP pauziran; src ostaje do stvarnog main callbacka/destroyed-dst early return. Ne široko cancelati src+dst.
- [ ] Normal dst removal nakon stvarnog wall50 i endgame wall100 ostaju različiti; dovršiti stvarni coroutine finally.
- [ ] Token begin3324 je integriran/testiran12; `sourceOrdinarySixSpawnCoroutineFinally` ostaje namjerno NEPOZVAN dok FLOW promises/forced opens/minimum/opacity nisu stvarno portani.
- [ ] Spawn2.5 diagnostic NIJE finally/reset autoritet. Handoff drain nije Source finally. Ledger četiri Date writera nisu svi povezani; capability false.
- [ ] Source input-gate: stvarni magnet/TNT/Special/Wild/transakcijski proizvođači, TTL registry i eventMode. `pendingSix` sam po sebi NIJE globalna Source input zabrana.
- [ ] Multiple-six i slobodan ordinary kontakt tijekom tuđeg visual taila, brzi drags, restart/exit, stale callbacks i terminal-only-pair testovi.
- [ ] Persistent Stats owner +save/import/export/once lifecycle, uključujući helpersUsed; bez čitanja PWA sandboxa.

### 4. TNT, ostali Wild/Special i zajednički services
- [ ] Swift TNT selector testiran protiv actual iOS JavaScriptCore640 slučajeva. Spojiti na stvarni target-selection endpoint nakon authored prefixa.
- [ ] Non-laser replacement RNG nakon stvarnog impact audio/FX; Laser raniji zaseban boundary. Bez eager-all-RNG aproksimacije. JavaScriptCore oracle ostaje test-only.
- [ ] Cijeli TNT caller/FX/save/endgame/abort graph i sve varijante, ne samo selector.
- [ ] Provjeriti cijele Star/Juice/Magnet/TNT grafove: merge/transaction/input/score/moves/spawn/finality/save/cancel. Postojeći dispatch13 nije sam po sebi parity acceptance.
- [ ] Inventar svih registry varijanti i source artwork/idle/drag/finale/audio mappinga; Fish, Kanta, Bee, Honey, Bottle, Flower, Barrel, Mushroom, Robo Cube, Cubero, Beach Ball, LaserGun, Spaceship i svi ostali registry entries.
- [ ] Povezati preostale source-correct shared idle/impact/smoke owners bez novih clock/RNG kopija. Bez generičkog PNG/sound fallbacka za nedostajući authored efekt.
- [ ] Journey reward pool/unlocks/wildSpawnCount, Arcade carryover, settings/audio/haptic interruption/save/relaunch kompletna regression matrix.

### 5. Cijeli app i Release admission
- [ ] Native HUD/tutorial/reward/result/NO MOVES/modal/transition rute pregledati kroz stvarne callers, ne označiti gotovim po izdvojenom helper testu.
- [ ] Fresh play, continue, restart, next board, fail/clean, back/world/home, foreground i interruption povezati u jednu autoritativnu Native sesiju.
- [ ] Pregledati preostale WKWebView/JS bridge/exporter i DEV dijagnostičke ulaze; zamijeniti potrebne funkcije Native ownerima. Sačuvati arhivirani web izvor/assetove.
- [ ] Whole Source flags uključiti tek kad obvezni proizvođači i coroutine finally/cleanup stvarno postoje i prolaze povezanu matricu; bez lažnih capability tagova.
- [ ] Aktualni optimized Release SDK proof nad NOVOM cjelinom;124 stari testovi nisu aktualna190 Release provjera.
- [ ] Release/default icon/offline boot/Worlds activation, original asset packaging, identitet/potpis, Native-only QA bez PWA sync prerequisitea.
- [ ] Potpuna physical Journey/Arcade matrica na iPhone13blue: rapid drag/tap, clipping, background/audio, sustained FPS/memory/thermal i cleanup. Callback cadence nije dokaz presented GPU FPS.
- [ ] Završni benchmark tek nakon izričitog prihvaćanja korisnika. Ne izmišljati postotak završetka iz broja testova.

### 6. Prijavljeni vizualni problemi — nakon planirane migracije
- [ ] **Sivi blic i dalje postoji: Journey → Play na board kartici → ulazak u game board.** Korisnik ga ponovno potvrdio nakon današnje USB instalacije. Papirnata kompozicija/testovi ga nisu riješili; ne označiti FIXED.
- [ ] Korisnik izričito kaže da ovo popravljamo **na kraju**, ne odmah. Tada reproducirati exact route i stvarni painted handoff/background/layer reveal; ne dodavati spekulativne prepaint/timer zakrpe.
- [ ] Ostale prijavljene probleme iz aktualnog handoffa i eventualnog drugog prozora objediniti tek nakon provjere ownershipa; ne obećavati da su svi već u ovom previewu.

## QA i sigurna integracija

Prije svakog patcha usporediti hash/base s aktualnim privatnim izvornim stanjem. Integrirati uske patcheve; ne prepisati cijeli Scene/Engine/Node starim draftom. Uz aktualni190 postoje nove ulazne audio/token/pull promjene koje treba sačuvati.

Dedicated Native SDK scheme: `Stack to Six Native Gameplay QA`. QA simulator: `E590B52E-F314-43A7-BF55-2F49CE939C2A`; nikad JIMI TEST `1018BE2D-491B-465F-8F75-3E5BEB38C22A`. Provjeriti njihove identitete/dostupnost prije komande. Bez promjene phonea tijekom korisničkog KRENI/GOTOVO capturea.

CLOSED nema `.git`; za source QA koristiti odvojeni private index i eksplicitni GIT_DIR/GIT_WORK_TREE, ne stvarni index. Prvo pripremiti index prema odabranom checkpointu, zatim pokrenuti gateove. Primjer okruženja prethodnog potvrđenog runa:

```
GIT_DIR=/Users/user/cube-crash/.git
GIT_WORK_TREE=/tmp/native-resume-owned-snapshot
GIT_INDEX_FILE=/tmp/native-owned-source-full25.index
SKIP_NATIVE_BUNDLE_SYNC=true
```

Prijašnji PASS se ne ponavlja automatski nakon novih patchova: pure Swift/Core, actual mounted Native SDK, ownership admission, KING i relevantni source gates prema stvarnoj promjeni. Source QA, SDK Debug, optimized Release, build/install i physical acceptance izvještavati odvojeno: PASS /FAIL /NEEDS PHYSICAL TEST.

Nakon smislenih promjena ažurirati CURRENT_HANDOFF. Remote checkpointi samo continuation grana, sa stvarnim readbackom; javni origin je odobren, main ne pomaknuti usput. Nakon rada jasno napisati što je povezano, što ostaje gated i što je stvarno na telefonu.
