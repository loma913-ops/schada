# Schada • Online Strategy Board Game

An online, multiplayer implementation of **Schada**, the classic mind sport invented by Jan Boogerd (1936, Rotterdam). Built with **React 19**, **Vite 8**, **TypeScript**, **Web Workers**, the **Web Audio API**, and **Google Cloud Platform / Firebase**.

Schada combines a fast, minimalist, Lichess-inspired user experience with a mathematically faithful 64-square vector engine, an 8-tier AI bot system, interactive move replay controls, and a competitive Elo matchmaking system.

---

## Table of Contents

1. [Game Overview & Rules](#1-game-overview--rules)
2. [Key Features](#2-key-features)
3. [Computer AI Bot Engine (Levels 1–8)](#3-computer-ai-bot-engine-levels-18)
4. [Move History Navigator & Game Replay](#4-move-history-navigator--game-replay)
5. [Getting Started & Development](#5-getting-started--development)
6. [Updating & Deploying to Production](#6-updating--deploying-to-production)
7. [Project Architecture & Structure](#7-project-architecture--structure)
8. [Editing `src/core/schada/vectors.ts`](#8-editing-srccoreschadavectorsts)
9. [Security & Threat Modeling](#9-security--threat-modeling)
10. [Knowledge Graph (graphify)](#10-knowledge-graph-graphify)

---

## 1. Game Overview & Rules

In Schada, **the board squares dictate piece movement**, rather than the pieces themselves:

- **8x8 Board**: Each square features directional lines and dots denoting allowable movement vectors.
- **180° Rotational Symmetry**: The top half (ranks 5–8) is an exact 180° rotation of the bottom half (ranks 1–4).
- **Three Piece Types**:
  - **Field Officer (4 per side)**: High piece. Can leap over intermediate friendly pieces along straight movement vectors. Worth **2 points** in the goal line.
  - **Officer (4 per side)**: High piece. Standard slider. Cannot leap. Worth **1 point** in the goal line.
  - **Pawn (8 per side)**: Support blocker. Can capture and move according to square vectors, but cannot score goal points.
- **Base Line & Goal Line Restrictions**:
  - High pieces can shuffle along their base line, but once they leave it, they **cannot return**.
  - Once high pieces reach their goal line (Rank 8 for Blue, Rank 1 for Green), they **cannot leave**, and are **immune to enemy capture** (marked with a gold shield badge).
- **Victory & Scoring**:
  - The game concludes when all surviving high pieces of a player reach their goal line, upon opponent piece elimination or immobilization (no legal moves), 3-fold repetition, 6-ply mutual high-piece base/goal shuffling, or when high pieces outside the goal are blocked by enemy pieces.
  - Scoring is determined by goal line points ($\text{Field Officer} = 2, \text{Officer} = 1$).
  - Tiebreakers are calculated based on surviving high pieces outside the goal line and fractional rank distance ($2/7$ for Field Officers, $1/7$ for Officers).

---

## 2. Key Features

- **8-Tier AI Bot Engine**: MiniMax bot opponents (100–2400 Elo) running in Web Workers.
- **Historical End-Condition Engine**: Bilateral goal reached, piece elimination, 3-fold repetition, mutual shuffle, and enemy blockades.
- **Move History Navigator & Replay Controls**: Stepping controls and keyboard shortcuts to review board positions.
- **Comprehensive Match Stats & Post-Game Elo Summary**: Game-over modal with synchronized rating point deltas and match details.
- **Competitive Integrity & Guest Ranked Restriction**: Guests are strictly prohibited from participating in ranked matches; rated play requires an authenticated account.
- **Lichess-Inspired Minimalist UX**: Responsive arena with clocks, notation, controls, and dark/light mode.
- **Optimized Multiplayer Synchronization & Move Pipeline**: 0ms optimistic local moves, atomic multi-tab broadcast sync, automatic live position advancement, and non-disruptive unread move notifications.
- **Cross-Platform Hybrid Audio Engine**: Web Audio API with immediate transient attack playback, realistic synthesized fallbacks, and zero-latency desktop and mobile sound.
- **Authoritative Symmetrical Elo Engine**: Immutable initial/final Elo ratings and deltas stored in match documents for symmetrical cross-client synchronization.
- **Mobile Portrait Orientation Lock**: Orientation detection and overlay for optimal vertical board aspect ratio.
- **Zero-Cache Deployment & Session Recovery**: Immediate cache bypass, background service worker updates, and seamless auto-recovery without hard reload.
- **Optimized Firestore CRUD Architecture**: Composite index-aligned FIFO lobby/matchmaking queries, localStorage SWR leaderboard cache with immediate Elo-change invalidation, in-memory friends profile and username search caches, time-bounded cleanup queries, and self-healing ordered Elo reconciliation with automatic fallback.
- **PWA & Offline-First Architecture**: Service worker and local storage provider for guest and offline play.
- **Configuration-Over-Hardcoding Architecture**: Centralized, strictly validated configuration modules for bot heuristics, matchmaking, time controls, audio, and rules.
- **Threat Detection Indicators**: Real-time visual attack badges on vulnerable pieces with toggleable player preferences.
- **Goal Invulnerability Shield Badges**: Golden shield badges displayed on goal-line high pieces denoting capture immunity.
- **Patron & Donation System**: Lichess-inspired patron page with configurable contribution tiers, fee offsets, and Stripe Payment Link integration.
- **Correspondence Game Mode & Precision Custom Pairing**: Multi-day turn-based matches (1–14 days per move) and real-time custom time control sliders (0.5–180 min) with dedicated lobby filtering and adaptive clock formatting.
- **Real-Time Abandonment & Disconnect Protection**: 60-second abandonment countdown for disconnected players on turn in real-time matches with automatic victory resolution and clock-timeout precedence.
- **Patron Star Badge Recognition**: Golden Schada star badge displayed across lobbies, player cards, friends lists, leaderboards, and user profiles with automated duration tracking.
- **Privacy-Preserving Telemetry & Google Analytics**: Integrated Firebase Google Analytics telemetry for application health, performance monitoring, and session metrics.
- **Partitioned Lobby Sections**: Dedicated "My Games" section pinned at the top for player's active and waiting games, alongside filtered "Available Games".
- **Defense-in-Depth Security Hardening**: Granular Firestore authorization rules, sensitive PII segregation, and comprehensive HTTP security headers with strict cache invalidation.
- **Standalone Bot Championship Simulator**: Local CLI tool pitting all 8 AI tiers against each other in multi-tournament brackets with Elo calibration, game notation, and cross-table export.
- **Interactive Game Analysis Engine**: Post-game Move Quality Distribution table (10 tiers with graphical symbol badges) and player accuracy metrics in the Game Over modal alongside on-demand Web Worker notation review.
- **9-Digit Alphanumeric Game URLs & Collision Protection**: Canonical Base62 (case-sensitive) 9-character game identifiers with CSPRNG generation, transactional collision prevention, and strict format validation.

---

## 3. Computer AI Bot Engine (Levels 1–8)

The Schada AI engine (`src/core/bot`) is implemented from scratch in TypeScript and executed inside a background Web Worker (`src/core/bot/botWorker.ts`). This guarantees that deep tree searches never freeze animations or user inputs.

### Difficulty Hierarchy

| Level | Tier Name        | Target Elo | Max Depth | Blunder Rate | Core Capabilities & Search Characteristics                                                                                                                 |
| :---: | :--------------- | :--------: | :-------: | :----------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Novice**       |    100     |   1 ply   |     65%      | Opportunistic attacker. Grabs undefended pieces but plays largely random moves and ignores multi-step vector traps.                                        |
| **2** | **Beginner**     |    400     |   1 ply   |     30%      | Basic material defender. Defends hanging pieces when paying attention; introduces basic forward progression.                                               |
| **3** | **Casual**       |    800     |  2 plies  |      8%      | Calculates 2-ply tactics. Avoids direct self-captures and advances along shortest paths to the goal line.                                                  |
| **4** | **Competent**    |    1150    |  3 plies  |      0%      | Deterministic tactician. Uses move ordering (MVV-LVA), screens friendly officers with pawn shields, and avoids simple capture traps.                       |
| **5** | **Intermediate** |    1500    |  4 plies  |      0%      | Iterative deepening search with **Pacing Paradox** awareness. Calculates terminal scores and avoids prematurely ending matches when behind on points.      |
| **6** | **Advanced**     |    1800    |  5 plies  |      0%      | Transposition table (Zobrist hashing) and quiescence search. Exploits friendly pawn springboards for leaping Field Officers.                               |
| **7** | **Expert**       |    2100    |  7 plies  |      0%      | Null-move pruning and centrality heuristics. Deploys goal-line turret sentinels, controls central vector hubs, and optimizes $2/7$ fractional tiebreakers. |
| **8** | **Master**       |    2400    |  8 plies  |      0%      | Full graph flow mastery. Coordinates multi-piece pawn walls, suffocating vector blockades, and precise endgame conversion.                                 |

### Technical Architecture

- **Typed Array State (`FastBoard`)**: High-performance `Uint8Array` board representation and bitwise packing for rapid move generation and zero-allocation board copying.
- **Principal Variation Search (PVS)**: Enhanced Alpha-Beta search with iterative deepening and dynamic time budget allocation based on remaining clock time.
- **Zobrist Transposition Table**: 262,144-entry (2¹⁸) hash table storing exact scores, upper bounds, and lower bounds with depth-preferred replacement.
- **Move Ordering**: Prioritizes PV moves > MVV-LVA Captures > Goal Entry > Killer Moves > History Heuristic > Shortest-Path Distance Gains.
- **Quiescence Search**: Resolves volatile capture chains and goal-line entries beyond the horizon to prevent tactical blunders.
- **Opening Book**: Universal engine-calibrated database of 294 positions covering all 14 legal Blue opening moves (e.g., *Flank Flow*, *Center Flow*, *Pawn Strikes*, *Wing Outposts*) with tactical vector safety and Boltzmann-distributed selection weights.
- **Distance Tables**: Precomputed breadth-first search (BFS) shortest-path tables (`DISTANCE_TABLES`) quantifying exact minimum moves to the goal rank for every square.

### Standalone Championship Simulator (CLI)

Schada includes a standalone, command-line championship simulator (`scripts/simulateTournaments.ts`) designed to pit all 8 AI tiers against each other in single-elimination tournament brackets. This utility allows developers to calibrate bot Elo ratings, discover engine balance anomalies, and generate complete game notations.

> **100% Local & Offline**: The tournament simulator executes entirely in-memory using Node.js CPU workers and writes results directly to local disk. It **never connects to Firebase, requires zero network access, and never touches any database.**

#### How It Works
- **Championship Bracket**: Each tournament seeds all 8 bots in a single-elimination knockout bracket (4 Quarterfinals → 2 Semifinals → 1 Championship Final = 7 matches per tournament).
- **Random Seeding & Colors**: Shuffles seeds every tournament to ensure a diverse spread of matchups across all tiers, and assigns Blue/Green colors randomly (50/50) per match to eliminate first-move bias.
- **Draw Resolution**: In the rare event of a true draw (equal goal scores, surviving pieces, and rank distances), an immediate rematch is played with swapped colors until a decisive winner advances.
- **Elo Rating Calibration**: All 8 bots start at **1200 Elo**. Ratings update immediately after every match using the canonical `eloService` ($K=40$ for the first 15 games, $K=20$ thereafter). Ratings persist across all tournaments within a run and cleanly reset to 1200 whenever a new simulation is launched.

#### How to Run

```bash
# 1. Run with default settings (1,000 tournaments, 50ms per-move budget)
npm run simulate

# 2. Quick test run (10 tournaments, 10ms budget)
npm run simulate -- -n 10 -t 10

# 3. Custom calibration run with specific output path
npm run simulate -- --tournaments 500 --time-limit 50 --output-dir ./tournament_output

# 4. View all available CLI flags and usage
npm run simulate -- --help
# or via tsx directly:
npx tsx scripts/simulateTournaments.ts --help
```

#### CLI Options & Flags

| Flag                    | Short |        Default        | Description                                                        |
| :---------------------- | :---: | :-------------------: | :----------------------------------------------------------------- |
| `--tournaments <count>` | `-n`  |        `1000`         | Number of championship tournaments to simulate                     |
| `--time-limit <ms>`     | `-t`  |         `50`          | Search budget per move in milliseconds                             |
| `--max-moves <count>`   | `-m`  |         `300`         | Maximum half-moves safety limit before terminal score adjudication |
| `--output-dir <path>`   | `-o`  | `./tournament_output` | Destination directory for all generated reports and notation files |
| `--help`                | `-h`  |           —           | Display usage banner and option descriptions                       |

#### Generated Output Artifacts

Upon completion (or during live execution), the simulator writes the following files to your specified `--output-dir`:

- **`<output-dir>/games/`**: Individual `.txt` notation files for every match played (`t0001_m1_quarterfinals_novice_vs_casual.txt`), formatted with event metadata, player Elo deltas, final scores, and numbered turn notation.
- **`<output-dir>/tournaments/`**: Individual `.json` result files for each tournament (`tournament_0001.json`), containing bracket progression, match pairings, winners, and a concluding `finalRankings` array sorted #1 (Champion) down to #8 (Quarterfinalist) with bot names, final Elo, match wins, and match losses.
- **`<output-dir>/bot_summary.json`**: Machine-readable JSON summary containing overall championship rankings across all tournaments, final Elo standings, peak/lowest ratings, win/loss records, Blue vs. Green win splits, victory condition distributions, and full 8×8 head-to-head match matrices.
- **`<output-dir>/bot_summary.md`**: Publication-ready Markdown report featuring:
  - Final tournament championship standings across all tournament games (ranked #1 to #8 by championships won, match win rate, and final Elo).
  - Elo ratings leaderboard with gains/losses, peak ratings, and side splits.
  - Complete 8×8 head-to-head cross-table (Row vs. Column records).
  - Win reason distribution table (Goal Reached, Elimination, Blockade, Repetition, Mutual Shuffle).
  - Engine balance and calibration observations.

---

## 4. Move History Navigator & Game Replay

Schada includes a non-destructive move navigation engine (`src/core/schada/replay.ts`) integrated into the game arena:

- **Navigation Controls**:
  - `|<<` (**Start**): Jump to initial starting position.
  - `<` (**Previous**): Step backward by one half-move.
  - `>` (**Next**): Step forward by one half-move.
  - `>>|` (**Latest / Live**): Return immediately to the active live position.
- **Keyboard Shortcuts**:
  - `ArrowLeft`: Step backward.
  - `ArrowRight`: Step forward.
  - `Home`: Jump to starting position.
  - `End`: Jump to live position.
- **Non-Destructive Inspection**: Navigating historical plies allows full inspection of captured pieces, board coordinates, and move annotations. Once a player is ready to make a move, navigating back to live mode immediately re-enables interactive piece movement.
- **Real-Time Live Auto-Advance & Unread Move Notifications**: When an opponent makes a move, the board automatically updates and steps forward in real time if the player is following live moves. If the player is inspecting historical plies, their viewed position is preserved without interruption while move audio plays, the notation list and turn indicator update, and a pulsating unread dot appears on the 'Live' (`>>|`) button, automatically clearing once the player returns to the live position.
- **Sticky Controls (Desktop & Mobile)**: Navigation controls and match status remain pinned and sticky at the top across desktop panels and mobile notation sheets, ensuring controls never scroll out of sight during move review.
- **Post-Game Game Review & Real-Time Analysis**: Following match completion, the Game Over modal immediately presents the match outcome, win reason, scoring breakdown, Move Quality Distribution table (all 10 tiers with graphical vector symbols), and player accuracy percentages (Blue & Green) calculated via background analysis. The modal can be closed via the 'Review' action, 'X' button, backdrop click, or `Escape` key, permitting full board inspection, move navigation, and board flipping. In Review mode, an 'Analyze' action button is displayed in the Moves Notation header bar across desktop and mobile, opening an Analysis Settings modal with configurable Depth (1–20 plies) and Time Limit (1.0–15.0s per move) sliders alongside real-time estimated completion time. Triggering analysis launches a dedicated background Web Worker that evaluates moves off the main thread at 60 FPS, streaming graphical vector move quality symbols (Brilliant, Great Move, Inaccuracy, Mistake, Miss, Blunder) in real time directly to the right of each move notation with native tooltips and live ply progress feedback. Players can reopen match results at any time via the 'Results' button or exit to the lobby via 'Lobby'.

---

## 5. Getting Started & Development

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/loma913-ops/schada.git
cd schada

# 2. Install dependencies
npm install

# 3. Run unit test suite (72 test files, 655+ tests)
npm test

# 4. Start local development server with HMR
npm run dev
```

Open `http://localhost:5173` in your browser. The app runs out of the box using a local mock service provider if Firebase environment variables are not configured.

### Running Quality Checks

```bash
# Run Vitest in watch mode
npm run test:watch

# Fast code analysis via oxlint
npm run lint

# Compile TypeScript and build production bundle
npm run build
```

### Running Bot Tournament Simulations (Local CLI)

You can run automated bot championship simulations locally from the terminal without running the web server:

```bash
# Run default 1,000-tournament simulation (50ms per move)
npm run simulate

# Quick test simulation (10 tournaments, 10ms move budget)
npm run simulate -- -n 10 -t 10

# Custom simulation with specific output directory
npm run simulate -- --tournaments 500 --time-limit 50 --output-dir ./tournament_output
```

> **Note:** The tournament simulation runs 100% locally and offline in CPU memory, writing game notation and results directly to disk. It never connects to Firebase or touches any database.

### Running Game Analysis (Local CLI)

You can analyze played matches turn-by-turn with 10-tier move classifications (Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder), Lichess-calibrated player accuracy % (volatility-weighted and harmonic mean), and next continuation move predictions:

```bash
# Analyze a tournament game file
npm run analyze -- tournament_output/games/t0001_m1_quarterfinals_advanced_vs_intermediate.txt

# Analyze raw notation directly from the command line
npm run analyze -- "1. Fe1-e3 Pc7-e5 2. Fc1-c3 Fb8-b6 3. Fa1-a3 Fh8-h6"

# Deep analysis with custom search depth and time budget
npm run analyze -- -d 7 -t 200 tournament_output/games/t0001_m1_quarterfinals_advanced_vs_intermediate.txt

# Output machine-readable JSON to stdout or save to file
npm run analyze -- --json path/to/game.txt
npm run analyze -- --output ./analysis_report.json path/to/game.txt
```

> **Note:** The analysis engine executes 100% locally and offline in Node.js, replaying moves through the rules engine and evaluating positions using the Tier 8 Master search.

### Connecting to GCP / Firebase & Stripe

Create a `.env` file from `.env.example`:

```bash
# Firebase Web App Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# Stripe Donation & Payment Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PAYMENT_LINK=https://donate.stripe.com/test_...
VITE_STRIPE_PAYMENT_LINK_LIFETIME=https://donate.stripe.com/test_...
```

`VITE_FIREBASE_MEASUREMENT_ID` is required when Firebase is configured and analytics is enabled; startup throws a descriptive error if it is missing or malformed. Analytics behavior (enable flag, event names, privacy signals) is configured in `src/services/firebase/analyticsConfig.ts`.

To connect to the local Firebase Emulator Suite:
```bash
VITE_USE_FIREBASE_EMULATOR=true
```

---

## 6. Updating & Deploying to Production

The live application is hosted on **Firebase Hosting** and backed by **Cloud Firestore** under the Google Cloud / Firebase project **`schada-online`**:

- **Primary Domain:** [https://schada.org](https://schada.org)
- **Firebase Default URL:** [https://schada-online.web.app](https://schada-online.web.app) / [https://schada-online.firebaseapp.com](https://schada-online.firebaseapp.com)
- **Firebase Console:** [https://console.firebase.google.com/project/schada-online/overview](https://console.firebase.google.com/project/schada-online/overview)

---

### Deployment Workflow

Always run the pre-deploy checks first, then deploy in the order below. Firestore must go first whenever rules or indexes change so new queries are backed by indexes before the hosting bundle lands.

```bash
# 1. Verify all tests pass and the build is clean
npm test && npm run build

# 2. Deploy Firestore rules and indexes first
#    - firestore.rules takes effect immediately
#    - New composite indexes begin building (takes 2–10 min depending on volume)
npx firebase-tools deploy --only firestore

# 3. Deploy the frontend hosting bundle
npx firebase-tools deploy --only hosting
```

Your live site at `https://schada.org` updates immediately after step 3. Clients never need to empty cache or perform a hard reload to see changes:

- **Zero-Cache Entry Points**: `index.html`, `sw.js`, `manifest.webmanifest`, and `version.json` are served with `Cache-Control: no-cache, no-store, must-revalidate` (across both Firebase Hosting and Nginx / Cloud Run), while hashed assets in `/assets/` are cached immutably for 1 year.
- **Service Worker Auto-Claim & Lifecycle**: Background update checks trigger on app mount, visibility change, window focus, network reconnection, and periodic intervals. When a new service worker installs, it immediately activates (`skipWaiting`) and claims clients (`clientsClaim`).
- **Safe Dynamic Reloading**: Active browser sessions receive the `controllerchange` event. If the player is in an active match, reload is cleanly deferred until the game concludes or manually confirmed via the update banner; idle and lobby tabs reload automatically.
- **Resilient Version Polling**: Remote `/version.json` manifest checks provide a lightweight fallback across all browsers and private browsing modes.

> **Note on index build time:** After step 2, new composite indexes show as **Building** in the [Firebase Console → Firestore → Indexes](https://console.firebase.google.com/project/schada-online/firestore/indexes). The app remains fully operational during this window — ordered queries fall back automatically until indexes are **Enabled**.

---

### Routine Hosting-Only Update

When only source code changes (no `firestore.rules` or `firestore.indexes.json` modifications):

```bash
npm test && npm run build && npx firebase-tools deploy --only hosting
```

---

### Full Combined Deploy

To deploy everything (Firestore rules, indexes, and hosting) in a single command:

```bash
npm run build && npx firebase-tools deploy
```

---

### Domain & DNS Configuration (`schada.org`)

To bind a custom domain `schada.org` to Firebase Hosting, configure these DNS records at your registrar (Cloudflare, Namecheap, GoDaddy, etc.):

| Type      | Name / Host   | Target / Value          | Purpose                                             |
| :-------- | :------------ | :---------------------- | :-------------------------------------------------- |
| **A**     | `@` (or root) | `199.36.158.100`        | Points root domain `schada.org` to Firebase Hosting |
| **CNAME** | `www`         | `schada-online.web.app` | Points `www.schada.org` to the hosting target       |

> **SSL / HTTPS Provisioning:** Firebase automatically issues and renews free SSL certificates via Let's Encrypt within 10–30 minutes of DNS verification.

---

### Container Deployment (Google Cloud Run Alternative)

For environments requiring containerized deployment via Docker and Google Cloud Run:

```bash
# Submit build and deploy via Google Cloud Build
gcloud builds submit --config=cloudbuild.yaml
```

---

## 7. Project Architecture & Structure

```text
schada/
├── firestore.rules                 # Firestore authorization, match mutation & rate-limiting rules
├── firestore.indexes.json          # Composite index definitions for matchmaking & leaderboards
├── firebase.json                   # Firebase Hosting headers, cache control & emulator ports
├── Dockerfile                      # Multi-stage container build for Google Cloud Run
├── cloudbuild.yaml                 # GCP Cloud Build CI/CD deployment configuration
├── vite.config.ts                  # Vite 8 bundler, PWA plugin, and test configuration
├── src/
│   ├── core/
│   │   ├── bot/                    # 8-tier AI bot engine
│   │   │   ├── botConfig.ts        # Centralized bot search, heuristic weights & tier parameters
│   │   │   ├── fastBoard.ts        # Typed-array (Uint8Array) high-speed board representation
│   │   │   ├── search.ts           # Alpha-Beta minimax, PVS, iterative deepening, quiescence
│   │   │   ├── evaluator.ts        # Material, pacing paradox, centrality & tiebreak evaluation
│   │   │   ├── distanceTables.ts   # Precomputed BFS shortest-path distance matrices
│   │   │   ├── openingBook.ts      # Curated opening book variations & move sequence index
│   │   │   ├── botTiers.ts         # Level 1–8 tier profiles, Elo benchmarks, and blunder rates
│   │   │   ├── botWorker.ts        # Dedicated Web Worker executing search off the UI thread
│   │   │   └── botWorkerClient.ts  # Worker lifecycle manager and promise-based dispatcher
│   │   ├── schada/                 # Pure rules engine, movement vectors, scoring, and replay
│   │   │   ├── engine.ts           # Move validation, board transformations, legal move generation
│   │   │   ├── rulesConfig.ts      # Authoritative 1936 rules, piece counts, scoring & board constants
│   │   │   ├── formatConfig.ts     # Match time controls, preset options & friend challenge defaults
│   │   │   ├── vectors.ts          # Authoritative 64-square movement matrix (paths and targets)
│   │   │   ├── replay.ts           # Non-destructive move history navigator and position replay
│   │   │   └── scoring.ts          # Goal-line points and fractional tiebreaker calculations
│   │   └── elo/                    # Dynamic K-factor Elo calculations and post-game deltas
│   ├── services/
│   │   ├── audio/                  # Procedural Web Audio API sound synthesizer and audioConfig
│   │   ├── deployment/             # Chunk load error detector and debounced auto-reload service
│   │   ├── device/                 # Haptics feedback vibration patterns and hapticsConfig
│   │   ├── orientation/            # Mobile device orientation detector and portrait lock
│   │   └── firebase/               # Firebase auth, modular game service, presence, and matchmaking
│   │       ├── gameService.ts      # Multiplayer game orchestration facade
│   │       ├── gameTypes.ts        # Match room and player type definitions
│   │       ├── gameTransitions.ts  # Authoritative move, resignation & timeout state transitions
│   │       ├── gameClock.ts        # Fischer increment clock math and timeout detection
│   │       ├── gameElo.ts          # Ranked Elo calculation and pending rating reconciliation
│   │       ├── localGameStore.ts   # Multi-tab BroadcastChannel local offline store
│   │       ├── lobbyService.ts     # Room discovery, sorting and matchmaking queries
│   │       └── gameCleanupService.ts # Stale and abandoned match garbage collection
│   ├── components/
│   │   ├── board/                  # SVG board rendering, piece icons, vector lines, square highlights
│   │   ├── game/                   # Arena layout, player cards, digital clocks, move navigator, game over modal
│   │   ├── lobby/                  # Quick pairing, custom games, bot selection modal, player counts
│   │   ├── friends/                # Social drawer, search, incoming/outgoing friend challenges
│   │   ├── leaderboard/            # Global Elo ranking table and tier badges
│   │   ├── learn/                  # Interactive visual rules guide and movement vector diagrams
│   │   ├── history/                # Historical background and origin of Jan Boogerd's 1936 game
│   │   └── layout/                 # Navigation header, footer, orientation lock overlay, theme toggle
│   ├── hooks/                      # Custom React hooks (mobile orientation, audio, bot worker)
│   └── styles/                     # CSS design tokens, board themes, dark/light mode standards
```

---

## 8. Editing `src/core/schada/vectors.ts`

`src/core/schada/vectors.ts` is the authoritative 64-square movement matrix. Each entry defines **where a piece on that square can move to** and **which intermediate squares the move passes through** (for blocking and capture rules). The engine, AI bot, test suites, and UI vector overlay all import this file directly.

### Coordinate System

All offsets are expressed as `[file_delta, rank_delta]`:

| Axis             | Positive Direction | Negative Direction |
| :--------------- | :----------------- | :----------------- |
| **File** (`[0]`) | Toward `h` (right) | Toward `a` (left)  |
| **Rank** (`[1]`) | Toward `8` (up)    | Toward `1` (down)  |

**Example:** From `d4`, the offset `[2, -1]` points to `f3` (2 files right, 1 rank down).

### Entry Format

Each top-level key is a square in algebraic notation (`"a1"` to `"h8"`). Its value is an **array of move objects**:

```json
"<square>": [
  {
    "target": [file_delta, rank_delta],
    "path":   []
  }
]
```

| Field      | Type              | Description                                                                                                                                                                              |
| :--------- | :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"target"` | `[int, int]`      | Relative offset from the piece's square to the destination square.                                                                                                                       |
| `"path"`   | `[[int, int], …]` | Ordered list of intermediate squares traversed. An intervening piece on any waypoint blocks standard pieces (Field Officers can leap over friendly pieces). Empty `[]` for direct moves. |

### Direct Moves (`"path": []`)

A move with an empty path is a single-step move with no intervening squares:

```json
{ "target": [1,  0], "path": [] }   // one file right   (e.g., e4 → f4)
{ "target": [0, -1], "path": [] }   // one rank down    (e.g., e4 → e3)
{ "target": [1,  1], "path": [] }   // diagonal         (e.g., e4 → f5)
```

### Bent / Multi-Step Paths (`"path": [...]`)

A bent move travels through intermediate waypoints before reaching its destination. Every waypoint is specified as an offset relative to the **starting square**:

```json
{
  "target": [2, -1],
  "path": [
    [1, 0],
    [2, 0]
  ]
}
```

*Example from `f2`:* Begins at `f2`, steps through `g2` (offset `[1, 0]`), steps through `h2` (offset `[2, 0]`), and arrives at `h1` (target `[2, -1]`).

### 180° Symmetry Rule

The board possesses rotational symmetry: ranks 5–8 mirror ranks 1–4 rotated by 180°. Whenever you update a square, its mirror square on the opposite half must be updated with **every offset negated** (multiplied by `-1`):

| Square | Target                       | Mirror Square | Target                         |
| :----- | :--------------------------- | :------------ | :----------------------------- |
| `a5`   | `[0, 1]` → `a6`              | `h4`          | `[0, -1]` → `h3`               |
| `f2`   | `[2, -1]` via `[1,0], [2,0]` | `c7`          | `[-2, 1]` via `[-1,0], [-2,0]` |

Always update **both** squares simultaneously to preserve board balance and engine integrity.

### Step-by-Step Workflow for Tuning Vectors

1. **Calculate Target Offset**: Determine destination file and rank deltas from the source square.
2. **Trace Waypoints**: List all intermediate squares the move crosses as offsets from the starting square.
3. **Update Source Square**: Modify the move object array in `src/core/schada/vectors.ts`.
4. **Mirror Rotational Square**: Negate all target and path coordinates on the 180° mirror square.
5. **Run Test Suite**: Run `npm test` to verify move generation and board symmetry tests pass.

### Quick Reference: Common Offsets

| Offset     | Direction            |
| :--------- | :------------------- |
| `[1, 0]`   | One file toward `h`  |
| `[-1, 0]`  | One file toward `a`  |
| `[0, 1]`   | One rank toward `8`  |
| `[0, -1]`  | One rank toward `1`  |
| `[1, 1]`   | Diagonal toward `h8` |
| `[-1, -1]` | Diagonal toward `a1` |
| `[1, -1]`  | Diagonal toward `h1` |
| `[-1, 1]`  | Diagonal toward `a8` |

---

## 9. Security & Threat Modeling

Schada employs an authoritative defense-in-depth security model:
- **Zero-Trust Client Mindset**: Authoritative game state immutability, bounded Elo deltas, monotonic match counters, and granular room lifecycle rules enforced authoritatively at the database boundary via `firestore.rules`.
- **Sensitive PII Segregation**: Registered user email addresses are omitted from public Firestore documents, eliminating database enumeration while hydrating seamlessly in memory via Firebase Auth tokens.
- **HTTP Security Headers**: Strict hosting security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and CSP) deployed with zero-reload cache-control preservation.
- **Canonical Game Identifier Hardening**: 9-character alphanumeric (case-sensitive, Base62) game identifiers generated via cryptographically secure pseudo-random values (`crypto.getRandomValues`), atomic collision-prevention transactions in Firestore, and strict regex schema enforcement in `firestore.rules`.

---

## 10. Knowledge Graph (graphify)

This project is graphified — a queryable knowledge graph of the full codebase can be built and explored using [graphify](https://github.com/safishamsi/graphifyy).

### Prerequisites

Install graphify via uv (recommended) or pip:

```powershell
uv tool install graphifyy
# or: pip install graphifyy
```

Set the graphify API key as a persistent user environment variable (do **not** paste the key directly into commands or commit it to source control):

```powershell
[System.Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "<your-graphify-key>", "User")
# Restart your terminal after setting this
```

### Build the graph

```powershell
# From the repo root (set key for the session first):
$env:GEMINI_API_KEY = "<your-graphify-key>"
graphify .
```

This produces `graphify-out/` containing:

| File              | Purpose                                                              |
| :---------------- | :------------------------------------------------------------------- |
| `graph.html`      | Interactive graph — open in any browser, no server needed            |
| `GRAPH_REPORT.md` | Audit report: god nodes, surprising connections, suggested questions |
| `graph.json`      | Raw graph data for tooling / RAG pipelines                           |

### Query the graph

```powershell
# Ask a natural-language question about the codebase:
graphify query "how does the Firebase mock switching work?"

# Trace the shortest path between two concepts:
graphify path "localBackend" "isFirebaseConfigured"

# Explain a specific node:
graphify explain "isFirebaseConfigured"

# Incremental update after code changes (only re-extracts changed files):
graphify .
```

### Refresh the report after an update

`graphify .` updates `graph.json` and `graph.html` but **does not automatically regenerate `GRAPH_REPORT.md`**.
Run this after any update to keep the report in sync:

```powershell
graphify cluster-only .
```
