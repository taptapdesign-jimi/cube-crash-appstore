# Bloob Animation — Shards Float Hovering v1

Arhivirani zapisnik izvorne Native Bloob Pod merge-six animacije, 23.10.2026.

**Status:** ovaj se preset čuva za buduće repliciranje. Naknadni korisnikov zahtjev zamjenjuje aktivni Bloob runtime Barrel/TNT gas efektom s natpisom GASSS!; ova arhivirana koreografija, manifest i uzorci ostaju neizmijenjena referenca.

**Naziv za pozivanje:** `Bloob Animation — Shards Float Hovering`.
**Ključne riječi:** `bloob animation`, `bloob shards float hovering`, `blob hovering`, `dizanje shardsa`, `lebdeći blobovi`, `Bloob Pod finale`, `gravity fall`, `BLOOOB!`.

Kad korisnik kaže „repliciraj Bloob shards float hovering”, otvoriti ovaj zapisnik i njegove reference prije implementacije. To označava cijelu dolje opisanu koreografiju. U novom kontekstu preuzeti samo traženi vizualni recept; nagrade, bodovanje, spawn i gameplay ostaju u vlasništvu odredišne značajke.

## Zamrznuta referenca i reprodukcija

- Git commit: `7f31bfdbed0a63b8f1d5e9dd8ce9eb8a68479aed` (online main u trenutku zapisnika).
- [Manifest izvora i originalnih asseta](BLOOB_SHARDS_FLOAT_HOVERING_V1.manifest.json): putanje, SHA-256 i veličine.
- [Deterministički profili i uzorci položaja](BLOOB_SHARDS_FLOAT_HOVERING_V1.samples.json): svih 48 shardsa i 8 Bloobova, viewport 390×844, lokalni vizualni SplitMix64 seed `0xB100B20261023`; 9 vremenskih uzoraka po objektu. Nastalo izvršavanjem stvarnog `NativeBloobBallFinaleMotion`, a ne ručnim prepisivanjem formule.
- Ovo je referenca **aktualnog izvornog recepta**, ne snimka točno jednog nasumičnog izvođenja na telefonu. Za identičan raspored koristiti iste profile ili isti RNG algoritam, seed, redoslijed poziva i viewport. Za isti karakter animacije koristiti izvornu distribuciju s novim vizualnim randomom.
- Cijeli originalni kod, uključujući detaljne SVG keyframe tablice, dostupiti bez oslanjanja na budući `main`:

```sh
git show 7f31bfdbed0a63b8f1d5e9dd8ce9eb8a68479aed:native/gameplay-ui/NativeBloobBallFinaleMotion.swift
git show 7f31bfdbed0a63b8f1d5e9dd8ce9eb8a68479aed:native/gameplay-ui/NativeBloobBallFinalePresentation.swift
git show 7f31bfdbed0a63b8f1d5e9dd8ce9eb8a68479aed:native/gameplay-ui/NativeBloobBallArt.swift
```

## Izgled i redoslijed

Glavni Bloob putuje u suprotni kvadrant uz sve brže kruto podrhtavanje. Istodobno se iz prostora ispod ekrana diže razasuto polje kamenih shardsa i malih animiranih Bloobova. Svaki objekt ima vlastiti odmak početka, poziciju, veličinu, fazu, nagib i prednji/stražnji sloj. Nakon mekog usporavanja lebdi, zatim iz istog položaja i brzine ubrzava u gravitacijski pad. Nekoliko Bloobova pukne tijekom izlaska. Natpis je bijel, lagano proziran s cyan glowom.

**Bitno:** pozadinsko dizanje počinje na zajedničkom `t=0`, ne tek u trenutku glavne eksplozije. Shardsi se ne razlijeću radijalno iz središta eksplozije; ulaze odozdo prema svojim rasutim odredištima. Coin scatter je zaseban tok koji polazi iz eksplozije.

## Zajednička vremenska os

