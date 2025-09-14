// src/modules/spawn-rules.js

// Per-board-like variety without touching other files:
//  • Resets per board via resetSpawnTuning()
//  • Dynamic "burst" phases that occasionally favor 1/2 to refresh combos
//  • Anti-flood: clamps 5s (max consecutive + rolling window cap)
//  • Keeps your existing small-merge preference logic

// --- short memory of spawns + high streak bookkeeping ---
let recent = [];            // last ~20 spawned values (1..5)
let highStreak = 0;         // consecutive spawns >= 4

// --- new runtime knobs (reset every board) ---
let spawnIndex = 0;         // how many spawns since reset
let plan = null;            // randomized plan per board
let v5Window = [];          // sliding window for value==5
let consec5 = 0;            // consecutive 5s cap

// zovi na početku runde/boarda
export function resetSpawnTuning(){
  recent.length = 0;
  highStreak = 0;
  spawnIndex = 0;
  v5Window.length = 0;
  consec5 = 0;
  plan = makePlanForBoard();
}

// Random plan per board so svaki board "miriše" drugačije bez fiksnih pravila po broju boarda
function makePlanForBoard(){
  // Lagani random: ponekad češće 1/2, ponekad više 3/4 začina, ali 5 nikad ne dominira pred kraj
  const mode = Math.random();
  const lowBiasBurstEvery = 6 + ((Math.random()*5)|0);   // svaka 6–10 spawna
  const lowBiasBurstLen   = 2 + ((Math.random()*2)|0);   // traje 2–3 spawna

  // capovi za 5ice (anti-lejm):
  const fiveHardCapConsec   = 1 + ((Math.random()*2)|0); // max 1–2 zaredom
  const fiveWindowSize      = 12;                        // gledamo zadnjih 12
  const fiveWindowMaxRatio  = 0.30 + Math.random()*0.07; // 30–37%

  // okus (spice): koliko dižemo 3/4 u mid/late
  const spiceAmp = mode < 0.5 ? 0.12 : 0.22;             // umjereno / pojačano

  return {
    lowBiasBurstEvery,
    lowBiasBurstLen,
    fiveHardCapConsec,
    fiveWindowSize,
    fiveWindowMaxRatio,
    spiceAmp,
  };
}

function pickWeighted(weights){
  let sum = 0;
  for (const k in weights) sum += Math.max(0, weights[k]||0);
  if (sum <= 0) return 1 + ((Math.random()*5)|0);
  let r = Math.random() * sum;
  for (const k in weights){
    r -= Math.max(0, weights[k]||0);
    if (r <= 0) return +k;
  }
  return 1;
}

// Bazne krivulje po fazama runde (zadržavamo tvoj karakter)
const EARLY = {1:40, 2:32, 3:20, 4:6,  5:2};
const MID   = {1:30, 2:28, 3:24, 4:12, 5:6};
const LATE  = {1:24, 2:26, 3:24, 4:16, 5:10}; // malo smanjen 5 u odnosu na tvoje late

// Utility: apply scalar to some keys
function boost(w, keys, mul){ keys.forEach(k => w[k] = Math.max(0, (w[k]||0) * mul)); }
function add(w, k, val){ w[k] = Math.max(0, (w[k]||0) + val); }

// 0..1 position kroz board na temelju spawnIndex (robustno na 4x4/5x8 i sl.)
function progress01(){
  // pretpostavi da će prosječan board imati ~36 spawna; clamp 0..1
  return Math.max(0, Math.min(1, spawnIndex / 36));
}

/**
 * Pametan spawn:
 * - ranije daje više 1/2, manje 4/5
 * - anti-flood: ako je puno 4/5 na ploči, još jače gura 1/2
 * - pity: 2 visoke zaredom ⇒ forsiraj 1 ili 2
 * - 60% pokušaj odmah stvoriti mali merge (a+b <= 5) s postojećom pločicom
 * - NEW: povremeni "bursts" koji miješaju 1/2, te čuvar za 5ice (consec & window)
 */
