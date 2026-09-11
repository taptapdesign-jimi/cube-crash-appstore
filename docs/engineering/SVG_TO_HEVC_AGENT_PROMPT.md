# Automatski SVG/PNG u HEVC-alpha zadatak za agenta

## Uputa agentu

Korisnik ce uz ovu uputu priloziti jedan ili vise SVG i PNG fileova te ce u
poruci svojim rijecima opisati kako zeli da zavrsna animacija izgleda.

Tvoj zadatak je samostalno pregledati sve prilozene fileove i korisnikov opis,
prepoznati koji je animirani SVG izvor, koje su PNG datoteke vizualne reference
ili fallbackovi te napraviti gotov transparentni HEVC-with-alpha `.mov` za
Stack to Six. Nemoj od korisnika traziti da rucno odreduje putanju, trajanje,
broj frameova, canvas ili codec ako to mozes utvrditi iz priloga i opisa.

Radi ovim redoslijedom:

1. Procitaj `/Users/user/cube-crash/AGENTS.md` i radi samo unutar
   `/Users/user/cube-crash`.
2. Pronadi upravo prilozene SVG/PNG fileove u workspaceu. Nemoj zamijeniti ili
   prepisati njihove originale.
3. Vizualno pregledaj PNG reference i SVG. PNG koristi za velicinu, kadar,
   orijentaciju, boje i ocekivani izgled; animaciju uzimaj iz SVG-a.
4. Procitaj cijeli SVG source i sam utvrdi potpuni period animacije. Pregledaj
   sve SMIL/CSS `dur`, `begin`, `repeatCount`, keyframe i medusobno povezane
   periode. Export mora obuhvatiti puni zajednicki loop, a ne proizvoljnu jednu
   sekundu ili samo najkracu internu animaciju.
5. Iz SVG `viewBoxa` sam odredi omjer stranica. Ne rastezi artwork, ne rezi ga,
   ne okreci ga po Y osi i zadrzi potpuno prozirnu pozadinu.
6. Korisnikov tekstualni opis ima prednost za brzinu, velicinu, kadar, loop i
   druge vizualne zahtjeve. Ako opis ne zada drugacije, koristi ove Stack to Six
   zadane vrijednosti:
   - sirina 680 px;
   - 30 fps;
   - visina iz izvornog `viewBox` omjera, zaokruzena samo na codec-safe granicu;
   - output trajanje jednako punom izvornom periodu;
   - bez dupliciranja zadnjeg/pocetnog framea na loop spoju.
7. Za export koristi postojecu provjerenu naredbu
   `scripts/generate-svg-hevc-alpha.mjs`. Sam slozi ulaznu i izlaznu putanju,
   `source-duration-ms`, eventualni `output-duration-ms`, sirinu i FPS. Kao
   izlazni naziv koristi smisleni naziv izvornog SVG-a sa sufiksom
   `-hevc.mov`, u istoj asset obitelji, osim ako korisnik trazi drugi naziv.
8. Generiraj QA frameove u zasebnom `/tmp` direktoriju. Vizualno pregledaj prvi,
   srednji i zadnji frame te po potrebi dodatne frameove oko vaznih trenutaka.
9. Potvrdi:
   - HEVC `.mov` i alpha kanal;
   - tocne dimenzije, frame count, FPS i trajanje;
   - uspravnu orijentaciju i pravilan omjer;
   - prozirnu pozadinu;
   - da nema cropa, crnog pravokutnika, tamnog alpha ruba ni loop seama;
   - da se animacija stvarno mijenja kroz uzorkovane frameove;
   - byte size i SHA-256.
10. Ako prvi export nije vizualno ispravan, sam pronadi uzrok i ponovi export.
    Nemoj predati ocito pogresan file.

Ne koristi obicni HEVC bez alpha kanala. Ne koristi ffmpeg fallback koji izgubi
prozirnost. Ne mijenjaj gameplay kod, `dist`, Stack to Six `Web.bundle`, Xcode
projekt ili instaliranu aplikaciju. Ne integriraj novi video u runtime osim ako
korisnik to izricito zatrazi.

Na kraju korisniku predaj:

- klikabilnu putanju gotovog `.mov` filea;
- kratko sto si zakljucio iz SVG-a i PNG reference;
- stvarne export podatke: dimenzije, trajanje, FPS, frame count, codec, velicinu
  i SHA-256;
- rezultat vizualne provjere;
- tocno jedan verdict: `PASS`, `FAIL` ili `NEEDS VISUAL REVIEW`.

## Kako korisnik koristi ovaj file

Korisnik treba samo:

1. priloziti ovaj `.md` file;
2. priloziti svoj animirani SVG i pripadajuce PNG reference;
3. u input box svojim rijecima opisati sto zeli, primjerice:

```text
Od ovih priloga napravi transparentni HEVC video. PNG je referenca kako lik
mora izgledati. Zelim da cijela SVG animacija ide malo brze i da nista nije
odrezano. Vrati mi gotov MOV file.
```

Sve tehnicke odluke i provjere nakon toga pripadaju agentu.
