# Launch Screen Background Flash - Problem Analysis & Solution

## Problem
Bijela pozadina (#F9F9F9) blicne sa gradient pozadinom prije taptapdesign logotipa.

## Breakdown - Što se događa (trenutno)

### Redoslijed događanja:

1. **HTML se učitava**
   - ✅ Inline style u `<head>` postavlja `#F9F9F9` na `html,body` s `!important`
   - ✅ DOBRO: Bijela pozadina postavljena odmah

2. **CSS se učitava** (`style.css`)
   - ❌ **PROBLEM 1**: Linija 478 (minificirani CSS): `html,body{...background:var(--app-gradient, ...)}`
   - ❌ **PROBLEM 2**: `#global-bg` element ima gradient pozadinu u CSS-u (linija 32)
   - ❌ **PROBLEM 3**: `#global-bg` ima `z-index: 1`, što znači da je iznad body pozadine
   - ❌ **PROBLEM 4**: CSS override-uje inline style jer se učitava nakon HTML-a

3. **bootstrapReady Promise se izvršava** (vrlo rano, čim je DOM ready)
   - Poziva `bootstrapUI()` koji kreira DOM elemente
   - `#global-bg` element se možda kreira ovdje (ako postoji u HTML-u)

4. **initializeApp() čeka bootstrapReady**
   - Tek onda poziva `startAssetPreloading()`

5. **startAssetPreloading()**
   - Poziva `launchScreen.init()` koji postavlja `#F9F9F9`
   - ❌ **PROBLEM 5**: Prekasno! CSS je već postavio gradient

## Root Cause

**CSS se učitava PRIJE nego što JavaScript stigne postaviti pozadinu, i:**
1. Minificirani CSS na liniji 478 postavlja gradient na `html,body`
2. `#global-bg` element ima gradient pozadinu i `z-index: 1` (iznad body-a)
3. JavaScript postavlja `#F9F9F9` prekasno (nakon što se CSS već primijenio)

## Rješenje (implementirano)

1. ✅ **Postavljen `#F9F9F9` u CSS-u za `#global-bg`** (umjesto gradienta)
2. ✅ **Postavljen `#F9F9F9` u minificiranom CSS-u za `html,body`** (umjesto gradienta)
3. ✅ **Inline style u HTML head** postavlja `#F9F9F9` s `!important`
4. ✅ **Launch screen postavlja `#F9F9F9`** u `init()` funkciji
5. ✅ **Gradient se postavlja tek u Phase 2** (kada se pojavi stack to six logo) u `launch-screen.ts`

## Provjera

- [x] `#global-bg` ima `#F9F9F9` u CSS-u
- [x] Minificirani CSS postavlja `#F9F9F9` na `html,body`
- [x] Inline style u head postavlja `#F9F9F9` s `!important`
- [x] Launch screen postavlja `#F9F9F9` u `init()`
- [x] Gradient se postavlja tek u Phase 2

