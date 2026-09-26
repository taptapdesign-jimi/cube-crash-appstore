# Stack to Six — popravci nakon dubinskog termalnog audita

Datum: 2026-09-25. Korisnik je nakon [audita](THERMAL_DEEP_AUDIT_2026-09-25.md) izričito odobrio popravke i zajedničke zaštite za Special/Wild kocke. Rad je u izvornom kodu na `main`, preko HEAD-a `2e6277fdbe83759f2d7807420de51a6d834c9104` i zatečenih Beach izmjena. Tri specijalista radila su po odvojenim vlasnicima, zatim neovisno pregledala druge dijelove integracije.

## Što je popravljeno

| Nalaz audita | Popravak i granica |
| --- | --- |
| Render iza Faila | Nakon dovršenog board-exita gase se postojeći tile idle vlasnici, nacrta završni kadar i zaustavi gameplay ticker. Hold preživljava foreground/pause/recovery. Nova ploča preuzima ponovno pokretanje. Isto vrijedi nakon skrivanja dovršenog Journey boarda; prozirni Arcade stage cue i njegova vidljiva animacija ostaju aktivni. |
| Skriveni Special idle rad | Jedan zajednički visibility owner pauzira vlastite tweenove/spawnove i preskače geometriju. Sheet/Flower/Barrel/Fish/Bee/Honey/Kanta, osnovni idle efekti i ostale varijante koriste zajedničku politiku, uz zasebno vlasništvo draga. Stari interval/delayed-call callback ne može ponovno alocirati nakon stopa. |
| Journey učitava Crate zvukove | Spawn preloader bira Backpack za Journey, Crate za Arcade, po istom modeu kao prikaz/playback. |
| Bottle/Spaceship pripremaju Honey | Stvarni Magnet merge pozivatelj provjerava prethodno uhvaćenu Honey varijantu. Zajednička Magnet podloga ostaje. Dodatno su uklonjeni pogrešni cijeli TNT/Juice paketi iz authored varijanti koje koriste samo vlastite zvukove i stvarno zajedničke podskupove. |
| Forest istiskuje sve SFX-ove | Jedan ograničen dugi loop ima zasebno računovodstvo od kratkih efekata. Stvarni Forest preload pri 48 kHz više ne izbacuje sam sebe. Zadržana je zaštita aktivnih glasova i eksplicitni OS-pressure cleanup. |
| Abortirani modal zadržava rad | Fail i Clean Board imaju jedan cleanup za CTA listenere, timer/RAF, tweene, zvuk i vlastiti DOM. Zakašnjeli import/restart/board-exit ne mijenja zamjenski ekran. Tutorial razlikuje Continue, navigacijski cancel i grešku prezentacije te koristi cleanup uhvaćen za svoj ekran. |
| Slijepi nadzor na 30 FPS | Stvarni frame gapovi uspoređuju se s očekivanih 33 ms. Zdravi idle ne aktivira smanjenje efekata; 100 ms gap se bilježi i obrađuje. Nadzor ne uvodi dodatni render loop. |
| Serijsko učitavanje Juice finalea | Živi tile priprema svoje base/accent teksture pri entryju/dropu. Zajednička queue drži najviše četiri aktivna loada; finale koristi isti owner i Pixi cache. Otkazivanje, retry i redoslijed tekstura su pokriveni testovima. Opcionalni prop timeout, zvuk i motion ostaju očuvani. |
| Continue prazni koristan audio | Uklonjen rutinski idle-audio purge iz next-board Continue. Eksplicitni memory-warning release ostaje. Ta stara grana nije bila Fail Play Again. |

Normalni Fail prema canonical resolveru nema efektivan igrivi Special. Popravak skrivenog Special rada zatvara dokazani uvjetni lifecycle propust; ne dokazuje da je takav vlasnik bio prisutan u korisnikovom današnjem Failu. Nije pronađen rast broja AudioContexta ili skrivenih Journey Worldova kroz svaki normalni retry.

## Memorijski kompromis

Bez velikog loopa mobilni cache ostaje 32 MiB, desktop 64 MiB. Samo jedan označeni loop **iznad 24 MiB i do 36 MiB** dobiva rezervirani slot uz **16 MiB zajedničkih kratkih efekata**. Forest pri 48 kHz ima približno 32.220 MiB; zajedno s punim SFX prostorom i zasebnim zabilježenim main-theme masterom to je oko **70.080 MiB PCM-a**. Najveći dopušteni loop plus isti master iznosi oko **73.860 MiB**. To nije izmjerena memorija procesa: aktivni/queued glasovi i fade preklapanja zaštićene su iznimke, a decoder/native/GPU memorija nije uključena.

