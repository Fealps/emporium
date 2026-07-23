import React, { useState } from 'react';
import { db } from '../../utils/db';
import { srdItems } from '../../utils/srdItems';

export default function DMCatalogueTab({ game, gameId, onRefresh }) {
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

  // Editing existing store item
  const [editingStoreItemId, setEditingStoreItemId] = useState(null);
  const [editStoreItemName, setEditStoreItemName] = useState('');
  const [editStoreItemCategory, setEditStoreItemCategory] = useState('Weapon');
  const [editStoreItemRarity, setEditStoreItemRarity] = useState('Common');
  const [editStoreItemCost, setEditStoreItemCost] = useState(0);
  const [editStoreItemCurrency, setEditStoreItemCurrency] = useState('gp');
  const [editStoreItemWeight, setEditStoreItemWeight] = useState(0);
  const [editStoreItemStock, setEditStoreItemStock] = useState(null);
  const [editStoreItemDesc, setEditStoreItemDesc] = useState('');

  const getFilteredStoreItems = () => {
    if (!game) return [];
    return game.store.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(storeSearch.toLowerCase()));
      const matchesCategory =
        storeCategoryFilter === 'All' || item.category === storeCategoryFilter;
      return matchesSearch && matchesCategory;
    });
  };

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
      stock: newItemStock,
      description: newItemDesc.trim(),
      requiresAttunement: newItemDesc.toLowerCase().includes('requires attunement')
    };

    try {
      const updatedStore = [...game.store, item];
      await db.updateGameStore(gameId, updatedStore);
      await db.addLog(gameId, "Dungeon Master", `Forged new merchandise: ${item.name} (${item.rarity} ${item.category}).`);
      
      // Reset form
      setNewItemName('');
      setNewItemCategory('Weapon');
      setNewItemRarity('Common');
      setNewItemCost(10);
      setNewItemCurrency('gp');
      setNewItemWeight(1);
      setNewItemStock(5);
      setNewItemDesc('');
      
      if (onRefresh) onRefresh();
    } catch (err) {
      setStoreError(err.message);
    }
  };

  const handleImportSRDPack = async (category) => {
    let itemsToImport = srdItems;
    if (category) {
      itemsToImport = srdItems.filter((i) => i.category === category);
    }

    try {
      const existingNames = new Set(game.store.map((i) => i.name.toLowerCase()));
      const imported = itemsToImport.filter((i) => !existingNames.has(i.name.toLowerCase()));

      if (imported.length === 0) {
        alert("All preset items are already in the store inventory.");
        return;
      }

      const updatedStore = [...game.store, ...imported];
      await db.updateGameStore(gameId, updatedStore);
      await db.addLog(
        gameId,
        "Dungeon Master",
        `Imported ${imported.length} D&D 5e preset items (${category || 'All Categories'}).`
      );
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Import failed: ${e.message}`);
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCsvError('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
      if (lines.length <= 1) {
        setCsvError("CSV file is empty or missing data lines.");
        return;
      }

      const headers = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
      const nameIndex = headers.indexOf('name');
      const typeIndex = headers.indexOf('type') !== -1 ? headers.indexOf('type') : headers.indexOf('category');
      const rarityIndex = headers.indexOf('rarity');
      const costIndex = headers.indexOf('cost') !== -1 ? headers.indexOf('cost') : headers.indexOf('price');
      const currencyIndex = headers.indexOf('currency');
      const weightIndex = headers.indexOf('weight');
      const stockIndex = headers.indexOf('stock');
      const descIndex = headers.indexOf('description') !== -1 ? headers.indexOf('description') : headers.indexOf('stats');

      if (nameIndex === -1 || typeIndex === -1 || rarityIndex === -1) {
        setCsvError("Invalid CSV headers. Required: 'Name', 'Type'/'Category', and 'Rarity'.");
        return;
      }

      const parsedItems = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        let values = [];
        let insideQuote = false;
        let currentValue = '';

        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"' || char === "'") {
            insideQuote = !insideQuote;
          } else if (char === ',' && !insideQuote) {
            values.push(currentValue.trim().replace(/^["']|["']$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^["']|["']$/g, ''));

        if (values.length < headers.length) continue;

        const name = values[nameIndex];
        let category = values[typeIndex] || 'Weapon';
        if (category.toLowerCase() === 'weapons') category = 'Weapon';
        if (category.toLowerCase() === 'armors') category = 'Armor';
        if (category.toLowerCase() === 'consumables') category = 'Consumable';

        const rawRarity = values[rarityIndex] || 'Common';
        const rarity = rawRarity.charAt(0).toUpperCase() + rawRarity.slice(1).toLowerCase();

        const cost = costIndex !== -1 ? Number(values[costIndex]) || 0 : 10;
        const currency = currencyIndex !== -1 ? values[currencyIndex].toLowerCase() || 'gp' : 'gp';
        const weight = weightIndex !== -1 ? Number(values[weightIndex]) || 0 : 0;
        const rawStock = stockIndex !== -1 ? values[stockIndex] : '5';
        const stock = rawStock === '' || rawStock.toLowerCase() === 'unlimited' ? null : Number(rawStock) || 0;
        const description = descIndex !== -1 ? values[descIndex] || '' : '';

        if (!name) continue;

        parsedItems.push({
          id: "item_" + Math.floor(1000 + Math.random() * 9000),
          name,
          category,
          rarity,
          cost,
          currency,
          weight,
          stock,
          description,
          requiresAttunement: description.toLowerCase().includes('requires attunement')
        });
      }

      if (parsedItems.length === 0) {
        setCsvError("No valid rows could be imported from CSV.");
        return;
      }

      try {
        const updatedStore = [...game.store, ...parsedItems];
        await db.updateGameStore(gameId, updatedStore);
        await db.addLog(gameId, "Dungeon Master", `Imported ${parsedItems.length} items from custom CSV file.`);
        if (onRefresh) onRefresh();
      } catch (err) {
        setCsvError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleClearStore = async () => {
    if (!window.confirm("⚠️ Clear all wares from the campaign's catalogue? This will empty all items.")) return;
    try {
      await db.updateGameStore(gameId, []);
      await db.addLog(gameId, "Dungeon Master", "Cleared the campaign catalog registry.");
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Failed to clear store: ${e.message}`);
    }
  };

  const handleUpdateStock = async (itemId, delta) => {
    const updated = game.store.map((i) => {
      if (i.id === itemId && i.stock !== null) {
        return { ...i, stock: Math.max(0, i.stock + delta) };
      }
      return i;
    });
    try {
      await db.updateGameStore(gameId, updated);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error("Failed to update stock:", e);
    }
  };

  const handleRemoveStoreItem = async (itemId, itemName) => {
    if (!window.confirm(`Remove "${itemName}" from catalogue?`)) return;
    try {
      const updated = game.store.filter((i) => i.id !== itemId);
      await db.updateGameStore(gameId, updated);
      await db.addLog(gameId, "Dungeon Master", `Removed ${itemName} from catalog registry.`);
      if (onRefresh) onRefresh();
    } catch (e) {
      alert(`Remove failed: ${e.message}`);
    }
  };

  const startEditingStoreItem = (item) => {
    setEditingStoreItemId(item.id);
    setEditStoreItemName(item.name);
    setEditStoreItemCategory(item.category);
    setEditStoreItemRarity(item.rarity);
    setEditStoreItemCost(item.cost);
    setEditStoreItemCurrency(item.currency || 'gp');
    setEditStoreItemWeight(item.weight || 0);
    setEditStoreItemStock(item.stock);
    setEditStoreItemDesc(item.description || '');
  };

  const handleSaveStoreItemEdits = async (e) => {
    e.preventDefault();
    if (!editStoreItemName.trim()) {
      alert("Item name is required.");
      return;
    }

    const updated = game.store.map((i) => {
      if (i.id === editingStoreItemId) {
        return {
          ...i,
          name: editStoreItemName.trim(),
          category: editStoreItemCategory,
          rarity: editStoreItemRarity,
          cost: Number(editStoreItemCost),
          currency: editStoreItemCurrency,
          weight: Number(editStoreItemWeight),
          stock: editStoreItemStock,
          description: editStoreItemDesc.trim(),
          requiresAttunement: editStoreItemDesc.toLowerCase().includes('requires attunement')
        };
      }
      return i;
    });

    try {
      await db.updateGameStore(gameId, updated);
      setEditingStoreItemId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(`Edit failed: ${err.message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Add Item form */}
      <div className="tc-wrap-2 glass-panel p-5 h-fit space-y-4">
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Forge New Merchandise
        </h2>
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
                {['Weapon', 'Armor', 'Shield', 'Consumable', 'Wondrous Item'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
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
                {['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'].map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
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
            <label className="text-xs font-semibold text-slate-300 uppercase">
              Stock (Blank for Unlimited)
            </label>
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
            <label className="text-xs font-semibold text-slate-300 uppercase">
              Description / Stats
            </label>
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
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Preset Importers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleImportSRDPack('Weapon')}
              className="rpg-btn rpg-btn-secondary py-1 text-xs"
            >
              🗡 Weapons
            </button>
            <button
              onClick={() => handleImportSRDPack('Armor')}
              className="rpg-btn rpg-btn-secondary py-1 text-xs"
            >
              🛡 Armors
            </button>
            <button
              onClick={() => handleImportSRDPack('Consumable')}
              className="rpg-btn rpg-btn-secondary py-1 text-xs"
            >
              🧪 Potions
            </button>
            <button
              onClick={() => handleImportSRDPack('Wondrous Item')}
              className="rpg-btn rpg-btn-secondary py-1 text-xs"
            >
              ✨ Wondrous
            </button>
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
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            CSV Inventory Importer
          </h3>
          {csvError && (
            <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-[11px] px-3 py-1.5 rounded">
              {csvError}
            </div>
          )}
          <div
            className="csv-upload-zone"
            onClick={() => document.getElementById('csv-file-input').click()}
          >
            <span className="csv-upload-zone-icon">📥</span>
            <span className="text-xs font-fantasy tracking-wider text-amber-400">
              Import Catalog CSV
            </span>
            <span className="block text-[10px] text-slate-500 mt-2 font-mono">
              Required: Name, Type, Rarity
            </span>
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
              {[
                'All',
                'Weapon',
                'Armor',
                'Shield',
                'Consumable',
                'Wondrous Item',
                'Adventuring Gear'
              ].map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {getFilteredStoreItems().length === 0 ? (
          <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
            {game.store.length === 0
              ? 'No wares in the shop inventory. Add items on the left panel or import preset packs.'
              : 'No store items match your search filters.'}
          </div>
        ) : (
          <div className="tc-wrap-2 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2">
            {getFilteredStoreItems().map((item) => {
              if (editingStoreItemId === item.id) {
                return (
                  <form
                    key={item.id}
                    onSubmit={handleSaveStoreItemEdits}
                    className="glass-panel p-4 space-y-3 rarity-card rarity-Common border-amber-500/50 bg-amber-500/5 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Name</label>
                        <input
                          type="text"
                          className="rpg-input text-xs p-1.5"
                          value={editStoreItemName}
                          onChange={(e) => setEditStoreItemName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Category</label>
                          <select
                            className="rpg-input rpg-select text-xs p-1"
                            value={editStoreItemCategory}
                            onChange={(e) => setEditStoreItemCategory(e.target.value)}
                          >
                            {['Weapon', 'Armor', 'Shield', 'Consumable', 'Wondrous Item'].map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Rarity</label>
                          <select
                            className="rpg-input rpg-select text-xs p-1"
                            value={editStoreItemRarity}
                            onChange={(e) => setEditStoreItemRarity(e.target.value)}
                          >
                            {['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'].map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Cost</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              min="0"
                              className="rpg-input text-xs p-1 flex-1"
                              value={editStoreItemCost}
                              onChange={(e) => setEditStoreItemCost(Number(e.target.value) || 0)}
                            />
                            <select
                              className="rpg-input rpg-select text-xs p-1 w-12"
                              value={editStoreItemCurrency}
                              onChange={(e) => setEditStoreItemCurrency(e.target.value)}
                            >
                              <option value="gp">gp</option>
                              <option value="sp">sp</option>
                              <option value="cp">cp</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-bold text-slate-400">Weight (lb)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            className="rpg-input text-xs p-1"
                            value={editStoreItemWeight}
                            onChange={(e) => setEditStoreItemWeight(Number(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">
                          Stock (Blank for Unlimited)
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="rpg-input text-xs p-1.5"
                          placeholder="Unlimited"
                          value={editStoreItemStock === null ? '' : editStoreItemStock}
                          onChange={(e) =>
                            setEditStoreItemStock(
                              e.target.value === '' ? null : Number(e.target.value)
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400">Description</label>
                        <textarea
                          className="rpg-input text-xs p-1.5 h-12 resize-none"
                          value={editStoreItemDesc}
                          onChange={(e) => setEditStoreItemDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end border-t border-white/5 pt-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setEditingStoreItemId(null)}
                        className="rpg-btn rpg-btn-secondary text-[11px] py-1 px-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rpg-btn rpg-btn-primary text-[11px] py-1 px-3"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={item.id}
                  className={`glass-panel p-4 flex flex-col justify-between rarity-card rarity-${item.rarity.replace(
                    ' ',
                    '_'
                  )}`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-fantasy text-lg text-slate-200">{item.name}</h3>
                        <span className="text-sm text-slate-400 uppercase font-semibold">
                          {item.category} • {item.rarity.replace('_', ' ')}
                          {item.requiresAttunement && (
                            <span className="attunement-badge ml-1.5">Attunement</span>
                          )}
                        </span>
                      </div>
                      <span className={`coin coin-${item.currency} text-sm`}>{item.cost}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2 italic">
                      {item.description || "No description."}
                    </p>
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
                          <span className="text-xs font-semibold text-white w-6 text-center">
                            {item.stock}
                          </span>
                          <button
                            onClick={() => handleUpdateStock(item.id, 1)}
                            className="w-5 height-5 flex items-center justify-center bg-white/5 border border-white/10 text-slate-300 text-xs rounded hover:bg-white/10"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditingStoreItem(item)}
                        className="btn btn-secondary text-xs text-amber-400 hover:text-amber-300 hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRemoveStoreItem(item.id, item.name)}
                        className="btn btn-danger text-xs text-white-400 hover:text-rose-300 hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
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
