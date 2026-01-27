# 🔧 iOS Build Instructions - Fix Dev Server Connection

## Problem
iOS app pokušava učitati dev server (`http://192.168.1.189:5173`) umjesto lokalnog bundle-a.

## Rješenje

### Korak 1: Build Web Assets
```bash
npm run build
```

### Korak 2: Sync sa iOS (kopira dist u ios/App/App/public)
```bash
npx cap sync ios
```

**VAŽNO**: Ako vidiš CocoaPods encoding error, ignoriraj ga - to nije kritično. Važno je da se `dist` folder kopira u `ios/App/App/public`.

### Korak 3: Provjeri capacitor.config.json
Provjeri da li `ios/App/App/capacitor.config.json` sadrži `server` property:
```bash
cat ios/App/App/capacitor.config.json | grep -i server
```

Ako vidiš `server` property, **OBRIŠI GA** ili postavi na `null`.

### Korak 4: U Xcode

#### A. Clean Build
1. Otvori `ios/App/App.xcworkspace` (NE .xcodeproj!)
2. **Product → Clean Build Folder** (`Cmd + Shift + K`)

#### B. Provjeri Build Settings
1. Odaberi project u navigatoru
2. Odaberi target "App"
3. Idi na "Build Settings" tab
4. Traži "CAP_SERVER" ili "CAPACITOR_SERVER"
5. **OSIGURAJ SE DA NEMA POSTAVLJEN SERVER URL**

#### C. Provjeri Environment Variables
1. **Product → Scheme → Edit Scheme**
2. Odaberi "Run" u lijevom panelu
3. Idi na "Arguments" tab
4. Provjeri "Environment Variables"
5. **OSIGURAJ SE DA NEMA `CAPACITOR_SERVER_URL` ili `CAP_SERVER_URL`**

#### D. Provjeri Info.plist
1. Otvori `App → Info.plist`
2. Provjeri da li postoji `NSAppTransportSecurity`
3. Ako ne postoji, dodaj ga (već je dodan u fix-u)

#### E. Build & Run
1. **Product → Build** (`Cmd + B`)
2. **Product → Run** (`Cmd + R`)

### Korak 5: Ako i dalje ne radi

#### Opcija A: Obriši Derived Data
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
```

#### Opcija B: Provjeri capacitor.config.json ručno
Otvori `ios/App/App/capacitor.config.json` i provjeri da li sadrži:
```json
{
  "server": {
    "url": "http://..."
  }
}
```

Ako postoji, **OBRIŠI CIJELI `server` objekt**.

#### Opcija C: Provjeri Xcode Build Settings ručno
U Xcode Build Settings, traži:
- `CAP_SERVER_URL`
- `CAPACITOR_SERVER_URL`  
- `SERVER_URL`

Ako postoji, **OBRIŠI GA** ili postavi na prazan string.

## Što je već popravljeno

✅ `capacitor.config.ts` - Server URL se postavlja SAMO ako je environment variable postavljen
✅ `ios/App/App/Info.plist` - Dodan `NSAppTransportSecurity` za lokalni bundle
✅ `ios/App/App/ViewController.swift` - Dodana provjera za production mode
✅ `package.json` - Dodani `ios:sync` i `ios:build` scripts

## Napomena

**VAŽNO**: Za production build, app MORA koristiti lokalni bundle, ne dev server. Dev server se koristi samo za development/testing.
