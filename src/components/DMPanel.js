import React, { useState, useEffect } from 'react';
import { db } from '../utils/db';

import DMCatalogueTab from '../features/catalogue/DMCatalogueTab';
import DMShopsTab from '../features/shops/DMShopsTab';
import DMMapsTab from '../features/maps/DMMapsTab';
import DMPlayersTrackerTab from '../features/players/DMPlayersTrackerTab';
import ChronicleLogsTab from '../features/chronicle/ChronicleLogsTab';

export default function DMPanel({ gameId, username, onBackToDashboard }) {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('store'); // 'store' | 'shops' | 'map' | 'players' | 'logs'

  // Reload campaign state
  const reloadState = async () => {
    try {
      const g = await db.getGame(gameId);
      setGame(g);
      const chars = await db.getAllCharactersInGame(gameId);
      setPlayers(chars);
      const logsList = await db.getLogs(gameId);
      setLogs(logsList);
    } catch (e) {
      console.error("Failed to reload campaign state:", e);
    }
  };

  useEffect(() => {
    reloadState();

    // Listen for storage events or custom logs
    const handleLogEvent = () => reloadState();
    window.addEventListener('emporium_db_log', handleLogEvent);

    // Interval for travel ticks
    const timer = setInterval(() => {
      const checkTravel = async () => {
        const g = await db.getGame(gameId);
        if (g && g.travelState) {
          const now = Date.now();
          const elapsed = now - g.travelState.startTime;
          if (elapsed >= g.travelState.durationMs) {
            // Travel completed!
            const targetLoc = g.locations.find((l) => l.id === g.travelState.to);
            await db.updateGameTravel(gameId, {
              partyLocation: g.travelState.to,
              travelState: null
            });
            await db.addLog(
              gameId,
              "Dungeon Master",
              `The party has successfully arrived at ${
                targetLoc ? targetLoc.name : 'their destination'
              }.`
            );
            await reloadState();
          }
        }
      };
      checkTravel();
    }, 1000);

    return () => {
      window.removeEventListener('emporium_db_log', handleLogEvent);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (!game) {
    return <div className="text-center py-10 font-fantasy text-gold">Loading campaign vault...</div>;
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6 fade-in">
      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs uppercase font-bold text-amber-400 font-fantasy tracking-wider">
              Dungeon Master
            </span>
            <span className="text-xs text-slate-500 font-mono">Code: {game.id}</span>
          </div>
          <h1 className="text-3xl text-gold font-fantasy mt-1">{game.name}</h1>
          <p className="text-sm text-slate-400 mt-1 italic">{game.description}</p>
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
          onClick={() => setActiveTab('store')}
          className={`btn btn-primary nav-link ${activeTab === 'store' ? 'active' : ''}`}
        >
          💒 Catalogue ({game.store ? game.store.length : 0})
        </button>
        <button
          onClick={() => setActiveTab('shops')}
          className={`btn btn-primary nav-link ${activeTab === 'shops' ? 'active' : ''}`}
        >
          🏪 Shops Manager ({(game.shops || []).length})
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`btn btn-primary nav-link ${activeTab === 'map' ? 'active' : ''}`}
        >
          🗺 Maps & Travels
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

      {/* Feature Tab Panels */}
      {activeTab === 'store' && (
        <DMCatalogueTab game={game} gameId={gameId} onRefresh={reloadState} />
      )}

      {activeTab === 'shops' && (
        <DMShopsTab game={game} gameId={gameId} onRefresh={reloadState} />
      )}

      {activeTab === 'map' && (
        <DMMapsTab game={game} gameId={gameId} onRefresh={reloadState} />
      )}

      {activeTab === 'players' && (
        <DMPlayersTrackerTab game={game} gameId={gameId} players={players} onRefresh={reloadState} />
      )}

      {activeTab === 'logs' && (
        <ChronicleLogsTab logs={logs} gameId={gameId} isDM={true} onRefresh={reloadState} />
      )}
    </div>
  );
}