| Vrijeme od početka ownera | Događaj |
| --- | --- |
| `0` | Prvi paint: cue `rise`; pokreću se floating profili i clock natpisa. |
| `entry ∈ [0, 0.16)` | Pojedinačni objekt počinje svoj fade-in i dizanje. |
| `0 … 0.6 s` | Glavni Bloob putuje 30% vektora do suprotnog inset-kuta, s lukom i shakeom. |
| `0.6 s` | Završava putovanje; izvorna centralna SVG animacija kreće brzinom `4×`. |
| `0.85 s` | Glavni burst (`0.6 + 1/4`); cue `burst`, jednom. |
| `0.99452077457 s` | Glavni efekt se skriva (`0.6 + 1.57808309828/4`); šest coin callbackova iz istog burstOrigina, jednom. |
| Po profilu | Završetak dizanja → hovering → gravitacijski pad; rani izlazi imaju zasebnu kraću zadršku. |
| `fallStart + 0.12/1.4` | Bloobovi indeksa `0,3,6` počinju `140 ms` pop-inflation; nakon toga se skrivaju i daju cue `pop`. |
| `1.14 s` | Početak izlaza natpisa `BLOOOB!`; pomak `60 ms` po slovu. |
| `2.15 s` | Izračunato trajanje natpisa sa sedam znakova. |
| `max(motion.duration, glyphs.duration)` | Završetak cijelog finite ownera; nije hardkodirano na trajanje centralnog SVG-a. |

Clock je UIKit koordinatni sustav: `(0,0)` gore lijevo, pozitivni `y` prema dolje. Dimenzije i pomaci su u logical points, vrijeme u sekundama, nagibi u stupnjevima osim argumenata za `sin/cos`.

## Glavni Bloob: putovanje, shake i burst

- Veličina centralnog carriera `224×224`; anchor `(0.5, 380/640)`; sloj `z=8`.
- Polazi iz stvarne pozicije mergea; ako pozicija nije zadana, iz centra viewporta.
- Suprotni kut: `x = W−64` ako je origin lijevo od sredine, inače `64`; `y = H−120` ako je origin iznad sredine, inače `120`.
- `burstOrigin = origin + 0.3 × (corner − origin)`.
- Putovanje `0.6 s`, smoothstep `u²(3−2u)`; dodatni vertikalni luk `−24 sin(πu)`.
- Do `0.85 s` glavni carrier ostaje krut, bez squash/stretch skaliranja. Rotacija je `shake.x × 0.004` rad.
- Shake: `p=t/0.85`, faza `2π(3t + 5.5t²/0.85)`, amplituda `p(1+5p²)`; `x=sin(faza)×amplituda`, `y=sin(0.83×faza+1.1)×amplituda×0.65`. Frekvencija raste 3→14 Hz, odmak približno do 6 pt horizontalno i 3.9 pt vertikalno. Nakon bursta shake je nula.
- Izvorni SVG keyframeovi `y/sx/sy` koriste cubic-bezier `(0.42,0,0.58,1)` s numeričkim rješavanjem x (20 iteracija); točne tablice sačuvane su u referentnom `NativeBloobBallFinalePresentation.swift`.
- Finale atlas: 6 originalnih poza po `640×640`, raspored `3×2`. SVG-time frame pragovi: `1`, `1.0882104`, `1.205833`, `1.294044`, `1.365495`; prije `1` je frame0. Vrijedi `svgTime=max(0,t−0.6)×4`.

## Floating polje: broj, raspored i veličine

**8 Bloobova:** osnovni normalizirani x `[.25,.76,.47,.20,.79,.36,.65,.51]`, y `[.76,.69,.56,.43,.31,.20,.86,.40]`. Svaki x dobiva jitter `(r−0.5)×.07`. Veličina `(72+20r)×(.8+.7r)` s neovisnim rollovima, raspon približno 57.6–138 pt. Parni indeksi su naprijed (`z=7`), ostali iza (`z=3`). Dva čija su ciljna y najbliža `0.5` rano izlaze.

**48 shardsa:** jednom shuffle slotova `0…47` i zaseban shuffle asset raspodjele `index % 7`.

- Slotovi `0…37`: `x=.035+(slot%4+.1+.8r)/4×.93`; `y=.025+(floor(slot/4)+.1+.8r)/10×.875`; veličina `46+58r` pt.
- Slotovi `38…47`: sitniji centralni debris; `x=.2+.6r`, `y=.32+.36r`, veličina `46×(.7+.5r)` pt.
- Svi koriste 7 originalnih `rock1@2x.png … rock7@2x.png` iz Spaceship biblioteke, `scaleAspectFit`.
- Svaki shard ima 35% šanse biti prednji (`z=6`), inače je iza (`z=1`).
- Tri shardsa s najmanjim ciljnim y rano izlaze; to nije „prva tri” u shuffle nizu.

