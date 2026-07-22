// Mock database helper using localStorage for D&D 5e Emporium

const KEYS = {
  USERS: 'emporium_users',
  CURRENT_USER: 'emporium_current_user',
  GAMES: 'emporium_games',
  CHARACTERS: 'emporium_characters',
  LOGS: 'emporium_logs'
};

// --- Raw storage accessors ---
const read = (key, defaultVal = {}) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  } catch (e) {
    console.error("Failed to read from localStorage key:", key, e);
    return defaultVal;
  }
};

const write = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to write to localStorage key:", key, e);
  }
};

// --- AUTHENTICATION ---
export const db = {
  getAttunementLimit: (charClass, level) => {
    const normClass = charClass ? charClass.trim().toLowerCase() : '';
    const lvl = parseInt(level) || 1;
    if (normClass === 'artificer') {
      if (lvl >= 18) return 6;
      if (lvl >= 14) return 5;
      if (lvl >= 10) return 4;
    }
    return 3;
  },

  // Authentication operations
  register: (username, password) => {
    const users = read(KEYS.USERS);
    const normalized = username.trim().toLowerCase();
    if (!normalized || !password) return { success: false, error: "Username and password cannot be empty" };
    if (users[normalized]) return { success: false, error: "Username already exists" };
    
    users[normalized] = { username: username.trim(), password };
    write(KEYS.USERS, users);
    
    // Auto-login
    write(KEYS.CURRENT_USER, username.trim());
    return { success: true, username: username.trim() };
  },

  login: (username, password) => {
    const users = read(KEYS.USERS);
    const normalized = username.trim().toLowerCase();
    if (!users[normalized] || users[normalized].password !== password) {
      return { success: false, error: "Invalid username or password" };
    }
    write(KEYS.CURRENT_USER, users[normalized].username);
    return { success: true, username: users[normalized].username };
  },

  logout: () => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },

  getCurrentUser: () => {
    return localStorage.getItem(KEYS.CURRENT_USER) || null;
  },

  // --- GAMES (CAMPAIGNS) ---
  getGames: () => {
    return read(KEYS.GAMES, {});
  },

  createGame: (name, description, dmUsername) => {
    const games = read(KEYS.GAMES, {});
    const id = "G-" + Math.floor(1000 + Math.random() * 9000);
    
    // Default campaign locations
    const defaultLocations = [
      { id: "loc_start", name: "Town of Phandalin", x: 250, y: 350, description: "A bustling frontier town built on the ruins of an old settlement." },
      { id: "loc_forest", name: "Neverwinter Wood", x: 450, y: 200, description: "A dense, ancient forest shrouded in mystery and danger." },
      { id: "loc_castle", name: "Cragmaw Castle", x: 600, y: 150, description: "The crumbling stronghold of the Cragmaw goblin tribe." },
      { id: "loc_cave", name: "Wave Echo Cave", x: 300, y: 500, description: "The legendary site of the Phandelver's Pact mine." }
    ];

    games[id] = {
      id,
      name: name.trim(),
      description: description.trim(),
      dmUsername,
      store: [], // Custom items list
      locations: defaultLocations,
      partyLocation: "loc_start",
      travelState: null, // { from, to, startTime, durationMs }
      createdAt: new Date().toISOString()
    };
    
    write(KEYS.GAMES, games);
    db.addLog(id, "System", `Campaign "${name}" created by Dungeon Master ${dmUsername}. Code: ${id}`);
    return games[id];
  },

  joinGame: (gameId, username) => {
    const games = read(KEYS.GAMES, {});
    const game = games[gameId];
    if (!game) return { success: false, error: "Campaign not found" };
    if (game.dmUsername === username) return { success: false, error: "You cannot join your own campaign as a player" };
    
    // Check if character already exists for this game and user
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    
    db.addLog(gameId, "System", `${username} joined the campaign.`);
    return { success: true, characterExists: !!characters[charKey], game };
  },

  getGame: (gameId) => {
    const games = read(KEYS.GAMES, {});
    return games[gameId] || null;
  },

  updateGameStore: (gameId, storeItems) => {
    const games = read(KEYS.GAMES, {});
    if (games[gameId]) {
      games[gameId].store = storeItems;
      write(KEYS.GAMES, games);
      return true;
    }
    return false;
  },

  updateGameTravel: (gameId, travelData) => {
    const games = read(KEYS.GAMES, {});
    if (games[gameId]) {
      games[gameId].travelState = travelData.travelState;
      games[gameId].partyLocation = travelData.partyLocation;
      write(KEYS.GAMES, games);
      return true;
    }
    return false;
  },

  // --- CHARACTERS ---
  getCharacter: (gameId, username) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    return characters[charKey] || null;
  },

  createCharacter: (gameId, username, charData) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    
    characters[charKey] = {
      gameId,
      username,
      name: charData.name.trim(),
      race: charData.race,
      class: charData.class,
      level: 1,
      hpMax: charData.hpMax || 10,
      hpCurrent: charData.hpMax || 10,
      stats: {
        str: charData.stats.str || 10,
        dex: charData.stats.dex || 10,
        con: charData.stats.con || 10,
        int: charData.stats.int || 10,
        wis: charData.stats.wis || 10,
        cha: charData.stats.cha || 10
      },
      gold: {
        gp: charData.gold.gp || 50,
        sp: charData.gold.sp || 0,
        cp: charData.gold.cp || 0
      },
      inventory: [],
      createdAt: new Date().toISOString()
    };
    
    write(KEYS.CHARACTERS, characters);
    db.addLog(gameId, "System", `Player ${username} created character ${charData.name} (${charData.race} ${charData.class}).`);
    return characters[charKey];
  },

  updateCharacter: (gameId, username, charUpdates) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    if (characters[charKey]) {
      characters[charKey] = { ...characters[charKey], ...charUpdates };
      write(KEYS.CHARACTERS, characters);
      return characters[charKey];
    }
    return null;
  },

  deleteCharacter: (gameId, username) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    if (characters[charKey]) {
      const charName = characters[charKey].name;
      delete characters[charKey];
      write(KEYS.CHARACTERS, characters);
      db.addLog(gameId, "System", `Player ${username} (character ${charName}) was removed from the campaign by the Dungeon Master.`);
      return true;
    }
    return false;
  },

  getAllCharactersInGame: (gameId) => {
    const characters = read(KEYS.CHARACTERS, {});
    return Object.values(characters).filter(char => char.gameId === gameId);
  },

  // Buy item action
  buyItem: (gameId, username, itemToBuy) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    const character = characters[charKey];
    const games = read(KEYS.GAMES, {});
    const game = games[gameId];

    if (!character) return { success: false, error: "Character not found" };
    if (!game) return { success: false, error: "Campaign not found" };

    // Find the item in the store
    const storeItems = [...game.store];
    const storeItemIndex = storeItems.findIndex(i => i.id === itemToBuy.id);
    if (storeItemIndex === -1) return { success: false, error: "Item is not in the store" };
    
    const storeItem = storeItems[storeItemIndex];
    if (storeItem.stock !== null && storeItem.stock <= 0) {
      return { success: false, error: "Item is out of stock" };
    }

    // Convert total gold to GP decimals for comparison, or perform explicit math
    // 1 gp = 10 sp = 100 cp
    const charTotalInGp = character.gold.gp + (character.gold.sp / 10) + (character.gold.cp / 100);
    const itemCostInGp = storeItem.currency === "sp" ? storeItem.cost / 10 : (storeItem.currency === "cp" ? storeItem.cost / 100 : storeItem.cost);

    if (charTotalInGp < itemCostInGp) {
      return { success: false, error: "Insufficient funds" };
    }

    // Deduct funds (standard subtraction)
    // Convert to Copper, subtract, convert back to minimize rounding issues
    let charCopper = (character.gold.gp * 100) + (character.gold.sp * 10) + character.gold.cp;
    const costCopper = Math.round(itemCostInGp * 100);
    charCopper -= costCopper;

    const newGp = Math.floor(charCopper / 100);
    charCopper %= 100;
    const newSp = Math.floor(charCopper / 10);
    const newCp = charCopper % 10;

    character.gold = { gp: newGp, sp: newSp, cp: newCp };

    // Add to player inventory
    const existingInvIndex = character.inventory.findIndex(i => i.id === itemToBuy.id);
    if (existingInvIndex !== -1) {
      character.inventory[existingInvIndex].quantity = (character.inventory[existingInvIndex].quantity || 1) + 1;
    } else {
      character.inventory.push({
        ...storeItem,
        quantity: 1,
        equipped: false
      });
    }

    // Decrease store stock
    if (storeItem.stock !== null && storeItem.stock > 0) {
      storeItem.stock -= 1;
    }

    // Save changes
    games[gameId].store = storeItems;
    write(KEYS.GAMES, games);

    characters[charKey] = character;
    write(KEYS.CHARACTERS, characters);

    db.addLog(gameId, character.name, `Bought ${storeItem.name} for ${storeItem.cost} ${storeItem.currency.toUpperCase()}.`);

    return { success: true, character, store: storeItems };
  },

  // Equip item action
  toggleEquipItem: (gameId, username, itemId) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    const character = characters[charKey];

    if (!character) return { success: false, error: "Character not found" };

    const item = character.inventory.find(i => i.id === itemId);
    if (!item) return { success: false, error: "Item not in inventory" };

    const wasEquipped = !!item.equipped;

    if (!wasEquipped) {
      // Check Attunement Limit
      if (item.requiresAttunement) {
        const attunedEquipped = character.inventory.filter(i => i.equipped && i.requiresAttunement).length;
        const limit = db.getAttunementLimit(character.class, character.level);
        if (attunedEquipped >= limit) {
          return { 
            success: false, 
            error: `Cannot attune ${item.name}. Attunement Limit of ${limit} reached. Unequip another attuned item first.` 
          };
        }
      }

      // Determine target slot
      let slot = null;
      if (item.category === "Armor") {
        slot = "armor";
      } else if (item.category === "Weapon") {
        slot = "mainHand";
      } else if (item.category === "Shield") {
        slot = "offHand";
      } else if (item.category === "Wondrous Item" || item.category === "Accessory") {
        // Find the first empty accessory slot out of accessory1..accessory5
        const slotsUsed = character.inventory
          .filter(i => i.equipped && i.equippedSlot && i.equippedSlot.startsWith("accessory"))
          .map(i => i.equippedSlot);
        const availableSlots = ["accessory1", "accessory2", "accessory3", "accessory4", "accessory5"];
        const freeSlot = availableSlots.find(s => !slotsUsed.includes(s));
        if (!freeSlot) {
          return { success: false, error: "All 5 Accessory slots are full. Unequip an accessory first." };
        }
        slot = freeSlot;
      }

      if (!slot) {
        return { success: false, error: `This item category (${item.category}) cannot be equipped to a slot.` };
      }

      // Check Two-Handed constraints
      if (slot === "offHand") {
        // Find if they have a two-handed weapon in mainHand
        const mainHandWeapon = character.inventory.find(i => i.equipped && (i.equippedSlot === "mainHand" || (!i.equippedSlot && i.category === "Weapon")));
        const isTwoHanded = mainHandWeapon?.stats?.properties?.includes("Two-Handed") || mainHandWeapon?.description?.toLowerCase().includes("two-handed");
        if (isTwoHanded) {
          return { success: false, error: `Cannot equip ${item.name} while wielding a two-handed weapon (${mainHandWeapon.name}).` };
        }
      }

      if (slot === "mainHand") {
        const isTwoHanded = item.stats?.properties?.includes("Two-Handed") || item.description?.toLowerCase().includes("two-handed");
        if (isTwoHanded) {
          // Force unequip anything in offHand
          character.inventory.forEach(i => {
            const isOffHand = i.equippedSlot === "offHand" || (!i.equippedSlot && i.category === "Shield");
            if (i.equipped && isOffHand) {
              i.equipped = false;
              i.equippedSlot = null;
              db.addLog(gameId, character.name, `Unequipped ${i.name} to hold two-handed weapon ${item.name}.`);
            }
          });
        }
      }

      // Unequip any item currently in that target slot (with fallback for legacy equipped items)
      if (slot === "armor" || slot === "mainHand" || slot === "offHand") {
        character.inventory.forEach(i => {
          const isSameSlot = i.equippedSlot === slot || (!i.equippedSlot && (
            (slot === 'armor' && i.category === 'Armor') ||
            (slot === 'mainHand' && i.category === 'Weapon') ||
            (slot === 'offHand' && i.category === 'Shield')
          ));

          if (i.equipped && isSameSlot) {
            i.equipped = false;
            i.equippedSlot = null;
          }
        });
      }

      // Equip the item
      item.equipped = true;
      item.equippedSlot = slot;
    } else {
      // Unequip
      item.equipped = false;
      item.equippedSlot = null;
    }

    characters[charKey] = character;
    write(KEYS.CHARACTERS, characters);

    db.addLog(gameId, character.name, `${item.equipped ? 'Equipped' : 'Unequipped'} ${item.name}.${item.requiresAttunement && item.equipped ? ' (Attuned)' : ''}`);

    return { success: true, character };
  },

  // Sell/Discard item action
  discardItem: (gameId, username, itemId) => {
    const characters = read(KEYS.CHARACTERS, {});
    const charKey = `${gameId}_${username.toLowerCase()}`;
    const character = characters[charKey];

    if (!character) return { success: false, error: "Character not found" };

    const itemIndex = character.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return { success: false, error: "Item not in inventory" };

    const item = character.inventory[itemIndex];
    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      character.inventory.splice(itemIndex, 1);
    }

    characters[charKey] = character;
    write(KEYS.CHARACTERS, characters);

    db.addLog(gameId, character.name, `Discarded one ${item.name} from inventory.`);

    return { success: true, character };
  },

  // --- LOGGING ---
  getLogs: (gameId) => {
    const logs = read(KEYS.LOGS, {});
    return logs[gameId] || [];
  },

  addLog: (gameId, sender, message) => {
    const logs = read(KEYS.LOGS, {});
    if (!logs[gameId]) logs[gameId] = [];
    
    logs[gameId].push({
      timestamp: new Date().toLocaleTimeString(),
      sender,
      message
    });
    
    // Limit log size to last 100 entries
    if (logs[gameId].length > 100) {
      logs[gameId] = logs[gameId].slice(-100);
    }
    
    write(KEYS.LOGS, logs);
    
    // Custom event to notify active views
    window.dispatchEvent(new CustomEvent('emporium_db_log', { detail: { gameId } }));
  }
};
