import React, { useState } from 'react';
import { db } from '../../utils/db';

export default function DMPlayersTrackerTab({ game, gameId, players = [], onRefresh }) {
  const [editingPlayerKey, setEditingPlayerKey] = useState('');
  const [editHp, setEditHp] = useState(0);
  const [editGoldGp, setEditGoldGp] = useState(0);
  const [editLevel, setEditLevel] = useState(1);

  const startEditingPlayer = (player) => {
    setEditingPlayerKey(player.username);
    setEditHp(player.hpCurrent);
    setEditGoldGp(player.gold ? player.gold.gp : 0);
    setEditLevel(player.level || 1);
  };

  const savePlayerEdits = async () => {
    if (!editingPlayerKey) return;
    const player = players.find((p) => p.username === editingPlayerKey);
    if (!player) return;

    const newHpCurrent = Math.min(player.hpMax, Math.max(0, Number(editHp) || 0));
    const newGold = { ...player.gold, gp: Math.max(0, Number(editGoldGp) || 0) };
    const newLevel = Math.max(1, Number(editLevel) || 1);

    try {
      await db.updateCharacter(gameId, editingPlayerKey, {
        name: player.name,
        race: player.race,
        class: player.class,
        level: newLevel,
        hpMax: player.hpMax,
        hpCurrent: newHpCurrent,
        stats: player.stats,
        gold: newGold,
        inventory: player.inventory
      });
      await db.addLog(
        gameId,
        "Dungeon Master",
        `Updated stats for adventurer ${player.name} (${player.username}): HP ${newHpCurrent}/${player.hpMax}, Level ${newLevel}, Gold ${newGold.gp}gp.`
      );
      setEditingPlayerKey('');
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to save character edits: ${e.message}`);
    }
  };

  const handleRemovePlayer = async (targetUsername, charName) => {
    if (!window.confirm(`⚠️ Are you sure you want to kick ${charName} (${targetUsername}) from the campaign?`)) {
      return;
    }
    try {
      await db.removeCharacterFromGame(gameId, targetUsername);
      await db.addLog(gameId, "Dungeon Master", `Kicked adventurer ${charName} (${targetUsername}) from the campaign.`);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to remove player: ${e.message}`);
    }
  };

  const handleTogglePlayerItemEquip = async (targetUsername, itemId) => {
    const player = players.find((p) => p.username === targetUsername);
    if (!player) return;

    const updatedInv = player.inventory.map((i) => {
      if (i.id === itemId) {
        return { ...i, equipped: !i.equipped };
      }
      return i;
    });

    try {
      await db.updateCharacter(gameId, targetUsername, {
        ...player,
        inventory: updatedInv
      });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to toggle item equip:", e);
    }
  };

  const handleRemovePlayerItem = async (targetUsername, itemId, itemName) => {
    if (!window.confirm(`Discard "${itemName}" from adventurer's inventory?`)) return;

    try {
      await db.discardItem(gameId, targetUsername, itemId);
      await db.addLog(gameId, "Dungeon Master", `Discarded ${itemName} from ${targetUsername}'s inventory.`);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to discard item: ${e.message}`);
    }
  };

  const handleGiveItem = async (targetUsername, itemToGive) => {
    try {
      await db.grantItemToPlayer(gameId, targetUsername, itemToGive);
      await db.addLog(gameId, "Dungeon Master", `Granted ware "${itemToGive.name}" to ${targetUsername}.`);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to give item: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <h2 className="text-xl text-gold font-fantasy">Active Characters</h2>
        <span className="text-xs text-slate-400">Total adventurers: {players.length}</span>
      </div>

      {players.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-500 text-sm border-dashed">
          No adventurers have joined this campaign code yet. Share the code{' '}
          <span className="font-mono text-white bg-slate-800 px-1 rounded">{gameId}</span> with
          players.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {players.map((player) => {
            const isEditing = editingPlayerKey === player.username;
            return (
              <div key={player.username} className="glass-panel p-5 space-y-4">
                <div className="flex justify-between items-start border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-lg font-fantasy text-amber-400">{player.name}</h3>
                    <p className="text-xs text-slate-400">
                      Played by:{' '}
                      <span className="text-slate-300 font-semibold">{player.username}</span> •{' '}
                      {player.race} {player.class}
                    </p>
                  </div>

                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={savePlayerEdits}
                        className="rpg-btn rpg-btn-primary py-1 px-2.5 text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPlayerKey('')}
                        className="rpg-btn rpg-btn-secondary py-1 px-2.5 text-xs"
                      >
                        Cancel
                      </button>
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
                          className="rpg-input text-xs text-center"
                          style={{ maxWidth: '2.5rem', padding: '4px' }}
                          value={editHp}
                          onChange={(e) => setEditHp(e.target.value)}
                        />
                        <span className="text-xs text-slate-400">/ {player.hpMax}</span>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-rose-400 mt-1">
                        {player.hpCurrent} / {player.hpMax}
                      </p>
                    )}
                  </div>

                  <div className="bg-black/20 p-2 rounded text-center">
                    <span className="text-md text-slate-400 uppercase">Level</span>
                    {isEditing ? (
                      <input
                        type="number"
                        className="rpg-input text-xs text-center mt-1 mx-auto block"
                        style={{ maxWidth: '2.5rem', padding: '4px' }}
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
                        className="rpg-input text-xs text-center mt-1 mx-auto block"
                        style={{ minWidth: '6rem', padding: '4px' }}
                        value={editGoldGp}
                        onChange={(e) => setEditGoldGp(e.target.value)}
                      />
                    ) : (
                      <p className="text-sm font-bold text-amber-400 coin coin-gp mt-1 justify-center">
                        {player.gold ? player.gold.gp : 0}
                      </p>
                    )}
                  </div>
                </div>

                {/* Player Inventory */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">
                    Equipment & Inventory ({player.inventory.reduce((sum, i) => sum + (i.quantity || 1), 0)} items)
                  </h4>
                  {player.inventory.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-2 text-center">
                      Adventurer has no gear in inventory.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {player.inventory.map((item) => (
                          <span
                            key={item.id}
                            className={`text-sm px-2 py-1 rounded bg-white/5 border border-white/10 flex items-center gap-1.5 ${
                              item.equipped ? 'border-amber-500/50 bg-amber-500/5' : ''
                            }`}
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
                                  <span className="bg-slate-800 text-slate-400 px-1 rounded text-[10px]">
                                    x{item.quantity}
                                  </span>
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
                                  <span className="bg-slate-800 text-slate-400 px-1 rounded text-[10px]">
                                    x{item.quantity}
                                  </span>
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
                            <option value="" disabled>
                              -- Select Ware to Give --
                            </option>
                            {game.store.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.cost} {item.currency})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => {
                              const selectEl = document.getElementById(
                                `give-select-${player.username}`
                              );
                              const itemToGive = game.store.find(
                                (i) => i.id === selectEl.value
                              );
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
  );
}
