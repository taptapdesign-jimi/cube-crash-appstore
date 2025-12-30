# 🔧 Launch Screen Fix - Sve što je urađeno

## Problem
Bijeli flash se pojavljuje prije nego što se HTML učita, unatoč svim promjenama.

## Root Cause
1. **WKWebView default white background** - WKWebView ima default bijelu pozadinu dok se HTML ne učita
2. **Splash.imageset override** - Capacitor možda koristi splash images umjesto LaunchScreen.storyboard
3. **iOS cache** - iOS možda cache-ira LaunchScreen.storyboard

## Rješenja koja su primijenjena

### 1. ✅ Background View ispod WKWebView-a
**Lokacija**: `ios/App/App/ViewController.swift`

- Dodan `backgroundView` sa dark theme color (#1a0f0a)
- View se kreira u `loadView()` PRIJE WebView inicijalizacije
- View se postavlja na `z-index: 0` (ispod WebView-a)
- WebView je transparent (`isOpaque = false`, `backgroundColor = .clear`)

**Zašto**: Dark background view je vidljiv kroz transparent WebView dok se HTML ne učita.

### 2. ✅ Obrisan Splash.imageset
**Lokacija**: `ios/App/App/Assets.xcassets/Splash.imageset/`

- Obrisan cijeli `Splash.imageset` folder
- Osigurava da Capacitor koristi LaunchScreen.storyboard umjesto splash images

**Zašto**: Splash images možda override-uju LaunchScreen.storyboard background color.

### 3. ✅ LaunchScreen.storyboard
**Lokacija**: `ios/App/App/Base.lproj/LaunchScreen.storyboard`

- Background color postavljen na dark theme color (#1a0f0a)
- RGB: (0.102, 0.059, 0.039)

**Zašto**: Native iOS launch screen koristi dark color umjesto bijele.

### 4. ✅ Capacitor Config
**Lokacija**: `capacitor.config.ts`

- `backgroundColor: '#1a0f0a'`
- `SplashScreen.backgroundColor: '#1a0f0a'`
- `launchAutoHide: false` - SplashScreen se ne sakriva automatski

**Zašto**: Capacitor SplashScreen plugin koristi dark color i čeka eksplicitno sakrivanje.

### 5. ✅ HTML Boot Class
**Lokacija**: `index.html`

- Dark background sa `!important` na `html` i `body`
- Boot class se uklanja nakon što Pixi renderira prvi frame
- Gradient se primjenjuje tek nakon uklanjanja boot class-a

**Zašto**: Osigurava dark background dok se HTML ne učita.

### 6. ✅ AppDelegate Window Background
**Lokacija**: `ios/App/App/AppDelegate.swift`

- Window background postavljen na dark theme color

**Zašto**: Osigurava dark background na app level-u.

## iOS Verzija
- **Minimum Deployment Target**: iOS 14.0
- **Podfile**: `platform :ios, '14.0'`

## Testiranje

### Koraci:
1. **Obriši Derived Data**:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
   ```

2. **U Xcode**:
   - Product → Clean Build Folder (`Cmd + Shift + K`)
   - Product → Build (`Cmd + B`)
   - Obriši app sa uređaja (dugi pritisak → Remove App)
   - Product → Run (`Cmd + R`) - na STVARNOM UREĐAJU

3. **Provjeri**:
   - LaunchScreen.storyboard se prikazuje (dark color)
   - Nema bijelog flash-a između splash i HTML-a
   - Smooth transition u app

## Ako i dalje vidiš bijelu boju:

### Mogući uzroci:
1. **iOS cache** - iOS možda cache-ira LaunchScreen.storyboard
2. **Capacitor plugin override** - Možda Capacitor override-uje LaunchScreen na neki način
3. **WKWebView timing** - Možda postoji "gap" između native splash i WebView-a koji ne mogu kontrolirati

### Alternativna rješenja:
1. **Koristi splash image** - Kreiraj dark splash image umjesto solid color
2. **Provjeri Capacitor verziju** - Možda postoji bug u verziji koju koristiš
3. **Provjeri iOS verziju na uređaju** - Možda se ponaša drugačije na različitim verzijama

## Napomena

**Ako i dalje vidiš bijelu boju nakon svih ovih promjena:**
- Možda je problem u iOS native layer-u koji ne mogu dosegnuti
- Možda postoji neki drugi mehanizam koji kontrolira initial background
- Možda je potrebno prihvatiti mali flash (nekoliko milisekundi) što je često slučaj na iOS-u

