import React from 'react';
import { db } from '../../utils/db';

export default function PlayerBackpackTab({
  character,
  gameId,
  username,
  onRefresh,
  addToast
}) {
  const calculateAC = () => {
    let baseAC = 10;
    const dexMod = Math.floor(((character.stats.dex || 10) - 10) / 2);

    const equippedArmor = character.inventory.find(
      (i) => i.equipped && i.equippedSlot === 'armor'
    );
    if (equippedArmor && equippedArmor.stats) {
      if (equippedArmor.stats.acType === 'heavy') {
        baseAC = equippedArmor.stats.ac;
      } else if (equippedArmor.stats.acType === 'medium') {
        baseAC = equippedArmor.stats.ac + Math.min(2, dexMod);
      } else if (equippedArmor.stats.acType === 'light') {
        baseAC = equippedArmor.stats.ac + dexMod;
      } else {
        baseAC = equippedArmor.stats.ac;
      }
    } else {
      baseAC += dexMod;
    }

    const equippedOffHand = character.inventory.find(
      (i) => i.equipped && i.equippedSlot === 'offHand'
    );
    if (equippedOffHand && equippedOffHand.stats && equippedOffHand.stats.acBonus) {
      baseAC += equippedOffHand.stats.acBonus;
    }

    const equippedWondrous = character.inventory.filter((i) => i.equipped);
    equippedWondrous.forEach((item) => {
      if (item.stats && item.stats.acBonus) {
        baseAC += item.stats.acBonus;
      }
    });

    return baseAC;
  };

  const getACBreakdown = () => {
    const dexMod = Math.floor(((character.stats.dex || 10) - 10) / 2);
    const equippedArmor = character.inventory.find(
      (i) => i.equipped && i.equippedSlot === 'armor'
    );
    const equippedOffHand = character.inventory.find(
      (i) => i.equipped && i.equippedSlot === 'offHand'
    );

    const parts = [];

    if (equippedArmor && equippedArmor.stats) {
      parts.push(`${equippedArmor.name} (${equippedArmor.stats.ac})`);
      if (equippedArmor.stats.acType === 'medium') {
        parts.push(`Dex (max +2: +${Math.min(2, dexMod)})`);
      } else if (equippedArmor.stats.acType === 'light') {
        parts.push(`Dex (+${dexMod})`);
      }
    } else {
      parts.push(`Base (10)`);
      parts.push(`Dex (${dexMod >= 0 ? '+' : ''}${dexMod})`);
    }

    if (equippedOffHand && equippedOffHand.stats && equippedOffHand.stats.acBonus) {
      parts.push(`${equippedOffHand.name} (+${equippedOffHand.stats.acBonus})`);
    }

    return parts.join(' + ');
  };

  const handleToggleEquip = async (itemId) => {
    try {
      const res = await db.equipItem(gameId, username, itemId);
      if (res.success) {
        if (onRefresh) onRefresh();
      } else {
        if (addToast) addToast(res.error);
      }
    } catch (e) {
      if (addToast) addToast(e.message);
    }
  };

  const handleDiscardItem = async (itemId) => {
    const item = character.inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (window.confirm(`Are you sure you want to discard "${item.name}"? This action cannot be undone.`)) {
      try {
        await db.discardItem(gameId, username, itemId);
        if (onRefresh) onRefresh();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="equipment-layout fade-in">
      {/* Left Column: Character Slots visual */}
      <div className="char-equip-card">
        <h2 className="text-lg text-gold font-fantasy mb-1 text-center w-full border-b border-white/5 pb-2">
          Equipment Slots
        </h2>

        <div className="char-silhouette-container">
          {/* Central silhouette background icon */}
          <span className="char-silhouette-vector">🛡️</span>

          {/* Armor Slot */}
          {(() => {
            const item = character.inventory.find((i) => i.equipped && i.equippedSlot === 'armor');
            return (
              <div
                onClick={() => item && handleToggleEquip(item.id)}
                className={`equip-slot equip-slot-armor ${item ? 'filled' : ''}`}
                title={
                  item ? `${item.name} (${item.description}). Click to unequip.` : 'Empty Armor Slot'
                }
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
            const item = character.inventory.find((i) => i.equipped && i.equippedSlot === 'mainHand');
            return (
              <div
                onClick={() => item && handleToggleEquip(item.id)}
                className={`equip-slot equip-slot-mainHand ${item ? 'filled' : ''}`}
                title={
                  item
                    ? `${item.name} (${item.description}). Click to unequip.`
                    : 'Empty Main Hand Weapon Slot'
                }
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
            const item = character.inventory.find((i) => i.equipped && i.equippedSlot === 'offHand');
            const mainHandItem = character.inventory.find(
              (i) => i.equipped && i.equippedSlot === 'mainHand'
            );
            const isTwoHandedWielded =
              mainHandItem?.stats?.properties?.includes("Two-Handed") ||
              mainHandItem?.description?.toLowerCase().includes("two-handed");

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
                title={
                  item
                    ? `${item.name} (${item.description}). Click to unequip.`
                    : 'Empty Off Hand Slot (Shield or Off-hand weapon)'
                }
              >
                <span className="equip-slot-icon">🛡️</span>
                {item ? (
                  <>
                    <span className="equip-slot-item-name">{item.name}</span>
                    <span className="equip-slot-item-desc">
                      {item.stats?.acBonus ? `+${item.stats.acBonus} AC` : 'Weapon'}
                    </span>
                  </>
                ) : (
                  <span className="equip-slot-label">Off Hand</span>
                )}
              </div>
            );
          })()}

          {/* Accessory Slots 1 to 5 */}
          {["accessory1", "accessory2", "accessory3", "accessory4", "accessory5"].map((slotName, idx) => {
            const item = character.inventory.find((i) => i.equipped && i.equippedSlot === slotName);
            return (
              <div
                key={slotName}
                onClick={() => item && handleToggleEquip(item.id)}
                className={`equip-slot accessory-slot equip-slot-${slotName} ${item ? 'filled' : ''}`}
                title={
                  item
                    ? `${item.name} (${item.description}). Click to unequip.`
                    : `Accessory Slot ${idx + 1}`
                }
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
          <div className="ac-detail-badge mt-2 font-mono">🔍 {getACBreakdown()}</div>
        </div>
      </div>

      {/* Right Column: Backpack Items Grid */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <h2 className="text-lg text-gold font-fantasy">Backpack Inventory</h2>
          <span className="text-xs text-slate-400 font-medium">
            Carried Weight:{' '}
            {character.inventory.reduce((sum, i) => sum + i.weight * i.quantity, 0).toFixed(1)} lbs
          </span>
        </div>

        {character.inventory.length === 0 ? (
          <div className="text-center py-20 text-slate-500 border border-dashed border-white/5 rounded-lg text-sm">
            Your backpack is empty. Head to the **Merchant Shop** tab to purchase equipment.
          </div>
        ) : (
          <div className="tc-wrap-2 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2">
            {character.inventory.map((item) => (
              <div
                key={item.id}
                className={`glass-panel p-4 flex flex-col justify-between rarity-card rarity-${item.rarity.replace(
                  ' ',
                  '_'
                )} ${item.equipped ? 'border-amber-500/40 bg-amber-500/5' : ''}`}
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
                        {item.requiresAttunement && (
                          <span className="attunement-badge ml-1.5">Attunement</span>
                        )}
                      </span>
                    </div>
                    <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded font-semibold">
                      Qty: {item.quantity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">{item.description}</p>
                  <p className="text-xs text-slate-500 mt-2 font-mono">
                    Weight: {(item.weight * item.quantity).toFixed(1)} lbs
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-4 border-t border-white/5 pt-2">
                  {['Weapon', 'Armor', 'Shield', 'Wondrous Item', 'Accessory'].includes(item.category) && (
                    <button
                      onClick={() => handleToggleEquip(item.id)}
                      className={`rpg-btn text-xs py-1 px-3 ${
                        item.equipped
                          ? 'rpg-btn-primary bg-amber-500/20 text-amber-300 font-bold'
                          : 'rpg-btn-secondary'
                      }`}
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
  );
}
