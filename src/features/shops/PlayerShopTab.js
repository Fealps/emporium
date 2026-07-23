import React, { useState } from 'react';
import { db } from '../../utils/db';

export default function PlayerShopTab({
  game,
  gameId,
  character,
  username,
  onRefresh
}) {
  const [selectedShopId, setSelectedShopId] = useState('');
  const [shopCategory, setShopCategory] = useState('All');
  const [shopSearch, setShopSearch] = useState('');
  const [shopSort, setShopSort] = useState('price-asc');
  const [purchaseError, setPurchaseError] = useState('');

  const activeShops = (game.shops || []).filter((s) => s.enabled);
  const currentShop = activeShops.find((s) => s.id === selectedShopId) || activeShops[0];

  const getFilteredShopItems = () => {
    if (!currentShop) return [];

    let items = [...currentShop.inventory];

    // Search filter
    if (shopSearch.trim()) {
      const q = shopSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (shopCategory !== 'All') {
      items = items.filter((i) => i.category === shopCategory);
    }

    // Sort order
    items.sort((a, b) => {
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

  const handleBuy = async (item) => {
    setPurchaseError('');
    if (!currentShop) {
      setPurchaseError('No active shops available.');
      return;
    }
    try {
      const res = await db.buyItemFromShop(gameId, username, currentShop.id, item.id);
      if (res.success) {
        if (onRefresh) onRefresh();
      } else {
        setPurchaseError(res.error);
      }
    } catch (err) {
      setPurchaseError(err.message);
    }
  };

  if (activeShops.length === 0) {
    return (
      <div className="glass-panel p-12 text-center text-slate-500 text-sm border-dashed border-white/5">
        🏪 No shops are currently open in this campaign. Check back later!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Shop filters sidebar */}
      <div className="glass-panel p-5 h-fit space-y-4">
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Merchant Catalogue
        </h2>

        {/* Shop Selector */}
        <div className="flex flex-col gap-1.5 border-b border-white/5 pb-3">
          <label className="text-xs text-slate-400 uppercase font-semibold">Select Store</label>
          <select
            className="rpg-input rpg-select text-xs"
            value={selectedShopId || (activeShops[0] ? activeShops[0].id : '')}
            onChange={(e) => {
              setSelectedShopId(e.target.value);
              setPurchaseError('');
            }}
          >
            {activeShops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {currentShop && (
            <p className="text-[11px] text-slate-400 italic mt-1">
              {currentShop.description || 'No description.'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 uppercase font-semibold">Search wares</label>
          <input
            type="text"
            placeholder="Search..."
            className="rpg-input text-xs w-full"
            value={shopSearch}
            onChange={(e) => setShopSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 uppercase font-semibold">Category</label>
          <div className="flex btn-wrap flex-wrap gap-1">
            {['All', 'Weapon', 'Armor', 'Shield', 'Consumable', 'Wondrous Item'].map((c) => (
              <button
                key={c}
                onClick={() => setShopCategory(c)}
                className={`rpg-btn py-1 px-2.5 text-md ${
                  shopCategory === c ? 'rpg-btn-primary' : 'rpg-btn-secondary'
                }`}
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
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Merchant Wares • {currentShop?.name || 'Wares'}
        </h2>

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
            {getFilteredShopItems().map((item) => {
              const outOfStock = item.stock !== null && item.stock <= 0;
              return (
                <div
                  key={item.id}
                  className={`glass-panel p-4 flex flex-col justify-between rarity-card rarity-${item.rarity.replace(
                    ' ',
                    '_'
                  )} ${outOfStock ? 'opacity-50' : ''}`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-fantasy text-sm text-slate-100">{item.name}</h3>
                        <span className="text-md text-slate-400 uppercase font-semibold">
                          {item.category} • {item.rarity.replace('_', ' ')}
                          {item.requiresAttunement && (
                            <span className="attunement-badge ml-1.5">Attunement</span>
                          )}
                        </span>
                      </div>
                      <span className={`coin coin-${item.currency} text-sm`}>{item.cost}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-3 italic">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex justify-between items-center mt-4 border-t border-white/5 pt-2">
                    <span className="text-xs text-slate-400">
                      Stock:{' '}
                      {item.stock === null ? (
                        <span className="text-emerald-400 font-semibold">Unlimited</span>
                      ) : (
                        <span className="text-slate-200">{item.stock} left</span>
                      )}
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
  );
}
