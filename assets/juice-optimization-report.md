# Juice bounce — izvještaj optimizacije

Status: optimizirani kandidat; NIJE odobren kao Safari/WKWebView production asset. Obavezni izravni WebKit vizualni test i petominutni stress test nisu izvršeni zbog nedostupnog WebKita. Dostupni Chrome blokirao je lokalnu testnu stranicu porukom net::ERR_BLOCKED_BY_CLIENT. Ne tvrdimo da su zadovoljeni svi kriteriji prihvata.

## Datoteke i veličine

| Mjera | Original | Optimizirani SVG |
|---|---:|---:|
| Bajtovi | 583058 | 205685 |
| gzip, level 9, mtime=0 | 190507 | 149928 |
| Animacijski elementi | 85 | 10 |
| Najviše vrijednosti | 201 | 24 |
| fizz-bubble grupe | 36 | 0 |
| Path morphi | 2 | 1 (12 poza) |
| Ugrađene PNG slike | 1 | 1 |

Veličina je ispod ciljanog raspona 210–240 KB i ispod obaveznog maksimuma 250 KB; datoteka nije umjetno popunjavana. gzip je ispod 160 KB.

Prethodni SVG ostaje sačuvan kao `assets/redundant assets/juice-bounce.svg`; nije mijenjan ni obrisan. Njegov SHA-256 je `958e20d4bfcdd2be13b9515714a4c76b79154fc2c5ecf7dd05332eebd0a54c7e`.
Optimizirani SVG SHA-256: `c59842edfff61feae566fc6cde05c691aac6fc21be1c13ad0d8441e1da5dd3a6`.

## Promjene

Uklonjeno svih 36 fizz grupa, njihove 72 animacije, circle/ellipse elementi i njihov roditelj `continuous-fizz`.
Uklonjene neiskorištene definicije: `bubble`, `splash`, `big-juice`.
Uklonjen neiskorišten ID `lid-hole-repair`; njegova vidljiva geometrija ostaje.
`fizz-area` NIJE neiskorišten: zadržan je jer originalni animirani pomak teksture unutar šalice još koristi tu masku. Sačuvani svi potrebni clip-pathovi, maske, gradijenti i xlink reference.

Zajednička tekuća površina premještena je u definiciju `liquid-surface`, s jednim morphom i dva use consumera za originalni fill i highlight stroke. Završni rubovi zatvorenog patha nalaze se izvan inside clipa. Taj način dijeljenja animacije još zahtijeva izravnu WebKit provjeru.

200 intervala po animaciji zamijenjeno je kompaktnim kubičnim SMIL krivuljama. Zadržani su prijelazi mirovanja, pripremni squash, launch, uzlet, vrh, pad, impact, rebound i settle, te nezavisni pokreti poklopca i slamke. Ponavljanje neutralne vrijednosti na granicama hold intervala potrebno je za njihovo trajanje; višestruka stationary ponavljanja uklonjena su. Dva kratka opacity crossfade kanala uklonjena su u konačnom kandidatu; slojevita animirana šalica stalno je sastavljena umjesto prebacivanja na punu originalnu sliku. Pozicije imaju najviše dvije decimale, a scale tri; keyTimes i kontrolne točke krivulja koriste tri decimale radi timinga.

## Provjere koje su izvršene

