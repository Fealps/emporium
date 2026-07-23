import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';

import PlayerCharacterSheetTab from '../features/players/PlayerCharacterSheetTab';
import PlayerBackpackTab from '../features/players/PlayerBackpackTab';
import PlayerShopTab from '../features/shops/PlayerShopTab';
import PlayerTravelsTab from '../features/maps/PlayerTravelsTab';
import ChronicleLogsTab from '../features/chronicle/ChronicleLogsTab';

export default function PlayerPanel({ gameId, username, onBackToDashboard }) {
  const [game, setGame] = useState(null);
  const [character, setCharacter] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('sheet'); // 'sheet' | 'inventory' | 'shop' | 'map' | 'logs'

  // Error toasts notification state
  const [toasts, setToasts] = useState([]);

  const addToast = (message) => {
    const id = Date.now() + Math.random().toString();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Reload character and campaign status
  const reloadState = async () => {
    try {
      const g = await db.getGame(gameId);
      setGame(g);
      const char = await db.getCharacter(gameId, username);
      setCharacter(char);
      const logsList = await db.getLogs(gameId);
      setLogs(logsList);
    } catch (e) {
      console.error("Failed to reload player state:", e);
    }
  };

  useEffect(() => {
    reloadState();

    // Listen for storage events or custom logs
    const handleLogEvent = () => reloadState();
    window.addEventListener('emporium_db_log', handleLogEvent);

    return () => {
      window.removeEventListener('emporium_db_log', handleLogEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, username]);

  if (!game || !character) {
    return <div className="text-center py-10 font-fantasy text-gold">Retrieving character sheet...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6 fade-in">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-bold text-amber-400 font-fantasy tracking-wider">
              Adventurer
            </span>
            <span className="text-xs text-slate-500 font-mono">Campaign: {game.name}</span>
          </div>
          <h1 className="text-3xl text-gold font-fantasy mt-1">{character.name}</h1>
          <p className="text-sm text-slate-400 mt-1 italic">
            Level {character.level} • {character.race} {character.class}
          </p>
        </div>

        <button
          onClick={onBackToDashboard}
          className="rpg-btn rpg-btn-secondary text-xs flex items-center gap-2"
        >
          📁 Exit to Guild Hall
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="tc-wrap flex flex-wrap gap-2 border-b border-white/5 pb-2">
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
          🪙 Merchant Shop ({game.store ? game.store.length : 0})
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`btn btn-primary nav-link ${activeTab === 'map' ? 'active' : ''}`}
        >
          🗺 Travels
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`btn btn-primary nav-link ${activeTab === 'logs' ? 'active' : ''}`}
        >
          📜 Scrolls
        </button>
      </div>

      {/* Feature Tab Panels */}
      {activeTab === 'sheet' && (
        <PlayerCharacterSheetTab
          character={character}
          gameId={gameId}
          username={username}
          onRefresh={reloadState}
          addToast={addToast}
        />
      )}

      {activeTab === 'inventory' && (
        <PlayerBackpackTab
          character={character}
          gameId={gameId}
          username={username}
          onRefresh={reloadState}
          addToast={addToast}
        />
      )}

      {activeTab === 'shop' && (
        <PlayerShopTab
          game={game}
          gameId={gameId}
          character={character}
          username={username}
          onRefresh={reloadState}
        />
      )}

      {activeTab === 'map' && <PlayerTravelsTab game={game} />}

      {activeTab === 'logs' && (
        <ChronicleLogsTab logs={logs} gameId={gameId} isDM={false} onRefresh={reloadState} />
      )}

      {/* Toast alert system notifications */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className="rpg-toast">
            <span>⚠️ {t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
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
