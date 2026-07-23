# 🏰 D&D 5e Campaign Emporium

A premium, full-stack interactive web application designed for Dungeon Masters (DMs) and players to manage campaigns, characters, economies, and travels in a D&D 5e setting. The application features a stunning glassmorphism interface, custom game rules integration, and a containerized database architecture with Feature-Driven Development (FDD) component modularization.

---

## 🌟 Key Features

### 1. Database Backend & Security
* **PostgreSQL Persistence**: Fully containerized PostgreSQL 15 database storing campaigns, auth credentials, logs, multi-map setups, and character sheets.
* **Stat Purser (JSONB)**: Dynamic D&D attributes, nested player inventories, custom storefront listings, multi-map layouts, and catalog configurations are persisted as highly performant SQL `JSONB` objects.
* **Bcrypt Credentials Hashing**: Secure register/login password hashing handled on the Node Express server.
* **Case-Insensitive Database Queries**: Robust `LOWER(username) = LOWER($x)` queries prevent casing mismatch issues when retrieving characters and player campaigns.

### 2. Campaign & User Management
* **Role-Based Views**: Log in as player or DM. Toggle between dashboards to manage different campaigns.
* **Campaign Creation & Deletion**: DMs generate unique campaign codes (e.g. `GAME1234`) for players to join, and can permanently delete campaigns with cascading cleanup directly from the Guild Hall Dashboard.
* **Active Player Tracker**: DMs can view character stats, inspect players' inventories, edit HP/Level/Gold stats with explicit layout constraints (`maxWidth: 2.5rem`, `minWidth: 6rem`), grant items, toggle item equipment, and kick/remove players.

### 3. Economy & Shop System (The Emporium)
* **Custom Storefront & Item Editing**: DMs can list standard SRD items, upload CSV custom lists, create new items, or edit existing catalogue items (name, category, cost, stock, rarity, weight, description).
* **Shopping Sessions**: DMs can establish and open different custom shops. Players can browse available storefronts, search, filter by category, sort by price, and purchase items using their gold purse with automatic coin conversions (1 GP = 10 SP = 100 CP).
* **Smart Attunement & Slots Rules**: Automatically tracks armor, main hand, off-hand, and accessory slots. Implements two-handed weapon constraints and class-based attunement limits.

### 4. Interactive World Map & Multi-Map System
* **Multi-Map Management**: DMs can upload multiple high-resolution PNG maps (up to **25MB** each), assign custom names, delete draft maps, and select which active map to publish to players (`Show to Players`).
* **Landmark Creation & Deletion**: Click anywhere on the map background to define coordinates (X, Y) and establish new cities or landmarks. DMs can edit or delete any landmark—including Phandalin (`loc_start`)—with automatic party location fallback handling.
* **Shared Interactive Map Engine**: Reusable SVG map rendering component (`InteractiveMap.js`) handles node overlays, landmark inspection, and animated party travel markers.
* **Real-Time Travel Journeys**: DMs or players can inspect landmarks, view lore, and set travel destinations. Background travel timers animate party progress.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, Feature-Driven Modular Architecture & Vanilla CSS (Glassmorphism, Theme tokens)
* **Backend**: Node.js & Express REST API
* **Database**: PostgreSQL 15 (JSONB columns)
* **Orchestration**: Docker Compose
* **CI/CD Pipeline**: GitHub Actions

---

## 📁 Project Structure (Feature-Driven Development)

```bash
emporium/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions CI/CD Pipeline
├── backend/
│   ├── Dockerfile             # Node container Dockerfile
│   ├── package.json           # Backend dependencies
│   └── server.js              # Express API endpoints & DB schema init
├── docs/
│   └── architecture.md        # System architecture & design choices document
├── src/
│   ├── assets/                # Map images and graphic assets
│   ├── components/            # Main view coordinators
│   │   ├── Auth.js            # Register & Login authentication screen
│   │   ├── Dashboard.js       # Guild Hall campaign selection & creation dashboard
│   │   ├── DMPanel.js         # DM Master Panel coordinator
│   │   └── PlayerPanel.js     # Player Panel coordinator
│   ├── features/              # Feature-Driven Development (FDD) modules
│   │   ├── catalogue/
│   │   │   └── DMCatalogueTab.js       # Catalogue wares, custom item editor, SRD & CSV imports
│   │   ├── shops/
│   │   │   ├── DMShopsTab.js           # Shop establishment, status toggle & shelf stock manager
│   │   │   └── PlayerShopTab.js        # Merchant shop selection, category filter, sorting & buying
│   │   ├── maps/
│   │   │   ├── InteractiveMap.js       # Shared SVG interactive map engine & party marker
│   │   │   ├── DMMapsTab.js            # Multi-map upload/publishing, landmark placement & travel
│   │   │   └── PlayerTravelsTab.js     # Active map view, landmark lore inspector & travel progress
│   │   ├── players/
│   │   │   ├── DMPlayersTrackerTab.js  # Adventurer list, HP/Level/Gold editing, gear & kicking
│   │   │   ├── PlayerCharacterSheetTab.js # Vitals, AC breakdown, HP heal/damage, ability scores & wallet
│   │   │   └── PlayerBackpackTab.js    # Character silhouette slots, attunement limit & inventory actions
│   │   └── chronicle/
│   │       └── ChronicleLogsTab.js     # Shared chronicle logs scroll ticker & clear logs action
│   ├── utils/
│   │   ├── db.js              # REST API Client wrapper & attunement helper rules
│   │   └── srdItems.js        # Default 5e SRD items catalog
│   ├── App.js                 # Routing and authorization gate
│   ├── index.js               # React root entry point
│   └── index.css              # Styling theme tokens and UI utilities
├── Dockerfile                 # Multi-stage Nginx production build Dockerfile
├── docker-compose.yml         # Multi-container local orchestration
├── package.json               # Frontend package manifest
└── README.md                  # Comprehensive project documentation
```

For detailed architectural layout, database models, and API contract specifications, see the **[System Architecture Guide](docs/architecture.md)**.

---

## 🚀 Getting Started

### Prerequisites
* Make sure you have [Docker and Docker Compose](https://www.docker.com/) installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Fealps/emporium.git
   cd emporium
   ```

### Running with Docker Compose (Recommended)
To launch the database, Express backend, and React/Nginx frontend services:
```bash
docker-compose up --build
```
* **Frontend Web App**: Access [http://localhost:3000](http://localhost:3000)
* **Backend REST API**: Runs on [http://localhost:5000](http://localhost:5000)
* **PostgreSQL Database**: Accessible on port `5432`

---

## ⚙️ Development Commands (Local Execution)

If running services locally outside Docker:

### 1. Run the Database
Spin up only the Postgres service in Docker:
```bash
docker-compose up db -d
```

### 2. Start the Backend API
Navigate to the backend, install dependencies, and run with nodemon:
```bash
cd backend
npm install
npm run dev
```

### 3. Start the React Frontend
In the root directory, install packages and start the dev server:
```bash
yarn install
yarn start
```
Access [http://localhost:3000](http://localhost:3000). The frontend will proxy API requests to port `5000`.

### 4. Running Unit Tests
To execute the frontend test suite:
```bash
yarn test --watchAll=false
```
