# 🔧 iOS Build Fix - Dev Server Connection Problem

## Problem
iOS app pokušava učitati dev server (`http://192.168.1.189:5173`) umjesto lokalnog bundle-a, što uzrokuje grešku "Could not connect to the server" (NSURLErrorDomain, code=-1004).

## Root Cause
Capacitor može koristiti dev server URL ako je postavljen kroz:
1. Environment variable `CAPACITOR_SERVER_URL`
2. Build setting u Xcode
3. Capacitor config `server.url` property

## Rješenja koja su primijenjena

### 1. ✅ Capacitor Config Fix
**Lokacija**: `capacitor.config.ts`

- Dodana provjera za `process.env.CAPACITOR_SERVER_URL`
- Server URL se postavlja SAMO ako je environment variable eksplicitno postavljen
- U production build-u (bez env variable) se koristi lokalni bundle

### 2. ✅ Info.plist Network Security
**Lokacija**: `ios/App/App/Info.plist`

- Dodan `NSAppTransportSecurity` sa `NSAllowsLocalNetworking = true`
- `NSAllowsArbitraryLoads = false` (samo lokalni bundle, ne remote server)

### 3. ✅ ViewController.swift Production Check
**Lokacija**: `ios/App/App/ViewController.swift`

- Dodana provjera za DEBUG vs PRODUCTION mode
- U production modu se osigurava da se koristi lokalni bundle

### 4. ✅ Package.json Scripts
**Lokacija**: `package.json`

- Dodan `ios:sync` script koji builda i sync-uje iOS
- Dodan `ios:build` script za kompletan iOS build proces

## Kako koristiti

### Za Production Build:
```bash
# 1. Build web assets
npm run build

# 2. Sync sa iOS (kopira dist u ios/App/App/public)
npx cap sync ios

# 3. U Xcode: Product → Clean Build Folder (Cmd + Shift + K)
# 4. U Xcode: Product → Build (Cmd + B)
# 5. U Xcode: Product → Run (Cmd + R)
```

### Za Development (ako želiš koristiti dev server):
```bash
# Postavi environment variable
export CAPACITOR_SERVER_URL=http://192.168.1.189:5173

# Sync
npx cap sync ios

# Build u Xcode
```

## Provjere u Xcode

### 1. Provjeri Build Settings
1. Otvori `ios/App/App.xcworkspace` u Xcode
2. Odaberi project u navigatoru
3. Odaberi target "App"
4. Idi na "Build Settings" tab
5. Traži "CAP_SERVER" ili "CAPACITOR_SERVER"
6. **OSIGURAJ SE DA NEMA POSTAVLJEN SERVER URL**

### 2. Provjeri Environment Variables
1. U Xcode: Product → Scheme → Edit Scheme
2. Odaberi "Run" u lijevom panelu
3. Idi na "Arguments" tab
4. Provjeri "Environment Variables"
5. **OSIGURAJ SE DA NEMA `CAPACITOR_SERVER_URL` ili `CAP_SERVER_URL`**

### 3. Provjeri capacitor.config.json
1. Otvori `ios/App/App/capacitor.config.json`
2. **OSIGURAJ SE DA NEMA `server` property**

## Ako i dalje ne radi

### Opcija 1: Obriši Derived Data
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
```

### Opcija 2: Clean Build u Xcode
1. Product → Clean Build Folder (Cmd + Shift + K)
2. Product → Build (Cmd + B)

### Opcija 3: Provjeri da li postoji capacitor.config.json sa server URL
```bash
cat ios/App/App/capacitor.config.json | grep -i server
```

Ako vidiš `server` property, obriši ga ili postavi na `null`.

### Opcija 4: Provjeri Xcode Build Settings
U Xcode Build Settings, traži:
- `CAP_SERVER_URL`
- `CAPACITOR_SERVER_URL`
- `SERVER_URL`

Ako postoji, obriši ga ili postavi na prazan string.

## Napomena

**VAŽNO**: Za production build, app MORA koristiti lokalni bundle, ne dev server. Dev server se koristi samo za development/testing.
