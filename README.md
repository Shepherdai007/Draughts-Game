# KingsMakers Draughts 3D

A professional 3D draughts (checkers) game built as a PWA — ready for Play Store publishing.

## Features

- **Full 3D Board** rendered with Three.js — perspective view, 3D pieces, kings with crowns, particle capture effects
- **All Draughts Rules** — mandatory capture, chain (multi-jump) captures, king promotion, no-moves loss condition
- **AI Opponent** — Easy mode (random/greedy) and Hard mode (minimax + alpha-beta pruning, depth 6)
- **3 Themes** — Classic Wood 🌲, Neon Cyber ⚡, Royal Marble 👑
- **Sound Effects** — all synthesised via Web Audio API: move, capture, king promotion, victory, defeat, explosion
- **KingsMakers Games Intro** — full-screen logo animation with particle explosion
- **Win/Lose Screen** — congratulations overlay with confetti for wins
- **Scoreboard** — tracks and persists wins with win-rate bars
- **PWA Ready** — `manifest.json` + Service Worker with offline caching
- **Monetization Hooks** — ad banner placeholder, premium unlock stubs

## Architecture

```
index.html          — Main HTML, all screens
manifest.json       — PWA manifest
sw.js               — Service Worker (offline support)
css/
  styles.css        — All styles: 3D UI, themes, animations, responsive
js/
  themes.js         — 3 theme colour definitions
  game.js           — Draughts rules engine (pure functions + game state class)
  ai.js             — AI opponent (minimax with alpha-beta pruning)
  sounds.js         — Sound synthesis via Web Audio API
  board3d.js        — Three.js 3D board renderer (raycasting, animations)
  app.js            — Main app controller (screen management, game loop)
  three.min.js      — Three.js r128 (local copy for offline PWA support)
icons/
  icon-192.png      — App icon 192×192
  icon-512.png      — App icon 512×512
```

## Game Rules Implemented

- 8×8 board, dark squares only
- Men move forward diagonally; **kings move in all 4 diagonal directions**
- **Mandatory capture** — if you can take, you must
- **Chain captures** — must keep jumping if further captures are available
- **King promotion** on reaching the back row (mid-jump promotion included)
- Win by capturing all opponent pieces or leaving them with no legal moves

## Play Store / PWA Publishing

1. The `manifest.json` is fully configured for standalone PWA installation
2. Service worker caches all assets for offline play
3. To publish on Play Store: wrap with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or [PWABuilder](https://www.pwabuilder.com/) to generate a Trusted Web Activity (TWA) APK
4. Add AdMob or equivalent to the ad banner placeholder (`#ad-banner`) for monetisation
