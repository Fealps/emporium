import React, { useState } from 'react';
import { db } from '../../utils/db';

export default function PlayerCharacterSheetTab({
  character,
  gameId,
  username,
  onRefresh,
  addToast
}) {
  const [hpChangeAmount, setHpChangeAmount] = useState(1);

  const handleAdjustHp = async (type) => {
    const amount = Number(hpChangeAmount) || 1;
    let newHp = character.hpCurrent;
    if (type === 'heal') {
      newHp = Math.min(character.hpMax, character.hpCurrent + amount);
    } else if (type === 'damage') {
      newHp = Math.max(0, character.hpCurrent - amount);
    }

    try {
      await db.updateCharacter(gameId, username, {
        ...character,
        hpCurrent: newHp
      });
      const verb = type === 'heal' ? 'healed' : 'took damage';
      await db.addLog(gameId, username, `${character.name} ${verb} (${amount} HP). Current HP: ${newHp}/${character.hpMax}.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      if (addToast) addToast(`Failed to update HP: ${err.message}`);
    }
  };

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

  const formatModifier = (val) => {
    const mod = Math.floor((val - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const activeWeapon = character.inventory.find(
    (i) => i.category === 'Weapon' && i.equipped
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Info */}
      <div className="tc-wrap-2 glass-panel p-5 space-y-4 h-fit">
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Vitals & Level
        </h2>

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
              {character.inventory.filter((i) => i.equipped && i.requiresAttunement).length} /{' '}
              {db.getAttunementLimit(character.class, character.level)}
            </p>
          </div>
        </div>

        {/* HP Tracker */}
        <div className="border border-white/5 bg-black/20 p-4 rounded-lg space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-widest">
              Hit Points
            </span>
            <span className="text-sm font-bold text-white">
              {character.hpCurrent} / {character.hpMax}
            </span>
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
              className="rpg-input text-xs text-center"
              style={{ width: '80px', padding: '4px' }}
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
              {activeWeapon ? activeWeapon.stats?.damage || '1d4 bludgeoning' : '1 + Str Mod'}
            </span>
          </div>
        </div>
      </div>

      {/* Ability Scores */}
      <div className="glass-panel p-5 lg:col-span-2 space-y-4">
        <h2 className="text-lg text-gold font-fantasy border-b border-white/5 pb-2">
          Ability Scores
        </h2>

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
              <span className="text-2xl font-extrabold text-amber-300 mt-2">
                {character.gold.gp} <span className="text-xs text-slate-400 font-normal">GP</span>
              </span>
            </div>

            <div className="bg-slate-500/5 border border-slate-500/20 p-4 rounded-lg flex flex-col items-center">
              <span className="coin coin-sp text-slate-400 text-sm font-fantasy">Silver Pieces</span>
              <span className="text-2xl font-extrabold text-slate-300 mt-2">
                {character.gold.sp} <span className="text-xs text-slate-400 font-normal">SP</span>
              </span>
            </div>

            <div className="bg-yellow-800/5 border border-yellow-800/20 p-4 rounded-lg flex flex-col items-center">
              <span className="coin coin-cp text-yellow-700 text-sm font-fantasy">Copper Pieces</span>
              <span className="text-2xl font-extrabold text-yellow-600 mt-2">
                {character.gold.cp} <span className="text-xs text-slate-400 font-normal">CP</span>
              </span>
            </div>
          </div>
          <p className="text-md text-slate-500 italic mt-3 text-center">
            Conversion: 1 GP = 10 SP = 100 CP. Shop purchases automatically calculate total funds.
          </p>
        </div>
      </div>
    </div>
  );
}
