# 🎨 Premium Launch Screen - Rješenje

## Problem
App se otvara sa bijelom bojom, onda se "snapa" na drugu boju, i tek onda krene preloader screen. To ne izgleda premium.

## Rješenje

### 1. **iOS LaunchScreen.storyboard** (VAŽNO: Rebuild iOS app u Xcode!)
- Promijenjen `backgroundColor` na crnu (#000000) za test
- **NAPOMENA**: Promjene u LaunchScreen.storyboard se primjenjuju samo nakon rebuild-a iOS app-a u Xcode!

### 2. **Capacitor Config**
- `backgroundColor: '#000000'` - crna boja za test
- `launchFadeOutDuration: 300` - duži fade za smooth transition

### 3. **HTML Initial Paint**
- Postavlja crnu boju (#000000) odmah u `<head>`
- Smooth fade-in na app boje nakon 2 frame-a
- Transition: 0.3s ease

### 4. **Native Splash Hide**
- Duži fade (300ms umjesto 200ms)
- Više `requestAnimationFrame` poziva za smooth transition

## Premium Dojam - Preporuke

### ✅ Što je urađeno:
1. **Smooth fade transition** - 300ms fade umjesto 200ms
2. **Matching boje** - sve koristi istu boju za seamless transition
3. **Multiple frame waits** - osigurava smooth rendering

### 🎯 Dodatne preporuke za premium dojam:

1. **Splash Screen Image** (opcionalno):
   - Kreirati splash screen sliku sa logo-om na crnoj pozadini
   - Dodati u `ios/App/App/Assets.xcassets/`
   - Koristiti umjesto solid boje

2. **Loading Screen Animation**:
   - Smooth fade-in animacija za loading screen
   - Progress bar animacija
   - Logo animacija (scale/fade)

3. **Optimizirati Asset Loading**:
   - Preload kritične slike (logo, homepage hero)
   - Lazy load ne-kritične assete
   - Cache strategija

4. **Smooth Transitions**:
   - Fade između splash → loader → homepage
   - Matching timing (svi fade-ovi 300ms)
   - Ease-in-out curves

5. **iOS Specific**:
   - Provjeriti `Info.plist` - možda dodati `UIStatusBarStyle`
   - Rebuild iOS app u Xcode nakon promjena
   - Testirati na stvarnom uređaju (ne simulator)

## Testiranje

1. **Rebuild iOS app u Xcode**:
   ```bash
   cd ios/App
   # Otvori App.xcworkspace u Xcode
   # Clean Build Folder (Cmd+Shift+K)
   # Build (Cmd+B)
   # Run na uređaju
   ```

2. **Provjeriti**:
   - LaunchScreen se prikazuje odmah (crna boja)
   - Smooth fade u loading screen
   - Nema bijelog flash-a
   - Smooth transition u homepage

## Napomena

**VAŽNO**: Promjene u `LaunchScreen.storyboard` se primjenjuju samo nakon rebuild-a iOS app-a u Xcode! Capacitor sync ne dovoljno - treba full rebuild.

