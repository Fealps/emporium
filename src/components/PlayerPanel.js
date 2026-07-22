import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';
import fantasyMap from '../assets/fantasymap.png';

export default function PlayerPanel({ gameId, username, onBackToDashboard }) {
  const [game, setGame] = useState(null);
  const [character, setCharacter] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'inventory' | 'shop' | 'map' | 'logs'

  // Error toasts notification state
  const [toasts, setToasts] = useState([]);

  // Shop states
  const [shopCategory, setShopCategory] = useState('All');
  const [shopSearch, setShopSearch] = useState('');
  const [shopSort, setShopSort] = useState('price-asc');
  const [purchaseError, setPurchaseError] = useState('');

  // HP Adjuster
  const [hpChangeAmount, setHpChangeAmount] = useState(1);

  const addToast = (message) => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Reload character and campaign status
  const reloadState = () => {
    setGame(db.getGame(gameId));
    setCharacter(db.getCharacter(gameId, username));
    setLogs(db.getLogs(gameId));
  };

  useEffect(() => {
    reloadState();

    // Listen for storage changes or logs
    const handleLogEvent = () => reloadState();
    window.addEventListener('emporium_db_log', handleLogEvent);

    // Interval for travel updates
    const timer = setInterval(() => {
      const g = db.getGame(gameId);
      if (g && g.travelState) {
        reloadState();
      }
    }, 1000);

    return () => {
      window.removeEventListener('emporium_db_log', handleLogEvent);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, username]);

  if (!character || !game) return <div className="text-center py-10 font-fantasy text-gold">Loading Character Chronicles...</div>;

  // D&D modifier calculators
  const getModifier = (score) => Math.floor((score - 10) / 2);
  const formatModifier = (score) => {
    const mod = getModifier(score);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  // Dynamic AC Calculation (Standard 5e Rules)
  const calculateAC = () => {
    const dexMod = getModifier(character.stats.dex);

    // Find equipped armor
    const equippedArmor = character.inventory.find(i => i.category === 'Armor' && i.equipped);
    const equippedShield = character.inventory.find(i => i.category === 'Shield' && i.equipped);

    // Other AC bonuses (e.g. Ring or Cloak of Protection)
    const acBonuses = character.inventory
      .filter(i => i.equipped && i.stats && i.stats.acBonus)
      .reduce((sum, i) => sum + i.stats.acBonus, 0);

    let baseAc = 10 + dexMod;

    if (equippedArmor) {
      const arm = equippedArmor.stats;
      if (arm.armorType === 'Light') {
        baseAc = arm.ac + dexMod;
      } else if (arm.armorType === 'Medium') {
        const cappedDex = arm.dexModLimit !== null ? Math.min(arm.dexModLimit, dexMod) : dexMod;
        baseAc = arm.ac + cappedDex;
      } else if (arm.armorType === 'Heavy') {
        baseAc = arm.ac; // heavy armor ignores Dex modifier
      }
    }

    if (equippedShield) {
      baseAc += (equippedShield.stats?.acBonus || 2);
    }

    return baseAc + acBonuses;
  };

  // Adjust HP
  const handleAdjustHp = (type) => {
    const amount = Number(hpChangeAmount) || 1;
    let newHp = character.hpCurrent;

    if (type === 'heal') {
      newHp = Math.min(character.hpMax, character.hpCurrent + amount);
    } else if (type === 'damage') {
      newHp = Math.max(0, character.hpCurrent - amount);
    }

    db.updateCharacter(gameId, username, { hpCurrent: newHp });
    reloadState();
  };

  // Inventory actions
  const handleToggleEquip = (itemId) => {
    const res = db.toggleEquipItem(gameId, username, itemId);
    if (res.success) {
      reloadState();
    } else {
      addToast(res.error);
    }
  };

  const getACBreakdown = () => {
    const dexMod = getModifier(character.stats.dex);
    const equippedArmor = character.inventory.find(i => i.category === 'Armor' && i.equipped);
    const equippedShield = character.inventory.find(i => i.category === 'Shield' && i.equipped);

    // Other AC bonuses (e.g. Ring or Cloak of Protection)
    const acBonuses = character.inventory
      .filter(i => i.equipped && i.stats && i.stats.acBonus)
      .reduce((sum, i) => sum + i.stats.acBonus, 0);

    const parts = ["10 Base"];

    if (equippedArmor) {
      parts.push(`+${equippedArmor.stats.ac - 10} (${equippedArmor.name})`);
      if (equippedArmor.stats.armorType === 'Light') {
        parts.push(`+${dexMod >= 0 ? dexMod : 0} (Dex)`);
      } else if (equippedArmor.stats.armorType === 'Medium') {
        const cappedDex = Math.min(equippedArmor.stats.dexModLimit || 2, dexMod);
        parts.push(`+${cappedDex >= 0 ? cappedDex : 0} (Dex Capped)`);
      } else if (equippedArmor.stats.armorType === 'Heavy') {
        // heavy armor ignores Dex modifier
      }
    } else {
      parts.push(`+${dexMod >= 0 ? dexMod : 0} (Dex)`);
    }

    if (equippedShield) {
      parts.push(`+${equippedShield.stats?.acBonus || 2} (Shield: ${equippedShield.name})`);
    }

    if (acBonuses > 0) {
      parts.push(`+${acBonuses} (Magic Accessories)`);
    }

    return parts.join(" ");
  };

  const handleDiscardItem = (itemId) => {
    if (window.confirm("Are you sure you want to discard one of this item?")) {
      db.discardItem(gameId, username, itemId);
      reloadState();
    }
  };

  // Shop purchase
  const handleBuy = (item) => {
    setPurchaseError('');
    const res = db.buyItem(gameId, username, item);
    if (res.success) {
      reloadState();
      // Show buying success animation or note
    } else {
      setPurchaseError(res.error);
    }
  };

  // Filter and sort items in shop
  const getFilteredShopItems = () => {
    let items = [...game.store];

    // Search
    if (shopSearch.trim()) {
      const q = shopSearch.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }

    // Category
    if (shopCategory !== 'All') {
      items = items.filter(i => i.category === shopCategory);
    }

    // Sort
    items.sort((a, b) => {
      // Normalize cost to GP for comparison
      const getCostInGp = (item) => {
        if (item.currency === 'sp') return item.cost / 10;
        if (item.currency === 'cp') return item.cost / 100;
        return item.cost;
      };

      const costA = getCostInGp(a);
      const costB = getCostInGp(b);

      if (shopSort === 'price-asc') return costA - costB;
      if (shopSort === 'price-desc') return costB - costA;
      return a.name.localeCompare(b.name);
    });

    return items;
  };

  // Travel calculation
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

  // Active equipped weapon
  const activeWeapon = character.inventory.find(i => i.category === 'Weapon' && i.equipped);

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl fade-in">

      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-500/20 text-blue-400 font-fantasy px-2 py-0.5 rounded border border-blue-500/30">Player Companion</span>
            <span className="text-slate-400 text-xs font-fantasy">Campaign: {game.name}</span>
          </div>
          <h1 className="text-3xl font-fantasy text-gold mt-1">{character.name}</h1>
        </div>
        <button onClick={onBackToDashboard} className="rpg-btn rpg-btn-secondary text-xs">
          🗂 Exit to Guild Hall
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 mb-6 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('sheet')}
          className={`btn btn-primary nav-link ${activeTab === 'sheet' ? 'active' : ''}`}
        >
          👤 Sheet
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`btn btn-primary nav-link ${activeTab === 'inventory' ? 'active' : ''}`}
        >
          🎒 Backpack ({character.inventory.reduce((sum, i) => sum + i.quantity, 0)})
        </button>
        <button
          onClick={() => setActiveTab('shop')}
          className={`btn btn-primary nav-link ${activeTab === 'shop' ? 'active' : ''}`}
        >
          🪙 Merchant Shop ({game.store.length})
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`btn btn-primary nav-link ${activeTab === 'map' ? 'active' : ''}`}
        >
          🗺 Travels {game.travelState && '⏳'}
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`btn btn-primary nav-link ${activeTab === 'logs' ? 'active' : ''}`}
        >
          📜 Scrolls
        </button>
      </div>

      {/* TAB CONTENTS */}

      {/* 1. CHARACTER SHEET */}
      {activeTab === 'sheet' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="tc-wrap-2 glass-panel p-5 space-y-4 h-fit">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Vitals & Level</h2>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-black/30 p-2 border border-white/5 rounded-lg">
                <span className="text-md text-slate-400 uppercase font-fantasy">Race</span>
                <p className="text-xs font-bold text-white mt-0.5 truncate">{character.race}</p>
              </div>
              <div className="bg-black/30 p-2 border border-white/5 rounded-lg">
                <span className="text-md text-slate-400 uppercase font-fantasy">Class</span>
                <p className="text-xs font-bold text-white mt-0.5 truncate">{character.class}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 text-center">
              <div className="bg-black/30 p-2 border border-white/5 rounded-lg flex flex-col justify-center">
                <span className="text-md text-purple-400 uppercase font-fantasy">Attunement</span>
                <p className="text-xs font-bold text-purple-300 mt-0.5">
                  {character.inventory.filter(i => i.equipped && i.requiresAttunement).length} / {db.getAttunementLimit(character.class, character.level)}
                </p>
              </div>
            </div>

            {/* HP Tracker */}
            <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest">Hit Points</span>
                <span className="text-sm font-bold text-white">{character.hpCurrent} / {character.hpMax}</span>
              </div>

              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-white/5">
                <div
                  className="bg-gradient-to-r from-rose-600 to-rose-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(character.hpCurrent / character.hpMax) * 100}%` }}
                ></div>
              </div>

              {/* Adjust HP */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                <input
                  type="number"
                  min="1"
                  className="rpg-input text-xs w-16 p-1 text-center"
                  value={hpChangeAmount}
                  onChange={(e) => setHpChangeAmount(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button
                  onClick={() => handleAdjustHp('heal')}
                  className="rpg-btn rpg-btn-secondary text-[11px] py-1 px-3 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                >
                  ❤️ Heal
                </button>
                <button
                  onClick={() => handleAdjustHp('damage')}
                  className="rpg-btn rpg-btn-secondary text-[11px] py-1 px-3 border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
                >
                  💀 Damage
                </button>
              </div>
            </div>

            {/* Core Stats summary */}
            <div className="b-wrap mb-4 grid grid-cols-2 gap-4 border-t border-white/5 pt-4">
              <div className="bg-black/35 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-sm text-slate-400 uppercase font-fantasy">Armor Class (AC)</span>
                <p className="text-3xl font-extrabold text-slate-100 mt-1">{calculateAC()}</p>
                <span className="text-sm text-slate-500 italic block mt-1">Calculated from gear</span>
              </div>

              <div className="bg-black/35 p-3 rounded-lg border border-white/5 text-center">
                <span className="text-sm text-slate-400 uppercase font-fantasy">Active Weapon</span>
                <p className="text-sm font-bold text-amber-400 mt-2 truncate">
                  {activeWeapon ? activeWeapon.name : 'Unarmed Strike'}
                </p>
                <span className="text-sm text-slate-500 block mt-1">
                  {activeWeapon ? (activeWeapon.stats?.damage || '1d4 bludgeoning') : '1 + Str Mod'}
                </span>
              </div>
            </div>
          </div>

          {/* Ability Scores */}
          <div className="glass-panel p-5 lg:col-span-2 space-y-4">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Ability Scores</h2>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {Object.entries(character.stats).map(([stat, val]) => (
                <div key={stat} className="stat-box py-4">
                  <span className="stat-label block text-xs">{stat}</span>
                  <span className="stat-value block text-2xl font-bold my-1 text-slate-200">{val}</span>
                  <span className="stat-modifier text-sm bg-white/5 border border-white/5 px-2 py-0.5 rounded">
                    {formatModifier(val)}
                  </span>
                </div>
              ))}
            </div>

            {/* Coins Wallet */}
            <div className="border-t border-white/5 pt-5 mt-4">
              <h2 className="text-lg text-gold font-fantasy mb-3">Adventurer's Wallet</h2>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-lg flex flex-col items-center">
                  <span className="coin coin-gp text-amber-500 text-sm font-fantasy">Gold Pieces</span>
                  <span className="text-2xl font-extrabold text-amber-300 mt-2">{character.gold.gp} <span className="text-xs text-slate-400 font-normal">GP</span></span>
                </div>

                <div className="bg-slate-500/5 border border-slate-500/20 p-4 rounded-lg flex flex-col items-center">
                  <span className="coin coin-sp text-slate-400 text-sm font-fantasy">Silver Pieces</span>
                  <span className="text-2xl font-extrabold text-slate-300 mt-2">{character.gold.sp} <span className="text-xs text-slate-400 font-normal">SP</span></span>
                </div>

                <div className="bg-yellow-800/5 border border-yellow-800/20 p-4 rounded-lg flex flex-col items-center">
                  <span className="coin coin-cp text-yellow-700 text-sm font-fantasy">Copper Pieces</span>
                  <span className="text-2xl font-extrabold text-yellow-600 mt-2">{character.gold.cp} <span className="text-xs text-slate-400 font-normal">CP</span></span>
                </div>
              </div>
              <p className="text-md text-slate-500 italic mt-3 text-center">
                Conversion: 1 GP = 10 SP = 100 CP. Shop purchases automatically calculate total funds.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. BACKPACK */}
      {activeTab === 'inventory' && (
        <div className="equipment-layout fade-in">
          {/* Left Column: Character Slots visual */}
          <div className="char-equip-card">
            <h2 className="text-lg text-gold font-fantasy mb-1 text-center w-full border-b border-white/5 pb-2">Equipment Slots</h2>

            <div className="char-silhouette-container">
              {/* Central silhouette background icon */}
              <span className="char-silhouette-vector">🛡️</span>

              {/* Armor Slot */}
              {(() => {
                const item = character.inventory.find(i => i.equipped && i.equippedSlot === 'armor');
                return (
                  <div
                    onClick={() => item && handleToggleEquip(item.id)}
                    className={`equip-slot equip-slot-armor ${item ? 'filled' : ''}`}
                    title={item ? `${item.name} (${item.description}). Click to unequip.` : 'Empty Armor Slot'}
                  >
                    <span className="equip-slot-icon">🛡️</span>
                    {item ? (
                      <>
                        <span className="equip-slot-item-name">{item.name}</span>
                        <span className="equip-slot-item-desc">AC: {item.stats?.ac}</span>
                      </>
                    ) : (
                      <span className="equip-slot-label">Chest Armor</span>
                    )}
                  </div>
                );
              })()}

              {/* Main Hand Slot */}
              {(() => {
                const item = character.inventory.find(i => i.equipped && i.equippedSlot === 'mainHand');
                return (
                  <div
                    onClick={() => item && handleToggleEquip(item.id)}
                    className={`equip-slot equip-slot-mainHand ${item ? 'filled' : ''}`}
                    title={item ? `${item.name} (${item.description}). Click to unequip.` : 'Empty Main Hand Weapon Slot'}
                  >
                    <span className="equip-slot-icon">⚔️</span>
                    {item ? (
                      <>
                        <span className="equip-slot-item-name">{item.name}</span>
                        <span className="equip-slot-item-desc">{item.stats?.damage || 'Damage'}</span>
                      </>
                    ) : (
                      <span className="equip-slot-label">Main Hand</span>
                    )}
                  </div>
                );
              })()}

              {/* Off Hand Slot */}
              {(() => {
                const item = character.inventory.find(i => i.equipped && i.equippedSlot === 'offHand');
                const mainHandItem = character.inventory.find(i => i.equipped && i.equippedSlot === 'mainHand');
                const isTwoHandedWielded = mainHandItem?.stats?.properties?.includes("Two-Handed") || mainHandItem?.description?.toLowerCase().includes("two-handed");

                if (isTwoHandedWielded) {
                  return (
                    <div
                      className="equip-slot equip-slot-offHand opacity-40 cursor-not-allowed border-rose-950 bg-rose-950/20"
                      title={`Off Hand is disabled. Wielding Two-Handed weapon (${mainHandItem.name})`}
                    >
                      <span className="equip-slot-icon">🔒</span>
                      <span className="equip-slot-label text-rose-400">Blocked</span>
                    </div>
                  );
                }

                return (
                  <div
                    onClick={() => item && handleToggleEquip(item.id)}
                    className={`equip-slot equip-slot-offHand ${item ? 'filled' : ''}`}
                    title={item ? `${item.name} (${item.description}). Click to unequip.` : 'Empty Off Hand Slot (Shield or Off-hand weapon)'}
                  >
                    <span className="equip-slot-icon">🛡️</span>
                    {item ? (
                      <>
                        <span className="equip-slot-item-name">{item.name}</span>
                        <span className="equip-slot-item-desc">{item.stats?.acBonus ? `+${item.stats.acBonus} AC` : 'Weapon'}</span>
                      </>
                    ) : (
                      <span className="equip-slot-label">Off Hand</span>
                    )}
                  </div>
                );
              })()}

              {/* Accessory Slots 1 to 5 */}
              {["accessory1", "accessory2", "accessory3", "accessory4", "accessory5"].map((slotName, idx) => {
                const item = character.inventory.find(i => i.equipped && i.equippedSlot === slotName);
                return (
                  <div
                    key={slotName}
                    onClick={() => item && handleToggleEquip(item.id)}
                    className={`equip-slot accessory-slot equip-slot-${slotName} ${item ? 'filled' : ''}`}
                    title={item ? `${item.name} (${item.description}). Click to unequip.` : `Accessory Slot ${idx + 1}`}
                  >
                    <span className="equip-slot-icon">💍</span>
                    {item ? (
                      <span className="equip-slot-item-name">{item.name}</span>
                    ) : (
                      <span className="equip-slot-label">Slot {idx + 1}</span>
                    )}
                  </div>
                );
              })}

            </div>

            {/* Dynamic AC Formula detail */}
            <div className="text-center mt-2 w-full">
              <span className="text-xs text-slate-400">Total Armor Class (AC):</span>
              <p className="text-4xl font-extrabold text-white mt-1">{calculateAC()}</p>
              <div className="ac-detail-badge mt-2 font-mono">
                🔍 {getACBreakdown()}
              </div>
            </div>
          </div>

          {/* Right Column: Backpack Items Grid */}
          <div className="glass-panel p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h2 className="text-lg text-gold font-fantasy">Backpack Inventory</h2>
              <span className="text-xs text-slate-400 font-medium">
                Carried Weight: {character.inventory.reduce((sum, i) => sum + (i.weight * i.quantity), 0).toFixed(1)} lbs
              </span>
            </div>

            {character.inventory.length === 0 ? (
              <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
                Your backpack is empty. Head to the **Merchant Shop** tab to purchase equipment.
              </div>
            ) : (
              <div className="tc-wrap-2 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
                {character.inventory.map(item => (
                  <div
                    key={item.id}
                    className={`glass-panel p-4 flex flex-col justify-between rarity-card rarity-${item.rarity.replace(' ', '_')} ${item.equipped ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-fantasy text-sm text-slate-100 flex items-center gap-1.5">
                            {item.equipped && <span className="text-amber-400">★</span>}
                            {item.name}
                          </h3>
                          <span className="text-lg text-slate-400 uppercase font-semibold">
                            {item.category} • {item.rarity.replace('_', ' ')}
                            {item.requiresAttunement && <span className="attunement-badge ml-1.5">Attunement</span>}
                          </span>
                        </div>
                        <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">Qty: {item.quantity}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2 italic">{item.description}</p>
                      <p className="text-xs text-slate-500 mt-2 font-mono">Weight: {(item.weight * item.quantity).toFixed(1)} lbs</p>
                    </div>

                    <div className="flex justify-end gap-3 mt-4 border-t border-white/5 pt-2">
                      {['Weapon', 'Armor', 'Shield', 'Wondrous Item', 'Accessory'].includes(item.category) && (
                        <button
                          onClick={() => handleToggleEquip(item.id)}
                          className={`rpg-btn text-xs py-1 px-3 ${item.equipped ? 'rpg-btn-primary bg-amber-500/20 text-amber-300 font-bold' : 'rpg-btn-secondary'}`}
                        >
                          {item.equipped ? 'Unequip' : 'Equip Slot'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDiscardItem(item.id)}
                        className="rpg-btn rpg-btn-secondary text-xs py-1 px-3 text-rose-400 hover:text-rose-300 border-rose-950/40 hover:bg-rose-950/20"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. MERCHANT SHOP */}
      {activeTab === 'shop' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Shop filters sidebar */}
          <div className="glass-panel p-5 h-fit space-y-4">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Merchant Catalogue</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase font-semibold">Search wares</label>
              <input
                type="text"
                placeholder="Search..."
                className="rpg-input text-xs w-96"
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase font-semibold">Category</label>
              <div className="flex btn-wrap flex-wrap gap-1">
                {['All', 'Weapon', 'Armor', 'Shield', 'Consumable', 'Wondrous Item'].map(c => (
                  <button
                    key={c}
                    onClick={() => setShopCategory(c)}
                    className={`rpg-btn py-1 px-2.5 text-md ${shopCategory === c ? 'rpg-btn-primary' : 'rpg-btn-secondary'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 uppercase font-semibold">Sort By</label>
              <select
                className="rpg-input rpg-select text-xs"
                value={shopSort}
                onChange={(e) => setShopSort(e.target.value)}
              >
                <option value="name-asc">Alphabetical (A-Z)</option>
                <option value="price-asc">Price (Low to High)</option>
                <option value="price-desc">Price (High to Low)</option>
              </select>
            </div>

            <div className="b-wrap bg-black/30 p-3 border border-white/5 rounded">
              <span className="text-xs text-slate-400 block font-fantasy">Your Available Gold:</span>
              <span className="coin coin-gp text-amber-300 font-bold block mt-1.5 text-base">
                {character.gold.gp} gp, {character.gold.sp} sp, {character.gold.cp} cp
              </span>
            </div>
          </div>

          {/* Shop inventory grid */}
          <div className="lg:col-span-3 glass-panel p-5 space-y-4">
            <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Merchant Wares</h2>

            {purchaseError && (
              <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs px-3 py-2 rounded">
                {purchaseError}
              </div>
            )}

            {getFilteredShopItems().length === 0 ? (
              <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
                No store items found matching filters.
              </div>
            ) : (
              <div className="tc-wrap-2 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
                {getFilteredShopItems().map(item => {
                  const outOfStock = item.stock !== null && item.stock <= 0;
                  return (
                    <div
                      key={item.id}
                      className={`glass-panel p-4 flex flex-col justify-between rarity-card rarity-${item.rarity.replace(' ', '_')} ${outOfStock ? 'opacity-50' : ''}`}
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-fantasy text-sm text-slate-100">{item.name}</h3>
                            <span className="text-md text-slate-400 uppercase font-semibold">
                              {item.category} • {item.rarity.replace('_', ' ')}
                              {item.requiresAttunement && <span className="attunement-badge ml-1.5">Attunement</span>}
                            </span>
                          </div>
                          <span className={`coin coin-${item.currency} text-sm`}>{item.cost}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2 line-clamp-3 italic">{item.description}</p>
                      </div>

                      <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-2">
                        <span className="text-xs text-slate-400">
                          Stock: {item.stock === null ? <span className="text-emerald-400 font-semibold">Unlimited</span> : <span className="text-slate-200">{item.stock} left</span>}
                        </span>

                        <button
                          onClick={() => handleBuy(item)}
                          disabled={outOfStock}
                          className="rpg-btn rpg-btn-primary py-1 px-3 text-xs"
                        >
                          {outOfStock ? 'Sold Out' : 'Buy Gear'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MAP & TRAVEL */}
      {activeTab === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map details */}
          <div className="lg:col-span-2 glass-panel p-4 flex flex-col">
            <h2 className="text-lg text-gold font-fantasy mb-3">Party Journey Map</h2>

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

          {/* Travel sidebar */}
          <div className="glass-panel p-5 space-y-5 h-fit">
            <div>
              <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Party Coordinates</h2>
              <div className="mt-3 space-y-2">
                <p className="text-sm">
                  <span className="text-slate-400">Current Base:</span>{" "}
                  <span className="font-fantasy text-amber-300">{activeLocation ? activeLocation.name : 'Unknown Wilderness'}</span>
                </p>
                <p className="text-xs text-slate-400 italic">
                  "{activeLocation ? activeLocation.description : 'A mysterious area untouched by cartographers.'}"
                </p>
              </div>
            </div>

            {/* Travel simulation progress widget */}
            <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Travel Indicator</h3>

              {game.travelState ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Moving to {targetLocation?.name}</span>
                    <span className="text-amber-400 font-semibold">{getRemainingTravelTime()}s left</span>
                  </div>

                  <div className="travel-progress-bar">
                    <div
                      className="travel-progress-fill"
                      style={{ width: `${getTravelProgress()}%` }}
                    ></div>
                  </div>

                  <p className="text-md text-slate-400 italic">
                    The Dungeon Master has set the coordinates. Hold fast, adventuring party is moving!
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Party is currently stationary. The DM determines travels.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. SCROLLS */}
      {activeTab === 'logs' && (
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">Chronicled Logs</h2>

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

      {/* Toast alert system notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="rpg-toast">
            <span>⚠️ {t.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-xs text-rose-300 hover:text-rose-100 bg-transparent border-none cursor-pointer font-bold ml-2"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
