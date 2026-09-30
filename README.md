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
  - Once high pieces reach their goal line (Rank 8 for Blue, Rank 1 for Green), they **cannot leave**, and are **immune to enemy capture**.
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
- **Competitive Integrity & Matchmaking Separation**: Strict rated and casual matchmaking separation for authenticated users and guests.
- **Lichess-Inspired Minimalist UX**: Responsive arena with clocks, notation, controls, and dark/light mode.
- **Optimized Multiplayer Synchronization & Move Pipeline**: 0ms optimistic local moves with lightweight atomic Firestore updates and snapshot reconciliation.
- **Cross-Platform Hybrid Audio Engine**: Web Audio API with realistic synthesized fallbacks and zero-latency desktop and mobile playback.
- **Authoritative Symmetrical Elo Engine**: Immutable initial/final Elo ratings and deltas stored in match documents for symmetrical cross-client synchronization.
- **Mobile Portrait Orientation Lock**: Orientation detection and overlay for optimal vertical board aspect ratio.
- **Zero-Friction Deployment Recovery**: Automatic chunk failure detection and session refresh post-deployment.
- **Optimized Firestore CRUD Architecture**: Direct atomic updates without heavy locks and throttled presence updates.
- **PWA & Offline-First Architecture**: Service worker and local storage provider for guest and offline play.
- **Configuration-Over-Hardcoding Architecture**: Centralized, strictly validated configuration modules for bot heuristics, matchmaking, time controls, audio, and rules.

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
- **Opening Book**: Pre-compiled database of historical opening variations (e.g., *Twin Pillars Defense*, *Wing Outpost Variation*, *Eastern/Western Sentinels*).
- **Distance Tables**: Precomputed breadth-first search (BFS) shortest-path tables (`DISTANCE_TABLES`) quantifying exact minimum moves to the goal rank for every square.

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
- **Post-Game Game Review**: Following match completion, the Game Over modal can be closed via the 'Review' action, 'X' button, backdrop click, or `Escape` key, permitting full board inspection, move navigation, and board flipping. Players can reopen match results at any time via the 'Results' button or exit to the lobby via 'Lobby'.

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

# 3. Run unit test suite (31 test suites, 262+ tests)
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

### Connecting to GCP / Firebase

Create a `.env` file from `.env.example`:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

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

### Routine Update Workflow

Whenever you introduce new features, engine tuning, or style updates:

```bash
# 1. Verify engine and component tests
npm test

# 2. Build production assets into /dist
npm run build

# 3. Deploy frontend bundle to Firebase Hosting
npx firebase-tools deploy --only hosting
```

Your live site at `https://schada.org` updates immediately. Stale client browsers automatically refresh chunk assets thanks to the `deploymentRecoveryService`.

---

### Deploying Firestore Rules & Indexes

When modifying `firestore.rules` or composite index configurations in `firestore.indexes.json`:

```bash
# Deploy only Firestore rules and indexes
npx firebase-tools deploy --only firestore
```

To deploy both frontend assets and Firestore configuration in a single command:

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
│   │   └── firebase/               # Firebase auth, presence, matchmaking, and scale configuration
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

## Knowledge Graph (graphify)

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
