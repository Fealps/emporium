import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { srdItems } from '../utils/srdItems';
import fantasyMap from '../assets/fantasymap.png';

export default function DMPanel({ gameId, username, onBackToDashboard }) {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('store'); // 'store' | 'map' | 'players' | 'logs'

  // Store forms
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Weapon');
  const [newItemRarity, setNewItemRarity] = useState('Common');
  const [newItemCost, setNewItemCost] = useState(10);
  const [newItemCurrency, setNewItemCurrency] = useState('gp');
  const [newItemWeight, setNewItemWeight] = useState(1);
  const [newItemStock, setNewItemStock] = useState(5);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [storeError, setStoreError] = useState('');
  const [csvError, setCsvError] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('All');

  // Shops Manager states
  const [newShopName, setNewShopName] = useState('');
  const [newShopDesc, setNewShopDesc] = useState('');
  const [expandedShopId, setExpandedShopId] = useState(null);
  const [shopStockItemSelect, setShopStockItemSelect] = useState('');
  const [shopStockQty, setShopStockQty] = useState(5);
  const [shopStockUnlimited, setShopStockUnlimited] = useState(false);

  // Map travel settings
  const [selectedTravelTarget, setSelectedTravelTarget] = useState('');
  const [travelDuration, setTravelDuration] = useState(30); // travel duration in seconds

  // Map customization states
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocX, setNewLocX] = useState(null);
  const [newLocY, setNewLocY] = useState(null);

  // Selected and edited landmark states for DM
  const [selectedDMLocId, setSelectedDMLocId] = useState(null);
  const [isEditingLandmark, setIsEditingLandmark] = useState(false);
  const [editLocName, setEditLocName] = useState('');
  const [editLocDesc, setEditLocDesc] = useState('');

  // Player manual editing
  const [editingPlayerKey, setEditingPlayerKey] = useState(''); // player username
  const [editHp, setEditHp] = useState(0);
  const [editGoldGp, setEditGoldGp] = useState(0);
  const [editLevel, setEditLevel] = useState(1);

  // Reload campaign state
  const reloadState = async () => {
    try {
      const g = await db.getGame(gameId);
      setGame(g);
      const chars = await db.getAllCharactersInGame(gameId);
      setPlayers(chars);
      const logsList = await db.getLogs(gameId);
      setLogs(logsList);
    } catch (e) {
      console.error("Failed to reload campaign state:", e);
    }
  };

  const getFilteredStoreItems = () => {
    if (!game) return [];
    return game.store.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(storeSearch.toLowerCase()));
      const matchesCategory = storeCategoryFilter === 'All' || item.category === storeCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  };

  useEffect(() => {
    reloadState();

    // Listen for storage events or custom logs
    const handleLogEvent = () => reloadState();
    window.addEventListener('emporium_db_log', handleLogEvent);

    // Interval for travel ticks
    const timer = setInterval(() => {
      const checkTravel = async () => {
        const g = await db.getGame(gameId);
        if (g && g.travelState) {
          const now = Date.now();
          const elapsed = now - g.travelState.startTime;
          if (elapsed >= g.travelState.durationMs) {
            // Travel completed!
            const targetLoc = g.locations.find(l => l.id === g.travelState.to);
            await db.updateGameTravel(gameId, {
              partyLocation: g.travelState.to,
              travelState: null
            });
            await db.addLog(gameId, "Dungeon Master", `The party has successfully arrived at ${targetLoc ? targetLoc.name : 'their destination'}.`);
            await reloadState();
          }
        }
      };
      checkTravel();
    }, 1000);

    return () => {
      window.removeEventListener('emporium_db_log', handleLogEvent);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (!game) return <div className="text-center py-10 font-fantasy text-gold">Loading campaign vault...</div>;

  // Store operations
  const handleAddItem = async (e) => {
    e.preventDefault();
    setStoreError('');
    if (!newItemName.trim()) {
      setStoreError("Item name is required.");
      return;
    }

    const item = {
      id: "item_" + Math.floor(1000 + Math.random() * 9000),
      name: newItemName.trim(),
      category: newItemCategory,
      rarity: newItemRarity,
      cost: Number(newItemCost),
      currency: newItemCurrency,
      weight: Number(newItemWeight),
      stock: newItemStock === '' ? null : Number(newItemStock),
      description: newItemDesc.trim(),
      stats: {}
    };

    const updatedStore = [...game.store, item];
    try {
      await db.updateGameStore(gameId, updatedStore);
      await db.addLog(gameId, "Dungeon Master", `Added custom item "${item.name}" to the store.`);
      setNewItemName('');
      setNewItemDesc('');
      await reloadState();
    } catch (err) {
      setStoreError(err.message);
    }
  };

  const handleImportSRDPack = async (categoryFilter) => {
    let itemsToImport = srdItems;
    if (categoryFilter) {
      itemsToImport = srdItems.filter(i => i.category === categoryFilter);
    }

    const currentStore = [...game.store];
    itemsToImport.forEach(item => {
      if (!currentStore.some(i => i.id === item.id)) {
        currentStore.push({ ...item });
      }
    });

    try {
      await db.updateGameStore(gameId, currentStore);
      await db.addLog(gameId, "Dungeon Master", `Imported ${categoryFilter ? categoryFilter : 'all standard'} 5e items into the shop catalogue.`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearStore = async () => {
    if (window.confirm("Are you sure you want to empty the shop inventory?")) {
      try {
        await db.updateGameStore(gameId, []);
        await db.addLog(gameId, "Dungeon Master", "Cleared all items from the store.");
        await reloadState();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleRemoveStoreItem = async (itemId, itemName) => {
    const updatedStore = game.store.filter(i => i.id !== itemId);
    try {
      await db.updateGameStore(gameId, updatedStore);
      await db.addLog(gameId, "Dungeon Master", `Removed "${itemName}" from the store.`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvError('');
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          setCsvError("CSV file is empty or missing headers.");
          return;
        }

        const parseRow = (rowText) => {
          let p = '', c = '', r = [];
          let q = false;
          for (let i = 0; i < rowText.length; i++) {
            c = rowText[i];
            if (c === '"') {
              q = !q;
            } else if (c === ',' && !q) {
              r.push(p.trim());
              p = '';
            } else {
              p += c;
            }
          }
          r.push(p.trim());
          return r;
        };

        // Normalize headers, stripping Byte Order Mark (\ufeff) and spaces
        const cleanHeader = (h) => {
          if (!h) return '';
          return h.replace(/^\ufeff/, '').trim().toLowerCase();
        };

        const headers = parseRow(lines[0]).map(cleanHeader);
        const idxName = headers.findIndex(h => h === 'name');
        const idxType = headers.findIndex(h => h === 'type');
        const idxRarity = headers.findIndex(h => h === 'rarity');
        const idxAttunement = headers.findIndex(h => h === 'attunement');
        const idxWeight = headers.findIndex(h => h === 'weight');
        const idxNotes = headers.findIndex(h => h === 'notes');
        const idxValue = headers.findIndex(h => h === 'value');

        if (idxName === -1 || idxType === -1 || idxRarity === -1) {
          setCsvError("CSV missing required headers (Name, Type, Rarity). Found: " + headers.filter(Boolean).join(', '));
          return;
        }

        const importedItems = [];
        let count = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = parseRow(line);
          if (cols.length < 3 || !cols[idxName]) continue;

          const name = cols[idxName];
          const typeStr = cols[idxType] || '';
          const rarityRaw = cols[idxRarity] || 'Mundane';
          const attunementStr = idxAttunement !== -1 ? cols[idxAttunement] : '';
          const weightStr = idxWeight !== -1 ? cols[idxWeight] : '';
          const notesStr = idxNotes !== -1 ? cols[idxNotes] : '';
          const valueStr = idxValue !== -1 ? cols[idxValue] : '';

          let category = 'Wondrous Item';
          const lowerType = typeStr.toLowerCase();
          if (lowerType.includes('weapon')) {
            category = 'Weapon';
          } else if (lowerType.includes('shield')) {
            category = 'Shield';
          } else if (lowerType.includes('armor')) {
            category = 'Armor';
          } else if (lowerType.includes('ammunition') || lowerType.includes('consumable')) {
            category = 'Consumable';
          } else if (lowerType.includes('potion')) {
            category = 'Consumable';
          } else if (lowerType.includes('adventuring gear') || lowerType.includes('gear')) {
            category = 'Adventuring Gear';
          }

          let rarity = 'Common';
          const lowerRarity = rarityRaw.toLowerCase();
          if (lowerRarity.includes('uncommon')) rarity = 'Uncommon';
          else if (lowerRarity.includes('very rare')) rarity = 'Very Rare';
          else if (lowerRarity.includes('rare')) rarity = 'Rare';
          else if (lowerRarity.includes('legendary')) rarity = 'Legendary';
          else if (lowerRarity.includes('artifact')) rarity = 'Legendary';
          else if (lowerRarity.includes('mundane') || lowerRarity.includes('common')) rarity = 'Common';

          const requiresAttunement = attunementStr && (attunementStr.includes('×') || attunementStr.includes('x') || attunementStr.toLowerCase().includes('yes') || attunementStr.trim() !== '');

          const parseWeightVal = (str) => {
            if (!str || str === '—' || str === '-') return 0;
            let val = str.toLowerCase().replace(/\s/g, '').replace('lb.', '').replace('lb', '').replace('oz.', '').replace('oz', '');
            let fraction = 0;
            if (val.includes('½')) {
              fraction = 0.5;
              val = val.replace('½', '') || '0';
            } else if (val.includes('¼')) {
              fraction = 0.25;
              val = val.replace('¼', '') || '0';
            }
            const base = parseFloat(val) || 0;
            return base + fraction;
          };
          const weight = parseWeightVal(weightStr);

          const parseCostVal = (str) => {
            if (!str || str === '—' || str === '-' || str.trim() === '') return { cost: 0, currency: 'gp' };
            const clean = str.toLowerCase().replace(/\s/g, '');
            let currency = 'gp';
            if (clean.endsWith('sp')) currency = 'sp';
            else if (clean.endsWith('cp')) currency = 'cp';
            else if (clean.endsWith('gp')) currency = 'gp';

            let numPart = clean.replace(/(gp|sp|cp)/g, '');

            if (numPart.includes('½')) {
              numPart = numPart.replace('½', '') || '0';
              return { cost: (parseFloat(numPart) || 0) + 0.5, currency };
            }
            if (/\d\.\d{3}$/.test(numPart)) {
              numPart = numPart.replace('.', '');
            }
            numPart = numPart.replace(',', '.');
            const cost = parseFloat(numPart) || 0;
            return { cost, currency };
          };
          const { cost, currency } = parseCostVal(valueStr);

          let description = typeStr;
          if (requiresAttunement) description += " (Requires Attunement)";
          if (notesStr) description += `. Notes: ${notesStr}`;

          const item = {
            id: "csv_" + Math.floor(10000 + Math.random() * 90000) + "_" + count,
            name: name.trim(),
            category,
            rarity,
            requiresAttunement: !!requiresAttunement,
            cost,
            currency,
            weight,
            stock: null,
            description,
            stats: {}
          };

          importedItems.push(item);
          count++;
        }

        if (importedItems.length === 0) {
          setCsvError("No items could be parsed from the CSV.");
          return;
        }

        const currentStore = [...game.store];
        importedItems.forEach(item => {
          if (!currentStore.some(i => i.name.toLowerCase() === item.name.toLowerCase())) {
            currentStore.push(item);
          }
        });

        try {
          await db.updateGameStore(gameId, currentStore);
          await db.addLog(gameId, "Dungeon Master", `Imported ${importedItems.length} items from CSV catalog.`);
          await reloadState();
          e.target.value = null;
        } catch (err) {
          console.error("Failed to parse CSV:", err);
          setCsvError("Failed to parse CSV. Ensure correct format.");
        }
      };
      reader.readAsText(file);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStock = async (itemId, change) => {
    const updatedStore = game.store.map(i => {
      if (i.id === itemId) {
        const currentStock = i.stock === null ? 0 : i.stock;
        const newStock = Math.max(0, currentStock + change);
        return { ...i, stock: i.stock === null ? null : newStock };
      }
      return i;
    });
    try {
      await db.updateGameStore(gameId, updatedStore);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  // Travel operations
  const handleStartTravel = async () => {
    if (!selectedTravelTarget) return;
    if (selectedTravelTarget === game.partyLocation) return;

    const fromLoc = game.locations.find(l => l.id === game.partyLocation);
    const toLoc = game.locations.find(l => l.id === selectedTravelTarget);

    const travelState = {
      from: game.partyLocation,
      to: selectedTravelTarget,
      startTime: Date.now(),
      durationMs: travelDuration * 1000
    };

    try {
      await db.updateGameTravel(gameId, {
        partyLocation: game.partyLocation,
        travelState
      });
      await db.addLog(gameId, "Dungeon Master", `The party began traveling from ${fromLoc.name} to ${toLoc.name} (Estimated time: ${travelDuration}s).`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelTravel = async () => {
    try {
      await db.updateGameTravel(gameId, {
        partyLocation: game.partyLocation,
        travelState: null
      });
      await db.addLog(gameId, "Dungeon Master", `Aborted travel progress. Party remained at current location.`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  // Player manual editing operations
  const startEditingPlayer = (player) => {
    setEditingPlayerKey(player.username);
    setEditHp(player.hpCurrent);
    setEditLevel(player.level);
    setEditGoldGp(player.gold.gp);
  };

  const savePlayerEdits = async () => {
    const player = players.find(p => p.username === editingPlayerKey);
    if (!player) return;

    const updatedStats = {
      ...player,
      level: Number(editLevel),
      hpCurrent: Math.min(player.hpMax, Math.max(0, Number(editHp))),
      gold: {
        ...player.gold,
        gp: Math.max(0, Number(editGoldGp))
      }
    };

    try {
      await db.updateCharacter(gameId, editingPlayerKey, updatedStats);
      await db.addLog(gameId, "Dungeon Master", `Manually updated stats for player character ${player.name}.`);
      setEditingPlayerKey('');
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGiveItem = async (playerUsername, storeItem) => {
    try {
      const character = await db.getCharacter(gameId, playerUsername);
      if (!character) return;

      const existingIndex = character.inventory.findIndex(i => i.name.toLowerCase() === storeItem.name.toLowerCase());
      if (existingIndex !== -1) {
        character.inventory[existingIndex].quantity += 1;
      } else {
        character.inventory.push({
          ...storeItem,
          id: "dm_gift_" + Math.floor(1000 + Math.random() * 9000),
          quantity: 1,
          equipped: false,
          equippedSlot: null
        });
      }

      await db.updateCharacter(gameId, playerUsername, character);
      await db.addLog(gameId, "Dungeon Master", `Granted "${storeItem.name}" to ${character.name}'s inventory.`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemovePlayerItem = async (playerUsername, itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to remove "${itemName}" from this player's inventory?`)) return;
    try {
      const character = await db.getCharacter(gameId, playerUsername);
      if (!character) return;

      character.inventory = character.inventory.filter(i => i.id !== itemId);
      await db.updateCharacter(gameId, playerUsername, character);
      await db.addLog(gameId, "Dungeon Master", `Removed "${itemName}" from ${character.name}'s inventory.`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleTogglePlayerItemEquip = async (playerUsername, itemId) => {
    try {
      const res = await db.toggleEquipItem(gameId, playerUsername, itemId);
      if (!res.success) {
        alert(`Failed to equip/unequip: ${res.error}`);
      } else {
        await reloadState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemovePlayer = async (playerUsername, charName) => {
    if (!window.confirm(`Are you sure you want to kick and delete the character "${charName}" (played by ${playerUsername}) from this campaign?`)) return;
    try {
      const res = await db.deleteCharacter(gameId, playerUsername);
      if (res) {
        await reloadState();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Shops Manager operations
  const handleCreateShop = async (e) => {
    e.preventDefault();
    if (!newShopName.trim()) return;

    const currentShops = [...(game.shops || [])];
    const newShop = {
      id: "shop_" + Math.random().toString(36).substr(2, 9),
      name: newShopName.trim(),
      description: newShopDesc.trim(),
      enabled: true,
      inventory: []
    };

    currentShops.push(newShop);
    try {
      await db.updateGameShops(gameId, currentShops);
      await db.addLog(gameId, "Dungeon Master", `Established new shop: "${newShop.name}".`);
      setNewShopName('');
      setNewShopDesc('');
      await reloadState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleShopEnabled = async (shopId) => {
    const currentShops = (game.shops || []).map(shop => {
      if (shop.id === shopId) {
        const newStatus = !shop.enabled;
        return { ...shop, enabled: newStatus };
      }
      return shop;
    });

    const targetShop = game.shops.find(s => s.id === shopId);
    const newStatus = targetShop ? !targetShop.enabled : false;

    try {
      await db.updateGameShops(gameId, currentShops);
      if (targetShop) {
        await db.addLog(gameId, "Dungeon Master", `${newStatus ? 'Opened' : 'Closed'} shop "${targetShop.name}" for players.`);
      }
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteShop = async (shopId, shopName) => {
    if (!window.confirm(`Are you sure you want to shut down and delete "${shopName}"?`)) return;
    const currentShops = (game.shops || []).filter(shop => shop.id !== shopId);

    try {
      await db.updateGameShops(gameId, currentShops);
      await db.addLog(gameId, "Dungeon Master", `Disbanded shop "${shopName}".`);
      if (expandedShopId === shopId) {
        setExpandedShopId(null);
      }
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStockToShop = async (shopId) => {
    if (!shopStockItemSelect) return;
    const catalogItem = game.store.find(item => item.id === shopStockItemSelect);
    if (!catalogItem) return;

    let targetShopName = '';
    const currentShops = (game.shops || []).map(shop => {
      if (shop.id === shopId) {
        targetShopName = shop.name;
        const existingItemIndex = shop.inventory.findIndex(i => i.name.toLowerCase() === catalogItem.name.toLowerCase());
        const updatedInventory = [...shop.inventory];

        if (existingItemIndex !== -1) {
          updatedInventory[existingItemIndex].stock = shopStockUnlimited ? null : (updatedInventory[existingItemIndex].stock || 0) + shopStockQty;
        } else {
          updatedInventory.push({
            ...catalogItem,
            id: `shop_item_${Math.floor(1000 + Math.random() * 9000)}`,
            catalogItemId: catalogItem.id,
            stock: shopStockUnlimited ? null : shopStockQty
          });
        }
        return { ...shop, inventory: updatedInventory };
      }
      return shop;
    });

    try {
      await db.updateGameShops(gameId, currentShops);
      await db.addLog(gameId, "Dungeon Master", `Stocked ${catalogItem.name} in "${targetShopName}".`);
      setShopStockItemSelect('');
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveStockFromShop = async (shopId, itemId, itemName) => {
    let targetShopName = '';
    const currentShops = (game.shops || []).map(shop => {
      if (shop.id === shopId) {
        targetShopName = shop.name;
        const updatedInventory = shop.inventory.filter(i => i.id !== itemId);
        return { ...shop, inventory: updatedInventory };
      }
      return shop;
    });

    try {
      await db.updateGameShops(gameId, currentShops);
      await db.addLog(gameId, "Dungeon Master", `Removed ${itemName} from shop "${targetShopName}".`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateShopStockLevel = async (shopId, itemId, change) => {
    const currentShops = (game.shops || []).map(shop => {
      if (shop.id === shopId) {
        const updatedInventory = shop.inventory.map(item => {
          if (item.id === itemId) {
            const currentStock = item.stock === null ? 0 : item.stock;
            const newStock = Math.max(0, currentStock + change);
            return { ...item, stock: item.stock === null ? null : newStock };
          }
          return item;
        });
        return { ...shop, inventory: updatedInventory };
      }
      return shop;
    });

    try {
      await db.updateGameShops(gameId, currentShops);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  // Map customization handlers
  const handleMapUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      alert("Please upload a PNG file only.");
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      alert("Map image is too large! Please select a PNG under 1.5MB to ensure it fits in client database storage.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      try {
        await db.updateGameMapUrl(gameId, dataUrl);
        await db.addLog(gameId, "Dungeon Master", "Uploaded a new custom campaign PNG map layout.");
        await reloadState();
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetMap = async () => {
    if (window.confirm("Reset campaign map back to default Phandalin cartography?")) {
      try {
        await db.updateGameMapUrl(gameId, null);
        await db.addLog(gameId, "Dungeon Master", "Reset campaign map layout back to default.");
        await reloadState();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateLandmark = async (e) => {
    e.preventDefault();
    if (newLocX === null || newLocY === null || !newLocName.trim()) return;

    const currentLocs = [...(game.locations || [])];
    const newLoc = {
      id: "loc_" + Math.floor(1000 + Math.random() * 9000),
      name: newLocName.trim(),
      description: newLocDesc.trim(),
      x: newLocX,
      y: newLocY
    };

    currentLocs.push(newLoc);
    try {
      await db.updateGameLocations(gameId, currentLocs);
      await db.addLog(gameId, "Dungeon Master", `Placed new landmark "${newLoc.name}" at coordinates (X: ${newLocX}, Y: ${newLocY}).`);
      setNewLocName('');
      setNewLocDesc('');
      setNewLocX(null);
      setNewLocY(null);
      await reloadState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLocation = async (locId, locName) => {
    if (locId === "loc_start") {
      alert("Cannot delete Phandalin (the starting location).");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the landmark "${locName}"?`)) return;

    const updatedLocs = (game.locations || []).filter(l => l.id !== locId);
    let nextPartyLoc = game.partyLocation;
    let nextTravelState = game.travelState;

    if (game.partyLocation === locId) {
      nextPartyLoc = "loc_start";
    }
    if (game.travelState && (game.travelState.to === locId || game.travelState.from === locId)) {
      nextTravelState = null;
    }

    try {
      await db.updateGameLocations(gameId, updatedLocs);
      await db.updateGameTravel(gameId, {
        partyLocation: nextPartyLoc,
        travelState: nextTravelState
      });
      await db.addLog(gameId, "Dungeon Master", `Removed landmark "${locName}" from the map.`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveLandmarkEdits = async (e) => {
    e.preventDefault();
    if (!selectedDMLocId || !editLocName.trim()) return;

    const updatedLocs = (game.locations || []).map(loc => {
      if (loc.id === selectedDMLocId) {
        return {
          ...loc,
          name: editLocName.trim(),
          description: editLocDesc.trim()
        };
      }
      return loc;
    });

    try {
      await db.updateGameLocations(gameId, updatedLocs);
      await db.addLog(gameId, "Dungeon Master", `Updated details for landmark "${editLocName.trim()}".`);
      setIsEditingLandmark(false);
      await reloadState();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartTravelToLoc = async (locId, locName) => {
    if (locId === game.partyLocation) return;

    const fromLoc = game.locations.find(l => l.id === game.partyLocation);
    const travelState = {
      from: game.partyLocation,
      to: locId,
      startTime: Date.now(),
      durationMs: travelDuration * 1000
    };

    try {
      await db.updateGameTravel(gameId, {
        partyLocation: game.partyLocation,
        travelState
      });
      await db.addLog(gameId, "Dungeon Master", `The party began traveling from ${fromLoc.name} to ${locName} (Estimated time: ${travelDuration}s).`);
      await reloadState();
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate travel progress percentage
  const getTravelProgress = () => {
    if (!game.travelState) return 0;
    const elapsed = Date.now() - game.travelState.startTime;
    return Math.min(100, Math.floor((elapsed / game.travelState.durationMs) * 100));
  };

  const getRemainingTravelTime = () => {
    if (!game.travelState) return 0;
    const elapsed = Date.now() - game.travelState.startTime;
    const remainingMs = Math.max(0, game.travelState.durationMs - elapsed);
    return Math.ceil(remainingMs / 1000);
  };

  const activeLocation = game.locations.find(l => l.id === game.partyLocation);
  const targetLocation = game.travelState ? game.locations.find(l => l.id === game.travelState.to) : null;

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl fade-in">

      {/* Title bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-500/20 text-amber-400 font-fantasy px-2 py-0.5 rounded border border-amber-500/30">Dungeon Master</span>
            <span className="text-slate-400 text-xs font-mono">Code: {gameId}</span>
          </div>
          <h1 className="text-3xl font-fantasy text-gold mt-1">{game.name}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={onBackToDashboard} className="rpg-btn rpg-btn-secondary text-xs">
            🗂 Exit to Guild Hall
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="wrap b-wrap flex border-b border-white/5 mb-6 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('store')}
          className={`btn btn-primary nav-link ${activeTab === 'store' ? 'active' : ''}`}
        >
          🏪 Catalogue ({game.store.length})
        </button>
        <button
          onClick={() => setActiveTab('shops')}
          className={`btn btn-primary nav-link ${activeTab === 'shops' ? 'active' : ''}`}
        >
          🛒 Shops Manager ({(game.shops || []).length})
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`btn btn-primary nav-link ${activeTab === 'map' ? 'active' : ''}`}
        >
          🗺 Maps & Travels {game.travelState && '⏳'}
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`btn btn-primary nav-link ${activeTab === 'players' ? 'active' : ''}`}
        >
          🛡 Players Tracker ({players.length})
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`btn btn-primary nav-link ${activeTab === 'logs' ? 'active' : ''}`}
        >
          📜 Chronicle Logs
        </button>
      </div>

      {/* TAB PANELS */}

      {/* 1. STORE SETUP */}
      {activeTab === 'store' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Item form */}
          <div className="tc-wrap-2 glass-panel p-5 h-fit space-y-4">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Forge New Merchandise</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              {storeError && (
                <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs px-3 py-2 rounded">
                  {storeError}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Item Name</label>
                <input
                  type="text"
                  className="rpg-input"
                  placeholder="e.g. Ring of Protection"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Category</label>
                  <select
                    className="rpg-input rpg-select"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                  >
                    {['Weapon', 'Armor', 'Shield', 'Consumable', 'Wondrous Item'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Rarity</label>
                  <select
                    className="rpg-input rpg-select"
                    value={newItemRarity}
                    onChange={(e) => setNewItemRarity(e.target.value)}
                  >
                    {['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'].map(r => (
                      <option key={r} value={r}>{r.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Price</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      className="rpg-input w-full"
                      value={newItemCost}
                      onChange={(e) => setNewItemCost(Number(e.target.value) || 0)}
                    />
                    <select
                      className="rpg-input rpg-select w-20"
                      value={newItemCurrency}
                      onChange={(e) => setNewItemCurrency(e.target.value)}
                    >
                      <option value="gp">gp</option>
                      <option value="sp">sp</option>
                      <option value="cp">cp</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Weight (lb)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="rpg-input w-full"
                    value={newItemWeight}
                    onChange={(e) => setNewItemWeight(Number(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Stock (Blank for Unlimited)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  className="rpg-input"
                  value={newItemStock === null ? '' : newItemStock}
                  onChange={(e) => setNewItemStock(e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Description / Stats</label>
                <textarea
                  className="rpg-input h-20 resize-none text-xs"
                  placeholder="e.g. +1 to AC. Requires Attunement."
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="rpg-btn rpg-btn-primary w-full py-2">
                ＋ Forge & Stock Item
              </button>
            </form>

            <div className="border-t border-white/5 pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">SRD Quick Importers</h3>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleImportSRDPack('Weapon')} className="rpg-btn rpg-btn-secondary py-1 text-xs">🗡 Weapons</button>
                <button onClick={() => handleImportSRDPack('Armor')} className="rpg-btn rpg-btn-secondary py-1 text-xs">🛡 Armors</button>
                <button onClick={() => handleImportSRDPack('Consumable')} className="rpg-btn rpg-btn-secondary py-1 text-xs">🧪 Potions</button>
                <button onClick={() => handleImportSRDPack('Wondrous Item')} className="rpg-btn rpg-btn-secondary py-1 text-xs">✨ Wondrous</button>
              </div>
              <button
                onClick={() => handleImportSRDPack(null)}
                className="rpg-btn rpg-btn-secondary w-full py-1 text-[11px] border-amber-500/20 text-amber-300"
              >
                Import All D&D 5e Preset Items
              </button>
            </div>

            {/* CSV File Importer */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">CSV Inventory Importer</h3>
              {csvError && (
                <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px] px-3 py-1.5 rounded">
                  {csvError}
                </div>
              )}
              <div className="csv-upload-zone" onClick={() => document.getElementById('csv-file-input').click()}>
                <span className="csv-upload-zone-icon">📥</span>
                <span className="text-xs font-fantasy tracking-wider text-amber-400">Import Catalog CSV</span>
                <span className="block text-[10px] text-slate-500 mt-2 font-mono">Required: Name, Type, Rarity</span>
              </div>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCSVUpload}
              />
            </div>
          </div>

          {/* Current store inventory */}
          <div className="glass-panel p-5 lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h2 className="text-lg text-gold font-fantasy">Store Inventory</h2>
              {game.store.length > 0 && (
                <button
                  onClick={handleClearStore}
                  className="m-4 rpg-btn rpg-btn-secondary text-lg py-1 border-rose-950 text-rose-400 hover:bg-rose-950/20"
                >
                  Clear Store
                </button>
              )}
            </div>

            {/* Search & Category Filter */}
            {game.store.length > 0 && (
              <div className="tc-wrap-2 flex flex-col sm:flex-row gap-3 border-b border-white/5 pb-3 mb-2">
                <input
                  type="text"
                  placeholder="🔍 Search store wares..."
                  className="rpg-input text-xs flex-1"
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                />
                <select
                  className="rpg-input rpg-select text-xs w-96 sm:w-40"
                  value={storeCategoryFilter}
                  onChange={(e) => setStoreCategoryFilter(e.target.value)}
                >
                  {['All', 'Weapon', 'Armor', 'Shield', 'Consumable', 'Wondrous Item', 'Adventuring Gear'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            {getFilteredStoreItems().length === 0 ? (
              <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
                {game.store.length === 0
                  ? 'No wares in the shop inventory. Add items on the left panel or import D&D preset packs to begin.'
                  : 'No store items match your search filters.'}
              </div>
            ) : (
              <div className="tc-wrap-2 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                {getFilteredStoreItems().map(item => (
                  <div
                    key={item.id}
                    className={`glass-panel p-4 flex flex-col justify-between rarity-card rarity-${item.rarity.replace(' ', '_')}`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-fantasy text-lg text-slate-200">{item.name}</h3>
                          <span className="text-sm text-slate-400 uppercase font-semibold">
                            {item.category} • {item.rarity.replace('_', ' ')}
                            {item.requiresAttunement && <span className="attunement-badge ml-1.5">Attunement</span>}
                          </span>
                        </div>
                        <span className={`coin coin-${item.currency} text-sm`}>{item.cost}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2 italic">{item.description || "No description."}</p>
                    </div>

                    <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-2">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">Stock:</span>
                        {item.stock === null ? (
                          <span className="text-xs text-emerald-400 font-semibold">Unlimited</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUpdateStock(item.id, -1)}
                              className="w-5 height-5 flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 text-xs rounded hover:bg-white/10"
                            >
                              -
                            </button>
                            <span className="text-xs font-semibold text-white w-6 text-center">{item.stock}</span>
                            <button
                              onClick={() => handleUpdateStock(item.id, 1)}
                              className="w-5 height-5 flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 text-xs rounded hover:bg-white/10"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveStoreItem(item.id, item.name)}
                        className="btn btn-danger text-xs text-white-400 hover:text-rose-300 hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SHOPS MANAGER */}
      {activeTab === 'shops' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Shop Panel */}
          <div className="tc-wrap-2 glass-panel p-5 h-fit space-y-4">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Establish New Shop</h2>
            <form onSubmit={handleCreateShop} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Shop Name</label>
                <input
                  type="text"
                  className="rpg-input"
                  placeholder="e.g. Mystic Arcana"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase">Description</label>
                <textarea
                  className="rpg-input h-20 resize-none text-xs"
                  placeholder="e.g. A dusty shop smelling of ancient paper and lavender."
                  value={newShopDesc}
                  onChange={(e) => setNewShopDesc(e.target.value)}
                />
              </div>

              <button type="submit" className="rpg-btn rpg-btn-primary w-full py-2">
                ＋ Establish Shop
              </button>
            </form>
          </div>

          {/* Shops list */}
          <div className="glass-panel p-5 lg:col-span-2 space-y-4">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Campaign Shops</h2>

            {(game.shops || []).length === 0 ? (
              <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
                No custom shops created yet. Forge items in your Catalogue first, then create shops to sell them!
              </div>
            ) : (
              <div className="space-y-4">
                {(game.shops || []).map(shop => {
                  const isExpanded = expandedShopId === shop.id;
                  return (
                    <div key={shop.id} className="glass-panel p-4 border border-white/5 hover:border-white/10 transition space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h3 className="font-fantasy text-lg text-amber-400 flex items-center gap-2">
                            {shop.name}
                            <span className={`text-[10px] px-2 py-0.5 rounded ${shop.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {shop.enabled ? 'Open' : 'Closed'}
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400 italic mt-1">{shop.description || "No description."}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleToggleShopEnabled(shop.id)}
                            className={`rpg-btn text-xs py-1 px-3 ${shop.enabled ? 'rpg-btn-secondary border-rose-950 text-rose-400' : 'rpg-btn-primary'}`}
                          >
                            {shop.enabled ? 'Close Shop' : 'Open Shop'}
                          </button>
                          <button
                            onClick={() => setExpandedShopId(isExpanded ? null : shop.id)}
                            className="rpg-btn rpg-btn-secondary text-xs py-1 px-3 border-amber-500/20 text-amber-300"
                          >
                            {isExpanded ? 'Hide Stock' : 'Manage Stock'}
                          </button>
                          <button
                            onClick={() => handleDeleteShop(shop.id, shop.name)}
                            className="rpg-btn rpg-btn-secondary text-xs py-1 px-2.5 border-rose-950 text-rose-400 hover:bg-rose-950/20"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-white/5 space-y-4">
                          {/* Stock item form */}
                          <div className="bg-black/20 p-3 rounded space-y-3">
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Add Item from Catalogue</h4>
                            <div className="b-wrap flex flex-wrap items-center gap-2">
                              <select
                                className="rpg-input rpg-select text-xs flex-1 min-w-[200px]"
                                value={shopStockItemSelect}
                                onChange={(e) => setShopStockItemSelect(e.target.value)}
                              >
                                <option value="" disabled>-- Select Catalog Item --</option>
                                {game.store.map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} ({item.cost} {item.currency})
                                  </option>
                                ))}
                              </select>

                              <div className="flex items-center gap-1">
                                <label className="text-xs text-slate-400">Qty:</label>
                                <input
                                  type="number"
                                  min="1"
                                  disabled={shopStockUnlimited}
                                  className="rpg-input text-xs w-16 text-center"
                                  value={shopStockQty}
                                  onChange={(e) => setShopStockQty(Math.max(1, Number(e.target.value)))}
                                />
                              </div>

                              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={shopStockUnlimited}
                                  onChange={(e) => setShopStockUnlimited(e.target.checked)}
                                />
                                Unlimited
                              </label>

                              <button
                                onClick={() => handleAddStockToShop(shop.id)}
                                className="rpg-btn rpg-btn-primary text-xs py-1 px-4"
                                disabled={!shopStockItemSelect}
                              >
                                ＋ Stock Wares
                              </button>
                            </div>
                          </div>

                          {/* Stock list */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Current Stock ({shop.inventory.length} items)</h4>
                            {shop.inventory.length === 0 ? (
                              <p className="text-xs text-slate-500 italic py-2 text-center">Shop inventory is currently empty. Stock items from the catalogue above.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                {shop.inventory.map(item => (
                                  <div key={item.id} className="bg-black/10 border border-white/5 p-2 rounded flex justify-between items-center">
                                    <div>
                                      <span className="text-xs font-medium text-slate-200">{item.name}</span>
                                      <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                                        {item.category} • {item.cost} {item.currency}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {item.stock === null ? (
                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">Unlimited</span>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => handleUpdateShopStockLevel(shop.id, item.id, -1)}
                                            className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 text-xs rounded hover:bg-white/10"
                                          >
                                            -
                                          </button>
                                          <span className="text-xs text-slate-200 font-semibold w-6 text-center">{item.stock}</span>
                                          <button
                                            onClick={() => handleUpdateShopStockLevel(shop.id, item.id, 1)}
                                            className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 text-xs rounded hover:bg-white/10"
                                          >
                                            +
                                          </button>
                                        </div>
                                      )}
                                      <button
                                        onClick={() => handleRemoveStockFromShop(shop.id, item.id, item.name)}
                                        className="text-rose-500 hover:text-rose-300 text-xs font-bold leading-none ml-1 bg-transparent border-none cursor-pointer"
                                        title="Remove item from shop inventory"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. MAP & TRAVEL */}
      {activeTab === 'map' && (() => {
        const selectedLoc = game.locations.find(l => l.id === selectedDMLocId);
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map canvas */}
            <div className="lg:col-span-2 glass-panel p-4 flex flex-col space-y-3">
              <div>
                <h2 className="text-lg text-gold font-fantasy">Campaign World Map</h2>
                <p className="text-xs text-slate-400">
                  Click on any landmark to edit details, delete it, or set it as travel destination. Click on empty space to establish a new landmark.
                </p>
              </div>

              <div
                className="map-container relative cursor-crosshair"
                style={{ backgroundImage: `url(${game.mapUrl || fantasyMap})` }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.round(e.clientX - rect.left);
                  const y = Math.round(e.clientY - rect.top);
                  
                  setSelectedDMLocId(null);
                  setIsEditingLandmark(false);
                  
                  setNewLocX(x);
                  setNewLocY(y);
                  setNewLocName('');
                  setNewLocDesc('');
                }}
              >
                {/* Place nodes */}
                {game.locations.map(loc => {
                  const isActive = game.partyLocation === loc.id;
                  const isSelected = selectedDMLocId === loc.id;
                  return (
                    <div
                      key={loc.id}
                      className={`map-node ${isActive ? 'active' : ''} ${isSelected ? 'border-amber-400 scale-110 shadow-lg' : ''} cursor-pointer`}
                      style={{ left: `${loc.x}px`, top: `${loc.y}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDMLocId(loc.id);
                        setNewLocX(null);
                        setNewLocY(null);
                        setEditLocName(loc.name);
                        setEditLocDesc(loc.description || '');
                        setIsEditingLandmark(false);
                      }}
                      title={`${loc.name}: ${loc.description}`}
                    >
                      <div className="map-node-inner"></div>
                      <div className="map-node-label">{loc.name}</div>
                    </div>
                  );
                })}

                {/* Glowing party traveler icon */}
                {game.travelState && (
                  <div
                    className="map-party-indicator animate-bounce"
                    style={{
                      left: `${(() => {
                        const fromLoc = game.locations.find(l => l.id === game.travelState.from);
                        const toLoc = game.locations.find(l => l.id === game.travelState.to);
                        const progress = getTravelProgress() / 100;
                        return fromLoc.x + (toLoc.x - fromLoc.x) * progress;
                      })()
                        }px`,
                      top: `${(() => {
                        const fromLoc = game.locations.find(l => l.id === game.travelState.from);
                        const toLoc = game.locations.find(l => l.id === game.travelState.to);
                        const progress = getTravelProgress() / 100;
                        return fromLoc.y + (toLoc.y - fromLoc.y) * progress;
                      })()
                        }px`
                    }}
                  >
                    ⛺
                  </div>
                )}

                {/* Temporary pin when clicking empty space */}
                {newLocX !== null && newLocY !== null && (
                  <div
                    className="absolute w-3 h-3 bg-amber-400 border border-black rounded-full animate-ping pointer-events-none"
                    style={{ left: `${newLocX - 6}px`, top: `${newLocY - 6}px` }}
                  />
                )}
              </div>
            </div>

            {/* Map Details & Travel coordinator sidebar */}
            <div className="glass-panel p-5 space-y-5 h-fit">
              {/* Landmark Selection / Edit / Travel Panel */}
              {selectedLoc ? (
                <div className="border border-white/5 bg-amber-950/10 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1.5">
                    <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-widest font-fantasy">Inspecting Landmark</h3>
                    <button
                      onClick={() => setSelectedDMLocId(null)}
                      className="text-xs text-slate-400 hover:text-slate-200 bg-transparent border-none cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>

                  {isEditingLandmark ? (
                    <form onSubmit={handleSaveLandmarkEdits} className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Landmark Name</label>
                        <input
                          type="text"
                          className="rpg-input text-xs"
                          value={editLocName}
                          onChange={(e) => setEditLocName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400">Lore / Description</label>
                        <textarea
                          className="rpg-input text-xs h-16 resize-none"
                          value={editLocDesc}
                          onChange={(e) => setEditLocDesc(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button type="submit" className="rpg-btn rpg-btn-primary text-xs py-1 px-3 flex-1">
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingLandmark(false)}
                          className="rpg-btn rpg-btn-secondary text-xs py-1 px-3 flex-1"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-2.5">
                      <h4 className="text-md font-fantasy text-white">{selectedLoc.name}</h4>
                      <p className="text-xs text-slate-300 leading-relaxed italic">
                        "{selectedLoc.description || 'No description recorded.'}"
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">Coordinates: ({selectedLoc.x}, {selectedLoc.y})</p>
                      
                      <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                        {game.partyLocation !== selectedLoc.id && (
                          <button
                            onClick={() => handleStartTravelToLoc(selectedLoc.id, selectedLoc.name)}
                            disabled={!!game.travelState}
                            className="rpg-btn rpg-btn-primary w-full py-1.5 text-xs"
                          >
                            🏹 Set as Travel Destination
                          </button>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditLocName(selectedLoc.name);
                              setEditLocDesc(selectedLoc.description || '');
                              setIsEditingLandmark(true);
                            }}
                            className="rpg-btn rpg-btn-secondary text-xs py-1 flex-1 border-amber-500/20 text-amber-300"
                          >
                            ⚙ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteLocation(selectedLoc.id, selectedLoc.name)}
                            disabled={selectedLoc.id === 'loc_start'}
                            className="rpg-btn rpg-btn-secondary text-xs py-1 flex-1 border-rose-950 text-rose-400 hover:bg-rose-950/20 disabled:opacity-40"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : newLocX !== null && newLocY !== null ? (
                <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
                  <div className="flex justify-between items-center border-b border-white/5 pb-1">
                    <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Establish Landmark</h3>
                    <button
                      onClick={() => { setNewLocX(null); setNewLocY(null); }}
                      className="text-xs text-slate-400 hover:text-slate-200 bg-transparent border-none cursor-pointer font-bold ml-2"
                    >
                      ×
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    You clicked on coordinates **X: {newLocX}, Y: {newLocY}**. Establish a new landmark or town at this location?
                  </p>

                  <form onSubmit={handleCreateLandmark} className="space-y-3 pt-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Landmark Name</label>
                      <input
                        type="text"
                        className="rpg-input text-xs"
                        placeholder="e.g. Shadowdale"
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Lore Description</label>
                      <textarea
                        className="rpg-input text-xs h-16 resize-none"
                        placeholder="Describe the city, landmarks, or secrets..."
                        value={newLocDesc}
                        onChange={(e) => setNewLocDesc(e.target.value)}
                      />
                    </div>

                    <button type="submit" className="rpg-btn rpg-btn-primary w-full py-1.5 text-xs">
                      ＋ Place Landmark
                    </button>
                  </form>
                </div>
              ) : (
                <div className="border border-white/5 bg-black/20 p-4 rounded-lg text-center text-xs text-slate-400 italic">
                  💡 Select a landmark on the map to edit details or dispatch travel. Click empty space to add new cities.
                </div>
              )}

              {/* Map image settings */}
              <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">Map Layout</h3>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-400">Upload custom map image (.png, max 1.5MB)</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="file"
                      accept="image/png"
                      className="rpg-input text-xs w-full"
                      onChange={handleMapUpload}
                    />
                    {game.mapUrl && (
                      <button
                        type="button"
                        onClick={handleResetMap}
                        className="rpg-btn rpg-btn-secondary text-xs py-1 px-3 border-rose-950 text-rose-400 hover:bg-rose-950/20"
                      >
                        Reset to Default Map
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Party Status</h2>
                <div className="mt-3 space-y-2">
                  <p className="text-sm">
                    <span className="text-slate-400">Current Position:</span>{" "}
                    <span className="font-fantasy text-amber-300">{activeLocation ? activeLocation.name : 'Unknown Wilderness'}</span>
                  </p>
                  <p className="text-xs text-slate-400 italic font-medium">
                    "{activeLocation ? activeLocation.description : 'A mysterious area untouched by cartographers.'}"
                  </p>
                </div>
              </div>

              {/* Travel simulation progress widget */}
              {game.travelState && (
                <div className="border border-white/5 bg-rose-950/15 p-4 rounded-lg space-y-3">
                  <h3 className="text-xs font-semibold text-rose-300 uppercase tracking-widest">Active Travel Journey</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Traveling to {targetLocation?.name}</span>
                      <span className="text-amber-400 font-semibold">{getRemainingTravelTime()}s remaining</span>
                    </div>

                    <div className="travel-progress-bar">
                      <div
                        className="travel-progress-fill"
                        style={{ width: `${getTravelProgress()}%` }}
                      ></div>
                    </div>

                    <button
                      onClick={handleCancelTravel}
                      className="rpg-btn rpg-btn-secondary w-full py-1 text-xs text-rose-400 border-rose-950/40 hover:bg-rose-950/20"
                    >
                      Abort Travel Journey
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Travel form */}
              {!selectedLoc && !game.travelState && (
                <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-4">
                  <h3 className="text-sm text-gold font-fantasy">Dispatch Party Travel</h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Destination</label>
                      <select
                        className="rpg-input rpg-select text-xs w-full"
                        value={selectedTravelTarget}
                        onChange={(e) => setSelectedTravelTarget(e.target.value)}
                      >
                        <option value="">-- Select Destination --</option>
                        {game.locations
                          .filter(l => l.id !== game.partyLocation)
                          .map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-slate-400">Travel Speed / Time (seconds)</label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        className="rpg-input text-xs w-full"
                        value={travelDuration}
                        onChange={(e) => setTravelDuration(Number(e.target.value) || 10)}
                      />
                    </div>

                    <button
                      onClick={handleStartTravel}
                      disabled={!selectedTravelTarget}
                      className="rpg-btn rpg-btn-primary w-full py-2 text-xs"
                    >
                      🏹 Set Party in Motion
                    </button>
                  </div>
                </div>
              )}

              {/* List coordinates/nodes info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1">Known Locations</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {game.locations.map(loc => (
                    <div key={loc.id} className="text-xs p-2 bg-white/5 rounded border border-white/5 flex justify-between items-center">
                      <div>
                        <span className="font-fantasy text-slate-200 block">{loc.name}</span>
                        <span className="text-[10px] text-slate-400 italic max-w-[180px] block truncate">{loc.description}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-mono">({loc.x}, {loc.y})</span>
                        {loc.id !== 'loc_start' && (
                          <button
                            onClick={() => handleDeleteLocation(loc.id, loc.name)}
                            className="text-rose-500 hover:text-rose-300 text-xs font-bold leading-none bg-transparent border-none cursor-pointer"
                            title="Delete landmark"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. PLAYERS TRACKER */}
      {activeTab === 'players' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h2 className="text-xl text-gold font-fantasy">Active Characters</h2>
            <span className="text-xs text-slate-400">Total adventurers: {players.length}</span>
          </div>

          {players.length === 0 ? (
            <div className="glass-panel p-12 text-center text-slate-500 text-sm border-dashed">
              No adventurers have joined this campaign code yet. Share the code <span className="font-mono text-white bg-slate-800 px-1 rounded">{gameId}</span> with players.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {players.map(player => {
                const isEditing = editingPlayerKey === player.username;
                return (
                  <div key={player.username} className="glass-panel p-5 space-y-4">
                    <div className="flex justify-between items-start border-b border-white/5 pb-2">
                      <div>
                        <h3 className="text-lg font-fantasy text-amber-400">{player.name}</h3>
                        <p className="text-xs text-slate-400">
                          Played by: <span className="text-slate-300 font-semibold">{player.username}</span> • {player.race} {player.class}
                        </p>
                      </div>

                      {isEditing ? (
                        <div className="flex gap-2">
                          <button onClick={savePlayerEdits} className="rpg-btn rpg-btn-primary py-1 px-2.5 text-xs">Save</button>
                          <button onClick={() => setEditingPlayerKey('')} className="rpg-btn rpg-btn-secondary py-1 px-2.5 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditingPlayer(player)}
                            className="rpg-btn rpg-btn-secondary py-1 px-3 text-xs border-amber-500/20 hover:border-amber-500 text-amber-300"
                          >
                            ⚙ Edit Stats
                          </button>
                          <button
                            onClick={() => handleRemovePlayer(player.username, player.name)}
                            className="rpg-btn rpg-btn-secondary py-1 px-3 text-xs border-rose-950 text-rose-400 hover:bg-rose-950/20"
                            title="Remove player from campaign"
                          >
                            ❌ Kick
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Stats overview */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-black/20 p-2 rounded text-center">
                        <span className="text-md text-slate-400 uppercase">HP</span>
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <input
                              type="number"
                              className="rpg-input text-xs p-1 w-12 text-center"
                              value={editHp}
                              onChange={(e) => setEditHp(e.target.value)}
                            />
                            <span className="text-xs text-slate-400">/ {player.hpMax}</span>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-rose-400 mt-1">{player.hpCurrent} / {player.hpMax}</p>
                        )}
                      </div>

                      <div className="bg-black/20 p-2 rounded text-center">
                        <span className="text-md text-slate-400 uppercase">Level</span>
                        {isEditing ? (
                          <input
                            type="number"
                            className="rpg-input text-xs p-1 w-12 text-center mt-1 mx-auto block"
                            value={editLevel}
                            onChange={(e) => setEditLevel(e.target.value)}
                          />
                        ) : (
                          <p className="text-sm font-bold text-white mt-1">{player.level}</p>
                        )}
                      </div>

                      <div className="bg-black/20 p-2 rounded text-center">
                        <span className="text-md text-slate-400 uppercase">Gold Wallet</span>
                        {isEditing ? (
                          <input
                            type="number"
                            className="rpg-input text-xs p-1 w-16 text-center mt-1 mx-auto block"
                            value={editGoldGp}
                            onChange={(e) => setEditGoldGp(e.target.value)}
                          />
                        ) : (
                          <p className="text-sm font-bold text-amber-400 coin coin-gp mt-1 justify-center">{player.gold.gp}</p>
                        )}
                      </div>
                    </div>

                    {/* Player Inventory */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">
                        Equipment & Inventory ({player.inventory.reduce((sum, i) => sum + (i.quantity || 1), 0)} items)
                      </h4>
                      {player.inventory.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-2 text-center">Adventurer has no gear in inventory.</p>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                            {player.inventory.map(item => (
                              <span
                                key={item.id}
                                className={`text-sm px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1.5 ${item.equipped ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
                                title={`${item.description || 'No description.'} (Rarity: ${item.rarity})`}
                              >
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => handleTogglePlayerItemEquip(player.username, item.id)}
                                      className="btn-sm btn-primary bg-transparent border-none cursor-pointer p-0 text-slate-400 hover:text-amber-400 text-xs flex items-center"
                                      title={item.equipped ? "Equipped. Click to Unequip." : "Click to Equip."}
                                    >
                                      {item.equipped ? "★" : "☆"}
                                    </button>
                                    <span className="text-slate-200 font-medium">{item.name}</span>
                                    {item.quantity > 1 && (
                                      <span className="bg-slate-800 text-slate-400 px-1 rounded text-[10px]">x{item.quantity}</span>
                                    )}
                                    <button
                                      onClick={() => handleRemovePlayerItem(player.username, item.id, item.name)}
                                      className="btn-sm btn-danger ml-1 bg-transparent border-none cursor-pointer p-0 text-rose-500 hover:text-rose-300 text-xs font-bold leading-none"
                                      title="Discard item from inventory"
                                    >
                                      ×
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {item.equipped && <span className="text-amber-400 text-xs">★</span>}
                                    <span className="text-slate-200 font-medium">{item.name}</span>
                                    {item.quantity > 1 && (
                                      <span className="bg-slate-800 text-slate-400 px-1 rounded text-[10px]">x{item.quantity}</span>
                                    )}
                                  </>
                                )}
                              </span>
                            ))}
                          </div>

                          {/* Give item form - only visible when editing player */}
                          {isEditing && (
                            <div className="b-wrap mt-3 pt-3 border-t border-white/5 flex gap-2 items-center">
                              <select
                                id={`give-select-${player.username}`}
                                className="rpg-input rpg-select text-xs flex-1"
                                defaultValue=""
                              >
                                <option value="" disabled>-- Select Ware to Give --</option>
                                {game.store.map(item => (
                                  <option key={item.id} value={item.id}>
                                    {item.name} ({item.cost} {item.currency})
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => {
                                  const selectEl = document.getElementById(`give-select-${player.username}`);
                                  const itemToGive = game.store.find(i => i.id === selectEl.value);
                                  if (itemToGive) {
                                    handleGiveItem(player.username, itemToGive);
                                    selectEl.value = "";
                                  }
                                }}
                                className="rpg-btn rpg-btn-primary text-xs py-1 px-3"
                              >
                                ＋ Give Ware
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. CHRONICLE LOGS */}
      {activeTab === 'logs' && (
        <div className="glass-panel p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h2 className="text-lg text-gold font-fantasy">Campaign Log Ticker</h2>
            <button
              onClick={() => { db.addLog(gameId, "Dungeon Master", "Cleared the scrolls."); reloadState(); }}
              className="rpg-btn rpg-btn-secondary py-1 text-[11px]"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-black/30 p-4 rounded-lg border border-white/5 h-96 overflow-y-auto font-mono text-xs space-y-2 flex flex-col-reverse">
            {[...logs].reverse().map((log, index) => {
              let logClass = 'log-system';
              if (log.sender === 'Dungeon Master') logClass = 'log-dm';
              else if (log.sender !== 'System') logClass = 'log-player';

              return (
                <div key={index} className={`log-entry ${logClass}`}>
                  <span className="text-slate-500">[{log.timestamp}]</span>{" "}
                  <span className="text-amber-300 font-semibold">{log.sender}:</span>{" "}
                  <span className="text-slate-300">{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
