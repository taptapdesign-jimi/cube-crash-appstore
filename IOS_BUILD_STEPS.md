# 🔨 iOS Build Steps - Premium Launch Screen

## Problem
LaunchScreen.storyboard promjene se ne primjenjuju nakon rebuild-a.

## Rješenje - Korak po korak

### 1. Obriši Derived Data ✅ (Već urađeno)
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
```

### 2. U Xcode:

#### A. Otvori Project
- Otvori `ios/App/App.xcworkspace` (NE .xcodeproj!)

#### B. Clean Build
1. **Product → Clean Build Folder** (`Cmd + Shift + K`)
2. Sačekaj da završi

#### C. Provjeri LaunchScreen.storyboard
1. U Project Navigator, pronađi: `App → Base.lproj → LaunchScreen.storyboard`
2. Klikni na `LaunchScreen.storyboard`
3. Provjeri da li je `backgroundColor` postavljen na crnu (#000000)
4. Ako nije, klikni na view i u Attributes Inspector postavi background na crnu

#### D. Provjeri Info.plist
1. Otvori `App → Info.plist`
2. Provjeri da li postoji `UILaunchStoryboardName` = `LaunchScreen`

#### E. Build & Run
1. **Product → Build** (`Cmd + B`)
2. **Product → Run** (`Cmd + R`) - na STVARNOM UREĐAJU (ne simulator!)

### 3. Ako i dalje ne radi:

#### Provjeri da li postoji Splash Image
1. U Project Navigator: `App → Assets.xcassets → Splash.imageset`
2. Ako postoji splash image, možda prekriva background
3. Možeš ga obrisati ili postaviti alpha na 0

#### Provjeri Main.storyboard
1. Otvori `App → Base.lproj → Main.storyboard`
2. Provjeri da li postoji neki background color koji override-uje

#### Provjeri ViewController
1. Otvori `App → ViewController.swift`
2. Provjeri da li postoji `viewDidLoad` koji postavlja background

### 4. Test na uređaju:
- **VAŽNO**: Testiraj na STVARNOM UREĐAJU, ne simulator!
- Simulator možda ne prikazuje LaunchScreen pravilno

### 5. Ako i dalje ne radi - Alternative:

#### Opcija A: Obriši app sa uređaja i reinstaliraj
- Dugo pritisni app ikonu → Obriši app
- Rebuild i install ponovno

#### Opcija B: Provjeri iOS verziju
- LaunchScreen se možda ponaša drugačije na različitim iOS verzijama

#### Opcija C: Koristi Splash Image umjesto solid boje
- Kreiraj crnu splash image (1x1px PNG sa crnom bojom)
- Dodaj u Assets.xcassets
- Koristi umjesto solid boje

## Što je već urađeno:

✅ `LaunchScreen.storyboard` - crna boja (#000000)
✅ `ViewController.swift` - WebView background na crnu
✅ `AppDelegate.swift` - Window background na crnu
✅ `capacitor.config.ts` - backgroundColor i SplashScreen config
✅ `capacitor.config.json` - ažuriran sa crnom bojom
✅ `index.html` - smooth fade-in iz crne
✅ `Info.plist` - status bar style

## Napomena:

**LaunchScreen.storyboard promjene se primjenjuju samo nakon:**
1. Clean Build Folder
2. Full rebuild (Build, ne samo Run)
3. Install na uređaju (ne samo Run u simulatoru)

**Ako i dalje vidiš bijelu boju:**
- Možda iOS koristi cached LaunchScreen
- Probaj obrisati app sa uređaja i reinstalirati
- Provjeri da li postoji neki splash image koji prekriva background

