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

  // Map travel settings
  const [selectedTravelTarget, setSelectedTravelTarget] = useState('');
  const [travelDuration, setTravelDuration] = useState(30); // travel duration in seconds

  // Player manual editing
  const [editingPlayerKey, setEditingPlayerKey] = useState(''); // player username
  const [editHp, setEditHp] = useState(0);
  const [editGoldGp, setEditGoldGp] = useState(0);
  const [editLevel, setEditLevel] = useState(1);

  // Reload campaign state
  const reloadState = () => {
    const g = db.getGame(gameId);
    setGame(g);
    setPlayers(db.getAllCharactersInGame(gameId));
    setLogs(db.getLogs(gameId));
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
      const g = db.getGame(gameId);
      if (g && g.travelState) {
        const now = Date.now();
        const elapsed = now - g.travelState.startTime;
        if (elapsed >= g.travelState.durationMs) {
          // Travel completed!
          const targetLoc = g.locations.find(l => l.id === g.travelState.to);
          db.updateGameTravel(gameId, {
            partyLocation: g.travelState.to,
            travelState: null
          });
          db.addLog(gameId, "Dungeon Master", `The party has successfully arrived at ${targetLoc ? targetLoc.name : 'their destination'}.`);
          reloadState();
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('emporium_db_log', handleLogEvent);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (!game) return <div className="text-center py-10 font-fantasy text-gold">Loading campaign vault...</div>;

  // Store operations
  const handleAddItem = (e) => {
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
    db.updateGameStore(gameId, updatedStore);
    db.addLog(gameId, "Dungeon Master", `Added custom item "${item.name}" to the store.`);

    // Reset form
    setNewItemName('');
    setNewItemDesc('');
    reloadState();
  };

  const handleImportSRDPack = (categoryFilter) => {
    let itemsToImport = srdItems;
    if (categoryFilter) {
      itemsToImport = srdItems.filter(i => i.category === categoryFilter);
    }

    // Avoid duplicate IDs
    const currentStore = [...game.store];
    itemsToImport.forEach(item => {
      if (!currentStore.some(i => i.id === item.id)) {
        currentStore.push({ ...item });
      }
    });

    db.updateGameStore(gameId, currentStore);
    db.addLog(gameId, "Dungeon Master", `Imported ${categoryFilter ? categoryFilter : 'all standard'} 5e items into the shop catalogue.`);
    reloadState();
  };

  const handleClearStore = () => {
    if (window.confirm("Are you sure you want to empty the shop inventory?")) {
      db.updateGameStore(gameId, []);
      db.addLog(gameId, "Dungeon Master", "Cleared all items from the store.");
      reloadState();
    }
  };

  const handleRemoveStoreItem = (itemId, itemName) => {
    const updatedStore = game.store.filter(i => i.id !== itemId);
    db.updateGameStore(gameId, updatedStore);
    db.addLog(gameId, "Dungeon Master", `Removed "${itemName}" from the store.`);
    reloadState();
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

        db.updateGameStore(gameId, currentStore);
        db.addLog(gameId, "Dungeon Master", `Imported ${importedItems.length} items from CSV catalog.`);
        reloadState();
        e.target.value = null;
      } catch (err) {
        console.error("Failed to parse CSV:", err);
        setCsvError("Failed to parse CSV. Ensure correct format.");
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateStock = (itemId, change) => {
    const updatedStore = game.store.map(i => {
      if (i.id === itemId) {
        const currentStock = i.stock === null ? 0 : i.stock;
        const newStock = Math.max(0, currentStock + change);
        return { ...i, stock: i.stock === null ? null : newStock };
      }
      return i;
    });
    db.updateGameStore(gameId, updatedStore);
    reloadState();
  };

  // Travel operations
  const handleStartTravel = () => {
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

    db.updateGameTravel(gameId, {
      partyLocation: game.partyLocation, // remains at current location until complete
      travelState
    });

    db.addLog(gameId, "Dungeon Master", `The party began traveling from ${fromLoc.name} to ${toLoc.name} (Estimated time: ${travelDuration}s).`);
    reloadState();
  };

  const handleCancelTravel = () => {
    db.updateGameTravel(gameId, {
      partyLocation: game.partyLocation,
      travelState: null
    });
    db.addLog(gameId, "Dungeon Master", `Aborted travel progress. Party remained at current location.`);
    reloadState();
  };

  // Player manual editing operations
  const startEditingPlayer = (player) => {
    setEditingPlayerKey(player.username);
    setEditHp(player.hpCurrent);
    setEditLevel(player.level);
    setEditGoldGp(player.gold.gp);
  };

  const savePlayerEdits = () => {
    const player = players.find(p => p.username === editingPlayerKey);
    if (!player) return;

    const updatedStats = {
      level: Number(editLevel),
      hpCurrent: Math.min(player.hpMax, Math.max(0, Number(editHp))),
      gold: {
        ...player.gold,
        gp: Math.max(0, Number(editGoldGp))
      }
    };

    db.updateCharacter(gameId, editingPlayerKey, updatedStats);
    db.addLog(gameId, "Dungeon Master", `Manually updated stats for player character ${player.name}.`);
    setEditingPlayerKey('');
    reloadState();
  };

  const handleGiveItem = (playerUsername, storeItem) => {
    const characters = JSON.parse(localStorage.getItem('emporium_characters') || '{}');
    const charKey = `${gameId}_${playerUsername.toLowerCase()}`;
    const character = characters[charKey];
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

    characters[charKey] = character;
    localStorage.setItem('emporium_characters', JSON.stringify(characters));
    db.addLog(gameId, "Dungeon Master", `Granted "${storeItem.name}" to ${character.name}'s inventory.`);
    reloadState();
  };

  const handleRemovePlayerItem = (playerUsername, itemId, itemName) => {
    if (!window.confirm(`Are you sure you want to remove "${itemName}" from this player's inventory?`)) return;
    const characters = JSON.parse(localStorage.getItem('emporium_characters') || '{}');
    const charKey = `${gameId}_${playerUsername.toLowerCase()}`;
    const character = characters[charKey];
    if (!character) return;

    character.inventory = character.inventory.filter(i => i.id !== itemId);
    characters[charKey] = character;
    localStorage.setItem('emporium_characters', JSON.stringify(characters));
    db.addLog(gameId, "Dungeon Master", `Removed "${itemName}" from ${character.name}'s inventory.`);
    reloadState();
  };

  const handleTogglePlayerItemEquip = (playerUsername, itemId) => {
    const res = db.toggleEquipItem(gameId, playerUsername, itemId);
    if (!res.success) {
      alert(`Failed to equip/unequip: ${res.error}`);
    } else {
      reloadState();
    }
  };

  const handleRemovePlayer = (playerUsername, charName) => {
    if (!window.confirm(`Are you sure you want to kick and delete the character "${charName}" (played by ${playerUsername}) from this campaign?`)) return;
    const res = db.deleteCharacter(gameId, playerUsername);
    if (res) {
      reloadState();
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
          🏪 Store Setup ({game.store.length})
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

      {/* 2. MAP & TRAVEL */}
      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map canvas */}
          <div className="lg:col-span-2 glass-panel p-4 flex flex-col">
            <h2 className="text-lg text-gold font-fantasy mb-3">Campaign World Map</h2>

            <div
              className="map-container"
              style={{ backgroundImage: `url(${fantasyMap})` }}
            >
              {/* Place nodes */}
              {game.locations.map(loc => {
                const isActive = game.partyLocation === loc.id;
                return (
                  <div
                    key={loc.id}
                    className={`map-node ${isActive ? 'active' : ''}`}
                    style={{ left: `${loc.x}px`, top: `${loc.y}px` }}
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
            </div>
          </div>

          {/* Map Details & Travel coordinator */}
          <div className="glass-panel p-5 space-y-5 h-fit">
            <div>
              <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Party Status</h2>
              <div className="mt-3 space-y-2">
                <p className="text-sm">
                  <span className="text-slate-400">Current Position:</span>{" "}
                  <span className="font-fantasy text-amber-300">{activeLocation ? activeLocation.name : 'Unknown Wilderness'}</span>
                </p>
                <p className="text-xs text-slate-400 italic">
                  "{activeLocation ? activeLocation.description : 'A mysterious area untouched by cartographers.'}"
                </p>
              </div>
            </div>

            {/* Travel simulation widget */}
            <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-4">
              <h3 className="text-sm text-gold font-fantasy">Set Travel Coordinates</h3>

              {game.travelState ? (
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
              ) : (
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
              )}
            </div>

            {/* List coordinates/nodes info */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-1">Known Locations</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {game.locations.map(loc => (
                  <div key={loc.id} className="text-xs p-2 bg-white/5 rounded border border-white/5">
                    <span className="font-fantasy text-slate-200">{loc.name}</span>
                    <span className="text-sm text-slate-500 float-right font-mono">X: {loc.x}, Y: {loc.y}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