export function getSpawnValue(grid, tiles, moves = 0, score = 0){
  const actives = (tiles || []).filter(t => t && !t.locked && (t.value|0) > 0);
  const highCnt = actives.filter(t => t.value >= 4).length;
  const ratioHigh = actives.length ? highCnt / actives.length : 0;

  // 1) fazne base težine
  let w = (moves < 16) ? EARLY : (moves < 36 ? MID : LATE);
  w = { ...w };

  // 2) anti-flood: puno 4/5 na ploči → smanji 4/5, dodaj 1/2
  if (ratioHigh > 0.28){
    boost(w, [4], 0.5);
    boost(w, [5], 0.35);
    add(w, 1, 10);
    add(w, 2, 8);
  }

  // 3) dinamički "spice" za 3/4 kako runda odmiče (malo drugačije svaki board)
  const p = progress01();
  const spice = (plan?.spiceAmp || 0.18) * (p < 0.5 ? p*2 : 1); // raste do sredine pa ostaje
  add(w, 3, Math.round(10 * spice));
  add(w, 4, Math.round(8  * spice));

  // 4) povremeni low-bias burst (više 1/2 na kratko) – razbija pattern pred kraj
  const every = plan?.lowBiasBurstEvery || 8;
  const len   = plan?.lowBiasBurstLen   || 2;
  const inBurst = (spawnIndex % every) < len;
  if (inBurst){
    boost(w, [1,2], 1.25);
    boost(w, [5],   0.55);
  }

  // 5) pity: ako su zadnja 2 spawna bila ≥4 → forsiraj 1 ili 2
  const last2High = recent.slice(-2).every(v => v >= 4) && recent.length >= 2;
  if (last2High || highStreak >= 2){
    const vPity = Math.random() < 0.6 ? 1 : 2;
    updateMemory(vPity);
    return vPity;
  }

  // 6) 60%: pokušaj stvoriti mali merge s postojećom pločicom (zadržano)
  if (actives.length && Math.random() < 0.60){
    const pick = actives[(Math.random() * actives.length) | 0];
    const a = Math.max(1, Math.min(5, pick.value | 0));

    let b;
    if (Math.random() < 0.80){
      const maxB = Math.max(1, 5 - a);         // da a+b <= 5
      b = 1 + ((Math.random() * maxB) | 0);
    } else {
      b = Math.max(1, Math.min(5, 6 - a));     // komplement za 6
    }

    // Anti-5 guard on candidate
    b = guardFive(b, w);
    updateMemory(b);
    return b;
  }

  // 7) fallback: ponderirani izbor + anti-5 guard
  let v = pickWeighted(w);
  v = guardFive(v, w);
  updateMemory(v);
  return v;
}

// --- helpers ---
function updateMemory(v){
  spawnIndex++;
  recent.push(v); if (recent.length > 20) recent.shift();

  if (v >= 4) highStreak++; else highStreak = 0;

  // track 5s
  if (v === 5) consec5++; else consec5 = 0;
  v5Window.push(v === 5 ? 1 : 0);
  const N = plan?.fiveWindowSize || 12;
  while (v5Window.length > N) v5Window.shift();
}

function guardFive(v, weights){
  if (v !== 5) return v;

  const N = plan?.fiveWindowSize || 12;
  const capConsec = plan?.fiveHardCapConsec || 2;
  const maxRatio  = plan?.fiveWindowMaxRatio || 0.34;

  const windowSum = v5Window.reduce((a,b)=>a+b,0);
  const ratio5 = v5Window.length ? (windowSum / v5Window.length) : 0;

  const tooManyConsec = consec5 >= capConsec; // ako bi ovaj 5 bio još jedan u nizu
  const tooManyInWindow = ratio5 >= maxRatio;

  if (tooManyConsec || tooManyInWindow){
    // Jedan retry s jako spuštenim 5 i pojačanim 1/2
    const w2 = { ...weights };
    w2[5] = Math.max(0, Math.round((w2[5]||0) * 0.2));
    add(w2, 1, 12);
    add(w2, 2, 10);
    const reroll = pickWeighted(w2);
    return reroll === 5 ? 4 : reroll; // ako baš pogodi 5, degradiraj na 4 kao "začin" umjesto hard 5
  }
  return v;
}