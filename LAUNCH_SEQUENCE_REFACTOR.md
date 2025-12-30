# Launch Sequence Refactor - Senior Principal Developer Review

## Current Issues Identified

1. **Multiple background setting points** - pozadina se postavlja na 4+ mjesta
2. **CSS override conflict** - `body:not(.boot)` u index.html postavlja gradient automatski
3. **Race condition** - CSS se učitava prije JavaScript-a
4. **Redundant code** - pozadina se postavlja i u init() i u Phase 2

## Solution: Single Source of Truth

**Principle**: Pozadina se postavlja SAMO u launch-screen.ts, nikad u CSS-u.

### Phase 1 (0-2s): #FAFAFA
- Native iOS: #FAFAFA
- HTML inline style: #FAFAFA
- CSS: #FAFAFA (fallback)
- JavaScript: launch-screen.ts init() - #FAFAFA

### Phase 2 (2-4s): Gradient
- JavaScript: launch-screen.ts Phase 2 - gradient

### Phase 3 (4-5s): Gradient → App
- JavaScript: launch-screen.ts Phase 3 - fade out

## Changes Required

1. Remove `body:not(.boot)` gradient from index.html
2. Remove gradient from CSS (keep only #FAFAFA)
3. Simplify launch-screen.ts - single background setting point
4. Ensure CSS never sets gradient, only #FAFAFA

