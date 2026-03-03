# Točan popis slika koje failaju učitati (InvalidStateError: could not be decoded)

Ove putanje se u konzoli javljaju kao **Failed to load** / **could not be decoded**. Možeš ih popraviti (valjani PNG) ili maknuti iz preloada ako su legacy i ne koriste se.

## Jedan po jedan (copy-paste za pretragu)

```
./assets/logo.png
./assets/wild-juice@2x.png
./assets/wild-juice@3x.png
./assets/gold-coin.png
./assets/mystery-box.png
./assets/ripple.png
./assets/fx/boom/boom_0001.png
./assets/fx/boom/boom_0002.png
./assets/fx/boom/boom_0003.png
./assets/fx/boom/boom_0004.png
./assets/fx/boom/boom_0005.png
./assets/fx/boom/boom_0006.png
./assets/fx/boom/boom_0007.png
./assets/fx/boom/boom_0008.png
./assets/fx/boom/boom_0009.png
./assets/fx/boom/boom_0010.png
./assets/fx/boom/boom_0011.png
./assets/fx/boom/boom_0012.png
./assets/fx/boom/boom_0013.png
./assets/fx/boom/boom_0014.png
./assets/fx/boom/boom_0015.png
./assets/fx/boom/boom_0016.png
```

## Napomene

- **logo.png** – u preloaderu se učitava uz `logo-cube-crash.png`; ako koristiš samo logo-cube-crash, možeš izbaciti `logo.png` iz liste.
- **wild-juice@2x.png, wild-juice@3x.png** – igra koristi `wild-juice` (wild-juice tile); ako imaš samo `wild-juice.png`, @2x/@3x mogu biti legacy ili krivi fileovi. Provjeri postoje li u `assets/`.
- **gold-coin.png, mystery-box.png** – referencirani u `constants.ts` i preload-assets; ako su legacy, makni reference i iz preloada.
- **ripple.png** – u `asset-preloader.ts` u ALL_ASSETS; ako se nigdje ne koristi, možeš izbaciti.
- **fx/boom/boom_*.png** – cijela boom sekvenca (16 slika). Ako boom efekt više ne koristiš, možeš izbaciti iz preloada; ako koristiš, trebaju valjani PNG-ovi.

## Gdje ih maknuti

- **asset-preloader.ts**: niz `ALL_ASSETS` (oko linija 51–205). Izbaci redove s gornjim putanjama ako ih ne želiš učitati.
- **constants.ts**: `ASSET_COIN`, `ASSET_MYSTERY` – ako makneš gold-coin/mystery-box, prilagodi ili ukloni te konstante i sve reference na njih.
