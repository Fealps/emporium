import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';

export default function Dashboard({ username, onSelectCampaign, onLogout }) {
  const [games, setGames] = useState({});
  const [userCharacters, setUserCharacters] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Game Creation Form
  const [newGameName, setNewGameName] = useState('');
  const [newGameDesc, setNewGameDesc] = useState('');
  const [createError, setCreateError] = useState('');

  // Game Join Form
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');

  // Character Creation Form (Triggered after joining a game with no character)
  const [pendingJoinGame, setPendingJoinGame] = useState(null); // game object
  const [charName, setCharName] = useState('');
  const [charRace, setCharRace] = useState('Human');
  const [charClass, setCharClass] = useState('Fighter');
  const [charStats, setCharStats] = useState({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
  const [charGold, setCharGold] = useState(100);
  const [charError, setCharError] = useState('');

  // Load all campaigns
  const loadGames = async () => {
    try {
      const gamesList = await db.getGames();
      setGames(gamesList);
      const charList = await db.getUserCharacters(username);
      setUserCharacters(charList || []);
    } catch (e) {
      console.error("Failed to load campaigns:", e);
    }
  };

  useEffect(() => {
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!newGameName.trim()) {
      setCreateError("Campaign name is required.");
      return;
    }
    try {
      const newGame = await db.createGame(newGameName, newGameDesc, username);
      setNewGameName('');
      setNewGameDesc('');
      setShowCreateModal(false);
      await loadGames();

      // Automatically enter game as DM
      onSelectCampaign(newGame.id, 'dm');
    } catch (err) {
      setCreateError(err.message);
    }
  };

  const handleJoinCampaign = async (e) => {
    e.preventDefault();
    setJoinError('');
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError("Please enter a campaign code.");
      return;
    }

    const res = await db.joinGame(code, username);
    if (!res.success) {
      setJoinError(res.error);
      return;
    }

    if (res.characterExists) {
      // Enter the campaign immediately
      setShowJoinModal(false);
      setJoinCode('');
      onSelectCampaign(code, 'player');
    } else {
      // Prompt character creation
      setPendingJoinGame(res.game);
      setShowJoinModal(false);
      setJoinCode('');
    }
  };

  const handleCreateCharacter = async (e) => {
    e.preventDefault();
    setCharError('');
    if (!charName.trim()) {
      setCharError("Character Name is required.");
      return;
    }

    // HP formulas based on class and Constitution modifier
    const getConModifier = (score) => Math.floor((score - 10) / 2);
    const conMod = getConModifier(charStats.con);

    let baseHp = 10;
    if (charClass === 'Barbarian') baseHp = 12;
    else if (charClass === 'Wizard') baseHp = 6;
    else if (charClass === 'Rogue') baseHp = 8;
    else if (charClass === 'Cleric' || charClass === 'Bard' || charClass === 'Warlock' || charClass === 'Druid') baseHp = 8;
    else if (charClass === 'Paladin' || charClass === 'Ranger') baseHp = 10;

    const hpMax = baseHp + conMod;

    try {
      await db.createCharacter(pendingJoinGame.id, username, {
        name: charName,
        race: charRace,
        class: charClass,
        hpMax: hpMax,
        stats: charStats,
        gold: { gp: charGold, sp: 0, cp: 0 }
      });

      const gameId = pendingJoinGame.id;
      setPendingJoinGame(null);
      setCharName('');
      setCharRace('Human');
      setCharClass('Fighter');
      setCharStats({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
      setCharGold(100);

      // Enter campaign
      onSelectCampaign(gameId, 'player');
    } catch (err) {
      setCharError(err.message);
    }
  };

  // Roll 4d6 drop lowest for D&D stats
  const rollStat = () => {
    const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
    rolls.sort();
    return rolls[1] + rolls[2] + rolls[3];
  };

  const handleRollStats = () => {
    setCharStats({
      str: rollStat(),
      dex: rollStat(),
      con: rollStat(),
      int: rollStat(),
      wis: rollStat(),
      cha: rollStat()
    });
  };

  const handleDeleteCampaign = async (gameId, gameName) => {
    if (!window.confirm(`⚠️ WARNING: Are you sure you want to permanently delete the campaign "${gameName}" (${gameId})? This will delete all landmarks, shops, character sheets, and log history. This action CANNOT be undone.`)) {
      return;
    }

    try {
      await db.deleteGame(gameId);
      await loadGames();
    } catch (e) {
      alert(`Failed to delete campaign: ${e.message}`);
    }
  };

  // Filter campaign lists
  const dmCampaigns = Object.values(games).filter(g => g.dm === username);

  // Find player campaigns (we have a character in them)
  const allCharacters = {};
  userCharacters.forEach(c => {
    allCharacters[`${c.game_id}_${username.toLowerCase()}`] = {
      name: c.name,
      race: c.race,
      class: c.class,
      level: c.level,
      hpMax: c.hp_max,
      hpCurrent: c.hp_current,
      stats: c.stats,
      gold: c.gold,
      inventory: c.inventory
    };
  });
  const playerGameIds = Object.keys(allCharacters)
    .filter(key => key.endsWith(`_${username.toLowerCase()}`))
    .map(key => key.split('_')[0]);

  const playerCampaigns = Object.values(games).filter(g => playerGameIds.includes(g.id));

  // If character creation screen is open, display it
  if (pendingJoinGame) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl fade-in">
        <div className="glass-panel p-8 border-t-4 border-t-amber-500">
          <h2 className="text-2xl text-gold mb-2 font-fantasy">Forge Your Character</h2>
          <p className="text-slate-400 text-sm mb-6">
            Create your adventurer for the campaign: <span className="text-white font-semibold">{pendingJoinGame.name}</span>
          </p>

          <form onSubmit={handleCreateCharacter} className="space-y-6">
            {charError && (
              <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-sm px-4 py-3 rounded-md">
                {charError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Character Name</label>
                <input
                  type="text"
                  className="rpg-input"
                  placeholder="e.g. Diana the Swift"
                  value={charName}
                  onChange={(e) => setCharName(e.target.value)}
                  required
                />
              </div>

              <div className="flex grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Race</label>
                  <select
                    className="rpg-input rpg-select"
                    value={charRace}
                    onChange={(e) => setCharRace(e.target.value)}
                  >
                    {['Human', 'Elf', 'Dwarf', 'Halfling', 'Dragonborn', 'Tiefling', 'Half-Orc'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Class</label>
                  <select
                    className="rpg-input rpg-select"
                    value={charClass}
                    onChange={(e) => setCharClass(e.target.value)}
                  >
                    {['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Barbarian', 'Paladin', 'Ranger', 'Bard'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stats Editor */}
            <div className="border border-white/5 bg-black/20 p-5 rounded-lg space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <h3 className="text-md text-amber-300 font-fantasy">Ability Scores</h3>
                <button
                  type="button"
                  onClick={handleRollStats}
                  className="rpg-btn rpg-btn-secondary py-1.5 px-3 text-xs"
                >
                  🎲 Roll Random Stats
                </button>
              </div>

              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {Object.keys(charStats).map(stat => (
                  <div key={stat} className="stat-box">
                    <span className="stat-label">{stat}</span>
                    <input
                      type="number"
                      min="3"
                      max="20"
                      className="w-full text-center bg-transparent border-none text-xl font-bold focus:outline-none"
                      value={charStats[stat]}
                      onChange={(e) => setCharStats({
                        ...charStats,
                        [stat]: Math.min(20, Math.max(3, parseInt(e.target.value) || 10))
                      })}
                    />
                    <span className="stat-modifier">
                      {Math.floor((charStats[stat] - 10) / 2) >= 0 ? '+' : ''}
                      {Math.floor((charStats[stat] - 10) / 2)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 text-center italic">
                Modifiers are automatically calculated: Mod = (Score - 10) / 2.
              </p>
            </div>

            {/* Starting Gold */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Starting Gold (GP)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="10"
                  max="1000"
                  className="rpg-input w-36"
                  value={charGold}
                  onChange={(e) => setCharGold(parseInt(e.target.value) || 100)}
                />
                <span className="coin coin-gp text-amber-400 text-sm">Gold Pieces</span>
              </div>
              <p className="text-xs text-slate-400">Funds are used to buy gear in shops set up by the DM.</p>
            </div>

            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button type="submit" className="rpg-btn rpg-btn-primary flex-1 py-3 text-base">
                Embark on Campaign
              </button>
              <button
                type="button"
                onClick={() => setPendingJoinGame(null)}
                className="rpg-btn rpg-btn-secondary px-6"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-10 max-w-6xl fade-in">
      {/* Header bar */}
      <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
        <div>
          <span className="text-xs text-amber-500 font-fantasy uppercase tracking-widest">Guild Hall Dashboard</span>
          <h1 className="text-3xl font-fantasy text-gold">Welcome, {username}</h1>
        </div>
        <button onClick={onLogout} className="rpg-btn rpg-btn-secondary text-xs">
          Sign Out
        </button>
      </div>

      {/* Main grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* DM SECTION */}
        <div className="glass-panel p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h2 className="text-xl text-gold font-fantasy">Dungeon Master</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rpg-btn rpg-btn-primary text-xs py-2"
            >
              ＋ New Campaign
            </button>
          </div>

          <p className="text-sm text-slate-400">
            Create a campaign, curate magical stores, plot interactive locations, and direct player journeys.
          </p>

          <div className="space-y-3">
            {dmCampaigns.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/5 rounded-lg text-slate-500 text-sm">
                No campaigns created yet. Click "New Campaign" to begin.
              </div>
            ) : (
              dmCampaigns.map(game => (
                <div
                  key={game.id}
                  className="p-4 border border-white/5 bg-black/10 rounded-lg hover:border-amber-500/30 flex justify-between items-center transition group"
                >
                  <div>
                    <h3 className="text-xl font-fantasy text-amber-400 group-hover:text-amber-300">{game.name}</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs truncate">{game.description || "No description provided."}</p>
                    <span className="inline-block mt-2 text-xs bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded uppercase font-fantasy">
                      Code: {game.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectCampaign(game.id, 'dm')}
                      className="rpg-btn rpg-btn-secondary text-xs py-1.5 px-3"
                    >
                      Manage DM Panel
                    </button>
                    <button
                      onClick={() => handleDeleteCampaign(game.id, game.name)}
                      className="rpg-btn rpg-btn-secondary text-xs py-1.5 px-2.5 border-rose-950 text-rose-400 hover:bg-rose-950/20"
                      title="Permanently Delete Campaign"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PLAYER SECTION */}
        <div className="glass-panel p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-3">
            <h2 className="text-xl text-gold font-fantasy">Player Chronicles</h2>
            <button
              onClick={() => setShowJoinModal(true)}
              className="rpg-btn rpg-btn-secondary text-xs py-2"
            >
              🔑 Join Campaign
            </button>
          </div>

          <p className="text-sm text-slate-400">
            Join standard campaigns, forge your character sheet, purchase magic gear, and explore the map.
          </p>

          <div className="space-y-3">
            {playerCampaigns.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-white/5 rounded-lg text-slate-500 text-sm">
                You haven't joined any campaigns as a player. Ask your DM for a Campaign Code.
              </div>
            ) : (
              playerCampaigns.map(game => {
                const char = allCharacters[`${game.id}_${username.toLowerCase()}`];
                return (
                  <div
                    key={game.id}
                    className="p-4 border border-white/5 bg-black/10 rounded-lg hover:border-blue-500/30 flex justify-between items-center transition group"
                  >
                    <div>
                      <h3 className="text-xl font-fantasy text-blue-400 group-hover:text-blue-300">{game.name}</h3>
                      {char && (
                        <p className="text-xs text-slate-300 mt-1">
                          Character: <span className="text-white font-semibold">{char.name}</span> ({char.race} {char.class}, Level {char.level})
                        </p>
                      )}
                      <span className="inline-block mt-2 mb-2 text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                        ID: {game.id}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectCampaign(game.id, 'player')}
                      className="rpg-btn rpg-btn-secondary text-xs py-1.5 px-3 border-blue-500/20 hover:border-blue-500"
                    >
                      Play Game
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 border-t-4 border-t-amber-500 fade-in">
            <h2 className="text-xl text-gold font-fantasy mb-4">Create Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              {createError && (
                <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs px-3 py-2 rounded">
                  {createError}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Campaign Name</label>
                <input
                  type="text"
                  className="rpg-input"
                  placeholder="e.g. Lost Mine of Phandelver"
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Description</label>
                <textarea
                  className="rpg-input h-24 resize-none"
                  placeholder="Write a brief overview for your players..."
                  value={newGameDesc}
                  onChange={(e) => setNewGameDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setShowCreateModal(false); setCreateError(''); }} className="rpg-btn rpg-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="rpg-btn rpg-btn-primary text-xs">
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN CAMPAIGN MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 border-t-4 border-t-amber-500 fade-in">
            <h2 className="text-xl text-gold font-fantasy mb-4">Join Campaign</h2>
            <form onSubmit={handleJoinCampaign} className="space-y-4">
              {joinError && (
                <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs px-3 py-2 rounded">
                  {joinError}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Campaign Code</label>
                <input
                  type="text"
                  className="rpg-input text-center font-mono uppercase tracking-widest text-lg"
                  placeholder="e.g. G-1234"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-slate-400 text-center">
                Ask your Dungeon Master for the 6-character campaign code.
              </p>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setShowJoinModal(false); setJoinError(''); }} className="rpg-btn rpg-btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" className="rpg-btn rpg-btn-primary text-xs">
                  Validate Code
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
