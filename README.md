# 🏰 D&D 5e Campaign Emporium

A premium, full-stack interactive web application designed for Dungeon Masters (DMs) and players to manage campaigns, characters, economies, and travels in a D&D 5e setting. The application features a stunning glassmorphism interface, custom game rules integration, and a containerized database architecture.

---

## 🌟 Key Features

### 1. Database Backend & Security
* **PostgreSQL Persistence**: Fully containerized PostgreSQL 15 database storing campaigns, auth credentials, logs, and sheets.
* **Stat Purser (JSONB)**: Dynamic D&D attributes, nested player inventories, custom storefront listings, and catalog configurations are persisted as highly performant SQL `JSONB` objects.
* **Bcrypt Credentials Hashing**: Secure register/login password hashing handled on the Node server.

### 2. Campaign & User Management
* **Role-Based Views**: Log in as player or DM. Toggle between dashboards to manage different campaigns.
* **Campaign Invitation**: DMs generate unique campaign codes (e.g. `GAME1234`) for players to easily join.
* **Active Player Tracker**: DMs can view character stats, inspect players' inventories, manual-edit sheets, grant items, and kick/remove players.

### 3. Economy & Shop System (The Emporium)
* **Custom Storefront**: DMs can list standard SRD items, upload CSV custom lists, or create completely custom items with custom stocks and currencies (gp, sp, cp).
* **Shopping Sessions**: DMs can establish and open different custom shops. Players can browse available storefronts and purchase items using their purse gold with automatic coin conversions.
* **Smart Attunement & Slots Rules**: Automatically tracks armor, main hand, off-hand, and accessory slots. Implements two-handed constraints and class-based attunement limits.

### 4. Interactive World Map & Travel
* **Custom Map PNG Upload**: DMs can upload local PNG map files (up to 1.5MB) to update the campaign background.
* **Landmark Creations**: Click anywhere on the map background to define coordinates (X, Y) and establish new cities or landmarks.
* **Lore Inspection**: Players and DMs can click map nodes to inspect lore, descriptions, and coordinates.
* **Real-time Travel Journey**: Set party travel destinations. Travel time runs in the background with arrival logs.

---

## 🛠️ Technology Stack

* **Frontend**: React 18 & Vanilla CSS (Theme variables, Glassmorphism, Premium font integrations)
* **Backend**: Node.js & Express API
* **Database**: PostgreSQL 15
* **Orchestration**: Docker Compose
* **CI/CD Pipeline**: GitHub Actions

---

## 📁 Project Structure

```bash
emporium/
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # GitHub Actions CI/CD Pipeline
├── backend/
│   ├── Dockerfile          # Node container Dockerfile
│   ├── package.json        # Backend dependencies
│   └── server.js           # Express API endpoints & DB init
├── docs/
│   └── architecture.md     # System architecture design docs
├── src/
│   ├── components/
│   │   ├── Auth.js         # Register & Login forms (async)
│   │   ├── Dashboard.js    # Join/create campaign panel (async)
│   │   ├── DMPanel.js      # DM controls (shops, CSV, maps, kicks) (async)
│   │   └── PlayerPanel.js  # Player sheets, inventories & shopping (async)
│   ├── utils/
│   │   ├── db.js           # Async API Client wrappers
│   │   └── srdItems.js     # Default 5e SRD items catalog
│   ├── App.js              # Routing and authorization gate
│   ├── index.js            # React root mount
│   └── index.css           # Styling theme tokens
├── Dockerfile              # Multi-stage Nginx production build Dockerfile
├── docker-compose.yml      # Multi-container local orchestration
├── package.json            # Frontend package manifest
└── README.md               # Campaign guide docs
```

For a detailed design overview, database schemas, and service flow diagrams, read the **[System Architecture Guide](file:///d:/Arquivos/Code/Pessoal/Em%20progresso/emporium/docs/architecture.md)**.

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
To launch the full-stack database, Express backend, and Nginx frontend in containerized environments:
```bash
docker-compose up --build
```
* **Frontend Web App**: Access [http://localhost:3000](http://localhost:3000)
* **Backend REST API**: Runs on [http://localhost:5000](http://localhost:5000)
* **PostgreSQL Database**: Accessible on port `5432`

---

## ⚙️ Development Commands (Local Execution)

If running outside Docker for rapid code edits:

### 1. Run the Database
You can spin up only the Postgres service in Docker:
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
Go to `http://localhost:3000`. The frontend will proxy/call API requests to local port 5000.

### 4. Running Unit Tests
To execute the frontend React testing suite:
```bash
yarn test
```
