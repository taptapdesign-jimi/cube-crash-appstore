# 🔧 Dev Server Setup - iOS Development

## Status
✅ **App je sada konfigurirana da koristi dev server (5173) za development**

## Kako koristiti

### 1. Pokreni Dev Server
```bash
npm run dev
# ili
vite --host
```

Server će se pokrenuti na `http://localhost:5173` i biti dostupan na mreži (zbog `--host` flag-a).

### 2. Za iOS Simulator
- Dev server će automatski koristiti `http://localhost:5173`
- Sync iOS:
```bash
npx cap sync ios
```

### 3. Za Fizički Uređaj
Ako koristiš fizički iPhone/iPad, trebaš postaviti IP adresu tvog računala:

```bash
# Pronađi svoju IP adresu
ifconfig | grep "inet " | grep -v 127.0.0.1

# Postavi environment variable prije sync-a
export CAPACITOR_SERVER_URL=http://192.168.1.189:5173  # Zamijeni sa svojom IP
npx cap sync ios
```

Ili direktno u `capacitor.config.ts` promijeni:
```typescript
return 'http://192.168.1.189:5173'; // Tvoja IP adresa
```

### 4. U Xcode
1. Otvori `ios/App/App.xcworkspace`
2. **Product → Clean Build Folder** (`Cmd + Shift + K`)
3. **Product → Run** (`Cmd + R`)

App će se pokrenuti i učitati sa dev servera - možeš vidjeti console logove u Xcode console-u i usporediti sa Chrome DevTools.

## Prebacivanje na Production Bundle

Kada želiš prebaciti na production bundle (bez dev servera):

### Opcija 1: Environment Variable
```bash
CAPACITOR_USE_DEV_SERVER=false npx cap sync ios
```

### Opcija 2: Build Script
```bash
npm run ios:sync:prod
```

### Opcija 3: Ručno u capacitor.config.ts
Promijeni:
```typescript
const USE_DEV_SERVER = false; // Umjesto true
```

Zatim:
```bash
npx cap sync ios
```

## Provjera

### Provjeri capacitor.config.json
```bash
cat ios/App/App/capacitor.config.json | grep -A 3 server
```

Ako vidiš:
```json
"server": {
  "url": "http://localhost:5173",
  "cleartext": true
}
```

To znači da app koristi dev server ✅

Ako ne vidiš `server` property, app koristi lokalni bundle (production mode).

## Troubleshooting

### Problem: "Could not connect to the server"
1. Provjeri da li dev server radi: `npm run dev`
2. Provjeri da li je IP adresa ispravna (za fizički uređaj)
3. Provjeri da li su računalo i uređaj na istoj mreži
4. Provjeri firewall postavke

### Problem: App se ne osvježava
1. U Xcode: **Product → Clean Build Folder**
2. Restart app na uređaju
3. Provjeri da li dev server još radi

### Problem: CocoaPods encoding error
Ignoriraj ga - to nije kritično. Važno je da se `capacitor.config.json` generira ispravno.
