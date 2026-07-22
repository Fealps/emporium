# 🏰 D&D 5e Campaign Emporium

A premium, interactive web application designed for Dungeon Masters (DMs) and players to manage campaigns, characters, economies, and travel in a D&D 5e setting. The application features a stunning glassmorphism interface, custom game rules integration, and a mock database architecture running entirely in the browser.

---

## 🌟 Key Features

### 1. Campaign & User Management
* **Role-Based Views**: Log in as a player or DM. Toggle between dashboards to manage different campaigns.
* **Campaign Invitation**: DMs can generate unique campaign codes (e.g., `G-1234`) for players to easily join the adventure.
* **Interactive Dashboard**: Track all active campaigns, player characters, and DM statuses from a central hub.

### 2. Character Sheet & Mechanics
* **Dynamic Character Creation**: Create characters by choosing name, race, class, level, stats (STR, DEX, CON, INT, WIS, CHA), starting HP, and initial gold.
* **Smart Attunement Limits**: Automatic calculation of attunement slots (default is 3, but dynamically scales for specific classes like Artificers up to 6 slots at level 18+).
* **Inventory & Equipment Slots**:
  * Dedicated slots for Armor, Main Hand, Off-Hand, and up to 5 Wondrous/Accessory slots.
  * **Rule Constraints**: Wielding a two-handed weapon automatically unequips off-hand shields or weapons and blocks off-hand equipping.

### 3. Economy & Shop System (The Emporium)
* **Custom Storefront**: DMs can list standard SRD items or create completely custom items for the campaign shop.
* **Stock & Currency Management**: Set prices in Gold (gp), Silver (sp), or Copper (cp) with custom stock limits.
* **Live Purchasing**: Players buy items using their inventory gold. Gold conversion (1 gp = 10 sp = 100 cp) and exact coin subtractions are computed automatically.

### 4. Interactive World Map & Travel
* **Interactive Nodes**: Explore locations like *Phandalin*, *Neverwinter Wood*, *Cragmaw Castle*, and *Wave Echo Cave*.
* **Real-time Travel**: Track party location and manage travel state between locations.

### 5. Live Campaign Logs
* **Real-Time Logs**: View an activity stream showing system events, character creations, purchases, and DM actions.
* **State Syncing**: Action logs use custom events to immediately notify and update active UI views.

---

## 🛠️ Technology Stack

* **Frontend Framework**: React 18
* **Styling**: Vanilla CSS with custom theme variables, premium glassmorphism layouts, and custom typography integrations.
* **Database & Persistence**: Lightweight mock database wrapper utilizing browser `localStorage` (`src/utils/db.js`).

---

## 📁 Project Structure

```bash
emporium/
├── public/
│   └── index.html          # HTML entry point
└── src/
    ├── components/
    │   ├── Auth.js         # Register & Login component
    │   ├── Dashboard.js    # Hub to join/create campaigns
    │   ├── DMPanel.js      # Campaign control panel for Dungeon Masters
    │   └── PlayerPanel.js  # Character sheets, inventory & shop for Players
    ├── utils/
    │   ├── db.js           # LocalStorage database helper & game rules
    │   └── srdItems.js     # Default D&D 5e SRD items for campaign shops
    ├── App.js              # Application router & main state controller
    ├── index.js            # React entry point
    └── index.css           # Global typography, color tokens, and styling
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Fealps/emporium.git
   cd emporium
   ```
2. Install dependencies:
   ```bash
   yarn install
   # or
   npm install
   ```

### Running Locally
To launch the development server:
```bash
yarn start
# or
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

### Building for Production
To bundle the application in production mode:
```bash
yarn build
# or
npm run build
```
The output will be placed in the `build/` directory, optimized and ready for deployment.
