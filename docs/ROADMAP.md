# CubeCrash Refactor Roadmap

## Faze

### F1 - AppShell Orkestrator ✅
- [x] Central state machine (HOME ⇄ GAME ⇄ PAUSE)
- [x] Event bus komunikacija
- [x] Stabilan lifecycle bez globalnih window.*
- [x] Mount/unmount sekcija

### F2 - Homepage Modul ⏳
- [ ] Slider + CTA extraction
- [ ] API: mount/show/hide/on(...)
- [ ] Nezavisan od igre

### F3 - Game Fasada ⏳
- [ ] PIXI wrapper oko app.js
- [ ] start/stop/pause/resume/restart
- [ ] Hook na HUD/pause modal

### F4 - Animations Modul ⏳
- [ ] Clean visual effects
- [ ] Home pop-in/out
- [ ] Modal animacije
- [ ] HUD efekti

### F5 - Cleanup + Dokumentacija ⏳
- [ ] Uklanjanje mrtvog koda
- [ ] ARCHITECTURE.md
- [ ] Sanity testovi

## Status
**Trenutno:** F1 u tijeku
**Cilj:** F1-F5 danas (4-6 sati)