## Točan motion recept po objektu

Neovisni profili se generiraju samo jednom u konstruktoru; paint ne uzima nove slučajne brojeve.

| Parametar | Distribucija / pravilo |
| --- | --- |
| entry | `0.16r` s |
| riseDuration | `.95+.25r` s |
| holdDuration | `.55+.45r` s, zatim podijeljeno s `1.4` |
| phaseX, phaseY, tiltPhase | svaki zasebno `2πr` |
| frequencyX, frequencyY | `1.5+.8r`, `1.4+.8r` rad/s |
| nagib Blooba | amplituda `9+6r`°, frekvencija `.55+.45r` rad/s |
| nagib sharda | amplituda `14+10r`°, frekvencija `.7+.6r` rad/s |
| tiltDirection | neovisno `−1` ili `+1` |
| baseRotation / mirror | `90r`° / neovisni horizontalni mirror 50% |
| gravitacija | `(950+350r)×1.4²` pt/s² |

Za rani izlaz: `effectiveRise=min(riseDuration,.88)`, zadrška `.02/1.4`; za ostale `effectiveRise=riseDuration`, zadrška `holdDuration/1.4`.

```text
settled = entry + effectiveRise
fallStart = settled + (earlyExit ? .02 : holdDuration) / 1.4
u = clamp((t−entry)/effectiveRise, 0, 1)
e = 1−(1−u)^3
scale = .25 + .75e
alpha = clamp((t−entry)/.15, 0, 1)
x = W×profile.x + 14 sin(t×frequencyX+phaseX)×e
baseY = H×profile.y + (H+100−H×profile.y)×(1−e)
rotation = baseRotation + sin(t×tiltFrequency×tiltDirection+tiltPhase)×tiltAmplitude
```

Prije pada: `y=baseY+16 sin(t×frequencyY+phaseY)×e`.

Nakon pada: uz `f=t−fallStart`, `φ=fallStart×frequencyY+phaseY`, vrijedi `y=baseY+16 sinφ+16×frequencyY×cosφ×f+0.5×gravity×f²`. Time se zadržava i položaj i vertikalna brzina hoveringa pri predaji gravitaciji (C1 prijelaz). Horizontalna sinusna putanja i nagib nastavljaju se tijekom pada.

Objekt ostaje neproziran tijekom pada; skriva se tek kad `t≥fallStart && y−size>H`. Ne dodavati fade-out umjesto fizičkog izlaska.

`motion.duration = max(4.1/1.4, max(profile.fallStart + sqrt(2×(H×(1−profile.y)+2×profile.size+100)/profile.gravity) + .3))` preko svih 56 profila. Minimalni lifetime približno `2.928571 s`; stvarni ovisi o viewportu i profilima. Izlazak ubrzan `1.4×` zadržava izvorno dizanje; gravitacija je zato pomnožena s `1.4²`.

## Mali Bloob: vlastita animacija i pop

Floating atlas potječe iz `bloob.svg`: 40 frameova od `256×256`, raspored `8×5`; originalni loop `1.635865961197037 s` uz nelinearne frame-start pragove iz `NativeBloobBallArt.floatingFrame`.

Svaki Bloob dobiva vlastiti `playbackRate=1.3+phaseX/(2π)×1.5` (1.3–2.8×) i `playbackPhase=phaseY`. `localTime=t×playbackRate+playbackPhase`. Uz vlastiti atlas primjenjuje se disanje `b=.91−.09 cos(localTime/5.6×2π)`.

Za indekse0/3/6: `popProgress=clamp((t−popStart)/.14,0,1)` i `b *= 1+.38×popProgress²`. Konačni x/y scale je `pose.scale×b` (x uz mirror). Na kraju popa carrier se skriva; cue se dostavlja jednom. Ostalih pet Bloobova pada do fizičkog izlaska.

Ne zamijeniti ovaj floating atlas s `bloob ball.svg`: potonji je 32-frame obični board/collection idle sa školjkom. On je u manifestu radi identiteta, ali nije osam lebdećih carriera finalea.

## Natpis, zvuk i coini

