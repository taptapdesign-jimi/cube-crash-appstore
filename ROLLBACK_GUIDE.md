# 🔄 Rollback Guide - Object Pooling Eksperiment

## ✅ Sigurnost v60 Commit-a

**Commit**: `77ac5fa`  
**Poruka**: "v60: Fix end game logic for wild-juice, wild meter reset on last merge, reduce fail screen delays, fix merge value update race condition"  
**Status**: ✅ **PUSHAN NA GITHUB** (siguran, ne može se izgubiti)

---

## 🛡️ Kako se vratiti na v60 ako nešto ne radi

### Opcija 1: Vrati se na main branch (preporučeno)

```bash
# Prekini rad na object pooling branch-u
git checkout main

# Ako si već commit-ao promjene na feature branch-u, samo switch-aj
# Sve promjene ostaju na feature branch-u, main ostaje čist
```

**Rezultat**: 
- ✅ `main` branch je na v60 (77ac5fa)
- ✅ Feature branch sa object pooling-om ostaje za kasnije
- ✅ Nema gubitka podataka

---

### Opcija 2: Hard reset na v60 (ako si commit-ao na main)

```bash
# ⚠️ PAŽNJA: Ovo će obrisati sve necommit-ane promjene na main branch-u

# Vrati se na main
git checkout main

# Hard reset na v60 commit
git reset --hard 77ac5fa

# Ako si push-ao promjene na GitHub, force push (OPREZNO!)
# git push --force origin main
```

**Kada koristiti**: 
- Ako si slučajno commit-ao na `main` umjesto na feature branch
- Ako želiš potpuno obrisati object pooling promjene

---

### Opcija 3: Revert commit-a (ako si push-ao na main)

```bash
# Ako si push-ao object pooling na main, revert-aj commit
git revert <commit-hash>

# Ili vrati se na v60
git reset --hard 77ac5fa
git push --force origin main
```

---

## 🧪 Preporučeni Workflow za Object Pooling

### 1. Kreiraj feature branch (VEĆ NAPRAVLJENO)

```bash
git checkout -b feature/object-pooling-graphics
```

**Status**: ✅ Branch je kreiran, sada si na njemu

---

### 2. Radi na object pooling-u

- Implementiraj `GraphicsPool`
- Testiraj sve animacije
- Provjeri memory usage

---

### 3. Ako sve radi - merge u main

```bash
# Vrati se na main
git checkout main

# Merge feature branch-a
git merge feature/object-pooling-graphics

# Push na GitHub
git push origin main
```

---

### 4. Ako nešto ne radi - vrati se na main

```bash
# Jednostavno switch-aj na main
git checkout main

# Feature branch ostaje sa svim promjenama za kasnije
# Main je čist i na v60
```

---

## 📋 Checklist prije početka

- [x] Commit `77ac5fa` je pushan na GitHub (siguran)
- [x] Feature branch `feature/object-pooling-graphics` je kreiran
- [ ] Testiraj da se možeš vratiti na main (`git checkout main`)
- [ ] Testiraj da main je na v60 (`git log --oneline -1`)

---

## 🔍 Provjera trenutnog stanja

```bash
# Provjeri na kojem si branch-u
git branch

# Provjeri commit
git log --oneline -1

# Provjeri status
git status
```

---

## ⚠️ Upozorenja

1. **NE commit-aj direktno na main** - koristi feature branch
2. **NE force push-aj na main** osim ako stvarno znaš što radiš
3. **Testiraj rollback** prije nego počneš raditi (switch na main i nazad)

---

## 🎯 Quick Commands

```bash
# Vrati se na main (v60)
git checkout main

# Vrati se na feature branch
git checkout feature/object-pooling-graphics

# Provjeri commit
git log --oneline -1

# Provjeri razlike između branch-ova
git diff main..feature/object-pooling-graphics
```

---

**Verzija**: v60  
**Datum**: 2024  
**Status**: Feature branch kreiran, spreman za eksperiment