Rezerva od 8 MiB nije mogla zadržati cijeli Flower/Barrel paket. Puni Barrel s redovnim merge/stack/pickup/poof/No Moves/landing zvukovima zauzima oko 14.820 MiB; Flower s istim osnovnim signalima 13.364 MiB. Testovi stvarnih preload vlasnika i dimenzija iz audio asseta pri 44.1/48 kHz potvrđuju pet ponavljanja bez self-eviction/redecodea tih paketa. Akumuliranje više obitelji i dodatnih Star/Backpack signala i dalje legitimno koristi ograničeni LRU; ne obećavamo da nijedan resurs nikad neće ponovno biti dekodiran. Beach i Area 55 ne uključuju Forest gameplay loop.

## Zaštita od ponavljanja

- Novi typed behavior testovi provjeravaju stvarne vlasnike i broje rad, umjesto samo traženja teksta u kodu. Svih 13 registriranih varijanti prolazi start → hide → stop → zakašnjeli load, ponovljeni stop i nula preostalih leaseova/callbackova/refova.
- Pokriveni su drag uz skrivanje/povratak, zamjena efekta prije starog callbacka, više vlasnika uz zajednički ticker te uklanjanje zadnjeg vlasnika.
- Dvadeset kontroliranih terminal → Play Again ciklusa provjerava zaustavljanje i točno jednog novog vlasnika pokretanja. Zasebno se provjerava završni render prije stopa i zastarjela terminalna generacija.
- Stvarni Fail/Clean/Tutorial + CTA kod testira uspjeh, abort, zamjenu, pozadinu, zakašnjeli image decode, board exit i setup grešku.
- Admission manifest za svaku varijantu sada mora uključiti zajedničke lifecycle/visibility/audio/finale/terminal testove. QA blokira izostanak. To je zaštita od poznatih klasa regresije, a ne jamstvo da budući kod nema nijedan bug.

## Validacija i isporuka

**PASS — konačni `npm run qa:full`: svih 16 gateova, 399 suiteova / 2.648 testova; Gameplay KING 24 / 306; TypeScript/unused/lint, asset-preservation/source/bundle/startup/native-source provjere i production build od 1.073 modula s native syncom isključenim.** Log: `logs/thermal-deep-audit-20260925/repair-qa-full-final.log`. Dodatni završni integracijski paket za render i Tutorial: 3 / 36 PASS (`root-review-tests-final.log`). `git diff --check`: PASS.

Ciljane audio provjere: 12 suiteova / 113 testova PASS. Render: 9 / 63 plus 14 / 115 postojećih testova PASS. Početni root texture/render/props paket: 3 / 30 PASS. Modal i naknadne review provjere zapisane su u priloženim logovima. `qa:fast`: 10 gateova / 135 suiteova / 1.138 testova PASS. Raniji propusti testnih adaptera ispravljeni su bez iznimke od type-safety baselinea; konačni puni prolaz uključuje te korekcije.

Web: lokalni HTTP radi; preko preglednika potvrđeni su Homepage i Journey pregled Forest/Beach/Area 55. Potpuna gameplay/merge/retry vizualna provjera nije proglašena završenom. Preglednik je tijekom provjere preuzeo korisnik. Zatečeni razvojni HMR host davao je WebSocket grešku; server otvoren za ovaj zadatak koristi lokalni host. To nije dokaz runtime kvara u bundled aplikaciji.

Službeni Web.bundle, native app i iPhone nisu mijenjani. Nema instalacije, restarta telefona, commita ni pusha. Postojeće korisnikove Beach kartice/nazivi i asseti nisu preuređivani ovim popravkom. Build za provjeru koristi `SKIP_NATIVE_BUNDLE_SYNC=true`.

**NEEDS PHYSICAL TEST:** temperatura, baterija, najgori frameovi, stvarno uklanjanje vidljivog merge-6 čekanja, izlaz/ulaz i zvučna ravnoteža na iPhoneu. Prije isporuke treba korisnikovo web odobrenje prema [LIVE_DEBUG_WORKFLOW](LIVE_DEBUG_WORKFLOW.md), zatim ista unplugged Beach → merge → Fail → Play Again ruta; Forest i Area 55 provjeriti zasebno. Iz postojećih source testova nije moguće pošteno obećati da se telefon više nikad neće zagrijavati.

## Dokazi

- [Audio popravci i stvarni paketi](../../logs/thermal-deep-audit-20260925/audio-fixes.md)
- [Render lifecycle popravci](../../logs/thermal-deep-audit-20260925/render-lifecycle-repair.md)
- [Modal lifecycle popravci](../../logs/thermal-deep-audit-20260925/modal-repair-summary.md)
- `logs/thermal-deep-audit-20260925/repair-qa-fast-final.log`, `repair-qa-full.log` i završni rerun log.
- Raniji probeovi uz audit ostaju povijesna reprodukcija kvara. Ne izvršavaju se niti tumače kao aktualna potvrda popravljenog ponašanja.
