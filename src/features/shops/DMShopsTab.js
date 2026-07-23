import React, { useState } from 'react';
import { db } from '../../utils/db';

export default function DMShopsTab({ game, gameId, onRefresh }) {
  // Forms & Local States
  const [newShopName, setNewShopName] = useState('');
  const [newShopDesc, setNewShopDesc] = useState('');
  const [expandedShopId, setExpandedShopId] = useState(null);
  const [shopStockItemSelect, setShopStockItemSelect] = useState('');
  const [shopStockQty, setShopStockQty] = useState(5);
  const [shopStockUnlimited, setShopStockUnlimited] = useState(false);

  const handleCreateShop = async (e) => {
    e.preventDefault();
    if (!newShopName.trim()) return;

    const newShop = {
      id: "shop_" + Math.floor(1000 + Math.random() * 9000),
      name: newShopName.trim(),
      description: newShopDesc.trim(),
      enabled: false,
      inventory: []
    };

    try {
      const updatedShops = [...(game.shops || []), newShop];
      await db.updateGameShops(gameId, updatedShops);
      await db.addLog(gameId, "Dungeon Master", `Established new commercial shop: ${newShop.name}.`);
      setNewShopName('');
      setNewShopDesc('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Failed to establish shop: ${err.message}`);
    }
  };

  const handleToggleShopEnabled = async (shopId) => {
    const updated = (game.shops || []).map((s) => {
      if (s.id === shopId) {
        const nextState = !s.enabled;
        db.addLog(gameId, "Dungeon Master", `${s.name} is now ${nextState ? 'OPEN' : 'CLOSED'} for travelers.`);
        return { ...s, enabled: nextState };
      }
      return s;
    });

    try {
      await db.updateGameShops(gameId, updated);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to toggle shop status:", e);
    }
  };

  const handleDeleteShop = async (shopId, shopName) => {
    if (!window.confirm(`⚠️ Permanently disband "${shopName}"? All inventory stock inside the shop will be lost.`)) {
      return;
    }
    try {
      const updated = (game.shops || []).filter((s) => s.id !== shopId);
      await db.updateGameShops(gameId, updated);
      await db.addLog(gameId, "Dungeon Master", `Disbanded commercial shop: ${shopName}.`);
      if (expandedShopId === shopId) setExpandedShopId(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to delete shop: ${e.message}`);
    }
  };

  const handleAddStockToShop = async (shopId) => {
    if (!shopStockItemSelect) return;
    const catItem = game.store.find((i) => i.id === shopStockItemSelect);
    if (!catItem) return;

    const updated = (game.shops || []).map((s) => {
      if (s.id === shopId) {
        const existing = s.inventory.find((i) => i.id === catItem.id);
        if (existing) {
          alert(`Item "${catItem.name}" is already in this shop's stock.`);
          return s;
        }

        const stockItem = {
          ...catItem,
          stock: shopStockUnlimited ? null : shopStockQty
        };
        db.addLog(gameId, "Dungeon Master", `Added catalog item ${catItem.name} to shop ${s.name} shelves.`);
        return { ...s, inventory: [...s.inventory, stockItem] };
      }
      return s;
    });

    try {
      await db.updateGameShops(gameId, updated);
      setShopStockItemSelect('');
      setShopStockQty(5);
      setShopStockUnlimited(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to stock shop:", e);
    }
  };

  const handleUpdateShopStockLevel = async (shopId, itemId, delta) => {
    const updated = (game.shops || []).map((s) => {
      if (s.id === shopId) {
        const nextInv = s.inventory.map((item) => {
          if (item.id === itemId && item.stock !== null) {
            return { ...item, stock: Math.max(0, item.stock + delta) };
          }
          return item;
        });
        return { ...s, inventory: nextInv };
      }
      return s;
    });

    try {
      await db.updateGameShops(gameId, updated);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to update stock level:", e);
    }
  };

  const handleRemoveStockFromShop = async (shopId, itemId, itemName) => {
    if (!window.confirm(`Discard "${itemName}" from shop inventory?`)) return;

    const updated = (game.shops || []).map((s) => {
      if (s.id === shopId) {
        const nextInv = s.inventory.filter((item) => item.id !== itemId);
        db.addLog(gameId, "Dungeon Master", `Removed catalog item ${itemName} from shop ${s.name} shelves.`);
        return { ...s, inventory: nextInv };
      }
      return s;
    });

    try {
      await db.updateGameShops(gameId, updated);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to discard stock:", e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create Shop Panel */}
      <div className="tc-wrap-2 glass-panel p-5 h-fit space-y-4">
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Establish New Shop
        </h2>
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
              placeholder="e.g. A dusty shop smelling of ancient paper."
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
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Campaign Shops
        </h2>

        {(game.shops || []).length === 0 ? (
          <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
            No custom shops created yet. Forge items in your Catalogue first, then create shops to
            sell them!
          </div>
        ) : (
          <div className="space-y-4">
            {(game.shops || []).map((shop) => {
              const isExpanded = expandedShopId === shop.id;
              return (
                <div
                  key={shop.id}
                  className="glass-panel p-4 border border-white/5 hover:border-white/10 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h3 className="font-fantasy text-lg text-amber-400 flex items-center gap-2">
                        {shop.name}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded ${
                            shop.enabled
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {shop.enabled ? 'Open' : 'Closed'}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 italic mt-1">
                        {shop.description || 'No description.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleToggleShopEnabled(shop.id)}
                        className={`rpg-btn text-xs py-1 px-3 ${
                          shop.enabled ? 'rpg-btn-secondary border-rose-950 text-rose-400' : 'rpg-btn-primary'
                        }`}
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
                        <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
                          Add Item from Catalogue
                        </h4>
                        <div className="b-wrap flex flex-wrap items-center gap-2">
                          <select
                            className="rpg-input rpg-select text-xs flex-1 min-w-[200px]"
                            value={shopStockItemSelect}
                            onChange={(e) => setShopStockItemSelect(e.target.value)}
                          >
                            <option value="" disabled>
                              -- Select Catalog Item --
                            </option>
                            {game.store.map((item) => (
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
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          Current Stock ({shop.inventory.length} items)
                        </h4>
                        {shop.inventory.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2 text-center">
                            Shop inventory is currently empty. Stock items from the catalogue above.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                            {shop.inventory.map((item) => (
                              <div
                                key={item.id}
                                className="bg-black/10 border border-white/5 p-2 rounded flex justify-between items-center"
                              >
                                <div>
                                  <span className="text-xs font-medium text-slate-200">{item.name}</span>
                                  <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                                    {item.category} • {item.cost} {item.currency}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  {item.stock === null ? (
                                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                      Unlimited
                                    </span>
                                  ) : (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleUpdateShopStockLevel(shop.id, item.id, -1)}
                                        className="w-5 h-5 flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 text-xs rounded hover:bg-white/10"
                                      >
                                        -
                                      </button>
                                      <span className="text-xs text-slate-200 font-semibold w-6 text-center">
                                        {item.stock}
                                      </span>
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
  );
}
