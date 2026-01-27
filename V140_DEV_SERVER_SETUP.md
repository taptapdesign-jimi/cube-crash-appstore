# ✅ V140 Dev Server Setup - Fizički iPhone

## Status
✅ **App je sada konfigurirana kao u v140 - koristi dev server (192.168.1.189:5173)**

## Konfiguracija

### capacitor.config.ts
- Server URL: `http://192.168.1.189:5173` (kao u v140)
- Default: koristi dev server
- Može se prebaciti na production bundle sa `CAPACITOR_USE_DEV_SERVER=false`

### Info.plist
- `NSAllowsArbitraryLoads = true` - dozvoljava HTTP veze
- `NSExceptionDomains` - dozvoljava 192.168.1.189 i localhost

## Kako koristiti

### 1. Pokreni Dev Server
```bash
npm run dev
# ili
vite --host
```

**VAŽNO**: Server mora biti pokrenut na portu 5173 i biti dostupan na mreži (`--host` flag).

### 2. Sync iOS
```bash
npx cap sync ios
```

Ovo će generirati `ios/App/App/capacitor.config.json` sa:
```json
{
  "server": {
    "url": "http://192.168.1.189:5173",
    "cleartext": true
  }
}
```

### 3. U Xcode
1. Otvori `ios/App/App.xcworkspace`
2. **Product → Clean Build Folder** (`Cmd + Shift + K`)
3. **Product → Run** (`Cmd + R`) na fizičkom iPhone uređaju

### 4. Provjeri da radi
- App će pokušati učitati sa `http://192.168.1.189:5173`
- U Xcode console-u ćeš vidjeti: `✔ Loading modern refactored version from http://192.168.1.189:5173`
- Igra će se učitati sa dev servera

## Troubleshooting

### Problem: "Could not connect to the server"
1. **Provjeri da li dev server radi:**
   ```bash
   curl http://192.168.1.189:5173
   ```

2. **Provjeri da li su računalo i iPhone na istoj mreži:**
   - Oba moraju biti na istoj WiFi mreži

3. **Provjeri firewall:**
   - macOS Firewall možda blokira port 5173
   - System Preferences → Security & Privacy → Firewall

4. **Provjeri IP adresu:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Ako je IP drugačija od 192.168.1.189, promijeni u `capacitor.config.ts`:
   ```typescript
   const DEV_SERVER_URL = 'http://TVOJA_IP:5173';
   ```

### Problem: App se ne učitava
1. **Provjeri capacitor.config.json:**
   ```bash
   cat ios/App/App/capacitor.config.json | grep -A 3 server
   ```
   Trebao bi vidjeti `"url": "http://192.168.1.189:5173"`

2. **Clean build u Xcode:**
   - Product → Clean Build Folder
   - Restart app na uređaju

3. **Provjeri Info.plist:**
   - Trebao bi imati `NSAllowsArbitraryLoads = true`

## Prebacivanje na Production Bundle

Kada želiš prebaciti na production bundle (bez dev servera):

```bash
CAPACITOR_USE_DEV_SERVER=false npx cap sync ios
```

Ili promijeni u `capacitor.config.ts`:
```typescript
const USE_DEV_SERVER = false;
```

Zatim:
```bash
npx cap sync ios
```

## Napomena

**VAŽNO**: Za development, app koristi dev server (kao u v140). Za production build, koristi `CAPACITOR_USE_DEV_SERVER=false` da se prebaci na lokalni bundle.
