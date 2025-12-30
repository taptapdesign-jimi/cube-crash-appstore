# 🧹 Kako obrisati Derived Data u Xcode

## Metoda 1: Kroz Xcode (Najlakše)

1. **Otvori Xcode**
2. **Menu: Xcode → Settings (ili Preferences)**
   - Ili: `Cmd + ,` (Command + zarez)
3. **Klikni na "Locations" tab**
4. **Pronađi "Derived Data" sekciju**
5. **Klikni na strelicu pored putanje** (otvara folder u Finderu)
6. **U Finderu:**
   - Obriši folder `App-XXXXX` (tvoj app folder)
   - Ili obriši cijeli `DerivedData` folder ako želiš

## Metoda 2: Kroz Terminal (Brže)

```bash
# Obriši sve Derived Data
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Ili samo za tvoj app
rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
```

## Metoda 3: Kroz Xcode Menu (Najbrže)

1. **Otvori Xcode**
2. **Menu: Product → Clean Build Folder**
   - Ili: `Cmd + Shift + K`
3. **Zatim: Product → Build**
   - Ili: `Cmd + B`

## Metoda 4: Ručno u Finderu

1. **Otvori Finder**
2. **Pritisni: `Cmd + Shift + G`** (Go to Folder)
3. **Unesi:**
   ```
   ~/Library/Developer/Xcode/DerivedData
   ```
4. **Obriši folder `App-XXXXX`** ili cijeli `DerivedData` folder

## Nakon brisanja:

1. **Zatvori Xcode**
2. **Otvori Xcode ponovno**
3. **Product → Clean Build Folder** (`Cmd + Shift + K`)
4. **Product → Build** (`Cmd + B`)
5. **Run na uređaju**

## Provjera da li je obrisano:

```bash
# Provjeri da li je folder prazan
ls -la ~/Library/Developer/Xcode/DerivedData/
```

Ako je prazan ili ne postoji, sve je obrisano! ✅