- Validan XML; svi href i url(#...) consumeri imaju postojeće definicije.
- width=390, height=800, viewBox=0 0 390 800 i translate(53 239) scale(.78) identični originalu.
- Referentni resting artwork 384 × .78 = 299.52 SVG jedinice po stranici.
- Jedan identičan self-contained 384 × 384 PNG; nijedan njegov bajt nije promijenjen.
- Svih 10 animacija: dur="2s", repeatCount="indefinite", calcMode="spline"; jednake početne i završne vrijednosti.
- 0 filtera, blura, JavaScripta, foreignObject elemenata ili vanjskih resursa u SVG-u.
- Najviše 24 vrijednosti, odgovarajući broj keyTimes/keySplines; jedan morph s 12 vrijednosti.
- Numeričko uzorkovanje gotovih zaokruženih SMIL vrijednosti svakih 50 ms (41 uzorak uključujući kraj), uz dodatnu provjeru svakih 1 ms. Kubični x(t) invertiran je numerički; original evaluiran linearnom interpolacijom.

## Razlike i granice numeričke usporedbe

CSV sadrži usporedbu svakih 50 ms. `reference_*` označava transformirani referentni okvir 384 × 384, a ne izmjeren alpha bounding box vidljive šalice. To nije rasterizirana vizualna usporedba i ne potvrđuje crop svih vidljivih dijelova.

Najveća odstupanja referentnog okvira svakih 50 ms:
- središte x: 0.09730 SVG jedinica
- središte y: 0.07556 SVG jedinica
- širina: 0.23279 SVG jedinica
- visina: 0.23933 SVG jedinica

Pri 128 px artworku faktor je 128/299.52, pa navedene razlike širine/visine iznose približno 0.10 px. Gušće uzorkovanje otkriva veća kratka odstupanja; te brojke nisu gornja granica svih trenutaka.

Najveća komponentna odstupanja u provjeri svakih 1 ms (translate i path u lokalnim artwork jedinicama, rotate u stupnjevima):

| Kanal | Najveće odstupanje |
|---|---:|
| Liquid path kontrolne koordinate | 1.105124 |
| Glavni translate | 0.506389 |
| Glavna rotacija | 0.057513 |
| Glavni scale | 0.006042 |
| Liquid highlight translate | 0.058054 |
| Pomak teksture šalice | 0.102171 |
| Poklopac translate | 0.464526 |
| Poklopac rotate | 0.063461 |
| Slamka translate | 1.235829 |
| Slamka rotate | 0.347466 |

Krivulje su aproksimacija originalne linearne tablice, a ne matematički identična funkcija. Najveći lokalni pomak slamke je oko 1.24 jedinice (oko 0.41 px prije glavnog scale/rotate pri prikazu 128 px); najveća razlika scalea je 0.00604. Liquid kontrolne koordinate razlikuju se do oko 1.11 lokalnih jedinica. Fizz bubbles su namjerno uklonjeni. Ne tvrdimo da je ostatak perceptualno identičan bez browser provjere. Nevidljivi kasni liquid pokreti vraćeni su u neutralnu vrijednost radi spoja loopa.

Brojčana jednakost početka i kraja potvrđena je. Stvarni render spoja, trenutak odvajanja vidljive šalice od poda, vrh, udarac, crop x=20/y=110/350×460, poklopac, slamka i oštrina nisu potvrđeni screenshot usporedbom u WebKitu.

## Safari/WebKit i šest primjeraka

| Zahtjev | Rezultat |
|---|---|
| Direktni IMG u Safari/WebKitu | Nije izvršeno; dostupan samo Chrome |
| Šest loopova najmanje 5 minuta | Nije izvršeno |
| Prosječni/p95 frame interval | Nema mjerenja |
| Serije intervala >34 ms | Nema mjerenja |
| Rast internog DOM/SVG broja | Nije izmjeren |
| Povrat broja elemenata nakon 50 create/remove ciklusa | Nije izvršeno |
| Safari warning/parse error | Nije provjereno; XML parser prolazi |
| Dodatni prosječni frame trošak ≤2 ms | Nije potvrđeno |

Za fizičku potvrdu još treba izraditi ili vratiti `juice-stress-test.html` s točno šest izravnih IMG elemenata kanonskog `assets/shop/juice/juice-bounce.svg` URL-a. Test treba mjeriti 30 sekundi statičnog PNG baselinea pa najmanje 300 sekundi SVG prikaza te odraditi 50 create/remove ciklusa. PNG baseline treba izvesti iz istog originalnog ugrađenog PNG-a, a artwork skalirati na 128 × 128 px uz isti postojeći motion crop.

JavaScript postoji samo u zasebnoj testnoj HTML stranici radi mjerenja; animacija SVG-a je isključivo SMIL. Svi primjerci koriste isti SVG src. rAF intervali ne dokazuju render CPU/GPU trošak niti kontinuirani SMIL napredak; dodatni 2 ms budžet zahtijeva Safari Instruments/Web Inspector profiliranje. HTML brojač ne može pristupiti internom SVG stablu kroz IMG i nije dokaz odsutnosti memorijskog curenja. resource error event nije zamjena za Safari konzolu. Nastavak svih šest animacija treba vizualno promatrati tijekom pet minuta.

Aplikacijski TypeScript/Pixi/gameplay/drag i vanjski bubbles nisu dirani pri zadnjoj zamjeni SVG sadržaja; postojeći runtime i preloader već koriste kanonski URL `assets/shop/juice/juice-bounce.svg`.
