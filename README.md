# Schada • Online Strategy Board Game

An online, multiplayer implementation of **Schada**, the classic mind sport invented by Jan Boogerd (1936, Rotterdam), featuring a fast, minimalist, Lichess-inspired UI built with React 18, Vite, TypeScript, the Web Audio API, and Google Cloud Platform / Firebase.

---

## 1. Game Overview

In Schada, **the squares dictate piece movement**, rather than the pieces themselves:
- **8x8 Board**: Each square features lines and dots denoting allowable movement vectors.
- **180° Symmetry**: The top half (ranks 5–8) is an exact 180° rotation of the bottom half (ranks 1–4).
- **Three Piece Types**:
  - **Field Officer (4 per side)**: Can leap over intermediate friendly pieces. Worth 2 points in the goal line.
  - **Officer (4 per side)**: Standard high piece. Worth 1 point in the goal line.
  - **Pawn (8 per side)**: Support and blocker.
- **Base Line & Goal Line Restrictions**:
  - High pieces can shuffle along their base line, but once they leave it, they **cannot return**.
  - Once high pieces reach their goal line (Rank 8 for Blue, Rank 1 for Green), they **cannot leave**, and are **immune to enemy capture**.
- **Victory & Scoring**:
  - The game ends when all surviving high pieces of a player reach their goal line, or on 3-fold repetition, or when high pieces are blocked.
  - Scoring: Goal line points ($\text{FO}=2, \text{O}=1$), with tiebreakers based on surviving high pieces outside the goal line and rank distance ($2/7$ and $1/7$).

---

## 2. Key Features

- **Lichess-Inspired UX**: Distraction-free two-column game arena, warm dark & light modes, digital countdown clocks, and two-column algebraic move notation.
- **Faithful Schada Rule Engine**: Complete 64-square vector matrix (including bent paths on `f2`, `f4`, `g2`, `h4`, etc.), Field Officer friendly leap exceptions, goal immunity, and tiebreaker engine.
- **Procedural Sound Engine**: Synthesized piece clacks, capture chimes, goal fanfares, and low-time countdown alerts powered by the **Web Audio API** (zero heavy external audio dependencies).
- **Elo Rating System**: Dynamic K-factor ($K=40$ for provisional matches, $K=20$ for established players), with separate Ranked and Casual matches and a Global Leaderboard.
- **User Management & "Change Once" Policy**: Email/password authentication, unique username reservation, and strict enforcement of at most **1 username change** per lifetime.
- **Social & Friend System**: Exact username search, real-time incoming/outgoing requests, live online/in-game presence, and 1-click challenge buttons.
- **GCP & Firebase Native**:
  - Firestore security rules (`firestore.rules`) and composite indexes (`firestore.indexes.json`).
  - Multi-stage `Dockerfile` and `cloudbuild.yaml` for Google Cloud Run deployment.
  - Built-in offline mock provider allowing instant local play out of the box without live cloud keys.

---

## 3. Getting Started

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Run unit tests
npm test

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` to play!

### Connecting to GCP / Firebase
Copy `.env.example` to `.env` and fill in your Firebase project credentials:
```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

To run against the local Firebase Emulator Suite:
```bash
VITE_USE_FIREBASE_EMULATOR=true
```

---

## 4. Updating & Deploying to Production

