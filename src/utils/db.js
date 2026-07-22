// Client database API wrapper connecting to the Docker Express backend database
const KEYS = {
  CURRENT_USER: 'emporium_current_user'
};

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Fetch helper wrapper with JSON parsing and custom error propagation
const request = async (path, options = {}) => {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP error ${res.status}`);
  }
  return res.json();
};

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
  register: async (username, password) => {
    try {
      const res = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (res.success) {
        localStorage.setItem(KEYS.CURRENT_USER, username.trim());
        return { success: true, username: username.trim() };
      }
      return { success: false, error: 'Registration failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  login: async (username, password) => {
    try {
      const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      if (res.success) {
        localStorage.setItem(KEYS.CURRENT_USER, res.username);
        return { success: true, username: res.username };
      }
      return { success: false, error: 'Login failed' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  logout: () => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },

  getCurrentUser: () => {
    return localStorage.getItem(KEYS.CURRENT_USER) || null;
  },

  // --- GAMES (CAMPAIGNS) ---
  getGames: async () => {
    return request('/games');
  },

  createGame: async (name, description, dmUsername) => {
    return request('/games', {
      method: 'POST',
      body: JSON.stringify({ name, description, dmUsername })
    });
  },

  joinGame: async (gameId, username) => {
    try {
      return await request(`/games/${gameId}/join`, {
        method: 'POST',
        body: JSON.stringify({ username })
      });
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  getGame: async (gameId) => {
    return request(`/games/${gameId}`);
  },

  updateGameStore: async (gameId, storeItems) => {
    return request(`/games/${gameId}/store`, {
      method: 'PUT',
      body: JSON.stringify({ store: storeItems })
    });
  },

  updateGameTravel: async (gameId, travelData) => {
    return request(`/games/${gameId}/travel`, {
      method: 'PUT',
      body: JSON.stringify({
        partyLocation: travelData.partyLocation,
        travelState: travelData.travelState
      })
    });
  },

  // --- CHARACTERS ---
  getCharacter: async (gameId, username) => {
    return request(`/games/${gameId}/characters/${username}`);
  },

  createCharacter: async (gameId, username, charData) => {
    const payload = {
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
      inventory: []
    };
    await request(`/games/${gameId}/characters`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    await db.addLog(gameId, "System", `Player ${username} created character ${charData.name} (${charData.race} ${charData.class}).`);
    return payload;
  },

  updateCharacter: async (gameId, username, charUpdates) => {
    return request(`/games/${gameId}/characters/${username}`, {
      method: 'PUT',
      body: JSON.stringify(charUpdates)
    });
  },

  deleteCharacter: async (gameId, username) => {
    try {
      const char = await db.getCharacter(gameId, username);
      const charName = char ? char.name : username;
      await request(`/games/${gameId}/characters/${username}`, {
        method: 'DELETE'
      });
      await db.addLog(gameId, "System", `Player ${username} (character ${charName}) was removed from the campaign by the Dungeon Master.`);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  getAllCharactersInGame: async (gameId) => {
    return request(`/games/${gameId}/characters`);
  },

  // Buy item action
  buyItem: async (gameId, username, itemToBuy) => {
    const character = await db.getCharacter(gameId, username);
    const game = await db.getGame(gameId);

    if (!character) return { success: false, error: "Character not found" };
    if (!game) return { success: false, error: "Campaign not found" };

    const storeItems = [...game.store];
    const storeItemIndex = storeItems.findIndex(i => i.id === itemToBuy.id);
    if (storeItemIndex === -1) return { success: false, error: "Item is not in the store" };

    const storeItem = storeItems[storeItemIndex];
    if (storeItem.stock !== null && storeItem.stock <= 0) {
      return { success: false, error: "Item is out of stock" };
    }

    const charTotalInGp = character.gold.gp + (character.gold.sp / 10) + (character.gold.cp / 100);
    const itemCostInGp = storeItem.currency === "sp" ? storeItem.cost / 10 : (storeItem.currency === "cp" ? storeItem.cost / 100 : storeItem.cost);

    if (charTotalInGp < itemCostInGp) {
      return { success: false, error: "Insufficient funds" };
    }

    let charCopper = (character.gold.gp * 100) + (character.gold.sp * 10) + character.gold.cp;
    const costCopper = Math.round(itemCostInGp * 100);
    charCopper -= costCopper;

    const newGp = Math.floor(charCopper / 100);
    charCopper %= 100;
    const newSp = Math.floor(charCopper / 10);
    const newCp = charCopper % 10;

    character.gold = { gp: newGp, sp: newSp, cp: newCp };

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

    if (storeItem.stock !== null && storeItem.stock > 0) {
      storeItem.stock -= 1;
    }

    await db.updateGameStore(gameId, storeItems);
    await db.updateCharacter(gameId, username, character);
    await db.addLog(gameId, character.name, `Bought ${storeItem.name} for ${storeItem.cost} ${storeItem.currency.toUpperCase()}.`);

    return { success: true, character, store: storeItems };
  },

  buyItemFromShop: async (gameId, username, shopId, itemId) => {
    const character = await db.getCharacter(gameId, username);
    const game = await db.getGame(gameId);

    if (!character) return { success: false, error: "Character not found" };
    if (!game) return { success: false, error: "Campaign not found" };

    const shops = game.shops || [];
    const shopIndex = shops.findIndex(s => s.id === shopId);
    if (shopIndex === -1) return { success: false, error: "Shop not found" };
    const shop = shops[shopIndex];
    if (!shop.enabled) return { success: false, error: "Shop is currently closed" };

    const itemIndex = shop.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return { success: false, error: "Item is not in this shop" };
    const storeItem = shop.inventory[itemIndex];

    if (storeItem.stock !== null && storeItem.stock <= 0) {
      return { success: false, error: "Item is out of stock" };
    }

    const charTotalInGp = character.gold.gp + (character.gold.sp / 10) + (character.gold.cp / 100);
    const itemCostInGp = storeItem.currency === "sp" ? storeItem.cost / 10 : (storeItem.currency === "cp" ? storeItem.cost / 100 : storeItem.cost);

    if (charTotalInGp < itemCostInGp) {
      return { success: false, error: "Insufficient funds" };
    }

    let charCopper = (character.gold.gp * 100) + (character.gold.sp * 10) + character.gold.cp;
    const costCopper = Math.round(itemCostInGp * 100);
    charCopper -= costCopper;

    const newGp = Math.floor(charCopper / 100);
    charCopper %= 100;
    const newSp = Math.floor(charCopper / 10);
    const newCp = charCopper % 10;

    character.gold = { gp: newGp, sp: newSp, cp: newCp };

    const newBoughtId = `${itemId}_bought_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const existingInvIndex = character.inventory.findIndex(i => i.name === storeItem.name);
    if (existingInvIndex !== -1) {
      character.inventory[existingInvIndex].quantity = (character.inventory[existingInvIndex].quantity || 1) + 1;
    } else {
      character.inventory.push({
        ...storeItem,
        id: newBoughtId,
        quantity: 1,
        equipped: false
      });
    }

    if (storeItem.stock !== null && storeItem.stock > 0) {
      storeItem.stock -= 1;
    }

    await db.updateGameShops(gameId, shops);
    await db.updateCharacter(gameId, username, character);
    await db.addLog(gameId, character.name, `Bought ${storeItem.name} for ${storeItem.cost} ${storeItem.currency.toUpperCase()} from "${shop.name}".`);

    return { success: true, character, shops };
  },

  updateGameShops: async (gameId, shops) => {
    return request(`/games/${gameId}/shops`, {
      method: 'PUT',
      body: JSON.stringify({ shops })
    });
  },

  updateGameLocations: async (gameId, locations) => {
    return request(`/games/${gameId}/locations`, {
      method: 'PUT',
      body: JSON.stringify({ locations })
    });
  },

  updateGameMapUrl: async (gameId, mapUrl) => {
    return request(`/games/${gameId}/map-url`, {
      method: 'PUT',
      body: JSON.stringify({ mapUrl })
    });
  },

  // Equip item action
  toggleEquipItem: async (gameId, username, itemId) => {
    const character = await db.getCharacter(gameId, username);
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
        const mainHandWeapon = character.inventory.find(i => i.equipped && (i.equippedSlot === "mainHand" || (!i.equippedSlot && i.category === "Weapon")));
        const isTwoHanded = mainHandWeapon?.stats?.properties?.includes("Two-Handed") || mainHandWeapon?.description?.toLowerCase().includes("two-handed");
        if (isTwoHanded) {
          return { success: false, error: `Cannot equip ${item.name} while wielding a two-handed weapon (${mainHandWeapon.name}).` };
        }
      }

      if (slot === "mainHand") {
        const isTwoHanded = item.stats?.properties?.includes("Two-Handed") || item.description?.toLowerCase().includes("two-handed");
        if (isTwoHanded) {
          for (const i of character.inventory) {
            const isOffHand = i.equippedSlot === "offHand" || (!i.equippedSlot && i.category === "Shield");
            if (i.equipped && isOffHand) {
              i.equipped = false;
              i.equippedSlot = null;
              await db.addLog(gameId, character.name, `Unequipped ${i.name} to hold two-handed weapon ${item.name}.`);
            }
          }
        }
      }

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

      item.equipped = true;
      item.equippedSlot = slot;
    } else {
      item.equipped = false;
      item.equippedSlot = null;
    }

    await db.updateCharacter(gameId, username, character);
    await db.addLog(gameId, character.name, `${item.equipped ? 'Equipped' : 'Unequipped'} ${item.name}.${item.requiresAttunement && item.equipped ? ' (Attuned)' : ''}`);

    return { success: true, character };
  },

  // Sell/Discard item action
  discardItem: async (gameId, username, itemId) => {
    const character = await db.getCharacter(gameId, username);
    if (!character) return { success: false, error: "Character not found" };

    const itemIndex = character.inventory.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return { success: false, error: "Item not in inventory" };

    const item = character.inventory[itemIndex];
    if (item.quantity > 1) {
      item.quantity -= 1;
    } else {
      character.inventory.splice(itemIndex, 1);
    }

    await db.updateCharacter(gameId, username, character);
    await db.addLog(gameId, character.name, `Discarded one ${item.name} from inventory.`);

    return { success: true, character };
  },

  // --- LOGGING ---
  getLogs: async (gameId) => {
    return request(`/games/${gameId}/logs`);
  },

  addLog: async (gameId, sender, message) => {
    const res = await request(`/games/${gameId}/logs`, {
      method: 'POST',
      body: JSON.stringify({ sender, message })
    });
    
    // Dispatch local custom event to notify React view instances in same browser session
    window.dispatchEvent(new CustomEvent('emporium_db_log', { detail: { gameId } }));
    return res;
  }
};