- `BLOOOB!`, `NativeSplashGlyphField.clankStyle`: ExtraBold iz originalnog artwork font loadera, bijela slova opacity `.8…1`, četiri cyan glow sloja (radijusi 6/14/30/48). `z=10`, fitToWidth, originalna pojedinačna veličina/bounce i nasumični tilt grupe; lifecycle dijeli clock finalea.
- Slovo `i` ulazi na `.3+.05i`, `backOut(2)` 300ms do scale1.2, 120ms do.95 (`power2Out`), 120ms do1 (`backOut(1.5)`), zatim authored idle i izlaz od `1.14+.06i`. Točne 3D izlazne krivulje i paleta su u zamrznutom glyph owneru.
- `merge`: samo `gun/beam1.wav` gain `.4284`.
- `rise`: radio break `.18`, air `.6`, hovering `.6`, hovering2 `.18`; posljednja dva stopAfter2.9s s fadeOut.12s.
- `burst`: CTA pop `.6`, bum puf `.6`, splat `.42`, crash `.3` uz55ms delay, juice mini2 `.39` uz90ms delay.
- `pop`: CTA `poping.wav` gain `.6`; odvojeni voice identitet po indeksu. Gains su programski gains, ne postavka glasnoće telefona.
- Šest coin receiptova (`ballCount=6`) kreće iz `burstOrigin` nakon centralnog efekta. Svaki ima organski cubic scatter: radijus45–145pt, individualni delay0–.48s, tempo faktor.65–1.25 i putanju64segmenata do svojeg HUD cilja. Koristi već uhvaćenu vizualnu entropiju, bez novog Core RNG-a; potpuni recept `NativeSourceHUDStarPlan.bloobScatter` u manifestu.
- Vidljivih8 floating Bloobova, šest coin receiptova i `bonusDiceCount=2` tri su odvojena broja s različitim vlasništvom. Preslikavanje vizualnog recepta ne mijenja ih automatski.

## Resursi i lifecycle pri repliciranju

Originalne SVG/PNG/audio byteove sačuvati. Postojeći artwork loader parsira ugrađene SVG bitmapove, složi atlase u selected preparation queueu i ponovno ih koristi; nema dekodiranja/slučajnih drawova po frameu. Ne dodavati browser/WKWebView radi SVG-a.

Jedan `NativeFinitePresentation` finite clock/lease uzorkuje cijeli efekt. `isUserInteractionEnabled=false`; ne blokirati gameplay overlayem. Background, suspension ili odsutan window pauziraju owner. Sve pozicije uzorkovati iz elapsed-time; ne akumulirati po frameu. Cue/coin receipts su once-only, uključujući preskočene frameove; disposal briše callbackove, viewove, clock lease i observers. Generation i exact-owner guardovi u `NativeGameplayViewController` sprječavaju kasni callback u drugu ploču. Ukupni lifetime prati `max(motion,glyphs)`, a ne beskonačni hovering loop.

## Provjera replike

1. Usporediti izvore/assets s manifestom ili koristiti fiksni Git commit.
2. Za identičnu geometriju učitati profiles JSON ili reproducirati navedeni SplitMix64; zadržati istu potrošnju RNG-a. Vizualni RNG ne spajati s gameplay RNG-em.
3. Usporediti sve sampled poses (floating point tolerancija npr.1e−7), zatim stvarno renderirati 390×844 i manji viewport; provjeriti z-order, ulaz ispod ekrana, prozirnost samo pri ulazu, tilt, hovering, C1 prijelaz i izlaz.
4. Pustiti cijeli efekt do kraja i provjeriti once-only cue/coins, pause/resume, late generation i weak release.
5. Postojeći test owner: `NativeBloobBallTests`, osobito `testCapturedScatterHalfRiseBurstsGentleTiltAndGravity`, `testMergeAnchoredReceiptsAreOnceEachEvenOnSkippedFramesAndDispose`, `testPreBurstShakeAcceleratesWithoutRandomnessOrResidualOffset`, `testActualAudioOwnerGatesRepeatedBurstSettingsBackgroundAndGeneration`.
6. Ranije izvedene Native/QA provjere su u handoffu od23.10.; ovaj zapisnik nije nova potvrda fizičkog vizualnog osjećaja.

Ovaj zadatak dodaje samo razvojni zapisnik i reference; ne mijenja runtime, assete, animaciju ili instaliranu aplikaciju. Datoteke ostaju izvan application resource/copy roots.
