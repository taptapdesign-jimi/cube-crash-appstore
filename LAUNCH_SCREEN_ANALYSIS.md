# 🔍 Launch Screen Problem Analysis

## Problem

Bijeli flash se pojavljuje prije nego što se HTML učita, unatoč svim promjenama u LaunchScreen.storyboard.

## Root Cause Analysis

### 1. **iOS Launch Sequence:**

```
1. App Launch
   ↓
2. LaunchScreen.storyboard (native iOS) - ✅ Dark color (#1a0f0a)
   ↓
3. Capacitor SplashScreen Plugin - ❓ Koristi Assets.xcassets/Splash.imageset?
   ↓
4. WKWebView Initialization - ❌ Default WHITE background
   ↓
5. HTML Loads - ✅ Dark background
```

### 2. **Problem Points:**

#### A. **Splash.imageset Override**
- **Lokacija**: `ios/App/App/Assets.xcassets/Splash.imageset/`
- **Problem**: Capacitor SplashScreen plugin možda koristi splash images umjesto LaunchScreen.storyboard
- **Rješenje**: Obrisati splash images ili zamijeniti ih dark theme color image-om

#### B. **WKWebView Default White Background**
- **Problem**: WKWebView ima default bijelu pozadinu dok se HTML ne učita
- **Rješenje**: 
  - `webView.isOpaque = false` ✅ (već urađeno)
  - `webView.backgroundColor = UIColor.clear` ✅ (već urađeno)
  - **ALI**: Možda treba background view ispod WebView-a sa dark color-om

#### C. **Capacitor SplashScreen Plugin Priority**
- **Problem**: Ne znamo da li Capacitor koristi:
  - LaunchScreen.storyboard (preferirano)
  - Assets.xcassets/Splash.imageset (možda override-uje)
  - Capacitor config backgroundColor (možda override-uje sve)

### 3. **Što je već urađeno:**

✅ `LaunchScreen.storyboard` - dark color (#1a0f0a)
✅ `ViewController.swift` - WKWebView transparent
✅ `AppDelegate.swift` - window background
✅ `capacitor.config.ts` - backgroundColor i SplashScreen config
✅ `index.html` - boot class za temporary dark background

### 4. **Što možda nedostaje:**

❓ **Splash.imageset** - možda override-uje LaunchScreen.storyboard
❓ **Background view ispod WKWebView** - možda treba UIView sa dark color-om ispod WebView-a
❓ **Capacitor SplashScreen plugin priority** - ne znamo što koristi

## Rješenje - Korak po korak

### Opcija 1: Obriši Splash.imageset (preporučeno)

```bash
# Obriši splash images
rm -rf ios/App/App/Assets.xcassets/Splash.imageset/
```

**Zašto**: Osigurava da Capacitor koristi LaunchScreen.storyboard umjesto splash images.

### Opcija 2: Zamijeni Splash.imageset sa dark theme color image-om

Kreiraj 1x1px PNG sa dark theme color (#1a0f0a) i zamijeni postojeće splash images.

### Opcija 3: Dodaj background view ispod WKWebView-a

U `ViewController.swift`, dodaj UIView sa dark color-om ispod WebView-a:

```swift
// U viewDidLoad, prije WebView inicijalizacije
let backgroundView = UIView(frame: self.view.bounds)
backgroundView.backgroundColor = UIColor(red: 0.102, green: 0.059, blue: 0.039, alpha: 1.0) // #1a0f0a
self.view.insertSubview(backgroundView, at: 0)
```

## Testiranje

1. **Obriši Derived Data**:
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
   ```

2. **U Xcode**:
   - Product → Clean Build Folder (`Cmd + Shift + K`)
   - Product → Build (`Cmd + B`)
   - Obriši app sa uređaja
   - Product → Run (`Cmd + R`)

3. **Provjeri**:
   - LaunchScreen.storyboard se prikazuje (dark color)
   - Nema bijelog flash-a između splash i HTML-a
   - Smooth transition u app

## Napomena

**Ako i dalje vidiš bijelu boju:**
- Možda iOS koristi cached splash images
- Možda Capacitor override-uje LaunchScreen.storyboard sa splash images
- Možda postoji neki drugi mehanizam koji kontrolira initial background

**Alternativno rješenje:**
- Koristi Capacitor SplashScreen plugin sa `launchAutoHide: false`
- Sakrij splash tek nakon što Pixi renderira prvi frame (već urađeno)
- Osiguraj da WKWebView ima transparent background (već urađeno)