The live application is hosted on **Firebase Hosting** and backed by **Cloud Firestore** under the Google Cloud / Firebase project **`schada-online`**:
- **Primary Domain:** [https://schada.org](https://schada.org) *(once DNS propagation completes)*
- **Firebase Default URL:** [https://schada-online.web.app](https://schada-online.web.app) / [https://schada-online.firebaseapp.com](https://schada-online.firebaseapp.com)
- **Firebase Console:** [https://console.firebase.google.com/project/schada-online/overview](https://console.firebase.google.com/project/schada-online/overview)

---

### Routine Update Workflow

Whenever you make changes to UI components, game mechanics, or styles, follow these steps to test, build, and deploy the latest version:

```bash
# 1. Run tests to ensure engine correctness
npm test

# 2. Build the production bundle (compiles TypeScript & bundles via Vite into /dist)
npm run build

# 3. Deploy the updated frontend to Firebase Hosting
npx firebase-tools deploy --only hosting
```

Your live site at `https://schada.org` and `https://schada-online.web.app` will update within seconds.

---

### Deploying Firestore Security Rules & Indexes

If you modify `firestore.rules` or `firestore.indexes.json`:

```bash
# Deploy only Firestore rules and composite indexes
npx firebase-tools deploy --only firestore
```

To deploy **both** frontend and Firestore rules together:
```bash
npm run build && npx firebase-tools deploy
```

---

### Domain & DNS Configuration (`schada.org`)

To link your purchased domain `schada.org` to Firebase Hosting, configure these DNS records at your domain registrar (Namecheap, Cloudflare, GoDaddy, Google Domains, etc.):

| Type      | Name / Host    | Value / Target          | Purpose                                             |
| :-------- | :------------- | :---------------------- | :-------------------------------------------------- |
| **A**     | `@` (or blank) | `199.36.158.100`        | Points root domain `schada.org` to Firebase Hosting |
| **CNAME** | `www`          | `schada-online.web.app` | Points `www.schada.org` to the web app              |

> **SSL / HTTPS:** Firebase automatically provisions a free Let's Encrypt SSL certificate within 10–30 minutes after DNS records propagate.

---

### Firebase Authentication Setup (One-Time)

If not already completed, ensure Email/Password login and authorized domains are enabled:
1. Open the [Firebase Authentication Console](https://console.firebase.google.com/project/schada-online/authentication).
2. Click **Get started**.
3. Under the **Sign-in method** tab, click **Email/Password**, toggle **Enable**, and click **Save**.
4. Under the **Settings** tab > **Authorized domains**, add `schada.org` and `www.schada.org` to the list.

---

### Optional: Container Deployment (Google Cloud Run)

If you prefer running a containerized nginx instance on Google Cloud Run instead of static Firebase Hosting:

```bash
# Build container image and deploy using Google Cloud Build
gcloud builds submit --config=cloudbuild.yaml
```

---

## 5. Project Structure

```text
schada/
├── firestore.rules          # Firestore authorization & game mutation rules
├── firestore.indexes.json   # Composite indexes for Leaderboard & Matchmaking
├── firebase.json            # Firebase Hosting & Emulator configuration
├── Dockerfile               # Multi-stage production build for GCP Cloud Run
├── cloudbuild.yaml          # GCP Cloud Build CI/CD pipeline
├── src/
│   ├── core/
│   │   ├── schada/          # Pure Schada engine, vectors, scoring, and Vitest suite
│   │   └── elo/             # Dynamic K-factor Elo calculations and tests
│   ├── services/
│   │   ├── firebase/        # Auth, friends, matchmaking, and mock fallback
│   │   └── audio/           # Web Audio API sound synthesizer
│   ├── components/
│   │   ├── board/           # SVG Schada board, piece icons, vector overlays
│   │   ├── game/            # Arena, player cards, digital clocks, move notation
│   │   ├── lobby/           # Quick pairing grid, custom game modal
│   │   ├── friends/         # Friends drawer, requests, challenge button
│   │   ├── leaderboard/     # Global Elo ranking table
│   │   ├── learn/           # Illustrated rules guide
│   │   └── layout/          # Navbar, dark/light theme toggle
│   └── styles/              # CSS tokens, board styles, and layout
```

---

## 6. Editing `src/core/schada/vectors.ts`

`src/core/schada/vectors.ts` is the authoritative 64-square movement matrix. Each entry defines **where a piece on that square can move to** and **which intermediate squares the move passes through** (for blocking/capture purposes). The engine, tests, and UI all import this file directly - editing it is how you tune movement rules for any square.

### Coordinate System

All offsets are written as `[file_delta, rank_delta]`:

| Axis             | Positive direction | Negative direction |
| :--------------- | :----------------- | :----------------- |
| **File** (`[0]`) | Toward `h` (right) | Toward `a` (left)  |
| **Rank** (`[1]`) | Toward `8` (up)    | Toward `1` (down)  |

**Example:** from `d4`, the offset `[2, -1]` points to `f3` (2 files right, 1 rank down).

### Entry Format

Each top-level key is a square in algebraic notation. Its value is an **array of move objects**, one per legal destination:

```json
"<square>": [
  {
    "target": [file_delta, rank_delta],
    "path":   []
  }
]
```

| Field      | Type              | Description                                                                                                                    |
| :--------- | :---------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| `"target"` | `[int, int]`      | Offset from the piece's current square to the destination                                                                      |
| `"path"`   | `[[int, int], …]` | Ordered list of intermediate squares the move travels **through**, not including the destination. Empty `[]` for direct moves. |

### Direct Moves (`"path": []`)

A move with an empty path is a **single-step** move that does not pass through any intermediate square:

```json
{ "target": [1,  0], "path": [] }   // one file right   e.g. e4 → f4
{ "target": [0, -1], "path": [] }   // one rank down     e.g. e4 → e3
{ "target": [1,  1], "path": [] }   // diagonal          e.g. e4 → f5
```

### Bent / Multi-Step Paths (`"path": [...]`)

A bent move travels through one or more **intermediate squares** before reaching the target. List every waypoint in travel order. A piece occupying any waypoint will block the move:

```json
{
  "target": [2, -1],
  "path": [
    [1, 0],
    [2, 0]
  ]
}
```

This example (from `f2`) means: start at `f2`, pass through `g2` (offset `[1,0]`), pass through `h2` (offset `[2,0]`), arrive at `h1` (offset `[2,-1]`). Both `g2` and `h2` are blocking waypoints.

> **Important:** every offset in `path` - just like `target` - is **always relative to the piece's starting square**, not relative to the previous waypoint.

### 180° Symmetry Rule

The top half of the board (ranks 5–8) is an exact 180° rotation of the bottom half (ranks 1–4). For any square on one half, its mirror on the other half must have **every offset negated** (each component multiplied by `−1`).

| Square | Target                      | Mirror square | Target                        |
| :----- | :-------------------------- | :------------ | :---------------------------- |
| `a5`   | `[0, 1]` → a6               | `h4`          | `[0, -1]` → h3                |
| `f2`   | `[2, -1]` via `[1,0],[2,0]` | `c7`          | `[-2, 1]` via `[-1,0],[-2,0]` |

Always update **both** squares when you change one.

### Step-by-Step: Editing a Square's Moves

1. **Identify the destination** - convert it to a `[file_delta, rank_delta]` offset from the source square.
2. **Trace the path** - list every intermediate square the piece physically crosses, also as offsets from the source. Leave `"path": []` if the move is a single step with no waypoints.
3. **Edit the source square's entry** - add, remove, or replace the relevant move object in its array in `src/core/schada/vectors.ts`.
4. **Update the 180° mirror square** - negate all offsets in both `"target"` and every `"path"` waypoint.
5. **Run the test suite** (`npm test`) to catch any engine inconsistencies.

### Quick Reference: Common Offsets

| Offset     | Direction                   |
| :--------- | :-------------------------- |
| `[1, 0]`   | One file toward `h`         |
| `[-1, 0]`  | One file toward `a`         |
| `[0, 1]`   | One rank toward `8`         |
| `[0, -1]`  | One rank toward `1`         |
| `[1, 1]`   | Diagonal toward `h8` corner |
| `[-1, -1]` | Diagonal toward `a1` corner |
| `[1, -1]`  | Diagonal toward `h1` corner |
| `[-1, 1]`  | Diagonal toward `a8` corner |
