# DEV LOG – izvlačenje iz konzole (3 stvari)

Samo **3 stvari** iz loga: linija Destroyed unknown runtime textures, blok before-cleanup + JSON, blok after-cleanup + JSON.

---

## 1) Linija: "🧹 Destroyed unknown runtime textures { reason: ..., destroyed: ... }"

```
app-core.ts:561 🧹 Destroyed unknown runtime textures {reason: 'triggerCleanBoardFlow', destroyed: 5}
```

---

## 2) Blok: "🧪 DEV LOG: managedTextures {label: 'before-cleanup', ...}" + cijeli JSON

```
app-core.ts:496 🧪 DEV LOG: managedTextures {label: 'before-cleanup', count: 26, list: Array(26)}
app-core.ts:497 🧪 DEV LOG: managedTextures list (raw): [
  {
    "uid": 0,
    "label": "EMPTY",
    "width": 1,
    "height": 1,
    "url": ""
  },
  {
    "uid": 1,
    "label": "WHITE",
    "width": 1,
    "height": 1,
    "url": ""
  },
  {
    "uid": 29,
    "label": "http://localhost:5173/assets/tile.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 28,
    "label": "http://localhost:5173/assets/tile_numbers.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 50,
    "label": "http://localhost:5173/assets/tile_numbers3.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 49,
    "label": "http://localhost:5173/assets/tile_numbers2.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 113,
    "label": "",
    "width": 16,
    "height": 32,
    "url": ""
  },
  {
    "uid": 114,
    "label": "",
    "width": 16,
    "height": 32,
    "url": ""
  },
  {
    "uid": 115,
    "label": "",
    "width": 8,
    "height": 16,
    "url": ""
  },
  {
    "uid": 116,
    "label": "",
    "width": 16,
    "height": 32,
    "url": ""
  },
  {
    "uid": 23,
    "label": "http://localhost:5173/assets/close-icon.png",
    "width": 24,
    "height": 24,
    "url": ""
  },
  {
    "uid": 62,
    "label": "http://localhost:5173/assets/hud/star-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 63,
    "label": "http://localhost:5173/assets/hud/score-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 66,
    "label": "http://localhost:5173/assets/hud/combo-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 117,
    "label": "",
    "width": 64,
    "height": 64,
    "url": ""
  },
  {
    "uid": 118,
    "label": "",
    "width": 32,
    "height": 32,
    "url": ""
  },
  {
    "uid": 119,
    "label": "",
    "width": 8,
    "height": 32,
    "url": ""
  },
  {
    "uid": 120,
    "label": "",
    "width": 64,
    "height": 64,
    "url": ""
  },
  {
    "uid": 51,
    "label": "http://localhost:5173/assets/tile_numbers4.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 72,
    "label": "http://localhost:5173/assets/hud/extra-combo-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 31,
    "label": "http://localhost:5173/assets/wild.png",
    "width": 1100,
    "height": 1040,
    "url": ""
  },
  {
    "uid": 5,
    "label": "http://localhost:5173/assets/small-star@3x.png",
    "width": 40,
    "height": 40,
    "url": ""
  },
  {
    "uid": 127,
    "label": "",
    "width": 64,
    "height": 32,
    "url": ""
  },
  {
    "uid": 52,
    "label": "http://localhost:5173/assets/wild-beer.png",
    "width": 885,
    "height": 885,
    "url": ""
  },
  {
    "uid": 130,
    "label": "runtime:wild-beer-bubbles-explosion",
    "width": 49,
    "height": 49,
    "url": ""
  },
  {
    "uid": 25,
    "label": "http://localhost:5173/assets/small-star.png",
    "width": 40,
    "height": 40,
    "url": ""
  }
]
```

---

## 3) Blok: "🧪 DEV LOG: managedTextures {label: 'after-cleanup', ...}" + cijeli JSON

```
app-core.ts:496 🧪 DEV LOG: managedTextures {label: 'after-cleanup', count: 26, list: Array(20)}
app-core.ts:497 🧪 DEV LOG: managedTextures list (raw): [
  {
    "uid": 0,
    "label": "EMPTY",
    "width": 1,
    "height": 1,
    "url": ""
  },
  {
    "uid": 1,
    "label": "WHITE",
    "width": 1,
    "height": 1,
    "url": ""
  },
  {
    "uid": 29,
    "label": "http://localhost:5173/assets/tile.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 28,
    "label": "http://localhost:5173/assets/tile_numbers.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 50,
    "label": "http://localhost:5173/assets/tile_numbers3.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 49,
    "label": "http://localhost:5173/assets/tile_numbers2.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 114,
    "label": "",
    "width": 16,
    "height": 32,
    "url": ""
  },
  {
    "uid": 116,
    "label": "",
    "width": 16,
    "height": 32,
    "url": ""
  },
  {
    "uid": 23,
    "label": "http://localhost:5173/assets/close-icon.png",
    "width": 24,
    "height": 24,
    "url": ""
  },
  {
    "uid": 62,
    "label": "http://localhost:5173/assets/hud/star-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 63,
    "label": "http://localhost:5173/assets/hud/score-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 66,
    "label": "http://localhost:5173/assets/hud/combo-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 118,
    "label": "",
    "width": 32,
    "height": 32,
    "url": ""
  },
  {
    "uid": 120,
    "label": "",
    "width": 64,
    "height": 64,
    "url": ""
  },
  {
    "uid": 51,
    "label": "http://localhost:5173/assets/tile_numbers4.png",
    "width": 512,
    "height": 512,
    "url": ""
  },
  {
    "uid": 72,
    "label": "http://localhost:5173/assets/hud/extra-combo-hud.png",
    "width": 28,
    "height": 28,
    "url": ""
  },
  {
    "uid": 31,
    "label": "http://localhost:5173/assets/wild.png",
    "width": 1100,
    "height": 1040,
    "url": ""
  },
  {
    "uid": 5,
    "label": "http://localhost:5173/assets/small-star@3x.png",
    "width": 40,
    "height": 40,
    "url": ""
  },
  {
    "uid": 52,
    "label": "http://localhost:5173/assets/wild-beer.png",
    "width": 885,
    "height": 885,
    "url": ""
  },
  {
    "uid": 25,
    "label": "http://localhost:5173/assets/small-star.png",
    "width": 40,
    "height": 40,
    "url": ""
  }
]
```

---

**Sažetak:** Linija "🧹 Destroyed unknown runtime textures" **postoji**: `reason: 'triggerCleanBoardFlow', destroyed: 5`. Before-cleanup: 26 tekstura (uključujući `runtime:wild-beer-bubbles-explosion` uid 130). After-cleanup: lista ima 20 stavki; uklonjeno je 6 stavki iz liste (uid 113, 115, 117, 119, 127, 130 — od toga 130 je runtime:wild-beer-bubbles-explosion). Log kaže destroyed: 5; razlika 26→20 = 6 može biti zbog načina brojanja ili jedne dodatne teksture koja nije u „unknown runtime” skupini.
